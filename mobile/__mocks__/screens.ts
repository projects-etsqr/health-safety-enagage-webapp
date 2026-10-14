/* eslint-env jest */
// Minimal react-native-screens mock.

module.exports = {
  __esModule: true,
  enableScreens: () => {},
  Screen: ({ children }: { children?: unknown }) => children,
  ScreenContainer: ({ children }: { children?: unknown }) => children,
  NativeScreen: ({ children }: { children?: unknown }) => children,
  NativeScreenContainer: ({ children }: { children?: unknown }) => children,
  ScreenStack: ({ children }: { children?: unknown }) => children,
  ScreenStackHeaderConfig: () => null,
};
