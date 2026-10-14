import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  elevation?: number;
  padding?: number;
  radius?: number;
  accentColor?: string;
}

export function Card({ children, style, elevation = 1, padding = 16, radius = 12, accentColor }: Props) {
  return (
    <View
      style={[
        styles.card,
        {
          padding,
          borderRadius: radius,
          elevation,
          shadowOpacity: elevation * 0.03,
          borderLeftWidth: accentColor ? 4 : 0,
          borderLeftColor: accentColor ?? 'transparent',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    marginBottom: 12,
  },
});
