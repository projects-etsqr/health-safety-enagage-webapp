import React from 'react';
import { View, StatusBar, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoider } from '../../../components/layout/KeyboardAvoider';
import { Colors } from '../../theme/colors';

interface ScreenLayoutProps {
  children: React.ReactNode;
  style?: ViewStyle;
  barStyle?: 'light-content' | 'dark-content';
  bg?: string;
  /** Use true for screens whose header is dark (primary color) */
  darkHeader?: boolean;
  /**
   * Lift content clear of the on-screen keyboard. On by default: every screen
   * that takes typed input wants it, and the ones that take none are unaffected
   * because the wrapper does nothing until a keyboard appears.
   *
   * Pass false only for a screen that runs its own KeyboardAvoidingView — a
   * chat view pinning a composer to the keyboard needs an offset of its own,
   * and two avoiders in a tree pad the same gap twice.
   */
  keyboardAvoiding?: boolean;
}

export function ScreenLayout({
  children,
  style,
  barStyle,
  bg = Colors.background,
  darkHeader = false,
  keyboardAvoiding = true,
}: ScreenLayoutProps) {
  const resolvedBarStyle = barStyle ?? (darkHeader ? 'light-content' : 'dark-content');
  return (
    <View style={[styles.root, { backgroundColor: bg }, style]}>
      <StatusBar barStyle={resolvedBarStyle} backgroundColor={darkHeader ? Colors.primary : bg} />
      {keyboardAvoiding ? <KeyboardAvoider>{children}</KeyboardAvoider> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
