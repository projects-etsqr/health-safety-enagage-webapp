import React from 'react';
import { View, StatusBar, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  dark?: boolean;
}

export function ScreenLayout({ children, style, dark }: Props) {
  return (
    <View style={[styles.root, style]}>
      <StatusBar
        barStyle={dark ? 'light-content' : 'dark-content'}
        backgroundColor={dark ? Colors.primary : Colors.background}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});
