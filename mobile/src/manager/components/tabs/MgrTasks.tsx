import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import {
  MapPin, AlertTriangle, Zap, Wrench, ShieldAlert, FileText, ChevronRight, TriangleAlert,
  Flame, AlertCircle,
} from 'lucide-react-native';
import type { ReportFamily, ScreenProps } from '../types';
import { apiClient } from '../../../api/client';
import { reportWorkflowService } from '../../../services/reportWorkflowService';
import { hazardRegisterService } from '../../../services/hazardRegisterService';
import { incidentWorkflowService } from '../../../services/incidentWorkflowService';

/**
 * The manager's Tasks tab — what has reached them, one card per family.
 *
 * This was the Risk tab: a heatmap, three plain nav links, and a critical-
 * activities list. The links carried no counts, so the only way to find out
 * whether a family had anything owed was to open it, and near misses, unsafe
 * acts and risk observations were bundled behind one link named after none of
 * them. Each family now leads with the number waiting on this manager, and the
 * entries live behind its own card — the same shape the supervisor's Tasks tab
 * uses, so the two roles read the estate the same way.
 *
 * The heatmap and the critical activities stay below. They answer "how bad is
 * the site", which is a manager question nothing else on the app shows, and
 * they are not entries.
 */

// `hazard` is the Unsafe Act register. The separate 'unsafe_act' family went
// away with migration 080 — the two were one thing under two names.
type FamilyKey = 'incident' | 'near_miss' | 'risk' | 'hazard';

function cellColor(v: number, max: number) {
  if (max <= 0) return '#DBEAFE';
  const r = v / max;
  if (r >= 0.66) return '#DC2626';
  if (r >= 0.33) return '#F97316';
  if (r > 0) return '#2563EB';
  return '#E2E8F0';
}

export function MgrTasks({ setCurrentScreen, setReportFamily }: ScreenProps) {
  const [zones, setZones] = useState<{ zone: string; value: number }[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<FamilyKey, number>>({
    incident: 0, near_miss: 0, risk: 0, hazard: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient.get('/analytics/risk-summary')
      .then((r: any) => { setZones(r.data?.zone_risk ?? []); setTasks(r.data?.task_rows ?? []); })
      .catch(() => { setZones([]); setTasks([]); })
      .finally(() => setLoading(false));

    // "Waiting on you", from each family's own next-actions resolver — the same
    // number the screen behind the card will show, because it is the same
    // query. mine_count is the manager's own steps, not everything open.
    const zero = { count: 0, items: [], mine_count: 0 };
    Promise.all([
      incidentWorkflowService.getNextActions(true).catch(() => zero),
      reportWorkflowService('near_miss').getNextActions(true, 100).catch(() => zero),
      reportWorkflowService('risk').getNextActions(true, 100).catch(() => zero),
      hazardRegisterService.getNextActions(true).catch(() => zero),
    ]).then(([inc, nm, rk, hz]) => setCounts({
      incident: inc.mine_count ?? 0,
      near_miss: nm.mine_count ?? 0,
      risk: rk.mine_count ?? 0,
      hazard: hz.mine_count ?? 0,
    }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openReports = (family: ReportFamily) => {
    setReportFamily(family);
    setCurrentScreen('report_approvals');
  };

  const FAMILIES: Array<{
    key: FamilyKey; label: string; blurb: string;
    icon: typeof AlertCircle; color: string; bg: string; go: () => void;
  }> = [
    {
      key: 'incident', label: 'Incidents', blurb: 'Investigations to approve and close',
      icon: Flame, color: '#EF4444', bg: '#FEF2F2',
      // Its own list, like every other card here. The rows are the same
      // component the Monitoring dashboard renders, so the two cannot disagree
      // about what is outstanding — only about how much of it they show.
      go: () => setCurrentScreen('incident_queue'),
    },
    {
      key: 'near_miss', label: 'Near Misses', blurb: 'The warning before the injury',
      icon: TriangleAlert, color: '#F97316', bg: '#FFF7ED',
      go: () => openReports('near_miss'),
    },
    {
      key: 'risk', label: 'Risk Observations', blurb: 'A risk a worker saw in the field',
      icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2',
      go: () => openReports('risk'),
    },
    {
      key: 'hazard', label: 'Unsafe Act Register', blurb: 'Unsafe acts logged against the register',
      icon: ShieldAlert, color: '#0891B2', bg: '#ECFEFF',
      go: () => setCurrentScreen('hazard_register'),
    },
  ];

  const waiting = Object.values(counts).reduce((a, b) => a + b, 0);

  const max = Math.max(1, ...zones.map((z) => z.value));
  // Cell width adapts to how many zones exist so it never looks like a broken grid.
  const cellWidth = zones.length <= 1 ? '100%' : zones.length === 2 ? '48%' : '31.5%';

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#0B3D91']} />}
    >
      <Text style={styles.title}>Tasks</Text>
      <Text style={styles.sub}>
        {waiting === 0
          ? 'Nothing is waiting on you right now'
          : `${waiting} item${waiting === 1 ? '' : 's'} waiting on you`}
      </Text>

      {/* One card per family, each carrying its own count. */}
      <View style={styles.familyCards}>
        {FAMILIES.map((f) => {
          const Icon = f.icon;
          const n = counts[f.key];
          return (
            <TouchableOpacity key={f.key} style={styles.familyCard} onPress={f.go} activeOpacity={0.85}>
              <View style={[styles.familyIcon, { backgroundColor: f.bg }]}>
                <Icon size={22} color={f.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.familyLabel}>{f.label}</Text>
                <Text style={styles.familyBlurb} numberOfLines={2}>{f.blurb}</Text>
                <View style={[styles.countPill, { backgroundColor: n > 0 ? f.bg : '#F0FDF4' }]}>
                  <Text style={[styles.countPillText, { color: n > 0 ? f.color : '#16A34A' }]}>
                    {n > 0 ? `${n} waiting on you` : 'Clear'}
                  </Text>
                </View>
              </View>
              <ChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.navCard} onPress={() => setCurrentScreen('policy_management')}>
        <FileText size={18} color="#0B3D91" />
        <Text style={styles.navText}>Policies</Text>
        <ChevronRight size={16} color="#94A3B8" />
      </TouchableOpacity>

      <Text style={styles.section}>Risk Heatmap</Text>
      <View style={styles.subRow}>
        <Text style={styles.sub}>Live Site Overview</Text>
        <View style={styles.locRow}><MapPin size={13} color="#0B3D91" /><Text style={styles.loc}>Site Zones</Text></View>
      </View>

      {/* Heatmap grid */}
      {loading && zones.length === 0 ? (
        <ActivityIndicator color="#0B3D91" style={{ marginVertical: 30 }} />
      ) : (
        <>
          {zones.length === 0 ? (
            <View style={styles.noHeat}><Text style={styles.noHeatText}>No zone risk data available.</Text></View>
          ) : (
            <View style={styles.heatGrid}>
              {zones.map((z, i) => (
                <View key={i} style={[styles.heatCell, { width: cellWidth, backgroundColor: cellColor(z.value, max) }]}>
                  <Text style={styles.heatZone} numberOfLines={2}>{z.zone}</Text>
                  <Text style={styles.heatVal}>{z.value}</Text>
                  <Text style={styles.heatUnit}>incidents</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.legend}>
            <View style={styles.legItem}><View style={[styles.dot, { backgroundColor: '#DC2626' }]} /><Text style={styles.legText}>High risk</Text></View>
            <View style={styles.legItem}><View style={[styles.dot, { backgroundColor: '#F97316' }]} /><Text style={styles.legText}>Medium</Text></View>
            <View style={styles.legItem}><View style={[styles.dot, { backgroundColor: '#2563EB' }]} /><Text style={styles.legText}>Low</Text></View>
          </View>

          {/* Critical activities */}
          <View style={styles.critHead}>
            <Text style={styles.section}>Critical Activities</Text>
            {tasks.length > 0 && (
              <View style={styles.critBadge}><Text style={styles.critBadgeText}>{tasks.length} High Alert</Text></View>
            )}
          </View>
          {tasks.length === 0 ? (
            <Text style={styles.empty}>No open risk tasks.</Text>
          ) : (
            tasks.slice(0, 6).map((t, i) => {
              const st = String(t.status || '').toLowerCase();
              const crit = st.includes('red') || st.includes('critical') || st.includes('overdue');
              const amber = st.includes('amber') || st.includes('progress');
              const color = crit ? '#DC2626' : amber ? '#F97316' : '#16A34A';
              const bg = crit ? '#FEE2E2' : amber ? '#FFEDD5' : '#DCFCE7';
              return (
                <View key={t.id || i} style={styles.actCard}>
                  <View style={[styles.actIcon, { backgroundColor: bg }]}>
                    {crit ? <AlertTriangle size={18} color={color} /> : amber ? <Zap size={18} color={color} /> : <Wrench size={18} color={color} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actTitle} numberOfLines={1}>{t.desc || `Task ${t.id}`}</Text>
                    <Text style={styles.actSub} numberOfLines={1}>{[t.owner, t.due].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <View style={[styles.actTag, { backgroundColor: bg }]}>
                    <Text style={[styles.actTagText, { color }]}>{crit ? 'CRITICAL' : amber ? 'MODERATE' : 'LOW'}</Text>
                  </View>
                </View>
              );
            })
          )}
        </>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  familyCards: { gap: 10, marginTop: 14, marginBottom: 14 },
  familyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 13,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  familyIcon: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  familyLabel: { fontSize: 14.5, fontWeight: '700', color: '#0B1C30' },
  familyBlurb: { fontSize: 11.5, color: '#737686', marginTop: 2, lineHeight: 16 },
  countPill: {
    alignSelf: 'flex-start', borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 3, marginTop: 7,
  },
  countPillText: { fontSize: 10.5, fontWeight: '800' },

  navRow: { gap: 10, marginBottom: 18 },
  navCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  navText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0B3D91' },
  scroll: { padding: 20, paddingBottom: 30 },
  title: { fontSize: 22, fontWeight: '800', color: '#0B3D91', marginBottom: 4 },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sub: { fontSize: 13, color: '#737686' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  loc: { fontSize: 13, fontWeight: '700', color: '#0B3D91' },
  heatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  heatCell: { minHeight: 96, borderRadius: 12, padding: 12, justifyContent: 'space-between' },
  heatZone: { color: 'rgba(255,255,255,0.95)', fontWeight: '700', fontSize: 12 },
  heatVal: { color: '#FFFFFF', fontWeight: '800', fontSize: 26 },
  heatUnit: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: -2 },
  noHeat: { backgroundColor: '#EAF0FB', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 12 },
  noHeatText: { color: '#63739B', fontSize: 13 },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legText: { fontSize: 12, color: '#737686' },
  section: { fontSize: 16, fontWeight: '800', color: '#0B1C30', marginBottom: 12, marginTop: 4 },
  zoneRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#EEF2F7' },
  zoneName: { fontSize: 13, color: '#0B1C30', fontWeight: '600', flex: 1, marginRight: 8 },
  zoneVal: { fontSize: 14, fontWeight: '800' },
  critHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  critBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  critBadgeText: { fontSize: 11, fontWeight: '800', color: '#DC2626' },
  empty: { color: '#737686', textAlign: 'center', marginTop: 12 },
  actCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EEF2F7' },
  actIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actTitle: { fontSize: 14, fontWeight: '700', color: '#0B1C30' },
  actSub: { fontSize: 12, color: '#737686', marginTop: 2 },
  actTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  actTagText: { fontSize: 10, fontWeight: '800' },
});
