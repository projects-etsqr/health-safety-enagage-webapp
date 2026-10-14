// Jest global setup file. Loads mock implementations for native modules that
// cannot run inside a Node test environment.

// AsyncStorage mock (community module)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// reanimated must be mocked before any module that imports it is loaded
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// react-native-gesture-handler Jest setup
require('react-native-gesture-handler/jestSetup');

// screens
jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
  Screen: ({ children }) => children,
  ScreenContainer: ({ children }) => children,
}));

// vector-icons (covers both bare RN and @expo/vector-icons shim)
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcons');
jest.mock('react-native-vector-icons/FontAwesome', () => 'FontAwesome');
jest.mock('react-native-vector-icons/Feather', () => 'Feather');
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg',
  Path: 'Path',
  Circle: 'Circle',
  G: 'G',
  Rect: 'Rect',
  Text: 'Text',
  TSpan: 'TSpan',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Stop: 'Stop',
}));
