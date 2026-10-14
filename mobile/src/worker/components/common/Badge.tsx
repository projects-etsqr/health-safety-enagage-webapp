import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

type BadgeVariant = 'critical' | 'high' | 'medium' | 'low' | 'success' | 'info' | 'default';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string }> = {
  critical: { bg: Colors.criticalBg, text: Colors.critical },
  high:     { bg: Colors.warningBg, text: Colors.warning },
  medium:   { bg: '#FFF8E1', text: '#F57C00' },
  low:      { bg: Colors.successBg, text: Colors.success },
  success:  { bg: Colors.successBg, text: Colors.success },
  info:     { bg: '#E3F2FD', text: Colors.blue },
  default:  { bg: Colors.background, text: Colors.textMid },
};

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }]}>
      <Text style={[styles.text, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  text: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
