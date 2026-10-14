import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { AlertTriangle, ChevronRight, Loader2, Search, Users } from "lucide-react";
import {
  getNearMissTrail, getTrackedNearMisses,
  type NearMissTrailResponse, type StageKey, type TrackedNearMiss,
} from "../../services/near-miss-trail.service";
import {
  ActionRow, PRIORITY_COLOR, PersonCard, STAGE_ICON, STAGE_ORDER, StageBlock, formatDateTime,
} from "../components/tracking/lifecycle";
import { NearMissTabBar } from "../components/audits/NearMissTabBar";
import { EventFamilyTabBar } from "../components/audits/EventFamilyTabBar";

/**
 * Admin near-miss lifecycle tracker.
 *
 * The counterpart to `IncidentTrackingPage`, answering the same question for
 * the near-miss family: what has happened to this record, by whom, when, across
 * all eight stages of the workflow engine.
 *
 * Everything here is the data the mobile app writes. A worker reporting a near
 * miss on a phone creates the RECORD entry; the supervisor's acknowledgement,
 * investigation and corrective action, and the manager's verification and
 * closure, each land as further actions on the same trail. Nothing on this
 * screen writes.
 *
 * The stage rail, action rows and people cards come from the shared
 * `components/tracking/lifecycle` module, which the incident tracker uses too —
 * the backend serves both families an identical shape precisely so one renderer
 * can draw them.
 */

const NOUN = "near miss";

export function NearMissTrackingPage() {
  // Deep link from the dashboard's "Latest reports" panel: /near-miss/tracking?id=123
  // opens straight onto that record instead of dropping the reader on the
  // list and making them find it again.
  const [searchParams] = useSearchParams();
  const linkedId = Number(searchParams.get("id"));

  const [items, setItems] = useState<TrackedNearMiss[]>([]);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<number | null>(
    Number.isFinite(linkedId) && linkedId > 0 ? linkedId : null,
  );
  const [trail, setTrail] = useState<NearMissTrailResponse | null>(null);
  const [stageFilter, setStageFilter] = useState<StageKey | "">("");
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTrail, setLoadingTrail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const data = await getTrackedNearMisses({ stage: stageFilter || undefined, q: query || undefined });
      setItems(data.items);
      setStageCounts(data.stage_counts ?? {});
      setSelectedId((prev) => (prev && data.items.some((i) => i.id === prev) ? prev : data.items[0]?.id ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load near misses");
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
    getNearMissTrail(selectedId)
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
      <NearMissTabBar />
      <div>
        <h1 className="text-[19px]" style={{ color: "#0F172A", fontWeight: 700 }}>Near Miss Lifecycle Tracking</h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "#64748B" }}>
          Every action on every near miss, stage 01 Record through stage 08 Close — who did it and when.
          Reports raised on the mobile app appear here as they are submitted.
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
                placeholder="Search near misses…"
                className="w-full rounded-md border py-1.5 pl-8 pr-2 text-[12.5px] outline-none"
                style={{ borderColor: "#DDE5F4", color: "#111827" }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px]" style={{ color: "#64748B" }}>
              <span>{items.length} shown{stageFilter ? ` · ${stageFilter}` : ""}</span>
              <span>{totalTracked} tracked</span>
            </div>
          </div>

          <div className="max-h-[62vh] overflow-y-auto">
            {loadingList ? (
              <div className="flex items-center justify-center gap-2 py-8 text-[12px]" style={{ color: "#64748B" }}>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-[12px]" style={{ color: "#94A3B8" }}>No near misses match.</p>
            ) : (
              items.map((nm) => {
                const active = nm.id === selectedId;
                return (
                  <button
                    key={nm.id}
                    type="button"
                    onClick={() => setSelectedId(nm.id)}
                    className="flex w-full items-start gap-2 border-b px-3 py-2.5 text-left transition-colors"
                    style={{ borderColor: "#F1F5F9", background: active ? "#EEF2FB" : "transparent" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11.5px]" style={{ color: "#4A57B9", fontWeight: 700 }}>{nm.reference}</span>
                        {nm.priority && (
                          <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                            style={{ background: `${PRIORITY_COLOR[nm.priority] ?? "#64748B"}1A`,
                              color: PRIORITY_COLOR[nm.priority] ?? "#64748B", fontWeight: 700 }}>
                            {nm.priority}
                          </span>
                        )}
                        {nm.is_hipo && (
                          <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                            style={{ background: "#FEE2E2", color: "#B91C1C", fontWeight: 700 }}>HiPo</span>
                        )}
                        {nm.is_recurring && (
                          <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                            style={{ background: "#FEF3C7", color: "#B45309", fontWeight: 700 }}>Recurring</span>
                        )}
                        {nm.is_overdue && (
                          <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                            style={{ background: "#FEF3C7", color: "#B45309", fontWeight: 700 }}>Overdue</span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[12px]" style={{ color: "#1F2937" }}>
                        {nm.description || "—"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10.5px]" style={{ color: "#64748B" }}>
                        <span style={{ fontWeight: 700, color: "#334155" }}>
                          {nm.stage_number ? `${String(nm.stage_number).padStart(2, "0")} ${nm.stage}` : "unmapped"}
                        </span>
                        <span>· {nm.action_count} actions</span>
                        {nm.capa_total > 0 && (
                          <span>· CAPA {nm.capa_total - nm.capa_open}/{nm.capa_total}</span>
                        )}
                        {nm.station_name && <span>· {nm.station_name}</span>}
                      </div>
                      {(nm.reported_by_name || nm.supervisor_name) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Users className="h-3 w-3" style={{ color: "#A3AEC6" }} />
                          {nm.reported_by_name && (
                            <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                              style={{ background: "#F1F5F9", color: "#475569" }}
                              title={`Reported by ${nm.reported_by_name}`}>
                              {nm.reported_by_name}
                            </span>
                          )}
                          {nm.supervisor_name && (
                            <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                              style={{ background: "#F1F5F9", color: "#475569" }}
                              title={`Supervisor ${nm.supervisor_name}`}>
                              {nm.supervisor_name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="mt-1 h-3.5 w-3.5 flex-shrink-0" style={{ color: active ? "#4A57B9" : "#CBD5E1" }} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Trail ────────────────────────────────────────────────────── */}
        <div className="rounded-lg border bg-white p-4" style={{ borderColor: "#DDE5F4" }}>
          {loadingTrail ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12px]" style={{ color: "#64748B" }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading trail…
            </div>
          ) : !trail ? (
            <p className="py-10 text-center text-[12px]" style={{ color: "#94A3B8" }}>
              Select a near miss to see every action recorded against it.
            </p>
          ) : (
            <>
              <div className="border-b pb-3" style={{ borderColor: "#E9EEF8" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px]" style={{ color: "#0F172A", fontWeight: 700 }}>{trail.record.reference}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10.5px]"
                    style={{ background: "#EEF2FB", color: "#4A57B9", fontWeight: 700 }}>
                    {trail.record.workflow_status}
                  </span>
                  {trail.record.is_hipo && (
                    <span className="rounded-full px-2 py-0.5 text-[10.5px]"
                      style={{ background: "#FEE2E2", color: "#B91C1C", fontWeight: 700 }}>High potential</span>
                  )}
                  {trail.record.verification_result && (
                    <span className="rounded-full px-2 py-0.5 text-[10.5px]"
                      style={{ background: "#DCFCE7", color: "#15803D", fontWeight: 700 }}>
                      Auditor: {trail.record.verification_result}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12.5px]" style={{ color: "#374151" }}>{trail.record.description || "—"}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "#64748B" }}>
                  <span>Reported {formatDateTime(trail.record.reported_at)}</span>
                  <span>{trail.record.closed_at ? `Closed ${formatDateTime(trail.record.closed_at)}` : "Not closed"}</span>
                  {trail.record.potential_consequence && (
                    <span>Could have been: <strong>{trail.record.potential_consequence.replace(/_/g, " ")}</strong></span>
                  )}
                  <span style={{ fontWeight: 700, color: "#334155" }}>{trail.total_actions} actions tracked</span>
                </div>
              </div>

              {trail.skipped_stages.length > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-[11.5px]"
                  style={{ background: "#FFFBEB", color: "#92400E" }}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Passed <strong>{trail.skipped_stages.join(", ")}</strong> with no action recorded.
                  </span>
                </div>
              )}

              {trail.chronology_warnings.length > 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-md px-3 py-2 text-[11.5px]"
                  style={{ background: "#FEF2F2", color: "#B91C1C" }}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {trail.chronology_warnings.length} action
                    {trail.chronology_warnings.length === 1 ? " carries a timestamp" : "s carry timestamps"} earlier
                    than a preceding stage. Actions are ordered by stage, not by clock — the underlying
                    timestamps are written from mixed time bases and cannot be compared directly.
                  </span>
                </div>
              )}

              {/* Who was involved — the whole cast, before the step by step */}
              <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "#E3E9F6", background: "#F9FBFF" }}>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" style={{ color: "#4A57B9" }} />
                  <span className="text-[11.5px] uppercase tracking-[0.6px]" style={{ color: "#334155", fontWeight: 700 }}>
                    People involved
                  </span>
                  <span className="text-[11px]" style={{ color: "#94A3B8" }}>
                    {trail.people.length} identified
                  </span>
                </div>

                {trail.people.length === 0 ? (
                  <p className="mt-2 text-[11.5px]" style={{ color: "#B45309" }}>
                    No employee is recorded against any action on this near miss.
                  </p>
                ) : (
                  <div className="mt-2.5 grid gap-2 md:grid-cols-2">
                    {trail.people.map((p) => <PersonCard key={p.employee_id} person={p} subjectNoun={NOUN} />)}
                  </div>
                )}

                {trail.named_in_report.witnesses.length > 0 && (
                  <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "#E9EEF8" }}>
                    <div className="text-[10.5px] uppercase tracking-[0.5px]" style={{ color: "#94A3B8", fontWeight: 700 }}>
                      Also named in the report
                    </div>
                    <div className="mt-1 text-[11.5px]" style={{ color: "#475569" }}>
                      Witnesses: <strong>{trail.named_in_report.witnesses.join(", ")}</strong>
                    </div>
                    <p className="mt-1 text-[10.5px]" style={{ color: "#94A3B8" }}>
                      Entered as free text on the phone — not linked to an employee record, so they carry no employee ID.
                    </p>
                  </div>
                )}
              </div>

              {/* What the investigation concluded, where it exists */}
              {(trail.record.root_cause || trail.record.lessons_learned || trail.record.closure_notes) && (
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {[
                    { label: "Root cause", value: trail.record.root_cause },
                    { label: "Lesson recorded", value: trail.record.lessons_learned },
                    { label: "Closure notes", value: trail.record.closure_notes },
                  ].filter((f) => f.value).map((f) => (
                    <div key={f.label} className="rounded-lg border p-2.5" style={{ borderColor: "#E3E9F6" }}>
                      <div className="text-[10px] uppercase tracking-[0.5px]" style={{ color: "#94A3B8", fontWeight: 700 }}>
                        {f.label}
                      </div>
                      <p className="mt-1 text-[11.5px] leading-snug" style={{ color: "#374151" }}>{f.value}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4">
                {trail.stages.map((s) => <StageBlock key={s.key} stage={s} subjectNoun={NOUN} />)}
              </div>

              {trail.unstaged_actions.length > 0 && (
                <div className="mt-2 border-t pt-3" style={{ borderColor: "#E9EEF8" }}>
                  <div className="text-[11px] uppercase tracking-[0.6px]" style={{ color: "#94A3B8", fontWeight: 700 }}>
                    Not mapped to a stage
                  </div>
                  <ul className="mt-2 border-l" style={{ borderColor: "#E5EAF5" }}>
                    {trail.unstaged_actions.map((a) => <ActionRow key={`u-${a.sequence}`} action={a} />)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
