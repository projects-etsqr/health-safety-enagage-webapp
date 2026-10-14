import { useEffect, useState, useCallback } from "react";
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator,
  RefreshControl, Alert, Modal, TextInput,
} from "react-native";
import { ArrowLeft, Plus, ShieldAlert, ChevronRight, AlertTriangle } from "lucide-react-native";
import type { ScreenProps } from "./types";
import { StageTracker } from "./StageTracker";
import { HazardRecordCard } from "../../components/workflow/HazardRecordCard";
import { apiClient } from "../../api/client";
import {
  CONTROL_HIERARCHY, HAZARD_STATUS_LABEL, HIERARCHY_LABEL,
  hazardRegisterService,
  type ControlHierarchy, type HazardNextAction, type HazardRegisterItem,
} from "../../services/hazardRegisterService";
import { WORKFLOW_STAGES, type WorkflowStageKey } from "../../services/workflowStages";
import { KeyboardAvoider, SafeAreaScreen } from "../../components/layout/KeyboardAvoider";

/**
 * The unsafe act register, driven by the eight-stage workflow engine.
 *
 * Previously this screen was a flat list plus an "add" form: it knew four
 * statuses, rendered no stage, and offered no way to move a hazard along. The
 * backend has carried all eight stages since migration 066, so a manager could
 * see that a hazard existed but could not assess, contain, control, verify or
 * close one from the app at all.
 *
 * Opening a hazard now shows the same tracker the incident screen uses and
 * exactly one action — whichever the backend says is outstanding. The screen
 * never decides that itself; `/hazard-register/{id}/next-action` does, so this
 * and the manager's queue can never disagree about what is owed.
 */

const SEVERITIES = ["Low", "Medium", "High", "Critical"];
const PROBABILITIES = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];

interface Station { id: number; station_name: string }
interface Category { id: number; category_name?: string; name?: string }

function severityColor(s: string | null) {
  switch ((s || "").toLowerCase()) {
    case "critical": return { color: "#B91C1C", bg: "#FEF2F2" };
    case "high": return { color: "#EA580C", bg: "#FFF7ED" };
    case "medium": return { color: "#CA8A04", bg: "#FEFCE8" };
    default: return { color: "#16A34A", bg: "#F0FDF4" };
  }
}

const PRIORITY_COLOR: Record<string, string> = {
  P1: "#DC2626", P2: "#EA580C", P3: "#CA8A04", P4: "#2563EB", P5: "#64748B",
};

/** Stage filter chips. "All" first, then only the stages a hazard can sit in. */
const FILTER_STAGES: Array<{ key: WorkflowStageKey | "ALL"; label: string }> = [
  { key: "ALL", label: "All" },
  ...WORKFLOW_STAGES.filter(s => s !== "RECORD").map(s => ({
    key: s as WorkflowStageKey,
    label: s.charAt(0) + s.slice(1).toLowerCase(),
  })),
];

export function HazardRegisterScreen({ setCurrentScreen, showToast }: ScreenProps) {
  const [rows, setRows] = useState<HazardRegisterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<WorkflowStageKey | "ALL">("ALL");
  const [stats, setStats] = useState<Record<string, number>>({});

  // ── Detail / action sheet ──────────────────────────────────────────────────
  const [selected, setSelected] = useState<HazardRegisterItem | null>(null);
  const [nextAction, setNextAction] = useState<HazardNextAction | null>(null);
  const [acting, setActing] = useState(false);

  // Stage-form fields. One set reused across stages — only one form is ever open.
  const [severity, setSeverity] = useState("Medium");
  const [probability, setProbability] = useState("Possible");
  const [personsExposed, setPersonsExposed] = useState("");
  const [workStopped, setWorkStopped] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [hierarchy, setHierarchy] = useState<ControlHierarchy>("engineering");
  const [ppeJustification, setPpeJustification] = useState("");

  // ── New-hazard form ────────────────────────────────────────────────────────
  const [formVisible, setFormVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hazardName, setHazardName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [stationId, setStationId] = useState<number | null>(null);
  const [controls, setControls] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    hazardRegisterService
      .list(stageFilter === "ALL" ? { limit: 200 } : { stage: stageFilter, limit: 200 })
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
    hazardRegisterService.stats()
      .then(s => setStats(s.by_stage ?? {}))
      .catch(() => setStats({}));
  }, [stageFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiClient.get("/working-stations/")
      .then((r: any) => {
        const list: Station[] = Array.isArray(r.data) ? r.data : [];
        setStations(list);
        setStationId(prev => prev ?? list[0]?.id ?? null);
      })
      .catch(() => setStations([]));
    apiClient.get("/hazard-categorys/")
      .then((r: any) => setCategories(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCategories([]));
  }, []);

  // ── Open one hazard ────────────────────────────────────────────────────────
  const open = async (hazard: HazardRegisterItem) => {
    setSelected(hazard);
    setNextAction(null);
    // Seed the stage form from the hazard so the assessor is correcting the
    // reporter's figures rather than retyping them.
    setSeverity(hazard.severity ?? "Medium");
    setProbability(hazard.probability ?? "Possible");
    setPersonsExposed(hazard.persons_exposed != null ? String(hazard.persons_exposed) : "");
    setWorkStopped(Boolean(hazard.work_stopped));
    setFreeText("");
    setHierarchy("engineering");
    setPpeJustification("");
    try {
      setNextAction(await hazardRegisterService.getNextAction(hazard.id));
    } catch {
      setNextAction(null);
    }
  };

  const refreshSelected = (updated: HazardRegisterItem) => {
    setSelected(updated);
    setFreeText("");
    setPpeJustification("");
    hazardRegisterService.getNextAction(updated.id).then(setNextAction).catch(() => setNextAction(null));
    load();
  };

  /** Run one stage verb, surfacing the backend's own refusal wording. */
  const runStage = async (fn: () => Promise<HazardRegisterItem>, successMsg: string) => {
    setActing(true);
    try {
      const updated = await fn();
      showToast?.(successMsg);
      refreshSelected(updated);
    } catch (e: any) {
      // The backend's gate messages name the stage and why it refused, which is
      // more useful than anything this screen could invent.
      Alert.alert("Cannot do that yet", e?.response?.data?.detail || "The action failed.");
    } finally {
      setActing(false);
    }
  };

  const submitNew = async () => {
    if (!hazardName.trim()) {
      Alert.alert("Required", "Enter an unsafe act name.");
      return;
    }
    setSaving(true);
    try {
      await hazardRegisterService.log({
        hazard_name: hazardName.trim(),
        category_id: categoryId ?? undefined,
        description: description.trim() || undefined,
        severity,
        probability,
        location_station_id: stationId ?? undefined,
        controls: controls.trim() || undefined,
        persons_exposed: personsExposed ? Number(personsExposed) : undefined,
      });
      showToast?.(`Unsafe act "${hazardName.trim()}" logged — awaiting assessment`);
      setFormVisible(false);
      setHazardName(""); setDescription(""); setControls("");
      setSeverity("Medium"); setProbability("Possible"); setPersonsExposed("");
      load();
    } catch (e: any) {
      Alert.alert("Save Failed", e?.response?.data?.detail || "Could not log the unsafe act.");
    } finally {
      setSaving(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // The one form belonging to whichever stage the hazard is at
  // ══════════════════════════════════════════════════════════════════════════
  const renderStageForm = () => {
    if (!selected || !nextAction?.next_action) return null;
    const id = selected.id;
    const status = selected.register_status;

    if (!nextAction.can_act) {
      return (
        <View style={styles.blockedBox}>
          <Text style={styles.blockedText}>
            This step belongs to the {nextAction.next_action.owner_role.replace("_", " ")}.
            You can see it, but not act on it.
          </Text>
        </View>
      );
    }

    switch (status) {
      // ── 02 ASSESS ────────────────────────────────────────────────────────
      case "open":
        return (
          <>
            <Text style={styles.fieldLabel}>SEVERITY</Text>
            <Pills options={SEVERITIES} value={severity} onChange={setSeverity} />
            <Text style={styles.fieldLabel}>PROBABILITY</Text>
            <Pills options={PROBABILITIES} value={probability} onChange={setProbability} />
            <Text style={styles.fieldLabel}>PEOPLE EXPOSED</Text>
            <TextInput
              style={styles.input} keyboardType="number-pad" placeholder="e.g. 6"
              placeholderTextColor="#A0AEC0" value={personsExposed} onChangeText={setPersonsExposed}
            />
            <Toggle
              label="Work stopped because of this unsafe act"
              hint="Stopping the job routes the unsafe act to RESPOND so containment is recorded before the review."
              value={workStopped}
              onChange={setWorkStopped}
            />
            <Text style={styles.fieldLabel}>ASSESSMENT NOTES</Text>
            <TextInput
              style={[styles.input, styles.multiline]} multiline value={freeText}
              onChangeText={setFreeText} placeholder="What did you find on inspection?"
              placeholderTextColor="#A0AEC0"
            />
            <PrimaryButton
              busy={acting} label={nextAction.next_action.cta}
              onPress={() => runStage(
                () => hazardRegisterService.assess(id, {
                  severity, probability,
                  persons_exposed: personsExposed ? Number(personsExposed) : undefined,
                  work_stopped: workStopped,
                  assessment_notes: freeText.trim() || undefined,
                }),
                "Unsafe act assessed",
              )}
            />
          </>
        );

      // ── 03 RESPOND ───────────────────────────────────────────────────────
      case "interim_control":
        return (
          <>
            <Text style={styles.fieldLabel}>INTERIM CONTROL</Text>
            <TextInput
              style={[styles.input, styles.multiline]} multiline value={freeText}
              onChangeText={setFreeText}
              placeholder="What is holding this unsafe act right now? e.g. isolated and barriered"
              placeholderTextColor="#A0AEC0"
            />
            <View style={styles.btnRow}>
              <SecondaryButton
                label="Record control"
                onPress={() => {
                  if (!freeText.trim()) { Alert.alert("Required", "Describe the interim control."); return; }
                  runStage(
                    () => hazardRegisterService.interimControl(id, { interim_control: freeText.trim() }),
                    "Interim control recorded",
                  );
                }}
              />
              <PrimaryButton
                busy={acting} label={nextAction.next_action.cta}
                onPress={() => runStage(
                  () => hazardRegisterService.startReview(id, freeText.trim() || undefined),
                  "Control review opened",
                )}
              />
            </View>
          </>
        );

      // ── 04 INVESTIGATE ───────────────────────────────────────────────────
      case "under_review":
        return (
          <>
            <Text style={styles.fieldLabel}>ROOT CAUSE</Text>
            <TextInput
              style={[styles.input, styles.multiline]} multiline value={freeText}
              onChangeText={setFreeText}
              placeholder="Why does this unsafe act exist? Not what it is — why it is here."
              placeholderTextColor="#A0AEC0"
            />
            {!!selected.root_cause && (
              <Text style={styles.recorded}>Recorded: {selected.root_cause}</Text>
            )}
            <SecondaryButton
              label="Save root cause"
              onPress={() => {
                if (!freeText.trim()) { Alert.alert("Required", "Enter the root cause."); return; }
                runStage(
                  () => hazardRegisterService.recordFindings(id, { root_cause: freeText.trim() }),
                  "Root cause recorded",
                );
              }}
            />

            <Text style={styles.fieldLabel}>PERMANENT CONTROL</Text>
            <TextInput
              style={[styles.input, styles.multiline]} multiline value={ppeJustification}
              onChangeText={setPpeJustification}
              placeholder="What will remove or reduce the unsafe act for good?"
              placeholderTextColor="#A0AEC0"
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
                const plan = ppeJustification.trim();
                if (!plan) { Alert.alert("Required", "Describe the permanent control."); return; }
                if (hierarchy === "ppe" && !freeText.trim()) {
                  Alert.alert(
                    "Justification required",
                    "PPE is the weakest control. Use the root-cause box to state why a stronger control is not reasonably practicable.",
                  );
                  return;
                }
                runStage(
                  () => hazardRegisterService.planControls(id, {
                    planned_controls: plan,
                    control_hierarchy: hierarchy,
                    ppe_justification: hierarchy === "ppe" ? freeText.trim() : undefined,
                  }),
                  "Permanent control planned",
                );
              }}
            />
          </>
        );

      // ── 05 IMPROVE ───────────────────────────────────────────────────────
      case "controls_planned":
        return (
          <>
            <Text style={styles.readonlyLabel}>PLANNED CONTROL</Text>
            <Text style={styles.readonlyValue}>{selected.planned_controls || "—"}</Text>
            {!!selected.control_hierarchy && (
              <Text style={styles.recorded}>
                Level: {HIERARCHY_LABEL[selected.control_hierarchy as ControlHierarchy] ?? selected.control_hierarchy}
              </Text>
            )}
            {(selected.verification_failures ?? 0) > 0 && (
              <View style={styles.warnBox}>
                <AlertTriangle size={14} color="#B45309" />
                <Text style={styles.warnText}>
                  This control has already failed verification {selected.verification_failures}×.
                </Text>
              </View>
            )}
            <Text style={styles.fieldLabel}>IMPLEMENTATION NOTES</Text>
            <TextInput
              style={[styles.input, styles.multiline]} multiline value={freeText}
              onChangeText={setFreeText}
              placeholder="Confirm the control is physically in place, and when."
              placeholderTextColor="#A0AEC0"
            />
            <PrimaryButton
              busy={acting} label={nextAction.next_action.cta}
              onPress={() => runStage(
                () => hazardRegisterService.submitForVerification(id, freeText.trim() || undefined),
                "Submitted for verification",
              )}
            />
          </>
        );

      // ── 06 VERIFY ────────────────────────────────────────────────────────
      case "pending_verification":
        return (
          <>
            <Text style={styles.readonlyLabel}>CONTROL TO VERIFY</Text>
            <Text style={styles.readonlyValue}>{selected.planned_controls || "—"}</Text>
            <Text style={styles.fieldLabel}>WHAT DID YOU CHECK?</Text>
            <TextInput
              style={[styles.input, styles.multiline]} multiline value={freeText}
              onChangeText={setFreeText}
              placeholder="How was the control tested, and what was the result?"
              placeholderTextColor="#A0AEC0"
            />
            <Text style={styles.hint}>
              Answering "did not hold" returns the hazard to IMPROVE. A control that
              failed means the hazard is still live.
            </Text>
            <View style={styles.btnRow}>
              <DangerButton
                label="Did not hold"
                onPress={() => runStage(
                  () => hazardRegisterService.verifyControls(id, {
                    effective: false, verification_notes: freeText.trim() || undefined,
                  }),
                  "Returned to IMPROVE — control did not hold",
                )}
              />
              <PrimaryButton
                busy={acting} label="Control held"
                onPress={() => runStage(
                  () => hazardRegisterService.verifyControls(id, {
                    effective: true, verification_notes: freeText.trim() || undefined,
                  }),
                  "Control verified effective",
                )}
              />
            </View>
          </>
        );

      // ── 07 LEARN → 08 CLOSE ──────────────────────────────────────────────
      case "controlled":
        return (
          <>
            <Text style={styles.fieldLabel}>LESSON LEARNED</Text>
            <TextInput
              style={[styles.input, styles.multiline]} multiline value={freeText}
              onChangeText={setFreeText}
              placeholder="What should change elsewhere so this unsafe act does not recur?"
              placeholderTextColor="#A0AEC0"
            />
            {!!selected.lessons_learned && (
              <Text style={styles.recorded}>Recorded: {selected.lessons_learned}</Text>
            )}
            <View style={styles.btnRow}>
              <SecondaryButton
                label="Save lesson"
                onPress={() => {
                  if (!freeText.trim()) { Alert.alert("Required", "Enter the lesson."); return; }
                  runStage(
                    () => hazardRegisterService.captureLesson(id, freeText.trim()),
                    "Lesson captured",
                  );
                }}
              />
              <PrimaryButton
                busy={acting} label="Close unsafe act"
                onPress={() => runStage(
                  () => hazardRegisterService.close(id, {
                    lessons_learned: freeText.trim() || undefined,
                  }),
                  "Unsafe act closed",
                )}
              />
            </View>
          </>
        );

      default:
        return null;
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaScreen style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen("app")}>
          <ArrowLeft size={22} color="#0B3D91" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Unsafe Act Register</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setFormVisible(true)}>
          <Plus size={20} color="#0B3D91" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}
        keyboardShouldPersistTaps="handled"
      >
        {FILTER_STAGES.map(f => {
          const active = stageFilter === f.key;
          const count = f.key === "ALL"
            ? Object.values(stats).reduce((a, b) => a + b, 0)
            : stats[f.key] ?? 0;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setStageFilter(f.key)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label} {count > 0 ? `· ${count}` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={["#0B3D91"]} />}
        keyboardShouldPersistTaps="handled"
      >
        {loading && rows.length === 0 ? (
          <ActivityIndicator color="#0B3D91" style={{ marginTop: 30 }} />
        ) : rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <ShieldAlert size={44} color="#94A3B8" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Nothing here</Text>
            <Text style={styles.emptyText}>
              {stageFilter === "ALL"
                ? "No unsafe acts have been logged yet."
                : `No unsafe acts are at ${stageFilter}.`}
            </Text>
          </View>
        ) : (
          rows.map(h => {
            const sev = severityColor(h.severity);
            return (
              <TouchableOpacity key={h.id} style={styles.card} onPress={() => open(h)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{h.hazard_name || `Unsafe act ${h.id}`}</Text>
                  <ChevronRight size={18} color="#94A3B8" />
                </View>

                <View style={styles.badgeRow}>
                  <View style={styles.stageBadge}>
                    <Text style={styles.stageBadgeText}>
                      {String(h.stage_number ?? "?").padStart(2, "0")} {h.stage ?? "UNMAPPED"}
                    </Text>
                  </View>
                  {!!h.assessed_priority && (
                    <View style={[styles.badge, { backgroundColor: PRIORITY_COLOR[h.assessed_priority] ?? "#64748B" }]}>
                      <Text style={styles.priorityText}>{h.assessed_priority}</Text>
                    </View>
                  )}
                  <View style={[styles.badge, { backgroundColor: sev.bg }]}>
                    <Text style={[styles.badgeText, { color: sev.color }]}>
                      {(h.severity || "—").toUpperCase()}
                    </Text>
                  </View>
                  {!!h.work_stopped && (
                    <View style={[styles.badge, { backgroundColor: "#FEF2F2" }]}>
                      <Text style={[styles.badgeText, { color: "#B91C1C" }]}>WORK STOPPED</Text>
                    </View>
                  )}
                  {h.is_overdue && (
                    <View style={[styles.badge, { backgroundColor: "#FEF3C7" }]}>
                      <Text style={[styles.badgeText, { color: "#B45309" }]}>OVERDUE</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.cardMeta}>
                  {HAZARD_STATUS_LABEL[h.register_status || ""] ?? h.register_status}
                  {h.station_name ? ` · ${h.station_name}` : ""}
                  {h.risk_score ? ` · score ${h.risk_score}` : ""}
                </Text>
                {!!h.reference && <Text style={styles.cardRef}>{h.reference}</Text>}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ── Detail + stage action ─────────────────────────────────────────── */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {selected?.hazard_name || "Hazard"}
              </Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetRef}>
              {selected?.reference}
              {selected?.category_name ? ` · ${selected.category_name}` : ""}
            </Text>

            <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
              {nextAction ? (
                <StageTracker info={nextAction} />
              ) : (
                <ActivityIndicator color="#0B3D91" style={{ marginVertical: 20 }} />
              )}

              {/* The sheet used to show a description and an interim control.
                  A manager approving a hazard's controls could not see who
                  reported it, what the assessment concluded, the root cause the
                  control answers, or whether verification had already failed
                  once — all of it in the same response the sheet was reading.
                  The supervisor's screen renders the identical card, so the two
                  roles are looking at one record rather than two summaries. */}
              <HazardRecordCard hazard={selected} />

              {renderStageForm()}
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── New hazard ────────────────────────────────────────────────────── */}
      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <KeyboardAvoider style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New Unsafe Act Entry</Text>
            <Text style={styles.sheetRef}>
              Logging records the hazard at stage 02 ASSESS. Scoring and control happen from
              the hazard itself.
            </Text>
            <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>UNSAFE ACT NAME *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Unguarded conveyor pinch point"
                placeholderTextColor="#A0AEC0"
                value={hazardName}
                onChangeText={setHazardName}
              />

              {categories.length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>CATEGORY</Text>
                  <View style={styles.pillWrap}>
                    {categories.map(c => (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.pill, categoryId === c.id && styles.pillActive]}
                        onPress={() => setCategoryId(c.id)}
                      >
                        <Text style={[styles.pillText, categoryId === c.id && styles.pillTextActive]}>
                          {c.category_name ?? c.name ?? `Category ${c.id}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.fieldLabel}>SEVERITY</Text>
              <Pills options={SEVERITIES} value={severity} onChange={setSeverity} />

              <Text style={styles.fieldLabel}>PROBABILITY</Text>
              <Pills options={PROBABILITIES} value={probability} onChange={setProbability} />

              <Text style={styles.fieldLabel}>PEOPLE EXPOSED</Text>
              <TextInput
                style={styles.input} keyboardType="number-pad" placeholder="e.g. 6"
                placeholderTextColor="#A0AEC0" value={personsExposed} onChangeText={setPersonsExposed}
              />

              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="What is the unsafe act and who is exposed?"
                placeholderTextColor="#A0AEC0"
                multiline
                value={description}
                onChangeText={setDescription}
              />

              <Text style={styles.fieldLabel}>LOCATION / STATION</Text>
              <View style={styles.pillWrap}>
                {stations.map(st => (
                  <TouchableOpacity
                    key={st.id}
                    style={[styles.pill, stationId === st.id && styles.pillActive]}
                    onPress={() => setStationId(st.id)}
                  >
                    <Text style={[styles.pillText, stationId === st.id && styles.pillTextActive]}>
                      {st.station_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>EXISTING CONTROLS</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Anything already in place?"
                placeholderTextColor="#A0AEC0"
                multiline
                value={controls}
                onChangeText={setControls}
              />

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setFormVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={submitNew} disabled={saving}>
                  {saving
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.saveBtnText}>Log Unsafe Act</Text>}
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

// ── Small shared controls ────────────────────────────────────────────────────

function Pills({
  options, value, onChange, labelFor,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  labelFor?: (o: string) => string;
}) {
  return (
    <View style={styles.pillWrap}>
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

function Toggle({
  label, hint, value, onChange,
}: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={() => onChange(!value)}>
      <View style={[styles.checkbox, value && styles.checkboxOn]}>
        {value && <Text style={styles.checkboxTick}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {!!hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function PrimaryButton({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <TouchableOpacity style={styles.primaryBtn} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.secondaryBtn} onPress={onPress}>
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function DangerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.dangerBtn} onPress={onPress}>
      <Text style={styles.dangerBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7FC" },
  headerBar: {
    height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 16,
  },
  backButton: { padding: 8 },
  addButton: { padding: 8 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: "#0B3D91" },

  filterBar: { maxHeight: 52, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderColor: "#E2E8F0" },
  filterContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: "center" },
  filterChip: {
    paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1.5,
    borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center",
  },
  filterChipActive: { backgroundColor: "#0B3D91", borderColor: "#0B3D91" },
  filterText: { fontSize: 12, fontWeight: "700", color: "#63739B" },
  filterTextActive: { color: "#FFFFFF" },

  scrollContent: { padding: 16, paddingBottom: 40 },
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
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  cardMeta: { fontSize: 12, color: "#718096", marginTop: 8 },
  cardRef: { fontSize: 10, color: "#94A3B8", marginTop: 4, fontWeight: "700" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  priorityText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF" },
  stageBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#EEF2FB" },
  stageBadgeText: { fontSize: 10, fontWeight: "800", color: "#0B3D91" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: "92%",
  },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  sheetTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: "#0B3D91", marginBottom: 4 },
  sheetRef: { fontSize: 11, color: "#94A3B8", fontWeight: "700", marginBottom: 12 },
  closeX: { fontSize: 20, color: "#94A3B8", paddingHorizontal: 6 },
  sheetScroll: { maxHeight: "100%" },

  fieldLabel: {
    fontSize: 11, fontWeight: "800", color: "#63739B",
    letterSpacing: 0.6, marginTop: 18, marginBottom: 8,
  },
  readonlyLabel: {
    fontSize: 11, fontWeight: "800", color: "#63739B",
    letterSpacing: 0.6, marginTop: 16, marginBottom: 4,
  },
  readonlyValue: { fontSize: 13, color: "#2D3748", lineHeight: 19 },
  recorded: { fontSize: 12, color: "#15803D", marginTop: 6, fontStyle: "italic" },
  hint: { fontSize: 11, color: "#718096", lineHeight: 16, marginBottom: 4 },
  input: {
    borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12,
    paddingHorizontal: 14, height: 46, fontSize: 14, color: "#2D3748",
  },
  multiline: { height: 80, paddingTop: 12, textAlignVertical: "top" },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 14, height: 38, borderRadius: 19,
    borderWidth: 1.5, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center",
  },
  pillActive: { backgroundColor: "#0B3D91", borderColor: "#0B3D91" },
  pillText: { fontSize: 13, fontWeight: "700", color: "#2D3748" },
  pillTextActive: { color: "#FFFFFF" },

  toggleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 16 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#CBD5E1",
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  checkboxOn: { backgroundColor: "#0B3D91", borderColor: "#0B3D91" },
  checkboxTick: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  toggleLabel: { fontSize: 13, fontWeight: "700", color: "#2D3748", marginBottom: 2 },

  warnBox: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFBEB",
    borderRadius: 10, padding: 10, marginTop: 10,
  },
  warnText: { flex: 1, fontSize: 12, color: "#B45309", fontWeight: "600" },
  blockedBox: { backgroundColor: "#F1F5F9", borderRadius: 10, padding: 14, marginTop: 16 },
  blockedText: { fontSize: 12, color: "#475569", lineHeight: 18 },

  btnRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  primaryBtn: {
    flex: 1.4, height: 48, borderRadius: 12, backgroundColor: "#0B3D91",
    alignItems: "center", justifyContent: "center", marginTop: 20,
  },
  primaryBtnText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  secondaryBtn: {
    flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: "#0B3D91",
    alignItems: "center", justifyContent: "center", marginTop: 20,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: "800", color: "#0B3D91" },
  dangerBtn: {
    flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: "#DC2626",
    alignItems: "center", justifyContent: "center", marginTop: 20,
  },
  dangerBtnText: { fontSize: 13, fontWeight: "800", color: "#DC2626" },

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
