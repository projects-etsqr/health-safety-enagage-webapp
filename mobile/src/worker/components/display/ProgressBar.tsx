import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface ProgressBarProps {
  /** 0–100 */
  progress: number;
  label?: string;
  rightLabel?: string;
  color?: string;
  height?: number;
  style?: ViewStyle;
  showPct?: boolean;
}

export function ProgressBar({
  progress,
  label,
  rightLabel,
  color = Colors.blue,
  height = 8,
  style,
  showPct = false,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <View style={[styles.wrapper, style]}>
      {(label || rightLabel || showPct) && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          <Text style={[styles.pct, { color }]}>{rightLabel ?? `${clamped}%`}</Text>
        </View>
      )}
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View style={[
          styles.fill,
          { width: `${clamped}%`, height, borderRadius: height / 2, backgroundColor: color },
        ]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  pct: { fontSize: 18, fontWeight: '800' },
  track: { backgroundColor: '#E2E8F0', overflow: 'hidden' },
  fill: {},
});
