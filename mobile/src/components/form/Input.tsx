import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  required?: boolean;
}

export function Input({ label, error, rightIcon, onRightIconPress, required, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? Colors.critical : focused ? Colors.blue : Colors.border;

  return (
    <View style={styles.wrap}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.req}> *</Text>}
        </Text>
      )}
      <View style={[styles.row, { borderColor }]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.textLight}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.icon}>
            <Ionicons name={rightIcon} size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textMid, marginBottom: 6 },
  req: { color: Colors.critical },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 15, color: Colors.textDark, paddingVertical: 12 },
  icon: { padding: 4 },
  error: { fontSize: 12, color: Colors.critical, marginTop: 4 },
});
