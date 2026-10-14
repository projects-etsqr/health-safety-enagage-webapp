import { useState, useEffect } from "react";
import { OctagonAlert, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  getRiskSummary, getResidualRiskTrend, getRiskMatrix,
  getRiskReportMatrix, getRiskReportSummary,
  type TaskRow, type AgingBar, type RiskReportMatrix, type RiskReportSummary,
} from "../../services/analytics.service";
import { useAuth } from "../context/AuthContext";
import { RiskTabBar } from "../components/audits/RiskTabBar";
import { InfoTooltip } from "../components/shared/InfoTooltip";

const matrixCols = ["Frequent 5", "Probable 4", "Occasional 3", "Remote 2", "Improbable 1"];
const matrixRows = ["Catastrophic 5", "Significant 4", "Moderate 3", "Low 2", "Negligible 1"];

const matrixCells = [
  // Catastrophic row — all red
  [
    { score: 25, text: "Catastrophic", tone: "stop" },
    { score: 20, text: "Catastrophic", tone: "stop" },
    { score: 15, text: "Catastrophic", tone: "stop" },
    { score: 12, text: "Catastrophic", tone: "stop" },
    { score: 5,  text: "Catastrophic", tone: "stop" },
  ],
  // Significant row
  [
    { score: 25, text: "Catastrophic", tone: "stop" },
    { score: 20, text: "Catastrophic", tone: "stop" },
    { score: 15, text: "Urgent",       tone: "urgent" },
    { score: 10, text: "Urgent",       tone: "urgent" },
    { score: 4,  text: "Borderline",   tone: "action" },
  ],
  // Moderate row
  [
    { score: 16, text: "Urgent",     tone: "urgent" },
    { score: 13, text: "Urgent",     tone: "urgent" },
    { score: 10, text: "Borderline", tone: "action" },
    { score: 5,  text: "Borderline", tone: "action" },
    { score: 4,  text: "Acceptable", tone: "monitor" },
  ],
  // Low row
  [
    { score: 13, text: "Urgent",     tone: "urgent" },
    { score: 10, text: "Borderline", tone: "action" },
    { score: 5,  text: "Borderline", tone: "action" },
    { score: 3,  text: "Acceptable", tone: "monitor" },
    { score: 2,  text: "Acceptable", tone: "monitor" },
  ],
  // Negligible row — all green
  [
    { score: 8, text: "Acceptable", tone: "monitor" },
    { score: 4, text: "Acceptable", tone: "monitor" },
    { score: 2, text: "Acceptable", tone: "monitor" },
    { score: 1, text: "Acceptable", tone: "monitor" },
    { score: 1, text: "Acceptable", tone: "monitor" },
  ],
];

/**
 * Band a cell of the risk-report matrix from its own arithmetic.
 *
 * The hazard grid above (`matrixCells`) hardcodes a tone and a score per cell,
 * and those scores do not multiply out — the Catastrophic row reads
 * 25/20/15/12/5 where 5x5..5x1 is 25/20/15/10/5. That grid is a hand-drawn
 * qualitative picture, which is all `hazards` can support since it carries no
 * score. `risk_reports` carries L x S outright, so its grid is generated from
 * the real product and banded by the WF-01 thresholds in `risk_scoring`
 * (21+ Critical, 15+ High, 7+ Medium, else Low) — the same thresholds that
 * decided each plotted risk's band, so a cell's colour and the band of the
 * risks sitting in it cannot disagree.
 */
/** Band -> colour. Matches risk-trail.service's BAND_COLOR and the mobile screen. */
const BAND_TONE: Record<string, string> = {
  Low: '#16A34A',
  Medium: '#CA8A04',
  High: '#EA580C',
  Critical: '#DC2626',
};

function RiskStat({ label, value, hint, color }: Readonly<{
  label: string; value: number | undefined; hint?: string; color?: string;
}>) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: '#E3E9F6', background: '#F9FBFF' }}>
      <div className="text-[10.5px] uppercase tracking-[0.5px]" style={{ color: '#94A3B8', fontWeight: 700 }}>
        {label}
      </div>
      <div className="mt-1 text-[22px] tabular-nums leading-none" style={{ color: color ?? '#0F172A', fontWeight: 700 }}>
        {value ?? '—'}
      </div>
      {hint && <div className="mt-1 text-[10.5px]" style={{ color: '#94A3B8' }}>{hint}</div>}
    </div>
  );
}

function scoreTone(score: number): { tone: string; text: string } {
  if (score >= 21) return { tone: "stop", text: "Critical" };
  if (score >= 15) return { tone: "urgent", text: "High" };
  if (score >= 7) return { tone: "action", text: "Medium" };
  return { tone: "monitor", text: "Low" };
}

function toneStyle(tone: string) {
  if (tone === "stop")   return { bg: "#DC2626", text: "#FFFFFF" }; // Red = Catastrophic
  if (tone === "urgent") return { bg: "#EA580C", text: "#FFFFFF" }; // Orange = Urgent
  if (tone === "action") return { bg: "#EAB308", text: "#111827" }; // Yellow = Borderline
  return                        { bg: "#16A34A", text: "#FFFFFF" }; // Green = Acceptable
}

// Shared formula/definition Info tooltip content for this page's KPI cards —
// same pattern as the Dashboard, Equipment, Vendors and Compliance pages'
// Info tooltips: shows the live current value alongside the definition/
// formula so it can never disagree with the number on the card itself.
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
  formula?: string;
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

      {formula && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Formula</div>
          <div className="mt-1 rounded-md p-1.5 font-mono text-[11px]" style={{ background: '#F8FAFC', color: '#111827' }}>{formula}</div>
        </div>
      )}

      {note && (
        <div className="text-[11px]" style={{ color: '#6B7280' }}>{note}</div>
      )}
    </div>
  );
}

function KpiCard({ title, value, subtitle, hint, valueColor = "#1F2937", info }: Readonly<{ title: string; value: string; subtitle: string; hint: string; valueColor?: string; info?: React.ReactNode }>) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
      <div className="mb-1 flex items-center gap-1.5 text-[14px]" style={{ color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
        {info && (
          <InfoTooltip label={`${title} — how this is calculated`}>
            {info}
          </InfoTooltip>
        )}
      </div>
      <div className="text-[48px] leading-none mt-2" style={{ color: valueColor, fontWeight: 700 }}>{value}</div>
      <div className="mt-2 text-[13px]" style={{ color: '#64748B' }}>{subtitle}</div>
      {hint && <div className="mt-1 text-[12px]" style={{ color: '#2F8C77', fontWeight: 600 }}>{hint}</div>}
    </div>
  );
}

export function RiskPage() {
  const { user } = useAuth();
  const [zoneRisk, setZoneRisk] = useState<{ zone: string; value: number }[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
  const [agingBars, setAgingBars] = useState<AgingBar[]>([]);
  const [kpis, setKpis] = useState<{ control_effectiveness: string; unverified_controls: number; risk_escalations: number } | null>(null);
  const [residualTrend, setResidualTrend] = useState<{ q: string; risk: number }[]>([]);
  const [matrixCounts, setMatrixCounts] = useState<number[][]>(Array.from({ length: 5 }, () => Array(5).fill(0)));
  const [matrixMeta, setMatrixMeta] = useState<{ active: number; resolved: number; total: number } | null>(null);
  const [recentlyClosed, setRecentlyClosed] = useState<number>(0);
  // The Risk section's own data. Everything above this line reads the hazard
  // register, incidents and CAPA — which is why this page carried no risk
  // report at all before these two calls.
  const [riskMatrix, setRiskMatrix] = useState<RiskReportMatrix | null>(null);
  const [riskSummary, setRiskSummary] = useState<RiskReportSummary | null>(null);
  const [matrixSource, setMatrixSource] = useState<"risk" | "hazard">("risk");
  const [includeClosed, setIncludeClosed] = useState(false);

  useEffect(() => {
    getRiskSummary().then((data) => {
      setZoneRisk(data.zone_risk);
      setTaskRows(data.task_rows);
      setAgingBars(data.aging_bars);
      setKpis(data.kpis);
      setRecentlyClosed((data as any).recently_closed_count ?? 0);
    }).catch(console.error);
    getResidualRiskTrend().then(setResidualTrend).catch(console.error);
    getRiskMatrix().then((d) => {
      setMatrixCounts(d.counts);
      setMatrixMeta({
        active: (d as any).active_hazard_count ?? 0,
        resolved: (d as any).resolved_hazard_count ?? 0,
        total: (d as any).total_hazard_count ?? 0,
      });
    }).catch(console.error);
    getRiskReportSummary().then(setRiskSummary).catch(console.error);
  }, []);

  useEffect(() => {
    getRiskReportMatrix(includeClosed).then(setRiskMatrix).catch(console.error);
  }, [includeClosed]);

  // ── Which grid the matrix panel is drawing ───────────────────────────────
  //
  // The hazard source keeps its hand-drawn cells; the risk-report source builds
  // its own from the axis scores the API returns, so every cell's label is the
  // real product of its row and column rather than a value typed in by hand.
  const showRiskGrid = matrixSource === 'risk' && riskMatrix !== null;
  const activeRows = showRiskGrid
    ? riskMatrix!.severity_axis.map((a) => `${a.label} ${a.score}`)
    : matrixRows;
  const activeCols = showRiskGrid
    ? riskMatrix!.likelihood_axis.map((a) => `${a.label} ${a.score}`)
    : matrixCols;
  const activeCells = showRiskGrid
    ? riskMatrix!.severity_axis.map((sev) =>
        riskMatrix!.likelihood_axis.map((lik) => {
          const score = sev.score * lik.score;
          const t = scoreTone(score);
          return { score, text: t.text, tone: t.tone };
        }),
      )
    : matrixCells;
  const activeCounts = showRiskGrid ? riskMatrix!.counts : matrixCounts;

  return (
    <div className="space-y-5">
      {/* Sub-navigation to the lifecycle tracker. This page is the analytics
          view — the matrix, the heatmap, the trend — and carried no route to
          the individual risk observations the mobile app raises. */}
      <RiskTabBar />

      {/* Page header */}
      <div>
        <h1 className="text-[22px]" style={{ color: '#0A0A0A', fontWeight: 700 }}>
          Welcome, {user?.name ?? "User"}
        </h1>
        <p className="mt-0.5 text-[13px]" style={{ color: '#6B7280' }}>Root Cause Analysis &amp; Risk Overview</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <KpiCard
          title="Corrective Action Closure Rate"
          value={kpis ? kpis.control_effectiveness : "—"}
          subtitle="CAPA actions completed"
          hint="Client KPI — same metric as Compliance page"
          info={
            <MetricFormulaInfo
              title="Corrective Action Closure Rate"
              currentValue={kpis ? kpis.control_effectiveness : "—"}
              definition="The share of CAPA (Corrective and Preventive Action) actions marked Completed, Closed, Verified, or Done, out of every CAPA action raised. Same metric as the Compliance page's Corrective Action Closure Rate card."
              formula="(CAPA Actions Completed ÷ Total CAPA Actions) × 100"
            />
          }
        />
        <KpiCard
          title="Open CAPA Actions"
          value={kpis ? String(kpis.unverified_controls) : "—"}
          subtitle="Pending closure"
          hint="Not a control-verification record"
          info={
            <MetricFormulaInfo
              title="Open CAPA Actions"
              currentValue={kpis ? String(kpis.unverified_controls) : "—"}
              definition="The count of CAPA actions with no status on file, or a status other than Completed/Closed/Verified/Done — i.e. still pending closure. This counts open actions, not verified controls."
              formula="Count of CAPA actions where status is not Completed/Closed/Verified/Done"
            />
          }
        />
        <KpiCard
          title="Overdue CAPA Actions ⚠"
          value={kpis ? String(kpis.risk_escalations) : "—"}
          subtitle="Requires Immediate Action"
          hint=""
          info={
            <MetricFormulaInfo
              title="Overdue CAPA Actions"
              currentValue={kpis ? String(kpis.risk_escalations) : "—"}
              definition="The count of CAPA actions whose status is explicitly Overdue — past their due date without being closed."
              formula={'Count of CAPA actions where status = "Overdue"'}
            />
          }
        />
      </div>

      {/* Row 2: Residual Trend | Risk Matrix | Zone Risk */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1.65fr_0.65fr]"
        style={{ gridAutoRows: 'minmax(400px, auto)' }}>

        {/* Residual Risk Trend */}
        <div className="rounded-2xl border bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-1 text-[16px]" style={{ color: '#111827', fontWeight: 700 }}>Residual Risk Trend</div>
          <div className="mb-3 text-[11px]" style={{ color: '#9CA3AF' }}>
            Estimated from the incident severity mix. Numeric Likelihood × Consequence scores are captured on risk reports —
            see the Risk Matrix and the Risk Reports panel above; there are too few scored risks over time to trend them here yet.
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={residualTrend} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="q" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} width={30} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                labelStyle={{ fontWeight: 600, color: '#111827' }}
              />
              <Area type="monotone" dataKey="risk" stroke="#5E6FA6" fill="#7E8DBA" fillOpacity={0.55} strokeWidth={2} dot={{ r: 4, fill: '#5E6FA6', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Matrix */}
        <div className="rounded-2xl border bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#6BD0D7' }}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-[16px]" style={{ color: '#111827', fontWeight: 700 }}>Risk Matrix</div>
            {/* Two sources, two different tables. The grid used to draw only the
                hazard register while sitting on the Risk page, which is the
                whole defect this toggle fixes — the register view is kept
                because it is genuinely useful, just no longer the only one. */}
            <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: '#F1F5F9' }}>
              {([['risk', 'Risk reports'], ['hazard', 'Unsafe act register']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMatrixSource(key)}
                  className="rounded-md px-2.5 py-1 text-[11px] transition-colors"
                  style={{
                    background: matrixSource === key ? '#FFFFFF' : 'transparent',
                    color: matrixSource === key ? '#4A57B9' : '#64748B',
                    fontWeight: 700,
                    boxShadow: matrixSource === key ? '0 1px 3px rgba(15,23,42,0.12)' : 'none',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px]" style={{ color: '#9CA3AF' }}>
            <span>
              {matrixSource === 'risk'
                ? 'Numeric Likelihood × Consequence from risk_reports, banded on the WF-01 thresholds.'
                : 'Qualitative estimate from hazard severity/probability text — the register carries no numeric score.'}
            </span>
            {matrixSource === 'risk' && (
              <label className="flex cursor-pointer items-center gap-1.5" style={{ color: '#64748B' }}>
                <input
                  type="checkbox"
                  checked={includeClosed}
                  onChange={(e) => setIncludeClosed(e.target.checked)}
                />
                Include closed
              </label>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th className="px-2 py-2 text-left text-[11px]" style={{ color: '#475569', fontWeight: 700 }}>
                    Impact ↓ / Likelihood →
                  </th>
                  {activeCols.map((col) => (
                    <th key={col} className="px-2 py-2 text-[11px]" style={{ color: '#475569', fontWeight: 700 }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row, rowIdx) => (
                  <tr key={row}>
                    <td className="px-2 py-1.5 text-left text-[11px]" style={{ color: '#334155', fontWeight: 700 }}>{row}</td>
                    {activeCells[rowIdx].map((cell, colIdx) => {
                      const tone = toneStyle(cell.tone);
                      const count = activeCounts[rowIdx]?.[colIdx] ?? 0;
                      return (
                        <td key={`${row}-${colIdx}`} className="px-1 py-1">
                          <div className="rounded-md px-1.5 py-1 text-center" style={{ background: tone.bg, color: tone.text }}>
                            <div className="text-[13px] leading-none" style={{ fontWeight: 800 }}>
                              {count > 0 ? count : "—"}
                            </div>
                            <div className="text-[10px] mt-0.5" style={{ fontWeight: 600 }}>{cell.text}</div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Matrix legend */}
          <div className="mt-4 pt-3 flex flex-wrap items-center gap-4 text-[11px]" style={{ color: '#475569', borderTop: '1px solid #F1F5F9' }}>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded" style={{ background: '#DC2626' }} />Catastrophic</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded" style={{ background: '#EA580C' }} />Urgent</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded" style={{ background: '#EAB308' }} />Borderline</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded" style={{ background: '#16A34A' }} />Acceptable</span>
            <span className="ml-auto text-[11px]" style={{ color: '#94A3B8' }}>
              {showRiskGrid
                ? `Plotted: ${riskMatrix!.plotted} of ${riskMatrix!.total}`
                : `Total risks: ${matrixCounts.flat().reduce((a, b) => a + b, 0)}`}
            </span>
          </div>
          {/* Risk-report source: what the grid could not place, and the average.
              An unplotted risk is invisible on a matrix by definition, so the
              count has to appear next to it or the grid silently under-reports. */}
          {showRiskGrid && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
              {riskMatrix!.blocks_work > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1"
                  style={{ background: '#FEE2E2', color: '#B91C1C', fontWeight: 700 }}>
                  {riskMatrix!.blocks_work} blocking work
                </span>
              )}
              {riskMatrix!.average_adjusted_score !== null && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1"
                  style={{ background: '#EFF6FF', color: '#1D4ED8', fontWeight: 700 }}>
                  Average adjusted score {riskMatrix!.average_adjusted_score}
                </span>
              )}
              {riskMatrix!.unplotted > 0 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1"
                  style={{ background: '#FEF3C7', color: '#B45309', fontWeight: 700 }}
                  title="Their likelihood or consequence is not one of the five scale values, so they cannot be placed on the grid. They may still carry a score."
                >
                  {riskMatrix!.unplotted} not plottable
                </span>
              )}
            </div>
          )}

          {/* Resolved / closed summary — hazard source only, since these counts
              are the register's own resolution rule. */}
          {!showRiskGrid && matrixMeta && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: '#DCFCE7', color: '#15803D', fontWeight: 700 }}>
                ✅ {matrixMeta.resolved} resolved — auto-removed
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: '#FEF3C7', color: '#B45309', fontWeight: 700 }}>
                ⚠️ {matrixMeta.active} active
              </span>
              {recentlyClosed > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: '#EFF6FF', color: '#1D4ED8', fontWeight: 700 }}>
                  🔒 {recentlyClosed} closed this week
                </span>
              )}
            </div>
          )}
        </div>

        {/* Risk by Zone / Site / Team */}
        <div className="rounded-2xl border bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.08)] flex flex-col" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-1 text-[16px]" style={{ color: '#111827', fontWeight: 700 }}>Risk by Zone / Site / Team</div>
          <div className="mb-3 text-[12px]" style={{ color: '#6B7280' }}>
            {zoneRisk.length} zone{zoneRisk.length !== 1 ? 's' : ''} tracked
          </div>
          {/* Named so it cannot be misread as risk reports by site, which is
              what the surrounding page now otherwise shows. */}
          <div className="-mt-2 mb-3 text-[11px]" style={{ color: '#9CA3AF' }}>
            Ranked by recorded incidents per site.
          </div>

          {/* Inline legend */}
          <div className="mb-4 flex flex-wrap gap-3 text-[10px]" style={{ color: '#6B7280', fontWeight: 600 }}>
            {([['#E15759', 'Critical'], ['#E9A23B', 'High'], ['#F1C40F', 'Medium'], ['#22C55E', 'Low']] as const).map(([clr, lbl]) => (
              <span key={lbl} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: clr }} />
                {lbl}
              </span>
            ))}
          </div>

          {zoneRisk.length === 0 ? (
            <div className="flex items-center justify-center py-14 text-[13px]" style={{ color: '#9CA3AF' }}>
              No zone risk data available
            </div>
          ) : (() => {
            const maxVal = Math.max(...zoneRisk.map(z => z.value), 1);
            const sorted = [...zoneRisk].sort((a, b) => b.value - a.value);

            function riskConfig(value: number, max: number) {
              const pct = (value / max) * 100;
              if (pct >= 75) return { color: '#E15759', bg: '#FEE2E2', label: 'Critical', bar: 'linear-gradient(90deg,#E15759,#FF7171)' };
              if (pct >= 50) return { color: '#D97706', bg: '#FEF3C7', label: 'High',     bar: 'linear-gradient(90deg,#E9A23B,#FBBF24)' };
              if (pct >= 25) return { color: '#B45309', bg: '#FEF9C3', label: 'Medium',   bar: 'linear-gradient(90deg,#F1C40F,#FDE68A)' };
              return               { color: '#15803D', bg: '#DCFCE7', label: 'Low',      bar: 'linear-gradient(90deg,#22C55E,#86EFAC)' };
            }

            return (
              <div className="space-y-3">
                {sorted.map((item, i) => {
                  const widthPct = (item.value / maxVal) * 100;
                  const cfg = riskConfig(item.value, maxVal);
                  return (
                    <div key={item.zone}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] w-5 text-center flex-shrink-0" style={{ color: '#9CA3AF', fontWeight: 700 }}>
                          {i + 1}
                        </span>
                        <span className="flex-1 text-[12px] truncate" style={{ color: '#1F2937', fontWeight: 500 }}>
                          {item.zone}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: cfg.bg, color: cfg.color, fontWeight: 700 }}>
                          {cfg.label}
                        </span>
                        <span className="text-[13px] w-7 text-right flex-shrink-0"
                          style={{ color: '#111827', fontWeight: 700 }}>
                          {item.value}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pl-7">
                        <div className="flex-1 h-[6px] rounded-full" style={{ background: '#F1F5F9' }}>
                          <div className="h-[6px] rounded-full"
                            style={{ width: `${widthPct}%`, background: cfg.bar, transition: 'width 0.4s ease' }} />
                        </div>
                        <span className="text-[10px] w-8 text-right flex-shrink-0" style={{ color: '#9CA3AF', fontWeight: 500 }}>
                          {Math.round(widthPct)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Row 3: Tasks table | Risk Aging */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_1fr]">

        {/* Active Tasks Table */}
        <div className="rounded-2xl border bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-3 text-[16px]" style={{ color: '#111827', fontWeight: 700 }}>
            Action / High Risk Active Tasks
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {["Task ID", "Description", "Owner", "Due Date", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wide"
                      style={{ color: '#64748B', fontWeight: 700 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {taskRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[13px]" style={{ color: '#9CA3AF' }}>
                      No active tasks
                    </td>
                  </tr>
                ) : taskRows.map((row, idx) => (
                  <tr key={row.id}
                    style={{ borderBottom: idx < taskRows.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                    className="transition-colors hover:bg-[#F8FAFC]">
                    <td className="px-3 py-2.5 text-[12px]" style={{ color: '#1F2937', fontWeight: 700 }}>{row.id}</td>
                    <td className="px-3 py-2.5 text-[12px]" style={{ color: '#334155' }}>{row.desc}</td>
                    <td className="px-3 py-2.5 text-[12px]" style={{ color: '#334155' }}>{row.owner}</td>
                    <td className="px-3 py-2.5 text-[12px] whitespace-nowrap" style={{ color: '#334155' }}>{row.due}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: '#FEF3C7', color: '#A16207', fontWeight: 700 }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Risk Aging */}
        <div className="rounded-2xl border bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-3 text-[16px]" style={{ color: '#111827', fontWeight: 700 }}>Risk Aging</div>
          {agingBars.length > 0 && agingBars[3]?.critical > 0 && agingBars.slice(0,3).every(b => b.line === 0) && (
            <div className="mb-3 px-3 py-2 rounded-lg text-[12px] font-semibold" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
              ⚠ All {agingBars[3].critical} open CAPAs are critically overdue (&gt;90 days). Immediate action required.
            </div>
          )}

          {/* Age bucket pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {['0–30 Days', '31–60 Days', '61–90 Days', '>90 Days'].map((label, i) => {
              const bucketCount = agingBars[i]?.line ?? 0;
              return (
                <span key={label} className="rounded-full px-3 py-1 text-[11px]"
                  style={{
                    background: bucketCount > 0 ? (i === 3 ? '#FEE2E2' : '#EEF2FF') : '#F1F5F9',
                    color: bucketCount > 0 ? (i === 3 ? '#991B1B' : '#334155') : '#9CA3AF',
                    fontWeight: bucketCount > 0 ? 700 : 500,
                    border: bucketCount > 0 && i === 3 ? '1px solid #FECACA' : '1px solid transparent',
                  }}>
                  {label} {bucketCount > 0 ? `(${bucketCount})` : '(0)'}
                </span>
              );
            })}
            {recentlyClosed > 0 && (
              <span className="rounded-full px-3 py-1 text-[11px]"
                style={{ background: '#DCFCE7', color: '#15803D', fontWeight: 700 }}>
                ✅ {recentlyClosed} closed this week
              </span>
            )}
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={agingBars} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                labelStyle={{ fontWeight: 600, color: '#111827' }}
              />
              <Bar dataKey="low"      stackId="a" fill="#7CC17E" />
              <Bar dataKey="medium"   stackId="a" fill="#F1D458" />
              <Bar dataKey="high"     stackId="a" fill="#E9A23B" />
              <Bar dataKey="critical" stackId="a" fill="#E15759" />
              <Line type="monotone" dataKey="line" stroke="#6276B6" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
