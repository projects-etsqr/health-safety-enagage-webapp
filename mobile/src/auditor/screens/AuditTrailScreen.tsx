import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { verificationService, TrailEntry } from '../services/verificationService';

const MODULES = ['All', 'Incident', 'Permit', 'Unsafe Act', 'Near Miss'];

const MODULE_STYLE: Record<string, { color: string; bg: string; icon: string }> = {
  Incident:   { color: '#DC2626', bg: '#FEF2F2', icon: 'alert-circle' },
  Permit:     { color: '#2563EB', bg: '#EFF6FF', icon: 'document-text' },
  Hazard:     { color: '#EA580C', bg: '#FFF7ED', icon: 'warning' },
  'Near Miss': { color: '#CA8A04', bg: '#FEFCE8', icon: 'flash' },
};

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function AuditTrailScreen({ navigation }: any) {
  const [entries, setEntries] = useState<TrailEntry[]>([]);
  const [module, setModule] = useState('All');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    verificationService.auditTrail(module === 'All' ? undefined : module)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [module]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audit Trail</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {MODULES.map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, module === m && styles.chipActive]}
            onPress={() => setModule(m)}
          >
            <Text style={[styles.chipText, module === m && styles.chipTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#004AC6']} />}
      >
        {loading && entries.length === 0 ? (
          <ActivityIndicator color="#004AC6" style={{ marginTop: 30 }} />
        ) : entries.length === 0 ? (
          <Text style={styles.empty}>No recorded actions for this filter.</Text>
        ) : (
          entries.map((e, i) => {
            const meta = MODULE_STYLE[e.module] ?? { color: '#64748B', bg: '#F1F5F9', icon: 'ellipse' };
            return (
              <View key={`${e.reference}-${e.action}-${i}`} style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowAction}>{e.action}</Text>
                  <Text style={styles.rowMeta}>{e.reference} · {formatWhen(e.occurred_at)}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FF' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0B1C30', marginLeft: 12 },
  filterRow: { maxHeight: 48, flexGrow: 0 },
  filterContent: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#004AC6', borderColor: '#004AC6' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#0B1C30' },
  chipTextActive: { color: '#FFFFFF' },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#737686', marginTop: 30 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowAction: { fontSize: 13, fontWeight: '700', color: '#0B1C30' },
  rowMeta: { fontSize: 11, color: '#737686', marginTop: 2 },
});
