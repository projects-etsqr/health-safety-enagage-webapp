import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '../../theme/colors';
import { Icon } from '../display/Icon';
import { Card } from './Card';

type Priority = 'CRITICAL' | 'HIGH' | 'ROUTINE';

const PRIORITY: Record<Priority, { bg: string; text: string }> = {
  CRITICAL: { bg: Colors.criticalBg, text: Colors.critical },
  HIGH:     { bg: Colors.warningBg,  text: Colors.warning },
  ROUTINE:  { bg: Colors.successBg,  text: Colors.success },
};

interface TaskCardProps {
  title: string;
  location: string;
  priority: Priority;
  due: string;
  type?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function TaskCard({ title, location, priority, due, type, onPress, style }: TaskCardProps) {
  const pc = PRIORITY[priority] ?? PRIORITY.ROUTINE;
  const isUrgent = due.includes('m') && !due.includes('Tom');

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card style={[styles.card, style]}>
        <View style={[styles.badge, { backgroundColor: pc.bg }]}>
          <Text style={[styles.badgeText, { color: pc.text }]}>{priority}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.metaRow}>
          <Icon name="map-pin" size={13} color={Colors.textMuted} style={styles.metaIcon} />
          <Text style={styles.location}>{location}</Text>
        </View>
        <View style={styles.footer}>
          {type && (
            <View style={styles.metaRow}>
              <Icon name="bookmark" size={12} color={Colors.textMuted} style={styles.metaIcon} />
              <Text style={styles.type}>{type}</Text>
            </View>
          )}
          <Text style={[styles.due, { color: isUrgent ? Colors.critical : Colors.textMuted }]}>{due}</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.textDark, marginBottom: 4 },
  location: { fontSize: 13, color: Colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  metaIcon: { marginRight: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { fontSize: 12, color: Colors.textMuted },
  due: { fontSize: 12, fontWeight: '600' },
});
