import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface StepDotsProps {
  total: number;
  current: number;
  onPress?: (index: number) => void;
  style?: ViewStyle;
}

/** Numbered circle step indicator — used on task perform screen */
export function StepDots({ total, current, onPress, style }: StepDotsProps) {
  return (
    <View style={[styles.row, style]}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.dot, active && styles.dotActive, done && styles.dotDone]}
            onPress={() => onPress?.(i)}
            disabled={!onPress}
          >
            <Text style={[styles.num, (active || done) && styles.numActive]}>{i + 1}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface StepProgressBarProps {
  total: number;
  current: number;
  style?: ViewStyle;
}

/** Flat segmented step bar — used on multi-step form wizard */
export function StepProgressBar({ total, current, style }: StepProgressBarProps) {
  return (
    <View style={[styles.barRow, style]}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.segment, i <= current && styles.segmentFilled]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  dot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  dotActive: { backgroundColor: Colors.blue },
  dotDone: { backgroundColor: Colors.success },
  num: { fontWeight: '700', color: Colors.textMuted, fontSize: 13 },
  numActive: { color: Colors.white },

  barRow: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#D1D9E6' },
  segmentFilled: { backgroundColor: Colors.blue },
});
