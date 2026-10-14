import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, StatusBar, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaScreen } from '../../components/layout/KeyboardAvoider';
import { Ionicons } from '@expo/vector-icons';
import { auditService, Audit } from '../services/auditService';

interface Finding {
  key: string;
  title: string;
  remarks: string;
  auditTitle: string;
  site: string;
  severity: 'fail' | 'na';
}

export function FindingsScreen({ navigation }: any) {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try { setAudits(await auditService.listAssigned()); }
    catch { /* keep */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  const findings: Finding[] = useMemo(() => {
    const out: Finding[] = [];
    for (const a of audits) {
      for (const f of a.findings || []) {
        const r = (f.response || '').toLowerCase();
        if (r === 'fail' || r === 'na') {
          out.push({
            key: `${a.id}-${f.id}`,
            title: f.title || 'Checklist item',
            remarks: f.remarks || '',
            auditTitle: a.title,
            site: a.site_name || '—',
            severity: r as 'fail' | 'na',
          });
        }
      }
    }
    return out;
  }, [audits]);

  const visible = findings.filter((f) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [f.title, f.auditTitle, f.site, f.remarks].some((x) => (x || '').toLowerCase().includes(s));
  });

  const failCount = findings.filter((f) => f.severity === 'fail').length;

  return (
    <SafeAreaScreen style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Findings</Text>
        <View style={styles.countPill}><Text style={styles.countText}>{failCount} Non-conformance</Text></View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <TextInput style={styles.searchInput} placeholder="Search findings..." placeholderTextColor="#94A3B8" value={q} onChangeText={setQ} />
        </View>

        {loading ? (
          <ActivityIndicator color="#2563EB" style={{ marginTop: 40 }} />
        ) : visible.length === 0 ? (
          <Text style={styles.empty}>No findings recorded. Completed audits with failed/NA items appear here.</Text>
        ) : (
          visible.map((f) => (
            <View key={f.key} style={[styles.card, f.severity === 'fail' ? styles.cardFail : styles.cardNa]}>
              <View style={styles.cardHeader}>
                <View style={[styles.sevBadge, { backgroundColor: f.severity === 'fail' ? '#FEE2E2' : '#F1F5F9' }]}>
                  <Ionicons name={f.severity === 'fail' ? 'close-circle' : 'remove-circle'} size={12} color={f.severity === 'fail' ? '#EF4444' : '#64748B'} />
                  <Text style={[styles.sevText, { color: f.severity === 'fail' ? '#EF4444' : '#64748B' }]}>
                    {f.severity === 'fail' ? 'Non-conformance' : 'Not Applicable'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>{f.title}</Text>
              {!!f.remarks && <Text style={styles.cardRemarks}>{f.remarks}</Text>}
              <View style={styles.metaRow}>
                <Ionicons name="document-text-outline" size={12} color="#94A3B8" />
                <Text style={styles.metaText}>{f.auditTitle}</Text>
                <Ionicons name="location-outline" size={12} color="#94A3B8" style={{ marginLeft: 10 }} />
                <Text style={styles.metaText}>{f.site}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { height: 60, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1.5, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E3A8A' },
  countPill: { backgroundColor: '#FEE2E2', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  countText: { fontSize: 11, fontWeight: '800', color: '#EF4444' },
  scroll: { padding: 16, paddingBottom: 40 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 12, height: 46, marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', padding: 0 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', borderLeftWidth: 5, padding: 14, marginBottom: 12 },
  cardFail: { borderLeftColor: '#EF4444' },
  cardNa: { borderLeftColor: '#94A3B8' },
  cardHeader: { flexDirection: 'row', marginBottom: 8 },
  sevBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  sevText: { fontSize: 10, fontWeight: '800' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  cardRemarks: { fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  metaText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#94A3B8', fontWeight: '600', paddingVertical: 40, paddingHorizontal: 20, lineHeight: 20 },
});
