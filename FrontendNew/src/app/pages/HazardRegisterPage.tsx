import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRight, Check, CircleAlert, Clock3, Loader2,
  Search, ShieldCheck, X,
} from "lucide-react";
import {
  assessHazard, captureHazardLesson, closeHazard, CONTROL_HIERARCHY,
  getHazardNextAction, getHazardRegister, getHazardRegisterStats,
  HIERARCHY_LABEL, planHazardControls, recordHazardFindings,
  recordInterimControl, REGISTER_STATUS_LABEL, startHazardReview,
  submitHazardForVerification, verifyHazardControls,
  type ControlHierarchy, type HazardNextAction, type HazardRegisterEntry,
  type HazardRegisterStats, type StageKey,
} from "../../services/hazard-register.service";
import { HazardsTabBar } from "../components/audits/HazardsTabBar";
import { EventFamilyTabBar } from "../components/audits/EventFamilyTabBar";

/**
 * The working unsafe act register — what is owed, and the one action that clears it.
 *
 * The companion to HazardTrackingPage: that one is the audit view (what
 * happened, by whom), this one is where the work is done. Selecting an unsafe act
 * shows its eight-stage tracker and exactly one form — whichever stage the
 * backend says is outstanding. The page never decides that itself;
 * `/hazard-register/{id}/next-action` does, so this and the mobile app can
 * never disagree about what is owed.
 */

const PRIORITY_COLOR: Record<string, string> = {
  P1: "#DC2626", P2: "#EA580C", P3: "#CA8A04", P4: "#2563EB", P5: "#64748B",
};

const SEVERITIES = ["Low", "Medium", "High", "Critical"];
const PROBABILITIES = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function HazardRegisterPage() {
  const [items, setItems] = useState<HazardRegisterEntry[]>([]);
  const [stats, setStats] = useState<HazardRegisterStats | null>(null);
  const [selected, setSelected] = useState<HazardRegisterEntry | null>(null);
  const [nextAction, setNextAction] = useState<HazardNextAction | null>(null);
  const [stageFilter, setStageFilter] = useState<StageKey | "">("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Stage-form state. One set, because only one stage form is ever open.
  const [severity, setSeverity] = useState("Medium");
  const [probability, setProbability] = useState("Possible");
  const [personsExposed, setPersonsExposed] = useState("");
  const [workStopped, setWorkStopped] = useState(false);
  const [text, setText] = useState("");
  const [secondaryText, setSecondaryText] = useState("");
  const [hierarchy, setHierarchy] = useState<ControlHierarchy>("engineering");
  const [dueDate, setDueDate] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, s] = await Promise.all([
        getHazardRegister({ stage: stageFilter || undefined, q: query || undefined, limit: 300 }),
        getHazardRegisterStats(),
      ]);
      setItems(rows);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the unsafe act register");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [stageFilter, query]);

  useEffect(() => {
    const t = setTimeout(loadList, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadList, query]);

  const select = async (hazard: HazardRegisterEntry) => {
    setSelected(hazard);
    setNextAction(null);
    setNotice(null);
    // Seed the form from the hazard so the assessor corrects the reporter's
    // figures rather than retyping them.
    setSeverity(hazard.severity ?? "Medium");
    setProbability(hazard.probability ?? "Possible");
    setPersonsExposed(hazard.persons_exposed != null ? String(hazard.persons_exposed) : "");
    setWorkStopped(Boolean(hazard.work_stopped));
    setText("");
    setSecondaryText("");
    setHierarchy("engineering");
    setDueDate("");
    try {
      setNextAction(await getHazardNextAction(hazard.id));
    } catch {
      setNextAction(null);
    }
  };

  /** Run one stage verb, surfacing the backend's own refusal wording. */
  const run = async (fn: () => Promise<HazardRegisterEntry>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await fn();
      setNotice(message);
      setText("");
      setSecondaryText("");
      setSelected(updated);
      getHazardNextAction(updated.id).then(setNextAction).catch(() => setNextAction(null));
      loadList();
    } catch (e: unknown) {
      // The backend's gate messages name the stage and why it refused, which is
      // more useful than anything this page could invent.
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || (e instanceof Error ? e.message : "The action failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <EventFamilyTabBar />
      <HazardsTabBar />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px]" style={{ color: "#0F172A", fontWeight: 700 }}>Unsafe Act Register</h1>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "#64748B" }}>
            Every standing unsafe act, from logging through to a verified control — the same eight
            stages an incident runs.
          </p>
        </div>
      </div>

      {/* Headline counts */}
      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="On the register" value={stats.total} />
          <Stat label="Still being managed" value={stats.open} accent="#4A57B9" />
          <Stat label="Past response deadline" value={stats.overdue} accent={stats.overdue ? "#DC2626" : undefined} />
          <Stat label="Closed" value={stats.by_stage?.CLOSE ?? 0} accent="#15803D" />
        </div>
      )}

      {/* Stage filter */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          label="All stages"
          active={stageFilter === ""}
          onClick={() => setStageFilter("")}
        />
        {(["ASSESS", "RESPOND", "INVESTIGATE", "IMPROVE", "VERIFY", "LEARN", "CLOSE"] as StageKey[]).map((key, i) => (
          <FilterChip
            key={key}
            label={`${String(i + 2).padStart(2, "0")} ${key}`}
            count={stats?.by_stage?.[key]}
            active={stageFilter === key}
            onClick={() => setStageFilter(stageFilter === key ? "" : key)}
          />
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]"
          style={{ borderColor: "#FECACA", background: "#FEF2F2", color: "#B91C1C" }}>
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]"
          style={{ borderColor: "#BBF7D0", background: "#F0FDF4", color: "#15803D" }}>
          <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(300px,400px)_1fr]">
        {/* ── List ─────────────────────────────────────────────────────── */}
        <div className="rounded-lg border bg-white" style={{ borderColor: "#DDE5F4" }}>
          <div className="border-b p-2.5" style={{ borderColor: "#E9EEF8" }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "#94A3B8" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search unsafe acts…"
                className="w-full rounded-md border py-1.5 pl-8 pr-2.5 text-[12.5px] outline-none"
                style={{ borderColor: "#DDE5F4", color: "#0F172A" }}
              />
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-[12px]" style={{ color: "#64748B" }}>Loading…</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-[12px]" style={{ color: "#64748B" }}>
                No unsafe acts {stageFilter ? `at ${stageFilter}` : "on the register"}.
              </div>
            ) : (
              items.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => select(h)}
                  className="block w-full border-b p-2.5 text-left"
                  style={{
                    borderColor: "#F1F5F9",
                    background: h.id === selected?.id ? "#EEF2FB" : "#FFFFFF",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] tabular-nums" style={{ color: "#4A57B9", fontWeight: 700 }}>
                      {h.reference}
                    </span>
                    <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                      style={{ background: "#F1F5F9", color: "#475569", fontWeight: 700 }}>
                      {h.stage_number ? `${String(h.stage_number).padStart(2, "0")} ${h.stage}` : "unmapped"}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[12.5px]" style={{ color: "#111827", fontWeight: 600 }}>
                    {h.hazard_name || h.description || "Untitled unsafe act"}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {h.assessed_priority && (
                      <span className="rounded px-1.5 py-0.5 text-[9.5px] text-white"
                        style={{ background: PRIORITY_COLOR[h.assessed_priority] ?? "#64748B", fontWeight: 700 }}>
                        {h.assessed_priority}
                      </span>
                    )}
                    {!!h.work_stopped && (
                      <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                        style={{ background: "#FEF2F2", color: "#B91C1C", fontWeight: 700 }}>
                        WORK STOPPED
                      </span>
                    )}
                    {h.is_overdue && (
                      <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                        style={{ background: "#FEF3C7", color: "#B45309", fontWeight: 700 }}>
                        OVERDUE
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: "#64748B" }}>
                    {REGISTER_STATUS_LABEL[h.register_status ?? ""] ?? h.register_status}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Detail + the one outstanding action ──────────────────────── */}
        <div className="rounded-lg border bg-white p-3.5" style={{ borderColor: "#DDE5F4" }}>
          {!selected ? (
            <div className="text-[12px]" style={{ color: "#64748B" }}>
              Select an unsafe act to see where it sits and what it needs next.
            </div>
          ) : (
            <>
              <div className="border-b pb-3" style={{ borderColor: "#E9EEF8" }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-[15px]" style={{ color: "#0F172A", fontWeight: 700 }}>
                      {selected.hazard_name || "Untitled unsafe act"}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]"
                      style={{ color: "#64748B" }}>
                      <span style={{ color: "#4A57B9", fontWeight: 700 }}>{selected.reference}</span>
                      {selected.category_name && <span>{selected.category_name}</span>}
                      {selected.station_name && <span>{selected.station_name}</span>}
                      {selected.risk_score != null && <span>score {selected.risk_score}/25</span>}
                    </div>
                  </div>
                  {selected.assessed_priority && (
                    <span className="rounded px-2 py-0.5 text-[11px] text-white"
                      style={{ background: PRIORITY_COLOR[selected.assessed_priority] ?? "#64748B", fontWeight: 700 }}>
                      {selected.assessed_priority}
                    </span>
                  )}
                </div>
                {selected.description && (
                  <p className="mt-2 text-[12px] leading-snug" style={{ color: "#374151" }}>
                    {selected.description}
                  </p>
                )}
              </div>

              {/* Stage tracker */}
              {nextAction ? (
                <>
                  <div className="mt-3 flex items-center gap-1">
                    {nextAction.track.map((s, i) => (
                      <div key={s.key} className="flex flex-1 items-center gap-1">
                        {i > 0 && (
                          <div className="h-0.5 flex-1"
                            style={{ background: s.state === "pending" ? "#E2E8F0" : "#4A57B9" }} />
                        )}
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full text-[10px]"
                            style={{
                              background: s.state === "done" ? "#4A57B9" : s.state === "current" ? "#EEF2FB" : "#FFFFFF",
                              border: `2px solid ${s.state === "pending" ? "#E2E8F0" : "#4A57B9"}`,
                              color: s.state === "done" ? "#FFFFFF" : s.state === "current" ? "#4A57B9" : "#94A3B8",
                              fontWeight: 700,
                            }}>
                            {s.state === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : s.number}
                          </div>
                          <span className="text-[8.5px] uppercase"
                            style={{ color: s.state === "current" ? "#4A57B9" : "#94A3B8", fontWeight: 700 }}>
                            {s.short}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* You are here */}
                  {nextAction.is_closed ? (
                    <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px]"
                      style={{ background: "#F0FDF4", color: "#166534", fontWeight: 600 }}>
                      <ShieldCheck className="h-4 w-4" />
                      Closed — all eight stages complete.
                    </div>
                  ) : nextAction.next_action ? (
                    <div className="mt-3 rounded-lg p-3" style={{ background: "#F7F9FE" }}>
                      <div className="text-[10px] uppercase tracking-[0.5px]"
                        style={{ color: "#4A57B9", fontWeight: 800 }}>
                        You are here · {String(nextAction.stage_number ?? "").padStart(2, "0")} {nextAction.stage}
                      </div>
                      <div className="mt-1 text-[14px]" style={{ color: "#0B1C30", fontWeight: 700 }}>
                        {nextAction.next_action.action}
                      </div>
                      <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "#64748B" }}>
                        {nextAction.next_action.detail}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span style={{ color: "#334155", fontWeight: 700 }}>
                          {nextAction.is_mine
                            ? "Waiting on you"
                            : `Waiting on the ${nextAction.next_action.owner_role.replace("_", " ")}`}
                        </span>
                        {nextAction.next_action.unblocks && (
                          <span className="inline-flex items-center gap-1" style={{ color: "#64748B" }}>
                            <ArrowRight className="h-3 w-3" />
                            {nextAction.next_action.unblocks}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-3 flex items-center gap-2 text-[12px]" style={{ color: "#64748B" }}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading stage…
                </div>
              )}

              {/* Recorded so far */}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {selected.interim_control && (
                  <Fact label="Interim control" value={selected.interim_control} />
                )}
                {selected.root_cause && <Fact label="Root cause" value={selected.root_cause} />}
                {selected.planned_controls && (
                  <Fact
                    label="Permanent control"
                    value={
                      selected.planned_controls +
                      (selected.control_hierarchy
                        ? ` · ${HIERARCHY_LABEL[selected.control_hierarchy as ControlHierarchy] ?? selected.control_hierarchy}`
                        : "")
                    }
                  />
                )}
                {selected.control_due_date && (
                  <Fact label="Control due" value={formatDate(selected.control_due_date)} />
                )}
                {selected.lessons_learned && (
                  <Fact label="Lesson learned" value={selected.lessons_learned} />
                )}
              </div>

              {(selected.verification_failures ?? 0) > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]"
                  style={{ borderColor: "#FDE68A", background: "#FFFBEB", color: "#92400E" }}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    This control has failed verification {selected.verification_failures}×. A repeated
                    failure usually means the control is the wrong level in the hierarchy.
                  </span>
                </div>
              )}

              {selected.response_due_at && !selected.closed_at && (
                <div className="mt-2 flex items-center gap-1.5 text-[11.5px]" style={{ color: "#64748B" }}>
                  <Clock3 className="h-3 w-3" />
                  Response due {formatDate(selected.response_due_at)}
                </div>
              )}

              {/* ── The stage form ─────────────────────────────────────── */}
              {nextAction?.next_action && !nextAction.can_act && (
                <div className="mt-4 rounded-lg px-3 py-2.5 text-[12px]"
                  style={{ background: "#F1F5F9", color: "#475569" }}>
                  This step belongs to the {nextAction.next_action.owner_role.replace("_", " ")}.
                  You can see it, but not act on it.
                </div>
              )}

              {nextAction?.can_act && selected && (
                <div className="mt-4 border-t pt-3.5" style={{ borderColor: "#E9EEF8" }}>
                  {renderStageForm()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  function renderStageForm() {
    if (!selected || !nextAction?.next_action) return null;
    const id = selected.id;
    const cta = nextAction.next_action.cta;

    switch (selected.register_status) {
      // ── 02 ASSESS ───────────────────────────────────────────────────────
      case "open":
        return (
          <FormShell title="Assess the unsafe act">
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice label="Severity" options={SEVERITIES} value={severity} onChange={setSeverity} />
              <Choice label="Probability" options={PROBABILITIES} value={probability} onChange={setProbability} />
            </div>
            <Field label="People exposed">
              <input type="number" min={0} value={personsExposed}
                onChange={(e) => setPersonsExposed(e.target.value)}
                placeholder="e.g. 6" className={inputClass} style={inputStyle} />
            </Field>
            <label className="mt-2 flex items-start gap-2 text-[12px]" style={{ color: "#334155" }}>
              <input type="checkbox" checked={workStopped}
                onChange={(e) => setWorkStopped(e.target.checked)} className="mt-0.5" />
              <span>
                <strong>Work stopped because of this hazard.</strong>{" "}
                <span style={{ color: "#64748B" }}>
                  Stopping the job routes the unsafe act to RESPOND so containment is recorded before
                  the review.
                </span>
              </span>
            </label>
            <Field label="Assessment notes">
              <textarea value={text} onChange={(e) => setText(e.target.value)}
                placeholder="What did you find on inspection?" rows={3}
                className={inputClass} style={inputStyle} />
            </Field>
            <Actions>
              <Primary busy={busy} label={cta} onClick={() => run(
                () => assessHazard(id, {
                  severity, probability,
                  persons_exposed: personsExposed ? Number(personsExposed) : undefined,
                  work_stopped: workStopped,
                  assessment_notes: text.trim() || undefined,
                }),
                "Unsafe act assessed.",
              )} />
            </Actions>
          </FormShell>
        );

      // ── 03 RESPOND ──────────────────────────────────────────────────────
      case "interim_control":
        return (
          <FormShell title="Contain the unsafe act">
            <Field label="Interim control">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
                placeholder="What is holding this unsafe act right now? e.g. isolated and barriered"
                className={inputClass} style={inputStyle} />
            </Field>
            <Actions>
              <Secondary
                label="Record control"
                onClick={() => {
                  if (!text.trim()) { setError("Describe the interim control."); return; }
                  run(() => recordInterimControl(id, { interim_control: text.trim() }),
                    "Interim control recorded.");
                }}
              />
              <Primary busy={busy} label={cta} onClick={() => run(
                () => startHazardReview(id, text.trim() || undefined),
                "Control review opened.",
              )} />
            </Actions>
          </FormShell>
        );

      // ── 04 INVESTIGATE ──────────────────────────────────────────────────
      case "under_review":
        return (
          <FormShell title="Establish the cause, then plan the control">
            <Field label="Root cause">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
                placeholder="Why does this unsafe act exist? Not what it is — why it is here."
                className={inputClass} style={inputStyle} />
            </Field>
            <Secondary
              label="Save root cause"
              onClick={() => {
                if (!text.trim()) { setError("Enter the root cause."); return; }
                run(() => recordHazardFindings(id, { root_cause: text.trim() }), "Root cause recorded.");
              }}
            />

            <Field label="Permanent control">
              <textarea value={secondaryText} onChange={(e) => setSecondaryText(e.target.value)} rows={2}
                placeholder="What will remove or reduce the unsafe act for good?"
                className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Hierarchy of control">
              <div className="flex flex-wrap gap-1.5">
                {CONTROL_HIERARCHY.map((h) => (
                  <button key={h} type="button" onClick={() => setHierarchy(h)}
                    className="rounded-full border px-3 py-1 text-[11.5px]"
                    style={{
                      borderColor: hierarchy === h ? "#4A57B9" : "#DDE5F4",
                      background: hierarchy === h ? "#4A57B9" : "#FFFFFF",
                      color: hierarchy === h ? "#FFFFFF" : "#334155",
                      fontWeight: 600,
                    }}>
                    {HIERARCHY_LABEL[h]}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px]" style={{ color: "#64748B" }}>
                Strongest first. PPE protects the person instead of removing the unsafe act, so it
                needs a justification — the backend refuses it without one.
              </p>
            </Field>
            {hierarchy === "ppe" && (
              <div className="rounded-lg px-3 py-2 text-[11.5px]"
                style={{ background: "#FFFBEB", color: "#92400E" }}>
                Use the root-cause box above to state why elimination, substitution, engineering
                or administrative controls are not reasonably practicable.
              </div>
            )}
            <Field label="Control due date">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className={inputClass} style={inputStyle} />
            </Field>
            <Actions>
              <Primary busy={busy} label="Plan controls" onClick={() => {
                if (!secondaryText.trim()) { setError("Describe the permanent control."); return; }
                if (hierarchy === "ppe" && !text.trim()) {
                  setError("PPE needs a justification — put it in the root-cause box.");
                  return;
                }
                run(
                  () => planHazardControls(id, {
                    planned_controls: secondaryText.trim(),
                    control_hierarchy: hierarchy,
                    control_due_date: dueDate || undefined,
                    ppe_justification: hierarchy === "ppe" ? text.trim() : undefined,
                  }),
                  "Permanent control planned.",
                );
              }} />
            </Actions>
          </FormShell>
        );

      // ── 05 IMPROVE ──────────────────────────────────────────────────────
      case "controls_planned":
        return (
          <FormShell title="Confirm the control is in place">
            <Field label="Implementation notes">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
                placeholder="Confirm the control is physically in place, and when."
                className={inputClass} style={inputStyle} />
            </Field>
            <Actions>
              <Primary busy={busy} label={cta} onClick={() => run(
                () => submitHazardForVerification(id, text.trim() || undefined),
                "Submitted for verification.",
              )} />
            </Actions>
          </FormShell>
        );

      // ── 06 VERIFY ───────────────────────────────────────────────────────
      case "pending_verification":
        return (
          <FormShell title="Verify the control held">
            <Field label="What did you check?">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
                placeholder="How was the control tested, and what was the result?"
                className={inputClass} style={inputStyle} />
            </Field>
            <p className="text-[11.5px]" style={{ color: "#64748B" }}>
              Answering "did not hold" returns the unsafe act to IMPROVE and counts the failure. A
              control that failed means the unsafe act is still live.
            </p>
            <Actions>
              <Danger label="Did not hold" onClick={() => run(
                () => verifyHazardControls(id, { effective: false, verification_notes: text.trim() || undefined }),
                "Returned to IMPROVE — the control did not hold.",
              )} />
              <Primary busy={busy} label="Control held" onClick={() => run(
                () => verifyHazardControls(id, { effective: true, verification_notes: text.trim() || undefined }),
                "Control verified effective.",
              )} />
            </Actions>
          </FormShell>
        );

      // ── 07 LEARN → 08 CLOSE ─────────────────────────────────────────────
      case "controlled":
        return (
          <FormShell title="Capture the lesson, then close">
            <Field label="Lesson learned">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
                placeholder="What should change elsewhere so this unsafe act does not recur?"
                className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Closure notes">
              <textarea value={secondaryText} onChange={(e) => setSecondaryText(e.target.value)} rows={2}
                placeholder="Anything the register should record at closure"
                className={inputClass} style={inputStyle} />
            </Field>
            <Actions>
              <Secondary label="Save lesson" onClick={() => {
                if (!text.trim()) { setError("Enter the lesson."); return; }
                run(() => captureHazardLesson(id, text.trim()), "Lesson captured.");
              }} />
              <Primary busy={busy} label="Close unsafe act" onClick={() => run(
                () => closeHazard(id, {
                  lessons_learned: text.trim() || undefined,
                  closure_notes: secondaryText.trim() || undefined,
                }),
                "Unsafe act closed.",
              )} />
            </Actions>
          </FormShell>
        );

      default:
        return null;
    }
  }
}

// ── Small presentational pieces ──────────────────────────────────────────────

const inputClass = "w-full rounded-md border px-2.5 py-1.5 text-[12.5px] outline-none";
const inputStyle = { borderColor: "#DDE5F4", color: "#0F172A" } as const;

function Stat({ label, value, accent }: Readonly<{ label: string; value: number; accent?: string }>) {
  return (
    <div className="rounded-lg border bg-white p-2.5" style={{ borderColor: "#DDE5F4" }}>
      <div className="text-[10.5px] uppercase tracking-[0.4px]" style={{ color: "#94A3B8", fontWeight: 700 }}>
        {label}
      </div>
      <div className="mt-0.5 text-[20px] tabular-nums" style={{ color: accent ?? "#0F172A", fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}

function FilterChip({
  label, count, active, onClick,
}: Readonly<{ label: string; count?: number; active: boolean; onClick: () => void }>) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-full border px-3 py-1 text-[11.5px]"
      style={{
        borderColor: active ? "#4A57B9" : "#DDE5F4",
        background: active ? "#4A57B9" : "#FFFFFF",
        color: active ? "#FFFFFF" : "#334155",
        fontWeight: 600,
      }}>
      {label}{count ? ` · ${count}` : ""}
    </button>
  );
}

function Fact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: "#E3E9F6", background: "#FCFDFF" }}>
      <div className="text-[10px] uppercase tracking-[0.4px]" style={{ color: "#94A3B8", fontWeight: 700 }}>
        {label}
      </div>
      <p className="mt-1 text-[12px] leading-snug" style={{ color: "#334155" }}>{value}</p>
    </div>
  );
}

function FormShell({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-[13px]" style={{ color: "#0F172A", fontWeight: 700 }}>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.4px]"
        style={{ color: "#64748B", fontWeight: 700 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Choice({
  label, options, value, onChange,
}: Readonly<{ label: string; options: string[]; value: string; onChange: (v: string) => void }>) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={inputClass} style={inputStyle}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  );
}

function Actions({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex flex-wrap gap-2 pt-1">{children}</div>;
}

function Primary({ label, onClick, busy }: Readonly<{ label: string; onClick: () => void; busy?: boolean }>) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12.5px] text-white"
      style={{ background: "#4A57B9", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {label}
    </button>
  );
}

function Secondary({ label, onClick }: Readonly<{ label: string; onClick: () => void }>) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-md border px-3.5 py-2 text-[12.5px]"
      style={{ borderColor: "#4A57B9", color: "#4A57B9", fontWeight: 700 }}>
      {label}
    </button>
  );
}

function Danger({ label, onClick }: Readonly<{ label: string; onClick: () => void }>) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-md border px-3.5 py-2 text-[12.5px]"
      style={{ borderColor: "#DC2626", color: "#DC2626", fontWeight: 700 }}>
      {label}
    </button>
  );
}
