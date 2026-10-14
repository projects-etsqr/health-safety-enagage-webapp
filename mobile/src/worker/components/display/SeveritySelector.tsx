import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

const LEVELS = [
  { key: 'low',      label: 'LOW',      color: Colors.success,  bg: Colors.successBg },
  { key: 'medium',   label: 'MEDIUM',   color: '#F57C00',       bg: '#FFF3E0' },
  { key: 'high',     label: 'HIGH',     color: '#E65100',       bg: '#FBE9E7' },
  { key: 'critical', label: 'CRITICAL', color: Colors.critical, bg: Colors.criticalBg },
];

interface SeveritySelectorProps {
  value: string;
  onChange: (v: string) => void;
  style?: ViewStyle;
}

export function SeveritySelector({ value, onChange, style }: SeveritySelectorProps) {
  return (
    <View style={[styles.row, style]}>
      {LEVELS.map(l => {
        const sel = value === l.key;
        return (
          <TouchableOpacity
            key={l.key}
            style={[styles.chip, { backgroundColor: l.bg }, sel && { borderColor: l.color, borderWidth: 2 }]}
            onPress={() => onChange(l.key)}
            activeOpacity={0.8}
          >
            <View style={[styles.dot, { backgroundColor: l.color }]} />
            <Text style={[styles.label, { color: l.color }]}>{l.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
