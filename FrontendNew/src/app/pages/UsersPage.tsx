import { useState, useEffect, useCallback, useMemo } from "react";
import { RoleBadge } from "../components/shared/StatusBadge";
import {
  Search, X, UserPlus, Users as UsersIcon, CheckCircle2,
  ShieldCheck, AlertTriangle, ArrowUpRight, Copy,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, Cell, CartesianGrid,
  LineChart, Line, PieChart, Pie, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  getEmployeeDirectory, getPeopleOverview, getTeamHierarchy,
  type EmployeeDirectoryRow, type PeopleOverview, type TeamHierarchyRow,
  type PeopleKpiMetric, type CompetencyCoverageDetail, type WorkerExposureDetail,
  type SupervisorSafetyDetail, type PeopleHighRiskRole,
} from "../../services/personnel.service";
import { useAuth } from "../context/AuthContext";
import { TeamHierarchyTree } from "../components/people/TeamHierarchyTree";
import { InfoTooltip } from "../components/shared/InfoTooltip";

// ── API helpers ───────────────────────────────────────────────────────────────

const API = ((import.meta.env.VITE_API_URL as string) || "/api/v1").replace(/\/$/, "");
const PAGE_SIZE = 25;

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("hse_jwt_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet(path: string) {
  const res = await fetch(`${API}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(path: string, body: object) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrgUser {
  id: number;
  username: string;
  email: string;
  role: string;
  role_label: string;
  is_active: boolean;
  created_at: string;
}

// value = backend app_role name; the mobile worker app authenticates the
// "operator" role, so a "Worker" invite must keep value: "operator".
const ORG_ROLES = [
  { value: "safety_manager", label: "HSE Manager" },
  { value: "supervisor",     label: "Supervisor" },
  { value: "operator",       label: "Worker" },
  { value: "auditor",        label: "Auditor" },
  { value: "viewer",         label: "Viewer" },
];

// Mirrors backend INVITE_PERMISSIONS in org_users.py: Admin invites the HSE
// Manager (safety_manager); the HSE Manager invites Supervisor/Operator/Viewer.
// Keyed by the *display* role from AuthContext's mapBackendRole() (e.g.
// "safety_manager" -> "HSE Manager"), not the raw backend role string —
// currentUser.role on the frontend is always the mapped display name.
const INVITE_TARGETS_BY_ROLE: Record<string, string[]> = {
  "admin": ["safety_manager", "supervisor", "operator", "auditor", "viewer"],
  "hse manager": ["supervisor", "operator", "auditor", "viewer"],
};

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function toneChipStyles(tone: "green" | "amber" | "red" | "blue") {
  if (tone === "green")  return { background: "#E8F5E9", color: "#1B5E20", border: "#C8E6C9" };
  if (tone === "amber")  return { background: "#FFF3D9", color: "#9A6700", border: "#F7D77B" };
  if (tone === "red")    return { background: "#FEECEC", color: "#B42318", border: "#FECACA" };
  return { background: "#EEF4FF", color: "#3957C5", border: "#C7D7FE" };
}

function ToneChip({ tone, children }: { tone: "green" | "amber" | "red" | "blue"; children: string }) {
  const s = toneChipStyles(tone);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: s.background, color: s.color, border: `1px solid ${s.border}` }}
    >
      {children}
    </span>
  );
}

function MiniSparkline({ data, stroke }: { data: readonly number[]; stroke: string }) {
  const hasData = data.some((value) => value > 0);
  return (
    <ResponsiveContainer width="100%" height={64}>
      <LineChart data={data.map((value, index) => ({ index, value }))}>
        <YAxis domain={[0, 100]} hide />
        <Line type="monotone" dataKey="value" stroke={hasData ? stroke : "#D1D5DB"} strokeWidth={3} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function GaugeDial({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(value, 100));
  const filledDeg = (clamped / 100) * 180;
  const redEnd = Math.min(filledDeg, 34);
  const amberEnd = Math.min(filledDeg, 92);
  const greenEnd = Math.min(filledDeg, 180);
  return (
    <div className="relative h-[86px] w-[132px] overflow-hidden">
      <div
        className="absolute left-1/2 top-0 h-[132px] w-[132px] -translate-x-1/2 rounded-full"
        style={{ background: `conic-gradient(from 270deg, #D9534F 0deg ${redEnd}deg, #F3C34C ${redEnd}deg ${amberEnd}deg, #67BC6B ${amberEnd}deg ${greenEnd}deg, #E5E7EB ${greenEnd}deg 360deg)` }}
      />
      <div className="absolute left-1/2 top-[15px] h-[101px] w-[101px] -translate-x-1/2 rounded-full bg-white" />
      <div className="absolute left-1/2 top-[42px] -translate-x-1/2 text-[18px] font-semibold" style={{ color: "#111827" }}>
        {clamped}%
      </div>
    </div>
  );
}

function RingStat({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(0, Math.min(value, 100));
  return (
    <div className="relative h-[74px] w-[74px]">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(${color} 0deg ${clamped * 3.6}deg, #E5E7EB ${clamped * 3.6}deg 360deg)` }}
      />
      <div className="absolute inset-[9px] rounded-full bg-white" />
      <div className="absolute inset-0 flex items-center justify-center text-[18px] font-semibold" style={{ color: "#111827" }}>
        {clamped}%
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

// Period toggle for a trend chart — picking a longer window doesn't refetch,
// it slices more of the same already-fetched array (see PeopleDashboardSection).
function PeriodToggle<T extends number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full p-0.5" style={{ background: "#F1F5F9" }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="rounded-full px-2.5 py-1 text-[11px] transition-colors"
          style={{
            background: value === opt.value ? "#3957C5" : "transparent",
            color: value === opt.value ? "#FFFFFF" : "#64748B",
            fontWeight: 600,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Competency Coverage % — Info tooltip content ────────────────────────────────
// Renders straight from PeopleOverview.competency_coverage (the same object
// the KPI card reads), so the tooltip can never drift from the card.
function CompetencyCoverageInfoContent({ metric }: { metric: PeopleKpiMetric & { detail: CompetencyCoverageDetail } }) {
  const d = metric.detail;
  const covered = d.total_employees - d.flagged_employees;
  const sparkline = metric.sparkline ?? [];
  const earliest = sparkline.length > 0 ? sparkline[0] : null;
  const flat = sparkline.length > 0 && sparkline.every((v) => v === sparkline[0]);

  return (
    <div className="space-y-2.5 text-[12px] leading-snug" style={{ color: '#374151' }}>
      <div className="text-[13px] font-semibold" style={{ color: '#111827' }}>Competency Coverage %</div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Current Score</div>
        <div className="text-[15px] font-bold" style={{ color: '#111827' }}>{metric.value}% — {metric.subtitle}</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Change indicator</div>
        <div className="font-semibold" style={{ color: metric.tone === 'red' ? '#B91C1C' : '#3C8A52' }}>{metric.change}</div>
        <div className="text-[11px]" style={{ color: '#9CA3AF' }}>
          Not a period-over-period comparison — the arrow only shows whether the score sits in a healthy band; the number just repeats the current score.
        </div>
      </div>

      {sparkline.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Trend (last {d.sparkline_months} months)</div>
          <div>
            {flat
              ? `No change recorded — every monthly checkpoint in this window reads ${metric.value}%.`
              : `${earliest}% earliest checkpoint → ${metric.value}% now.`}
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Calculation</div>
        <div>Score = (Total employees − Flagged employees) ÷ Total employees × 100.</div>
        <div className="mt-0.5 text-[11px]" style={{ color: '#6B7280' }}>
          &quot;Flagged&quot; = an employee linked to a training-related incident (root cause mentions &quot;training&quot;) or responsible for a CAPA whose root cause addressed mentions &quot;training&quot;.
        </div>
        <div className="mt-1.5 rounded-md p-1.5 font-mono text-[11px]" style={{ background: '#F8FAFC', color: '#111827' }}>
          ({d.total_employees} − {d.flagged_employees}) ÷ {d.total_employees} × 100 = {metric.value}%
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Raw values</div>
        <div>Total employees: {d.total_employees}</div>
        <div>Flagged via training-related incident: {d.flagged_from_incidents}</div>
        <div>Flagged via training-related CAPA: {d.flagged_from_capa}</div>
        <div>Flagged, unique total: {d.flagged_employees}</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Rating bands</div>
        <div>{d.high_label} at {d.high_floor}%+ · {d.mid_label} at {d.mid_floor}%+ · {d.low_label} below {d.mid_floor}%</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Interpretation</div>
        <div>
          {covered} of {d.total_employees} employees ({metric.value}%) have no training-linked incident or CAPA against them — rated &quot;{metric.subtitle}&quot; ({d.high_label} starts at {d.high_floor}%).
        </div>
      </div>
    </div>
  );
}

// ── Worker Exposure Index — Info tooltip content ────────────────────────────────
// Renders straight from PeopleOverview.worker_exposure_index (the same object
// the KPI card reads), so the tooltip can never drift from the card.
function WorkerExposureInfoContent({ metric }: { metric: PeopleKpiMetric & { detail: WorkerExposureDetail } }) {
  const d = metric.detail;
  const windowRange = `${formatShortDate(d.window_start)} – ${formatShortDate(d.window_end)}`;

  return (
    <div className="space-y-2.5 text-[12px] leading-snug" style={{ color: '#374151' }}>
      <div className="text-[13px] font-semibold" style={{ color: '#111827' }}>Worker Exposure Index</div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Current Score</div>
        <div className="text-[15px] font-bold" style={{ color: '#111827' }}>{metric.value}% — {metric.subtitle}</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Change indicator</div>
        <div className="font-semibold" style={{ color: metric.tone === 'green' ? '#3C8A52' : metric.tone === 'red' ? '#B91C1C' : '#B45309' }}>{metric.change || '—'}</div>
        <div className="text-[11px]" style={{ color: '#9CA3AF' }}>
          Not a period-over-period comparison — this is a single symbol showing whether the risk band is healthy (▲, Low Risk only) or needs attention (⚠). There is no previous-period value behind it.
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Window</div>
        <div>Trailing {d.window_days} days: {windowRange}</div>
        <div className="text-[11px]" style={{ color: '#9CA3AF' }}>Anchored on your organisation&apos;s latest recorded incident/near-miss date, not today&apos;s date.</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Calculation</div>
        <div>Score = min(100, (Recent incidents + Recent near misses) ÷ Total employees × 100).</div>
        <div className="mt-1.5 rounded-md p-1.5 font-mono text-[11px]" style={{ background: '#F8FAFC', color: '#111827' }}>
          ({d.recent_incidents} + {d.recent_near_misses}) ÷ {d.total_employees} × 100 = {d.raw_pct}%{d.capped ? ` → capped to 100%` : ''}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Raw values</div>
        <div>Total employees: {d.total_employees}</div>
        <div>Incidents in window: {d.recent_incidents}</div>
        <div>Near misses in window: {d.recent_near_misses}</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Rating bands</div>
        <div>{d.low_label} below {d.mid_floor}% · {d.mid_label} at {d.mid_floor}%+ · {d.high_label} at {d.high_floor}%+</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Interpretation</div>
        <div>
          {d.recent_incidents + d.recent_near_misses} safety events ({d.recent_incidents} incidents, {d.recent_near_misses} near misses) were logged against {d.total_employees} employees in this {d.window_days}-day window — rated &quot;{metric.subtitle}&quot; ({d.mid_label} starts at {d.mid_floor}%, {d.high_label} at {d.high_floor}%).
        </div>
      </div>
    </div>
  );
}

// ── Supervisor Safety Score — Info tooltip content ──────────────────────────────
// Renders straight from PeopleOverview.supervisor_safety_score (the same
// object the KPI card reads), so the tooltip can never drift from the card.
function SupervisorSafetyInfoContent({ metric }: { metric: PeopleKpiMetric & { detail: SupervisorSafetyDetail } }) {
  const d = metric.detail;

  return (
    <div className="space-y-2.5 text-[12px] leading-snug" style={{ color: '#374151' }}>
      <div className="text-[13px] font-semibold" style={{ color: '#111827' }}>Supervisor Safety Score</div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Current Score</div>
        <div className="text-[15px] font-bold" style={{ color: '#111827' }}>{metric.value}% — {metric.subtitle}</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Change indicator</div>
        <div className="font-semibold" style={{ color: metric.tone === 'red' ? '#B91C1C' : '#3C8A52' }}>{metric.change}</div>
        <div className="text-[11px]" style={{ color: '#9CA3AF' }}>
          Not a period-over-period comparison — the arrow only shows whether the score sits in a healthy band; the number just repeats the current score.
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Calculation</div>
        <div>Score = Average Safety Walk compliance rating (1–5 scale) ÷ 5 × 100, rounded.</div>
        <div className="mt-0.5 text-[11px]" style={{ color: '#6B7280' }}>
          Averaged across every Safety Walk logged by an employee whose Role has Safety_Signatory = Yes — all-time, not limited to the dashboard&apos;s selected period.
        </div>
        <div className="mt-1.5 rounded-md p-1.5 font-mono text-[11px]" style={{ background: '#F8FAFC', color: '#111827' }}>
          {d.avg_compliance_rating_1_5 !== null
            ? `${d.avg_compliance_rating_1_5} ÷ 5 × 100 = ${metric.value}%`
            : 'No qualifying Safety Walks recorded — score defaults to 0%.'}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Raw values</div>
        <div>Safety Walks counted: {d.safety_walk_count}</div>
        <div>Distinct supervisors (Safety_Signatory = Yes) inspecting: {d.supervisor_count}</div>
        <div>Average compliance rating: {d.avg_compliance_rating_1_5 !== null ? `${d.avg_compliance_rating_1_5} / 5` : '—'}</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Rating bands</div>
        <div>Needs Coaching below {d.effective_floor}% · Effective at {d.effective_floor}%+ · Highly Effective at {d.highly_effective_floor}%+</div>
        <div className="text-[11px]" style={{ color: '#9CA3AF' }}>Fixed thresholds — not org-configurable, unlike Competency Coverage and Worker Exposure Index.</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Interpretation</div>
        <div>
          {d.supervisor_count} supervisor{d.supervisor_count === 1 ? '' : 's'} logged {d.safety_walk_count} Safety Walk{d.safety_walk_count === 1 ? '' : 's'} averaging {d.avg_compliance_rating_1_5 ?? '—'}/5 compliance — rated &quot;{metric.subtitle}&quot;.
        </div>
      </div>
    </div>
  );
}

// ── High Risk Roles — Info tooltip content ──────────────────────────────────────
// Renders straight from PeopleOverview.high_risk_roles (the same array the
// table reads), so the tooltip can never drift from what's on screen.
function HighRiskRolesInfoContent({ roles }: { roles: PeopleHighRiskRole[] }) {
  if (roles.length === 0) {
    return (
      <div className="text-[12px]" style={{ color: '#374151' }}>
        No roles with employees assigned yet — there is nothing to rank.
      </div>
    );
  }
  const { high_floor, medium_floor } = roles[0].detail;
  const toneColor = (tone: string) => (tone === 'red' ? '#B91C1C' : tone === 'amber' ? '#B45309' : '#3C8A52');

  return (
    <div className="space-y-2.5 text-[12px] leading-snug" style={{ color: '#374151' }}>
      <div className="text-[13px] font-semibold" style={{ color: '#111827' }}>High Risk Roles</div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Calculation</div>
        <div>Rate = (Incidents + Near Misses reported by that role&apos;s employees) ÷ Headcount in that role.</div>
        <div className="mt-0.5 text-[11px]" style={{ color: '#6B7280' }}>
          Top 4 roles by rate, highest first — all-time totals, not limited to the dashboard&apos;s selected period.
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Rating bands</div>
        <div>Low below {medium_floor} · Medium at {medium_floor}+ · High at {high_floor}+ (events per employee)</div>
        <div className="text-[11px]" style={{ color: '#9CA3AF' }}>Fixed thresholds — not org-configurable.</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Raw values behind each row</div>
        <div className="mt-1 space-y-1.5">
          {roles.map((r) => (
            <div key={r.role} className="rounded-md p-1.5" style={{ background: '#F8FAFC' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold truncate" style={{ color: '#111827' }}>{r.role}</span>
                <span className="font-semibold" style={{ color: toneColor(r.tone) }}>{r.status}</span>
              </div>
              <div className="font-mono text-[11px]" style={{ color: '#6B7280' }}>
                ({r.detail.incidents} + {r.detail.near_misses}) ÷ {r.detail.headcount} = {r.detail.rate}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── People Dashboard section ──────────────────────────────────────────────────

interface PeopleKpiCardItem {
  title: string;
  value: string;
  subtitle: string;
  change: string;
  tone: 'green' | 'amber' | 'red' | 'blue';
  visual: 'spark' | 'gauge' | 'ring';
  sparkline?: number[];
  /** Optional Info-icon tooltip content — populated per-card below. */
  info?: React.ReactNode;
}

function PeopleDashboardSection({ currentUserName, overview }: { currentUserName?: string; overview: PeopleOverview | null }) {
  const peopleKpis: PeopleKpiCardItem[] = overview
    ? ([
        {
          title: "Competency Coverage %",
          value: `${overview.competency_coverage.value}%`,
          subtitle: overview.competency_coverage.subtitle,
          change: overview.competency_coverage.change,
          tone: overview.competency_coverage.tone,
          visual: "spark" as const,
          sparkline: overview.competency_coverage.sparkline ?? [],
          info: <CompetencyCoverageInfoContent metric={overview.competency_coverage} />,
        },
        {
          title: "Worker Exposure Index",
          value: `${overview.worker_exposure_index.value}%`,
          subtitle: overview.worker_exposure_index.subtitle,
          change: overview.worker_exposure_index.change,
          tone: overview.worker_exposure_index.tone,
          visual: "gauge" as const,
          info: <WorkerExposureInfoContent metric={overview.worker_exposure_index} />,
        },
        {
          title: "Supervisor Safety Score",
          value: `${overview.supervisor_safety_score.value}%`,
          subtitle: overview.supervisor_safety_score.subtitle,
          change: overview.supervisor_safety_score.change,
          tone: overview.supervisor_safety_score.tone,
          visual: "ring" as const,
          info: <SupervisorSafetyInfoContent metric={overview.supervisor_safety_score} />,
        },
      ])
    : [];

  const fatigueTrend      = overview?.fatigue_trend      ?? [];
  const toolboxTrend      = overview?.toolbox_trend      ?? [];

  // ── Period toggle — the chart box stays a fixed size; a short window
  // (10W / 6M) fits inside it with no scrolling, a long one (52W / 12M)
  // renders wider than the box and scrolls left/right inside it. ──────────
  const [fatiguePeriod, setFatiguePeriod] = useState<10 | 26 | 52>(10);
  const [toolboxPeriod, setToolboxPeriod] = useState<6 | 12>(6);
  const slicedFatigue = fatigueTrend.slice(-fatiguePeriod);
  const slicedToolbox = toolboxTrend.slice(-toolboxPeriod);
  const fatigueRangeLabel = useMemo(() => {
    if (slicedFatigue.length === 0) return "";
    const start = formatShortDate(slicedFatigue[0].week_start);
    const endDate = new Date(slicedFatigue[slicedFatigue.length - 1].week_start);
    endDate.setDate(endDate.getDate() + 6);
    return `Weekly · last ${slicedFatigue.length} weeks (${start} – ${formatShortDate(endDate.toISOString())})`;
  }, [slicedFatigue]);
  const toolboxRangeLabel = useMemo(() => {
    if (slicedToolbox.length === 0) return "";
    const start = formatMonthYear(slicedToolbox[0].month_start);
    const end = formatMonthYear(slicedToolbox[slicedToolbox.length - 1].month_start);
    return `Monthly · last ${slicedToolbox.length} months (${start} – ${end})`;
  }, [slicedToolbox]);

  const highRiskRoles     = overview?.high_risk_roles    ?? [];
  const trainingExpiry    = overview?.training_expiry    ?? [];
  const behaviourBreakdown = overview?.behaviour_breakdown ?? [];
  const coachingActions   = overview?.coaching_actions   ?? [];
  const openActions       = overview?.open_actions       ?? [];
  const expiringSoonCount = overview?.expiring_soon_count ?? 0;
  const toolboxMoM =
    toolboxTrend.length >= 2
      ? Math.round(((toolboxTrend[toolboxTrend.length - 1].meetings - toolboxTrend[toolboxTrend.length - 2].meetings) /
          (toolboxTrend[toolboxTrend.length - 2].meetings || 1)) * 100)
      : null;

  return (
    <div
      className="rounded-3xl border p-4 md:p-6 overflow-hidden"
      style={{
        borderColor: "#D8E3F6",
        backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(244,247,251,0.98)), radial-gradient(#D9DDE7 1px, transparent 1px)",
        backgroundSize: "auto, 18px 18px",
        boxShadow: "0px 16px 32px rgba(15, 23, 42, 0.08)",
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[26px] md:text-[34px] leading-[1.1]" style={{ color: "#111827", fontWeight: 800 }}>
            Welcome, {currentUserName || "Team"}
          </h2>
          <p className="mt-2 max-w-3xl text-[13px] md:text-[14px] leading-[1.6]" style={{ color: "#4B5563" }}>
            Contextual UX automatically filters data to direct reports, prioritizing fatigue tracking, specific training gaps, and role-based risk signals.
          </p>
        </div>
        <div className="rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ background: "#EEF4FF", color: "#3957C5" }}>
          Live data
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-3">
        {peopleKpis.map((metric) => (
          <div key={metric.title} className="rounded-2xl border bg-white p-4 shadow-[0_6px_20px_rgba(15,23,42,0.05)]" style={{ borderColor: "#DCE7F7" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-[15px] font-semibold" style={{ color: "#111827" }}>
                  {metric.title}
                  {metric.info && (
                    <InfoTooltip label={`${metric.title} — how this is calculated`}>
                      {metric.info}
                    </InfoTooltip>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[34px] leading-none" style={{ color: "#111827", fontWeight: 800 }}>{metric.value}</span>
                  <ToneChip tone={metric.tone}>{metric.change}</ToneChip>
                </div>
                <div className="mt-1 text-[13px]" style={{ color: "#4B5563" }}>{metric.subtitle}</div>
              </div>
              <div className="shrink-0">
                {metric.visual === "spark" && (metric as { sparkline?: number[] }).sparkline ? (
                  <div className="w-[120px]">
                    <MiniSparkline data={(metric as { sparkline: number[] }).sparkline} stroke="#5B6FCE" />
                  </div>
                ) : metric.visual === "gauge" ? (
                  <div className="pt-1">
                    <GaugeDial value={overview?.worker_exposure_index.value ?? 0} />
                  </div>
                ) : (
                  <RingStat value={overview?.supervisor_safety_score.value ?? 0} color="#2F73B8" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Fatigue chart */}
        <div className="xl:col-span-5 rounded-2xl border bg-white p-4" style={{ borderColor: "#DCE7F7", boxShadow: "0px 10px 24px rgba(15, 23, 42, 0.06)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[18px] font-semibold" style={{ color: "#111827" }}>Fatigue Risk (overtime vs. normal hours)</h3>
              <div className="mt-1 flex items-center gap-3 text-[12px]" style={{ color: "#6B7280" }}>
                <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 rounded-full" style={{ background: "#66708E" }} /> Normal Hours</span>
                <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 rounded-full" style={{ background: "#C9A246" }} /> Overtime</span>
              </div>
            </div>
            <PeriodToggle
              options={[{ value: 10, label: "10W" }, { value: 26, label: "26W" }, { value: 52, label: "52W" }]}
              value={fatiguePeriod}
              onChange={setFatiguePeriod}
            />
          </div>
          <div className="mt-1.5 text-[11px]" style={{ color: "#9CA3AF" }}>{fatigueRangeLabel}</div>
          <div className="mt-3 h-[280px]">
            {slicedFatigue.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed" style={{ borderColor: "#D1D5DB" }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></svg>
                <p className="text-[13px] font-medium" style={{ color: "#6B7280" }}>No shift schedule data uploaded</p>
                <p className="text-[11px]" style={{ color: "#9CA3AF" }}>Upload shift schedule via Data Management to see fatigue trends</p>
              </div>
            ) : (
              // The box (this outer div) stays a fixed size; the inner chart
              // widens with point count, so 10W fits with no scrollbar while
              // 52W renders wider than the box and scrolls left/right inside it.
              <div className="h-full overflow-x-auto">
                <div className="h-full" style={{ minWidth: slicedFatigue.length * 55 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={slicedFatigue}>
                      <CartesianGrid stroke="#EEF2F7" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, fontSize: 12 }} />
                      <Line yAxisId="left" type="monotone" dataKey="normal" stroke="#66708E" strokeWidth={3} dot={{ r: 2.5, fill: "#66708E" }} activeDot={{ r: 4 }} />
                      <Line yAxisId="right" type="monotone" dataKey="overtime" stroke="#C9A246" strokeWidth={3} dot={{ r: 2.5, fill: "#C9A246" }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toolbox trend */}
        <div className="xl:col-span-4 rounded-2xl border bg-white p-4" style={{ borderColor: "#DCE7F7", boxShadow: "0px 10px 24px rgba(15, 23, 42, 0.06)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[18px] font-semibold" style={{ color: "#111827" }}>Safety Toolbox Meetings Trend</h3>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]" style={{ background: "#EEF4FF", color: "#3957C5", fontWeight: 600 }}>
                <ArrowUpRight className="w-3.5 h-3.5" />
                {toolboxMoM === null ? "Not enough data yet" : `${toolboxMoM >= 0 ? "Increased" : "Decreased"} ${Math.abs(toolboxMoM)}% MoM`}
              </div>
            </div>
            <PeriodToggle
              options={[{ value: 6, label: "6M" }, { value: 12, label: "12M" }]}
              value={toolboxPeriod}
              onChange={setToolboxPeriod}
            />
          </div>
          <div className="mt-1.5 text-[11px]" style={{ color: "#9CA3AF" }}>{toolboxRangeLabel}</div>
          <div className="mt-3 h-[280px] overflow-x-auto">
            <div className="h-full" style={{ minWidth: slicedToolbox.length * 65 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={slicedToolbox}>
                  <defs>
                    <linearGradient id="toolboxFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#66708E" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#66708E" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" interval={0} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, fontSize: 12 }} />
                  <Area type="monotone" dataKey="meetings" stroke="#66708E" strokeWidth={3} fill="url(#toolboxFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* High risk roles */}
        <div className="xl:col-span-3 rounded-2xl border bg-white p-4" style={{ borderColor: "#DCE7F7", boxShadow: "0px 10px 24px rgba(15, 23, 42, 0.06)" }}>
          <div className="flex items-center gap-1.5">
            <h3 className="text-[18px] font-semibold" style={{ color: "#111827" }}>High Risk Roles</h3>
            {highRiskRoles.length > 0 && (
              <InfoTooltip label="High Risk Roles — how this is calculated">
                <HighRiskRolesInfoContent roles={highRiskRoles} />
              </InfoTooltip>
            )}
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border" style={{ borderColor: "#E5EAF3" }}>
            <div className="grid grid-cols-[minmax(0,1fr)_88px] bg-[#F8FAFC] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: "#6B7280" }}>
              <div>Roles</div><div className="text-center">Status</div>
            </div>
            <div className="divide-y" style={{ borderColor: "#EEF2F7" }}>
              {highRiskRoles.map((item) => (
                <div key={item.role} className="grid grid-cols-[minmax(0,1fr)_88px] items-center px-3 py-2.5 text-[12px]">
                  <div className="min-w-0 truncate font-medium" style={{ color: "#111827" }}>{item.role}</div>
                  <div className="flex justify-center"><ToneChip tone={item.tone}>{item.status}</ToneChip></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-4">
        {/* Training expiry */}
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "#DCE7F7", boxShadow: "0px 10px 24px rgba(15, 23, 42, 0.06)" }}>
          <h3 className="text-[18px] font-semibold" style={{ color: "#111827" }}>Training Expiry Status</h3>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#FFF4D6", color: "#C78800" }}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[30px] leading-none font-bold" style={{ color: "#111827" }}>{expiringSoonCount}</div>
              <div className="mt-1 text-[13px]" style={{ color: "#374151" }}>Expiring Soon</div>
            </div>
          </div>
          <div className="mt-4 h-[154px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trainingExpiry}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {trainingExpiry.map((entry, index) => (
                    <Cell key={entry.label} fill={index === 0 ? "#F4A62A" : index === 1 ? "#F7CF4A" : "#E5A11D"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Behaviour observations */}
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "#DCE7F7", boxShadow: "0px 10px 24px rgba(15, 23, 42, 0.06)" }}>
          <h3 className="text-[18px] font-semibold" style={{ color: "#111827" }}>Behaviour Observations</h3>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2 text-[13px]" style={{ color: "#374151" }}>
              {behaviourBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <span>{item.label}</span>
                  <span className="font-semibold" style={{ color: item.color }}>{item.value}%</span>
                </div>
              ))}
            </div>
            <div className="w-[124px]">
              <ResponsiveContainer width="100%" height={124}>
                <PieChart>
                  <Pie data={behaviourBreakdown} dataKey="value" nameKey="label" innerRadius={38} outerRadius={58} paddingAngle={2}>
                    {behaviourBreakdown.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Coaching actions */}
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "#DCE7F7", boxShadow: "0px 10px 24px rgba(15, 23, 42, 0.06)" }}>
          <h3 className="text-[18px] font-semibold" style={{ color: "#111827" }}>Coaching Actions</h3>
          <div className="mt-3 space-y-3">
            {coachingActions.length === 0 ? (
              <div className="text-[12px]" style={{ color: "#6B7280" }}>
                No coaching sessions logged yet.
              </div>
            ) : (
              coachingActions.map((item) => (
                <div key={item.title} className="rounded-xl border px-3 py-2.5" style={{ borderColor: "#EEF2F7", background: "#FBFCFE" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold" style={{ color: "#111827" }}>{item.title}</div>
                      <div className="mt-0.5 text-[12px]" style={{ color: "#6B7280" }}>{item.detail}</div>
                    </div>
                    <ToneChip tone={item.tone}>{item.detail === "Overdue" ? "Overdue" : "Open"}</ToneChip>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Open actions */}
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "#DCE7F7", boxShadow: "0px 10px 24px rgba(15, 23, 42, 0.06)" }}>
          <div className="flex items-center gap-1.5">
            <h3 className="text-[18px] font-semibold" style={{ color: "#111827" }}>Open Actions</h3>
            <InfoTooltip label="Open Actions — how this is calculated">
              <div className="space-y-2.5 text-[12px] leading-snug" style={{ color: '#374151' }}>
                <div className="text-[13px] font-semibold" style={{ color: '#111827' }}>Open Actions</div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Source</div>
                  <div>CAPA actions not yet marked Completed, across the organisation.</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Sort &amp; limit</div>
                  <div>Nearest due date first (undated actions last) — top 3 shown.</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Tag &amp; color</div>
                  <div>High (red) = past due date · Priority (amber) = due within 7 days · Priority (blue) = due later or undated.</div>
                </div>
              </div>
            </InfoTooltip>
          </div>
          <div className="mt-3 space-y-3">
            {openActions.map((item) => (
              <div key={item.title} className="rounded-xl border px-3 py-2.5" style={{ borderColor: "#EEF2F7", background: "#FBFCFE" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold" style={{ color: "#111827" }}>{item.title}</div>
                    <div className="mt-0.5 text-[12px]" style={{ color: "#6B7280" }}>{item.detail}</div>
                  </div>
                  <ToneChip tone={item.tone}>{item.priority ?? "Open"}</ToneChip>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const currentRole = currentUser?.role?.toLowerCase() ?? "";
  const isAdmin = currentRole === "admin";
  const inviteTargetRoles = INVITE_TARGETS_BY_ROLE[currentRole] ?? [];
  const canInvite = inviteTargetRoles.length > 0;

  // ── Org users state ─────────────────────────────────────────────────────────
  const [orgUsers, setOrgUsers]           = useState<OrgUser[]>([]);
  const [orgUsersLoading, setOrgUsersLoading] = useState(false);

  // ── Invite modal state ──────────────────────────────────────────────────────
  const [showInviteModal, setShowInviteModal]   = useState(false);
  const [inviteForm, setInviteForm]             = useState({ name: "", email: "", role: inviteTargetRoles[0] ?? "operator", department_id: "" });
  // Site is a filter, not a stored field. `employees` has no site_id — a
  // person's site is derived as employee -> department -> site, so storing it
  // separately would be a second copy that can disagree with the first.
  const [inviteSiteId, setInviteSiteId]         = useState("");
  const [siteOptions, setSiteOptions]           = useState<{ id: number; site_name: string }[]>([]);
  const [deptOptions, setDeptOptions]           = useState<{ id: number; department_name: string; site_id: number | null }[]>([]);
  const [inviteLoading, setInviteLoading]       = useState(false);
  // Both lists are org-scoped by the backend, so no filtering is needed here.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet("/sites/?limit=200").catch(() => []),
      apiGet("/departments/?limit=200").catch(() => []),
    ]).then(([sites, depts]) => {
      if (cancelled) return;
      const list = (v: unknown) => (Array.isArray(v) ? v : (v as { items?: unknown[] })?.items ?? []);
      setSiteOptions(list(sites) as typeof siteOptions);
      setDeptOptions(list(depts) as typeof deptOptions);
    });
    return () => { cancelled = true; };
  }, []);
  const [inviteError, setInviteError]           = useState("");
  const [inviteResult, setInviteResult]         = useState<{
    email: string; temp_password: string; login_url: string; email_sent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Employee directory state ─────────────────────────────────────────────────
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeDirectoryRow[]>([]);
  const [peopleOverview, setPeopleOverview]       = useState<PeopleOverview | null>(null);
  const [search, setSearch]         = useState("");
  const [filterRole, setFilterRole] = useState("All Roles");
  const [filterStatus, setFilterStatus] = useState("All Statuses");
  const [currentPage, setCurrentPage] = useState(1);

  // ── Team hierarchy state ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"directory" | "hierarchy">("directory");
  const [teamHierarchy, setTeamHierarchy] = useState<TeamHierarchyRow[]>([]);

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadOrgUsers = useCallback(async () => {
    setOrgUsersLoading(true);
    try {
      const data = await apiGet("/org/users");
      const list = Array.isArray(data) ? data : ((data as { items?: OrgUser[] }).items ?? []);
      setOrgUsers(list);
    } catch {
      // Not fatal — user might not be an org admin
    } finally {
      setOrgUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canInvite) loadOrgUsers();
  }, [canInvite, loadOrgUsers]);

  useEffect(() => {
    getPeopleOverview().then(setPeopleOverview).catch(console.error);
  }, []);

  useEffect(() => {
    getEmployeeDirectory().then(setEmployeeDirectory).catch(console.error);
  }, []);

  useEffect(() => {
    getTeamHierarchy().then(setTeamHierarchy).catch(console.error);
  }, []);

  // ── Org user actions ─────────────────────────────────────────────────────────

  const handleInviteSubmit = async () => {
    setInviteError("");
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) {
      setInviteError("Name and email are required.");
      return;
    }
    setInviteLoading(true);
    try {
      const result = await apiPost("/org/invite-user", {
        name: inviteForm.name,
        email: inviteForm.email,
        role: inviteForm.role,
        // Omitted rather than sent as "" — the backend treats absent as
        // "no department" and would reject the empty string as not a number.
        ...(inviteForm.department_id ? { department_id: Number(inviteForm.department_id) } : {}),
      });
      setInviteResult(result as typeof inviteResult);
      loadOrgUsers();
      getEmployeeDirectory().then(setEmployeeDirectory).catch(console.error);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviteLoading(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────────

  // /people/directory now always returns both org users + imported employees combined
  const allPeople = useMemo<EmployeeDirectoryRow[]>(() => employeeDirectory, [employeeDirectory]);

  const employeeRoleOptions = Array.from(
    new Set(allPeople.map((e) => e.role_name).filter((r): r is string => Boolean(r))),
  ).sort();

  const filteredEmployees = allPeople
    .filter((e) => !search || (e.full_name ?? "").toLowerCase().includes(search.toLowerCase()))
    .filter((e) => filterRole === "All Roles" || e.role_name === filterRole)
    .filter((e) => filterStatus === "All Statuses" || e.active_status === filterStatus);

  const totalUsers = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = totalUsers === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalUsers);
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterRole, filterStatus]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const employeeInitials = (e: EmployeeDirectoryRow) => {
    if (!e.full_name) return "?";
    return e.full_name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 relative">

      {/* People Dashboard */}
      <PeopleDashboardSection currentUserName={currentUser?.name} overview={peopleOverview} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1>Users</h1>
        {canInvite && (
          <button
            onClick={() => {
              setInviteForm({ name: "", email: "", role: inviteTargetRoles[0] ?? "operator", department_id: "" });
              setInviteSiteId("");
              setInviteError("");
              setInviteResult(null);
              setCopied(false);
              setShowInviteModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px]"
            style={{ background: "linear-gradient(135deg, #0B3D91, #1D4ED8)", fontWeight: 600 }}
          >
            <UserPlus className="w-4 h-4" /> Invite User
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 rounded-lg border p-1 w-fit" style={{ borderColor: "#E2E8E2", background: "#F4F7F4" }}>
        {([
          { key: "directory", label: "Directory" },
          { key: "hierarchy", label: "Team Hierarchy" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-1.5 rounded-md text-[13px] transition-colors"
            style={
              activeTab === tab.key
                ? { background: "#fff", color: "#1B5E20", fontWeight: 600, boxShadow: "0px 1px 4px rgba(27,94,32,0.15)" }
                : { color: "#6B7280", fontWeight: 500 }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "directory" ? (
        <>
          {/* ── Filters ── */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
              <input
                placeholder="Search users…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg border text-[13px]"
                style={{ borderColor: "#E2E8E2" }}
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 rounded-lg border text-[13px] bg-white"
              style={{ borderColor: "#E2E8E2", color: "#4A5568" }}
            >
              <option>All Roles</option>
              {employeeRoleOptions.map((r) => <option key={r}>{r}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border text-[13px] bg-white"
              style={{ borderColor: "#E2E8E2", color: "#4A5568" }}
            >
              <option>All Statuses</option>
              <option>Active</option>
              <option>On Leave</option>
            </select>
          </div>

          {/* ── All Users Table ── */}
          <div
            className="bg-white rounded-xl border overflow-hidden"
            style={{ borderColor: "#E8EFE8", boxShadow: "0px 2px 12px rgba(27, 94, 32, 0.08)" }}
          >
            <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ borderColor: "#EEF2EE", background: "#F4F7F4" }}>
              <ShieldCheck className="w-4 h-4" style={{ color: "#2E7D32" }} />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#2E7D32" }}>
                {orgUsersLoading ? "Loading…" : `All Users — ${filteredEmployees.length}`}
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ background: "#F4F7F4" }}>
                  {["Name", "Role", "Department", "Site", "Employment Type", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left">
                      <span className="text-[11px] uppercase tracking-[0.5px]" style={{ color: "#9CA3AF", fontWeight: 600 }}>{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "#9CA3AF" }} />
                      <p className="text-[13px]" style={{ color: "#9CA3AF" }}>No users found</p>
                    </td>
                  </tr>
                ) : paginatedEmployees.map((e) => (
                  <tr key={e.id} className="group hover:bg-[#F9FBF9] transition-colors" style={{ borderBottom: "1px solid #EEF2EE" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px]"
                          style={{ background: "linear-gradient(135deg, #1B5E20, #43A047)", fontWeight: 600 }}
                        >
                          {employeeInitials(e)}
                        </div>
                        <span className="text-[13px]" style={{ color: "#0A0A0A", fontWeight: 500 }}>{e.full_name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={e.role_name ?? "Worker"} /></td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: "#4A5568" }}>{e.department_name ?? "—"}</td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: "#4A5568" }}>{e.site_name ?? "—"}</td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: "#4A5568" }}>{e.employment_type ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: e.active_status === "Active" ? "#2E7D32" : "#C78800" }} />
                        <span className="text-[13px]" style={{ color: e.active_status === "Active" ? "#2E7D32" : "#C78800", fontWeight: 500 }}>
                          {e.active_status ?? "Unknown"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "#EEF2EE", background: "#FBFDFB" }}>
              <div className="text-[12px]" style={{ color: "#6B7280" }}>
                {totalUsers === 0
                  ? "Showing 0 of 0 users"
                  : `Showing ${startIndex + 1}–${endIndex} of ${totalUsers} users`}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                  className="rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    color: safeCurrentPage === 1 ? "#94A3B8" : "#4A57B9",
                    background: "#F4F7F4",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => {
                  const active = page === safeCurrentPage;
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className="rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors"
                      style={{
                        color: active ? "#FFFFFF" : "#475569",
                        background: active ? "#4A57B9" : "#F4F7F4",
                        border: active ? "1px solid #4A57B9" : "1px solid #E2E8F0",
                        boxShadow: active ? "0 6px 14px rgba(74, 87, 185, 0.18)" : "none",
                      }}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    color: safeCurrentPage === totalPages ? "#94A3B8" : "#4A57B9",
                    background: "#F4F7F4",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ── Team Hierarchy ── */
        <div
          className="bg-white rounded-xl border overflow-hidden"
          style={{ borderColor: "#E8EFE8", boxShadow: "0px 2px 12px rgba(27, 94, 32, 0.08)" }}
        >
          <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ borderColor: "#EEF2EE", background: "#F4F7F4" }}>
            <UsersIcon className="w-4 h-4" style={{ color: "#2E7D32" }} />
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#2E7D32" }}>
              Reporting Structure — {teamHierarchy.length}
            </span>
          </div>
          <div className="px-2 py-1">
            <TeamHierarchyTree rows={teamHierarchy} />
          </div>
        </div>
      )}

      {/* ── Invite User Modal ── */}
      {showInviteModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => { if (!inviteLoading) { setShowInviteModal(false); setInviteResult(null); } }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" style={{ border: "1px solid #D6E4FF" }}>
              <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "#E0EAFF" }}>
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" style={{ color: "#1D4ED8" }} />
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0A0A0A" }}>Invite User</h2>
                </div>
                <button
                  disabled={inviteLoading}
                  onClick={() => { setShowInviteModal(false); setInviteResult(null); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" style={{ color: "#4A5568" }} />
                </button>
              </div>

              <div className="p-6">
                {inviteResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "#E8F5E9", border: "1px solid #C8E6C9" }}>
                      <CheckCircle2 className="w-5 h-5" style={{ color: "#2E7D32" }} />
                      <p className="text-[13px]" style={{ color: "#1B5E20", fontWeight: 600 }}>
                        User invited successfully!{" "}
                        {inviteResult.email_sent ? "Credentials sent via email." : "Email not configured — share credentials manually."}
                      </p>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: "#F0F4FF", border: "1px solid #C7D7FD" }}>
                      <p className="text-[11px] uppercase font-bold mb-3" style={{ color: "#6B7280", letterSpacing: "0.5px" }}>Login Credentials</p>
                      <div className="space-y-2 text-[13px]">
                        <div className="flex items-center justify-between">
                          <span style={{ color: "#374151" }}>Email:</span>
                          <span style={{ color: "#0A0A0A", fontWeight: 600 }}>{inviteResult.email}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span style={{ color: "#374151" }}>Password:</span>
                          <div className="flex items-center gap-2">
                            <code className="px-2 py-1 rounded text-[13px]" style={{ background: "#E0E7FF", color: "#1D4ED8", fontWeight: 700 }}>
                              {inviteResult.temp_password}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(inviteResult!.temp_password);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }}
                              className="p-1 rounded hover:bg-blue-50"
                              title="Copy password"
                            >
                              <Copy className="w-3.5 h-3.5" style={{ color: copied ? "#2E7D32" : "#1D4ED8" }} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span style={{ color: "#374151" }}>Login URL:</span>
                          <a href={inviteResult.login_url} target="_blank" rel="noreferrer" className="text-[12px]" style={{ color: "#1D4ED8", fontWeight: 600 }}>
                            {inviteResult.login_url}
                          </a>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setInviteResult(null); setInviteForm({ name: "", email: "", role: inviteTargetRoles[0] ?? "operator", department_id: "" }); setInviteSiteId(""); setInviteError(""); setCopied(false); }}
                      className="w-full py-2.5 rounded-xl text-[13px]"
                      style={{ background: "linear-gradient(135deg, #0B3D91, #1D4ED8)", color: "#fff", fontWeight: 600 }}
                    >
                      Invite Another User
                    </button>
                    <button
                      onClick={() => { setShowInviteModal(false); setInviteResult(null); }}
                      className="w-full py-2.5 rounded-xl text-[13px] border"
                      style={{ borderColor: "#E2E8E2", color: "#4A5568", fontWeight: 600 }}
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block mb-1.5 text-[12px]" style={{ color: "#374151", fontWeight: 600 }}>Full Name *</label>
                      <input
                        type="text"
                        value={inviteForm.name}
                        onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="John Smith"
                        className="w-full h-11 px-4 rounded-xl border text-[13px] focus:outline-none"
                        style={{ borderColor: "#E2E8E2" }}
                        onFocus={(e) => { e.target.style.borderColor = "#1D4ED8"; e.target.style.boxShadow = "0 0 0 3px rgba(29,78,216,0.12)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "#E2E8E2"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5 text-[12px]" style={{ color: "#374151", fontWeight: 600 }}>Email Address *</label>
                      <input
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="john@company.com"
                        className="w-full h-11 px-4 rounded-xl border text-[13px] focus:outline-none"
                        style={{ borderColor: "#E2E8E2" }}
                        onFocus={(e) => { e.target.style.borderColor = "#1D4ED8"; e.target.style.boxShadow = "0 0 0 3px rgba(29,78,216,0.12)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "#E2E8E2"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5 text-[12px]" style={{ color: "#374151", fontWeight: 600 }}>Role *</label>
                      <select
                        value={inviteForm.role}
                        onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl border text-[13px] bg-white focus:outline-none"
                        style={{ borderColor: "#E2E8E2", color: "#0A0A0A" }}
                      >
                        {ORG_ROLES.filter((r) => inviteTargetRoles.includes(r.value)).map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1.5 text-[12px]" style={{ color: "#374151", fontWeight: 600 }}>Site</label>
                      <select
                        value={inviteSiteId}
                        onChange={(e) => {
                          setInviteSiteId(e.target.value);
                          // The chosen department may not belong to the new site.
                          setInviteForm((p) => ({ ...p, department_id: "" }));
                        }}
                        className="w-full h-11 px-4 rounded-xl border text-[13px] bg-white focus:outline-none"
                        style={{ borderColor: "#E2E8E2", color: "#0A0A0A" }}
                      >
                        <option value="">All sites</option>
                        {siteOptions.map((st) => (
                          <option key={st.id} value={String(st.id)}>{st.site_name}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px]" style={{ color: "#94A3B8" }}>
                        Narrows the department list. The site itself comes from the department.
                      </p>
                    </div>
                    <div>
                      <label className="block mb-1.5 text-[12px]" style={{ color: "#374151", fontWeight: 600 }}>Department</label>
                      <select
                        value={inviteForm.department_id}
                        onChange={(e) => setInviteForm((p) => ({ ...p, department_id: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl border text-[13px] bg-white focus:outline-none"
                        style={{ borderColor: "#E2E8E2", color: "#0A0A0A" }}
                      >
                        <option value="">Not assigned</option>
                        {deptOptions
                          .filter((d) => !inviteSiteId || String(d.site_id) === inviteSiteId)
                          .map((d) => (
                            <option key={d.id} value={String(d.id)}>{d.department_name}</option>
                          ))}
                      </select>
                      <p className="mt-1 text-[11px]" style={{ color: "#94A3B8" }}>
                        Incidents this person reports route to a supervisor in their department.
                      </p>
                    </div>
                    {inviteError && (
                      <div className="px-3 py-2 rounded-lg text-[12px]" style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                        {inviteError}
                      </div>
                    )}
                    <button
                      onClick={handleInviteSubmit}
                      disabled={inviteLoading}
                      className="w-full py-2.5 rounded-xl text-[13px] disabled:opacity-70 flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg, #0B3D91, #1D4ED8)", color: "#fff", fontWeight: 600 }}
                    >
                      {inviteLoading
                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <><UserPlus className="w-4 h-4" /> Send Invitation</>
                      }
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
