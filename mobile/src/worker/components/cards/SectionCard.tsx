import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface SectionCardProps {
  label: string;
  stepNum?: number;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Add a colored left border accent */
  accent?: boolean;
}

export function SectionCard({ label, stepNum, children, style, accent = false }: SectionCardProps) {
  return (
    <View style={[styles.card, accent && styles.cardAccent, style]}>
      <View style={styles.header}>
        {stepNum != null && (
          <View style={styles.stepBadge}>
            <Text style={styles.stepNum}>{stepNum}</Text>
          </View>
        )}
        <Text style={styles.label}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 18, marginBottom: 14,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardAccent: { borderColor: Colors.blue, borderWidth: 1.5, borderLeftWidth: 4, borderLeftColor: Colors.blue },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  stepBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center',
  },
  stepNum: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
});
