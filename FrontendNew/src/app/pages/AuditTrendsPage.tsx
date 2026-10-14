/**
 * WF-05 step 10 · trends and oversight.
 *
 * "Cross-site comparison, repeat-finding analysis and the re-audit decision sit
 * with the Admin on the web console."
 *
 * The question no single audit report can answer: is the same thing failing in
 * more than one place? One Minor NC at one site is a lapse. The same Minor NC at
 * six sites is a systemic failure, and only a view that spans audits can see it —
 * each report only knows about itself.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowDownRight, ArrowUpRight, CalendarX, Layers, Loader2, Minus, Repeat,
  TriangleAlert,
} from "lucide-react";
import {
  formatDate, getTrends, humanise, BAND_META,
  type TrendsResponse,
} from "../../services/audits.service";
import {
  Banner, ClassificationChip, EmptyState, FindingCounts, RiskBandChip,
} from "../components/audit/AuditPrimitives";
import { AuditsTabBar } from "../components/audits/AuditsTabBar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

const WINDOWS = [
  { days: 90, label: "90 days" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
  { days: 730, label: "2 years" },
];

export function AuditTrendsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [windowDays, setWindowDays] = useState(365);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (days: number) => {
    setLoading(true);
    setError(null);
    try {
      setData(await getTrends(days));
    } catch (e) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not load trends.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(windowDays); }, [load, windowDays]);

  const s = data?.summary;
  const late = data?.escalations?.audits_not_conducted ?? [];
  const systemic = (data?.repeat_findings ?? []).filter((r) => r.systemic);

  return (
    <div className="space-y-5 p-6">
      <AuditsTabBar />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Trends &amp; oversight</h1>
          <p className="mt-1 max-w-3xl text-[13px] text-slate-500">
            Cross-site comparison and repeat-finding analysis. A finding that recurs was already
            supposed to be controlled — the system flags it as more serious than a first occurrence.
          </p>
        </div>
        <div className="flex gap-1.5">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              onClick={() => setWindowDays(w.days)}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${
                windowDays === w.days
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error && <Banner tone="danger" title="Something went wrong" icon={<TriangleAlert className="h-4 w-4" />}>{error}</Banner>}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : !data ? null : (
        <>
          {/* Escalations that nobody has to notice */}
          {late.length > 0 && (
            <Banner tone="warn" title={`${late.length} audit(s) not conducted`} icon={<CalendarX className="h-4 w-4" />}>
              Past 110% of the scheduled date. A missed audit is itself a finding.
              <ul className="mt-1.5 space-y-0.5">
                {late.slice(0, 4).map((a, i) => (
                  <li key={i} className="text-[11.5px]">
                    <span className="font-semibold">{String(a.audit_ref ?? "")}</span>{" "}
                    {String(a.title ?? "")} — {String(a.days_late ?? 0)} days late
                  </li>
                ))}
              </ul>
            </Banner>
          )}

          {systemic.length > 0 && (
            <Banner tone="danger" title={`${systemic.length} finding(s) appearing at more than one site`} icon={<Layers className="h-4 w-4" />}>
              The same control is failing across sites. That is a systemic issue no individual audit
              report can see, and it belongs to the Admin's cross-site review.
            </Banner>
          )}

          {/* Headline */}
          {s && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Audits completed" value={s.audits_completed} hint={`in ${humanise(String(s.window_days))} days`} tone="#2563EB" />
              <Stat label="Average score" value={`${s.average_score}%`} hint={BAND_META[s.average_band].label} tone={BAND_META[s.average_band].color} />
              <Stat label="Open non-conformances" value={s.open_non_conformances} hint="awaiting verification" tone={s.open_non_conformances ? "#B45309" : "#047857"} />
              <Stat label="Re-audit decisions" value={s.open_re_audit_decisions} hint="pending with the Admin" tone={s.open_re_audit_decisions ? "#DC2626" : "#64748B"} />
              <Stat label="Still open" value={s.audits_open} hint={`${s.audits_closed} closed`} tone="#7C3AED" />
            </div>
          )}

          {/* Ratings breakdown */}
          {s && Object.keys(s.ratings ?? {}).length > 0 && (
            <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
              <CardHeader className="pb-2"><CardTitle className="text-[15px]">Overall ratings</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {Object.entries(s.ratings).map(([k, n]) => (
                  <div key={k} className="rounded-xl border border-slate-200 px-4 py-2.5">
                    <p className="text-2xl font-bold text-slate-900">{n}</p>
                    <p className="text-[11px] font-semibold text-slate-500">{humanise(k)}</p>
                  </div>
                ))}
                <div className="flex-1 self-center text-[11.5px] text-slate-500">
                  The rating is set from finding counts, not from the score — any Major
                  non-conformance or regulatory breach makes an audit unsatisfactory.
                </div>
              </CardContent>
            </Card>
          )}

          {/* Site comparison */}
          <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <CardHeader className="pb-2"><CardTitle className="text-[15px]">Site comparison</CardTitle></CardHeader>
            <CardContent className="p-0">
              {data.sites.length === 0 ? (
                <EmptyState title="No completed audits in this window" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-2.5 font-semibold">Site</th>
                        <th className="px-4 py-2.5 font-semibold">Band</th>
                        <th className="px-4 py-2.5 font-semibold">Latest</th>
                        <th className="px-4 py-2.5 font-semibold">Trend</th>
                        <th className="px-4 py-2.5 font-semibold">Average</th>
                        <th className="px-4 py-2.5 font-semibold">Findings</th>
                        <th className="px-4 py-2.5 font-semibold">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sites.map((r) => (
                        <tr key={`${r.site_id}-${r.site_name}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <p className="text-[13px] font-semibold text-slate-900">{r.site_name ?? "Unnamed site"}</p>
                            <p className="text-[10.5px] text-slate-500">
                              {r.audits_in_window} audit(s) · last {formatDate(r.latest_audit_date)}
                            </p>
                          </td>
                          <td className="px-4 py-3"><RiskBandChip value={r.risk_band} small /></td>
                          <td className="px-4 py-3">
                            {r.latest_score != null ? (
                              <button
                                className="text-[14px] font-bold hover:underline"
                                style={{ color: BAND_META[(r.latest_band as keyof typeof BAND_META) ?? "poor"].color }}
                                onClick={() => r.latest_audit_ref && navigate("/audits")}
                              >
                                {Math.round(r.latest_score)}%
                              </button>
                            ) : "—"}
                            <p className="text-[10px] text-slate-400">{humanise(r.latest_rating)}</p>
                          </td>
                          <td className="px-4 py-3"><Trend value={r.trend} /></td>
                          <td className="px-4 py-3 text-[13px] font-semibold text-slate-700">{r.average_score}%</td>
                          <td className="px-4 py-3"><FindingCounts counts={r.finding_counts} /></td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {r.below_threshold_twice && (
                                <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                                  BELOW 65% TWICE
                                </span>
                              )}
                              {r.open_re_audit && (
                                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                                  RE-AUDIT PENDING
                                </span>
                              )}
                              {r.major_or_critical > 1 && (
                                <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                                  {r.major_or_critical} MAJOR+
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Repeat & systemic findings */}
          <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <Repeat className="h-4 w-4" /> Repeat &amp; systemic findings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.repeat_findings.length === 0 ? (
                <EmptyState
                  title="Nothing has recurred"
                  hint="No finding has come back at the same site, or appeared at more than one site, in this window."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.repeat_findings.map((r) => (
                    <div key={r.title} className="flex gap-4 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-semibold text-slate-900">{r.title}</p>
                          {r.systemic && (
                            <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                              SYSTEMIC
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-slate-500">
                          {r.occurrences} occurrence{r.occurrences === 1 ? "" : "s"} across{" "}
                          {r.site_count} site{r.site_count === 1 ? "" : "s"}
                          {r.repeat_occurrences > 0 && ` · ${r.repeat_occurrences} flagged as repeats`}
                          {r.section && ` · ${r.section}`}
                          {r.last_seen && ` · last seen ${formatDate(r.last_seen)}`}
                        </p>
                        {r.site_names.length > 0 && (
                          <p className="mt-1 text-[11px] text-slate-400">{r.site_names.join(" · ")}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <ClassificationChip value={r.worst_classification} small />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* The five triggers, as reference */}
          <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <CardHeader className="pb-2"><CardTitle className="text-[15px]">The five escalation triggers</CardTitle></CardHeader>
            <CardContent className="grid gap-2.5 lg:grid-cols-2">
              {(data.escalations.definitions ?? []).map((d) => (
                <div key={d.key} className="rounded-xl border p-3" style={{ borderColor: "#FECACA", background: "#FEF2F2" }}>
                  <p className="text-[12.5px] font-bold text-red-700">{d.label}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-red-900/80">{d.detail}</p>
                </div>
              ))}
              <p className="lg:col-span-2 text-[11px] text-slate-400">
                Each fires on its own, without anyone needing to notice.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Trend({ value }: { value?: number | null }) {
  if (value == null) return <span className="text-[12px] text-slate-400">—</span>;
  const up = value > 0;
  const flat = value === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const color = flat ? "#64748B" : up ? "#047857" : "#B91C1C";
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-bold" style={{ color }}>
      <Icon className="h-3.5 w-3.5" />
      {up ? "+" : ""}{value}
    </span>
  );
}

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

export default AuditTrendsPage;
