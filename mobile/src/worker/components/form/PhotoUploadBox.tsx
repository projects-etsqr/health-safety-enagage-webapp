import React from 'react';
import { Icon } from '../display/Icon';
import { View, Text, TouchableOpacity, Image, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';
import type { MediaAttachment } from '../../types';

/**
 * Evidence attached to a report — stills and clips together.
 *
 * A video cannot go through `<Image>`: React Native renders nothing for a
 * video URI on either platform, so a clip used to appear as an empty tile with
 * a delete button and no way to tell what it was. Videos get their own tile
 * with a play badge and the duration instead. Generating a real first-frame
 * thumbnail would need a native module, which is not worth a dependency for a
 * tile the worker looks at for a few seconds before submitting.
 */

interface MediaUploadBoxProps {
  /** Everything attached so far, photos and videos alike. */
  items?: MediaAttachment[];
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  title?: string;
  subtitle?: string;
  maxItems?: number;
  style?: ViewStyle;
}

function durationLabel(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const s = Math.round(seconds);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function MediaUploadBox({
  items = [],
  onAdd,
  onRemove,
  title = 'Add Evidence',
  subtitle = 'Tap to take a photo, record a video, or attach one you already have',
  maxItems = 5,
  style,
}: MediaUploadBoxProps) {
  const canAdd = items.length < maxItems;
  const videoCount = items.filter(i => i.kind === 'video').length;

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.row}>
        {canAdd && (
          <TouchableOpacity style={styles.addBox} onPress={onAdd} activeOpacity={0.8}>
            <Icon name="camera" style={styles.addIcon} color={Colors.blue} />
            <Text style={styles.addTitle}>{title}</Text>
            <Text style={styles.galleryLink}>photo or video</Text>
          </TouchableOpacity>
        )}

        {items.map((item, i) => (
          <View key={`${item.uri}-${i}`} style={styles.preview}>
            {item.kind === 'video' ? (
              <View style={styles.videoTile}>
                <Icon name="video" style={styles.videoIcon} color="#FFFFFF" />
                <Text style={styles.videoLabel}>
                  {durationLabel(item.durationSec) ?? 'Video'}
                </Text>
              </View>
            ) : (
              <Image source={{ uri: item.uri }} style={styles.thumb} />
            )}
            {onRemove && (
              <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(i)}>
                <Icon emoji="✕" style={styles.removeIcon} />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {items.length === 0 && !canAdd && (
          <View style={styles.emptyDash}>
            <Text style={styles.emptyText}>No evidence added</Text>
          </View>
        )}
      </View>

      <Text style={styles.hint}>
        {items.length === 0
          ? subtitle
          : `${items.length} file${items.length === 1 ? '' : 's'} attached` +
            (videoCount > 0 ? ` — ${videoCount} video${videoCount === 1 ? '' : 's'}` : '')}
      </Text>
    </View>
  );
}

interface PhotoUploadBoxProps {
  /** Already captured photo URIs */
  photos?: string[];
  onTakePhoto?: () => void;
  onPickGallery?: () => void;
  onRemove?: (index: number) => void;
  title?: string;
  subtitle?: string;
  maxPhotos?: number;
  style?: ViewStyle;
}

/** Stills only. Superseded by MediaUploadBox; kept for callers that genuinely
 *  cannot accept a video. */
export function PhotoUploadBox({
  photos = [],
  onTakePhoto,
  onPickGallery,
  onRemove,
  title = 'Add Photo',
  subtitle = 'Tap to take or upload photo',
  maxPhotos = 5,
  style,
}: PhotoUploadBoxProps) {
  const canAdd = photos.length < maxPhotos;

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.row}>
        {/* Add button */}
        {canAdd && (
          <TouchableOpacity style={styles.addBox} onPress={onTakePhoto} activeOpacity={0.8}>
            <Icon name="camera" style={styles.addIcon} color={Colors.blue} />
            <Text style={styles.addTitle}>{title}</Text>
            {onPickGallery && (
              <TouchableOpacity onPress={onPickGallery}>
                <Text style={styles.galleryLink}>or Gallery</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}

        {/* Preview thumbnails */}
        {photos.map((uri, i) => (
          <View key={i} style={styles.preview}>
            <Image source={{ uri }} style={styles.thumb} />
            {onRemove && (
              <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(i)}>
                <Icon emoji="✕" style={styles.removeIcon} />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Empty dashed placeholder when no photos */}
        {photos.length === 0 && !canAdd && (
          <View style={styles.emptyDash}>
            <Text style={styles.emptyText}>No photos added</Text>
          </View>
        )}
      </View>

      <Text style={styles.hint}>{subtitle}</Text>
    </View>
  );
}

/** Simpler single dashed upload box (for attachments / JSA file) */
interface AttachBoxProps {
  icon?: string;
  title?: string;
  subtitle?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function AttachBox({ icon = '☁️', title = 'Attach file', subtitle = 'PDF, JPG, or PNG (Max 5MB)', onPress, style }: AttachBoxProps) {
  return (
    <TouchableOpacity style={[styles.attachBox, style]} onPress={onPress} activeOpacity={0.8}>
      <Icon emoji={icon} style={styles.attachIcon} color={Colors.blue} />
      <Text style={styles.attachTitle}>{title}</Text>
      <Text style={styles.attachSub}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  addBox: {
    width: 110, height: 110, borderWidth: 2, borderColor: Colors.border,
    borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F8FAFF',
  },
  addIcon: { fontSize: 26, marginBottom: 4 },
  addTitle: { fontSize: 12, color: Colors.blue, fontWeight: '600', textAlign: 'center' },
  galleryLink: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  preview: { width: 110, height: 110, borderRadius: 14, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  videoTile: {
    width: '100%', height: '100%', backgroundColor: '#0F172A',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  videoIcon: { fontSize: 26 },
  videoLabel: { fontSize: 11, color: '#E2E8F0', fontWeight: '700' },
  removeBtn: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 3,
  },
  removeIcon: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  emptyDash: {
    flex: 1, minHeight: 80, borderWidth: 2, borderColor: Colors.border,
    borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontSize: 13, color: Colors.textLight },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 8 },

  attachBox: {
    borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed',
    borderRadius: 14, padding: 22, alignItems: 'center', backgroundColor: '#F8FAFF',
  },
  attachIcon: { fontSize: 30, marginBottom: 8 },
  attachTitle: { fontSize: 14, fontWeight: '600', color: Colors.blue, marginBottom: 3 },
  attachSub: { fontSize: 12, color: Colors.textMuted },
});
