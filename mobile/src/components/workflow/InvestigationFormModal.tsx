import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { KEYBOARD_BEHAVIOR } from '../layout/KeyboardAvoider';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { TextArea } from '../form/TextArea';
import type { ReportType } from '../../api/endpoints';
import {
  reportWorkflowService,
  type CapaOwner,
  type InvestigatePayload,
} from '../../services/reportWorkflowService';

/**
 * The supervisor's investigation write-up, before a report moves to the manager.
 *
 * Root cause is the only required field — a supervisor on site should not be blocked
 * from closing out their step by five optional "why" boxes. The severity picker
 * matters: raising it to high/critical makes the backend route straight to the
 * manager instead of parking in pending_approval, so the modal says so out loud.
 *
 * The corrective action is asked for here rather than on a later screen because
 * of what happens when it is skipped: the backend has nothing to improve and
 * nothing whose effectiveness it could confirm, so the record jumps 04 -> 07 and
 * stages 05 IMPROVE and 06 VERIFY are never occupied. That is a legitimate
 * outcome for a report that genuinely needs no fix, and a silent hole in the
 * lifecycle for one that does — so the field is optional but the consequence of
 * leaving it blank is stated.
 */

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
type Severity = (typeof SEVERITIES)[number];

/** WF-04 inputs: together these set the corrective action's priority band and
 *  therefore its deadline. Left at medium/medium they still produce both. */
const CAPA_RATINGS = ['low', 'medium', 'high'] as const;
type CapaRating = (typeof CAPA_RATINGS)[number];

const SEVERITY_COLOR: Record<Severity, string> = {
  low: Colors.success,
  medium: Colors.warning,
  high: Colors.critical,
  critical: Colors.critical,
};

const WHY_LABELS = [
  'Why did it happen?',
  'Why did that happen?',
  'And why was that?',
  'And why was that?',
  'Root of the chain',
];

const WHY_PLACEHOLDERS = [
  'e.g., Why did the worker fall? (Because the ladder slipped)',
  'e.g., Why did the ladder slip? (Because it was not secured)',
  'e.g., Why was it not secured? (Because there was no strap)',
  'e.g., Why was there no strap? (Because toolbox lacked gear)',
  'e.g., Why was gear missing? (Because no monthly checks were done)',
];

interface Props {
  visible: boolean;
  /** Severity the worker reported, pre-selected for the supervisor. */
  initialSeverity?: string | null;
  reportLabel: string;
  isSubmitting?: boolean;
  /** Which family's owner list to offer. Each has its own route. */
  reportType: ReportType;
  onCancel: () => void;
  onSubmit: (payload: InvestigatePayload) => void;
}

export function InvestigationFormModal({
  visible,
  initialSeverity,
  reportLabel,
  isSubmitting = false,
  reportType,
  onCancel,
  onSubmit,
}: Props) {
  const [rootCause, setRootCause] = useState('');
  const [actions, setActions] = useState('');
  const [whys, setWhys] = useState<string[]>(['', '', '', '', '']);
  const [showWhys, setShowWhys] = useState(false);
  const [severity, setSeverity] = useState<Severity>('medium');
  const [touched, setTouched] = useState(false);
  // ── Stage 05 IMPROVE ───────────────────────────────────────────────────────
  const [capa, setCapa] = useState('');
  const [capaSeverity, setCapaSeverity] = useState<CapaRating>('medium');
  const [capaSystemic, setCapaSystemic] = useState<CapaRating>('medium');
  const [owners, setOwners] = useState<CapaOwner[]>([]);
  const [ownerId, setOwnerId] = useState<number | null>(null);

  // The modal stays mounted while `visible` toggles, so useState's initialiser only
  // ever ran for the first report opened. Re-sync each time it opens, or every
  // report after the first would show the previous one's severity.
  useEffect(() => {
    if (!visible) return;
    const s = (initialSeverity ?? '').toLowerCase() as Severity;
    setSeverity(SEVERITIES.includes(s) ? s : 'medium');
  }, [visible, initialSeverity]);

  // An empty list is not an error worth blocking on — the action can still be
  // raised unassigned, and the note below says what that costs.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    reportWorkflowService(reportType)
      .getCapaOwners()
      .then((rows) => { if (!cancelled) setOwners(rows); })
      .catch(() => { if (!cancelled) setOwners([]); });
    return () => { cancelled = true; };
  }, [visible, reportType]);

  const rootCauseError = touched && !rootCause.trim() ? 'Root cause is required' : undefined;
  const willEscalate = severity === 'high' || severity === 'critical';

  const reset = () => {
    setRootCause('');
    setActions('');
    const s = (initialSeverity ?? '').toLowerCase() as Severity;
    setSeverity(SEVERITIES.includes(s) ? s : 'low');
    setWhys(['', '', '', '', '']);
    setShowWhys(true);
    setTouched(false);
    setCapa('');
    setCapaSeverity('medium');
    setCapaSystemic('medium');
    setOwnerId(null);
  };

  const handleSubmit = () => {
    setTouched(true);
    if (!rootCause.trim()) {
      Alert.alert('Required field', 'Root cause is required.');
      return;
    }

    // Backend stores five_why_analysis as a JSON object; only send the boxes filled in.
    const fiveWhy = whys.reduce<Record<string, string>>((acc, val, i) => {
      if (val.trim()) acc[`why${i + 1}`] = val.trim();
      return acc;
    }, {});

    onSubmit({
      root_cause: rootCause.trim(),
      immediate_actions_taken: actions.trim() || undefined,
      five_why_analysis: Object.keys(fiveWhy).length ? fiveWhy : undefined,
      severity,
      // Only sent when there is one — an empty string would raise a CAPA with
      // no description and park the record in IMPROVE behind nothing.
      capa_description: capa.trim() || undefined,
      capa_severity_potential: capa.trim() ? capaSeverity : undefined,
      capa_systemic_risk: capa.trim() ? capaSystemic : undefined,
      capa_responsible_person_id: capa.trim() && ownerId != null ? ownerId : undefined,
    });
    reset();
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const filledWhys = useMemo(() => whys.filter((w) => w.trim()).length, [whys]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={KEYBOARD_BEHAVIOR}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Investigation</Text>
            <TouchableOpacity onPress={handleCancel} hitSlop={8}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle} numberOfLines={2}>
            {reportLabel}
          </Text>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <TextArea
              label="Root cause *"
              placeholder="What actually caused this?"
              value={rootCause}
              onChangeText={setRootCause}
              minHeight={80}
              error={rootCauseError}
              placeholderTextColor="#94A3B8"
            />

            <TextArea
              label="Immediate actions taken"
              placeholder="Describe containment or cleanup actions…"
              value={actions}
              onChangeText={setActions}
              minHeight={70}
              placeholderTextColor="#94A3B8"
            />

            {/* Optional, and collapsed by default so the required field stays in view. */}
            <TouchableOpacity style={styles.whysToggle} onPress={() => setShowWhys(!showWhys)}>
              <Ionicons
                name={showWhys ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={Colors.primary}
              />
              <Text style={styles.whysToggleText}>
                5-Why analysis {filledWhys > 0 ? `(${filledWhys}/5 filled)` : '(optional)'}
              </Text>
            </TouchableOpacity>

            {showWhys &&
              whys.map((val, i) => (
                <TextArea
                  key={i}
                  label={`${i + 1}. ${WHY_LABELS[i]}`}
                  placeholder={WHY_PLACEHOLDERS[i]}
                  value={val}
                  onChangeText={(t) => setWhys((prev) => prev.map((p, j) => (j === i ? t : p)))}
                  minHeight={54}
                  placeholderTextColor="#94A3B8"
                />
              ))}

            <TextArea
              label="Corrective action"
              placeholder="What will stop this happening for real next time?"
              value={capa}
              onChangeText={setCapa}
              minHeight={64}
              placeholderTextColor="#94A3B8"
            />
            {capa.trim() ? (
              <>
                <Text style={styles.fieldLabel}>Who owns it?</Text>
                {owners.length === 0 ? (
                  <Text style={styles.capaNote}>
                    No assignable supervisors found — the action will be raised unassigned.
                  </Text>
                ) : (
                  <>
                    <View style={styles.ownerWrap}>
                      {owners.map((o) => {
                        const active = ownerId === o.employee_id;
                        return (
                          <TouchableOpacity
                            key={o.employee_id}
                            style={[styles.ownerChip, active && styles.ownerChipActive]}
                            onPress={() => setOwnerId(active ? null : o.employee_id)}
                          >
                            <Text style={[styles.ownerName, active && styles.ownerNameActive]}>
                              {o.name}
                            </Text>
                            {!!o.department && (
                              <Text style={[styles.ownerDept, active && styles.ownerNameActive]}>
                                {o.department}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {ownerId == null && (
                      <Text style={styles.capaNote}>
                        Unassigned actions reach nobody's task list. Pick an owner unless you
                        intend to assign it later.
                      </Text>
                    )}
                  </>
                )}

                <Text style={styles.fieldLabel}>How bad could it have been?</Text>
                <RatingRow value={capaSeverity} onChange={setCapaSeverity} />
                <Text style={styles.fieldLabel}>Could it happen elsewhere on site?</Text>
                <RatingRow value={capaSystemic} onChange={setCapaSystemic} />
                <Text style={styles.capaNote}>
                  These two set the action's priority band and its deadline.
                </Text>
              </>
            ) : (
              <Text style={styles.capaNote}>
                No corrective action means nothing to verify — this will skip stages
                05 and 06 and go to the manager for closure.
              </Text>
            )}

            <Text style={styles.fieldLabel}>Severity</Text>
            <View style={styles.sevRow}>
              {SEVERITIES.map((s) => {
                const active = severity === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sevChip, active && { backgroundColor: SEVERITY_COLOR[s] }]}
                    onPress={() => setSeverity(s)}
                  >
                    <Text style={[styles.sevChipText, active && styles.sevChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.routeNote}>
              <Ionicons
                name={willEscalate ? 'arrow-up-circle' : 'information-circle-outline'}
                size={16}
                color={willEscalate ? Colors.critical : Colors.textMuted}
              />
              <Text style={[styles.routeText, willEscalate && { color: Colors.critical }]}>
                {willEscalate
                  ? 'High severity — this goes straight to the manager.'
                  : 'This will be sent to the manager for approval.'}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={handleCancel}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, isSubmitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Submit investigation</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RatingRow({
  value,
  onChange,
}: {
  value: CapaRating;
  onChange: (v: CapaRating) => void;
}) {
  return (
    <View style={styles.sevRow}>
      {CAPA_RATINGS.map((r) => {
        const active = value === r;
        return (
          <TouchableOpacity
            key={r}
            style={[styles.sevChip, active && { backgroundColor: Colors.primary }]}
            onPress={() => onChange(r)}
          >
            <Text style={[styles.sevChipText, active && styles.sevChipTextActive]}>{r}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,28,48,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    maxHeight: '90%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: Colors.textDark },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2, marginBottom: 14 },
  body: { flexGrow: 0 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMid, marginBottom: 6 },
  whysToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  whysToggleText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  sevRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  sevChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  sevChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMid,
    textTransform: 'capitalize',
  },
  sevChipTextActive: { color: Colors.white },
  capaNote: { fontSize: 11.5, color: Colors.textMuted, lineHeight: 16, marginBottom: 12 },
  ownerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  ownerChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
  },
  ownerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  ownerName: { fontSize: 12.5, fontWeight: '700', color: Colors.textDark },
  ownerDept: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  ownerNameActive: { color: Colors.white },
  routeNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  routeText: { fontSize: 12, color: Colors.textMuted, flex: 1 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  btnGhostText: { color: Colors.textMid, fontWeight: '700', fontSize: 14 },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
});
