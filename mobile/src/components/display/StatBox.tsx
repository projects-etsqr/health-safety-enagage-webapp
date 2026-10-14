import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface Props {
  label: string;
  value: string | number;
  valueColor?: string;
  style?: ViewStyle;
}

export function StatBox({ label, value, valueColor = Colors.textDark, style }: Props) {
  return (
    <View style={[styles.box, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 12,
    alignItems: 'flex-start',
  },
  label: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginBottom: 4 },
  value: { fontSize: 22, fontWeight: '800' },
});
