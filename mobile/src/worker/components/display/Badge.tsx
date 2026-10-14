import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

export type BadgeVariant = 'critical' | 'high' | 'medium' | 'low' | 'success' | 'info' | 'warning' | 'default';

const VARIANT: Record<BadgeVariant, { bg: string; text: string }> = {
  critical: { bg: Colors.criticalBg, text: Colors.critical },
  high:     { bg: Colors.warningBg,  text: Colors.warning },
  medium:   { bg: '#FFF8E1',         text: '#F57C00' },
  low:      { bg: Colors.successBg,  text: Colors.success },
  success:  { bg: Colors.successBg,  text: Colors.success },
  warning:  { bg: Colors.warningBg,  text: Colors.warning },
  info:     { bg: '#E3F2FD',         text: Colors.blue },
  default:  { bg: Colors.background, text: Colors.textMid },
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  /** Override colors directly */
  color?: string;
  bg?: string;
  style?: ViewStyle;
}

export function Badge({ label, variant = 'default', color, bg, style }: BadgeProps) {
  const v = VARIANT[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg ?? v.bg }, style]}>
      <Text style={[styles.text, { color: color ?? v.text }]}>{label}</Text>
    </View>
  );
}

/** Shorthand for CRITICAL / HIGH / ROUTINE priority display */
export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, BadgeVariant> = {
    CRITICAL: 'critical', HIGH: 'high', ROUTINE: 'low', MEDIUM: 'medium',
  };
  return <Badge label={priority} variant={map[priority] ?? 'default'} />;
}

/** Status chip — derives color from status string */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    submitted: 'info',
    approved: 'success',
    active: 'success',
    closed: 'default',
    rejected: 'critical',
    draft: 'default',
    'under review': 'warning',
    'pending approval': 'warning',
    'in progress': 'info',
  };
  return <Badge label={status} variant={map[status.toLowerCase()] ?? 'default'} />;
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  text: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
});
