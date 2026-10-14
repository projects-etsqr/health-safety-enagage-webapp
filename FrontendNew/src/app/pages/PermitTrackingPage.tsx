import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Loader2, Search, Users, Zap } from "lucide-react";
import {
  getPermitTrail, getTrackedPermits,
  type PermitTrailResponse, type StageKey, type TrackedPermit,
} from "../../services/permit-trail.service";
import {
  ActionRow, PersonCard, STAGE_ICON, STAGE_ORDER, StageBlock, formatDateTime,
} from "../components/tracking/lifecycle";
import { EventFamilyTabBar } from "../components/audits/EventFamilyTabBar";

/**
 * Admin permit-to-work lifecycle tracker.
 *
 * The third family on the shared eight-stage tracker, after incidents and near
 * misses — the workflow slide puts permits through the same lifecycle, and the
 * backend has mapped them onto it since `PERMIT_STATUS_STAGE`. What was missing
 * was anywhere to see it: no console page rendered a permit's stage at all.
 *
 * Two things here have no equivalent on the report families and are worth the
 * screen space: the pre-issue **gate** verdict, which is why a permit sits at
 * RESPOND rather than being issued, and **validity** — a permit past its end
 * date while still live means work may be continuing under a dead permit, which
 * is the most urgent row an admin can be shown.
 */

const NOUN = "permit";

const GATE_TINT: Record<string, { bg: string; fg: string }> = {
  pass:  { bg: "#DCFCE7", fg: "#15803D" },
  amber: { bg: "#FEF3C7", fg: "#B45309" },
  block: { bg: "#FEE2E2", fg: "#B91C1C" },
};

export function PermitTrackingPage() {
  const [items, setItems] = useState<TrackedPermit[]>([]);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [trail, setTrail] = useState<PermitTrailResponse | null>(null);
  const [stageFilter, setStageFilter] = useState<StageKey | "">("");
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTrail, setLoadingTrail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const data = await getTrackedPermits({ stage: stageFilter || undefined, q: query || undefined });
      setItems(data.items);
      setStageCounts(data.stage_counts ?? {});
      setSelectedId((prev) => (prev && data.items.some((i) => i.id === prev) ? prev : data.items[0]?.id ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load permits");
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
    getPermitTrail(selectedId)
      .then((d) => { if (!cancelled) setTrail(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load trail"); })
      .finally(() => { if (!cancelled) setLoadingTrail(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const totalTracked = useMemo(
    () => Object.values(stageCounts).reduce((s, n) => s + n, 0),
    [stageCounts],
  );

  return (
    <div className="space-y-4">
      <EventFamilyTabBar />
      <div>
        <h1 className="text-[19px]" style={{ color: "#0F172A", fontWeight: 700 }}>Permit Lifecycle Tracking</h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "#64748B" }}>
          Every action on every permit to work, stage 01 Record through stage 08 Close — who did it and when.
          Permits raised on the mobile app appear here as they are submitted.
        </p>
      </div>

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
              <div className="mt-1 truncate text-[11px] uppercase tracking-[0.4px]" style={{ color: "#334155", fontWeight: 700 }}>
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
        <div className="rounded-lg border bg-white" style={{ borderColor: "#DDE5F4" }}>
          <div className="border-b p-2.5" style={{ borderColor: "#E9EEF8" }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "#94A3B8" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search permits…"
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
              <p className="py-8 text-center text-[12px]" style={{ color: "#94A3B8" }}>No permits match.</p>
            ) : (
              items.map((p) => {
                const active = p.id === selectedId;
                const gate = GATE_TINT[p.gate_status ?? ""];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="flex w-full items-start gap-2 border-b px-3 py-2.5 text-left transition-colors"
                    style={{ borderColor: "#F1F5F9", background: active ? "#EEF2FB" : "transparent" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11.5px]" style={{ color: "#4A57B9", fontWeight: 700 }}>{p.reference}</span>
                        {gate && (
                          <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                            style={{ background: gate.bg, color: gate.fg, fontWeight: 700 }}>
                            gate {p.gate_status}
                          </span>
                        )}
                        {p.is_high_energy && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9.5px]"
                            style={{ background: "#FEF3C7", color: "#B45309", fontWeight: 700 }}>
                            <Zap className="h-2.5 w-2.5" /> High energy
                          </span>
                        )}
                        {p.is_overdue && (
                          <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                            style={{ background: "#FEE2E2", color: "#B91C1C", fontWeight: 700 }}>Past validity</span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[12px]" style={{ color: "#1F2937" }}>
                        {p.description || p.permit_type || "—"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10.5px]" style={{ color: "#64748B" }}>
                        <span style={{ fontWeight: 700, color: "#334155" }}>
                          {p.stage_number ? `${String(p.stage_number).padStart(2, "0")} ${p.stage}` : "unmapped"}
                        </span>
                        <span>· {p.action_count} actions</span>
                        {p.permit_type && <span>· {p.permit_type}</span>}
                        {p.station_name && <span>· {p.station_name}</span>}
                      </div>
                      {(p.requested_by_name || p.approved_by_name) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Users className="h-3 w-3" style={{ color: "#A3AEC6" }} />
                          {p.requested_by_name && (
                            <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                              style={{ background: "#F1F5F9", color: "#475569" }}
                              title={`Requested by ${p.requested_by_name}`}>{p.requested_by_name}</span>
                          )}
                          {p.approved_by_name && (
                            <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                              style={{ background: "#F1F5F9", color: "#475569" }}
                              title={`Approved by ${p.approved_by_name}`}>{p.approved_by_name}</span>
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

        <div className="rounded-lg border bg-white p-4" style={{ borderColor: "#DDE5F4" }}>
          {loadingTrail ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12px]" style={{ color: "#64748B" }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading trail…
            </div>
          ) : !trail ? (
            <p className="py-10 text-center text-[12px]" style={{ color: "#94A3B8" }}>
              Select a permit to see every action recorded against it.
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
                  {trail.record.verification_result && (
                    <span className="rounded-full px-2 py-0.5 text-[10.5px]"
                      style={{ background: "#DCFCE7", color: "#15803D", fontWeight: 700 }}>
                      Auditor: {trail.record.verification_result}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12.5px]" style={{ color: "#374151" }}>{trail.record.description || "—"}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "#64748B" }}>
                  <span>Requested {formatDateTime(trail.record.requested_at)}</span>
                  <span>Valid {formatDateTime(trail.record.validity_start)} → {formatDateTime(trail.record.validity_end)}</span>
                  <span style={{ fontWeight: 700, color: "#334155" }}>{trail.total_actions} actions tracked</span>
                </div>
              </div>

              {trail.record.gate_blocked_reason && (
                <div className="mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-[11.5px]"
                  style={{ background: "#FEF2F2", color: "#B91C1C" }}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>Gate blocked: {trail.record.gate_blocked_reason}</span>
                </div>
              )}
              {trail.record.suspension_reason && (
                <div className="mt-2 flex items-start gap-2 rounded-md px-3 py-2 text-[11.5px]"
                  style={{ background: "#FFFBEB", color: "#92400E" }}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>Work was suspended: {trail.record.suspension_reason}</span>
                </div>
              )}
              {trail.skipped_stages.length > 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-md px-3 py-2 text-[11.5px]"
                  style={{ background: "#FFFBEB", color: "#92400E" }}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>Passed <strong>{trail.skipped_stages.join(", ")}</strong> with no action recorded.</span>
                </div>
              )}
              {trail.chronology_warnings.length > 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-md px-3 py-2 text-[11.5px]"
                  style={{ background: "#FEF2F2", color: "#B91C1C" }}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {trail.chronology_warnings.length} action
                    {trail.chronology_warnings.length === 1 ? " carries a timestamp" : "s carry timestamps"} earlier
                    than a preceding stage. Actions are ordered by stage, not by clock.
                  </span>
                </div>
              )}

              <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "#E3E9F6", background: "#F9FBFF" }}>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" style={{ color: "#4A57B9" }} />
                  <span className="text-[11.5px] uppercase tracking-[0.6px]" style={{ color: "#334155", fontWeight: 700 }}>
                    People involved
                  </span>
                  <span className="text-[11px]" style={{ color: "#94A3B8" }}>{trail.people.length} identified</span>
                </div>
                {trail.people.length === 0 ? (
                  <p className="mt-2 text-[11.5px]" style={{ color: "#B45309" }}>
                    No employee is recorded against any action on this permit.
                  </p>
                ) : (
                  <div className="mt-2.5 grid gap-2 md:grid-cols-2">
                    {trail.people.map((p) => <PersonCard key={p.employee_id} person={p} subjectNoun={NOUN} />)}
                  </div>
                )}
              </div>

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
