import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { KEYBOARD_BEHAVIOR } from '../../components/layout/KeyboardAvoider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Calendar, Camera } from 'lucide-react-native';
import type { ScreenProps } from './types';
import {
  incidentWorkflowService,
  type IncidentNextAction,
} from '../../services/incidentWorkflowService';
import { IncidentRecordCard } from '../../components/workflow/IncidentRecordCard';
import { ReportClosureModal, type ClosureFormValues } from './ReportClosureModal';


const SEV: Record<string, { color: string; bg: string }> = {
  Critical: { color: '#DC2626', bg: '#FEE2E2' },
  High: { color: '#EA580C', bg: '#FFEDD5' },
  Medium: { color: '#2563EB', bg: '#DBEAFE' },
  Low: { color: '#16A34A', bg: '#DCFCE7' },
};

export function MgrInvestigation({ setCurrentScreen, selectedIncident, showToast }: ScreenProps) {
  const inc: any = selectedIncident || {};
  const [findings, setFindings] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [closing, setClosing] = useState(false);
  const [nextInfo, setNextInfo] = useState<IncidentNextAction | null>(null);
  const [signingCapa, setSigningCapa] = useState<number | null>(null);
  // Bumped after any write so the detail and the tracker refetch together —
  // a stale tracker saying "sign off the CAPA" after you just did is exactly
  // the confusion this screen is meant to remove.
  const [version, setVersion] = useState(0);

  const sev = SEV[inc.severity] || SEV.High;

  /**
   * Load what the supervisor actually submitted.
   *
   * The screen previously rendered five empty "Why" boxes, so a manager
   * reviewing an investigation saw none of it and was implicitly asked to redo
   * the analysis from scratch. Approving work you cannot see is not a review.
   */
  useEffect(() => {
    let cancelled = false;
    if (!inc.id) { setLoading(false); return; }

    incidentWorkflowService.getDetail(String(inc.id))
      .then((d: any) => {
        if (cancelled) return;
        setDetail(d);
        // The 5 Whys are rendered read-only by IncidentRecordCard now, so the
        // only thing this screen still edits is the manager's own note.
        setFindings(d?.immediate_actions_taken || '');
      })
      .catch(() => { /* leave the form empty — the header still shows the incident */ })
      .finally(() => { if (!cancelled) setLoading(false); });

    // The stage tracker is a separate call on purpose: it must still render
    // when the detail fetch fails, because "where is this and what is owed" is
    // the one thing the manager always needs.
    incidentWorkflowService.getNextAction(inc.id)
      .then((n) => { if (!cancelled) setNextInfo(n); })
      .catch(() => { if (!cancelled) setNextInfo(null); });

    return () => { cancelled = true; };
  }, [inc.id, version]);

  /**
   * Sign off a corrective action from the incident itself.
   *
   * Previously the only route was Manager Tools → Compliance Sign-off, a flat
   * list of every open CAPA in the organisation that had to be scrolled to find
   * the one holding this incident. The action that unblocks an incident belongs
   * on the incident.
   */
  const signOffCapa = async (capaId: number, rating = 4) => {
    try {
      setSigningCapa(capaId);
      const res: any = await incidentWorkflowService.completeCapaAction(capaId, rating);
      showToast?.(
        res?.incident_advanced_to
          ? `CAPA-${capaId} closed — incident moved to ${res.incident_advanced_to.replace('_', ' ')}`
          : `CAPA-${capaId} closed`,
      );
      setVersion((v) => v + 1);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Could not sign off this action.');
    } finally {
      setSigningCapa(null);
    }
  };


  /**
   * Approve the supervisor's investigation — the sign-off that ends stage 04
   * INVESTIGATE. This is a verdict on the root cause analysis, not on whether
   * the fix worked; that is stage 06 and lives in `verify` below.
   *
   * Where the incident goes next is the backend's call: IMPROVE if corrective
   * actions are outstanding, VERIFY if they are already done, LEARN if the
   * investigation raised none.
   *
   * This used to call `investigate` — the supervisor's own endpoint — which
   * overwrote their root cause with whatever the manager typed and never
   * advanced the incident. It then swallowed every error and reported success
   * regardless, so an incident could sit in `pending_approval` forever while
   * the manager believed they had signed it off.
   *
   * It now calls the manager endpoint, and a failure is surfaced instead of
   * being hidden behind a success toast.
   */
  const approve = async () => {
    try {
      setSubmitting(true);
      await incidentWorkflowService.approveInvestigation(String(inc.id), {
        decision: 'approved',
        notes: findings || undefined,
      });
      showToast?.('Investigation approved');
      setCurrentScreen('assign_actions');
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (e?.message || 'Unknown error');
      Alert.alert('Approval failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Send it back for rework (stage 06, the other outcome). The backend returns
   * the incident to `under_investigation` and clears the completion timestamp.
   */
  const reject = async () => {
    if (!findings.trim()) {
      return Alert.alert('Reason needed', 'Record what is missing before returning this to the supervisor.');
    }
    try {
      setSubmitting(true);
      await incidentWorkflowService.approveInvestigation(String(inc.id), {
        decision: 'rejected',
        notes: findings,
      });
      showToast?.('Returned to supervisor for rework');
      setCurrentScreen('app');
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (e?.message || 'Unknown error');
      Alert.alert('Could not return investigation', msg);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Stage 06 VERIFY — "Confirm it worked".
   *
   * Answering no is not a paperwork rejection: the backend returns the incident
   * to IMPROVE and reopens its corrective actions, because a control that did
   * not hold means the unsafe act is still live.
   */
  const verify = async (effective: boolean) => {
    if (!effective && !findings.trim()) {
      return Alert.alert(
        'Reason needed',
        'Record what was checked and why the action did not hold before sending this back.',
      );
    }
    try {
      setSubmitting(true);
      await incidentWorkflowService.verifyEffectiveness(String(inc.id), {
        effective,
        verification_notes: findings || undefined,
      });
      showToast?.(effective ? 'Corrective action verified' : 'Sent back — corrective action reopened');
      setCurrentScreen('app');
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      Alert.alert('Verification failed', typeof d === 'string' ? d : (e?.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Stage 08 CLOSE. Until now no wired screen called this for an incident —
   * `close` existed only in InvestigationScreen.tsx, which ManagerAppRoot
   * imports but never renders, so an incident could reach the end of the
   * workflow with no way to finish it.
   */
  const submitClosure = async (values: ClosureFormValues) => {
    setClosing(false);
    try {
      setSubmitting(true);
      await incidentWorkflowService.close(String(inc.id), {
        closure_notes: values.closure_notes,
        lessons_learned: values.lessons_learned,
        regulatory_notified: detail?.statutory_authorised_at ? 'Yes' : 'No',
        communicated_to_teams: 'Yes',
      });
      showToast?.('Incident closed');
      setCurrentScreen('app');
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      Alert.alert('Could not close', typeof d === 'string' ? d : (e?.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  // Drive the buttons off the status the server reports, not off what the
  // manager navigated from — the incident may have moved since the queue loaded.
  const status: string = detail?.workflow_status || inc.workflow_status || '';
  const awaitingRcaApproval = ['pending_approval', 'escalated'].includes(status);
  const awaitingVerification = status === 'pending_verification';
  const capaOutstanding = status === 'capa_open';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentScreen('app')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color="#0B3D91" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Investigation</Text>
        <View style={styles.mgrBadge}><Text style={styles.mgrBadgeText}>HSE MANAGER</Text></View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Incident card */}
          <View style={[styles.incCard, { borderLeftColor: sev.color }]}>
            <View style={styles.incTop}>
              <Text style={styles.incRef}>{inc.ref || `INC-${inc.id ?? ''}`}</Text>
              <View style={[styles.sevBadge, { backgroundColor: sev.bg }]}>
                <Text style={[styles.sevText, { color: sev.color }]}>{(inc.severity || 'HIGH').toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.incTitle}>{inc.title || inc.message || 'Incident'}</Text>
            <View style={styles.incMetaRow}>
              <View style={styles.metaItem}><Calendar size={13} color="#737686" /><Text style={styles.metaText}>{inc.time || inc.date || '—'}</Text></View>
              {!!(inc.zone || inc.location) && <View style={styles.metaItem}><MapPin size={13} color="#737686" /><Text style={styles.metaText}>{inc.zone || inc.location}</Text></View>}
            </View>
            <View style={styles.statusPill}><Text style={styles.statusText}>{status || inc.status || 'IN INVESTIGATION'}</Text></View>
          </View>



          {/* The whole record: what the worker reported (with photos), what the
              engine assessed, and what the supervisor concluded — including the
              CAPA being signed off. The manager previously saw the verdict and
              five blank "Why" boxes, i.e. was asked to re-type an analysis
              already submitted, with none of the reporter's account on screen. */}
          {loading && <ActivityIndicator color="#0B3D91" style={{ marginBottom: 8 }} />}
          {!!detail && <IncidentRecordCard incident={detail} />}

          {/* Findings */}
          <Text style={styles.section}>Investigation Findings</Text>
          <TextInput
            style={styles.findings}
            placeholder="Document investigation findings and final conclusions here..."
            placeholderTextColor="#94A3B8"
            value={findings}
            onChangeText={setFindings}
            multiline
          />

          {/* Actions — whichever of the manager's two sign-offs this incident
              is actually waiting on. Offering both at once is how approving an
              RCA got mistaken for confirming the fix worked.
              "Save Draft" was removed: it only ever raised a toast and saved
              nothing, which is worse than not offering it. */}
          {awaitingRcaApproval && (
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.draftBtn} onPress={reject} disabled={submitting}>
                <Text style={styles.draftText}>Return for rework</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.assignBtn} onPress={approve} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.assignText}>Approve investigation →</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Stage 05 IMPROVE. The manager can close these here rather than
              hunting for them in the org-wide Compliance Sign-off list. */}
          {capaOutstanding && (() => {
            const capas: any[] = detail?.capa_actions ?? [];
            const open = capas.filter(
              (c) => String(c.status || '').toLowerCase() !== 'completed',
            );
            return (
              <View style={styles.waitCard}>
                <Text style={styles.waitTitle}>
                  Stage 05 · Corrective action{open.length === 1 ? '' : 's'} outstanding
                </Text>
                <Text style={styles.waitText}>
                  {open.length > 0
                    ? 'Closing the last open action moves this incident to 06 VERIFY.'
                    : 'This incident returns for effectiveness verification once the assigned person completes the action.'}
                </Text>

                {open.map((c) => (
                  <View key={c.id} style={styles.capaRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.capaRef}>CAPA-{c.id}</Text>
                      <Text style={styles.capaDesc} numberOfLines={2}>
                        {c.description || 'No description'}
                      </Text>
                      <Text style={styles.capaMeta}>
                        {[c.responsible_person_name, c.due_date && `due ${c.due_date}`, c.status]
                          .filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.capaBtn}
                      onPress={() => signOffCapa(c.id)}
                      disabled={signingCapa === c.id}
                    >
                      {signingCapa === c.id
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.capaBtnText}>Sign off</Text>}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })()}

          {awaitingVerification && (
            <>
              <View style={styles.waitCard}>
                <Text style={styles.waitTitle}>Stage 06 · Confirm it worked</Text>
                <Text style={styles.waitText}>
                  The corrective action is complete. Record what you checked in the findings box
                  above, then confirm whether it held. Answering no reopens the action.
                </Text>
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.draftBtn} onPress={() => verify(false)} disabled={submitting}>
                  <Text style={styles.draftText}>Did not hold</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.assignBtn} onPress={() => verify(true)} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.assignText}>Verify effective →</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}

          {status === 'approved' && (
            <>
              <View style={styles.waitCard}>
                <Text style={styles.waitTitle}>Stage 07 · Capture the lesson, then close</Text>
                <Text style={styles.waitText}>
                  Verified effective. Closing updates the linked hazard, the training gap, the
                  inspection schedule and the learning corpus.
                </Text>
              </View>
              <TouchableOpacity style={styles.closeOutBtn} onPress={() => setClosing(true)} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.assignText}>Close incident →</Text>}
              </TouchableOpacity>
            </>
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <ReportClosureModal
        visible={closing}
        reportLabel={inc.ref || `INC-${inc.id ?? ''}`}
        isSubmitting={submitting}
        onCancel={() => setClosing(false)}
        onSubmit={submitClosure}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F7FC' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0B3D91', flex: 1 },
  mgrBadge: { backgroundColor: '#0B3D91', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  mgrBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 40 },
  incCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderLeftWidth: 4, borderWidth: 1, borderColor: '#EEF2F7', marginBottom: 20 },
  closeOutBtn: { backgroundColor: '#059669', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  waitCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  waitTitle: { fontSize: 13, fontWeight: '800', color: '#0B3D91', marginBottom: 4 },
  waitText: { fontSize: 12, color: '#434655', lineHeight: 17 },
  capaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF2F7',
  },
  capaRef: { fontSize: 11, fontWeight: '800', color: '#4338CA' },
  capaDesc: { fontSize: 12, fontWeight: '600', color: '#0B1C30', marginTop: 1 },
  capaMeta: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  capaBtn: {
    backgroundColor: '#0B3D91', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    minWidth: 78, alignItems: 'center',
  },
  capaBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  incTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  incRef: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  sevText: { fontSize: 10, fontWeight: '800' },
  incTitle: { fontSize: 18, fontWeight: '800', color: '#0B1C30', marginTop: 6, marginBottom: 10 },
  incMetaRow: { flexDirection: 'row', gap: 16, marginBottom: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: '#737686' },
  statusPill: { backgroundColor: '#EAF0FB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  verdictCard: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, marginTop: 16, gap: 6 },
  verdictRow: { fontSize: 13, color: '#475569' },
  verdictValue: { fontWeight: '700', color: '#0B1C30' },
  verdictFlag: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  verdictAlert: { fontSize: 12, fontWeight: '700', color: '#B91C1C', lineHeight: 17 },
  reviewNote: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  statusText: { fontSize: 12, fontWeight: '700', color: '#0B3D91' },
  section: { fontSize: 16, fontWeight: '800', color: '#0B1C30', marginBottom: 12, marginTop: 4 },
  whyRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  whyNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#0B3D91', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  whyNumText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  whyQ: { fontSize: 12, color: '#63739B', marginBottom: 6, fontWeight: '600' },
  whyInput: { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, fontSize: 14, color: '#0B1C30', minHeight: 46, textAlignVertical: 'top' },
  uploadBox: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CBD5E1', padding: 20, alignItems: 'center', gap: 8, marginBottom: 20 },
  uploadText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  findings: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, fontSize: 14, color: '#0B1C30', minHeight: 100, textAlignVertical: 'top', marginBottom: 20 },
  btnRow: { flexDirection: 'row', gap: 12 },
  draftBtn: { flex: 1, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingVertical: 15, alignItems: 'center', backgroundColor: '#FFFFFF' },
  draftText: { fontSize: 14, fontWeight: '700', color: '#0B1C30' },
  assignBtn: { flex: 1.6, backgroundColor: '#0B3D91', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  assignText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
});
