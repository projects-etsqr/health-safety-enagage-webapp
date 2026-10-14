/** @type {import('jest').Config} */
module.exports = {
  preset: '@react-native/jest-preset',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/__mocks__/async-storage.ts',
    '^react-native-reanimated$':
      '<rootDir>/__mocks__/reanimated.ts',
    '^react-native-gesture-handler$':
      '<rootDir>/__mocks__/gesture-handler.ts',
    '^react-native-screens$':
      '<rootDir>/__mocks__/screens.ts',
    '^react-native-svg$':
      '<rootDir>/__mocks__/svg.ts',
    '^react-native-vector-icons/.*$':
      '<rootDir>/__mocks__/vector-icons.ts',
    '^@expo/vector-icons$':
      '<rootDir>/__mocks__/vector-icons.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-svg|react-native-vector-icons|@react-native-async-storage)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
