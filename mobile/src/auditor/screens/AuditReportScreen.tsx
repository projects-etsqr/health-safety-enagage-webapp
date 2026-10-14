/**
 * Step 09 REPORT · the signature that issues the report.
 *
 * "The report cannot be issued without the auditor's signature. Signing triggers
 * distribution and creates the corrective actions."
 *
 * Signing is the transition, not a formality on top of one. There is no path
 * that issues a report without raising the actions, and none that raises actions
 * from a report nobody signed — so this screen has exactly one button and it
 * does both.
 *
 * The full document — benchmark comparison, clause mapping, the long form — is
 * reviewed and distributed from the web console, where a long document is
 * genuinely easier to work with. This is the summary the auditor signs against
 * while still on site.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, ActivityIndicator, TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { KEYBOARD_BEHAVIOR } from '../../components/layout/KeyboardAvoider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  auditService, Audit, AuditReport, CLASSIFICATION_META, Classification,
} from '../services/auditService';
import { useAuth } from '../../hooks/useAuth';
import SignaturePad from '../components/SignaturePad';
import {
  Banner, C, Card, ClassificationChip, Empty, KV, PrimaryButton, RatingChip,
  ScoreRing, ScreenHeader, SectionLabel,
} from '../components';

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

export function AuditReportScreen({ route, navigation }: any) {
  const auditId: number = route.params?.auditId ?? route.params?.audit?.id;
  const { user } = useAuth();

  const [audit, setAudit] = useState<Audit | null>(route.params?.audit ?? null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        auditService.get(auditId),
        auditService.report(auditId).catch(() => null),
      ]);
      setAudit(a);
      setReport(r);
    } catch (e: any) {
      Alert.alert('Could not load the report', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [auditId]);

  useEffect(() => { load(); }, [load]);

  const issued = !!audit?.report_issued_at;
  const locked = !!audit?.findings_locked;
  const ncCount = report
    ? report.findings.filter((f) => CLASSIFICATION_META[f.classification].severity >= 2).length
    : 0;

  const sign = () => {
    if (!signature) {
      Alert.alert('Signature required', 'The report cannot be issued without your signature.');
      return;
    }
    Alert.alert(
      'Sign and issue?',
      `This distributes the report and creates ${ncCount} corrective action${ncCount === 1 ? '' : 's'} — one for every non-conformance. It cannot be undone.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Sign & issue',
          onPress: async () => {
            setBusy(true);
            try {
              const res = await auditService.issueReport(auditId, {
                auditor_signature: signature,
                auditor_signed_name: user?.name || 'Auditor',
                summary: summary.trim() || undefined,
              });
              if (res.queued) {
                Alert.alert('Saved offline', 'The report issues when this syncs.');
              }
              await load();
            } catch (e: any) {
              Alert.alert('Could not issue', e?.response?.data?.detail ?? 'Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title="Report" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const delta = report?.benchmark?.delta;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title={issued ? (audit?.report_ref ?? 'Report') : 'Issue the report'}
        subtitle={`Step 09 · ${audit?.site_name ?? ''}`}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {!locked && !issued && (
            <Banner
              tone="warn" icon="lock-open"
              title="Findings are not locked"
              text="Hold the closing meeting and get factual accuracy confirmed first. There is nothing to sign until the findings are settled."
            />
          )}

          {issued && (
            <Banner
              tone="ok" icon="shield-checkmark"
              title={`Issued ${fmt(audit?.report_issued_at)}`}
              text={`Signed by ${audit?.auditor_signed_name}. ${audit?.report_approved_at ? `Approved for wider distribution ${fmt(audit.report_approved_at)}.` : 'Awaiting Safety Manager approval before wider distribution.'}`}
            />
          )}

          {/* The result */}
          <View style={styles.scoreCard}>
            <ScoreRing
              score={report?.score?.score ?? audit?.compliance_score ?? 0}
              band={(report?.score?.band ?? audit?.score_band ?? 'poor') as any}
              size={104}
            />
            <View style={{ flex: 1, gap: 9 }}>
              <RatingChip value={report?.score?.overall_rating ?? audit?.overall_rating} />
              <Text style={styles.explain}>{report?.score?.explanation ?? ''}</Text>
            </View>
          </View>

          {/* Benchmark against last time — built by the system, not typed */}
          <SectionLabel>Benchmark against last time</SectionLabel>
          <Card>
            {report?.benchmark?.previous_audit_ref ? (
              <>
                <KV k="Previous audit" v={report.benchmark.previous_audit_ref} />
                <KV k="Previous score" v={`${report.benchmark.previous_score ?? '—'}%`} />
                <KV
                  k="Change"
                  v={delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta} pts`}
                  vColor={delta == null ? undefined : delta >= 0 ? '#047857' : '#B91C1C'}
                />
                <KV
                  k="Repeat findings"
                  v={String(report.benchmark.repeat_findings)}
                  vColor={report.benchmark.repeat_findings > 0 ? '#B45309' : undefined}
                />
                {report.benchmark.repeat_findings > 0 && (
                  <Text style={styles.repeatNote}>
                    A repeat is treated as more serious than a first occurrence — the control was
                    already supposed to be in place.
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.note}>No previous audit at this site. This one is the baseline.</Text>
            )}
          </Card>

          {/* Clause mapping */}
          {!!report?.clause_map?.length && (
            <>
              <SectionLabel>Standard clause mapping</SectionLabel>
              <Card>
                {report.clause_map.map((c) => (
                  <View key={c.clause} style={styles.clauseRow}>
                    <View style={styles.clauseTag}><Text style={styles.clauseTagText}>{c.clause}</Text></View>
                    <Text style={styles.clauseCount}>{c.findings} finding{c.findings === 1 ? '' : 's'}</Text>
                    <ClassificationChip value={c.worst as Classification} small />
                  </View>
                ))}
              </Card>
            </>
          )}

          {/* Findings */}
          <SectionLabel>Findings ({report?.findings?.length ?? 0})</SectionLabel>
          <Card>
            {report?.findings?.length ? report.findings.map((f) => (
              <View key={f.id} style={styles.findRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.findTitle}>{f.title}</Text>
                  <Text style={styles.findMeta}>
                    {f.finding_ref}
                    {f.corrective_action_due ? ` · action due ${fmt(f.corrective_action_due)}` : ''}
                    {f.capa_id ? ` · CAPA raised` : ''}
                  </Text>
                </View>
                <ClassificationChip value={f.classification} small repeat={f.is_repeat} />
              </View>
            )) : <Empty icon="pricetags-outline" text="No findings on this report." />}
          </Card>

          {/* Escalations the report carries */}
          {!!report?.escalations?.length && (
            <Banner
              tone="danger" icon="repeat"
              title="Re-audit triggered"
              text={report.escalations.map((e) => e.detail).filter(Boolean).join(' ')}
            />
          )}

          {/* Signature */}
          {!issued && locked && (
            <>
              <SectionLabel>Summary (optional)</SectionLabel>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={summary} onChangeText={setSummary}
                multiline
                placeholder="Anything the numbers do not say."
                placeholderTextColor={C.light}
              />

              <SectionLabel>Auditor's signature</SectionLabel>
              <Card>
                <Text style={styles.sigNote}>
                  The report cannot be issued without it. Signing distributes the report and creates a
                  corrective action for every one of the {ncCount} non-conformance
                  {ncCount === 1 ? '' : 's'} above.
                </Text>
                <SignaturePad
                  label="Auditor"
                  signerName={user?.name || 'Auditor'}
                  onChange={setSignature}
                />
              </Card>

              <PrimaryButton
                label="Sign & issue the report"
                icon="shield-checkmark"
                onPress={sign}
                loading={busy}
                disabled={!signature}
              />
            </>
          )}

          {issued && (
            <>
              <SectionLabel>Distribution</SectionLabel>
              <Card>
                <KV k="Reference" v={audit?.report_ref ?? '—'} />
                <KV k="Signed by" v={audit?.auditor_signed_name ?? '—'} />
                <KV k="Factual accuracy" v={audit?.auditee_signed_name ?? '—'} />
                <KV k="Sent to" v={`${report?.distributed_to?.length ?? 0} recipient(s)`} />
                <KV
                  k="Safety Manager approval"
                  v={audit?.report_approved_at ? fmt(audit.report_approved_at) : 'Pending'}
                  vColor={audit?.report_approved_at ? '#047857' : '#B45309'}
                />
                <Text style={styles.note}>
                  The Safety Manager approves before wider distribution; the admin owns distribution
                  beyond this site. The full document is reviewed on the web console.
                </Text>
              </Card>

              <Banner
                tone="info" icon="time"
                title="The audit is not closed"
                text="It stays open until every corrective action it raised has been verified effective on site — at 30, 60 and 90 days."
              />
              <PrimaryButton
                label={`Track ${audit?.open_finding_count ?? 0} finding(s) out`}
                icon="checkmark-done"
                onPress={() => navigation.navigate('AuditFindings', { auditId, audit })}
              />
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 20 },
  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#FFFFFF',
    borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 15, marginBottom: 12,
  },
  explain: { fontSize: 11, color: C.muted, fontWeight: '600', lineHeight: 15.5 },
  note: { fontSize: 11, color: C.muted, fontWeight: '600', lineHeight: 15.5, marginTop: 9 },
  repeatNote: { fontSize: 11, color: '#B45309', fontWeight: '600', lineHeight: 15.5, marginTop: 9 },

  clauseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  clauseTag: { backgroundColor: '#F1F5F9', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 4 },
  clauseTagText: { fontSize: 9.5, fontWeight: '800', color: C.mid },
  clauseCount: { flex: 1, fontSize: 11.5, fontWeight: '700', color: C.muted },

  findRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  findTitle: { fontSize: 12.5, fontWeight: '700', color: C.ink, lineHeight: 17 },
  findMeta: { fontSize: 10, fontWeight: '600', color: C.light, marginTop: 3 },

  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, borderRadius: 11,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, color: C.ink,
    fontWeight: '600', marginBottom: 12,
  },
  multiline: { minHeight: 76, textAlignVertical: 'top', lineHeight: 19 },
  sigNote: { fontSize: 11.5, color: C.muted, fontWeight: '600', lineHeight: 16, marginBottom: 13 },
});

export default AuditReportScreen;
