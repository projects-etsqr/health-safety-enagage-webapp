import { useEffect, useState, useCallback } from "react";
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator,
  RefreshControl, Alert, Modal, TextInput,
} from "react-native";
import { ArrowLeft, Plus, FileText } from "lucide-react-native";
import type { ScreenProps } from "./types";
import { apiClient } from "../../api/client";
import { KeyboardAvoider, SafeAreaScreen } from "../../components/layout/KeyboardAvoider";

interface Policy {
  id: number;
  policy_name: string | null;
  category: string | null;
  issue_date: string | null;
  owner: string | null;
  status: string | null;
}

const CATEGORIES = ["Safety", "Environmental", "HR", "Operations"];
const STATUSES = ["Draft", "Active", "Under Review", "Archived"];

function statusColor(s: string | null) {
  switch ((s || "").toLowerCase()) {
    case "active": return { color: "#16A34A", bg: "#F0FDF4" };
    case "under review": return { color: "#CA8A04", bg: "#FEFCE8" };
    case "archived": return { color: "#64748B", bg: "#F1F5F9" };
    default: return { color: "#2563EB", bg: "#EFF6FF" };
  }
}

const todayISO = () => new Date().toISOString().split("T")[0];

export function PolicyManagementScreen({ setCurrentScreen, showToast }: ScreenProps) {
  const [rows, setRows] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  const [formVisible, setFormVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Set when editing an existing policy; null means "create new". */
  const [editingId, setEditingId] = useState<number | null>(null);

  const [policyName, setPolicyName] = useState("");
  const [category, setCategory] = useState("Safety");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("Draft");

  const load = useCallback(() => {
    setLoading(true);
    apiClient.get("/policys/")
      .then((r: any) => setRows(Array.isArray(r.data) ? r.data : (r.data?.items ?? [])))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditingId(null);
    setPolicyName("");
    setCategory("Safety");
    setIssueDate(todayISO());
    setOwner("");
    setStatus("Draft");
    setFormVisible(true);
  };

  const openEdit = (p: Policy) => {
    setEditingId(p.id);
    setPolicyName(p.policy_name ?? "");
    setCategory(p.category ?? "Safety");
    setIssueDate(p.issue_date ? String(p.issue_date).split("T")[0] : todayISO());
    setOwner(p.owner ?? "");
    setStatus(p.status ?? "Draft");
    setFormVisible(true);
  };

  const submit = async () => {
    if (!policyName.trim()) {
      Alert.alert("Required", "Enter a policy name.");
      return;
    }
    setSaving(true);
    const body = {
      policy_name: policyName.trim(),
      category,
      issue_date: issueDate || null,
      owner: owner.trim() || null,
      status,
    };
    try {
      if (editingId != null) {
        await apiClient.put(`/policys/${editingId}`, body);
        showToast?.(`Policy "${body.policy_name}" updated`);
      } else {
        await apiClient.post("/policys/", body);
        showToast?.(`Policy "${body.policy_name}" created`);
      }
      setFormVisible(false);
      load();
    } catch (e: any) {
      Alert.alert("Save Failed", e?.response?.data?.detail || "Could not save the policy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaScreen style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setCurrentScreen("app")}>
          <ArrowLeft size={22} color="#0B3D91" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Policy Management</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={openNew}>
          <Plus size={20} color="#0B3D91" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={["#0B3D91"]} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Policies ({rows.length})</Text>

        {loading && rows.length === 0 ? (
          <ActivityIndicator color="#0B3D91" style={{ marginTop: 30 }} />
        ) : rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <FileText size={44} color="#94A3B8" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No Policies</Text>
            <Text style={styles.emptyText}>Tap + to publish the first policy.</Text>
          </View>
        ) : (
          rows.map(p => {
            const sc = statusColor(p.status);
            return (
              <TouchableOpacity key={p.id} style={styles.card} onPress={() => openEdit(p)} activeOpacity={0.85}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{p.policy_name || `Policy ${p.id}`}</Text>
                  <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.badgeText, { color: sc.color }]}>
                      {(p.status || "DRAFT").toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>
                  {p.category || "—"}
                  {p.owner ? ` · ${p.owner}` : ""}
                  {p.issue_date ? ` · ${String(p.issue_date).split("T")[0]}` : ""}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <KeyboardAvoider style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{editingId != null ? "Edit Policy" : "New Policy"}</Text>
            <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>POLICY NAME *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Working at Height Policy"
                placeholderTextColor="#A0AEC0"
                value={policyName}
                onChangeText={setPolicyName}
              />

              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <View style={styles.pillWrap}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.pill, category === c && styles.pillActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.pillText, category === c && styles.pillTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>ISSUE DATE</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A0AEC0"
                value={issueDate}
                onChangeText={setIssueDate}
              />

              <Text style={styles.fieldLabel}>OWNER</Text>
              <TextInput
                style={styles.input}
                placeholder="Person or department"
                placeholderTextColor="#A0AEC0"
                value={owner}
                onChangeText={setOwner}
              />

              <Text style={styles.fieldLabel}>STATUS</Text>
              <View style={styles.pillWrap}>
                {STATUSES.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.pill, status === s && styles.pillActive]}
                    onPress={() => setStatus(s)}
                  >
                    <Text style={[styles.pillText, status === s && styles.pillTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setFormVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={submit} disabled={saving}>
                  {saving
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.saveBtnText}>{editingId != null ? "Save Changes" : "Create Policy"}</Text>}
                </TouchableOpacity>
              </View>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoider>
      </Modal>
    </SafeAreaScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7FC" },
  headerBar: {
    height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 16,
  },
  iconBtn: { padding: 8 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: "#0B3D91" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 13, fontWeight: "800", color: "#63739B",
    textTransform: "uppercase", marginBottom: 16, letterSpacing: 0.5,
  },
  emptyBox: {
    backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0",
    padding: 32, alignItems: "center", justifyContent: "center", marginTop: 20,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#2D3748", marginBottom: 6 },
  emptyText: { fontSize: 13, color: "#718096", textAlign: "center" },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0",
    padding: 16, marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: "#2D3748" },
  cardMeta: { fontSize: 12, color: "#718096", marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: "90%",
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: "#0B3D91", marginBottom: 4 },
  sheetScroll: { maxHeight: "100%" },
  fieldLabel: {
    fontSize: 11, fontWeight: "800", color: "#63739B",
    letterSpacing: 0.6, marginTop: 18, marginBottom: 8,
  },
  input: {
    borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12,
    paddingHorizontal: 14, height: 46, fontSize: 14, color: "#2D3748",
  },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 14, height: 38, borderRadius: 19,
    borderWidth: 1.5, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center",
  },
  pillActive: { backgroundColor: "#0B3D91", borderColor: "#0B3D91" },
  pillText: { fontSize: 13, fontWeight: "700", color: "#2D3748" },
  pillTextActive: { color: "#FFFFFF" },
  actions: { flexDirection: "row", gap: 12, marginTop: 28 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0",
    alignItems: "center", justifyContent: "center",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: "#718096" },
  saveBtn: {
    flex: 1.4, height: 48, borderRadius: 12, backgroundColor: "#0B3D91",
    alignItems: "center", justifyContent: "center",
  },
  saveBtnText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
});
