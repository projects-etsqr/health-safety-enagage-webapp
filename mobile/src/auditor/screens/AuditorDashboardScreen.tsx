/**
 * The auditor's home — what is owed, and what is escalating.
 *
 * Ordered by what can go wrong rather than by what is tidy: the audits that are
 * late come first, because "audit not conducted" is itself a finding and the
 * only person who can fix it is looking at this screen. Then the walk in front
 * of them, then the effectiveness checks that keep old audits open, then the
 * programme that says why any of it is scheduled at all.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import {
  auditService, Audit, Finding, ProgrammeRow, CLASSIFICATION_META,
} from '../services/auditService';
import { AiFab } from '../../components/AiAssistant';
import {
  Banner, C, Card, Empty, RiskBandChip, ScoreRing, SectionLabel, StepTracker,
} from '../components';

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }); }
  catch { return '—'; }
}

const ACTIVE_STATUSES = ['scheduled', 'in_progress', 'fieldwork', 'immediate_action', 'findings_raised'];

export function AuditorDashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [programme, setProgramme] = useState<ProgrammeRow[]>([]);
  const [openFindings, setOpenFindings] = useState<Finding[]>([]);
  const [late, setLate] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [a, p, f, e] = await Promise.all([
      auditService.listAssigned().catch(() => [] as Audit[]),
      auditService.programme().catch(() => [] as ProgrammeRow[]),
      auditService.openFindings().catch(() => [] as Finding[]),
      auditService.escalations().catch(() => ({ audits_not_conducted: [], definitions: [] })),
    ]);
    setAudits(a);
    setProgramme(p);
    setOpenFindings(f);
    setLate(e.audits_not_conducted ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    auditService.loadReference();
    return unsub;
  }, [navigation, load]);

  // Open, not "in flight". The tiles used to count a fixed list of active
  // statuses, so an audit at capa_open — report issued, findings still being
  // tracked out — was in neither tile: 2 in flight + 2 closed against a list of
  // 5. Open and closed are complements of one another, so every audit lands in
  // exactly one and the pair always reconciles with the queue below, whatever
  // statuses get added later.
  const open = audits.filter((a) => !a.closed_at);
  const closed = audits.filter((a) => a.closed_at);
  // Still needed for the queue further down, which lists what is being worked
  // on now rather than everything unclosed.
  const inFlight = audits.filter((a) => ACTIVE_STATUSES.includes(a.status) && !a.closed_at);
  const stopped = audits.filter((a) => a.status === 'immediate_action');
  // Only audits that have actually been scored. An audit that has not reached
  // stage 07 carries compliance_score 0, which is a placeholder and not a
  // result — averaging it in reported this auditor's work as 54 when the four
  // scored audits average 68, and dropped the band label from "acceptable" to
  // "poor" on the strength of an audit nobody had classified yet.
  //
  // `> 0` rather than a classified flag because the list response carries no
  // such flag: `classified_at` is not returned at all, and `score_band` is null
  // on scored audits (AUD-000007 scored 50, AUD-000009 scored 83, both null).
  // The blind spot is an audit that genuinely scored zero, which would be left
  // out of the average rather than counted — it omits a result instead of
  // inventing one, which is the right way round for this to be wrong.
  const scores = audits
    .map((a) => a.compliance_score)
    .filter((s): s is number => typeof s === 'number' && s > 0);
  const avg = scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : 0;
  const overdueChecks = openFindings.filter(
    (f) => f.corrective_action_due && new Date(f.corrective_action_due) < new Date(),
  );
  const initials = (user?.name || 'Auditor').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hi}>Welcome back</Text>
          <Text style={styles.name}>{user?.name || 'Auditor'}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('AuditFindings')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="notifications-outline" size={22} color={C.ink} />
          {overdueChecks.length > 0 && <View style={styles.badge} />}
        </TouchableOpacity>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
      </View>

      {loading ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {/* Escalations first — each fires on its own, nobody has to notice */}
          {stopped.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('AuditDetail', { auditId: stopped[0].id })} activeOpacity={0.9}>
              <Banner
                tone="danger" icon="hand-left"
                title={`${stopped.length} audit${stopped.length === 1 ? '' : 's'} stopped — critical finding`}
                text="Work may be suspended. Contain the unsafe act, then resume the walk."
              />
            </TouchableOpacity>
          )}
          {late.length > 0 && (
            <Banner
              tone="warn" icon="calendar"
              title={`${late.length} audit${late.length === 1 ? '' : 's'} not conducted`}
              text={`Past 110% of the scheduled date. A missed audit is itself a finding. First: ${late[0].title}.`}
            />
          )}
          {overdueChecks.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('AuditFindings')} activeOpacity={0.9}>
              <Banner
                tone="warn" icon="time"
                title={`${overdueChecks.length} effectiveness check${overdueChecks.length === 1 ? '' : 's'} overdue`}
                text="Findings stay open until the fix is verified on site at 30, 60 and 90 days."
              />
            </TouchableOpacity>
          )}

          {/* The numbers */}
          <View style={styles.statsRow}>
            <Stat label="Open" value={open.length} icon="walk" color="#1D4ED8" bg="#EFF6FF" />
            {/* "Open findings", not "To verify". These are findings whose
                corrective action is still outstanding — there is nothing to
                verify until somebody has done the work. */}
            <Stat label="Open findings" value={openFindings.length} icon="shield-checkmark" color="#B45309" bg="#FEF3C7" />
            <Stat label="Closed" value={closed.length} icon="lock-closed" color="#047857" bg="#D1FAE5" />
          </View>

          {avg > 0 && (
            <View style={styles.avgCard}>
              <ScoreRing score={avg} band={avg >= 90 ? 'excellent' : avg >= 75 ? 'good' : avg >= 60 ? 'acceptable' : 'poor'} size={82} />
              <View style={{ flex: 1 }}>
                <Text style={styles.avgTitle}>Average score across your audits</Text>
                <Text style={styles.avgNote}>
                  Below 70% alerts the Safety Manager automatically. Below 65% twice in a row at one
                  site forces a re-audit.
                </Text>
              </View>
            </View>
          )}

          {/* The walk in front of them */}
          <SectionLabel>Your queue ({inFlight.length})</SectionLabel>
          {inFlight.length ? inFlight.slice(0, 4).map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.auditCard}
              onPress={() => navigation.navigate('AuditDetail', { auditId: a.id, audit: a })}
              activeOpacity={0.9}
            >
              <View style={styles.auditHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.auditRef}>{a.audit_ref} · {a.trigger_label ?? 'Scheduled'}</Text>
                  <Text style={styles.auditTitle} numberOfLines={2}>{a.title}</Text>
                  <Text style={styles.auditSite}>{a.site_name ?? '—'} · due {fmt(a.due_date)}</Text>
                </View>
                <RiskBandChip value={a.risk_band} small />
              </View>
              <View style={styles.stepLine}>
                <StepTracker steps={a.steps} compact />
              </View>
              <Text style={styles.nextStep}>
                Step {String(a.current_step ?? 1).padStart(2, '0')} · {a.current_step_label ?? '—'}
              </Text>
            </TouchableOpacity>
          )) : (
            <Empty icon="checkmark-done-outline" text="Nothing in flight. Your assigned audits appear here." />
          )}

          {inFlight.length > 4 && (
            <TouchableOpacity style={styles.moreBtn} onPress={() => navigation.navigate('Audits')}>
              <Text style={styles.moreBtnText}>View all {inFlight.length}</Text>
              <Ionicons name="chevron-forward" size={15} color={C.brand} />
            </TouchableOpacity>
          )}

          {/* Why any of this is scheduled */}
          <SectionLabel>The programme</SectionLabel>
          <Card subtitle="Audits are not booked by hand. The frequency comes from each site's risk band, and the band is driven by its own safety performance score.">
            {programme.length ? programme.slice(0, 6).map((p) => (
              <View key={`${p.site_id}`} style={styles.progRow}>
                <RiskBandChip value={p.risk_band} small />
                <View style={{ flex: 1 }}>
                  <Text style={styles.progSite} numberOfLines={1}>{p.site_name ?? 'Site'}</Text>
                  <Text style={styles.progFreq}>
                    {(p.inspection_frequency ?? '').replace(/_/g, '-')} inspection ·{' '}
                    {(p.audit_frequency ?? '').replace(/_/g, '-')} audit
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.progDue, p.overdue && { color: '#B91C1C' }]}>
                    {fmt(p.next_audit_due)}
                  </Text>
                  <Text style={styles.progScore}>score {p.site_score ?? '—'}</Text>
                </View>
              </View>
            )) : <Empty icon="calendar-outline" text="No sites in the programme yet." />}
          </Card>

          {/* The other job */}
          <SectionLabel>On-site verification</SectionLabel>
          <View style={styles.quickGrid}>
            {[
              { r: 'Verifications', i: 'shield-checkmark', t: 'Permit & unsafe act', s: 'WF-02 · WF-01' },
              { r: 'CompetenceEvidenceAudit', i: 'school', t: 'Competence', s: 'WF-07' },
              { r: 'ContractorAudit', i: 'business', t: 'Contractor', s: 'WF-09' },
              { r: 'TransportVehicleAudit', i: 'car', t: 'Vehicle', s: 'WF-10' },
              { r: 'Training', i: 'play-circle', t: 'Training', s: 'Safety videos' },
            ].map((x) => (
              <TouchableOpacity key={x.r} style={styles.quick} onPress={() => navigation.navigate(x.r)} activeOpacity={0.9}>
                <View style={styles.quickIcon}><Ionicons name={x.i as any} size={18} color={C.brand} /></View>
                <Text style={styles.quickTitle}>{x.t}</Text>
                <Text style={styles.quickSub}>{x.s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
      <AiFab onPress={() => navigation.navigate('AiAssistant')} />
    </SafeAreaView>
  );
}

function Stat({ label, value, icon, color, bg }: any) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#EEF2F6',
  },
  hi: { fontSize: 11, fontWeight: '700', color: C.muted },
  name: { fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 1 },
  badge: {
    position: 'absolute', top: -1, right: -1, width: 8, height: 8,
    borderRadius: 4, backgroundColor: '#DC2626',
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#DBEAFE',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontWeight: '800', fontSize: 12, color: C.brand },

  scroll: { padding: 16, paddingBottom: 20 },

  statsRow: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  stat: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1,
    borderColor: C.border, padding: 12, alignItems: 'center', gap: 3,
  },
  statIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  statValue: { fontSize: 19, fontWeight: '900' },
  statLabel: { fontSize: 9.5, fontWeight: '700', color: C.muted },

  avgCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF',
    borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 4,
  },
  avgTitle: { fontSize: 12.5, fontWeight: '800', color: C.ink },
  avgNote: { fontSize: 10.5, fontWeight: '600', color: C.muted, lineHeight: 15, marginTop: 4 },

  auditCard: {
    backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: C.border,
    padding: 13, marginBottom: 9,
  },
  auditHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  auditRef: { fontSize: 9, fontWeight: '900', color: C.light, letterSpacing: 0.5 },
  auditTitle: { fontSize: 13.5, fontWeight: '800', color: C.ink, marginTop: 3, lineHeight: 18 },
  auditSite: { fontSize: 10.5, fontWeight: '600', color: C.muted, marginTop: 3 },
  stepLine: { marginTop: 11 },
  nextStep: { fontSize: 10.5, fontWeight: '800', color: C.brand, marginTop: 8 },

  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, marginBottom: 4 },
  moreBtnText: { fontSize: 12, fontWeight: '800', color: C.brand },

  progRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  progSite: { fontSize: 12, fontWeight: '700', color: C.ink },
  progFreq: { fontSize: 10, fontWeight: '600', color: C.light, marginTop: 2, textTransform: 'capitalize' },
  progDue: { fontSize: 11, fontWeight: '800', color: C.mid },
  progScore: { fontSize: 9.5, fontWeight: '600', color: C.light, marginTop: 2 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  quick: {
    width: '47.6%', backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1,
    borderColor: C.border, padding: 13, gap: 3,
  },
  quickIcon: {
    width: 34, height: 34, borderRadius: 9, backgroundColor: C.brandSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 5,
  },
  quickTitle: { fontSize: 12.5, fontWeight: '800', color: C.ink },
  quickSub: { fontSize: 9.5, fontWeight: '700', color: C.light },
});

export default AuditorDashboardScreen;
