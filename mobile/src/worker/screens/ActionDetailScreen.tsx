import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, RefreshControl,
} from 'react-native';
import { Icon } from '../components/display/Icon';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { Colors } from '../theme/colors';
import { capaService, CapaDetail } from '../services/capaService';

/**
 * One corrective action, from the owner's side: what to do, what counts as
 * done, and the three checks standing between "done" and "closed".
 *
 * The closure checks are shown to the owner rather than hidden until the end.
 * They are the reason a submission gets bounced, and an owner who can see
 * "evidence must post-date the action" before uploading does not waste a day
 * finding out afterwards.
 */

const EVIDENCE_LABELS: Record<string, string> = {
  photo: 'Photo',
  document: 'Document',
  training_record: 'Training record',
  test_report: 'Test report',
  inspection_confirmation: 'Inspection confirmation',
};

function todayISO() {
  return new Date().toISOString().slice(0, 19);
}

export default function ActionDetailScreen({ route, navigation }: any) {
  const id = route?.params?.id;
  const [capa, setCapa] = useState<CapaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [evidenceType, setEvidenceType] = useState<string | null>(null);
  const [evidenceNote, setEvidenceNote] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await capaService.detail(id);
      setCapa(d);
      if (!evidenceType && d.allowed_evidence_types?.length) {
        setEvidenceType(d.allowed_evidence_types[0]);
      }
    } catch (e: any) {
      Alert.alert('Could not load', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, evidenceType]);

  useEffect(() => { load(); }, [id]);

  /** The backend's rejection reason is the useful message, so show it verbatim. */
  const run = async (fn: () => Promise<CapaDetail>, okMessage?: string) => {
    setBusy(true);
    try {
      const updated = await fn();
      setCapa(updated);
      if (okMessage) Alert.alert('Done', okMessage);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg =
        typeof detail === 'string' ? detail
        : detail?.message ? `${detail.message}\n\n${(detail.failures ?? []).join('\n')}`
        : 'Something went wrong.';
      Alert.alert('Not allowed', msg);
      load();
    } finally {
      setBusy(false);
    }
  };

  if (loading || !capa) {
    return (
      <ScreenLayout>
        <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
      </ScreenLayout>
    );
  }

  const canStart = capa.status === 'Open';
  const canWork = capa.status === 'In Progress' || capa.status === 'Open';
  const awaitingOthers =
    capa.status === 'Pending Review' || capa.status === 'Pending Approval';

  return (
    <ScreenLayout>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="arrow-left" size={20} color={Colors.textDark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.ref}>{capa.capa_ref}</Text>
          <Text style={styles.step}>Step {capa.step} of 10 · {capa.step_label}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        {!!capa.next_action && (
          <View style={styles.nextBox}>
            <Icon name="arrow-right-circle" size={16} color={Colors.blue} />
            <Text style={styles.nextText}>{capa.next_action}</Text>
          </View>
        )}

        <Section title="What to do">
          <Text style={styles.para}>{capa.description}</Text>
          {!!capa.action_plan && <Text style={styles.para}>{capa.action_plan}</Text>}
        </Section>

        {!!capa.success_criteria && (
          <Section title="What counts as done">
            <Text style={styles.para}>{capa.success_criteria}</Text>
            <Text style={styles.hint}>
              Your evidence will be measured against this.
            </Text>
          </Section>
        )}

        <Section title="Deadline">
          <Row label="Due" value={capa.due_date ?? 'Not set'} />
          <Row label="Priority" value={`${capa.priority_band ?? 'Unscored'} · ${capa.capa_type ?? '—'}`} />
          <Row
            label="Time used"
            value={capa.elapsed_percent == null ? '—' : `${capa.elapsed_percent}%`}
            emphasis={capa.is_overdue ? Colors.critical : undefined}
          />
        </Section>

        {/* The three gates, live. */}
        <Section title="Before this can close">
          {capa.closure_checks.map(c => (
            <View key={c.key} style={styles.checkRow}>
              <Icon
                name={c.passed ? 'check-circle' : 'circle'}
                size={16}
                color={c.passed ? Colors.success : Colors.textLight}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.checkLabel, c.passed && { color: Colors.textDark }]}>
                  {c.label}
                </Text>
                <Text style={styles.checkDetail}>{c.detail}</Text>
              </View>
            </View>
          ))}
          {!capa.interim_check_at && (
            <View style={styles.checkRow}>
              <Icon name="circle" size={16} color={Colors.textLight} />
              <View style={{ flex: 1 }}>
                <Text style={styles.checkLabel}>Supervisor halfway check</Text>
                <Text style={styles.checkDetail}>
                  Your supervisor must confirm progress before you can submit.
                </Text>
              </View>
            </View>
          )}
        </Section>

        {capa.evidence.length > 0 && (
          <Section title={`Evidence (${capa.evidence.length})`}>
            {capa.evidence.map(e => (
              <View key={e.id} style={styles.evidenceRow}>
                <Icon
                  name={e.validation_result === 'rejected' ? 'x-circle' : 'paperclip'}
                  size={15}
                  color={e.validation_result === 'rejected' ? Colors.critical : Colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.evidenceType}>
                    {EVIDENCE_LABELS[e.evidence_type] ?? e.evidence_type}
                    {e.evidence_date ? ` · ${e.evidence_date.slice(0, 10)}` : ''}
                  </Text>
                  {!!e.description && <Text style={styles.evidenceDesc}>{e.description}</Text>}
                  {!!e.rejection_reason && (
                    <Text style={styles.rejected}>{e.rejection_reason}</Text>
                  )}
                </View>
              </View>
            ))}
          </Section>
        )}

        {awaitingOthers && (
          <View style={styles.waitBox}>
            <Icon name="clock" size={16} color={Colors.textMuted} />
            <Text style={styles.waitText}>
              {capa.status === 'Pending Review'
                ? 'Submitted. Waiting for someone else to confirm the control is in place.'
                : 'All checks passed. Waiting for the Safety Manager to approve closure.'}
            </Text>
          </View>
        )}

        {capa.is_locked && (
          <View style={styles.waitBox}>
            <Icon name="lock" size={16} color={Colors.success} />
            <Text style={styles.waitText}>
              Closed and locked. Effectiveness reviews run at 30, 60 and 90 days.
            </Text>
          </View>
        )}

        {canWork && !capa.is_locked && (
          <>
            <Section title="Add evidence">
              <Text style={styles.hint}>
                Allowed for this action: {capa.allowed_evidence_types
                  .map(t => EVIDENCE_LABELS[t] ?? t).join(', ')}
              </Text>
              <View style={styles.chipRow}>
                {capa.allowed_evidence_types.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, evidenceType === t && styles.chipOn]}
                    onPress={() => setEvidenceType(t)}
                  >
                    <Text style={[styles.chipText, evidenceType === t && styles.chipTextOn]}>
                      {EVIDENCE_LABELS[t] ?? t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder="What does this evidence show?"
                placeholderTextColor={Colors.textLight}
                value={evidenceNote}
                onChangeText={setEvidenceNote}
                multiline
              />
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                disabled={busy || !evidenceType}
                onPress={() => run(
                  () => capaService.addEvidence(capa.id, {
                    evidence_type: evidenceType!,
                    description: evidenceNote || undefined,
                    // Dated now: this is evidence of work just done, and the
                    // system rejects anything predating the action.
                    evidence_date: todayISO(),
                  }),
                  'Evidence attached.',
                ).then(() => setEvidenceNote(''))}
              >
                <Icon name="paperclip" size={16} color={Colors.blue} />
                <Text style={styles.btnGhostText}>Attach evidence</Text>
              </TouchableOpacity>
            </Section>

            <Section title="Progress update">
              <TextInput
                style={styles.input}
                placeholder="What have you done so far?"
                placeholderTextColor={Colors.textLight}
                value={note}
                onChangeText={setNote}
                multiline
              />
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                disabled={busy || note.trim().length < 3}
                onPress={() => run(
                  () => capaService.addProgress(capa.id, note.trim()),
                  'Progress recorded.',
                ).then(() => setNote(''))}
              >
                <Icon name="edit-3" size={16} color={Colors.blue} />
                <Text style={styles.btnGhostText}>Post update</Text>
              </TouchableOpacity>
            </Section>
          </>
        )}

        {canStart && (
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            disabled={busy}
            onPress={() => run(() => capaService.start(capa.id), 'Marked as started.')}
          >
            <Icon name="play-circle" size={18} color={Colors.white} />
            <Text style={styles.btnPrimaryText}>Start work</Text>
          </TouchableOpacity>
        )}

        {capa.status === 'In Progress' && (
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            disabled={busy}
            onPress={() => run(
              () => capaService.submit(capa.id),
              'Submitted for review.',
            )}
          >
            <Icon name="send" size={18} color={Colors.white} />
            <Text style={styles.btnPrimaryText}>Submit for review</Text>
          </TouchableOpacity>
        )}

        {busy && <ActivityIndicator style={{ marginTop: 14 }} color={Colors.primary} />}
      </ScrollView>
    </ScreenLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasis ? { color: emphasis, fontWeight: '700' } : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  back: { padding: 4 },
  ref: { fontSize: 17, fontWeight: '700', color: Colors.textDark },
  step: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  body: { padding: 16, paddingBottom: 48 },

  nextBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#EFF6FF', padding: 12, borderRadius: 10, marginBottom: 14,
  },
  nextText: { color: Colors.blue, fontSize: 13, flex: 1, lineHeight: 19 },

  section: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  },
  para: { fontSize: 14, color: Colors.textDark, lineHeight: 21, marginBottom: 6 },
  hint: { fontSize: 12, color: Colors.textMuted, marginTop: 2, marginBottom: 8 },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { fontSize: 13, color: Colors.textMuted },
  rowValue: { fontSize: 13, color: Colors.textDark, fontWeight: '600' },

  checkRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 7 },
  checkLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMid },
  checkDetail: { fontSize: 12, color: Colors.textMuted, marginTop: 1, lineHeight: 17 },

  evidenceRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 7 },
  evidenceType: { fontSize: 13, fontWeight: '600', color: Colors.textDark },
  evidenceDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  rejected: { fontSize: 12, color: Colors.critical, marginTop: 3, lineHeight: 17 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  chipOn: { backgroundColor: Colors.blue, borderColor: Colors.blue },
  chipText: { fontSize: 12, color: Colors.textMid, fontWeight: '600' },
  chipTextOn: { color: Colors.white },

  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12,
    fontSize: 14, color: Colors.textDark, minHeight: 68, textAlignVertical: 'top',
    backgroundColor: Colors.background,
  },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 10, marginTop: 10,
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  btnGhost: { backgroundColor: '#EFF6FF' },
  btnGhostText: { color: Colors.blue, fontSize: 14, fontWeight: '700' },

  waitBox: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: Colors.background, padding: 12, borderRadius: 10, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  waitText: { fontSize: 13, color: Colors.textMid, flex: 1, lineHeight: 19 },
});
