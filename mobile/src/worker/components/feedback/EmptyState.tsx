import React from 'react';
import { Icon } from '../display/Icon';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({ icon = '📭', title, subtitle, actionLabel, onAction, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <Icon emoji={icon} style={styles.icon} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.btn} onPress={onAction}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({ message = 'Something went wrong', onRetry, style }: ErrorStateProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <Icon emoji="⚠️" style={styles.icon} />
      <Text style={styles.title}>Oops!</Text>
      <Text style={styles.subtitle}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={[styles.btn, styles.retryBtn]} onPress={onRetry}>
          <Text style={[styles.btnText, styles.retryText]}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { fontSize: 52, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textDark, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  btn: {
    backgroundColor: Colors.blue, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  retryBtn: { backgroundColor: Colors.criticalBg },
  retryText: { color: Colors.critical },
});
