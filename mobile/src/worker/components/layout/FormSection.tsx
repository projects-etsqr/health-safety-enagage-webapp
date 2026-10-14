import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface FormSectionProps {
  label?: string;
  required?: boolean;
  children: React.ReactNode;
  /** Wrap children in a white card */
  card?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export function FormSection({ label, required, children, card = false, style, contentStyle }: FormSectionProps) {
  return (
    <View style={[styles.wrapper, style]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      {card ? (
        <View style={[styles.card, contentStyle]}>{children}</View>
      ) : (
        <View style={contentStyle}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  required: { color: Colors.critical },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
