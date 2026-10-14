import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AlertCircle, CheckCircle2, Eye, RotateCcw, ShieldCheck, TriangleAlert, UserPlus,
} from "lucide-react-native";
import type { ReportFamily, ScreenProps } from "../types";
import { StageTracker, type StageTrackerInfo } from "../StageTracker";
import {
  queueKey,
  useManagerReportQueue,
  type ManagerQueueItem,
} from "../../../hooks/useManagerReportQueue";
import {
  reportWorkflowService,
  type CapaOwner,
  type ReportDetail,
} from "../../../services/reportWorkflowService";
import { ReportRecordCard } from "../../../components/workflow/ReportRecordCard";
import { ReportClosureModal, type ClosureFormValues } from "../ReportClosureModal";
import { KeyboardAvoider } from "../../../components/layout/KeyboardAvoider";

/**
 * The manager's steps on worker-reported near misses, unsafe acts and risks.
 *
 * Previously every card offered the same two buttons — "send back" and
 * "approve & close" — regardless of where the record actually was. That pairing
 * only fits one stage. Closure requires the record to have reached LEARN, so
 * pressing "approve & close" on anything carrying a corrective action approved
 * the investigation and then failed the closure gate, leaving the record one
 * stage further on with an error the screen did not explain. Stages 05 IMPROVE
 * and 06 VERIFY had no representation here at all, so a near miss whose fix was
 * done sat waiting for a verification nothing on this screen could give.
 *
 * Each card now offers exactly the verb `/next-actions` says is outstanding,
 * and opening one draws the eight-stage tracker from the same resolver the
 * incident screen uses. The screen never decides what is owed; the backend does.
 */

const TYPE_META: Record<string, { label: string; icon: typeof AlertCircle; color: string }> = {
  near_miss: { label: "Near Miss", icon: TriangleAlert, color: "#F97316" },
  unsafe_act: { label: "Unsafe Act", icon: Eye, color: "#8B5CF6" },
  risk: { label: "Risk", icon: AlertCircle, color: "#DC2626" },
};

const PRIORITY_COLOR: Record<string, string> = {
  P1: "#DC2626", P2: "#EA580C", P3: "#CA8A04", P4: "#2563EB", P5: "#64748B",
};

const STAGE_TINT: Record<string, { bg: string; fg: string }> = {
  RECORD: { bg: "#EEF2FB", fg: "#4A57B9" },
  ASSESS: { bg: "#FEF3C7", fg: "#B45309" },
  RESPOND: { bg: "#FFEDD5", fg: "#EA580C" },
  INVESTIGATE: { bg: "#DBEAFE", fg: "#1D4ED8" },
  IMPROVE: { bg: "#E0E7FF", fg: "#4338CA" },
  VERIFY: { bg: "#DCFCE7", fg: "#15803D" },
  LEARN: { bg: "#F3E8FF", fg: "#7E22CE" },
  CLOSE: { bg: "#F1F5F9", fg: "#475569" },
};

export function TabB_ReportApprovals({ showToast, reportFamily, setReportFamily }: ScreenProps) {
  const { queue, isLoading, busyId, error, refresh, approve, verifyEffectiveness, completeCapa, close } =
    useManagerReportQueue();

  // Arriving from a Tasks card opens on that family; the pills stay so the
  // other two are still reachable from here rather than only from the card
  // that happens to have been tapped.
  const visible = reportFamily
    ? queue.filter((r) => r.report_type === reportFamily)
    : queue;
  const countOf = (family: string) => queue.filter((r) => r.report_type === family).length;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [closing, setClosing] = useState<ManagerQueueItem | null>(null);
  // The eight-stage track for the open card only. Fetched on expand rather than
  // for every row: it is one request per record and the list can be long.
  const [track, setTrack] = useState<StageTrackerInfo | null>(null);
  // The record itself, alongside the track. The manager was being asked to
  // approve an investigation while seeing only its description and the stage
  // it had reached — not the root cause, the reporter's photos, or anything
  // the supervisor had written.
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [verifyNotes, setVerifyNotes] = useState("");

  // Naming who does the work, from the record it came off. A risk observation
  // whose corrective action sits unowned is the common case this exists for:
  // the supervisor raised it, the manager is the one who knows whose job it is.
  const [assigning, setAssigning] = useState<ManagerQueueItem | null>(null);
  const [owners, setOwners] = useState<CapaOwner[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [savingOwner, setSavingOwner] = useState<number | null>(null);

  const openAssign = useCallback(async (item: ManagerQueueItem) => {
    setAssigning(item);
    setOwnersLoading(true);
    try {
      // Workers included: the person who will physically do it is often not a
      // supervisor, and the lifecycle has always allowed them to own it.
      setOwners(await reportWorkflowService(item.report_type).getCapaOwners(true));
    } catch {
      setOwners([]);
    } finally {
      setOwnersLoading(false);
    }
  }, []);

  const assignTo = async (owner: CapaOwner) => {
    if (!assigning?.subject) return;
    setSavingOwner(owner.employee_id);
    try {
      await reportWorkflowService(assigning.report_type)
        .assignCapa(assigning.subject.id, owner.employee_id);
      showToast?.(`${assigning.subject.reference} assigned to ${owner.name}`);
      setAssigning(null);
      refresh();
    } catch (e: any) {
      Alert.alert("Could not assign", e?.response?.data?.detail || "Please try again.");
    } finally {
      setSavingOwner(null);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const open = useCallback(async (item: ManagerQueueItem) => {
    const key = queueKey(item);
    if (expanded === key) {
      setExpanded(null);
      setTrack(null);
      setDetail(null);
      return;
    }
    setExpanded(key);
    setTrack(null);
    setDetail(null);
    setVerifyNotes("");
    const api = reportWorkflowService(item.report_type);
    // Settled rather than raced: the track and the record are independent, and
    // a card that can still be acted on is better than one that renders
    // nothing because one of the two requests failed.
    const [nextAction, record] = await Promise.allSettled([
      api.getNextAction(item.id),
      api.getDetail(item.id),
    ]);
    setTrack(nextAction.status === "fulfilled" ? nextAction.value : null);
    setDetail(record.status === "fulfilled" ? record.value : null);
  }, [expanded]);

  const confirmSendBack = (item: ManagerQueueItem) => {
    Alert.alert("Send back for redo?", "The supervisor will investigate this again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send back",
        style: "destructive",
        onPress: async () => {
          if (await approve(item, false)) showToast("Sent back to supervisor");
        },
      },
    ]);
  };

  const confirmFailedVerification = (item: ManagerQueueItem) => {
    Alert.alert(
      "The fix did not hold?",
      "This reopens the corrective actions and sends the record back to IMPROVE. Use it when the unsafe act is still live.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "It did not hold",
          style: "destructive",
          onPress: async () => {
            if (await verifyEffectiveness(item, false, verifyNotes.trim() || undefined)) {
              showToast("Returned to IMPROVE — actions reopened");
            }
          },
        },
      ],
    );
  };

  const submitClosure = async (values: ClosureFormValues) => {
    if (!closing) return;
    const item = closing;
    setClosing(null);
    if (await close(item, values)) showToast("Report closed");
  };

  // ══════════════════════════════════════════════════════════════════════════
  // The one action belonging to whichever stage the record is at
  // ══════════════════════════════════════════════════════════════════════════
  const renderStageAction = (item: ManagerQueueItem) => {
    switch (item.workflow_status) {
      // ── 04 INVESTIGATE ──────────────────────────────────────────────────────
      case "escalated":
      case "pending_approval":
        return (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.workflowBtn, styles.redoBtn]} onPress={() => confirmSendBack(item)}>
              <RotateCcw size={14} color="#B45309" style={{ marginRight: 4 }} />
              <Text style={styles.redoText}>Send back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.workflowBtn, styles.primaryBtn]}
              onPress={async () => {
                if (await approve(item, true)) showToast("Investigation approved");
              }}
            >
              <CheckCircle2 size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.primaryText}>Approve investigation</Text>
            </TouchableOpacity>
          </View>
        );

      // ── 05 IMPROVE ──────────────────────────────────────────────────────────
      case "capa_open":
        return (
          <>
            {item.subject ? (
              <View style={styles.subjectBox}>
                <Text style={styles.subjectRef}>{item.subject.reference}</Text>
                <Text style={styles.subjectDesc}>{item.subject.description}</Text>
                {!!item.subject.due_date && (
                  <Text style={styles.subjectDue}>Due {item.subject.due_date}</Text>
                )}
                {/* Who is actually doing it. An unowned action is chased by
                    nobody — the escalation chain is addressed off the owner —
                    so saying so plainly is half the point of this row. */}
                <Text
                  style={[
                    styles.subjectOwner,
                    !item.subject.responsible_person_name && styles.subjectUnowned,
                  ]}
                >
                  {item.subject.responsible_person_name
                    ? `Owner: ${item.subject.responsible_person_name}`
                    : "No owner yet — nothing is chasing this"}
                </Text>
                {item.subject.open_count > 1 && (
                  <Text style={styles.subjectDue}>
                    {item.subject.open_count} actions open — the record leaves IMPROVE when the
                    last one closes.
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.note}>A corrective action is outstanding.</Text>
            )}
            {!!item.subject && (
              <>
                <TouchableOpacity
                  style={[styles.workflowBtn, styles.assignBtn, styles.fullBtn]}
                  onPress={() => openAssign(item)}
                >
                  <UserPlus size={14} color="#0B3D91" style={{ marginRight: 4 }} />
                  <Text style={styles.assignText}>
                    {item.subject.responsible_person_name ? "Reassign" : "Assign to someone"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.workflowBtn, styles.primaryBtn, styles.fullBtn]}
                  onPress={async () => {
                    if (await completeCapa(item, item.subject!.id)) showToast("Action signed off");
                  }}
                >
                  <CheckCircle2 size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.primaryText}>Sign off {item.subject.reference}</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        );

      // ── 06 VERIFY ───────────────────────────────────────────────────────────
      case "pending_verification":
      case "investigated":
        return (
          <>
            <Text style={styles.fieldLabel}>WHAT DID YOU CHECK?</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              value={verifyNotes}
              onChangeText={setVerifyNotes}
              placeholder="How do you know the fix held? e.g. present on 3 consecutive inspections"
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.workflowBtn, styles.redoBtn]}
                onPress={() => confirmFailedVerification(item)}
              >
                <RotateCcw size={14} color="#B45309" style={{ marginRight: 4 }} />
                <Text style={styles.redoText}>It did not hold</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.workflowBtn, styles.primaryBtn]}
                onPress={async () => {
                  if (await verifyEffectiveness(item, true, verifyNotes.trim() || undefined)) {
                    showToast("Verified effective");
                  }
                }}
              >
                <ShieldCheck size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.primaryText}>It worked</Text>
              </TouchableOpacity>
            </View>
          </>
        );

      // ── 07 LEARN -> 08 CLOSE ────────────────────────────────────────────────
      case "approved":
        return (
          <TouchableOpacity
            style={[styles.workflowBtn, styles.closeBtn, styles.fullBtn]}
            onPress={() => setClosing(item)}
          >
            <CheckCircle2 size={14} color="#059669" style={{ marginRight: 4 }} />
            <Text style={styles.closeText}>Capture the lesson and close</Text>
          </TouchableOpacity>
        );

      default:
        return <Text style={styles.note}>{item.action}</Text>;
    }
  };

  const renderCard = (item: ManagerQueueItem) => {
    const meta = TYPE_META[item.report_type] ?? TYPE_META.risk;
    const Icon = meta.icon;
    const key = queueKey(item);
    const isBusy = busyId === key;
    const isOpen = expanded === key;
    const tint = STAGE_TINT[item.stage ?? ""] ?? STAGE_TINT.RECORD;

    return (
      <TouchableOpacity key={key} style={styles.card} activeOpacity={0.85} onPress={() => open(item)}>
        <View style={styles.cardHeader}>
          <View style={styles.idRow}>
            <Icon size={16} color={meta.color} style={{ marginRight: 6 }} />
            <Text style={styles.cardId}>
              {meta.label} · {item.reference}
            </Text>
          </View>
          <View style={styles.badgeRow}>
            {!!item.priority && (
              <View style={[styles.prio, { backgroundColor: PRIORITY_COLOR[item.priority] ?? "#64748B" }]}>
                <Text style={styles.prioText}>{item.priority}</Text>
              </View>
            )}
            <View style={[styles.stageChip, { backgroundColor: tint.bg }]}>
              <Text style={[styles.stageChipText, { color: tint.fg }]}>
                {String(item.stage_number ?? "").padStart(2, "0")} {item.stage}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.cardDesc} numberOfLines={isOpen ? undefined : 3}>
          {item.description || "No description provided"}
        </Text>

        <View style={styles.flagRow}>
          {item.is_hipo && <Text style={styles.flag}>HIGH POTENTIAL</Text>}
          {item.is_recurring && <Text style={styles.flag}>RECURRING</Text>}
          {item.is_overdue && <Text style={styles.flag}>OVERDUE</Text>}
        </View>

        <Text style={styles.cardStatus}>{item.action}</Text>

        {isOpen && (
          <View style={styles.body}>
            {track ? (
              <StageTracker info={track} />
            ) : (
              <ActivityIndicator color="#0B3D91" style={{ marginVertical: 10 }} />
            )}
            {detail && <ReportRecordCard report={detail} />}
            <Text style={styles.detail}>{item.detail}</Text>
            {isBusy ? (
              <ActivityIndicator style={styles.busy} color="#0B3D91" />
            ) : (
              renderStageAction(item)
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoider>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.familyRow}>
          {([null, "near_miss", "unsafe_act", "risk"] as Array<ReportFamily | null>).map((f) => {
            const label = f ? TYPE_META[f].label : "All";
            const count = f ? countOf(f) : queue.length;
            const on = reportFamily === f;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.familyPill, on && styles.familyPillOn]}
                onPress={() => setReportFamily(f)}
              >
                <Text style={[styles.familyPillText, on && styles.familyPillTextOn]}>
                  {label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionHeader}>Waiting on you</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {visible.length === 0 && !isLoading && !error ? (
          <View style={styles.empty}>
            <CheckCircle2 size={40} color="#A0AEC0" />
            <Text style={styles.emptyTitle}>
              {reportFamily ? `No ${TYPE_META[reportFamily].label.toLowerCase()}es waiting on you` : "Nothing waiting on you"}
            </Text>
            <Text style={styles.emptySub}>
              Reports appear here once a supervisor escalates or finishes investigating, and again
              when their corrective action is ready to verify.
            </Text>
          </View>
        ) : (
          visible.map(renderCard)
        )}

        <Modal
          visible={assigning !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setAssigning(null)}
        >
          <View style={styles.ownerBackdrop}>
            <View style={styles.ownerSheet}>
              <Text style={styles.ownerTitle}>
                Who does {assigning?.subject?.reference}?
              </Text>
              <Text style={styles.ownerSub}>
                {assigning?.subject?.description}
                {"\n\n"}They are notified straight away, and it appears in their own
                actions list. The escalation chain starts measuring against them at
                50% of the deadline.
              </Text>

              {ownersLoading ? (
                <ActivityIndicator color="#0B3D91" style={{ marginVertical: 24 }} />
              ) : (
                <ScrollView>
                  {owners.length === 0 && (
                    <Text style={styles.ownerSub}>
                      Nobody in this organisation can be assigned. Check that the
                      employee records are in the same organisation as the logins.
                    </Text>
                  )}
                  {owners.map((o) => (
                    <TouchableOpacity
                      key={o.employee_id}
                      style={styles.ownerRow}
                      disabled={savingOwner !== null}
                      onPress={() => assignTo(o)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ownerName}>{o.name}</Text>
                        <Text style={styles.ownerMeta}>
                          {o.role.replace(/_/g, " ")}
                          {o.department ? ` · ${o.department}` : ""}
                        </Text>
                      </View>
                      {savingOwner === o.employee_id && <ActivityIndicator color="#0B3D91" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <TouchableOpacity
                style={styles.ownerCancel}
                onPress={() => setAssigning(null)}
                disabled={savingOwner !== null}
              >
                <Text style={styles.ownerCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <ReportClosureModal
          visible={closing !== null}
          reportLabel={
            closing
              ? `${TYPE_META[closing.report_type]?.label ?? "Report"} ${closing.reference} · ${closing.description ?? ""}`
              : ""
          }
          isSubmitting={busyId !== null && closing !== null && busyId === queueKey(closing)}
          onCancel={() => setClosing(null)}
          onSubmit={submitClosure}
        />
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  subjectOwner: { fontSize: 11.5, color: "#334155", marginTop: 4, fontWeight: "600" },
  subjectUnowned: { color: "#BE123C" },
  assignBtn: { backgroundColor: "#EEF2FB", borderWidth: 1, borderColor: "#C7D2FE" },
  assignText: { fontSize: 12.5, fontWeight: "700", color: "#0B3D91" },

  ownerBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  ownerSheet: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, maxHeight: "75%",
  },
  ownerTitle: { fontSize: 16, fontWeight: "800", color: "#0B1C30" },
  ownerSub: { fontSize: 12, color: "#63739B", marginTop: 6, lineHeight: 17 },
  ownerRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#EEF2F7",
  },
  ownerName: { fontSize: 14, fontWeight: "700", color: "#0B1C30" },
  ownerMeta: { fontSize: 11.5, color: "#63739B", marginTop: 2 },
  ownerCancel: { alignItems: "center", paddingVertical: 14, marginTop: 6 },
  ownerCancelText: { fontSize: 13.5, fontWeight: "700", color: "#63739B" },

  familyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  familyPill: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#FFFFFF",
  },
  familyPillOn: { backgroundColor: "#0B3D91", borderColor: "#0B3D91" },
  familyPillText: { fontSize: 11.5, fontWeight: "700", color: "#63739B" },
  familyPillTextOn: { color: "#FFFFFF" },

  container: { padding: 16, flexGrow: 1 },
  sectionHeader: {
    fontSize: 12, fontWeight: "800", color: "#63739B",
    textTransform: "uppercase", marginBottom: 16, letterSpacing: 0.5,
  },
  error: { color: "#DC2626", fontSize: 12, marginBottom: 12, textAlign: "center" },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0",
    padding: 16, marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10, gap: 8,
  },
  idRow: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  cardId: { fontSize: 11, fontWeight: "800", color: "#63739B" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  prio: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  prioText: { fontSize: 9, fontWeight: "800", color: "#FFFFFF" },
  stageChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stageChipText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },

  cardDesc: { fontSize: 13, color: "#4A5568", lineHeight: 18, marginBottom: 6 },
  flagRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  flag: { fontSize: 9.5, fontWeight: "800", color: "#B91C1C", letterSpacing: 0.3 },
  cardStatus: {
    fontSize: 12.5, fontWeight: "700", color: "#0B1C30", marginTop: 8,
  },

  body: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#EDF1F7", paddingTop: 14 },
  detail: { fontSize: 12, color: "#64748B", lineHeight: 17, marginBottom: 12 },
  note: { fontSize: 12.5, color: "#64748B", lineHeight: 18 },
  busy: { alignSelf: "flex-start" },

  subjectBox: { backgroundColor: "#F7F9FE", borderRadius: 10, padding: 11, marginBottom: 10 },
  subjectRef: { fontSize: 11, fontWeight: "800", color: "#0B3D91", letterSpacing: 0.4 },
  subjectDesc: { fontSize: 12.5, color: "#0B1C30", lineHeight: 17, marginTop: 3 },
  subjectDue: { fontSize: 11, color: "#64748B", marginTop: 3, fontWeight: "600" },

  fieldLabel: {
    fontSize: 10, fontWeight: "800", color: "#94A3B8",
    letterSpacing: 0.5, marginBottom: 6,
  },
  input: {
    borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5,
    color: "#0B1C30", backgroundColor: "#F8FAFC",
  },
  multiline: { minHeight: 64, textAlignVertical: "top", marginBottom: 4 },

  actionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  workflowBtn: {
    flex: 1, height: 38, borderRadius: 8, borderWidth: 1,
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    paddingHorizontal: 8,
  },
  fullBtn: { flex: 0, marginTop: 8 },
  redoBtn: { borderColor: "#FDE68A", backgroundColor: "#FFFBEB" },
  redoText: { color: "#B45309", fontSize: 12, fontWeight: "700" },
  primaryBtn: { borderColor: "#0B3D91", backgroundColor: "#0B3D91" },
  primaryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  closeBtn: { borderColor: "#A7F3D0", backgroundColor: "#ECFDF5" },
  closeText: { color: "#059669", fontSize: 12, fontWeight: "700" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#4A5568", textAlign: "center" },
  emptySub: { fontSize: 13, color: "#718096", textAlign: "center", lineHeight: 18 },
});
