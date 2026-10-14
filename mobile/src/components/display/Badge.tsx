import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

type Variant = 'primary' | 'success' | 'warning' | 'critical' | 'info' | 'muted';

const CONFIGS: Record<Variant, { bg: string; color: string }> = {
  primary: { bg: '#E3F2FD', color: Colors.blue },
  success: { bg: Colors.successBg, color: Colors.success },
  warning: { bg: Colors.warningBg, color: Colors.warning },
  critical: { bg: Colors.criticalBg, color: Colors.critical },
  info: { bg: '#EEF2FF', color: Colors.accent },
  muted: { bg: Colors.divider, color: Colors.textMuted },
};

interface Props {
  label: string;
  variant?: Variant;
  style?: ViewStyle;
}

export function Badge({ label, variant = 'info', style }: Props) {
  const { bg, color } = CONFIGS[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
});
