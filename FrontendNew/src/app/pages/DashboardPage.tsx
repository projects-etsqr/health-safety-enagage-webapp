﻿import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useNavigate } from "react-router";
import { AlertTriangle, ArrowDown, ArrowUp, CalendarDays, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { InfoTooltip } from "../components/shared/InfoTooltip";
import {
  getDashboardStats,
  getIncidentsByCategory,
  getCapaActions,
  getOverdueCapa,
  getLeadingIndicators,
  getNearMissesRecent,
  getSafetyWalksRecent,
  type DashboardStats,
  type IncidentByCategory,
  type CapaAction,
  type OverdueCapa as OverdueCapaItem,
  type LeadingIndicators,
  type RecentNearMiss,
  type RecentSafetyWalk,
} from "../../services/dashboard.service";

type Preset = "7D" | "30D" | "90D" | "1Y" | "ALL" | "CUSTOM";

const PRESETS: { label: string; key: Preset }[] = [
  { label: "7D",  key: "7D"  },
  { label: "30D", key: "30D" },
  { label: "90D", key: "90D" },
  { label: "1Y",  key: "1Y"  },
  { label: "All", key: "ALL" },
  { label: "Custom", key: "CUSTOM" },
];

// A preset button sends how many days back to look, not literal dates — the
// backend resolves that against the org's own latest recorded data instead
// of the real system clock (app/controllers/dashboard.py's _resolve_window),
// so "7D" means the 7 most recent days of data, not 7 days that happen to be
// empty because the browser's "today" has drifted past where the data is.
function presetDays(preset: Preset): number | undefined {
  switch (preset) {
    case "7D":  return 7;
    case "30D": return 30;
    case "90D": return 90;
    case "1Y":  return 365;
    default:    return undefined; // ALL, CUSTOM
  }
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'No Date';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatFilterDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface KpiItem {
  title: string;
  value: string;
  sub: string;
  accent: string;
  border: string;
  inline: string;
  trendDown: boolean;
  /** Optional Info-icon tooltip content — only the Predictive Injury Risk
   *  Score card sets this; every other card renders exactly as before. */
  info?: React.ReactNode;
}

// ── Predictive Injury Risk Score — Info tooltip content ────────────────────────
// Renders straight from LeadingIndicators (the same object the KPI card reads),
// so the tooltip can never drift from the card: same score, same trend, same
// selected period, same underlying counts.
function PredictiveRiskInfoContent({ leading }: { leading: LeadingIndicators }) {
  const d = leading.predictive_injury_risk_detail;
  const current = leading.predictive_injury_risk_score;
  const previous = leading.predictive_injury_risk_previous_score;
  const trend = leading.predictive_injury_risk_trend;
  const trendArrow = trend < 0 ? '↓' : trend > 0 ? '↑' : '→';
  const pct = (n: number) => `${Math.abs(n)} percentage point${Math.abs(n) === 1 ? '' : 's'}`;
  const plural = (n: number) => (n === 1 ? '' : 's');

  const currentRange = `${formatFilterDate(d.current_window_start)} – ${formatFilterDate(d.current_window_end)}`;
  const previousRange = `${formatFilterDate(d.previous_window_start)} – ${formatFilterDate(d.previous_window_end)}`;

  const scoreFormula = (weightSum: number, count: number, score: number) =>
    count === 0
      ? 'No incidents recorded in this period → score defaults to 0%.'
      : `(${weightSum} ÷ (${count} × 3)) × 100 = ${score}%`;

  let interpretation: string;
  if (d.current_incident_count === 0) {
    interpretation = `No incidents were recorded in the current period (${currentRange}), so the score reads 0% — that reflects an absence of incident data in this window, not a confirmed absence of risk.`;
  } else if (d.previous_incident_count === 0) {
    interpretation = `No incidents were recorded in the previous comparable period (${previousRange}), so its score is 0%. The current period (${currentRange}) has ${d.current_incident_count} incident${plural(d.current_incident_count)}, weighted by severity, for a score of ${current}%.`;
  } else if (trend === 0) {
    interpretation = `The score is unchanged versus the previous period — ${d.current_incident_count} incident${plural(d.current_incident_count)} in the current window carried the same severity-weighted total as the ${d.previous_incident_count} in the previous one.`;
  } else {
    interpretation = `The score ${trend < 0 ? 'decreased' : 'increased'} by ${pct(trend)} versus the previous period: ${d.current_incident_count} incident${plural(d.current_incident_count)} (severity-weighted total ${d.current_weight_sum}) in the current window vs. ${d.previous_incident_count} incident${plural(d.previous_incident_count)} (${d.previous_weight_sum}) previously. A ${trend < 0 ? 'lower' : 'higher'} score means ${trend < 0 ? 'lower' : 'higher'} predicted injury risk based on incident severity in this window.`;
  }

  return (
    <div className="space-y-2.5 text-[12px] leading-snug" style={{ color: '#374151' }}>
      <div className="text-[13px] font-semibold" style={{ color: '#111827' }}>Predictive Injury Risk Score</div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Current Risk Score</div>
        <div className="text-[15px] font-bold" style={{ color: '#111827' }}>{current}%</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Change</div>
        <div className="font-semibold" style={{ color: trend < 0 ? '#B91C1C' : trend > 0 ? '#3C8A52' : '#374151' }}>
          {trendArrow} {pct(trend)}
        </div>
        <div className="text-[11px]" style={{ color: '#9CA3AF' }}>Current minus previous period score — a point difference, not a relative percentage.</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Comparison</div>
        <div>Previous comparable period: {previousRange} ({d.previous_incident_count} incident{plural(d.previous_incident_count)}, {previous}%)</div>
        <div>Current period: {currentRange} ({d.current_incident_count} incident{plural(d.current_incident_count)}, {current}%)</div>
        {d.period_source === 'default_90d' && (
          <div className="mt-1 italic" style={{ color: '#9CA3AF' }}>
            No date range selected (&quot;All&quot;) — showing the default 90-day window anchored on your organisation&apos;s latest recorded data.
          </div>
        )}
        {d.period_source === 'preset_anchor' && (
          <div className="mt-1 italic" style={{ color: '#9CA3AF' }}>
            Anchored on your organisation&apos;s latest recorded data, not today&apos;s date.
          </div>
        )}
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Calculation</div>
        <div>Score = (Σ severity weight ÷ (incident count × 3)) × 100, capped at 100%.</div>
        <div className="mt-0.5 text-[11px]" style={{ color: '#6B7280' }}>Severity weights: Fatal 3 · Serious 2.5 · Significant 2 · Lost Time 1.5 · Moderate 1 · Other 0.5</div>
        <div className="mt-1.5 rounded-md p-1.5 font-mono text-[11px]" style={{ background: '#F8FAFC', color: '#111827' }}>
          Current: {scoreFormula(d.current_weight_sum, d.current_incident_count, current)}
        </div>
        <div className="mt-1 rounded-md p-1.5 font-mono text-[11px]" style={{ background: '#F8FAFC', color: '#111827' }}>
          Previous: {scoreFormula(d.previous_weight_sum, d.previous_incident_count, previous)}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Interpretation</div>
        <div>{interpretation}</div>
      </div>
    </div>
  );
}

// ── Shared formula/definition Info tooltip content for the KPI cards that
// don't carry their own detailed breakdown (Predictive Injury Risk Score is
// the exception — it renders PredictiveRiskInfoContent above instead).
// Shows the live current value alongside the standard definition/formula so
// the tooltip can never disagree with the number on the card itself.
function MetricFormulaInfo({
  title,
  currentValue,
  definition,
  formula,
  note,
}: {
  title: string;
  currentValue: string;
  definition: string;
  formula: string;
  note?: string;
}) {
  return (
    <div className="space-y-2.5 text-[12px] leading-snug" style={{ color: '#374151' }}>
      <div className="text-[13px] font-semibold" style={{ color: '#111827' }}>{title}</div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Current Value</div>
        <div className="text-[15px] font-bold" style={{ color: '#111827' }}>{currentValue}</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Definition</div>
        <div>{definition}</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Formula</div>
        <div className="mt-1 rounded-md p-1.5 font-mono text-[11px]" style={{ background: '#F8FAFC', color: '#111827' }}>{formula}</div>
      </div>

      {note && (
        <div className="text-[11px]" style={{ color: '#6B7280' }}>{note}</div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = (user?.name || "User").trim().split(" ")[0] || "User";

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [riskBars, setRiskBars] = useState<IncidentByCategory[]>([]);
  const [capaActions, setCapaActions] = useState<CapaAction[]>([]);
  const [overdueCapa, setOverdueCapa] = useState<OverdueCapaItem[]>([]);
  const [leading, setLeading] = useState<LeadingIndicators | null>(null);
  const [nearMisses, setNearMisses] = useState<RecentNearMiss[]>([]);
  const [safetyWalks, setSafetyWalks] = useState<RecentSafetyWalk[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // â”€â”€ date filter state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [preset, setPreset] = useState<Preset>("ALL");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const activeDates = preset === "CUSTOM"
    ? { start: customStart || undefined, end: customEnd || undefined }
    : {};
  // Every preset besides Custom sends `days`, resolved server-side against
  // the org's own latest data (see presetDays above) — no client-computed
  // dates for those, so there's nothing here that can disagree with the
  // backend's answer.
  const activeDays = preset === "CUSTOM" ? undefined : presetDays(preset);

  function handlePreset(key: Preset) {
    setPreset(key);
    setShowCustom(key === "CUSTOM");
  }

  // What "Top Incident Categories" (and any other period-filtered chart) is
  // actually counting — the period picker's own selection was shown once at
  // the top of the page but not repeated on the chart it governs, so a chart
  // read as "as of always" rather than "as of the period currently chosen".
  // Built from stats.period_start/period_end — the window the backend
  // actually applied — rather than re-deriving it client-side, so the label
  // can never show a different range than what the tiles below it reflect.
  const periodLabel = !stats
    ? ""
    : stats.period_start && stats.period_end
      ? `${formatFilterDate(stats.period_start)} – ${formatFilterDate(stats.period_end)}`
      : "All time";

  useEffect(() => {
    const { start, end } = activeDates;
    Promise.all([
        getDashboardStats(start, end, activeDays),
        getIncidentsByCategory(start, end, activeDays),
        getCapaActions(5, start, end, activeDays),
        getOverdueCapa(4, start, end, activeDays),
        getLeadingIndicators(start, end, activeDays),
        getNearMissesRecent(4, start, end, activeDays),
        getSafetyWalksRecent(4, start, end, activeDays),
      ])
      .then(([s, cats, capas, overdue, lead, nm, sw]) => {
        setStats(s as DashboardStats);
        setRiskBars(cats as IncidentByCategory[]);
        setCapaActions(capas as CapaAction[]);
        setOverdueCapa(overdue as OverdueCapaItem[]);
        setLeading(lead as LeadingIndicators);
        setNearMisses(nm as RecentNearMiss[]);
        setSafetyWalks(sw as RecentSafetyWalk[]);
        setLastUpdated(new Date());
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, preset, customStart, customEnd]);

  const leadingKpis: KpiItem[] = leading ? [
    {
      title: "Predictive Injury Risk Score",
      value: `${leading.predictive_injury_risk_score}%`,
      sub: "",
      // Plain like every other card — the number and the trend arrow carry
      // the information, a tinted box doesn't add to it.
      accent: "#FFFFFF",
      border: "#E5E7EB",
      inline: `${Math.abs(leading.predictive_injury_risk_trend)}%`,
      trendDown: leading.predictive_injury_risk_trend < 0,
      info: <PredictiveRiskInfoContent leading={leading} />,
    },
    {
      title: "TRIR",
      value: `${leading.trir}`,
      sub: "",
      accent: "#FFFFFF",
      border: "#E5E7EB",
      inline: "",
      trendDown: false,
      info: (
        <MetricFormulaInfo
          title="TRIR — Total Recordable Incident Rate"
          currentValue={`${leading.trir}`}
          definition="The number of recordable injuries per 200,000 hours worked (equivalent to 100 employees working a full year) — a standard rate used to compare injury frequency across workforces of any size."
          formula="(Recordable Incidents × 200,000) ÷ Total Hours Worked"
          note="Recordable incidents are incidents logged with type “Injury”, for the selected period."
        />
      ),
    },
    {
      // Title said "LTIFR" — the "incorrect 'RF' reference" the meeting
      // asked to drop — while already reading the `ltif` value underneath;
      // only the label was wrong. Split out of the combined TRIR/LTIF card
      // so each metric gets its own tile.
      title: "LTIF",
      value: `${leading.ltif}`,
      sub: "",
      accent: "#FFFFFF",
      border: "#E5E7EB",
      inline: "",
      trendDown: false,
      info: (
        <MetricFormulaInfo
          title="LTIF — Lost Time Injury Frequency Rate"
          currentValue={`${leading.ltif}`}
          definition="The number of injuries resulting in lost time per 1,000,000 hours worked."
          formula="(Lost Time Incidents × 1,000,000) ÷ Total Hours Worked"
          note="Lost time incidents are injury incidents with severity “Lost Time”, for the selected period."
        />
      ),
    },
    {
      title: "Audit Readiness Score",
      // Label already sits in the value line — repeating it as sub was the
      // same text twice on one card.
      value: `${leading.audit_readiness_score}% / ${leading.audit_readiness_label}`,
      sub: "",
      accent: "#FFFFFF",
      border: "#E5E7EB",
      inline: "",
      trendDown: false,
      info: (
        <MetricFormulaInfo
          title="Audit Readiness Score"
          currentValue={`${leading.audit_readiness_score}% / ${leading.audit_readiness_label}`}
          definition="A blended, all-time score of the organisation's audit/inspection posture, combining Safety Walk compliance ratings and Auditor-app Audit compliance scores onto a common 0-100 scale. Same score shown on the Compliance page."
          formula="Average of: (Safety Walk rating ÷ 5 × 100) and (Audit compliance score)"
          note="Ready ≥ 80% · Needs Attention 60–79% · Not Ready < 60%. Deliberately all-time — not limited to the date range selected above — so it reflects overall posture rather than a short-term trend."
        />
      ),
    },
  ] : [];

  const limitingKpis: KpiItem[] = leading ? [
    {
      title: "DART Rate",
      value: `${leading.dart_rate ?? 0}`,
      sub: "",
      accent: "#FFFFFF",
      border: "#E5E7EB",
      inline: "",
      trendDown: false,
      info: (
        <MetricFormulaInfo
          title="DART Rate — Days Away, Restricted, or Transferred"
          currentValue={`${leading.dart_rate ?? 0}`}
          definition="The number of lost-time injuries per 200,000 hours worked — the portion of TRIR made up of injuries serious enough to cause days away from work, restricted duty, or job transfer."
          formula="(Lost Time Incidents × 200,000) ÷ Total Hours Worked"
          note="Lost time incidents are injury incidents with severity “Lost Time”, for the selected period."
        />
      ),
    },
    {
      title: "Near Miss Ratio",
      value: `${leading.near_miss_ratio ?? "0 : 1"}`,
      sub: "",
      accent: "#FFFFFF",
      border: "#E5E7EB",
      inline: "",
      trendDown: false,
      info: (
        <MetricFormulaInfo
          title="Near Miss Ratio"
          currentValue={`${leading.near_miss_ratio ?? "0 : 1"}`}
          definition="How many near misses are reported for every recordable incident in the selected period. A higher ratio generally reflects healthier proactive reporting, not more risk."
          formula="Near Misses ÷ Recordable Incidents"
        />
      ),
    },
    {
      title: "FAR",
      value: `${leading.far ?? 0}`,
      sub: "",
      accent: "#FFFFFF",
      border: "#E5E7EB",
      inline: "",
      trendDown: false,
      info: (
        <MetricFormulaInfo
          title="FAR — Fatal Accident Rate"
          currentValue={`${leading.far ?? 0}`}
          definition="The number of workplace fatalities per 100,000,000 hours worked — the standard rate for very rare, high-severity events, scaled up so a single fatality is still meaningfully represented."
          formula="(Fatalities × 100,000,000) ÷ Total Hours Worked"
        />
      ),
    },
    {
      title: "Contractor Safety Score",
      // Same shared formula as the Vendors page's Safety Score KPI
      // (compute_contractor_safety_score) — average of each contractor
      // company's latest scorecard, 0-100.
      value: leading.contractor_safety_score != null ? `${leading.contractor_safety_score}/100` : "N/A",
      sub: leading.contractor_safety_company_count
        ? `Averaged across ${leading.contractor_safety_company_count} companies`
        : "No contractor scorecards recorded",
      accent: "#FFFFFF",
      border: "#E5E7EB",
      inline: "",
      trendDown: false,
      info: (
        <MetricFormulaInfo
          title="Contractor Safety Score"
          currentValue={leading.contractor_safety_score != null ? `${leading.contractor_safety_score}/100` : "N/A"}
          definition="The average of each contractor company's latest safety scorecard (0-100), giving one figure across all active contractors. Same calculation used on the Vendors page's Safety Score KPI."
          formula="Average of latest scorecard score, per contractor company"
          note={
            leading.contractor_safety_company_count
              ? `Averaged across ${leading.contractor_safety_company_count} companies.`
              : "No contractor scorecards recorded yet."
          }
        />
      ),
    },
  ] : [];

  const content = (
      <div className="w-full space-y-4">
        <div
          className="rounded-2xl border p-4 md:p-5"
          style={{ borderColor: '#CFDCF5', background: '#F8FBFF' }}
        >
          {/* One compact KPI strip, not two rows split by a divider — a
              single grid is what makes "auto-rows-fr" hold all eight cards to
              one identical height (a short card like FAR and a two-line title
              like "Contractor Safety Score" would otherwise diverge). No
              "Leading/Limiting Indicator" heading per the client's review:
              the metric name and value are the point. */}
          <div className="grid grid-cols-1 auto-rows-fr gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...leadingKpis, ...limitingKpis].map((item) => (
              <div
                key={item.title}
                className="flex flex-col justify-center rounded-2xl border px-4 py-[14px] md:px-[18px] md:py-4"
                style={{
                  background: item.accent,
                  borderColor: item.border,
                  boxShadow: '0 4px 10px rgba(15, 23, 42, 0.08)',
                }}
              >
                <div className="flex items-center gap-1.5 text-[13px] leading-tight" style={{ color: '#1F2937', fontWeight: 600 }}>
                  {item.title}
                  {item.info && (
                    <InfoTooltip label={`${item.title} — how this is calculated`}>
                      {item.info}
                    </InfoTooltip>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[1.375rem] leading-none md:text-[1.5rem]" style={{ color: '#111827', fontWeight: 700 }}>{item.value}</span>
                  {item.inline && (
                    <span className="text-[12.5px]" style={{ color: item.trendDown ? '#B91C1C' : '#3C8A52', fontWeight: 600 }}>
                      {item.trendDown ? <ArrowDown className="inline-block h-3.5 w-3.5 align-middle mr-1" /> : <ArrowUp className="inline-block h-3.5 w-3.5 align-middle mr-1" />}
                      {item.inline}
                    </span>
                  )}
                </div>
                {item.sub && (
                  <div className="mt-1 text-[12px] leading-tight" style={{ color: '#6B7280' }}>{item.sub}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-white p-4 md:p-5" style={{ borderColor: '#D9E4F6', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)' }}>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[clamp(1.15rem,2.3vw,1.5rem)]" style={{ color: '#111827', fontWeight: 700 }}>Top Incident Categories</h2>
              {periodLabel && <span className="text-[12.5px]" style={{ color: '#6B7280' }}>{periodLabel}</span>}
            </div>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={riskBars} barGap={6} margin={{ bottom: 56 }}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={70}
                />
                <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                <Tooltip />
                <Bar dataKey="data" name="Incidents" fill="#5E7992" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border bg-white p-4 md:p-5" style={{ borderColor: '#D9E4F6', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)' }}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[clamp(1.15rem,2.3vw,1.5rem)]" style={{ color: '#111827', fontWeight: 700 }}>Safety Walk Compliance & Corrective Action Closure</h2>
                <p className="mt-1 text-[13px]" style={{ color: '#6B7280' }}>Diagram view of inspection quality, action closure, and target performance.</p>
              </div>
              <div className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest" style={{ background: '#EEF2FF', color: '#4A57B9' }}>
                Flow view
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_auto_1fr] lg:items-center">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">Avg. Safety Walk Compliance</span>
                  <span className="font-bold text-slate-900">{stats ? Math.round(stats.avg_compliance_rating * 20) : 0}%</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-slate-200">
                  <div className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: `${Math.max(stats ? Math.round(stats.avg_compliance_rating * 20) : 0, 4)}%` }} />
                </div>
                <div className="mt-3 text-[12px] text-slate-500">Inspection quality input</div>
              </div>

              <div className="hidden xl:flex flex-col items-center gap-2 px-2 text-slate-400">
                <div className="h-16 w-px bg-slate-300" />
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">→</span>
                <div className="h-16 w-px bg-slate-300" />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">Corrective Action Closure</span>
                  <span className="font-bold text-slate-900">{stats ? Math.round(stats.capa_completion_rate) : 0}%</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-slate-200">
                  <div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-blue-600" style={{ width: `${Math.max(stats ? Math.round(stats.capa_completion_rate) : 0, 4)}%` }} />
                </div>
                <div className="mt-3 text-[12px] text-slate-500">
                  <span>Target 90%+</span>
                </div>
              </div>
            </div>
        </div>
        </div>

        <div
          className="grid w-full min-w-0 max-w-none grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.75fr)_minmax(0,1fr)]"
          style={{ width: '100%', maxWidth: 'none' }}
        >
          <div className="flex min-w-0 w-full flex-col rounded-2xl border bg-white p-4 md:p-5" style={{ borderColor: '#D9E4F6', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)' }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[clamp(1.15rem,2.3vw,1.5rem)]" style={{ color: '#111827', fontWeight: 700 }}>Ranked Action Table</h2>
              <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-bold text-[#4A57B9]">TOP {capaActions.length}</span>
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <table className="w-full table-fixed text-left">
                <colgroup><col className="w-[42%]" /><col className="w-[18%]" /><col className="w-[20%]" /><col className="w-[20%]" /></colgroup>
                <thead>
                  <tr className="border-b" style={{ borderColor: '#E5E7EB' }}>
                    {['Action', 'Priority', 'Due Date', 'Assignee'].map((heading) => <th key={heading} className="px-2 py-2 first:pl-0 text-[12px] uppercase tracking-wide" style={{ color: '#64748B', fontWeight: 700 }}>{heading}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {capaActions.map((row) => {
                    const assignee = row.assignee || 'Unassigned';
                    const initials = assignee.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
                    const incidentRef = row.incident_id ? `INC-${String(row.incident_id).padStart(5, '0')}` : null;
                    // Seed/legacy descriptions embed a made-up "INC00018"-style
                    // reference that has no relation to the real incident_id —
                    // strip it so it can't be mistaken for the incidentRef badge above.
                    const label = (row.description || row.action_type || 'Corrective Action')
                      .replace(/\s*\b(for|addressing)\s+INC-?\d+\b\.?/gi, '')
                      .trim() || row.action_type || 'Corrective Action';
                    return <tr key={row.id} className="border-b last:border-b-0" style={{ borderColor: '#F1F5F9' }}>
                      <td className="max-w-0 break-words px-2 py-3 first:pl-0 text-[13px]" style={{ color: '#111827' }}>
                        {incidentRef && (
                          <button
                            onClick={() => navigate(`/violations/${incidentRef}`)}
                            className="mb-0.5 block text-[11px] font-bold hover:underline"
                            style={{ color: '#4A57B9' }}
                          >
                            {incidentRef}
                          </button>
                        )}
                        <span className="block break-words" title={label}>{label}</span>
                      </td>
                      <td className="px-2 py-3 text-[13px]"><span className="inline-flex rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: row.priority === 'High' ? '#FFF1F2' : '#FFF7ED', color: row.priority === 'High' ? '#BE123C' : '#C2410C' }}>{row.priority}</span></td>
                      <td className="px-2 py-3 text-[13px] whitespace-nowrap" style={{ color: '#374151' }}>{formatDueDate(row.due_date)}</td>
                      <td className="break-words px-2 py-3 text-[13px]" style={{ color: '#374151' }}><span className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E9EDFF] text-[10px] font-bold text-[#4A57B9]">{initials}</span><span className="break-words">{assignee}</span></span></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <button onClick={() => navigate('/capa-actions')} className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-[#D8E1F5] px-4 py-2.5 text-[13px] font-semibold text-[#4A57B9] hover:bg-[#F5F7FF]">View All Actions <ChevronRight className="h-4 w-4" /></button>
          </div>

          <div className="flex min-w-0 w-full flex-col rounded-2xl border bg-white p-4 md:p-5" style={{ borderColor: '#D9E4F6', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)' }}>
            <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-[clamp(1.15rem,2.3vw,1.5rem)]" style={{ color: '#111827', fontWeight: 700 }}>Overdue CAPA</h2><AlertTriangle className="h-5 w-5 text-[#D97706]" /></div>
            <div className="flex-1 space-y-1">
              {overdueCapa.map((item) => {
                const incidentRef = item.incident_id ? `INC-${String(item.incident_id).padStart(5, '0')}` : null;
                return <div
                  key={item.id}
                  className={`flex gap-3 border-b border-[#F1F5F9] py-3 last:border-b-0 ${incidentRef ? 'cursor-pointer hover:bg-[#FFFBF5]' : ''}`}
                  onClick={incidentRef ? () => navigate(`/violations/${incidentRef}`) : undefined}
                >
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" />
                  <div className="min-w-0 text-[14px] leading-5" style={{ color: '#374151' }}>
                    <div>{incidentRef || `Incident #${item.incident_id}`} <span className="text-[#94A3B8]">•</span> {item.action_type || 'Corrective'}</div>
                    <div className="font-bold text-[#C2410C]">{item.days_overdue} days overdue</div>
                  </div>
                </div>;
              })}
            </div>
            <button onClick={() => navigate('/capa-actions?overdue=1')} className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-[#F4D6B0] bg-[#FFF9F2] px-4 py-2.5 text-[13px] font-semibold text-[#B45309] hover:bg-[#FFF3E1]">View All Overdue CAPA <ChevronRight className="h-4 w-4" /></button>
          </div>

          <div className="flex min-w-0 w-full flex-col rounded-2xl border bg-white p-4 md:p-5" style={{ borderColor: '#D9E4F6', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[clamp(1.15rem,2.3vw,1.5rem)]" style={{ color: '#111827', fontWeight: 700 }}>Near Miss Reporting</h2>
                <p className="mt-1 text-[13px] leading-5" style={{ color: '#6B7280' }}>Reports from the field, newest first — including those raised on the mobile app.</p>
              </div>
              {/* The count the API has always returned and nothing rendered. */}
              <div className="shrink-0 text-right">
                <div className="text-[26px] leading-none tabular-nums" style={{ color: '#4A57B9', fontWeight: 800 }}>
                  {stats?.near_misses_count ?? 0}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Total</div>
              </div>
            </div>

            {/* Latest reports, straight off /dashboard/near-misses-recent. That
                endpoint and its service function both already existed; no
                component had ever called them, so the panel showed three lines
                of static copy while real reports piled up behind it. */}
            <div className="mt-4 flex-1 rounded-2xl border bg-[#F8FBFF] p-4" style={{ borderColor: '#E3EAF8' }}>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#4A57B9]">Latest reports</div>
              {nearMisses.length === 0 ? (
                <p className="mt-3 text-[13px]" style={{ color: '#9CA3AF' }}>No near misses reported yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {nearMisses.map((nm) => (
                    <button
                      key={nm.id}
                      type="button"
                      onClick={() => navigate(`/near-miss/tracking?id=${nm.id}`)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] tabular-nums" style={{ color: '#4A57B9', fontWeight: 700 }}>
                          {nm.reference}
                        </span>
                        <span className="truncate text-[13px]" style={{ color: '#374151' }}>
                          {nm.description || 'No description'}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px]" style={{ color: '#6B7280' }}>
                        <span>{nm.location}</span>
                        <span>· {nm.reporter}</span>
                        {nm.event_date_time && (
                          <span>· {new Date(nm.event_date_time).toLocaleDateString()}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => navigate('/near-miss')} className="mt-4 inline-flex w-full items-center justify-center rounded-xl px-6 py-3 text-[14px] text-white transition-transform duration-150 hover:scale-[1.01]" style={{ background: 'linear-gradient(135deg, #5565C1 0%, #6E7BDB 100%)', boxShadow: '0 8px 18px rgba(81, 96, 186, 0.28)', fontWeight: 600 }}>Open Near Miss Reporting</button>
          </div>
        </div>

        {/* Latest Safety Walks — proves the mobile-to-web loop end to end for
            the client's own demo scenario: a walk logged on the phone, given
            a DSW- reference, showing up here without a page reload. */}
        <div className="flex min-w-0 w-full flex-col rounded-2xl border bg-white p-4 md:p-5" style={{ borderColor: '#D9E4F6', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)' }}>
          <h2 className="text-[clamp(1.15rem,2.3vw,1.5rem)]" style={{ color: '#111827', fontWeight: 700 }}>Latest Safety Walks</h2>
          <p className="mt-1 text-[13px]" style={{ color: '#6B7280' }}>Inspections from the field, newest first — including those raised on the mobile app.</p>
          {safetyWalks.length === 0 ? (
            <p className="mt-3 text-[13px]" style={{ color: '#9CA3AF' }}>No safety walks reported yet.</p>
          ) : (
            <div className="mt-3 flex-1 divide-y" style={{ borderColor: '#F1F5F9' }}>
              {safetyWalks.map((sw) => (
                <button
                  key={sw.id}
                  type="button"
                  onClick={() => navigate('/safety-walks')}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-left first:pt-0 last:pb-0"
                >
                  <span className="text-[11px] tabular-nums" style={{ color: '#4A57B9', fontWeight: 700 }}>
                    {sw.reference}
                  </span>
                  <span className="text-[13px]" style={{ color: '#374151' }}>{sw.inspection_type || 'Inspection'}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      background: sw.priority === 'Critical' ? '#FEF2F2' : sw.priority === 'High' ? '#FFF7ED' : '#F1F5F9',
                      color: sw.priority === 'Critical' ? '#B91C1C' : sw.priority === 'High' ? '#C2410C' : '#475569',
                    }}
                  >
                    {sw.issues_found} issue{sw.issues_found === 1 ? '' : 's'}
                  </span>
                  <span className="ml-auto flex flex-wrap gap-x-2 text-[11px]" style={{ color: '#6B7280' }}>
                    <span>{sw.location}</span>
                    <span>· {sw.inspector}</span>
                    {sw.inspection_date_time && (
                      <span>· {new Date(sw.inspection_date_time).toLocaleDateString()}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/safety-walks')} className="mt-4 inline-flex w-full items-center justify-center rounded-xl px-6 py-3 text-[14px] text-white transition-transform duration-150 hover:scale-[1.01]" style={{ background: 'linear-gradient(135deg, #5565C1 0%, #6E7BDB 100%)', boxShadow: '0 8px 18px rgba(81, 96, 186, 0.28)', fontWeight: 600 }}>Open Site Inspections</button>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border px-5 py-4" style={{ borderColor: '#DCE4F3', background: '#FFFFFF' }}>
        {/* top row — welcome + updated */}
        <div className="flex items-center justify-between">
          <div>
            <h1>Welcome, {firstName}</h1>
            <p className="text-[14px] mt-1" style={{ color: '#64748B' }}>Focus on leading indicators and high-priority actions first.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px]" style={{ color: '#94A3B8' }}>
              {lastUpdated
                ? `Updated: ${lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'Loading…'}
            </span>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#5B6DE8' }} />
          </div>
        </div>

        {/* date filter row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold" style={{ color: '#475569' }}>Period:</span>
          {PRESETS.map(({ label, key }) => (
            <button
              key={key}
              onClick={() => handlePreset(key)}
              className="rounded-full px-3 py-1 text-[13px] font-semibold transition-all duration-150"
              style={{
                background: preset === key ? '#5565C1' : '#F1F5F9',
                color: preset === key ? '#FFFFFF' : '#475569',
                border: preset === key ? '1.5px solid #5565C1' : '1.5px solid #E2E8F0',
              }}
            >
              {label}
            </button>
          ))}

          {/* active date range label — the window the backend actually
              applied (period_start/period_end), not a client-side guess */}
          {preset !== "CUSTOM" && periodLabel && (
            <span className="text-[12px] ml-1" style={{ color: '#94A3B8' }}>
              {periodLabel}
            </span>
          )}
        </div>

        {/* custom date pickers */}
        {showCustom && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-[13px] font-semibold" style={{ color: '#475569' }}>From</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border px-3 py-1.5 text-[13px] outline-none focus:ring-2"
                style={{ borderColor: '#CBD5E1', color: '#1F2937', background: '#F8FAFC' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[13px] font-semibold" style={{ color: '#475569' }}>To</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border px-3 py-1.5 text-[13px] outline-none focus:ring-2"
                style={{ borderColor: '#CBD5E1', color: '#1F2937', background: '#F8FAFC' }}
              />
            </div>
            {customStart && customEnd && (
              <span className="text-[12px]" style={{ color: '#94A3B8' }}>
                {formatFilterDate(customStart)} → {formatFilterDate(customEnd)}
              </span>
            )}
          </div>
        )}
      </div>

      {content}
    </div>
  );
}
