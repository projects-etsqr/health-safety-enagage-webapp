import { Alert, PermissionsAndroid, Platform } from 'react-native';

/**
 * Ask for CAMERA at runtime, because nothing else will.
 *
 * react-native-image-picker only requests this itself when the app does NOT
 * declare CAMERA in its manifest. This app does declare it, which flips the
 * responsibility to the caller — and where that request was never made the
 * permission sat at granted=false and `launchCamera` failed every time.
 *
 * That is not a hypothetical: it was written down in the worker's capture hook,
 * fixed there, and then the auditor's checklist screen grew its own `launchCamera`
 * call without it and was broken the same way. So it lives here now, in one
 * place both can reach, rather than as a lesson each screen has to learn again.
 *
 * The gallery path is unaffected — the Android photo picker needs no permission
 * at all — which is why a screen with a broken camera button still had a
 * working "choose from gallery" one, and why that is the fallback every message
 * below points at.
 */
export async function ensureCameraPermission(purpose = 'attach evidence'): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    if (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)) return true;

    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      title: 'Camera access',
      message: `The camera is needed to ${purpose}.`,
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });
    if (result === PermissionsAndroid.RESULTS.GRANTED) return true;

    Alert.alert(
      'Camera permission needed',
      result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ? 'Camera access was turned off for this app. Enable it in Settings → Apps → Permissions, or attach from the gallery instead.'
        : 'Captures need camera access. You can still attach from the gallery.',
    );
    return false;
  } catch (e: any) {
    Alert.alert('Camera unavailable', e?.message ?? 'Could not request camera permission.');
    return false;
  }
}

/**
 * Say why the picker refused, instead of returning as though nothing happened.
 *
 * A silent `if (res.errorCode) return;` is indistinguishable from a dead button,
 * and it is what a permission failure looks like from the outside: the user taps
 * Take a photo, the sheet closes, and nothing exists to tell them why.
 *
 * `didCancel` is deliberately not handled here — backing out of the camera is
 * not an error and interrupting someone over it is noise.
 */
export function reportPickerError(label: string, code?: string, message?: string): void {
  if (code === 'camera_unavailable') {
    Alert.alert('No camera', 'This device has no camera available.');
  } else if (code === 'permission') {
    Alert.alert(
      `${label} permission needed`,
      'Allow access in Settings to attach photos or videos.',
    );
  } else {
    Alert.alert(
      `Could not open ${label.toLowerCase()}`,
      message || 'Please try again, or attach from the gallery instead.',
    );
  }
}
