/**
 * WF-05 step 01 · the annual programme.
 *
 * "Audits are not booked by hand. The system generates the annual programme from
 * each site's risk band, and that band is driven by the site's own safety
 * performance score. A site that deteriorates gets audited more often,
 * automatically."
 *
 * So this screen never lets anyone type an audit date. What it lets people do is
 * authorise the cadence the band implies, and press generate. The Admin owns the
 * whole programme on this platform — the Safety Manager is a mobile role with no
 * audit screens, so naming them here would describe a workflow that deadlocks.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  CalendarClock, CheckCircle2, ChevronDown, ChevronRight, Loader2, RefreshCw,
  ShieldCheck, Sparkles, TriangleAlert, Bell,
} from "lucide-react";
import {
  approveProgramme, authoriseProgramme, formatDate, generateCalendar, getAuditReference,
  getProgramme, sendReminders, humanise,
  type AuditReference, type GenerationResult, type ProgrammeRow,
} from "../../services/audits.service";
import { Banner, EmptyState, RiskBandChip } from "../components/audit/AuditPrimitives";
import { AuditsTabBar } from "../components/audits/AuditsTabBar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint: string; tone: string }) {
  return (
    <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-1.5 text-2xl font-bold" style={{ color: tone }}>{value}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function AuditProgrammePage() {
  const [rows, setRows] = useState<ProgrammeRow[]>([]);
  const [reference, setReference] = useState<AuditReference | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [results, setResults] = useState<GenerationResult[] | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [concerns, setConcerns] = useState<Record<number, string>>({});
  const year = new Date().getFullYear();

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      const [p, r] = await Promise.all([
        getProgramme(refresh),
        reference ? Promise.resolve(reference) : getAuditReference().catch(() => null),
      ]);
      setRows(p);
      if (r) setReference(r);
    } catch (e) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not load the programme.");
    } finally {
      setLoading(false);
      setBusy(null);
    }
  }, [reference]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    total: rows.length,
    authorised: rows.filter((r) => r.authorised_at).length,
    approved: rows.filter((r) => r.approved_at).length,
    overdue: rows.filter((r) => r.overdue).length,
    critical: rows.filter((r) => r.risk_band === "critical" || r.risk_band === "high").length,
    generated: rows.reduce((n, r) => n + (r.generated_count ?? 0), 0),
  }), [rows]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "That did not work.");
      setBusy(null);
    }
  };

  const generateAll = () =>
    act("generate", async () => {
      const out = await generateCalendar({ year, require_authorisation: true });
      setResults(out);
    });

  return (
    <div className="space-y-5 p-6">
      <AuditsTabBar />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Audit schedule</h1>
          {/* Says what the page is before it says how it works. The previous copy
              opened with "generated from each site's risk band", which only makes
              sense to somebody who already knows what this page does. */}
          <p className="mt-1 max-w-3xl text-[13px] text-slate-600">
            The site visits booked for {year} — which sites, and when. Press <strong>Generate {year} calendar</strong>
            {" "}to fill the year.
          </p>
          <p className="mt-1 max-w-3xl text-[12.5px] text-slate-500">
            How often a site is visited comes from its risk band, and the band comes from that site's own
            safety score. A site that deteriorates is visited more often, automatically — nobody books a
            visit by hand.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setBusy("refresh"); void load(true); }} disabled={!!busy}>
            {busy === "refresh" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Recompute bands
          </Button>
          <Button variant="outline" size="sm" onClick={() => act("reminders", sendReminders)} disabled={!!busy}>
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            Send 14-day reminders
          </Button>
          <Button size="sm" onClick={generateAll} disabled={!!busy || counts.authorised === 0}>
            {busy === "generate" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Generate {year} calendar
          </Button>
        </div>
      </div>

      {error && <Banner tone="danger" title="Something went wrong" icon={<TriangleAlert className="h-4 w-4" />}>{error}</Banner>}

      {counts.authorised === 0 && rows.length > 0 && (
        <Banner tone="warn" title="Nothing is authorised yet" icon={<ShieldCheck className="h-4 w-4" />}>
          Computing a cadence and authorising it are different acts. The generator refuses to create a
          year of work at a site whose programme nobody has signed off.
        </Banner>
      )}

      {results && (() => {
        const created = results.reduce((n, r) => n + r.total, 0);
        const already = results.reduce((n, r) => n + (r.skipped_existing ?? 0), 0);
        return (
          <Banner
            tone={created > 0 ? "ok" : "info"}
            title={
              created > 0
                ? `${created} visit${created === 1 ? "" : "s"} booked`
                : "Nothing to book — the year is already full"
            }
            icon={<CalendarClock className="h-4 w-4" />}
          >
            <ul className="mt-1 space-y-0.5">
              {results.map((r) => (
                <li key={`${r.site_id}`}>
                  <span className="font-semibold">{r.site_name ?? "Site"}</span>{" — "}
                  {r.reason
                    ? r.reason
                    : `${r.inspections_created} inspection(s) + ${r.audits_created} audit(s)` +
                      (r.skipped_existing ? `, ${r.skipped_existing} already booked` : "")}
                </li>
              ))}
            </ul>
            {/* The page used to stop at the count and leave the reader guessing.
                A booked visit has nobody assigned to it, so nothing happens until
                somebody is named on it in the Register — that is the next step and
                it belongs here, where the question is being asked. */}
            <p className="mt-2 text-[12.5px]">
              {created > 0 ? (
                <>
                  Nobody is assigned to {created === 1 ? "it" : "them"} yet.{" "}
                  <Link to="/audits" className="font-semibold underline underline-offset-2">
                    Open the Register
                  </Link>{" "}
                  and press Assign to give {created === 1 ? "it" : "each one"} an auditor — until then it is
                  only a date in a diary.
                </>
              ) : (
                <>
                  {already > 0
                    ? `Every slot for ${year} already has a visit booked, so nothing was added. `
                    : ""}
                  Pressing this again is safe — it never books the same visit twice.
                </>
              )}
            </p>
          </Banner>
        );
      })()}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Sites" value={counts.total} hint="in the programme" tone="#2563EB" />
        <Stat label="Authorised" value={`${counts.authorised}/${counts.total}`} hint="by the Admin" tone="#047857" />
        <Stat label="Approved" value={`${counts.approved}/${counts.total}`} hint="calendar, by the Admin" tone="#7C3AED" />
        <Stat label="High or critical" value={counts.critical} hint="monthly inspection cadence" tone="#DC2626" />
        <Stat label="Overdue" value={counts.overdue} hint="past their next audit date" tone={counts.overdue ? "#DC2626" : "#64748B"} />
      </div>

      {/* The frequency table, stated the way the specification states it */}
      {reference?.frequency && (
        <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">Frequency by site risk band</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="bg-slate-900 text-[10px] uppercase tracking-wider text-white">
                  <th className="px-4 py-2.5 font-semibold">Band</th>
                  <th className="px-4 py-2.5 font-semibold">Qualifying criteria</th>
                  <th className="px-4 py-2.5 font-semibold">How often</th>
                  <th className="px-4 py-2.5 font-semibold">Re-audit trigger</th>
                </tr>
              </thead>
              <tbody>
                {reference.frequency.map((f) => (
                  <tr key={f.band} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3"><RiskBandChip value={f.band} /></td>
                    <td className="px-4 py-3 text-[12px] text-slate-700">{f.qualifying}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-700">{f.how_often}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-700">{f.re_audit_trigger}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Per-site */}
      <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-[15px]">Sites</CardTitle>
          <Button
            variant="outline" size="sm"
            onClick={() => act("approve", () => approveProgramme({ approved: true }))}
            disabled={!!busy || counts.total === 0}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Approve calendar (all sites)
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState title="No sites in the programme" hint="Add sites, then recompute the bands." />
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((r) => {
                const open = expanded === r.site_id;
                const siteId = r.site_id ?? 0;
                return (
                  <div key={siteId}>
                    <button
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      onClick={() => setExpanded(open ? null : siteId)}
                    >
                      {open ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                      <RiskBandChip value={r.risk_band} small />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-900">{r.site_name ?? "Unnamed site"}</p>
                        <p className="text-[11px] text-slate-500">
                          {humanise(r.inspection_frequency)} inspection · {humanise(r.audit_frequency)} audit
                          {r.site_score != null && ` · safety score ${r.site_score}`}
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className={`text-[12px] font-semibold ${r.overdue ? "text-red-600" : "text-slate-700"}`}>
                          {formatDate(r.next_audit_due)}
                        </p>
                        <p className="text-[10px] text-slate-400">next audit</p>
                      </div>
                      <div className="flex w-[112px] shrink-0 flex-col items-end gap-1">
                        {r.authorised_at ? (
                          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">AUTHORISED</span>
                        ) : (
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">NOT AUTHORISED</span>
                        )}
                        {r.approved_at && (
                          <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">APPROVED</span>
                        )}
                      </div>
                    </button>

                    {open && (
                      <div className="space-y-4 bg-slate-50/60 px-4 py-4 pl-11">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-1.5 text-[12px]">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Why this cadence</p>
                            <p className="text-slate-700">{r.qualifying}</p>
                            <p className="text-slate-500">
                              Re-audit trigger: {r.re_audit_trigger}
                            </p>
                            <p className="text-slate-500">
                              Next inspection {formatDate(r.next_inspection_due)} · last audit {formatDate(r.last_audit_at)}
                            </p>
                            {!!r.generated_count && (
                              <p className="text-slate-500">
                                {r.generated_count} event(s) generated{r.generated_at ? ` on ${formatDate(r.generated_at)}` : ""}
                                {r.programme_year ? ` for ${r.programme_year}` : ""}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Authorise this site's programme
                            </p>
                            <textarea
                              className="w-full rounded-lg border border-slate-200 p-2 text-[12px]"
                              rows={2}
                              placeholder="Note — why this cadence is right for this site"
                              value={notes[siteId] ?? r.scope_concerns ?? ""}
                              onChange={(e) => setNotes((p) => ({ ...p, [siteId]: e.target.value }))}
                            />
                            <textarea
                              className="w-full rounded-lg border border-slate-200 p-2 text-[12px]"
                              rows={2}
                              placeholder="A specific concern to include in scope (reaches the auditor in their brief)"
                              value={concerns[siteId] ?? r.scope_concerns ?? ""}
                              onChange={(e) => setConcerns((p) => ({ ...p, [siteId]: e.target.value }))}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                disabled={!!busy}
                                onClick={() => act(`auth-${siteId}`, () => authoriseProgramme(siteId, {
                                  authorised: true,
                                  note: notes[siteId],
                                  scope_concerns: concerns[siteId],
                                }))}
                              >
                                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                                {r.authorised_at ? "Re-authorise" : "Authorise"}
                              </Button>
                              {r.authorised_at && (
                                <Button
                                  variant="outline" size="sm" disabled={!!busy}
                                  onClick={() => act(`unauth-${siteId}`, () => authoriseProgramme(siteId, { authorised: false }))}
                                >
                                  Withdraw
                                </Button>
                              )}
                              <Button
                                variant="outline" size="sm"
                                disabled={!!busy || !r.authorised_at}
                                onClick={() => act(`gen-${siteId}`, async () => {
                                  setResults(await generateCalendar({ year, site_id: siteId }));
                                })}
                              >
                                <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                                Generate {year}
                              </Button>
                            </div>
                            {!r.authorised_at && (
                              <p className="text-[11px] text-amber-700">
                                Generation is refused until this is authorised.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="pb-4 text-[11px] leading-relaxed text-slate-400">
        Auditors consume this programme; they do not build it. Generation is idempotent — it counts
        what is already booked in each window and fills only the gap, so running it twice produces the
        same calendar as running it once.
      </p>
    </div>
  );
}

export default AuditProgrammePage;
