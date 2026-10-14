import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import type { PriorityAlert } from '../../types/team.types';

interface Props {
  alert: PriorityAlert;
  onContact?: () => void;
  onLocate?: () => void;
}

export function AlertCard({ alert, onContact, onLocate }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.type}>{alert.type.toUpperCase()}</Text>
        <Text style={styles.time}>{alert.time_ago}</Text>
      </View>
      <Text style={styles.message}>
        {alert.message}{' '}
        {alert.zone && <Text style={styles.zone}>{alert.zone}</Text>}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onContact} style={styles.contactBtn}>
          <Ionicons name="call-outline" size={14} color={Colors.white} />
          <Text style={styles.contactText}>Contact</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLocate} style={styles.locateBtn}>
          <Text style={styles.locateText}>Locate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.critical,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  type: { fontSize: 10, fontWeight: '700', color: Colors.critical, letterSpacing: 0.5 },
  time: { fontSize: 11, color: Colors.textMuted },
  message: { fontSize: 14, color: Colors.textDark, lineHeight: 20, marginBottom: 12 },
  zone: { color: Colors.blue, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
  },
  contactText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  locateBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 10,
  },
  locateText: { color: Colors.textDark, fontWeight: '600', fontSize: 14 },
});
