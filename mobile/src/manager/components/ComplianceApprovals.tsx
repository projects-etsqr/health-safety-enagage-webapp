import { useEffect, useState, useCallback } from "react";
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Modal, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, CheckCircle2, ShieldAlert, XCircle } from "lucide-react-native";
import type { ScreenProps } from "./types";
import {
  capaWorkflowService,
  type CapaDetail,
  type CapaQueueItem,
} from "../../services/capaWorkflowService";

/**
 * WF-04 step 10 — the Safety Manager's final gate, and the only place an action
 * can be closed.
 *
 * This screen used to list every action that was not yet "Completed" and offer
 * a one-tap "Sign-off & Close" through `/incident-workflow/capa/{id}/complete`.
 * That is the exact behaviour the lifecycle document reverses: completing an
 * action no longer closes it. The owner submits evidence, the system validates
 * it against the action type and its date, an independent reviewer confirms the
 * control is physically in place, and only then is this approval offered. The
 * old route skipped all three, so an action could be closed with no evidence at
 * all and the checks existed only in the backend where nothing called them.
 *
 * So the queue is now `Pending Approval` — actions that have already passed the
 * three checks — and the approval re-runs them server-side anyway. A 400 here
 * is the system refusing, and its failures are shown rather than swallowed:
 * evidence can be added, and an owner reassigned, between the review and this
 * moment, and a gate that trusts a cached verdict is not a gate.
 *
 * The effectiveness rating is kept. WF-04 measures effectiveness with the
 * 30/60/90-day reviews scheduled at closure, not with a number typed here, but
 * `capa_actions.effectiveness_rating` is read by the incident trail and the
 * exports and the old sign-off was the only thing that ever wrote it.
 */
export function ComplianceApprovalsView({ setCurrentScreen, showToast }: ScreenProps) {
  const [items, setItems] = useState<CapaQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [target, setTarget] = useState<CapaQueueItem | null>(null);
  const [detail, setDetail] = useState<CapaDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rating, setRating] = useState(4);
  const [closureNotes, setClosureNotes] = useState("");
  const [lesson, setLesson] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await capaWorkflowService.queue("approval"));
      setError(null);
    } catch (e) {
      console.log("Failed to load closure approvals:", e);
      setItems([]);
      setError("Could not load the queue. Pull down to try again.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (row: CapaQueueItem) => {
    setTarget(row);
    setRating(4);
    setClosureNotes("");
    setLesson("");
    setSheetError(null);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await capaWorkflowService.detail(row.id));
    } catch (e) {
      console.log("Failed to load CAPA detail:", e);
    } finally {
      setDetailLoading(false);
    }
  };

  const decide = async (approved: boolean) => {
    if (!target) return;
    setBusy(true);
    setSheetError(null);
    try {
      await capaWorkflowService.approveClosure(target.id, {
        approved,
        closure_notes: closureNotes.trim() || undefined,
        lesson_learned: lesson.trim() || undefined,
        effectiveness_rating: approved ? rating : undefined,
      });
      setTarget(null);
      showToast?.(
        approved
          ? `${target.capa_ref || `CAPA-${target.id}`} closed — reviews at 30/60/90 days`
          : `${target.capa_ref || `CAPA-${target.id}`} sent back to the owner`,
      );
      load();
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      // The blocked-closure response is an object carrying the failing checks;
      // rendering [object Object] over it hid the only useful part.
      const failures: string[] = d?.failures || [];
      setSheetError(
        typeof d === "string"
          ? d
          : [d?.message || "Could not close this action.", ...failures].join("\n• "),
      );
    } finally {
      setBusy(false);
    }
  };

  const prioStyle = (p: string | null) => {
    const s = (p || "").toLowerCase();
    if (s.includes("crit")) return styles.critBg;
    if (s.includes("high")) return styles.hiBg;
    return styles.medBg;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen("app")}>
          <ArrowLeft size={22} color="#0B3D91" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Closure Approvals</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={["#0B3D91"]} />}
      >
        <Text style={styles.sectionTitle}>Passed all three checks ({items.length})</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {loading && items.length === 0 ? (
          <ActivityIndicator color="#0B3D91" style={{ marginTop: 30 }} />
        ) : items.length === 0 && !error ? (
          <View style={styles.emptyBox}>
            <CheckCircle2 size={48} color="#10B981" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Queue Cleared</Text>
            <Text style={styles.emptyText}>
              Nothing is waiting on your approval. Actions arrive here once the evidence
              has been validated and an independent reviewer has confirmed the control.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardId}>{item.capa_ref || `CAPA-${item.id}`}</Text>
                <View style={[styles.priorityBadge, prioStyle(item.priority_band)]}>
                  <Text style={styles.priorityText}>{item.priority_band || item.capa_type || "Action"}</Text>
                </View>
              </View>
              <Text style={styles.cardDesc}>{item.description}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>👤 {item.responsible_person_name || "Unassigned"}</Text>
                <Text style={[styles.metaText, item.is_overdue && { color: "#DC2626", fontWeight: "700" }]}>
                  📅 {item.due_date || "—"}
                </Text>
              </View>
              <TouchableOpacity style={styles.approveButton} onPress={() => open(item)}>
                <ShieldAlert size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.approveButtonText}>Review & Close</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={target != null} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <ScrollView>
              <Text style={styles.ratingTitle}>
                Close {target?.capa_ref || `CAPA-${target?.id}`}
              </Text>
              <Text style={styles.ratingSub}>{target?.description}</Text>

              {detailLoading && <ActivityIndicator color="#0B3D91" style={{ marginTop: 14 }} />}

              {detail && (
                <>
                  <Text style={styles.blockLabel}>The three checks</Text>
                  {detail.closure_checks.map((chk) => (
                    <View key={chk.key} style={styles.checkRow}>
                      {chk.passed
                        ? <CheckCircle2 size={15} color="#16A34A" />
                        : <XCircle size={15} color="#DC2626" />}
                      <Text style={styles.checkText}>{chk.label} — {chk.detail}</Text>
                    </View>
                  ))}

                  <Text style={styles.blockLabel}>Evidence ({detail.evidence.length})</Text>
                  {detail.evidence.length === 0 ? (
                    <Text style={styles.blockText}>Nothing attached.</Text>
                  ) : (
                    detail.evidence.map((e) => (
                      <Text key={e.id} style={styles.blockText}>
                        • {e.evidence_type.replace(/_/g, " ")}
                        {e.description ? ` — ${e.description}` : ""}
                      </Text>
                    ))
                  )}
                </>
              )}

              <Text style={styles.blockLabel}>Effectiveness rating</Text>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.ratingBtn, rating === n && styles.ratingBtnActive]}
                    onPress={() => setRating(n)}
                  >
                    <Text style={[styles.ratingBtnText, rating === n && styles.ratingBtnTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.ratingScaleRow}>
                <Text style={styles.ratingScaleText}>Not effective</Text>
                <Text style={styles.ratingScaleText}>Fully effective</Text>
              </View>

              <Text style={styles.blockLabel}>Closure notes</Text>
              <TextInput
                style={styles.input}
                value={closureNotes}
                onChangeText={setClosureNotes}
                multiline
                placeholder="What was done, and what you saw of it"
                placeholderTextColor="#A0AEC0"
              />

              <Text style={styles.blockLabel}>Lesson learned</Text>
              <TextInput
                style={styles.input}
                value={lesson}
                onChangeText={setLesson}
                multiline
                placeholder="What should be done differently elsewhere"
                placeholderTextColor="#A0AEC0"
              />

              {sheetError && <Text style={styles.sheetError}>{sheetError}</Text>}

              <TouchableOpacity
                style={[styles.confirmBtn, busy && styles.disabled]}
                onPress={() => decide(true)}
                disabled={busy}
              >
                {busy
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.confirmBtnText}>Approve & Close</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rejectBtn, busy && styles.disabled]}
                onPress={() => decide(false)}
                disabled={busy}
              >
                <Text style={styles.rejectBtnText}>Not good enough — send back to the owner</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setTarget(null)} disabled={busy}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7FC" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 22, maxHeight: "88%",
  },
  ratingTitle: { fontSize: 17, fontWeight: "800", color: "#0B3D91", marginBottom: 6 },
  ratingSub: { fontSize: 13, color: "#718096", lineHeight: 18 },
  blockLabel: {
    fontSize: 11, fontWeight: "800", color: "#63739B",
    textTransform: "uppercase", letterSpacing: 0.4, marginTop: 18, marginBottom: 6,
  },
  blockText: { fontSize: 12.5, color: "#2D3748", lineHeight: 18 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 5 },
  checkText: { flex: 1, fontSize: 12, color: "#2D3748", lineHeight: 17 },
  input: {
    borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 12,
    fontSize: 13.5, color: "#2D3748", minHeight: 64, textAlignVertical: "top",
  },
  ratingRow: { flexDirection: "row", gap: 8 },
  ratingBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  ratingBtnActive: { backgroundColor: "#0B3D91", borderColor: "#0B3D91" },
  ratingBtnText: { fontSize: 16, fontWeight: "800", color: "#2D3748" },
  ratingBtnTextActive: { color: "#FFFFFF" },
  ratingScaleRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  ratingScaleText: { fontSize: 10, fontWeight: "700", color: "#A0AEC0" },
  sheetError: { fontSize: 12.5, color: "#BE123C", marginTop: 14, lineHeight: 18 },
  disabled: { opacity: 0.5 },
  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: "#718096" },
  confirmBtn: { height: 48, borderRadius: 12, backgroundColor: "#16A34A", alignItems: "center", justifyContent: "center", marginTop: 20 },
  confirmBtnText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  rejectBtn: {
    height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: "#FCA5A5",
    alignItems: "center", justifyContent: "center", marginTop: 10,
  },
  rejectBtnText: { fontSize: 13, fontWeight: "700", color: "#BE123C" },
  headerBar: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 16 },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: "#0B3D91" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#63739B", textTransform: "uppercase", marginBottom: 16, letterSpacing: 0.5 },
  errorText: { fontSize: 13, color: "#BE123C", textAlign: "center", paddingVertical: 12 },
  emptyBox: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", padding: 32, alignItems: "center", justifyContent: "center", marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#2D3748", marginBottom: 6 },
  emptyText: { fontSize: 13, color: "#718096", textAlign: "center", lineHeight: 18 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardId: { fontSize: 12, fontWeight: "800", color: "#63739B" },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  critBg: { backgroundColor: "#FEE2E2" },
  hiBg: { backgroundColor: "#FFF7ED" },
  medBg: { backgroundColor: "#EFF6FF" },
  priorityText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", color: "#4A5568" },
  cardDesc: { fontSize: 14, color: "#2D3748", fontWeight: "600", lineHeight: 20, marginBottom: 10 },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#EDF2F7", paddingBottom: 10, marginBottom: 12 },
  metaText: { fontSize: 12, color: "#718096" },
  approveButton: { backgroundColor: "#3182CE", height: 40, borderRadius: 10, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  approveButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});
