import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { AlertTriangle, Wrench, User as UserIcon } from 'lucide-react-native';
import type { ScreenProps } from '../types';
import { apiClient } from '../../../api/client';
import { complianceService } from '../../../services/complianceService';
import { useAuth } from '../../../hooks/useAuth';
import { NeedsYourAction } from '../NeedsYourAction';
import type { NextActionItem } from '../../../services/incidentWorkflowService';

const FILTERS = ['Today', 'This Week', 'All Time'];

// Bucket the messy DB severity labels into 4 display bands.
function bucket(rows: { severity: string; count: number }[]) {
  const b = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of rows) {
    const s = (r.severity || '').toLowerCase();
    const n = r.count || 0;
    if (s.includes('fatal') || s.includes('critical')) b.critical += n;
    else if (s.includes('serious') || s.includes('significant') || s.includes('high')) b.high += n;
    else if (s.includes('medium') || s.includes('moderate')) b.medium += n;
    else b.low += n;
  }
  return b;
}

export function MgrMonitoring({ setActiveTab, setCurrentScreen, setSelectedIncident }: ScreenProps) {
  const { user } = useAuth();

  const openInvestigation = (r: any) => {
    const crit = (r.type || '').toLowerCase() === 'critical';
    setSelectedIncident?.({
      id: r.id,
      title: r.message,
      severity: crit ? 'Critical' : 'High',
      time: r.time_ago,
      desc: '',
      status: 'IN INVESTIGATION',
      zone: r.zone,
    } as any);
    setCurrentScreen('investigation');
  };
  // The queue already knows the incident id and its stage, so it can route
  // straight into the investigation screen rather than through the alert-shaped
  // payload the Recent Reports list has to reconstruct.
  const openNextAction = (item: NextActionItem) => {
    setSelectedIncident?.({
      id: item.id,
      title: item.description,
      severity: item.priority === 'P1' || item.priority === 'P2' ? 'Critical' : 'High',
      time: '',
      desc: item.description,
      status: item.stage_label ?? item.workflow_status,
      zone: '',
    } as any);
    setCurrentScreen('investigation');
  };

  const [filter, setFilter] = useState(0);
  const [sev, setSev] = useState({ critical: 0, high: 0, medium: 0, low: 0 });
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiClient.get('/dashboard/incidents-by-severity').then((r: any) => r.data).catch(() => []),
      complianceService.getAlerts().catch(() => []),
    ])
      .then(([sv, al]) => { setSev(bucket(Array.isArray(sv) ? sv : [])); setReports(al); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const cards = [
    { label: 'Critical', value: sev.critical, sub: 'Immediate action', color: '#DC2626', tag: '#FEE2E2' },
    { label: 'High', value: sev.high, sub: 'Pending review', color: '#EA580C', tag: '#FFEDD5' },
    { label: 'Medium', value: sev.medium, sub: 'Monitoring', color: '#2563EB', tag: '#DBEAFE' },
    { label: 'Low', value: sev.low, sub: 'Resolved / Logged', color: '#16A34A', tag: '#DCFCE7' },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#0B3D91']} />}
    >
      <Text style={styles.eyebrow}>{(user?.site || 'SITE AREA A-12').toUpperCase()} • {(user?.role || 'HSE MANAGER').toUpperCase()}</Text>
      <Text style={styles.title}>Incident Monitoring</Text>

      {/* What is outstanding, before the counts. The severity tiles below say
          how bad the estate is; this says what to do about it, which is the
          question a manager opens the app with. */}
      <NeedsYourAction onOpen={openNextAction} />

      {/* Filter pills */}
      <View style={styles.pills}>
        {FILTERS.map((f, i) => (
          <TouchableOpacity key={f} style={[styles.pill, filter === i && styles.pillActive]} onPress={() => setFilter(i)}>
            <Text style={[styles.pillText, filter === i && styles.pillTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Severity cards */}
      <View style={styles.grid}>
        {cards.map((c) => (
          <View key={c.label} style={styles.statCard}>
            <View style={[styles.statTag, { backgroundColor: c.tag }]}>
              <Text style={[styles.statTagText, { color: c.color }]}>{c.label}</Text>
            </View>
            <Text style={styles.statVal}>{String(c.value).padStart(2, '0')}</Text>
            <Text style={styles.statSub}>{c.sub}</Text>
          </View>
        ))}
      </View>

      {/* Recent reports */}
      <View style={styles.sectionRow}>
        <Text style={styles.section}>Recent Reports</Text>
        <TouchableOpacity onPress={() => setActiveTab(3)}><Text style={styles.viewAll}>View All</Text></TouchableOpacity>
      </View>

      {loading && reports.length === 0 ? (
        <ActivityIndicator color="#0B3D91" style={{ marginTop: 20 }} />
      ) : reports.length === 0 ? (
        <Text style={styles.empty}>No recent reports.</Text>
      ) : (
        reports.slice(0, 6).map((r) => {
          const crit = (r.type || '').toLowerCase() === 'critical';
          return (
            <TouchableOpacity key={r.id} style={styles.reportCard} activeOpacity={0.8} onPress={() => openInvestigation(r)}>
              <View style={[styles.reportIcon, { backgroundColor: crit ? '#FEE2E2' : '#DBEAFE' }]}>
                {crit ? <AlertTriangle size={18} color="#DC2626" /> : <Wrench size={18} color="#2563EB" />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.reportTop}>
                  <Text style={styles.reportTitle} numberOfLines={1}>{r.message}</Text>
                  <Text style={styles.reportTime}>{r.time_ago}</Text>
                </View>
                <Text style={styles.reportDesc} numberOfLines={1}>
                  {[r.worker_name, r.zone].filter(Boolean).join(' · ')}
                </Text>
                <View style={[styles.reportBadge, { backgroundColor: crit ? '#FEE2E2' : '#EFF6FF' }]}>
                  <Text style={[styles.reportBadgeText, { color: crit ? '#DC2626' : '#2563EB' }]}>
                    {crit ? 'IN INVESTIGATION' : 'ACTION REQUIRED'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 30 },
  eyebrow: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', color: '#0B1C30', marginBottom: 16 },
  pills: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EAF0FB' },
  pillActive: { backgroundColor: '#0B3D91' },
  pillText: { fontSize: 13, fontWeight: '700', color: '#63739B' },
  pillTextActive: { color: '#FFFFFF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#EEF2F7' },
  statTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
  statTagText: { fontSize: 11, fontWeight: '800' },
  statVal: { fontSize: 30, fontWeight: '800', color: '#0B1C30' },
  statSub: { fontSize: 12, color: '#737686', marginTop: 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  section: { fontSize: 18, fontWeight: '800', color: '#0B1C30' },
  viewAll: { fontSize: 13, fontWeight: '700', color: '#0B3D91' },
  empty: { color: '#737686', textAlign: 'center', marginTop: 20 },
  reportCard: { flexDirection: 'row', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#EEF2F7' },
  reportIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  reportTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reportTitle: { fontSize: 14, fontWeight: '700', color: '#0B1C30', flex: 1, marginRight: 8 },
  reportTime: { fontSize: 10, color: '#94A3B8' },
  reportDesc: { fontSize: 12, color: '#737686', marginTop: 2, marginBottom: 8 },
  reportBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  reportBadgeText: { fontSize: 10, fontWeight: '800' },
});
