import React, { useState } from 'react';
import { Icon } from '../display/Icon';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, ScrollView } from 'react-native';
import { Colors } from '../../theme/colors';

export interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownProps {
  label?: string;
  required?: boolean;
  options: DropdownOption[] | string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

function toOption(o: DropdownOption | string): DropdownOption {
  return typeof o === 'string' ? { label: o, value: o } : o;
}

export function Dropdown({
  label,
  required,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  error,
  containerStyle,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const opts = options.map(toOption);
  const selected = opts.find(o => o.value === value);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}{required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <TouchableOpacity
        style={[styles.trigger, open && styles.triggerOpen, !!error && styles.triggerError]}
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.8}
      >
        <Text style={selected ? styles.selected : styles.placeholder}>
          {selected?.label ?? placeholder}
        </Text>
        <Text style={[styles.arrow, open && styles.arrowOpen]}>▾</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.menu}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
            {opts.map((opt, i) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.item, i < opts.length - 1 && styles.itemBorder, opt.value === value && styles.itemActive]}
                onPress={() => { onChange(opt.value); setOpen(false); }}
              >
                <Text style={[styles.itemText, opt.value === value && styles.itemTextActive]}>{opt.label}</Text>
                {opt.value === value && <Icon emoji="✓" style={styles.tick} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.6, marginBottom: 7, textTransform: 'uppercase' },
  required: { color: Colors.critical },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    backgroundColor: Colors.card, paddingHorizontal: 14, paddingVertical: 13,
  },
  triggerOpen: { borderColor: Colors.blue, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  triggerError: { borderColor: Colors.critical },
  selected: { fontSize: 15, color: Colors.textDark, fontWeight: '500', flex: 1 },
  placeholder: { fontSize: 15, color: Colors.textLight, flex: 1 },
  arrow: { fontSize: 16, color: Colors.textMuted },
  arrowOpen: { transform: [{ rotate: '180deg' }] },
  menu: {
    backgroundColor: Colors.card, borderWidth: 1.5, borderTopWidth: 0,
    borderColor: Colors.blue, borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6,
  },
  item: { paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center' },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemActive: { backgroundColor: '#EFF5FF' },
  itemText: { flex: 1, fontSize: 15, color: Colors.textDark },
  itemTextActive: { color: Colors.blue, fontWeight: '600' },
  tick: { fontSize: 14, color: Colors.blue, fontWeight: '700' },
  error: { fontSize: 12, color: Colors.critical, marginTop: 4 },
});
