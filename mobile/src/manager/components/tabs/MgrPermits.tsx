import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { CheckCircle2, Clock, User as UserIcon, Zap } from 'lucide-react-native';
import type { ScreenProps } from '../types';
import { apiClient } from '../../../api/client';
import { permitWorkflowService } from '../../../services/permitWorkflowService';
import {
  PermitGateSheets, gateDetailOf, type BlockedApproval,
} from '../PermitGateSheets';

const STATUS = {
  active:   { label: 'Active', color: '#16A34A', bg: '#DCFCE7' },
  approved: { label: 'Active', color: '#16A34A', bg: '#DCFCE7' },
  pending:  { label: 'Pending', color: '#F97316', bg: '#FFEDD5' },
  requested:{ label: 'Pending', color: '#F97316', bg: '#FFEDD5' },
  closed:   { label: 'Closed', color: '#64748B', bg: '#F1F5F9' },
  rejected: { label: 'Rejected', color: '#DC2626', bg: '#FEE2E2' },
} as any;

export function MgrPermits({ showToast }: ScreenProps) {
  const [items, setItems] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [counts, setCounts] = useState({ active: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiClient.get('/supervisor/permits').then((r: any) => r.data).catch(() => null),
      permitWorkflowService.managerQueue().catch(() => []),
    ])
      .then(([sp, q]) => {
        setItems(sp?.items ?? []);
        setCounts({ active: sp?.active_count ?? 0, pending: sp?.pending_count ?? 0 });
        setQueue(Array.isArray(q) ? q : []);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const expiringSoon = items.filter((p) => {
    if (!p.validity_end) return false;
    const diff = new Date(p.validity_end).getTime() - Date.now();
    return diff > 0 && diff < 2 * 3600 * 1000;
  }).length;

  // What the gates refused, when they did. Held so the sheet can say which one
  // and why — `Alert.alert('Failed', detail)` was being handed the gate engine's
  // response object, which renders as nothing a manager can act on.
  const [blocked, setBlocked] = useState<BlockedApproval | null>(null);

  const approve = async (id: number) => {
    try {
      setBusy(id);
      await permitWorkflowService.approve(id);
      showToast?.('Permit approved');
      load();
    } catch (e: any) {
      const gates = gateDetailOf(e);
      if (gates) {
        setBlocked({ id, gates });
      } else {
        const detail = e?.response?.data?.detail;
        Alert.alert('Failed', typeof detail === 'string' ? detail : 'Could not approve.');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#0B3D91']} />}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>Permit Monitoring</Text>
        <View style={styles.leadBadge}><Text style={styles.leadText}>HSE Lead</Text></View>
      </View>

      {/* Active permits hero */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>ACTIVE PERMITS</Text>
        <View style={styles.heroRow}>
          <Text style={styles.heroVal}>{counts.active}</Text>
          <CheckCircle2 size={26} color="rgba(255,255,255,0.5)" />
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.miniCard}>
          <View style={styles.miniHead}><Text style={styles.miniLabel}>Pending Review</Text><View style={[styles.tag, { backgroundColor: '#FEE2E2' }]}><Text style={[styles.tagText, { color: '#DC2626' }]}>Critical</Text></View></View>
          <Text style={styles.miniVal}>{String(counts.pending).padStart(2, '0')}</Text>
        </View>
        <View style={styles.miniCard}>
          <View style={styles.miniHead}><Text style={styles.miniLabel}>Expiring Soon</Text><Text style={styles.miniHint}>&lt; 2h left</Text></View>
          <Text style={styles.miniVal}>{String(expiringSoon).padStart(2, '0')}</Text>
        </View>
      </View>

      {/* Review required */}
      {queue.length > 0 && (
        <>
          <Text style={styles.section}>Review Required</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {queue.slice(0, 8).map((p) => (
              <View key={p.id} style={styles.reviewCard}>
                <Text style={styles.reviewRef}>PTW-{p.id}</Text>
                <Text style={styles.reviewTitle} numberOfLines={1}>{p.work_description || 'Permit to Work'}</Text>
                <View style={styles.reviewMeta}><UserIcon size={13} color="#737686" /><Text style={styles.reviewMetaText}>Emp {p.requested_by ?? '—'}</Text></View>
                <TouchableOpacity style={styles.approveBtn} onPress={() => approve(p.id)} disabled={busy === p.id}>
                  {busy === p.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.approveText}>Approve</Text>}
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* Recent PTW */}
      <Text style={[styles.section, { marginTop: 20 }]}>Recent Permit to Work</Text>
      {loading && items.length === 0 ? (
        <ActivityIndicator color="#0B3D91" style={{ marginTop: 20 }} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No permits to show.</Text>
      ) : (
        items.slice(0, 8).map((p) => {
          const st = STATUS[String(p.status).toLowerCase()] || STATUS.pending;
          const exp = p.validity_end ? new Date(p.validity_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
          return (
            <View key={p.id} style={styles.ptwCardWrap}>
              <View style={styles.ptwCard}>
                <View style={styles.ptwIcon}><Zap size={18} color="#2563EB" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ptwTitle} numberOfLines={1}>{p.title || p.permit_type}</Text>
                  <Text style={styles.ptwSub} numberOfLines={1}>{[p.location, p.requestor].filter(Boolean).join(' · ')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={[styles.tag, { backgroundColor: st.bg }]}><Text style={[styles.tagText, { color: st.color }]}>{st.label}</Text></View>
                  {exp && <Text style={styles.ptwExp}>Exp {exp}</Text>}
                </View>
              </View>
            </View>
          );
        })
      )}
      <View style={{ height: 24 }} />

      <PermitGateSheets
        blocked={blocked}
        onDismiss={() => setBlocked(null)}
        onRetryApprove={(permitId) => approve(permitId)}
        showToast={showToast}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 30 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#0B1C30' },
  leadBadge: { backgroundColor: '#EAF0FB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  leadText: { fontSize: 11, fontWeight: '800', color: '#0B3D91' },
  hero: { backgroundColor: '#0B3D91', borderRadius: 16, padding: 20, marginBottom: 12 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  heroVal: { color: '#FFFFFF', fontSize: 38, fontWeight: '800' },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  miniCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#EEF2F7' },
  miniHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  miniLabel: { fontSize: 12, color: '#737686', fontWeight: '600' },
  miniHint: { fontSize: 10, color: '#DC2626', fontWeight: '700' },
  miniVal: { fontSize: 26, fontWeight: '800', color: '#0B1C30' },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '800' },
  section: { fontSize: 16, fontWeight: '800', color: '#0B1C30', marginBottom: 12 },
  reviewCard: { width: 240, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderLeftWidth: 4, borderLeftColor: '#0B3D91', borderWidth: 1, borderColor: '#EEF2F7' },
  reviewRef: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },
  reviewTitle: { fontSize: 15, fontWeight: '800', color: '#0B1C30', marginTop: 2 },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginVertical: 10 },
  reviewMetaText: { fontSize: 12, color: '#737686' },
  approveBtn: { backgroundColor: '#0B3D91', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  approveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  empty: { color: '#737686', textAlign: 'center', marginTop: 20 },
  // The card and its stage rail share one bordered container so the rail reads
  // as part of the permit rather than a separate row.
  ptwCardWrap: { backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EEF2F7', paddingHorizontal: 14, paddingBottom: 8 },
  ptwCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14 },
  ptwIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  ptwTitle: { fontSize: 14, fontWeight: '700', color: '#0B1C30' },
  ptwSub: { fontSize: 12, color: '#737686', marginTop: 2 },
  ptwExp: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
});
