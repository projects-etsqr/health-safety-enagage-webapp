import React from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';

// @react-navigation/stack's card transition still calls the now-deprecated
// InteractionManager (see node_modules/react-native/index.js) — upstream, not
// ours to fix, and its dev-only warning was popping the LogBox banner on every
// screen transition.
LogBox.ignoreLogs(['InteractionManager has been deprecated']);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
