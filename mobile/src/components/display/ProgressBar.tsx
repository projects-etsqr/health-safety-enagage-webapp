import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

interface Props {
  progress: number;
  color?: string;
  height?: number;
  label?: string;
  showPct?: boolean;
}

export function ProgressBar({ progress, color = Colors.blue, height = 6, label, showPct }: Props) {
  const pct = Math.min(100, Math.max(0, progress));
  return (
    <View>
      {(label || showPct) && (
        <View style={styles.row}>
          {label && <Text style={styles.label}>{label}</Text>}
          {showPct && <Text style={styles.pct}>{pct}%</Text>}
        </View>
      )}
      <View style={[styles.track, { height }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color, height }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 12, color: Colors.textMuted },
  pct: { fontSize: 12, fontWeight: '600', color: Colors.textMid },
  track: { backgroundColor: Colors.border, borderRadius: 99, overflow: 'hidden' },
  fill: { borderRadius: 99 },
});
