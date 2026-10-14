import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface TextAreaProps {
  label?: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChangeText: (t: string) => void;
  minHeight?: number;
  maxLength?: number;
  error?: string;
  containerStyle?: ViewStyle;
}

export function TextArea({
  label,
  required,
  placeholder,
  value,
  onChangeText,
  minHeight = 100,
  maxLength,
  error,
  containerStyle,
}: TextAreaProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}{required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <TextInput
        style={[styles.area, { minHeight }, focused && styles.focused, !!error && styles.errored]}
        multiline
        textAlignVertical="top"
        placeholder={placeholder}
        placeholderTextColor={Colors.textLight}
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : <View />}
        {maxLength && <Text style={styles.count}>{value.length}/{maxLength}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.6, marginBottom: 7, textTransform: 'uppercase' },
  required: { color: Colors.critical },
  area: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    padding: 14, fontSize: 14, color: Colors.textDark,
    backgroundColor: Colors.card, lineHeight: 22,
  },
  focused: { borderColor: Colors.blue },
  errored: { borderColor: Colors.critical },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  error: { fontSize: 12, color: Colors.critical },
  count: { fontSize: 12, color: Colors.textLight },
});
