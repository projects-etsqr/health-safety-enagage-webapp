/**
 * The audit, and the one thing it is actually waiting on.
 *
 * The whole screen is built around a single question: which of the ten steps is
 * open, and can this auditor act on it? Everything else — the score, the
 * findings, the meetings — is history or detail. Showing every possible action
 * at every status was what let a submitted audit still invite you to walk it.
 *
 * The step states come from the server, which derives them from what the audit
 * actually contains rather than from a stored pointer. So this screen never
 * predicts the next state: it acts, then re-reads.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  auditService, Audit, AuditStep, CLASSIFICATION_META, Classification,
} from '../services/auditService';
import {
  Banner, C, Card, ClassificationChip, Empty, KV, PrimaryButton, GhostButton,
  RatingChip, RiskBandChip, ScoreRing, ScreenHeader, SectionLabel, StepTracker,
} from '../components';

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

/** Where each step is carried out. Steps the auditor cannot act on say who can. */
const STEP_ROUTE: Record<number, { route: string; label: string; icon: string }> = {
  3: { route: 'BriefPack', label: 'Read the brief pack', icon: 'document-text' },
  4: { route: 'OpeningMeeting', label: 'Hold the opening meeting', icon: 'people' },
  5: { route: 'AuditChecklist', label: 'Walk the site', icon: 'walk' },
  6: { route: 'AuditChecklist', label: 'Capture the outstanding evidence', icon: 'camera' },
  7: { route: 'ReviewFindings', label: 'Classify findings & score', icon: 'pricetags' },
  8: { route: 'ClosingMeeting', label: 'Hold the closing meeting', icon: 'create' },
  9: { route: 'AuditReport', label: 'Sign & issue the report', icon: 'shield-checkmark' },
  10: { route: 'AuditFindings', label: 'Track the findings out', icon: 'checkmark-done' },
};

export function AuditDetailScreen({ route, navigation }: any) {
  const auditId: number = route.params?.auditId ?? route.params?.audit?.id;
  const [audit, setAudit] = useState<Audit | null>(route.params?.audit ?? null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setAudit(await auditService.get(auditId));
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Could not load this audit.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auditId]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  if (loading && !audit) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title="Audit" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!audit) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title="Audit" onBack={() => navigation.goBack()} />
        <Banner tone="danger" title="Audit unavailable" text={error ?? 'Not found.'} />
      </SafeAreaView>
    );
  }

  const current: AuditStep | undefined = audit.steps.find(
    (s) => s.state === 'active' || s.state === 'blocked',
  );
  const stopWork = audit.status === 'immediate_action';
  const findings = audit.classified_findings ?? [];
  const ncs = findings.filter((f) => CLASSIFICATION_META[f.classification].severity >= 2);

  const go = (target: { route: string; label: string }) =>
    navigation.navigate(target.route, { auditId: audit.id, audit });

  const resume = async () => {
    setBusy(true);
    try { setAudit(await auditService.resume(audit.id)); }
    catch (e: any) { Alert.alert('Could not resume', e?.response?.data?.detail ?? 'Please try again.'); }
    finally { setBusy(false); }
  };

  const closeOut = async () => {
    setBusy(true);
    try {
      setAudit(await auditService.close(audit.id));
      Alert.alert('Audit closed', 'Every finding it raised has been verified effective.');
    } catch (e: any) {
      Alert.alert('Cannot close yet', e?.response?.data?.detail ?? 'Please try again.');
    } finally { setBusy(false); }
  };

  /** The single action this screen offers, or nothing when it is not ours. */
  const renderAction = () => {
    if (busy) return <ActivityIndicator color={C.brand} style={{ marginVertical: 14 }} />;

    if (stopWork) {
      return (
        <>
          <Banner
            tone="danger" icon="hand-left"
            title="Stop work — critical finding"
            text="The Safety Manager and the executive have been notified. Contain the hazard before the walk continues."
          />
          <PrimaryButton label="Contained — resume the walk" icon="refresh" tone="danger" onPress={resume} />
        </>
      );
    }

    if (!current) {
      return (
        <Banner
          tone="ok" icon="lock-closed"
          title="Audit closed"
          text={`Closed ${fmt(audit.closed_at)}. Every corrective action it raised was verified effective.`}
        />
      );
    }

    // Steps 1, 2 and the Safety Manager's approval are not the auditor's to do.
    if (current.number <= 2) {
      return (
        <Banner
          tone="info" icon="hourglass"
          title={`Waiting on the ${current.owner_label ?? current.owner}`}
          text={current.detail}
        />
      );
    }

    if (current.number === 10 && audit.open_finding_count === 0) {
      return (
        <>
          <Banner
            tone="ok" icon="checkmark-done"
            title="Every finding is verified"
            text="The audit can be closed. It stayed open until each corrective action was checked on site."
          />
          <PrimaryButton label="Close the audit" icon="lock-closed" tone="ok" onPress={closeOut} />
        </>
      );
    }

    const target = STEP_ROUTE[current.number];
    if (!target) return null;

    return (
      <>
        {current.state === 'blocked' && (
          <Banner
            tone="warn" icon="alert-circle"
            title="Hard stop"
            text={current.detail}
          />
        )}
        <View style={styles.nextCard}>
          <Text style={styles.nextStep}>
            STEP {String(current.number).padStart(2, '0')} · {current.phase}
          </Text>
          <Text style={styles.nextLabel}>{current.label}</Text>
          <Text style={styles.nextDetail}>{current.detail}</Text>
        </View>
        <PrimaryButton label={target.label} icon={target.icon} onPress={() => go(target)} />
      </>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title={audit.audit_ref ?? `Audit #${audit.id}`}
        subtitle={audit.site_name ?? undefined}
        onBack={() => navigation.goBack()}
        right={<RiskBandChip value={audit.risk_band} small />}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.title}>{audit.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{audit.checklist_type ?? 'Audit'}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{audit.trigger_label ?? 'Scheduled'}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{fmt(audit.scheduled_date)}</Text>
        </View>

        {/* Score, once there is one */}
        {audit.compliance_score != null && (
          <View style={styles.scoreRow}>
            <ScoreRing
              score={audit.compliance_score}
              band={audit.score_band ?? 'poor'}
              caption={`${audit.finding_counts?.conformance ?? 0} conformances`}
            />
            <View style={{ flex: 1, gap: 8 }}>
              <RatingChip value={audit.overall_rating} />
              <Text style={styles.scoreNote}>
                The rating comes from the finding counts, not the percentage — any Major
                non-conformance makes an audit Unsatisfactory whatever it scored.
              </Text>
            </View>
          </View>
        )}

        {audit.re_audit_required && (
          <Banner
            tone="danger" icon="repeat"
            title="Re-audit required"
            text={`${audit.re_audit_reason ?? 'Persistent poor performance.'} Due ${fmt(audit.re_audit_due_date)}.`}
          />
        )}

        {/* The one action */}
        {renderAction()}

        {/* Where it sits on the ten steps */}
        <SectionLabel>The ten steps</SectionLabel>
        <View style={{ marginHorizontal: -16, marginBottom: 14 }}>
          <StepTracker
            steps={audit.steps}
            onPressStep={(s) => {
              const t = STEP_ROUTE[s.number];
              if (t && s.state !== 'todo') go(t);
              else Alert.alert(`Step ${s.number} · ${s.label}`, `${s.owner_label ?? s.owner} — ${s.detail}`);
            }}
          />
        </View>

        {/* Findings */}
        <SectionLabel>Findings ({findings.length})</SectionLabel>
        <Card>
          {findings.length ? (
            <>
              <View style={styles.countRow}>
                {(Object.keys(CLASSIFICATION_META) as Classification[]).map((c) => {
                  const n = audit.finding_counts?.[c] ?? 0;
                  if (!n) return null;
                  const m = CLASSIFICATION_META[c];
                  return (
                    <View key={c} style={[styles.countChip, { backgroundColor: m.bg }]}>
                      <Text style={[styles.countNum, { color: m.color }]}>{n}</Text>
                      <Text style={[styles.countLabel, { color: m.color }]}>{m.short}</Text>
                    </View>
                  );
                })}
              </View>
              {ncs.slice(0, 5).map((f) => (
                <View key={f.id} style={styles.findRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.findTitle} numberOfLines={2}>{f.title}</Text>
                    <Text style={styles.findMeta}>
                      {f.finding_ref} · due {fmt(f.corrective_action_due)} · {f.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <ClassificationChip value={f.classification} small repeat={f.is_repeat} />
                </View>
              ))}
              <GhostButton
                label={`View all ${findings.length} findings`}
                icon="list"
                onPress={() => navigation.navigate('AuditFindings', { auditId: audit.id, audit })}
              />
            </>
          ) : (
            <Empty icon="pricetags-outline" text="Nothing classified yet. Findings appear after step 07." />
          )}
        </Card>

        {/* The record */}
        <SectionLabel>The record</SectionLabel>
        <Card>
          <KV k="Reference" v={audit.audit_ref ?? '—'} />
          <KV k="Site" v={audit.site_name ?? '—'} />
          <KV k="Department" v={audit.department ?? '—'} />
          <KV k="Trigger" v={audit.trigger_label ?? '—'} />
          <KV k="Risk band" v={<RiskBandChip value={audit.risk_band} small />} />
          <KV k="Auditee notified" v={fmt(audit.auditee_notified_at)} />
          <KV k="Brief reviewed" v={fmt(audit.brief_pack_reviewed_at)} />
          <KV k="Opening meeting" v={fmt(audit.opening_meeting_at)} />
          <KV k="Closing meeting" v={fmt(audit.closing_meeting_at)} />
          <KV
            k="Factual accuracy"
            v={audit.auditee_confirmed_at ? `Confirmed by ${audit.auditee_signed_name ?? 'the supervisor'}` : 'Not yet confirmed'}
            vColor={audit.auditee_confirmed_at ? '#047857' : undefined}
          />
          <KV
            k="Findings locked"
            v={audit.findings_locked ? fmt(audit.findings_locked_at) : 'Open to change'}
          />
          <KV k="Report" v={audit.report_ref ? `${audit.report_ref} · ${fmt(audit.report_issued_at)}` : 'Not issued'} />
          <KV
            k="Approved for distribution"
            v={audit.report_approved_at ? fmt(audit.report_approved_at) : 'Awaiting Safety Manager'}
          />
        </Card>

        {/* Opening meeting, as agreed */}
        {!!audit.opening_meeting && (
          <>
            <SectionLabel>Scope as agreed</SectionLabel>
            <Card>
              <Text style={styles.scopeLabel}>SCOPE</Text>
              <Text style={styles.scopeText}>{audit.opening_meeting.scope}</Text>
              <Text style={styles.scopeLabel}>METHOD</Text>
              <Text style={styles.scopeText}>{audit.opening_meeting.method}</Text>
              <Text style={styles.scopeLabel}>SAMPLING</Text>
              <Text style={styles.scopeText}>{audit.opening_meeting.sampling_approach}</Text>
            </Card>
          </>
        )}

        {/* Cross-workflow verification — the auditor's other job */}
        <SectionLabel>On-site verification</SectionLabel>
        <Card subtitle="Formal audits are only part of the role. These confirm on site that what the system says is true actually is.">
          {[
            { r: 'Verifications', i: 'shield-checkmark', t: 'Permit & unsafe act verification', s: 'WF-02 · WF-01' },
            { r: 'CompetenceEvidenceAudit', i: 'school', t: 'Competence evidence audit', s: 'WF-07' },
            { r: 'ContractorAudit', i: 'business', t: 'Contractor audit', s: 'WF-09' },
            { r: 'TransportVehicleAudit', i: 'car', t: 'Vehicle & journey audit', s: 'WF-10' },
          ].map((x) => (
            <TouchableOpacity key={x.r} style={styles.linkRow} onPress={() => navigation.navigate(x.r)}>
              <View style={styles.linkIcon}><Ionicons name={x.i as any} size={17} color={C.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>{x.t}</Text>
                <Text style={styles.linkSub}>{x.s}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.light} />
            </TouchableOpacity>
          ))}
        </Card>

        <View style={{ height: 36 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 20 },
  title: { fontSize: 21, fontWeight: '800', color: C.ink, lineHeight: 27 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, marginBottom: 16, flexWrap: 'wrap' },
  meta: { fontSize: 11.5, fontWeight: '700', color: C.muted },
  dot: { fontSize: 11.5, color: C.light },

  scoreRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#FFFFFF',
    borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12,
  },
  scoreNote: { fontSize: 11, color: C.muted, fontWeight: '600', lineHeight: 15.5 },

  nextCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5, borderColor: '#BFDBFE',
    padding: 14, marginBottom: 12,
  },
  nextStep: { fontSize: 9.5, fontWeight: '900', color: C.brand, letterSpacing: 0.8 },
  nextLabel: { fontSize: 16, fontWeight: '800', color: C.ink, marginTop: 4 },
  nextDetail: { fontSize: 11.5, fontWeight: '600', color: C.muted, lineHeight: 16, marginTop: 5 },

  countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  countChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5,
  },
  countNum: { fontSize: 12, fontWeight: '900' },
  countLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.3 },

  findRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  findTitle: { fontSize: 12.5, fontWeight: '700', color: C.ink, lineHeight: 17 },
  findMeta: { fontSize: 10.5, fontWeight: '600', color: C.light, marginTop: 2 },

  scopeLabel: { fontSize: 9, fontWeight: '900', color: C.light, letterSpacing: 0.7, marginTop: 10 },
  scopeText: { fontSize: 12.5, color: C.mid, fontWeight: '600', lineHeight: 18, marginTop: 4 },

  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  linkIcon: {
    width: 34, height: 34, borderRadius: 9, backgroundColor: C.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  linkTitle: { fontSize: 12.5, fontWeight: '800', color: C.ink },
  linkSub: { fontSize: 10, fontWeight: '700', color: C.light, marginTop: 2 },
});

export default AuditDetailScreen;
