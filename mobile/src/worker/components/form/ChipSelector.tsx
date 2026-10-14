import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

export interface ChipOption {
  label: string;
  value: string;
  icon?: string;
  color?: string;
  bg?: string;
}

interface ChipSelectorProps {
  options: ChipOption[] | string[];
  /** Single value for single-select, string[] for multi-select */
  value: string | string[];
  onChange: (value: any) => void;
  multi?: boolean;
  scroll?: boolean;
  style?: ViewStyle;
  chipStyle?: ViewStyle;
}

function toChip(o: ChipOption | string): ChipOption {
  return typeof o === 'string' ? { label: o, value: o } : o;
}

export function ChipSelector({ options, value, onChange, multi = false, scroll = false, style, chipStyle }: ChipSelectorProps) {
  const chips = options.map(toChip);

  const isSelected = (v: string) =>
    multi ? (value as string[]).includes(v) : value === v;

  const handlePress = (v: string) => {
    if (multi) {
      const arr = value as string[];
      onChange(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
    } else {
      onChange(value === v ? '' : v);
    }
  };

  const content = (
    <View style={[styles.row, scroll && styles.rowScroll, style]}>
      {chips.map(chip => {
        const sel = isSelected(chip.value);
        return (
          <TouchableOpacity
            key={chip.value}
            style={[
              styles.chip,
              sel && styles.chipSelected,
              sel && chip.bg ? { backgroundColor: chip.bg, borderColor: chip.color ?? Colors.blue } : undefined,
              chipStyle,
            ]}
            onPress={() => handlePress(chip.value)}
            activeOpacity={0.75}
          >
            {chip.icon && <Text style={styles.chipIcon}>{chip.icon}</Text>}
            <Text style={[styles.chipText, sel && styles.chipTextSelected, sel && chip.color ? { color: chip.color } : undefined]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (scroll) {
    return <ScrollView horizontal showsHorizontalScrollIndicator={false}>{content}</ScrollView>;
  }
  return content;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowScroll: { flexWrap: 'nowrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card,
  },
  chipSelected: { borderColor: Colors.blue, backgroundColor: '#EEF4FF' },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: 13, color: Colors.textMid, fontWeight: '500' },
  chipTextSelected: { color: Colors.blue, fontWeight: '700' },
});
