import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaScreen } from '../components/layout/KeyboardAvoider';
import { HazardRecordCard } from '../components/workflow/HazardRecordCard';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { EmptyState } from '../components/feedback/EmptyState';
import {
  CONTROL_HIERARCHY, HAZARD_STATUS_LABEL, HIERARCHY_LABEL,
  hazardRegisterService,
  type ControlHierarchy, type HazardNextAction, type HazardRegisterItem,
} from '../services/hazardRegisterService';
import { newestFirst } from '../utils/newestFirst';

/**
 * The supervisor's half of the unsafe act register (flow 5).
 *
 * Stages 02 ASSESS through 05 IMPROVE belong to the supervisor — that is what
 * `hazard_next_action` says owns each register_status — but until now the only
 * screen that could move an unsafe act along was the manager's. A supervisor could
 * be told an unsafe act was waiting on them and have nowhere to do it.
 *
 * Which form appears is decided by `/hazard-register/{id}/next-action`, never
 * here. The backend already refuses a verb the unsafe act is not at, and it words
 * the refusal by stage; inventing a second opinion in the client is how the two
 * drift. Stages the supervisor does not own still render — read-only, saying
 * whose step it is — because a supervisor chasing an unsafe act needs to know it is
 * sitting with the manager rather than lost.
 *
 * Deliberately not a copy of the manager screen: this one opens on the
 * supervisor's own queue rather than the whole register, so the default view
 * is the work that is actually owed.
 */

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const PROBABILITIES = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];

const PRIORITY_COLOR: Record<string, string> = {
  P1: '#DC2626', P2: '#EA580C', P3: '#CA8A04', P4: '#2563EB', P5: '#64748B',
};

type Tab = 'mine' | 'all';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function HazardRegisterManagementScreen({ navigation }: any) {
  const [tab, setTab] = useState<Tab>('mine');
  const [rows, setRows] = useState<HazardRegisterItem[]>([]);
  const [mineIds, setMineIds] = useState<Set<number>>(new Set());
  const [handledIds, setHandledIds] = useState<Set<number>>(new Set());

  // The stage rail, opened per hazard rather than drawn on every card.
  const [tracking, setTracking] = useState<HazardRegisterItem | null>(null);
  const [track, setTrack] = useState<HazardNextAction | null>(null);

  const openTrack = async (hazard: HazardRegisterItem) => {
    setTracking(hazard);
    setTrack(null);
    try {
      setTrack(await hazardRegisterService.getNextAction(hazard.id));
    } catch {
      setTrack(null);
    }
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [nextAction, setNextAction] = useState<HazardNextAction | null>(null);
  const [acting, setActing] = useState(false);

  // One set of stage-form fields: only ever one hazard is expanded.
  const [severity, setSeverity] = useState('Medium');
  const [probability, setProbability] = useState('Possible');
  const [personsExposed, setPersonsExposed] = useState('');
  const [workStopped, setWorkStopped] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [controlText, setControlText] = useState('');
  const [hierarchy, setHierarchy] = useState<ControlHierarchy>('engineering');

  /**
   * The register list and the queue are fetched together even on the "all" tab,
   * because the queue is the only thing that knows which rows are this
   * supervisor's own job — the register row carries the stage, not the owner.
   */
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      hazardRegisterService.list({ openOnly: true, limit: 200 }).catch(() => [] as HazardRegisterItem[]),
      // mineOnly=false: the queue filters on `can_act`, so a hazard that has
      // moved on to the manager drops out of a mine-only call — and that is
      // exactly the record this screen now needs back, flagged handled_by_me.
      hazardRegisterService.getNextActions(false).catch(() => ({ count: 0, items: [], mine_count: 0 })),
    ])
      .then(([list, queue]) => {
        setRows(newestFirst(list));
        setMineIds(new Set(queue.items.filter(i => i.is_mine).map(i => i.id)));
        // A hazard this supervisor has already assessed or planned controls for
        // stops being their step, and used to drop straight out of the "Needs
        // you" tab. It stays, marked as theirs and done.
        setHandledIds(new Set(queue.items.filter(i => i.handled_by_me).map(i => i.id)));
      })
      .catch(() => setError('Could not load the unsafe act register.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener?.('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  const open = async (hazard: HazardRegisterItem) => {
    if (expandedId === hazard.id) {
      setExpandedId(null);
      setNextAction(null);
      return;
    }
    setExpandedId(hazard.id);
    setNextAction(null);
    // Seed from the hazard so the supervisor corrects the reporter's figures
    // rather than retyping them from scratch.
    setSeverity(hazard.severity ?? 'Medium');
    setProbability(hazard.probability ?? 'Possible');
    setPersonsExposed(hazard.persons_exposed != null ? String(hazard.persons_exposed) : '');
    setWorkStopped(Boolean(hazard.work_stopped));
    setFreeText('');
    setControlText('');
    setHierarchy('engineering');
    try {
      setNextAction(await hazardRegisterService.getNextAction(hazard.id));
    } catch {
      setNextAction(null);
    }
  };

  /** Run one stage verb, surfacing the backend's own refusal wording. */
  const runStage = async (fn: () => Promise<HazardRegisterItem>, successMsg: string) => {
    setActing(true);
    try {
      const updated = await fn();
      setRows(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      setFreeText('');
      setControlText('');
      Alert.alert('Done', successMsg);
      hazardRegisterService.getNextAction(updated.id).then(setNextAction).catch(() => setNextAction(null));
      load();
    } catch (e: any) {
      // The gate messages name the stage and why it refused, which beats
      // anything this screen could invent.
      Alert.alert('Cannot do that yet', e?.response?.data?.detail || 'The action failed.');
    } finally {
      setActing(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // The one form belonging to whichever stage the hazard is at
  // ══════════════════════════════════════════════════════════════════════════
  const renderStageForm = (hazard: HazardRegisterItem) => {
    if (!nextAction) return <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} />;
    if (!nextAction.next_action) {
      return <Text style={styles.note}>This unsafe act is closed. Nothing is outstanding.</Text>;
    }
    if (!nextAction.can_act) {
      return (
        <View style={styles.blockedBox}>
          <Ionicons name="lock-closed-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.blockedText}>
            {nextAction.next_action.action} — this step belongs to the{' '}
            {nextAction.next_action.owner_role.replace(/_/g, ' ')}.
          </Text>
        </View>
      );
    }

    const id = hazard.id;
    const cta = nextAction.next_action.cta;

    switch (hazard.register_status) {
      // ── 02 ASSESS ──────────────────────────────────────────────────────────
      case 'open':
        return (
          <>
            <Text style={styles.fieldLabel}>SEVERITY</Text>
            <Pills options={SEVERITIES} value={severity} onChange={setSeverity} />
            <Text style={styles.fieldLabel}>PROBABILITY</Text>
            <Pills options={PROBABILITIES} value={probability} onChange={setProbability} />
            <Text style={styles.fieldLabel}>PEOPLE EXPOSED</Text>
            <TextInput
              style={styles.input} keyboardType="number-pad" placeholder="e.g. 6"
              placeholderTextColor={Colors.textMuted}
              value={personsExposed} onChangeText={setPersonsExposed}
            />
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setWorkStopped(v => !v)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={workStopped ? 'checkbox' : 'square-outline'}
                size={20}
                color={workStopped ? Colors.critical : Colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Work stopped because of this unsafe act</Text>
                <Text style={styles.hint}>
                  Stopping the job records containment at RESPOND before the review opens.
                </Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.fieldLabel}>ASSESSMENT NOTES</Text>
            <TextInput
              style={[styles.input, styles.multiline]} multiline
              value={freeText} onChangeText={setFreeText}
              placeholder="What did you find on inspection?"
              placeholderTextColor={Colors.textMuted}
            />
            <PrimaryButton
              busy={acting} label={cta}
              onPress={() => runStage(
                () => hazardRegisterService.assess(id, {
                  severity, probability,
                  persons_exposed: personsExposed ? Number(personsExposed) : undefined,
                  work_stopped: workStopped,
                  assessment_notes: freeText.trim() || undefined,
                }),
                'Unsafe act assessed.',
              )}
            />
          </>
        );

      // ── 03 RESPOND ─────────────────────────────────────────────────────────
      case 'interim_control':
        return (
          <>
            {!!hazard.interim_control && (
              <Text style={styles.recorded}>In place: {hazard.interim_control}</Text>
            )}
            <Text style={styles.fieldLabel}>INTERIM CONTROL</Text>
            <TextInput
              style={[styles.input, styles.multiline]} multiline
              value={freeText} onChangeText={setFreeText}
              placeholder="What is holding this unsafe act right now? e.g. isolated and barriered"
              placeholderTextColor={Colors.textMuted}
            />
            <View style={styles.btnRow}>
              <SecondaryButton
                label="Record control"
                onPress={() => {
                  if (!freeText.trim()) { Alert.alert('Required', 'Describe the interim control.'); return; }
                  runStage(
                    () => hazardRegisterService.interimControl(id, { interim_control: freeText.trim() }),
                    'Interim control recorded.',
                  );
                }}
              />
              <PrimaryButton
                busy={acting} label={cta}
                onPress={() => runStage(
                  () => hazardRegisterService.startReview(id, freeText.trim() || undefined),
                  'Control review opened.',
                )}
              />
            </View>
          </>
        );

      // ── 04 INVESTIGATE ─────────────────────────────────────────────────────
      case 'under_review':
        return (
          <>
            <Text style={styles.fieldLabel}>ROOT CAUSE</Text>
            <TextInput
              style={[styles.input, styles.multiline]} multiline
              value={freeText} onChangeText={setFreeText}
              placeholder="Why does this unsafe act exist? Not what it is — why it is here."
              placeholderTextColor={Colors.textMuted}
            />
            {!!hazard.root_cause && <Text style={styles.recorded}>Recorded: {hazard.root_cause}</Text>}
            <SecondaryButton
              label="Save root cause"
              onPress={() => {
                if (!freeText.trim()) { Alert.alert('Required', 'Enter the root cause.'); return; }
                runStage(
                  () => hazardRegisterService.recordFindings(id, { root_cause: freeText.trim() }),
                  'Root cause recorded.',
                );
              }}
            />

            <Text style={styles.fieldLabel}>PERMANENT CONTROL</Text>
            <TextInput
              style={[styles.input, styles.multiline]} multiline
              value={controlText} onChangeText={setControlText}
              placeholder="What will remove or reduce the unsafe act for good?"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.fieldLabel}>HIERARCHY OF CONTROL</Text>
            <Text style={styles.hint}>
              Strongest first. PPE protects the person instead of removing the hazard,
              so it needs a reason.
            </Text>
            <Pills
              options={[...CONTROL_HIERARCHY]}
              value={hierarchy}
              labelFor={(o) => HIERARCHY_LABEL[o as ControlHierarchy]}
              onChange={(v) => setHierarchy(v as ControlHierarchy)}
            />
            <PrimaryButton
              busy={acting} label="Plan controls"
              onPress={() => {
                const plan = controlText.trim();
                if (!plan) { Alert.alert('Required', 'Describe the permanent control.'); return; }
                if (hierarchy === 'ppe' && !freeText.trim()) {
                  Alert.alert(
                    'Justification required',
                    'PPE is the weakest control. Use the root-cause box to state why a stronger control is not reasonably practicable.',
                  );
                  return;
                }
                runStage(
                  () => hazardRegisterService.planControls(id, {
                    planned_controls: plan,
                    control_hierarchy: hierarchy,
                    ppe_justification: hierarchy === 'ppe' ? freeText.trim() : undefined,
                  }),
                  'Permanent control planned.',
                );
              }}
            />
          </>
        );

      // ── 05 IMPROVE ─────────────────────────────────────────────────────────
      case 'controls_planned':
        return (
          <>
            <Text style={styles.readonlyLabel}>PLANNED CONTROL</Text>
            <Text style={styles.readonlyValue}>{hazard.planned_controls || '—'}</Text>
            {!!hazard.control_hierarchy && (
              <Text style={styles.recorded}>
                Level: {HIERARCHY_LABEL[hazard.control_hierarchy as ControlHierarchy] ?? hazard.control_hierarchy}
              </Text>
            )}
            {(hazard.verification_failures ?? 0) > 0 && (
              <View style={styles.warnBox}>
                <Ionicons name="warning-outline" size={14} color="#B45309" />
                <Text style={styles.warnText}>
                  This control has already failed verification {hazard.verification_failures}×.
                </Text>
              </View>
            )}
            <Text style={styles.fieldLabel}>IMPLEMENTATION NOTES</Text>
            <TextInput
              style={[styles.input, styles.multiline]} multiline
              value={freeText} onChangeText={setFreeText}
              placeholder="Confirm the control is physically in place, and when."
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.hint}>
              Submitting hands the hazard to the manager to verify the control held.
            </Text>
            <PrimaryButton
              busy={acting} label={cta}
              onPress={() => runStage(
                () => hazardRegisterService.submitForVerification(id, freeText.trim() || undefined),
                'Submitted for verification.',
              )}
            />
          </>
        );

      default:
        // 06 VERIFY, 07 LEARN and 08 CLOSE are the manager's. can_act above
        // already caught that for a plain supervisor; this catches a role that
        // outranks the step but should still act on it from the manager screen.
        return (
          <View style={styles.blockedBox}>
            <Ionicons name="arrow-forward-circle-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.blockedText}>
              {nextAction.next_action.action} — handled on the manager's register.
            </Text>
          </View>
        );
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  const visible = tab === 'mine'
    ? rows.filter(r => mineIds.has(r.id) || handledIds.has(r.id))
    : rows;

  const renderCard = (hazard: HazardRegisterItem) => {
    const isOpen = expandedId === hazard.id;
    const priority = hazard.assessed_priority;
    const isMine = mineIds.has(hazard.id);
    const isHandled = handledIds.has(hazard.id);

    return (
      <View key={hazard.id} style={styles.card}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => open(hazard)}>
          <View style={styles.cardHeader}>
            <Text style={styles.title} numberOfLines={isOpen ? undefined : 2}>
              {hazard.hazard_name || hazard.description || 'Unnamed unsafe act'}
            </Text>
            {!!priority && (
              <View style={[styles.badge, { backgroundColor: (PRIORITY_COLOR[priority] ?? Colors.textMuted) + '1A' }]}>
                <Text style={[styles.badgeText, { color: PRIORITY_COLOR[priority] ?? Colors.textMuted }]}>
                  {priority}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.sub}>
            {hazard.reference || `HAZ-${hazard.id}`}
            {' · '}{HAZARD_STATUS_LABEL[hazard.register_status ?? ''] ?? hazard.register_status}
            {hazard.logged_at ? ` · ${timeAgo(hazard.logged_at)}` : ''}
          </Text>

          <View style={styles.metaRow}>
            {!!hazard.station_name && (
              <Text style={styles.meta}>
                <Ionicons name="location-outline" size={11} color={Colors.textMuted} /> {hazard.station_name}
              </Text>
            )}
            {!!hazard.work_stopped && <Text style={[styles.meta, styles.metaStop]}>WORK STOPPED</Text>}
            {!!hazard.is_overdue && <Text style={[styles.meta, styles.metaStop]}>OVERDUE</Text>}
            {isMine && <Text style={[styles.meta, styles.metaMine]}>NEEDS YOU</Text>}
            {!isMine && isHandled && <Text style={styles.meta}>DONE BY YOU</Text>}
          </View>

        </TouchableOpacity>

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.cardAction} onPress={() => open(hazard)}>
            <Ionicons
              name={isOpen ? 'chevron-up-outline' : 'document-text-outline'}
              size={15}
              color={Colors.primary}
            />
            <Text style={styles.cardActionText}>{isOpen ? 'Close' : 'Open'}</Text>
          </TouchableOpacity>

          <View style={styles.cardActionDivider} />

          <TouchableOpacity style={styles.cardAction} onPress={() => openTrack(hazard)}>
            <Ionicons name="git-commit-outline" size={15} color={Colors.primary} />
            <Text style={styles.cardActionText}>Track</Text>
          </TouchableOpacity>
        </View>

        {isOpen && (
          <View style={styles.formBox}>
            {/* The whole record, not just the worker's half. A supervisor at
                stage 06 was being asked to verify a control without being shown
                the root cause it answers or who planned it — every one of those
                fields was already in the response. Shared with the manager's
                screen so the two are reading the same record. */}
            <HazardRecordCard hazard={hazard} />

            {!!nextAction?.next_action && (
              <Text style={styles.actionHeading}>{nextAction.next_action.detail}</Text>
            )}
            {renderStageForm(hazard)}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaScreen style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Unsafe Act Register</Text>
      </View>

      <View style={styles.tabs}>
        {(['mine', 'all'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'mine' ? `Needs you (${mineIds.size})` : `All open (${rows.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, visible.length === 0 && styles.scrollEmpty]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        {error && <Text style={styles.error}>{error}</Text>}

        {visible.length === 0 && !loading && !error ? (
          <EmptyState
            icon="shield-checkmark-outline"
            title={tab === 'mine' ? 'Nothing waiting on you' : 'No open unsafe acts'}
            subtitle={
              tab === 'mine'
                ? 'Unsafe acts needing your assessment, containment, review or control will appear here.'
                : 'Unsafe acts logged by your team will appear here as they come in.'
            }
          />
        ) : (
          visible.map(renderCard)
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal
        visible={tracking !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setTracking(null)}
      >
        <View style={styles.trackBackdrop}>
          <View style={styles.trackSheet}>
            <Text style={styles.trackTitle}>
              {tracking?.reference || `HAZ-${tracking?.id}`}
            </Text>
            <Text style={styles.trackDesc} numberOfLines={3}>
              {tracking?.hazard_name || tracking?.description}
            </Text>

            {track ? (
              <>
                {/* The stage in words, not the eight-dot rail. The rail is
                    deliberately off every supervisor and manager screen — what
                    is useful here is which step is outstanding and who holds
                    it, which is what follows. */}
                {!!track.stage_label && (
                  <Text style={styles.trackStage}>
                    {track.stage_number ? `${String(track.stage_number).padStart(2, '0')} · ` : ''}
                    {track.stage_label}
                  </Text>
                )}
                <Text style={styles.trackStep}>
                  {track.next_action
                    ? track.next_action.action
                    : 'Nothing outstanding — this unsafe act is complete.'}
                </Text>
                <Text style={styles.trackOwner}>
                  {track.is_closed
                    ? 'Closed.'
                    : track.is_mine
                      ? 'Your step.'
                      : `With the ${(track.next_action?.owner_role ?? 'next role').replace(/_/g, ' ')}.`}
                  {track.next_action?.unblocks
                    ? ` Clearing it opens ${track.next_action.unblocks}.`
                    : ''}
                </Text>
              </>
            ) : (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
            )}

            <TouchableOpacity style={styles.trackClose} onPress={() => setTracking(null)}>
              <Text style={styles.trackCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaScreen>
  );
}

// ── Small local controls ─────────────────────────────────────────────────────
// Local rather than shared: the supervisor screens use the Ionicons/Colors
// vocabulary, and the manager's equivalents live inside its own module.

function Pills({
  options, value, onChange, labelFor,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  labelFor?: (o: string) => string;
}) {
  return (
    <View style={styles.pillRow}>
      {options.map(o => (
        <TouchableOpacity
          key={o}
          style={[styles.pill, value === o && styles.pillActive]}
          onPress={() => onChange(o)}
        >
          <Text style={[styles.pillText, value === o && styles.pillTextActive]}>
            {labelFor ? labelFor(o) : o}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PrimaryButton({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
      onPress={onPress}
      disabled={busy}
    >
      {busy
        ? <ActivityIndicator color={Colors.white} size="small" />
        : <Text style={styles.btnPrimaryText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onPress}>
      <Text style={styles.btnGhostText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardActions: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF2F7',
  },
  cardAction: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 4,
  },
  cardActionText: { fontSize: 12.5, fontWeight: '700', color: Colors.primary },
  cardActionDivider: { width: 1, height: 18, backgroundColor: '#EEF2F7' },

  trackBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  trackSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20,
  },
  trackTitle: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  trackDesc: { fontSize: 13, color: Colors.textDark, marginTop: 6, lineHeight: 19 },
  trackStage: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginTop: 14,
    textTransform: 'uppercase', color: Colors.textMuted,
  },
  trackStep: { fontSize: 13, fontWeight: '700', color: Colors.textDark, marginTop: 14 },
  trackOwner: { fontSize: 12, color: Colors.textMuted, marginTop: 4, lineHeight: 17 },
  trackClose: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  trackCloseText: { fontSize: 13.5, fontWeight: '700', color: Colors.textMuted },

  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textDark },

  tabs: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.white },

  scroll: { padding: 16 },
  scrollEmpty: { flexGrow: 1, justifyContent: 'center' },
  error: { color: Colors.critical, marginBottom: 12, fontSize: 13 },

  card: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textDark, lineHeight: 20 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  sub: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6, marginBottom: 8 },
  meta: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  metaStop: { color: Colors.critical, fontWeight: '800' },
  metaMine: { color: Colors.primary, fontWeight: '800' },

  formBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  actionHeading: { fontSize: 13, color: Colors.textDark, lineHeight: 19, marginBottom: 10 },

  fieldLabel: {
    fontSize: 11, fontWeight: '800', color: Colors.textMuted,
    letterSpacing: 0.5, marginTop: 12, marginBottom: 6,
  },
  readonlyLabel: {
    fontSize: 11, fontWeight: '800', color: Colors.textMuted,
    letterSpacing: 0.5, marginBottom: 4,
  },
  readonlyValue: { fontSize: 13, color: Colors.textDark, lineHeight: 19, marginBottom: 6 },
  hint: { fontSize: 11, color: Colors.textMuted, lineHeight: 16, marginBottom: 6 },
  recorded: { fontSize: 12, color: Colors.success, marginTop: 6, fontWeight: '600' },
  note: { fontSize: 13, color: Colors.textMuted },

  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: Colors.textDark, backgroundColor: Colors.background,
  },
  multiline: { minHeight: 76, textAlignVertical: 'top' },

  toggleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: Colors.textDark, marginBottom: 2 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  pillTextActive: { color: Colors.white },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10, marginTop: 12,
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  btnGhost: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.textDark, fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },

  blockedBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.background, borderRadius: 10, padding: 12,
  },
  blockedText: { flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 17 },

  warnBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10, marginTop: 8,
  },
  warnText: { flex: 1, fontSize: 12, color: '#B45309', fontWeight: '600' },
});
