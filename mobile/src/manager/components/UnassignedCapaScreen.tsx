import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, UserPlus } from "lucide-react-native";
import type { ScreenProps } from "./types";
import { apiClient } from "../../api/client";

/**
 * WF-04 step 05 — the actions nobody owns yet.
 *
 * An audit raises its corrective actions deliberately unassigned: the auditor
 * finds the non-conformance, and whoever runs the site decides who fixes it.
 * Until an owner is named the action is in nobody's "My Actions" list, and the
 * escalation chain — which is addressed off `responsible_person_id` — has
 * nobody to chase, so the first audience that hears about it is the Safety
 * Manager at 100% of the deadline. That gap is what this screen closes.
 *
 * The list is deliberately the *organisation's* unowned actions rather than
 * only the audit-raised ones. An incident CAPA left unassigned has exactly the
 * same problem, and splitting the queue by origin would mean two screens
 * answering one question.
 *
 * apiClient's interceptor already strips the {success, data} envelope, so
 * `res.data` is the payload — reaching for `res.data.data` here yields
 * undefined.
 */

interface UnassignedCapa {
  id: number;
  capa_ref: string | null;
  description: string | null;
  subject_family: string | null;
  status: string | null;
  step_label: string;
  priority_band: string | null;
  capa_type: string | null;
  due_date: string | null;
  elapsed_percent: number | null;
  is_overdue: boolean;
}

interface Owner {
  employee_id: number;
  name: string;
  department: string;
  role: string;
}

const PRIORITY_COLOR: Record<string, { bg: string; fg: string }> = {
  Critical: { bg: "#FEF2F2", fg: "#BE123C" },
  High: { bg: "#FFF7ED", fg: "#C2410C" },
  Standard: { bg: "#F1F5F9", fg: "#475569" },
};

function priorityStyle(band: string | null) {
  return PRIORITY_COLOR[band || "Standard"] || PRIORITY_COLOR.Standard;
}

function familyLabel(family: string | null) {
  if (!family) return "Report";
  return family.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function UnassignedCapaScreen(props: ScreenProps) {
  const { setCurrentScreen, showToast } = props;

  const [items, setItems] = useState<UnassignedCapa[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<UnassignedCapa | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get("/capa/all", {
        params: { page: 1, pageSize: 100, unassigned_only: true, include_closed: false },
      });
      setItems(res.data?.data ?? []);
      setError(null);
    } catch (e) {
      console.log("Failed to load unassigned CAPA:", e);
      setError("Could not load the queue. Pull down to try again.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      try {
        const res = await apiClient.get("/capa/assignable-owners");
        setOwners(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.log("Failed to load assignable owners:", e);
      }
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const assign = async (owner: Owner) => {
    if (!target) return;
    setSaving(owner.employee_id);
    try {
      await apiClient.post(`/capa/${target.id}/assign`, {
        responsible_person_id: owner.employee_id,
      });
      // Drop it from the queue rather than refetching the whole list: the row
      // has left this view by definition, and the queue is what the manager is
      // working down.
      setItems((prev) => prev.filter((c) => c.id !== target.id));
      showToast?.(`${target.capa_ref || `CAPA-${target.id}`} assigned to ${owner.name}`);
      setTarget(null);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      showToast?.(typeof detail === "string" ? detail : "Could not assign this action");
    } finally {
      setSaving(null);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentScreen("app")} style={styles.back}>
          <ArrowLeft size={22} color="#0B1C30" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Actions Waiting For An Owner</Text>
          <Text style={styles.sub}>
            Nothing chases an action with no owner — name one and the clock starts
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color="#0B3D91" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {error && <Text style={styles.error}>{error}</Text>}

          {!error && items.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Every open action has an owner</Text>
              <Text style={styles.emptyText}>
                Actions raised by an audit land here first. They stay until somebody
                is named accountable for the fix.
              </Text>
            </View>
          )}

          {items.map((c) => {
            const p = priorityStyle(c.priority_band);
            return (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.ref}>{c.capa_ref || `CAPA-${c.id}`}</Text>
                  <View style={[styles.pill, { backgroundColor: p.bg }]}>
                    <Text style={[styles.pillText, { color: p.fg }]}>
                      {c.priority_band || "Unscored"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.desc}>{c.description || "Corrective action"}</Text>

                <Text style={styles.meta}>
                  From {familyLabel(c.subject_family)} · {c.capa_type || "—"} · due{" "}
                  {c.due_date ? new Date(c.due_date).toLocaleDateString() : "not set"}
                </Text>
                {c.elapsed_percent !== null && (
                  <Text style={[styles.meta, c.is_overdue && styles.metaLate]}>
                    {c.is_overdue
                      ? "Past its deadline and still unassigned"
                      : `${c.elapsed_percent}% of its window has gone`}
                  </Text>
                )}

                <TouchableOpacity style={styles.assignBtn} onPress={() => setTarget(c)}>
                  <UserPlus size={16} color="#FFFFFF" />
                  <Text style={styles.assignBtnText}>Assign owner</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              Who owns {target?.capa_ref || "this action"}?
            </Text>
            <Text style={styles.sheetSub}>
              They are notified straight away, and the escalation chain starts
              measuring against them at 50% of the deadline.
            </Text>

            <ScrollView style={styles.ownerList}>
              {owners.length === 0 && (
                <Text style={styles.emptyText}>
                  No supervisors or safety managers are listed for this organisation.
                </Text>
              )}
              {owners.map((o) => (
                <TouchableOpacity
                  key={o.employee_id}
                  style={styles.ownerRow}
                  disabled={saving !== null}
                  onPress={() => assign(o)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ownerName}>{o.name}</Text>
                    <Text style={styles.ownerMeta}>
                      {o.role}
                      {o.department ? ` · ${o.department}` : ""}
                    </Text>
                  </View>
                  {saving === o.employee_id && <ActivityIndicator color="#0B3D91" />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.cancel} onPress={() => setTarget(null)} disabled={saving !== null}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F7FB" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0",
  },
  back: { padding: 4 },
  title: { fontSize: 17, fontWeight: "800", color: "#0B1C30" },
  sub: { fontSize: 11.5, color: "#63739B", marginTop: 2 },

  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  error: { fontSize: 13, color: "#BE123C", textAlign: "center", paddingVertical: 12 },

  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#0B1C30" },
  emptyText: { fontSize: 12.5, color: "#63739B", textAlign: "center", marginTop: 6, lineHeight: 18 },

  card: {
    backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#E2E8F0",
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ref: { fontSize: 12.5, fontWeight: "800", color: "#4A57B9" },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 10.5, fontWeight: "800" },
  desc: { fontSize: 14, color: "#0B1C30", marginTop: 8, lineHeight: 20 },
  meta: { fontSize: 11.5, color: "#63739B", marginTop: 6 },
  metaLate: { color: "#C2410C", fontWeight: "700" },
  assignBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#0B3D91", borderRadius: 10, paddingVertical: 11, marginTop: 12,
  },
  assignBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, maxHeight: "75%",
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: "#0B1C30" },
  sheetSub: { fontSize: 12, color: "#63739B", marginTop: 6, lineHeight: 17 },
  ownerList: { marginTop: 14 },
  ownerRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#EEF2F7",
  },
  ownerName: { fontSize: 14, fontWeight: "700", color: "#0B1C30" },
  ownerMeta: { fontSize: 11.5, color: "#63739B", marginTop: 2 },
  cancel: { alignItems: "center", paddingVertical: 14, marginTop: 6 },
  cancelText: { fontSize: 13.5, fontWeight: "700", color: "#63739B" },
});
