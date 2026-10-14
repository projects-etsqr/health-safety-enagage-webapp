import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Icon } from '../display/Icon';
import { Colors } from '../../theme/colors';

interface LocationCardProps {
  title: string;
  subtitle?: string;
  icon?: string;
  onEdit?: () => void;
  onPress?: () => void;
  style?: ViewStyle;
}

export function LocationCard({ title, subtitle, icon = '📍', onEdit, onPress, style }: LocationCardProps) {
  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={onPress ? 0.8 : 1}>
      <View style={styles.iconBox}>
        <Icon emoji={icon} style={styles.iconText} color={Colors.white} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {onEdit && (
        <TouchableOpacity onPress={onEdit}>
          <Text style={styles.editLink}>Edit</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
  },
  iconBox: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  iconText: { fontSize: 20 },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  editLink: { fontSize: 13, fontWeight: '700', color: Colors.blue },
});
