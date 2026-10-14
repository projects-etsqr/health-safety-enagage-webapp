import { useState } from 'react';
import { Alert } from 'react-native';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import { MediaAttachment } from '../types';
// Shared with the auditor's checklist screen. Kept in one place after that
// screen grew its own launchCamera call without the permission request and was
// silently broken by exactly the problem this solves.
import { ensureCameraPermission, reportPickerError } from '../../utils/cameraPermission';

/**
 * Attaching evidence to a report: photograph it, film it, or pick either from
 * the gallery.
 *
 * Replaces `usePhotoCapture`, which offered photographs only. Video was never a
 * backend limitation — `media_storage.ALLOWED_CONTENT_TYPES` has accepted mp4,
 * mov, webm and 3gp since it was written, with a 100 MB cap chosen for exactly
 * this — the capture UI simply never asked for it. Some evidence only reads as
 * evidence in motion: a guard rattling loose, a leak's rate, a reversing vehicle
 * with no banksman.
 *
 * The behaviour here is lifted from ReportIncidentScreen, which had grown a
 * private implementation of all of this. That screen is the reason the Android
 * permission dance below is not optional.
 */

/** How long a single recording may run. Kept short deliberately: this is
 *  evidence of a condition, not a site tour, and every second is upload the
 *  worker may be paying for on mobile data. */
const MAX_VIDEO_SECONDS = 30;

/** Mirrors `media_storage.MAX_BYTES`. Checked on the device so a worker learns
 *  the file is too big before spending the upload, not after. */
const MAX_BYTES = 100 * 1024 * 1024;

export interface UseMediaCaptureOptions {
  maxItems?: number;
  /** Set false for a form that genuinely only accepts stills. */
  allowVideo?: boolean;
}

function isVideoAsset(a: Asset): boolean {
  return Boolean(
    a.type?.startsWith('video/') ||
    a.uri?.toLowerCase().endsWith('.mp4') ||
    a.uri?.toLowerCase().endsWith('.mov'),
  );
}

export function useMediaCapture(options: UseMediaCaptureOptions | number = {}) {
  // The old hook took a bare `maxPhotos` number. Accepting both keeps every
  // existing call site working through the rename.
  const { maxItems = 5, allowVideo = true } =
    typeof options === 'number' ? { maxItems: options, allowVideo: true } : options;

  const [items, setItems] = useState<MediaAttachment[]>([]);

  const addAssets = (assets?: Asset[]) => {
    const room = maxItems - items.length;
    if (room <= 0) return;

    const picked: MediaAttachment[] = [];
    let oversized = 0;

    for (const a of (assets ?? []).filter(x => !!x.uri).slice(0, room)) {
      if (a.fileSize && a.fileSize > MAX_BYTES) {
        oversized += 1;
        continue;
      }
      const video = isVideoAsset(a);
      picked.push({
        uri: a.uri as string,
        name: a.fileName || `evidence_${Date.now()}_${picked.length}.${video ? 'mp4' : 'jpg'}`,
        type: a.type || (video ? 'video/mp4' : 'image/jpeg'),
        kind: video ? 'video' : 'photo',
        durationSec: a.duration,
        sizeBytes: a.fileSize,
      });
    }

    if (oversized > 0) {
      Alert.alert(
        'File too large',
        `${oversized} file${oversized === 1 ? ' was' : 's were'} over ${MAX_BYTES / (1024 * 1024)} MB and could not be attached. ` +
        'Record a shorter clip, or attach a photo instead.',
      );
    }
    if (picked.length) setItems(prev => [...prev, ...picked]);
  };

  const takePhoto = async () => {
    if (!(await ensureCameraPermission('attach evidence to this report'))) return;
    const res = await launchCamera({
      mediaType: 'photo', quality: 0.7, maxWidth: 1600, maxHeight: 1600, saveToPhotos: false,
    });
    if (res.didCancel) return;
    if (res.errorCode) return reportPickerError('Camera', res.errorCode, res.errorMessage);
    addAssets(res.assets);
  };

  const recordVideo = async () => {
    if (!(await ensureCameraPermission('attach evidence to this report'))) return;
    const res = await launchCamera({
      mediaType: 'video',
      videoQuality: 'medium',
      durationLimit: MAX_VIDEO_SECONDS,
      saveToPhotos: false,
    });
    if (res.didCancel) return;
    if (res.errorCode) return reportPickerError('Camera', res.errorCode, res.errorMessage);
    addAssets(res.assets);
  };

  const openGallery = async () => {
    const res = await launchImageLibrary({
      // 'mixed' so the worker can attach a clip they already filmed — often the
      // only record of something that has since been made safe.
      mediaType: allowVideo ? 'mixed' : 'photo',
      quality: 0.7,
      maxWidth: 1600,
      maxHeight: 1600,
      selectionLimit: Math.max(1, maxItems - items.length),
    });
    if (res.didCancel) return;
    if (res.errorCode) return reportPickerError('Gallery', res.errorCode, res.errorMessage);
    addAssets(res.assets);
  };

  const launch = () => {
    if (items.length >= maxItems) {
      Alert.alert('Limit reached', `You can attach up to ${maxItems} files.`);
      return;
    }
    Alert.alert(
      'Add evidence',
      allowVideo ? 'Photograph it, film it, or attach one you already have.' : 'Choose a source',
      [
        { text: 'Take photo', onPress: takePhoto },
        ...(allowVideo
          ? [{ text: `Record video (${MAX_VIDEO_SECONDS}s max)`, onPress: recordVideo }]
          : []),
        { text: 'Choose from gallery', onPress: openGallery },
        { text: 'Cancel', style: 'cancel' as const },
      ],
      { cancelable: true },
    );
  };

  const remove = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  return {
    /** Everything attached, in the order it was added. */
    items,
    /** What the upload needs — the same objects, minus the display-only fields. */
    attachments: items.map(({ uri, name, type }) => ({ uri, name, type })),
    launch,
    takePhoto,
    recordVideo,
    openGallery,
    remove,
    maxItems,
  };
}
