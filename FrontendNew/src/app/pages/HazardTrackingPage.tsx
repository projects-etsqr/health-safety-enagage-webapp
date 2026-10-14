import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Clock3, FileSearch, Flame, GraduationCap,
  HardHat, Lock, OctagonAlert, Search, ShieldCheck, Siren, UserRound, Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  getHazardTrail, getTrackedHazards, HIERARCHY_LABEL, HIERARCHY_RANK,
  REGISTER_STATUS_LABEL, STAGE_ORDER,
  type ControlHierarchy, type HazardTrailAction, type HazardTrailPerson,
  type HazardTrailResponse, type StageKey, type TrackedHazard,
} from "../../services/hazard-register.service";
import { HazardsTabBar } from "../components/audits/HazardsTabBar";
import { EventFamilyTabBar } from "../components/audits/EventFamilyTabBar";

/**
 * Unsafe act register lifecycle tracker.
 *
 * One screen answering "what has happened to this unsafe act, by whom, when" for
 * all eight stages of the workflow engine (HSE_Workflow_Engine_Slide.pptx).
 * Left: every unsafe act with its current stage. Right: the full action trail.
 *
 * Deliberately the twin of IncidentTrackingPage — same layout, same stage
 * pipeline, same trail rendering. An admin who has learned one has learned the
 * other, and the two backends return the same shape precisely so this could be
 * true.
 */

const STAGE_ICON: Record<StageKey, LucideIcon> = {
  RECORD: FileSearch,
  ASSESS: Siren,
  RESPOND: Flame,
  INVESTIGATE: Search,
  IMPROVE: Wrench,
  VERIFY: ShieldCheck,
  LEARN: GraduationCap,
  CLOSE: Lock,
};

const PRIORITY_COLOR: Record<string, string> = {
  P1: "#DC2626", P2: "#EA580C", P3: "#CA8A04", P4: "#2563EB", P5: "#64748B",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function StatePill({ state }: Readonly<{ state: string }>) {
  const map: Record<string, { bg: string; fg: string; text: string }> = {
    complete: { bg: "#DCFCE7", fg: "#15803D", text: "Complete" },
    current: { bg: "#DBEAFE", fg: "#1D4ED8", text: "In progress" },
    skipped: { bg: "#FEF3C7", fg: "#B45309", text: "No action recorded" },
    pending: { bg: "#F1F5F9", fg: "#64748B", text: "Not reached" },
  };
  const s = map[state] ?? map.pending;
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.4px]"
      style={{ background: s.bg, color: s.fg, fontWeight: 700 }}>
      {s.text}
    </span>
  );
}

/**
 * The control's level in the hierarchy, coloured by strength.
 *
 * PPE reads amber rather than neutral on purpose: it is the only level that
 * protects the person instead of removing the unsafe act, and a register full of
 * amber is exactly the finding this page should make visible at a glance.
 */
function HierarchyPill({ level }: Readonly<{ level: string | null }>) {
  if (!level) return null;
  const rank = HIERARCHY_RANK[level as ControlHierarchy] ?? 0;
  const style = rank >= 4
    ? { bg: "#DCFCE7", fg: "#15803D" }
    : rank === 3
      ? { bg: "#DBEAFE", fg: "#1D4ED8" }
      : { bg: "#FEF3C7", fg: "#B45309" };
  return (
    <span className="rounded px-1.5 py-0.5 text-[10px]"
      style={{ background: style.bg, color: style.fg, fontWeight: 700 }}>
      {HIERARCHY_LABEL[level as ControlHierarchy] ?? level}
    </span>
  );
}

function ActionRow({ action }: Readonly<{ action: HazardTrailAction }>) {
  return (
    <li className="relative pl-5 pb-3 last:pb-0">
      <span className="absolute left-0 top-[6px] h-2 w-2 rounded-full"
        style={{ background: action.timestamp_inferred ? "#CBD5E1" : "#4A57B9" }} />
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[12.5px]" style={{ color: "#111827", fontWeight: 600 }}>
          {action.action}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px]" style={{ color: "#64748B" }}>
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" />
          {formatDateTime(action.occurred_at)}
        </span>
        {action.actor_id ? (
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3 w-3" />
            <span className="rounded px-1 py-0.5 tabular-nums"
              style={{ background: "#F1F5F9", color: "#475569", fontWeight: 700 }}>
              EMP-{action.actor_id}
            </span>
          </span>
        ) : (
          <span style={{ color: "#B45309" }}>actor not recorded</span>
        )}
        <span style={{ color: "#94A3B8" }}>{action.source}</span>
      </div>
      {action.timestamp_inferred && (
        <div className="mt-0.5 text-[10.5px]" style={{ color: "#B45309" }}>
          Time inferred — this action has no timestamp of its own
          {action.inferred_from ? `, shown against ${action.inferred_from}` : ""}.
        </div>
      )}
      {action.detail && (
        <p className="mt-1 rounded-md px-2 py-1.5 text-[11.5px] leading-snug"
          style={{ background: "#F8FAFC", color: "#374151" }}>
          {action.detail}
        </p>
      )}
    </li>
  );
}

function PersonCard({ person }: Readonly<{ person: HazardTrailPerson }>) {
  const initials = (person.name ?? "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: "#E3E9F6", background: "#FCFDFF" }}>
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] text-white"
          style={{ background: "linear-gradient(135deg, #505AB6, #7890F6)", fontWeight: 700 }}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[12.5px]" style={{ color: "#111827", fontWeight: 700 }}>
              {person.name ?? "Employee record missing"}
            </span>
            <span className="rounded px-1.5 py-0.5 text-[10px] tabular-nums"
              style={{ background: "#EEF2FB", color: "#3E4FB1", fontWeight: 700 }}>
              {person.employee_ref}
            </span>
            {!person.is_active && !person.record_missing && (
              <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                style={{ background: "#FEF3C7", color: "#B45309", fontWeight: 700 }}>
                INACTIVE
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px]" style={{ color: "#64748B" }}>
            {[person.job_role, person.department].filter(Boolean).join(" · ") || "No role recorded"}
            {person.username ? ` · @${person.username}` : ""}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {person.workflow_roles.map((role) => (
              <span key={role} className="rounded px-1.5 py-0.5 text-[9.5px]"
                style={{ background: "#F1F5F9", color: "#475569", fontWeight: 700 }}>
                {role}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HazardTrackingPage() {
  const [items, setItems] = useState<TrackedHazard[]>([]);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [trail, setTrail] = useState<HazardTrailResponse | null>(null);
  const [stageFilter, setStageFilter] = useState<StageKey | "">("");
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTrail, setLoadingTrail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const data = await getTrackedHazards({ stage: stageFilter || undefined, q: query || undefined });
      setItems(data.items);
      setStageCounts(data.stage_counts ?? {});
      setSelectedId((prev) => (prev && data.items.some((i) => i.id === prev) ? prev : data.items[0]?.id ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load unsafe acts");
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, [stageFilter, query]);

  useEffect(() => {
    const t = setTimeout(loadList, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadList, query]);

  useEffect(() => {
    if (!selectedId) { setTrail(null); return; }
    let cancelled = false;
    setLoadingTrail(true);
    getHazardTrail(selectedId)
      .then((data) => { if (!cancelled) setTrail(data); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load trail"); })
      .finally(() => { if (!cancelled) setLoadingTrail(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const totalTracked = useMemo(
    () => Object.values(stageCounts).reduce((sum, n) => sum + n, 0),
    [stageCounts],
  );

  return (
    <div className="space-y-4">
      <EventFamilyTabBar />
      <HazardsTabBar />
      <div>
        <h1 className="text-[19px]" style={{ color: "#0F172A", fontWeight: 700 }}>Unsafe Act Lifecycle Tracking</h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "#64748B" }}>
          Every action on every register unsafe act, stage 01 Record through stage 08 Close — who did
          it and when. {totalTracked} on the register.
        </p>
      </div>

      {/* Stage pipeline — click to filter */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {STAGE_ORDER.map((key, idx) => {
          const Icon = STAGE_ICON[key];
          const active = stageFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStageFilter(active ? "" : key)}
              className="rounded-lg border p-2.5 text-left transition-all"
              style={{
                borderColor: active ? "#4A57B9" : "#DDE5F4",
                background: active ? "#EEF2FB" : "#FFFFFF",
                boxShadow: active ? "0 4px 12px rgba(74,87,185,0.18)" : "none",
              }}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" style={{ color: "#4A57B9" }} />
                <span className="text-[10px] tabular-nums" style={{ color: "#94A3B8", fontWeight: 700 }}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.4px] truncate" style={{ color: "#334155", fontWeight: 700 }}>
                {key}
              </div>
              <div className="text-[17px] tabular-nums" style={{ color: "#0F172A", fontWeight: 700 }}>
                {stageCounts[key] ?? 0}
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border px-3 py-2 text-[12px]"
          style={{ borderColor: "#FECACA", background: "#FEF2F2", color: "#B91C1C" }}>
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
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

          <div className="max-h-[560px] overflow-y-auto">
            {loadingList ? (
              <div className="p-4 text-[12px]" style={{ color: "#64748B" }}>Loading…</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-[12px]" style={{ color: "#64748B" }}>
                No unsafe acts {stageFilter ? `at ${stageFilter}` : "on the register"}.
              </div>
            ) : (
              items.map((h) => {
                const selected = h.id === selectedId;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setSelectedId(h.id)}
                    className="block w-full border-b p-2.5 text-left transition-colors"
                    style={{
                      borderColor: "#F1F5F9",
                      background: selected ? "#EEF2FB" : "#FFFFFF",
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
                      {h.hazard_name || h.description || "Untitled hazard"}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {h.priority && (
                        <span className="rounded px-1.5 py-0.5 text-[9.5px] text-white"
                          style={{ background: PRIORITY_COLOR[h.priority] ?? "#64748B", fontWeight: 700 }}>
                          {h.priority}
                        </span>
                      )}
                      {h.work_stopped && (
                        <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                          style={{ background: "#FEF2F2", color: "#B91C1C", fontWeight: 700 }}>
                          WORK STOPPED
                        </span>
                      )}
                      <HierarchyPill level={h.control_hierarchy} />
                      {h.verification_failures > 0 && (
                        <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                          style={{ background: "#FEF3C7", color: "#B45309", fontWeight: 700 }}>
                          {h.verification_failures}× FAILED
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: "#64748B" }}>
                      {[h.station_name, h.category_name].filter(Boolean).join(" · ") || "No location recorded"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Trail ────────────────────────────────────────────────────── */}
        <div className="rounded-lg border bg-white p-3.5" style={{ borderColor: "#DDE5F4" }}>
          {loadingTrail ? (
            <div className="text-[12px]" style={{ color: "#64748B" }}>Loading trail…</div>
          ) : !trail ? (
            <div className="text-[12px]" style={{ color: "#64748B" }}>
              Select an unsafe act to see its full lifecycle.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3"
                style={{ borderColor: "#E9EEF8" }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <HardHat className="h-4 w-4" style={{ color: "#4A57B9" }} />
                    <span className="text-[15px]" style={{ color: "#0F172A", fontWeight: 700 }}>
                      {trail.hazard.hazard_name || "Untitled hazard"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]"
                    style={{ color: "#64748B" }}>
                    <span style={{ color: "#4A57B9", fontWeight: 700 }}>{trail.hazard.reference}</span>
                    <span>{REGISTER_STATUS_LABEL[trail.hazard.register_status ?? ""] ?? trail.hazard.register_status}</span>
                    {trail.hazard.risk_score != null && <span>score {trail.hazard.risk_score}/25</span>}
                    {trail.hazard.persons_exposed != null && (
                      <span>{trail.hazard.persons_exposed} exposed</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {trail.hazard.priority && (
                    <span className="rounded px-2 py-0.5 text-[11px] text-white"
                      style={{ background: PRIORITY_COLOR[trail.hazard.priority] ?? "#64748B", fontWeight: 700 }}>
                      {trail.hazard.priority}
                    </span>
                  )}
                  <HierarchyPill level={trail.hazard.control_hierarchy} />
                </div>
              </div>

              {/* The facts a reader needs before the chronology */}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {trail.hazard.interim_control && (
                  <Fact icon={Flame} label="Interim control" value={trail.hazard.interim_control} />
                )}
                {trail.hazard.root_cause && (
                  <Fact icon={Search} label="Root cause" value={trail.hazard.root_cause} />
                )}
                {trail.hazard.planned_controls && (
                  <Fact icon={Wrench} label="Permanent control" value={trail.hazard.planned_controls} />
                )}
                {trail.hazard.lessons_learned && (
                  <Fact icon={GraduationCap} label="Lesson learned" value={trail.hazard.lessons_learned} />
                )}
              </div>

              {trail.hazard.verification_failures > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]"
                  style={{ borderColor: "#FDE68A", background: "#FFFBEB", color: "#92400E" }}>
                  <OctagonAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    This control failed verification {trail.hazard.verification_failures}× before it held.
                    A repeated failure usually means the control was the wrong level in the hierarchy.
                  </span>
                </div>
              )}

              {trail.skipped_stages.length > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]"
                  style={{ borderColor: "#FDE68A", background: "#FFFBEB", color: "#92400E" }}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    No action was recorded at {trail.skipped_stages.join(", ")}. The unsafe act moved past
                    {trail.skipped_stages.length === 1 ? " this stage" : " these stages"} without one.
                  </span>
                </div>
              )}

              {/* ── Stages ─────────────────────────────────────────────── */}
              <div className="mt-4 space-y-2.5">
                {trail.stages.map((stage) => {
                  const Icon = STAGE_ICON[stage.key];
                  return (
                    <div key={stage.key} className="rounded-lg border p-3"
                      style={{
                        borderColor: stage.state === "current" ? "#BFDBFE" : "#E9EEF8",
                        background: stage.state === "pending" ? "#FCFDFF" : "#FFFFFF",
                      }}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" style={{ color: "#4A57B9" }} />
                          <span className="text-[10.5px] tabular-nums" style={{ color: "#94A3B8", fontWeight: 700 }}>
                            {String(stage.number).padStart(2, "0")}
                          </span>
                          <span className="text-[13px]" style={{ color: "#111827", fontWeight: 700 }}>
                            {stage.label}
                          </span>
                          <StatePill state={stage.state} />
                        </div>
                        <span className="text-[11px]" style={{ color: "#94A3B8" }}>
                          {stage.action_count} action{stage.action_count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11.5px]" style={{ color: "#64748B" }}>
                        {stage.description}
                      </p>
                      {stage.actions.length > 0 && (
                        <ul className="mt-2.5 border-l pl-1" style={{ borderColor: "#E9EEF8" }}>
                          {stage.actions.map((a) => <ActionRow key={a.sequence} action={a} />)}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── People ─────────────────────────────────────────────── */}
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#4A57B9" }} />
                  <span className="text-[12.5px]" style={{ color: "#111827", fontWeight: 700 }}>
                    Who acted on this unsafe act
                  </span>
                </div>
                {trail.people.length === 0 ? (
                  <p className="text-[12px]" style={{ color: "#64748B" }}>
                    Nobody is recorded against this hazard.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {trail.people.map((p) => <PersonCard key={p.employee_id} person={p} />)}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Fact({
  icon: Icon, label, value,
}: Readonly<{ icon: LucideIcon; label: string; value: string }>) {
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: "#E3E9F6", background: "#FCFDFF" }}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3" style={{ color: "#4A57B9" }} />
        <span className="text-[10px] uppercase tracking-[0.4px]" style={{ color: "#94A3B8", fontWeight: 700 }}>
          {label}
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-snug" style={{ color: "#334155" }}>{value}</p>
    </div>
  );
}
