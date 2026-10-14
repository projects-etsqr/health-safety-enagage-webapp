const fs = require('fs');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration for bare React Native.
 * https://reactnative.dev/docs/metro
 *
 * The Android build is launched from a short subst drive so native paths stay
 * under Windows' 260-character limit. Metro realpath's files back to this
 * folder, so the bundler root has to be that real path or release bundling
 * fails with "Failed to get the SHA-1".
 */
const projectRoot = fs.realpathSync.native(__dirname);

const config = {
  projectRoot,
  watchFolders: [projectRoot],
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
