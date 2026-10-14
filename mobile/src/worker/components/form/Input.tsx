import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface InputProps extends TextInputProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  required,
  error,
  hint,
  rightIcon,
  onRightIconPress,
  containerStyle,
  style,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}{required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <View style={[styles.row, focused && styles.rowFocused, !!error && styles.rowError]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.textLight}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightBtn}>
            <Text style={styles.rightIcon}>{rightIcon}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.6, marginBottom: 7, textTransform: 'uppercase' },
  required: { color: Colors.critical },
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    backgroundColor: Colors.card, paddingHorizontal: 14,
  },
  rowFocused: { borderColor: Colors.blue },
  rowError: { borderColor: Colors.critical },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: Colors.textDark },
  rightBtn: { paddingLeft: 8 },
  rightIcon: { fontSize: 18, color: Colors.textMuted },
  error: { fontSize: 12, color: Colors.critical, marginTop: 4 },
  hint: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
});
