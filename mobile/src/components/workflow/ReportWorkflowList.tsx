import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaScreen } from '../layout/KeyboardAvoider';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { EmptyState } from '../feedback/EmptyState';
import { InvestigationFormModal } from './InvestigationFormModal';
import { ReportRecordCard } from './ReportRecordCard';
import { useReportWorkflow } from '../../hooks/useReportWorkflow';
import type { ReportType } from '../../api/endpoints';
import { reportWorkflowService } from '../../services/reportWorkflowService';
import type {
  InvestigatePayload, ReportDetail, ReportNextAction, ReportNextActionItem,
} from '../../services/reportWorkflowService';

/**
 * The supervisor's half of one report family, run on the eight-stage engine.
 *
 * This used to be a flat /pending-review list: three statuses, three buttons,
 * no stage anywhere. A supervisor could see that a near miss existed and could
 * not see how far along it was, whether it was overdue, or — once they had
 * submitted their investigation — whether anything was still owed and by whom.
 * Records that moved past their step simply vanished.
 *
 * Which action is offered is decided by `/{type}-workflow/next-actions`, never
 * here. The backend already refuses a verb a record is not at and words the
 * refusal by stage; a second opinion in the client is how the two drift. Steps
 * the supervisor does not own still render — read-only, naming whose step it
 * is — because a supervisor chasing a report needs to know it is sitting with
 * the manager rather than lost.
 *
 * Near miss, unsafe act and risk share this screen because the backend builds
 * their routers from one factory and gives all three the identical verbs; only
 * the title and the reporter's wording differ. Incidents keep their own screen:
 * they carry days-away and statutory fields these three do not have.
 */

interface Props {
  navigation: any;
  reportType: ReportType;
  title: string;
  /** Shown when the queue is empty — worded for the report type. */
  emptyTitle: string;
  emptyIcon?: string;
}

type Tab = 'mine' | 'open' | 'closed';

/** The stages a supervisor can still hand upward from. */
const SUPERVISOR_STATUSES = new Set(['reported', 'acknowledged', 'under_investigation']);

const PRIORITY_COLOR: Record<string, string> = {
  P1: '#DC2626', P2: '#EA580C', P3: '#CA8A04', P4: '#2563EB', P5: '#64748B',
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ReportWorkflowList({
  navigation,
  reportType,
  title,
  emptyTitle,
  emptyIcon = 'shield-checkmark-outline',
}: Props) {
  const {
    queue, closed, isLoading, busyId, error, refresh,
    acknowledge, startInvestigation, investigate, escalate,
  } = useReportWorkflow(reportType);

  // The hook covers the queue and the transitions; the one-report read is not
  // part of that, so the family's service is built here for it.
  const api = useMemo(() => reportWorkflowService(reportType), [reportType]);

  const [tab, setTab] = useState<Tab>('mine');
  const [expandedId, setExpanded] = useState<number | null>(null);
  // Fetched when a card opens rather than for the whole list: the queue row
  // carries enough to triage, and pulling every report's detail to render one
  // would make the list slower for the common case of just scanning it.
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [investigating, setInvestigating] = useState<ReportNextActionItem | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    refresh();
    const unsubscribe = navigation.addListener('focus', refresh);
    return unsubscribe;
  }, [navigation, refresh]);

  // "Needs you" is your step *or* your record. A supervisor who acknowledged a
  // near miss and submitted the investigation used to watch it drop out of this
  // tab the moment they finished: the step passed to the manager, `is_mine`
  // went false, and the only place their own work still appeared was an "all
  // open" list that does not distinguish it from anyone else's. It stays, and
  // the card says who is holding it now.
  const mine = useMemo(
    () => queue.filter(i => i.is_mine || i.handled_by_me),
    [queue],
  );

  // The stage rail, opened per record rather than drawn on every card — the
  // rail was taken off these screens on request and this puts it behind a
  // deliberate tap instead of back on the list.
  const [tracking, setTracking] = useState<ReportNextActionItem | null>(null);
  const [track, setTrack] = useState<ReportNextAction | null>(null);

  const openTrack = useCallback(async (item: ReportNextActionItem) => {
    setTracking(item);
    setTrack(null);
    try {
      setTrack(await api.getNextAction(item.id));
    } catch {
      setTrack(null);
    }
  }, [api]);

  const submitInvestigation = useCallback(async (payload: InvestigatePayload) => {
    if (!investigating) return;
    const item = investigating;
    setInvestigating(null);
    await investigate(item.id, payload);
  }, [investigating, investigate]);

  const confirmEscalate = (item: ReportNextActionItem) => {
    Alert.alert(
      'Escalate to manager?',
      'The manager takes this over from here. Use it when the fix is outside what you can authorise.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Escalate',
          style: 'destructive',
          onPress: () => escalate(item.id, 'Escalated by supervisor for manager review'),
        },
      ],
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // The one form belonging to whichever stage the record is at
  // ══════════════════════════════════════════════════════════════════════════
  const renderStageForm = (item: ReportNextActionItem) => {
    if (!item.can_act) {
      return (
        <View style={styles.blockedBox}>
          <Ionicons name="lock-closed-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.blockedText}>
            {item.action} — this step belongs to the {item.owner_role.replace(/_/g, ' ')}.
          </Text>
        </View>
      );
    }

    switch (item.workflow_status) {
      // ── 02 ASSESS ───────────────────────────────────────────────────────────
      case 'reported':
        return (
          <>
            <Text style={styles.fieldLabel}>ACKNOWLEDGEMENT NOTES</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Is the area safe? Is anyone still exposed?"
              placeholderTextColor={Colors.textMuted}
            />
            <PrimaryButton
              label={item.cta}
              onPress={() => {
                acknowledge(item.id, notes.trim() || undefined);
                setNotes('');
              }}
            />
          </>
        );

      // ── 03 RESPOND ──────────────────────────────────────────────────────────
      case 'acknowledged':
        return (
          <>
            <Text style={styles.hint}>
              Opening the investigation is what puts this visibly in INVESTIGATE while
              the work is happening, rather than jumping straight to a finished write-up.
            </Text>
            <PrimaryButton label={item.cta} onPress={() => startInvestigation(item.id)} />
          </>
        );

      // ── 04 INVESTIGATE ──────────────────────────────────────────────────────
      case 'under_investigation':
        return (
          <>
            <Text style={styles.hint}>
              Record the root cause and the corrective action. Raising the severity to
              high or critical sends it straight to the manager.
            </Text>
            <PrimaryButton label={item.cta} onPress={() => setInvestigating(item)} />
          </>
        );

      default:
        // 05 IMPROVE onwards is the CAPA owner's and the manager's. `can_act`
        // above catches that for a plain supervisor; this catches a role that
        // outranks the step but should still do it from the manager's screen.
        return (
          <View style={styles.blockedBox}>
            <Ionicons name="arrow-forward-circle-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.blockedText}>
              {item.action} — handled on the manager's screen.
            </Text>
          </View>
        );
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  const renderCard = (item: ReportNextActionItem) => {
    const isOpen = expandedId === item.id;
    const isBusy = busyId === item.id;

    return (
      <View key={item.id} style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            const opening = !isOpen;
            setExpanded(opening ? item.id : null);
            setNotes('');
            setDetail(null);
            if (opening) {
              api.getDetail(item.id).then(setDetail).catch(() => setDetail(null));
            }
          }}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.title} numberOfLines={isOpen ? undefined : 2}>
              {item.description || 'No description provided'}
            </Text>
            {!!item.priority && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: (PRIORITY_COLOR[item.priority] ?? Colors.textMuted) + '1A' },
                ]}
              >
                <Text style={[styles.badgeText, { color: PRIORITY_COLOR[item.priority] ?? Colors.textMuted }]}>
                  {item.priority}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.sub}>
            {item.reference}
            {item.severity_label ? ` · ${item.severity_label}` : ''}
            {item.waiting_since ? ` · ${timeAgo(item.waiting_since)}` : ''}
          </Text>

          <View style={styles.metaRow}>
            {!!item.station_name && (
              <Text style={styles.meta}>
                <Ionicons name="location-outline" size={11} color={Colors.textMuted} /> {item.station_name}
              </Text>
            )}
            {item.is_hipo && <Text style={[styles.meta, styles.metaStop]}>HIGH POTENTIAL</Text>}
            {item.is_recurring && <Text style={[styles.meta, styles.metaStop]}>RECURRING</Text>}
            {item.is_overdue && <Text style={[styles.meta, styles.metaStop]}>OVERDUE</Text>}
            {item.is_mine && <Text style={[styles.meta, styles.metaMine]}>NEEDS YOU</Text>}
          </View>

          {/* The line that answers "what now" without opening the card. */}
          <Text style={styles.owed}>
            <Text style={styles.owedStage}>
              {String(item.stage_number ?? '').padStart(2, '0')} {item.stage}
            </Text>
            {'  '}{item.action}
          </Text>
          <Text style={styles.waiting}>
            {item.is_mine
              ? 'Waiting on you'
              : item.handled_by_me
                ? `You are done — now with the ${item.owner_role.replace(/_/g, ' ')}`
                : `Waiting on the ${item.owner_role.replace(/_/g, ' ')}`}
            {item.unblocks ? ` → ${item.unblocks}` : ''}
          </Text>
        </TouchableOpacity>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.cardAction}
            onPress={() => {
              const opening = !isOpen;
              setExpanded(opening ? item.id : null);
              setNotes('');
              setDetail(null);
              if (opening) {
                api.getDetail(item.id).then(setDetail).catch(() => setDetail(null));
              }
            }}
          >
            <Ionicons
              name={isOpen ? 'chevron-up-outline' : 'document-text-outline'}
              size={15}
              color={Colors.primary}
            />
            <Text style={styles.cardActionText}>{isOpen ? 'Close' : 'Open'}</Text>
          </TouchableOpacity>

          <View style={styles.cardActionDivider} />

          <TouchableOpacity style={styles.cardAction} onPress={() => openTrack(item)}>
            <Ionicons name="git-commit-outline" size={15} color={Colors.primary} />
            <Text style={styles.cardActionText}>Track</Text>
          </TouchableOpacity>
        </View>

        {isOpen && (
          <View style={styles.formBox}>
            {/* The whole record, above whatever this stage is asking for.
                The card used to show a description and the next step, so the
                supervisor deciding what happens next could not see the
                consequence the reporter feared, their photos, the witnesses,
                or any earlier stage's work. Shared with the manager's screen
                so both roles read one record. */}
            {detail ? (
              <ReportRecordCard report={detail} />
            ) : (
              <ActivityIndicator color={Colors.primary} style={styles.detailSpinner} />
            )}

            <Text style={styles.actionHeading}>{item.detail}</Text>

            {/* An IMPROVE row names the action actually holding it, so a
                supervisor can chase the right person rather than the record. */}
            {!!item.subject && (
              <View style={styles.subjectBox}>
                <Text style={styles.subjectRef}>{item.subject.reference}</Text>
                <Text style={styles.subjectDesc}>{item.subject.description}</Text>
                {!!item.subject.due_date && (
                  <Text style={styles.subjectDue}>Due {item.subject.due_date}</Text>
                )}
              </View>
            )}

            {isBusy ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} />
            ) : (
              <>
                {renderStageForm(item)}
                {/* Only from the stages the supervisor holds. Offering it on a
                    record already with the manager would escalate it to the
                    person who is holding it. */}
                {item.can_act && SUPERVISOR_STATUSES.has(item.workflow_status ?? '') && (
                  <SecondaryButton label="Escalate to manager" onPress={() => confirmEscalate(item)} />
                )}
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const visible = tab === 'mine' ? mine : queue;

  return (
    <SafeAreaScreen style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <View style={styles.tabs}>
        {([
          ['mine', `Needs you (${mine.length})`],
          ['open', `All open (${queue.length})`],
          ['closed', 'Closed'],
        ] as Array<[Tab, string]>).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, visible.length === 0 && styles.scrollEmpty]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {error && <Text style={styles.error}>{error}</Text>}

        {tab === 'closed' ? (
          closed.length === 0 ? (
            <EmptyState
              icon="checkmark-done-outline"
              title="Nothing closed yet"
              subtitle="Records signed off by the manager appear here."
            />
          ) : (
            closed.map(r => (
              <View key={r.id} style={[styles.card, styles.cardClosed]}>
                <Text style={styles.title} numberOfLines={2}>
                  {r.description || 'No description provided'}
                </Text>
                <Text style={styles.sub}>
                  #{r.id}
                  {r.assessed_priority ? ` · ${r.assessed_priority}` : ''}
                  {r.reported_at ? ` · reported ${timeAgo(r.reported_at)}` : ''}
                </Text>
                <Text style={styles.closedLine}>Closed — all eight stages complete.</Text>
              </View>
            ))
          )
        ) : visible.length === 0 && !isLoading && !error ? (
          <EmptyState
            icon={emptyIcon}
            title={tab === 'mine' ? 'Nothing waiting on you' : emptyTitle}
            subtitle={
              tab === 'mine'
                ? 'Reports needing your acknowledgement, response or investigation appear here.'
                : 'New worker submissions will appear here for your review.'
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
            <Text style={styles.trackTitle}>{tracking?.reference}</Text>
            <Text style={styles.trackDesc} numberOfLines={3}>{tracking?.description}</Text>

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
                    : 'Nothing outstanding — this record is complete.'}
                </Text>
                <Text style={styles.trackOwner}>
                  {track.is_closed
                    ? 'Closed.'
                    : track.is_mine
                      ? 'Your step.'
                      : `With the ${(track.next_action?.owner_role ?? 'next role').replace(/_/g, ' ')}.`}
                  {track.next_action?.unblocks ? ` Clearing it opens ${track.next_action.unblocks}.` : ''}
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

      <InvestigationFormModal
        visible={investigating !== null}
        reportType={reportType}
        initialSeverity={investigating?.severity}
        reportLabel={`${investigating?.reference ?? ''} · ${investigating?.description ?? ''}`}
        isSubmitting={busyId !== null && busyId === investigating?.id}
        onCancel={() => setInvestigating(null)}
        onSubmit={submitInvestigation}
      />
    </SafeAreaScreen>
  );
}

// ── Small local controls ─────────────────────────────────────────────────────
function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onPress}>
      <Text style={styles.btnPrimaryText}>{label}</Text>
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
    marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#EEF2F7',
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
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.white },

  scroll: { padding: 16 },
  scrollEmpty: { flexGrow: 1, justifyContent: 'center' },
  error: { color: Colors.critical, fontSize: 13, marginBottom: 12, textAlign: 'center' },

  card: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardClosed: { opacity: 0.85 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { flex: 1, fontSize: 14.5, fontWeight: '700', color: Colors.textDark, lineHeight: 20 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  sub: { fontSize: 11.5, color: Colors.textMuted, marginTop: 4 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  meta: { fontSize: 10.5, color: Colors.textMuted, fontWeight: '700' },
  metaStop: { color: Colors.critical },
  metaMine: { color: Colors.primary },

  owed: { fontSize: 13, color: Colors.textDark, lineHeight: 18, marginTop: 2 },
  owedStage: { fontSize: 10.5, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5 },
  waiting: { fontSize: 11, color: Colors.textMuted, marginTop: 3, fontWeight: '600' },
  closedLine: { fontSize: 12, color: Colors.success, fontWeight: '700', marginTop: 2 },

  formBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  actionHeading: { fontSize: 12.5, color: Colors.textMid, lineHeight: 18, marginBottom: 10 },

  subjectBox: {
    backgroundColor: Colors.background, borderRadius: 10, padding: 11, marginBottom: 10,
  },
  subjectRef: { fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: 0.4 },
  subjectDesc: { fontSize: 12.5, color: Colors.textDark, lineHeight: 17, marginTop: 3 },
  subjectDue: { fontSize: 11, color: Colors.textMuted, marginTop: 3, fontWeight: '600' },

  detailSpinner: { marginVertical: 18 },
  fieldLabel: {
    fontSize: 11, fontWeight: '800', color: Colors.textMuted,
    letterSpacing: 0.5, marginBottom: 6,
  },
  hint: { fontSize: 11.5, color: Colors.textMuted, lineHeight: 16 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: Colors.textDark, backgroundColor: Colors.background,
  },
  multiline: { minHeight: 68, textAlignVertical: 'top' },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10, marginTop: 12,
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  btnGhost: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.textDark, fontSize: 13.5, fontWeight: '600' },

  blockedBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.background, borderRadius: 10, padding: 12,
  },
  blockedText: { flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
});
