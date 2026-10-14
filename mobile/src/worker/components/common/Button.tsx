import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: string;
}

export function Button({ title, onPress, variant = 'primary', isLoading, disabled, style, textStyle, icon }: ButtonProps) {
  const btnStyle = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'secondary' && styles.secondary,
    variant === 'danger' && styles.danger,
    variant === 'ghost' && styles.ghost,
    (disabled || isLoading) && styles.disabled,
    style,
  ];

  const txtStyle = [
    styles.baseText,
    variant === 'primary' && styles.primaryText,
    variant === 'secondary' && styles.secondaryText,
    variant === 'danger' && styles.dangerText,
    variant === 'ghost' && styles.ghostText,
    textStyle,
  ];

  return (
    <TouchableOpacity style={btnStyle} onPress={onPress} disabled={disabled || isLoading} activeOpacity={0.85}>
      {isLoading
        ? <ActivityIndicator color={variant === 'primary' ? Colors.white : Colors.blue} size="small" />
        : <Text style={txtStyle}>{icon ? `${icon} ${title}` : title}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 12, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border },
  danger: { backgroundColor: Colors.criticalBg, borderWidth: 1.5, borderColor: Colors.critical },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },

  baseText: { fontSize: 15, fontWeight: '700' },
  primaryText: { color: Colors.white },
  secondaryText: { color: Colors.textDark },
  dangerText: { color: Colors.critical },
  ghostText: { color: Colors.blue },
});
