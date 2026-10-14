import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '../../theme/colors';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Highlight left border with a color */
  accentColor?: string;
  elevation?: 0 | 1 | 2 | 4;
  radius?: number;
  padding?: number;
}

export function Card({ children, style, accentColor, elevation = 1, radius = 16, padding = 16 }: CardProps) {
  return (
    <View style={[
      styles.base,
      { borderRadius: radius, padding, elevation },
      accentColor && { borderLeftWidth: 4, borderLeftColor: accentColor },
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
