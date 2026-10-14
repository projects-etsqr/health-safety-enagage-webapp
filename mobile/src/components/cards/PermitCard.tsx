import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import type { Permit, PermitStatus } from '../../types/permit.types';

const STATUS_CONFIG: Record<PermitStatus, { label: string; bg: string; color: string }> = {
  pending: { label: 'PENDING', bg: Colors.warningBg, color: Colors.warning },
  ready_for_review: { label: 'READY FOR REVIEW', bg: '#E3F2FD', color: Colors.blue },
  awaiting_signature: { label: 'AWAITING SIGNATURE', bg: Colors.warningBg, color: Colors.warning },
  under_revision: { label: 'UNDER REVISION', bg: Colors.divider, color: Colors.textMuted },
  approved: { label: 'APPROVED', bg: Colors.successBg, color: Colors.success },
  active: { label: 'ACTIVE', bg: Colors.successBg, color: Colors.success },
  closed: { label: 'CLOSED', bg: Colors.divider, color: Colors.textMuted },
  rejected: { label: 'REJECTED', bg: Colors.criticalBg, color: Colors.critical },
};

interface Props {
  permit: Permit;
  onPress?: () => void;
}

export function PermitCard({ permit, onPress }: Props) {
  const cfg = STATUS_CONFIG[permit.status] ?? STATUS_CONFIG.pending;

  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.refBadge}>
          <Text style={styles.refText}>{permit.permit_ref}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={styles.title}>{permit.title}</Text>
      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.metaText}>{permit.location}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.metaText}>{permit.requestor}</Text>
          {permit.team ? <Text style={styles.metaText}> ({permit.team})</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  refBadge: { backgroundColor: '#EEF2FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  refText: { fontSize: 12, fontWeight: '700', color: Colors.blue },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', color: Colors.textDark, marginBottom: 8 },
  meta: { gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textMuted },
});
