import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { launchCamera, launchImageLibrary, Asset, ImageLibraryOptions } from 'react-native-image-picker';
import { ensureCameraPermission } from '../../utils/cameraPermission';
import { authService } from '../services/authService';

/** Downscaled hard enough that the base64 payload stays under the server cap. */
const PICKER_OPTIONS: ImageLibraryOptions = {
  mediaType: 'photo',
  quality: 0.7,
  maxWidth: 512,
  maxHeight: 512,
  includeBase64: true,
  selectionLimit: 1,
};

type Result = { ok: true; photo: string | null } | { ok: false; error: string };

/**
 * The library always launches the Android 13+ system photo picker
 * (ACTION_PICK_IMAGES) and has no fallback. Some emulator images register the
 * activity without exposing its intent filter, so the launch throws. Real
 * devices are unaffected — translate the raw platform text into something
 * actionable rather than surfacing "No Activity found to handle Intent".
 */
function describePickerError(raw?: string): string {
  if (raw && /No Activity found|ActivityNotFound/i.test(raw)) {
    return 'No photo picker is available on this device. Try taking a photo instead.';
  }
  return raw || 'Could not open the gallery.';
}

export function useProfilePhoto() {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(async (dataUri: string | null): Promise<Result> => {
    setUploading(true);
    try {
      await authService.setMyPhoto(dataUri);
      return { ok: true, photo: dataUri };
    } catch (err: any) {
      return {
        ok: false,
        error:
          err?.response?.data?.detail?.[0]?.msg ||
          err?.response?.data?.detail ||
          'Could not upload photo. Please try again.',
      };
    } finally {
      setUploading(false);
    }
  }, []);

  const handleAsset = useCallback(
    async (asset: Asset | undefined, done: (r: Result) => void) => {
      if (!asset?.base64) {
        done({ ok: false, error: 'Could not read the selected image.' });
        return;
      }
      const mime = asset.type === 'image/png' ? 'image/png' : 'image/jpeg';
      done(await upload(`data:${mime};base64,${asset.base64}`));
    },
    [upload],
  );

  /** Prompts for a source, then uploads. `done` fires only when something changed. */
  const change = useCallback(
    (done: (r: Result) => void, hasExisting = false) => {
      const options: any[] = [
        {
          text: 'Take Photo',
          // The app declares CAMERA in its manifest, which makes requesting it
          // the caller's job — react-native-image-picker only asks on its own
          // when the app has not declared it. Without this the camera failed
          // every time and the only visible result was "Camera unavailable".
          onPress: async () => {
            if (!(await ensureCameraPermission('take your profile photo'))) return;
            launchCamera({ ...PICKER_OPTIONS, saveToPhotos: false }, res => {
              if (res.didCancel) return;
              if (res.errorCode) { done({ ok: false, error: res.errorMessage || 'Camera unavailable.' }); return; }
              handleAsset(res.assets?.[0], done);
            });
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: () =>
            launchImageLibrary(PICKER_OPTIONS, res => {
              if (res.didCancel) return;
              if (res.errorCode) { done({ ok: false, error: describePickerError(res.errorMessage) }); return; }
              handleAsset(res.assets?.[0], done);
            }),
        },
      ];

      if (hasExisting) {
        options.push({
          text: 'Remove Photo',
          style: 'destructive',
          onPress: async () => done(await upload(null)),
        });
      }
      options.push({ text: 'Cancel', style: 'cancel' });

      Alert.alert('Profile Photo', 'Choose a source', options);
    },
    [handleAsset, upload],
  );

  return { change, uploading };
}
