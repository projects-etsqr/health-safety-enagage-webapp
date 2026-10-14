import { useEffect, useState, useCallback } from "react";
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Alert, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, CheckCircle2, ShieldAlert, ShieldCheck, X } from "lucide-react-native";
import type { ScreenProps } from "./types";
import { permitWorkflowService } from "../../services/permitWorkflowService";
import { PermitGateSheets, gateDetailOf, type BlockedApproval } from "./PermitGateSheets";

export function PermitApprovalsView({ setCurrentScreen, showToast }: ScreenProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    permitWorkflowService.managerQueue()
      .then((q) => setItems(Array.isArray(q) ? q : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // What the gates refused. The sheet renders it; see PermitGateSheets for why
  // this is not an Alert.
  const [blocked, setBlocked] = useState<BlockedApproval | null>(null);

  const decide = async (id: number, approve: boolean) => {
    try {
      setBusy(id);
      if (approve) await permitWorkflowService.approve(id);
      else await permitWorkflowService.reject(id, "Rejected by manager");
      showToast?.(`Permit PTW-${id} ${approve ? "approved" : "rejected"}`);
      load();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      // The gate engine answers with an object: a message, the reasons, and
      // every gate's verdict. Rendering it into a card the manager can act on
      // is the difference between "Failed" and "no risk assessment covers this
      // work — score the method statement".
      const gates = gateDetailOf(e);
      if (gates) {
        setBlocked({ id, gates });
      } else {
        Alert.alert("Failed", typeof detail === "string" ? detail : "Could not update permit.");
      }
    } finally {
      setBusy(null);
    }
  };


  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen("app")}>
          <ArrowLeft size={22} color="#0B3D91" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Permit Approvals</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={["#0B3D91"]} />}
      >
        <Text style={styles.sectionTitle}>Awaiting Approval ({items.length})</Text>

        {loading && items.length === 0 ? (
          <ActivityIndicator color="#0B3D91" style={{ marginTop: 30 }} />
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <CheckCircle2 size={48} color="#10B981" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>All Clear</Text>
            <Text style={styles.emptyText}>All permits have been reviewed and resolved.</Text>
          </View>
        ) : (
          items.map((p) => {
            const exp = p.validity_end ? new Date(p.validity_end).toLocaleDateString() : null;
            // A permit the gates already refused. It sat at RESPOND, out of
            // every queue, until this one learned to show it — so it has to
            // arrive looking like what it is, not like one merely waiting.
            const isBlocked = p.workflow_status === "gate_blocked";
            return (
              <View key={p.id} style={[styles.card, isBlocked && styles.cardBlocked]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardId}>{p.permit_ref || `PTW-${p.id}`}</Text>
                  <View style={[styles.pendBadge, isBlocked && styles.blockBadge]}>
                    <Text style={[styles.pendText, isBlocked && styles.blockText]}>
                      {isBlocked ? "gate blocked" : (p.status || "pending").replace(/_/g, " ")}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardDesc}>{p.work_description || "Permit to Work"}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.metaText}>👤 Emp {p.requested_by ?? "—"}</Text>
                  {exp && <Text style={styles.metaText}>📅 Valid till {exp}</Text>}
                </View>
                {isBlocked && !!p.gate_blocked_reason && (
                  <View style={styles.blockedBox}>
                    <ShieldAlert size={13} color="#BE123C" />
                    <Text style={styles.blockedReason}>{p.gate_blocked_reason}</Text>
                  </View>
                )}
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => decide(p.id, false)} disabled={busy === p.id}>
                    <X size={15} color="#DC2626" /><Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => decide(p.id, true)} disabled={busy === p.id}>
                    {busy === p.id ? <ActivityIndicator size="small" color="#fff" /> : (
                      <>
                        <ShieldCheck size={15} color="#FFFFFF" />
                        <Text style={styles.approveText}>{isBlocked ? "Re-run gates" : "Approve"}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <PermitGateSheets
        blocked={blocked}
        onDismiss={() => setBlocked(null)}
        onRetryApprove={(permitId) => decide(permitId, true)}
        showToast={showToast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cardBlocked: { borderColor: "#FCA5A5", backgroundColor: "#FFFBFB" },
  blockBadge: { backgroundColor: "#FEE2E2" },
  blockText: { color: "#BE123C" },
  blockedBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10, marginBottom: 12,
  },
  blockedReason: { flex: 1, fontSize: 11.5, color: "#9F1239", lineHeight: 16 },


  container: { flex: 1, backgroundColor: "#F4F7FC" },
  headerBar: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 16 },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: "#0B3D91" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#63739B", textTransform: "uppercase", marginBottom: 16, letterSpacing: 0.5 },
  emptyBox: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", padding: 32, alignItems: "center", justifyContent: "center", marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#2D3748", marginBottom: 6 },
  emptyText: { fontSize: 13, color: "#718096", textAlign: "center", lineHeight: 18 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardId: { fontSize: 12, fontWeight: "800", color: "#63739B" },
  pendBadge: { backgroundColor: "#FFF7ED", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pendText: { fontSize: 10, fontWeight: "700", textTransform: "capitalize", color: "#EA580C" },
  cardDesc: { fontSize: 14, color: "#2D3748", fontWeight: "600", lineHeight: 20, marginBottom: 10 },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#EDF2F7", paddingBottom: 10, marginBottom: 12 },
  metaText: { fontSize: 12, color: "#718096" },
  btnRow: { flexDirection: "row", gap: 10 },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, height: 40, borderRadius: 10, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FCA5A5" },
  rejectText: { color: "#DC2626", fontSize: 13, fontWeight: "700" },
  approveBtn: { flex: 1.4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, height: 40, borderRadius: 10, backgroundColor: "#0B3D91" },
  approveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});
