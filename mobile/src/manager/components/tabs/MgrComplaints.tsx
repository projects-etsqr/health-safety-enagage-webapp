import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Search, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import type { ScreenProps } from '../types';
import { apiClient } from '../../../api/client';
import { complianceService } from '../../../services/complianceService';

const FILTERS = ['All Cases', 'High Priority', 'Recent'];

export function MgrComplaints({ showToast }: ScreenProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(0);
  const [acked, setAcked] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      complianceService.getAlerts().catch(() => []),
      apiClient.get('/analytics/compliance-summary').then((r: any) => r.data?.compliance_score).catch(() => null),
    ])
      .then(([a, s]) => { setAlerts(a); setScore(typeof s === 'number' ? s : null); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = alerts;
    if (filter === 1) list = list.filter((a) => (a.type || '').toLowerCase() === 'critical');
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((a) => (a.message || '').toLowerCase().includes(q) || (a.zone || '').toLowerCase().includes(q));
    return list;
  }, [alerts, filter, search]);

  const newCount = alerts.filter((a) => !acked[a.id]).length;
  const resolvedCount = Object.keys(acked).length;

  const ack = (id: string) => { setAcked((p) => ({ ...p, [id]: true })); showToast?.('Complaint acknowledged'); };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#0B3D91']} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Search */}
      <View style={styles.searchBox}>
        <Search size={18} color="#94A3B8" />
        <TextInput style={styles.searchInput} placeholder="Search worker name or zone..." placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} />
      </View>

      {/* Filters */}
      <View style={styles.pills}>
        {FILTERS.map((f, i) => (
          <TouchableOpacity key={f} style={[styles.pill, filter === i && styles.pillActive]} onPress={() => setFilter(i)}>
            <Text style={[styles.pillText, filter === i && styles.pillTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Compliance score */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreHead}>
          <Text style={styles.scoreLabel}>SITE COMPLIANCE SCORE</Text>
          <ShieldCheck size={22} color="#0B3D91" />
        </View>
        <Text style={styles.scoreVal}>{score != null ? `${score}%` : '—'}</Text>
        <View style={styles.track}><View style={[styles.fill, { width: `${score ?? 0}%` }]} /></View>
      </View>

      {/* Counts */}
      <View style={styles.grid}>
        <View style={styles.miniCard}>
          <AlertTriangle size={20} color="#DC2626" />
          <Text style={styles.miniVal}>{String(newCount).padStart(2, '0')}</Text>
          <Text style={styles.miniLbl}>New Alerts</Text>
        </View>
        <View style={styles.miniCard}>
          <CheckCircle2 size={20} color="#16A34A" />
          <Text style={styles.miniVal}>{String(resolvedCount).padStart(2, '0')}</Text>
          <Text style={styles.miniLbl}>Resolved Today</Text>
        </View>
      </View>

      <Text style={styles.section}>Active Complaints</Text>
      {loading && alerts.length === 0 ? (
        <ActivityIndicator color="#0B3D91" style={{ marginTop: 20 }} />
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>No complaints match.</Text>
      ) : (
        filtered.slice(0, 12).map((a) => {
          const crit = (a.type || '').toLowerCase() === 'critical';
          const isAck = acked[a.id];
          return (
            <View key={a.id} style={[styles.card, { borderLeftColor: crit ? '#DC2626' : '#2563EB' }]}>
              <View style={styles.cardTop}>
                <View style={[styles.prio, { backgroundColor: crit ? '#FEE2E2' : '#EAF0FB' }]}>
                  <Text style={[styles.prioText, { color: crit ? '#DC2626' : '#0B3D91' }]}>{crit ? 'HIGH PRIORITY' : 'ALERT'}</Text>
                </View>
                <Text style={styles.time}>{a.time_ago}</Text>
              </View>
              <Text style={styles.cardTitle}>{a.message}</Text>
              {!!(a.worker_name || a.zone) && <Text style={styles.cardBody}>{[a.worker_name, a.zone].filter(Boolean).join(' · ')}</Text>}
              {isAck ? (
                <View style={styles.ackedRow}><CheckCircle2 size={14} color="#0B3D91" /><Text style={styles.ackedText}>Acknowledged</Text></View>
              ) : (
                <TouchableOpacity style={styles.ackBtn} onPress={() => ack(a.id)}>
                  <Text style={styles.ackText}>Acknowledge</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 30 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, color: '#0B1C30', padding: 0 },
  pills: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: '#EAF0FB' },
  pillActive: { backgroundColor: '#0B3D91' },
  pillText: { fontSize: 12, fontWeight: '700', color: '#63739B' },
  pillTextActive: { color: '#FFFFFF' },
  scoreCard: { backgroundColor: '#EAF0FB', borderRadius: 16, padding: 18, marginBottom: 16 },
  scoreHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreLabel: { fontSize: 11, fontWeight: '700', color: '#63739B', letterSpacing: 0.5 },
  scoreVal: { fontSize: 28, fontWeight: '800', color: '#0B1C30', marginVertical: 8 },
  track: { height: 8, backgroundColor: '#FFFFFF', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#0B3D91', borderRadius: 4 },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  miniCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#EEF2F7' },
  miniVal: { fontSize: 24, fontWeight: '800', color: '#0B1C30', marginTop: 6 },
  miniLbl: { fontSize: 11, color: '#737686', marginTop: 2 },
  section: { fontSize: 18, fontWeight: '800', color: '#0B1C30', marginBottom: 12 },
  empty: { color: '#737686', textAlign: 'center', marginTop: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#EEF2F7', borderLeftWidth: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  prio: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  prioText: { fontSize: 10, fontWeight: '800' },
  time: { fontSize: 11, color: '#94A3B8' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0B1C30', marginBottom: 4 },
  cardBody: { fontSize: 13, color: '#737686', lineHeight: 18, marginBottom: 12 },
  ackBtn: { backgroundColor: '#0B3D91', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  ackText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  ackedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ackedText: { fontSize: 13, fontWeight: '700', color: '#0B3D91' },
});
