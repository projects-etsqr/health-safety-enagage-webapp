import React from 'react';
import { View, Text, Switch, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface ToggleRowProps {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  style?: ViewStyle;
}

export function ToggleRow({ title, subtitle, value, onChange, style }: ToggleRowProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.blue }}
        thumbColor={Colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  textBlock: { flex: 1, marginRight: 12 },
  title: { fontSize: 15, fontWeight: '600', color: Colors.textDark },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
