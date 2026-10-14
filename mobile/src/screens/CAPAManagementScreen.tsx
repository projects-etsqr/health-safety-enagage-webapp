import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert, Image, Modal } from 'react-native';
import { SafeAreaScreen } from '../components/layout/KeyboardAvoider';
import { Ionicons } from '@expo/vector-icons';
import { incidentWorkflowService, type CapaAction } from '../services/incidentWorkflowService';
import { IncidentRecordCard } from '../components/workflow/IncidentRecordCard';
import { API_BASE_URL } from '../constants/config';
import { Colors } from '../theme/colors';
import { DateTimePickerModal } from '../worker/components/inputs/DateTimePickerModal';

/**
 * Evidence is stored as a server path (/uploads/incidents/<uuid>.jpg), not a
 * full URL, so it survives the host changing. The image host is the API host
 * minus the /api/v1 suffix — the files are mounted at the server root, outside
 * the API prefix.
 */


// WF-03 Q2 — the treatment levels the backend's decision tree understands.
type TreatmentLevel = 'none' | 'first_aid' | 'medical_treatment' | 'hospitalisation' | 'fatality';

const TREATMENT_LEVELS: Array<{ value: TreatmentLevel; label: string }> = [
  { value: 'none', label: 'No treatment' },
  { value: 'first_aid', label: 'First aid only' },
  { value: 'medical_treatment', label: 'Medical treatment' },
  { value: 'hospitalisation', label: 'Hospitalised / >3 days lost' },
  { value: 'fatality', label: 'Fatality / life-altering' },
];

const LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/**
 * Map the WF-03 treatment level onto the legacy LTI/MTI/First Aid taxonomy that
 * `incidents.severity_classification` still carries for the website.
 *
 * The authoritative classification is now `severity_priority` (P1-P5), which
 * the backend derives itself from `treatment_level`. This mapping exists only
 * so the older column stays consistent rather than being stamped 'First Aid'
 * on every incident as it was before.
 */
function severityClassificationFor(treatmentLevel: string): string {
  switch (treatmentLevel) {
    case 'fatality':
    case 'hospitalisation':
      return 'LTI';
    case 'medical_treatment':
      return 'MTI';
    case 'first_aid':
      return 'First Aid';
    default:
      return 'Near Miss';
  }
}

export function CAPAManagementScreen({ route, navigation }: any) {
  const incidentId = route.params?.incidentId;

  // Real data state
  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Open CAPA actions (list view, no incidentId)
  const [capaActions, setCapaActions] = useState<CapaAction[]>([]);
  const [capaLoading, setCapaLoading] = useState(false);
  const [completingId, setCompletingId] = useState<number | null>(null);

  // Form inputs
  const [why1, setWhy1] = useState('');
  const [why2, setWhy2] = useState('');
  const [why3, setWhy3] = useState('');
  const [why4, setWhy4] = useState('');
  const [why5, setWhy5] = useState('');
  const [immediateCause, setImmediateCause] = useState('');
  const [immediateActions, setImmediateActions] = useState('');
  const [capaDesc, setCapaDesc] = useState('');
  // Empty, not '15'. That default was employee 15 -- a real person in
  // organisation 1 -- so every supervisor in every other organisation
  // submitted an investigation naming somebody outside their tenant and got
  // "No such employee" back, and a supervisor inside org 1 silently assigned
  // the corrective action to a stranger. Blank means the CAPA is created
  // unassigned, which the backend allows.
  const [capaAssigneeId, setCapaAssigneeId] = useState('');
  // Empty on purpose. This used to ship a hardcoded '2026-07-31', which was in
  // the past for most of the year, so every CAPA raised from the app was born
  // overdue. Left blank the backend applies the WF-04 rule instead: P1 24h,
  // P2 7 days, P3 30 days, P4 60 days, P5 90 days from the CAPA's type.
  const [capaDueDate, setCapaDueDate] = useState('');
  const [dueDatePickerVisible, setDueDatePickerVisible] = useState(false);

  // ── WF-03 decision tree · Q2-Q4 ────────────────────────────────────────────
  // The reporter rarely knows the clinical outcome, so the investigation is
  // where P1-P5 actually settles. Without these the backend cannot classify and
  // the incident stays "Unclassified" through the whole lifecycle.
  const [treatmentLevel, setTreatmentLevel] = useState<TreatmentLevel | ''>('');
  const [daysAway, setDaysAway] = useState('');
  const [dangerousOccurrence, setDangerousOccurrence] = useState(false);
  const [worstCaseFatal, setWorstCaseFatal] = useState(false);
  const [rootCauseCategory, setRootCauseCategory] = useState('');

  // ── WF-04 priority matrix inputs ───────────────────────────────────────────
  const [capaSeverityPotential, setCapaSeverityPotential] = useState('');
  const [capaSystemicRisk, setCapaSystemicRisk] = useState('');

  useEffect(() => {
    if (incidentId) {
      fetchIncidentDetails();
    } else {
      fetchCapaActions();
    }
  }, [incidentId]);

  const fetchCapaActions = () => {
    setCapaLoading(true);
    incidentWorkflowService.getMyCapaActions()
      .then(setCapaActions)
      .catch(() => setCapaActions([]))
      .finally(() => setCapaLoading(false));
  };

  const handleCompleteCapa = (capaId: number) => {
    setCompletingId(capaId);
    incidentWorkflowService.completeCapaAction(capaId)
      .then(() => {
        setCapaActions((prev) => prev.filter((c) => c.id !== capaId));
        Alert.alert('Closed', 'Corrective action marked complete.');
      })
      .catch(() => Alert.alert('Failed', 'Could not close this action — please try again.'))
      .finally(() => setCompletingId(null));
  };

  const fetchIncidentDetails = async () => {
    setLoading(true);
    try {
      const data = await incidentWorkflowService.getDetail(incidentId);
      setIncident(data);
      // Pre-fill form if already investigated
      if (data.root_cause) {
        setImmediateCause(data.immediate_cause || '');
        setImmediateActions(data.immediate_actions_taken || '');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load incident details from database.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    setSubmitting(true);
    try {
      await incidentWorkflowService.acknowledge(incidentId);
      Alert.alert('Acknowledged', 'Incident acknowledged successfully!');
      fetchIncidentDetails();
    } catch (e: any) {
      console.log('Acknowledge Error:', e);
      const detail = e.response?.data?.detail;
      const errMsg = typeof detail === 'string' ? detail : (typeof detail === 'object' && detail !== null ? JSON.stringify(detail) : (e.message || 'Unknown error'));
      Alert.alert('Error', `Acknowledge request failed: ${errMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Stage 03 -> 04. Opening the investigation is a distinct act from
   * submitting its findings: it starts the SLA the WF-03 classification set and
   * puts the incident visibly in INVESTIGATE while the work is happening.
   */
  const handleStartInvestigation = async () => {
    setSubmitting(true);
    try {
      await incidentWorkflowService.startInvestigation(incidentId);
      fetchIncidentDetails();
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      const errMsg = typeof detail === 'string' ? detail : (e.message || 'Unknown error');
      Alert.alert('Error', `Could not open the investigation: ${errMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitInvestigation = async () => {
    if (!why1.trim()) {
      Alert.alert('Required', 'Please fill at least the first "Why".');
      return;
    }
    // Blocked rather than defaulted: guessing the treatment level would set the
    // wrong P1-P5, the wrong investigation deadline and, for a reportable
    // injury, the wrong regulator clock.
    if (!treatmentLevel) {
      Alert.alert('Required', 'Select the highest level of treatment — it decides the incident severity and any statutory deadline.');
      return;
    }
    setSubmitting(true);
    const payload = {
      root_cause: why5.trim() || why1.trim(),
      five_why_analysis: [
        { why: 'Why 1', answer: why1 },
        { why: 'Why 2', answer: why2 },
        { why: 'Why 3', answer: why3 },
        { why: 'Why 4', answer: why4 },
        { why: 'Why 5', answer: why5 },
      ].filter(item => item.answer.trim() !== ''),
      immediate_cause: immediateCause,
      immediate_actions_taken: immediateActions,
      // These three were hardcoded to 'Equipment Failure', 'First Aid' and 0.
      // Every investigation submitted from the app therefore told the backend
      // the injury was a first-aid case with no days lost — including
      // hospitalisations and fatalities — which suppressed the severity, the
      // investigation SLA and the statutory deadline.
      root_cause_category: rootCauseCategory || undefined,
      severity_classification: severityClassificationFor(treatmentLevel),
      days_away: daysAway === '' ? undefined : parseInt(daysAway, 10),
      // WF-03 Q2-Q4 — what the backend needs to resolve P1-P5.
      treatment_level: treatmentLevel || undefined,
      dangerous_occurrence: dangerousOccurrence,
      worst_case_fatal: worstCaseFatal,
      capa_description: capaDesc,
      // Omitted when nobody is chosen, never defaulted. This was `|| 15`, a
      // hardcoded employee id that belongs to organisation 1 -- so every
      // submission from any other organisation failed the backend's owner
      // check with "No such employee", and a submission from org 1 quietly
      // assigned the corrective action to a stranger. The backend skips the
      // ownership check entirely when this is absent.
      ...(Number.isFinite(parseInt(capaAssigneeId, 10))
        ? { capa_responsible_person_id: parseInt(capaAssigneeId, 10) }
        : {}),
      // Omitted when blank so WF-04's due-date rule applies.
      capa_due_date: capaDueDate || undefined,
      capa_severity_potential: capaSeverityPotential || undefined,
      capa_systemic_risk: capaSystemicRisk || undefined,
      escalate: false,
    };

    try {
      await incidentWorkflowService.investigate(incidentId, payload);
      Alert.alert('Success', 'RCA Investigation & CAPA plan submitted to Manager!');
      navigation.goBack();
    } catch (e: any) {
      console.log('RCA Submit Error:', e);
      const detail = e.response?.data?.detail;
      const errMsg = typeof detail === 'string' ? detail : (typeof detail === 'object' && detail !== null ? JSON.stringify(detail) : (e.message || 'Unknown error'));
      Alert.alert('Error', `Failed to submit investigation: ${errMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // If no incidentId, list this user's open CAPA actions with a way to close them out.
  // The website's CAPA Closure Rate can only move through this "Mark Complete" action.
  if (!incidentId) {
    return (
      <SafeAreaScreen style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0B1C30" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Corrective Actions (CAPA)</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {capaLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 30 }} />
          ) : capaActions.length === 0 ? (
            <Text style={styles.sub}>No open corrective actions right now.</Text>
          ) : (
            capaActions.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.title}>{c.description || c.action_type || `CAPA-${c.id}`}</Text>
                  {c.due_date && (
                    <View style={styles.pBadge}>
                      <Text style={styles.pBadgeText}>{c.due_date}</Text>
                    </View>
                  )}
                </View>
                {c.incident_id != null && <Text style={styles.sub}>From incident INC-{c.incident_id}</Text>}
                <TouchableOpacity
                  style={[styles.submitBtn, { marginTop: 10 }, completingId === c.id && { opacity: 0.6 }]}
                  onPress={() => handleCompleteCapa(c.id)}
                  disabled={completingId === c.id}
                >
                  {completingId === c.id ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.submitBtnText}>Mark Complete</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaScreen>
    );
  }

  // Real-time API detail view
  return (
    <SafeAreaScreen style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review & Investigate</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching incident from server...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Incident Summary */}
          {incident && (
            <View style={styles.detailCard}>
              <View style={styles.row}>
                <Text style={styles.incidentRef}>INC-{incident.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: incident.workflow_status === 'reported' ? '#FEF2F2' : '#EFF6FF' }]}>
                  <Text style={[styles.statusText, { color: incident.workflow_status === 'reported' ? '#EF4444' : '#3B82F6' }]}>
                    {incident.workflow_status?.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.detailType}>Type: {incident.incident_type?.toUpperCase()}</Text>
              <Text style={styles.detailDesc}>Description: {incident.description || 'No description provided.'}</Text>

              <IncidentRecordCard incident={incident} />

            </View>
          )}

          {/* Action Step 1: Acknowledge */}
          {incident && incident.workflow_status === 'reported' && (
            <View style={styles.actionSection}>
              <Text style={styles.sectionHeading}>Step 1: Acknowledge Incident</Text>
              <Text style={styles.sectionDesc}>Confirm scene assessment and take initial control.</Text>
              <TouchableOpacity style={styles.actionButton} onPress={handleAcknowledge} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="eye-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.actionButtonText}>Acknowledge Now</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Action Step 2: open the investigation (stage 03 -> 04) */}
          {incident && incident.workflow_status === 'acknowledged' && (
            <View style={styles.actionSection}>
              <Text style={styles.sectionHeading}>Step 2: Open Investigation</Text>
              <Text style={styles.sectionDesc}>
                Starts the investigation clock. The root cause form opens once this incident is
                formally under investigation.
              </Text>
              <TouchableOpacity style={styles.actionButton} onPress={handleStartInvestigation} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="search-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.actionButtonText}>Start Investigation</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Past the supervisor's hands — say who has it rather than showing a
              form the backend will reject. */}
          {incident && ['pending_approval', 'escalated', 'capa_open', 'pending_verification', 'approved', 'closed'].includes(incident.workflow_status) && (
            <View style={styles.actionSection}>
              <Text style={styles.sectionHeading}>
                {incident.workflow_status === 'capa_open'
                  ? 'Corrective action in progress'
                  : incident.workflow_status === 'closed'
                    ? 'Closed'
                    : 'With the manager'}
              </Text>
              <Text style={styles.sectionDesc}>
                {incident.stage?.stage_description ||
                  'This incident has moved past the investigation step.'}
              </Text>
            </View>
          )}

          {/* Action Step 3: Investigation & CAPA Form.
              `under_investigation` only. The backend also accepts an
              investigation from `acknowledged`, but showing the form there put
              it on screen next to the Step 2 button telling the supervisor it
              would open once the investigation was started — two contradictory
              instructions at once. Later statuses are excluded because the
              backend rejects them outright with a 400. */}
          {incident && incident.workflow_status === 'under_investigation' && (
            <View style={styles.formContainer}>
              <Text style={styles.sectionHeading}>Step 3: Root Cause & CAPA Plan</Text>

              {/* ── WF-03 severity classification ────────────────────────────
                  These decide P1-P5, the investigation SLA and whether a
                  regulator must be notified. Without them the backend fails
                  safe and leaves the incident unclassified, so they are asked
                  first rather than buried under the RCA. */}
              <Text style={styles.label}>Highest level of treatment *</Text>
              <View style={styles.chipRow}>
                {TREATMENT_LEVELS.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.chip, treatmentLevel === t.value && styles.chipOn]}
                    onPress={() => setTreatmentLevel(t.value)}
                  >
                    <Text style={[styles.chipText, treatmentLevel === t.value && styles.chipTextOn]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Days unable to work</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="number-pad"
                value={daysAway}
                onChangeText={setDaysAway}
              />

              <TouchableOpacity style={styles.checkRow} onPress={() => setDangerousOccurrence(!dangerousOccurrence)}>
                <Ionicons
                  name={dangerousOccurrence ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={dangerousOccurrence ? Colors.primary : '#94A3B8'}
                />
                <Text style={styles.checkText}>Dangerous occurrence (collapse, explosion, major release)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.checkRow} onPress={() => setWorstCaseFatal(!worstCaseFatal)}>
                <Ionicons
                  name={worstCaseFatal ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={worstCaseFatal ? Colors.primary : '#94A3B8'}
                />
                <Text style={styles.checkText}>Could realistically have killed or seriously injured someone (HIPO)</Text>
              </TouchableOpacity>

              {/* 5 Whys Form */}
              <Text style={styles.label}>5 Whys Analysis</Text>
              <TextInput style={styles.input} placeholder="Why 1: What was the direct cause?" placeholderTextColor="#94A3B8" value={why1} onChangeText={setWhy1} />
              <TextInput style={styles.input} placeholder="Why 2: Why did that occur?" placeholderTextColor="#94A3B8" value={why2} onChangeText={setWhy2} />
              <TextInput style={styles.input} placeholder="Why 3: Why was that the case?" placeholderTextColor="#94A3B8" value={why3} onChangeText={setWhy3} />
              <TextInput style={styles.input} placeholder="Why 4: What is the underlying reason?" placeholderTextColor="#94A3B8" value={why4} onChangeText={setWhy4} />
              <TextInput style={styles.input} placeholder="Why 5: What is the root cause?" placeholderTextColor="#94A3B8" value={why5} onChangeText={setWhy5} />

              {/* Causes */}
              <Text style={styles.label}>Immediate Cause</Text>
              <TextInput style={styles.input} placeholder="e.g. Loose seal / Broken bolt" placeholderTextColor="#94A3B8" value={immediateCause} onChangeText={setImmediateCause} />
              
              <Text style={styles.label}>Immediate Actions Taken</Text>
              <TextInput style={styles.input} placeholder="e.g. Area cordoned off" placeholderTextColor="#94A3B8" value={immediateActions} onChangeText={setImmediateActions} />

              {/* CAPA Setup */}
              <Text style={styles.sectionHeading}>Corrective Action (CAPA)</Text>
              <Text style={styles.label}>Action Item Description</Text>
              <TextInput style={[styles.input, { height: 60 }]} placeholder="What corrective action must be completed?" multiline value={capaDesc} onChangeText={setCapaDesc} />
              
              {/* ── WF-04 priority matrix ────────────────────────────────────
                  Severity potential x systemic risk gives the 1-9 score and the
                  Standard/High/Critical band. Without both the CAPA is created
                  unprioritised. */}
              <Text style={styles.label}>Severity potential</Text>
              <View style={styles.chipRow}>
                {LEVELS.map((l) => (
                  <TouchableOpacity
                    key={l.value}
                    style={[styles.chip, capaSeverityPotential === l.value && styles.chipOn]}
                    onPress={() => setCapaSeverityPotential(l.value)}
                  >
                    <Text style={[styles.chipText, capaSeverityPotential === l.value && styles.chipTextOn]}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Systemic risk</Text>
              <View style={styles.chipRow}>
                {LEVELS.map((l) => (
                  <TouchableOpacity
                    key={l.value}
                    style={[styles.chip, capaSystemicRisk === l.value && styles.chipOn]}
                    onPress={() => setCapaSystemicRisk(l.value)}
                  >
                    <Text style={[styles.chipText, capaSystemicRisk === l.value && styles.chipTextOn]}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Responsible Employee ID</Text>
              <TextInput style={styles.input} value={capaAssigneeId} onChangeText={setCapaAssigneeId} keyboardType="numeric" />

              <Text style={styles.label}>CAPA Due Date (YYYY-MM-DD)</Text>
              <TouchableOpacity
                style={[styles.input, { justifyContent: 'center', height: 40 }]}
                onPress={() => setDueDatePickerVisible(true)}
              >
                <Text style={{ fontSize: 13, color: capaDueDate ? '#2D3748' : '#94A3B8' }}>
                  {capaDueDate || 'Select due date'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.hint}>
                Left blank the due date follows the CAPA type: P1 24 h, P2 7 days, P3 30 days, P4 60 days, P5 90 days.
              </Text>

              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitInvestigation} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.submitBtnText}>Submit Investigation to Manager</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <DateTimePickerModal
        visible={dueDatePickerVisible}
        value={capaDueDate ? `${capaDueDate} 00:00` : null}
        title="CAPA Due Date"
        minToday={true}
        onCancel={() => setDueDatePickerVisible(false)}
        onConfirm={(val) => {
          const datePart = val.split(' ')[0]; // Extract "YYYY-MM-DD"
          setCapaDueDate(datePart);
          setDueDatePickerVisible(false);
        }}
      />
    </SafeAreaScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FF' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0B1C30', marginLeft: 12 },
  scroll: { padding: 20, paddingBottom: 60 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 },
  title: { fontSize: 13, fontWeight: '700', color: '#0B1C30', flex: 1 },
  pBadge: { backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pBadgeText: { fontSize: 10, fontWeight: '700', color: '#EF4444' },
  sub: { fontSize: 11, color: '#737686' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  loadingText: { fontSize: 14, color: '#737686', marginTop: 12 },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  incidentRef: { fontSize: 16, fontWeight: '800', color: '#0B1C30' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  detailType: { fontSize: 12, fontWeight: '700', color: '#737686', marginBottom: 8 },
  detailDesc: { fontSize: 14, color: '#4A5568', lineHeight: 20 },
  detailCause: { fontSize: 12, color: '#EF4444', marginTop: 8, fontWeight: '600' },
  actionSection: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  sectionHeading: { fontSize: 15, fontWeight: '700', color: '#0B1C30', marginBottom: 8 },
  sectionDesc: { fontSize: 12, color: '#737686', textAlign: 'center', marginBottom: 16 },
  actionButton: { backgroundColor: '#004AC6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, width: '100%' },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  formContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  chipOn: { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  chipTextOn: { color: Colors.primary },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 2 },
  checkText: { flex: 1, fontSize: 13, color: '#334155' },
  hint: { fontSize: 11, color: '#64748B', marginTop: 4, marginBottom: 8, lineHeight: 15 },
  label: { fontSize: 12, fontWeight: '700', color: '#4A5568', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 10, padding: 10, fontSize: 13, color: '#2D3748', backgroundColor: '#F8FAFC', marginBottom: 8 },
  submitBtn: { backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginTop: 20 },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  detailReason: { fontSize: 13, color: '#334155', marginTop: 6, fontWeight: '600' },
  detailInjured: { fontSize: 13, color: '#EF4444', marginTop: 6, fontWeight: '700' },
});
