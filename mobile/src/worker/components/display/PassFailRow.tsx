import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { Colors } from '../../theme/colors';

type Result = 'pass' | 'fail' | null;

interface PassFailRowProps {
  value: Result;
  onChange: (v: Result) => void;
  style?: ViewStyle;
}

export function PassFailRow({ value, onChange, style }: PassFailRowProps) {
  const toggle = (next: 'pass' | 'fail') => onChange(value === next ? null : next);

  return (
    <View style={[styles.row, style]}>
      <TouchableOpacity
        style={[styles.btn, value === 'pass' && styles.passBtnActive]}
        onPress={() => toggle('pass')}
        activeOpacity={0.8}
      >
        <Icon name="check" size={14} color={value === 'pass' ? Colors.white : Colors.textMuted} style={styles.btnIcon} />
        <Text style={[styles.btnText, value === 'pass' && styles.passTextActive]}>PASS</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, value === 'fail' && styles.failBtnActive]}
        onPress={() => toggle('fail')}
        activeOpacity={0.8}
      >
        <Icon name="x" size={14} color={value === 'fail' ? Colors.white : Colors.textMuted} style={styles.btnIcon} />
        <Text style={[styles.btnText, value === 'fail' && styles.failTextActive]}>FAIL</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, flexDirection: 'row', borderRadius: 8, paddingVertical: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  btnIcon: { marginRight: 6 },
  passBtnActive: { backgroundColor: Colors.blue, borderColor: Colors.blue },
  failBtnActive: { backgroundColor: Colors.critical, borderColor: Colors.critical },
  btnText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  passTextActive: { color: Colors.white },
  failTextActive: { color: Colors.white },
});
