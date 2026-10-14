// localhost works everywhere provided the device can reach the host's port 8000:
//   - Android physical device: run `adb reverse tcp:8000 tcp:8000` (re-run after replug)
//   - Android emulator: `adb reverse` works there too; 10.0.2.2 is the alternative
//   - iOS simulator: shares the host's loopback already
// 10.0.2.2 is emulator-ONLY — on a physical device it is a dead address (Network Error).
// NOTE: bare React Native does not auto-load .env — edit the default here if needed.
// Split by build type: a debug build talks to the backend on the desk, a release
// APK talks to production. `__DEV__` is false in a release build, which is what
// makes the split work without a second config file.
//
// localhost needs `adb reverse tcp:8000 tcp:8000` on a physical device, re-run
// after every replug. The emulator is served by the same reverse.
//
// To point a locally-installed RELEASE build at your own machine — checking a
// change you have not deployed yet — set API_BASE_URL in the environment rather
// than editing this line, so production does not get committed away by accident.
export const API_BASE_URL =
  process.env.API_BASE_URL ??
  (__DEV__
    ? 'http://localhost:8000/api/v1'
    : 'https://hse-app-service-backend-eqc7ekghdngrgqgm.uksouth-01.azurewebsites.net/api/v1');


export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'sup_access_token',
  REFRESH_TOKEN: 'sup_refresh_token',
  USER: 'sup_user',
} as const;

export const LEGAL_LINKS = {
  TERMS: 'https://ehsera.com/terms',
  PRIVACY: 'https://ehsera.com/privacy',
} as const;
