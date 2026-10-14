const fs = require('fs');
const path = require('path');

// Same real path Metro uses. A relative alias is resolved on the subst drive
// (H:) and then prefixed as "./H:/...", which Metro cannot resolve.
const projectRoot = fs.realpathSync.native(__dirname);

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          // Keep `@expo/vector-icons` imports working on bare React Native.
          '@expo/vector-icons': path.join(projectRoot, 'src/shims/expoVectorIcons'),
        },
      },
    ],
  ],
};
