import React from 'react';
import { Icon } from '../display/Icon';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  style?: ViewStyle;
}

export function Checkbox({ label, checked, onChange, style }: CheckboxProps) {
  return (
    <TouchableOpacity
      style={[styles.row, style]}
      onPress={() => onChange(!checked)}
      activeOpacity={0.8}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Icon emoji="✓" style={styles.tick} />}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

interface CheckboxGroupProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  columns?: 1 | 2;
  style?: ViewStyle;
}

export function CheckboxGroup({ options, selected, onChange, columns = 2, style }: CheckboxGroupProps) {
  const toggle = (item: string) => {
    onChange(selected.includes(item) ? selected.filter(s => s !== item) : [...selected, item]);
  };

  return (
    <View style={[styles.grid, style]}>
      {options.map(opt => (
        <Checkbox
          key={opt}
          label={opt}
          checked={selected.includes(opt)}
          onChange={() => toggle(opt)}
          style={columns === 2 ? styles.halfItem : styles.fullItem}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  boxChecked: { backgroundColor: Colors.blue, borderColor: Colors.blue },
  tick: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  label: { fontSize: 14, color: Colors.textDark, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  halfItem: { width: '47%' },
  fullItem: { width: '100%' },
});
