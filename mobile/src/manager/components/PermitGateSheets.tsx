import { useState } from "react";
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { CheckCircle2, ShieldAlert, X } from "lucide-react-native";
import { permitWorkflowService } from "../../services/permitWorkflowService";

/**
 * What the safety gates refused, and the one thing a manager can do about it.
 *
 * Both screens that approve a permit — the Permits tab and the Permit Approvals
 * tool — were doing `Alert.alert("Failed", e.response.data.detail)`. The gate
 * engine answers with an *object*: a message, the blocked reasons, and every
 * gate's verdict. Handing that to Alert renders nothing a manager can use, so
 * the whole of "no approved risk assessment covers this work" arrived on screen
 * as the word "Failed".
 *
 * Shared rather than copied because that is how it went wrong in the first
 * place: the two screens had drifted, and fixing one left the other — the one
 * people actually use — untouched.
 */

export interface GateResult {
  gate_key: string;
  verdict: string;
  reason: string;
  hard: boolean;
}

export interface BlockedApproval {
  id: number;
  gates: GateResult[];
}

/** Pull the gate detail out of a 403, or null if this was an ordinary error. */
export function gateDetailOf(error: any): GateResult[] | null {
  const detail = error?.response?.data?.detail;
  if (detail && typeof detail === "object" && Array.isArray(detail.gates)) {
    return detail.gates as GateResult[];
  }
  return null;
}

/** The six criteria, 0–20 each, as `rams_score` scores them. */
const RAMS_CRITERIA: Array<{ key: string; label: string }> = [
  { key: "hazard_identification", label: "Hazard identification" },
  { key: "control_adequacy", label: "Control adequacy" },
  { key: "competence_evidence", label: "Competence evidence" },
  { key: "equipment_suitability", label: "Equipment suitability" },
  { key: "emergency_arrangements", label: "Emergency arrangements" },
  { key: "supervision_arrangements", label: "Supervision arrangements" },
];

const BLANK: Record<string, number> = Object.fromEntries(RAMS_CRITERIA.map((c) => [c.key, 0]));

interface Props {
  blocked: BlockedApproval | null;
  onDismiss: () => void;
  /** Retry the approval once the blocking cause has been cleared. */
  onRetryApprove: (permitId: number) => void;
  showToast?: (msg: string) => void;
}

export function PermitGateSheets({ blocked, onDismiss, onRetryApprove, showToast }: Props) {
  const [scoring, setScoring] = useState<number | null>(null);
  const [criteria, setCriteria] = useState<Record<string, number>>(BLANK);
  const [saving, setSaving] = useState(false);

  const total = Object.values(criteria).reduce((a, b) => a + b, 0);
  const verdict = total >= 80 ? "approve" : total >= 60 ? "conditional" : "reject";

  const submitScore = async () => {
    if (scoring == null) return;
    setSaving(true);
    try {
      const r = await permitWorkflowService.scoreRams(scoring, criteria as any);
      const permitId = scoring;
      setScoring(null);
      setCriteria(BLANK);
      showToast?.(`RAMS ${r.total_score}/120 — ${r.verdict}`);
      if (r.verdict === "reject") {
        Alert.alert(
          "Method statement rejected",
          `${r.total_score}/120 is below 60. The gate will keep blocking until the method ` +
          "statement is improved and rescored.",
        );
        return;
      }
      onRetryApprove(permitId);
    } catch (e: any) {
      Alert.alert("Could not score", e?.response?.data?.detail || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const canScore = (blocked?.gates ?? []).some(
    (g) => g.gate_key === "rams_linked" && g.verdict === "block",
  );

  return (
    <>
      <Modal visible={blocked !== null} transparent animationType="slide" onRequestClose={onDismiss}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.head}>
              <ShieldAlert size={18} color="#BE123C" />
              <Text style={styles.title}>Blocked by the safety gates</Text>
            </View>
            <Text style={styles.sub}>
              PTW-{blocked?.id}. These run before a permit can be issued and cannot be
              overridden from here.
            </Text>

            {(blocked?.gates ?? []).map((g) => (
              <View key={g.gate_key} style={styles.gateRow}>
                {g.verdict === "block" ? (
                  <X size={14} color="#BE123C" />
                ) : g.verdict === "amber" ? (
                  <ShieldAlert size={14} color="#C2410C" />
                ) : (
                  <CheckCircle2 size={14} color="#16A34A" />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.gateName}>{g.gate_key.replace(/_/g, " ")}</Text>
                  <Text style={styles.gateReason}>{g.reason}</Text>
                </View>
              </View>
            ))}

            {/* The risk-assessment gate is the one this screen can clear.
                Competence, fatigue, SIMOPS and contractor approval are fixed
                elsewhere, and saying so beats offering a button that cannot. */}
            {canScore && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  const id = blocked!.id;
                  onDismiss();
                  setCriteria(BLANK);
                  setScoring(id);
                }}
              >
                <Text style={styles.primaryText}>Score the method statement</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.close} onPress={onDismiss}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={scoring !== null} transparent animationType="slide" onRequestClose={() => setScoring(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.title}>Method statement · PTW-{scoring}</Text>
            <Text style={styles.sub}>
              Six criteria, 0–20 each. 80+ clears the gate, 60–79 is conditional,
              under 60 is a rejection.
            </Text>

            <ScrollView style={{ maxHeight: 300 }}>
              {RAMS_CRITERIA.map((c) => (
                <View key={c.key} style={styles.criterion}>
                  <Text style={styles.criterionLabel}>{c.label}</Text>
                  <View style={styles.scaleRow}>
                    {[0, 4, 8, 12, 16, 20].map((n) => (
                      <TouchableOpacity
                        key={n}
                        style={[styles.pip, criteria[c.key] === n && styles.pipOn]}
                        onPress={() => setCriteria((prev) => ({ ...prev, [c.key]: n }))}
                      >
                        <Text style={[styles.pipText, criteria[c.key] === n && styles.pipTextOn]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <Text
              style={[
                styles.total,
                { color: verdict === "approve" ? "#15803D" : verdict === "conditional" ? "#C2410C" : "#BE123C" },
              ]}
            >
              {total}/120 — {verdict}
            </Text>

            <TouchableOpacity
              style={[styles.primaryBtn, saving && styles.busy]}
              onPress={submitScore}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.primaryText}>Save score and approve</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.close} onPress={() => setScoring(null)} disabled={saving}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: "85%",
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "800", color: "#0B1C30" },
  sub: { fontSize: 12, color: "#63739B", marginTop: 6, lineHeight: 17, marginBottom: 6 },
  gateRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#EEF2F7",
  },
  gateName: { fontSize: 12.5, fontWeight: "700", color: "#0B1C30", textTransform: "capitalize" },
  gateReason: { fontSize: 11.5, color: "#63739B", marginTop: 2, lineHeight: 16 },
  primaryBtn: {
    backgroundColor: "#0B3D91", borderRadius: 10, paddingVertical: 13,
    alignItems: "center", marginTop: 16,
  },
  primaryText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "800" },
  busy: { opacity: 0.6 },
  close: { alignItems: "center", paddingVertical: 14 },
  closeText: { fontSize: 13.5, fontWeight: "700", color: "#63739B" },
  criterion: { marginTop: 12 },
  criterionLabel: { fontSize: 12.5, fontWeight: "700", color: "#0B1C30", marginBottom: 6 },
  scaleRow: { flexDirection: "row", gap: 6 },
  pip: {
    flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#FFFFFF",
  },
  pipOn: { backgroundColor: "#0B3D91", borderColor: "#0B3D91" },
  pipText: { fontSize: 12, fontWeight: "700", color: "#63739B" },
  pipTextOn: { color: "#FFFFFF" },
  total: { fontSize: 14, fontWeight: "800", textAlign: "center", marginTop: 14 },
});
