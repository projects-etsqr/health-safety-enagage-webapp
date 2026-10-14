/**
 * Step 08 AGREE · the closing meeting.
 *
 * "Findings presented on screen, factual accuracy confirmed, and both signatures
 * captured on the device — auditor and auditee."
 *
 * Three things have to happen here and the screen refuses to finish without all
 * three, because each one is what makes the next step legitimate:
 *
 *   · the supervisor sees the findings, on this screen, before signing
 *   · they confirm the findings are factually accurate — or dispute them, which
 *     is a real outcome and does not lock anything
 *   · both parties sign, and the findings lock immediately
 *
 * Signing later, off the device, is the gap that lets findings drift between the
 * walk and the report. That is why the signature pad is here and not on the web.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert,
  ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { KEYBOARD_BEHAVIOR } from '../../components/layout/KeyboardAvoider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  auditService, Audit, CLASSIFICATION_META, Finding,
} from '../services/auditService';
import { useAuth } from '../../hooks/useAuth';
import SignaturePad from '../components/SignaturePad';
import {
  Banner, C, Card, ClassificationChip, Empty, PrimaryButton, RatingChip,
  ScoreRing, ScreenHeader, SectionLabel,
} from '../components';

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ClosingMeetingScreen({ route, navigation }: any) {
  const auditId: number = route.params?.auditId ?? route.params?.audit?.id;
  const { user } = useAuth();

  const [audit, setAudit] = useState<Audit | null>(route.params?.audit ?? null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [presented, setPresented] = useState(false);
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [disputes, setDisputes] = useState('');
  const [notes, setNotes] = useState('');
  const [attendee, setAttendee] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [timeframes, setTimeframes] = useState<Record<string, string>>({});

  const [auditorSig, setAuditorSig] = useState<string | null>(null);
  const [auditeeSig, setAuditeeSig] = useState<string | null>(null);
  const [auditeeName, setAuditeeName] = useState('');

  const load = useCallback(async () => {
    try {
      const a = await auditService.get(auditId);
      setAudit(a);
      setFindings(a.classified_findings ?? []);
      setTimeframes(
        Object.fromEntries(
          (a.classified_findings ?? [])
            .filter((f) => CLASSIFICATION_META[f.classification].severity >= 2)
            .map((f) => [
              String(f.id),
              f.corrective_action_due ?? addDays(CLASSIFICATION_META[f.classification].actionDays ?? 30),
            ]),
        ),
      );
      if (a.auditee_signed_name) setAuditeeName(a.auditee_signed_name);
    } catch (e: any) {
      Alert.alert('Could not load', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [auditId]);

  useEffect(() => { load(); }, [load]);

  const locked = !!audit?.findings_locked;
  const ncs = findings.filter((f) => CLASSIFICATION_META[f.classification].severity >= 2);

  const addAttendee = () => {
    const v = attendee.trim();
    if (!v) return;
    setAttendees((p) => (p.includes(v) ? p : [...p, v]));
    setAttendee('');
  };

  const submitDispute = async () => {
    if (!disputes.trim()) {
      Alert.alert('What is disputed?', 'Record what the supervisor says is factually wrong, so you can check it.');
      return;
    }
    setBusy(true);
    try {
      const res = await auditService.closingMeeting(auditId, {
        attendees,
        factual_accuracy_confirmed: false,
        disputes: disputes.trim(),
        notes: notes.trim() || undefined,
      });
      if (res.queued) Alert.alert('Saved offline', 'The dispute will sync when you have signal.');
      Alert.alert(
        'Dispute recorded',
        'Findings are NOT locked. Go back and correct the factual error, then hold the meeting again — that is what this meeting is for.',
        [{ text: 'OK', onPress: () => navigation.navigate('AuditDetail', { auditId }) }],
      );
    } catch (e: any) {
      Alert.alert('Could not record', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitConfirmed = async () => {
    if (!auditorSig || !auditeeSig) {
      Alert.alert(
        'Both signatures are required',
        'Auditor and auditee sign on the device before leaving site, so the findings lock immediately.',
      );
      return;
    }
    if (!auditeeName.trim()) {
      Alert.alert('Who signed?', 'The report has to name the person who confirmed the findings.');
      return;
    }
    setBusy(true);
    try {
      const res = await auditService.closingMeeting(auditId, {
        attendees,
        factual_accuracy_confirmed: true,
        agreed_timeframes: timeframes,
        auditor_signature: auditorSig,
        auditor_signed_name: user?.name || 'Auditor',
        auditee_signature: auditeeSig,
        auditee_signed_name: auditeeName.trim(),
        notes: notes.trim() || undefined,
      });
      if (res.queued) {
        Alert.alert(
          'Saved offline',
          'The signatures are on the device. The findings lock when this syncs.',
          [{ text: 'OK', onPress: () => navigation.navigate('AuditDetail', { auditId }) }],
        );
        return;
      }
      navigation.replace('AuditReport', { auditId, audit: res.data ?? audit });
    } catch (e: any) {
      Alert.alert('Could not close the meeting', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title="Closing meeting" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title="Closing meeting"
        subtitle={`Step 08 · ${audit?.audit_ref ?? ''}`}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {locked ? (
            <Banner
              tone="ok" icon="lock-closed"
              title="Findings locked"
              text={`Confirmed by ${audit?.auditee_signed_name ?? 'the supervisor'} on ${fmt(audit?.auditee_confirmed_at)}. They can now only change through a formal amendment.`}
            />
          ) : (
            <Banner
              tone="info" icon="people"
              title="The supervisor sees this screen"
              text="Present the findings, let them correct any factual error, then both sign. After this, findings lock."
            />
          )}

          {/* The result, as presented */}
          <View style={styles.scoreCard}>
            <ScoreRing
              score={audit?.compliance_score ?? 0}
              band={audit?.score_band ?? 'poor'}
              size={92}
            />
            <View style={{ flex: 1, gap: 8 }}>
              <RatingChip value={audit?.overall_rating} />
              <Text style={styles.scoreNote}>
                {ncs.length} non-conformance{ncs.length === 1 ? '' : 's'} to action ·{' '}
                {audit?.finding_counts?.conformance ?? 0} conformance
                {(audit?.finding_counts?.conformance ?? 0) === 1 ? '' : 's'} recorded
              </Text>
            </View>
          </View>

          {/* 1 · present the findings */}
          <SectionLabel>1 · Findings presented</SectionLabel>
          <Card>
            {findings.length ? findings.map((f) => (
              <View key={f.id} style={styles.findRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.findTitle}>{f.title}</Text>
                  {!!f.description && <Text style={styles.findDesc} numberOfLines={2}>{f.description}</Text>}
                  <Text style={styles.findMeta}>{f.finding_ref} · {f.section ?? 'General'}</Text>
                </View>
                <ClassificationChip value={f.classification} small repeat={f.is_repeat} />
              </View>
            )) : <Empty icon="pricetags-outline" text="Nothing classified yet." />}

            {!locked && (
              <TouchableOpacity style={styles.checkRow} onPress={() => setPresented((v) => !v)} activeOpacity={0.8}>
                <View style={[styles.check, presented && styles.checkOn]}>
                  {presented && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                </View>
                <Text style={styles.checkText}>
                  I have presented every finding to the supervisor on this screen
                </Text>
              </TouchableOpacity>
            )}
          </Card>

          {/* 2 · agreed timeframes */}
          {ncs.length > 0 && (
            <>
              <SectionLabel>2 · Corrective action timeframes agreed</SectionLabel>
              <Card subtitle="Agreed here, in front of the supervisor. These become the deadlines on the corrective actions.">
                {ncs.map((f) => (
                  <View key={f.id} style={styles.tfRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tfTitle} numberOfLines={2}>{f.title}</Text>
                      <Text style={styles.tfDefault}>
                        {CLASSIFICATION_META[f.classification].label} — standard{' '}
                        {CLASSIFICATION_META[f.classification].actionDays} days
                      </Text>
                    </View>
                    <TextInput
                      style={styles.dateInput}
                      value={timeframes[String(f.id)] ?? ''}
                      onChangeText={(t) => setTimeframes((p) => ({ ...p, [String(f.id)]: t }))}
                      editable={!locked}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={C.light}
                    />
                  </View>
                ))}
              </Card>
            </>
          )}

          {/* 3 · factual accuracy */}
          <SectionLabel>3 · Factual accuracy</SectionLabel>
          <Card subtitle="The supervisor's opportunity to correct a factual error before anything is fixed.">
            {locked ? (
              <View style={styles.confirmedRow}>
                <Ionicons name="checkmark-circle" size={18} color="#047857" />
                <Text style={styles.confirmedText}>
                  Confirmed factually accurate by {audit?.auditee_signed_name}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  style={[styles.bigChoice, confirmed === true && styles.bigChoiceOk]}
                  onPress={() => setConfirmed(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-circle" size={20} color={confirmed === true ? '#047857' : C.light} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bigChoiceTitle, confirmed === true && { color: '#047857' }]}>
                      Confirmed factually accurate
                    </Text>
                    <Text style={styles.bigChoiceSub}>Both parties sign and the findings lock.</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bigChoice, confirmed === false && styles.bigChoiceBad]}
                  onPress={() => setConfirmed(false)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="alert-circle" size={20} color={confirmed === false ? '#B91C1C' : C.light} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bigChoiceTitle, confirmed === false && { color: '#B91C1C' }]}>
                      A finding is factually wrong
                    </Text>
                    <Text style={styles.bigChoiceSub}>Nothing locks. Correct it and meet again.</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </Card>

          {/* Dispute path */}
          {confirmed === false && !locked && (
            <>
              <SectionLabel>What is disputed</SectionLabel>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={disputes} onChangeText={setDisputes}
                multiline
                placeholder="What the supervisor says is factually wrong, and about which finding."
                placeholderTextColor={C.light}
              />
              <PrimaryButton
                label="Record dispute — do not lock"
                icon="alert-circle"
                tone="danger"
                onPress={submitDispute}
                loading={busy}
              />
              <View style={{ height: 40 }} />
            </>
          )}

          {/* Signature path */}
          {confirmed === true && !locked && (
            <>
              <SectionLabel>Attendees</SectionLabel>
              <Card>
                <View style={styles.addRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={attendee} onChangeText={setAttendee}
                    onSubmitEditing={addAttendee} returnKeyType="done"
                    placeholder="Name and role"
                    placeholderTextColor={C.light}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={addAttendee}>
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                {attendees.length > 0 && (
                  <View style={styles.pills}>
                    {attendees.map((a) => (
                      <TouchableOpacity key={a} style={styles.pill} onPress={() => setAttendees((p) => p.filter((x) => x !== a))}>
                        <Text style={styles.pillText}>{a}</Text>
                        <Ionicons name="close" size={12} color={C.mid} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Card>

              <SectionLabel>Notes (optional)</SectionLabel>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={notes} onChangeText={setNotes}
                multiline
                placeholder="Anything agreed in the meeting"
                placeholderTextColor={C.light}
              />

              <SectionLabel>4 · Both signatures, on the device</SectionLabel>
              <Card>
                <SignaturePad
                  label="Auditor"
                  signerName={user?.name || 'Auditor'}
                  onChange={setAuditorSig}
                />
                <Text style={styles.sigLabel}>AUDITEE — WHO IS SIGNING</Text>
                <TextInput
                  style={styles.input}
                  value={auditeeName} onChangeText={setAuditeeName}
                  placeholder="Supervisor's name"
                  placeholderTextColor={C.light}
                />
                <SignaturePad
                  label="Auditee — supervisor of the area"
                  signerName={auditeeName || 'Supervisor'}
                  onChange={setAuditeeSig}
                />
              </Card>

              {!presented && (
                <Banner
                  tone="warn" icon="eye"
                  title="Findings not marked as presented"
                  text="Tick the box above once the supervisor has seen every finding on this screen."
                />
              )}

              <PrimaryButton
                label="Confirm & lock the findings"
                icon="lock-closed"
                onPress={submitConfirmed}
                loading={busy}
                disabled={!presented || !auditorSig || !auditeeSig}
              />
              <Text style={styles.finalNote}>
                After this, findings can only change through a formal amendment.
              </Text>
              <View style={{ height: 40 }} />
            </>
          )}

          {locked && (
            <>
              <PrimaryButton
                label="Go to the report"
                icon="document-text"
                onPress={() => navigation.navigate('AuditReport', { auditId, audit })}
              />
              <View style={{ height: 40 }} />
            </>
          )}
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
    borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12,
  },
  scoreNote: { fontSize: 11, color: C.muted, fontWeight: '600', lineHeight: 15.5 },

  findRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  findTitle: { fontSize: 12.5, fontWeight: '800', color: C.ink, lineHeight: 17 },
  findDesc: { fontSize: 11, color: C.mid, fontWeight: '600', lineHeight: 15.5, marginTop: 3 },
  findMeta: { fontSize: 10, fontWeight: '700', color: C.light, marginTop: 3 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13 },
  check: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
  },
  checkOn: { backgroundColor: C.brand, borderColor: C.brand },
  checkText: { flex: 1, fontSize: 12, fontWeight: '700', color: C.ink, lineHeight: 16 },

  tfRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  tfTitle: { fontSize: 12, fontWeight: '700', color: C.ink, lineHeight: 16 },
  tfDefault: { fontSize: 10, fontWeight: '600', color: C.light, marginTop: 2 },
  dateInput: {
    width: 108, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: C.border,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 11.5,
    color: C.ink, fontWeight: '700', textAlign: 'center',
  },

  bigChoice: {
    flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1.5,
    borderColor: C.border, borderRadius: 12, padding: 13, backgroundColor: '#FFFFFF',
  },
  bigChoiceOk: { borderColor: '#A7F3D0', backgroundColor: '#F0FDF9' },
  bigChoiceBad: { borderColor: '#FECACA', backgroundColor: '#FFFBFB' },
  bigChoiceTitle: { fontSize: 13, fontWeight: '800', color: C.mid },
  bigChoiceSub: { fontSize: 10.5, fontWeight: '600', color: C.muted, marginTop: 2 },

  confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmedText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: '#047857' },

  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, borderRadius: 11,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, color: C.ink,
    fontWeight: '600', marginBottom: 12,
  },
  multiline: { minHeight: 76, textAlignVertical: 'top', lineHeight: 19 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBtn: {
    width: 42, height: 42, borderRadius: 11, backgroundColor: C.brand,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F1F5F9',
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6,
  },
  pillText: { fontSize: 11.5, fontWeight: '700', color: C.mid },

  sigLabel: {
    fontSize: 11, fontWeight: '800', color: C.muted, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 8,
  },
  finalNote: { fontSize: 11, color: C.muted, fontWeight: '600', textAlign: 'center', marginTop: 10, lineHeight: 15 },
});

export default ClosingMeetingScreen;
