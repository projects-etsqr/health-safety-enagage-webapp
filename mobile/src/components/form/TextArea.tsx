import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Colors } from '../../theme/colors';

interface Props extends TextInputProps {
  label?: string;
  minHeight?: number;
  error?: string;
}

export function TextArea({ label, minHeight = 100, error, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? Colors.critical : focused ? Colors.blue : Colors.border;

  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        multiline
        textAlignVertical="top"
        style={[styles.input, { borderColor, minHeight }, style]}
        placeholderTextColor="#94A3B8"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textMid, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    backgroundColor: Colors.white,
    padding: 12,
    fontSize: 14,
    color: Colors.textDark,
  },
  error: { fontSize: 12, color: Colors.critical, marginTop: 4 },
});
