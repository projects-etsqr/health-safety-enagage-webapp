import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { Activity, AlertTriangle, ClipboardCheck, Clock3, HeartPulse, ShieldAlert, Users, type LucideIcon } from "lucide-react";
import { BarChart, Bar, Cell, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getViolationsSummary, type ViolationItem, type RcaItem, type SeverityMixItem } from "../../services/analytics.service";
import axiosInstance from "../../api/axiosInstance";
import { useAuth } from "../context/AuthContext";
import { IncidentsTabBar } from "../components/audits/IncidentsTabBar";
import { EventFamilyTabBar } from "../components/audits/EventFamilyTabBar";

interface IncidentRecord {
  id: number;
  incident_type: string | null;
  severity: string | null;
  investigation_status: string | null;
  incident_date_time: string | null;
  report_date: string | null;
  source?: string | null;
}

interface IncidentsPageResponse {
  data: IncidentRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface IncidentFilterOptions {
  types: string[];
  severities: string[];
  statuses: string[];
}

const PAGE_SIZE = 25;
const SOURCE_OPTIONS = ["Mobile App", "Web App", "Data Import"];

// Windowed page list so very large datasets don't render hundreds of page buttons.
function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("…");
    result.push(p);
    prev = p;
  }
  return result;
}

function CardHeader({ icon: Icon, title }: Readonly<{ icon: LucideIcon; title: string }>) {
  return (
    <div className="mb-2 flex items-center gap-2" style={{ color: '#1F2937' }}>
      <Icon className="h-4 w-4" style={{ color: '#4A57B9' }} />
      <span className="text-[12px] tracking-[0.6px] uppercase" style={{ fontWeight: 700 }}>{title}</span>
    </div>
  );
}

function HorizontalBars({ data }: Readonly<{ data: { label: string; value: number }[] }>) {
  if (!data || data.length === 0) {
    return <p className="text-[12px] py-2 text-center" style={{ color: '#9CA3AF' }}>No data yet</p>;
  }
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.label} className="grid grid-cols-[1fr_auto] items-center gap-2">
          <div>
            <div className="text-[11px] mb-0.5 truncate" style={{ color: '#374151' }}>{item.label}</div>
            <div className="h-3 rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-[#4A57B9] to-[#6F80E8]"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-[12px]" style={{ minWidth: 20, textAlign: 'right', color: '#475569' }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// Period toggle for a trend chart — picking a longer window doesn't refetch,
// it slices more of the same already-fetched array. The chart box stays a
// fixed size; a short window (6M) fits with no scrollbar while a long one
// (12M) renders wider than the box and scrolls left/right inside it.
function PeriodToggle<T extends number>({ options, value, onChange }: Readonly<{ options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }>) {
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

function DarkPanel({ title, icon, children, className = "" }: Readonly<{ title: string; icon: LucideIcon; children: ReactNode; className?: string }>) {
  return (
    <div
      className={`rounded-md border bg-white p-3 shadow-[0_6px_14px_rgba(15,23,42,0.08)] ${className}`}
      style={{ borderColor: '#DDE5F4' }}
    >
      <CardHeader icon={icon} title={title} />
      {children}
    </div>
  );
}

export function ViolationsPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [incidentTypeData, setIncidentTypeData] = useState<ViolationItem[]>([]);
  const [investigationStatusData, setInvestigationStatusData] = useState<RcaItem[]>([]);
  const [locationData, setLocationData] = useState<ViolationItem[]>([]);
  const [incidentTrend, setIncidentTrend] = useState<{ month: string; value: number }[]>([]);
  const [downtimeData, setDowntimeData] = useState<ViolationItem[]>([]);
  const [monthlyNearMiss, setMonthlyNearMiss] = useState<{ month: string; value: number }[]>([]);
  const [nearMissPeriod, setNearMissPeriod] = useState<6 | 12>(12);
  const slicedNearMiss = monthlyNearMiss.slice(-nearMissPeriod);
  const [incidentTrendPeriod, setIncidentTrendPeriod] = useState<6 | 12>(12);
  const slicedIncidentTrend = incidentTrend.slice(-incidentTrendPeriod);
  const [severityMix, setSeverityMix] = useState<SeverityMixItem[]>([]);
  const [severityMixPeriod, setSeverityMixPeriod] = useState<6 | 12>(12);
  const slicedSeverityMix = severityMix.slice(-severityMixPeriod);
  const [rcaData, setRcaData] = useState<RcaItem[]>([]);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [injuryCategoryData, setInjuryCategoryData] = useState<ViolationItem[]>([]);
  const [personInvolvedData, setPersonInvolvedData] = useState<ViolationItem[]>([]);
  const [injuryTypeData, setInjuryTypeData] = useState<ViolationItem[]>([]);
  const [learnings, setLearnings] = useState<string[]>([]);

  const [allIncidents, setAllIncidents] = useState<IncidentRecord[]>([]);
  const [incidentsTotal, setIncidentsTotal] = useState(0);
  const [incidentsTotalPages, setIncidentsTotalPages] = useState(0);
  const [incidentsPage, setIncidentsPage] = useState(1);
  const [incidentsLoading, setIncidentsLoading] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [severityFilter, setSeverityFilter] = useState("All Severities");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [sourceFilter, setSourceFilter] = useState("All Sources");
  const [filterOptions, setFilterOptions] = useState<IncidentFilterOptions>({ types: [], severities: [], statuses: [] });

  useEffect(() => {
    axiosInstance.get<IncidentFilterOptions>('/incidents/filter-options')
      .then((r) => setFilterOptions(r.data))
      .catch(() => {});
  }, []);

  // Debounce free-text search before it hits the server.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), searchInput ? 300 : 0);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setIncidentsPage(1);
  }, [searchTerm, typeFilter, severityFilter, statusFilter, sourceFilter]);

  useEffect(() => {
    setIncidentsLoading(true);
    axiosInstance
      .get<IncidentsPageResponse>('/incidents/all', {
        params: {
          page: incidentsPage,
          pageSize: PAGE_SIZE,
          incident_type: typeFilter === "All Types" ? undefined : typeFilter,
          severity: severityFilter === "All Severities" ? undefined : severityFilter,
          status: statusFilter === "All Status" ? undefined : statusFilter,
          source: sourceFilter === "All Sources" ? undefined : sourceFilter,
          q: searchTerm || undefined,
        },
      })
      .then((r) => {
        setAllIncidents(r.data.data);
        setIncidentsTotal(r.data.total);
        setIncidentsTotalPages(r.data.totalPages);
      })
      .catch(console.error)
      .finally(() => setIncidentsLoading(false));
  }, [incidentsPage, typeFilter, severityFilter, statusFilter, sourceFilter, searchTerm]);

  const hasActiveIncidentFilters =
    Boolean(searchInput.trim()) ||
    typeFilter !== "All Types" ||
    severityFilter !== "All Severities" ||
    statusFilter !== "All Status" ||
    sourceFilter !== "All Sources";

  function clearIncidentFilters() {
    setSearchInput("");
    setTypeFilter("All Types");
    setSeverityFilter("All Severities");
    setStatusFilter("All Status");
    setSourceFilter("All Sources");
  }

  useEffect(() => {
    getViolationsSummary(12).then((data) => {
      setIncidentTypeData(data.by_type);
      setInvestigationStatusData(data.investigation_status ?? []);
      setLocationData(data.by_location);
      setIncidentTrend(data.monthly_trend);
      setDowntimeData(data.downtime_by_type);
      setMonthlyNearMiss(data.near_miss_monthly);
      setSeverityMix(data.severity_mix);
      setRcaData(data.by_root_cause);
      setActionItems(data.open_capa_items);
      setInjuryCategoryData(data.injury_category ?? []);
      setPersonInvolvedData(data.person_involved ?? []);
      setInjuryTypeData(data.injury_type ?? []);
      setLearnings(data.key_learnings ?? []);
    }).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <EventFamilyTabBar />
      <IncidentsTabBar />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Welcome, {currentUser?.name || currentUser?.email || "User"}</h1>
        {/* The client's ask: register an incident from the web, through the
            same workflow the mobile app uses, not a separate form. */}
        <button
          onClick={() => navigate("/violations/register")}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] text-white transition-colors"
          style={{ background: "#4A57B9", fontWeight: 600 }}
        >
          + Register Incident
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#E5E7EB' }}>
          <div className="mb-3 text-[clamp(1rem,1.6vw,1.125rem)]" style={{ color: '#111827', fontWeight: 700 }}>Incidents</div>

          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <DarkPanel title="Incident Types" icon={AlertTriangle}>
                <HorizontalBars data={incidentTypeData} />
              </DarkPanel>
              <DarkPanel title="Injury Category" icon={Users}>
                <HorizontalBars data={injuryCategoryData} />
              </DarkPanel>
              <DarkPanel title="Investigation Status" icon={ClipboardCheck}>
                <ResponsiveContainer width="100%" height={185}>
                  <PieChart>
                    <Pie
                      data={investigationStatusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={32}
                      outerRadius={50}
                      paddingAngle={2}
                      cx="50%"
                      cy="38%"
                    >
                      {investigationStatusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                    <Legend
                      iconSize={7}
                      iconType="circle"
                      formatter={(value: string) =>
                        value.length > 18 ? value.slice(0, 18) + '…' : value
                      }
                      wrapperStyle={{ fontSize: 10, lineHeight: '18px', paddingTop: 6 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </DarkPanel>
              <DarkPanel title="Reported By (Employment Type)" icon={Users}>
                <HorizontalBars data={personInvolvedData} />
              </DarkPanel>
              <DarkPanel title="Incident Location" icon={ShieldAlert}>
                <HorizontalBars data={locationData} />
              </DarkPanel>
              <DarkPanel title="Type of Injury" icon={HeartPulse}>
                <HorizontalBars data={injuryTypeData} />
              </DarkPanel>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="rounded-md bg-white p-3 shadow-[0_6px_14px_rgba(15,23,42,0.08)]" style={{ border: '1px solid #DDE5F4' }}>
              <div className="flex items-center justify-between gap-3">
                <CardHeader icon={Activity} title="Incident Trend" />
                <PeriodToggle
                  options={[{ value: 6, label: "6M" }, { value: 12, label: "12M" }]}
                  value={incidentTrendPeriod}
                  onChange={setIncidentTrendPeriod}
                />
              </div>
              <div className="mb-1 text-[11px]" style={{ color: '#9CA3AF' }}>
                {slicedIncidentTrend.length > 0 ? `Monthly · last ${slicedIncidentTrend.length} months (${slicedIncidentTrend[0].month} – ${slicedIncidentTrend[slicedIncidentTrend.length - 1].month})` : ""}
              </div>
              <div className="h-[145px] overflow-x-auto">
                <div className="h-full" style={{ minWidth: slicedIncidentTrend.length * 55 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={slicedIncidentTrend} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <YAxis width={28} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#4A57B9" strokeWidth={2.5} dot={{ r: 2.5, fill: '#6F80E8' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="rounded-md bg-white p-3 shadow-[0_6px_14px_rgba(15,23,42,0.08)]" style={{ border: '1px solid #DDE5F4' }}>
              <CardHeader icon={Clock3} title="Downtime" />
              <ResponsiveContainer width="100%" height={145}>
                <BarChart data={downtimeData} margin={{ top: 6, right: 12, bottom: 20, left: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis width={28} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {downtimeData.map((entry, index) => (
                      <Cell key={entry.label || index} fill={index % 2 === 0 ? '#4A57B9' : '#6F80E8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#DDE5F4' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[clamp(1rem,1.6vw,1.125rem)]" style={{ color: '#111827', fontWeight: 700 }}>Near Miss Trend</div>
              <PeriodToggle
                options={[{ value: 6, label: "6M" }, { value: 12, label: "12M" }]}
                value={nearMissPeriod}
                onChange={setNearMissPeriod}
              />
            </div>
            <div className="mt-1 text-[11px]" style={{ color: '#9CA3AF' }}>
              {slicedNearMiss.length > 0 ? `Monthly · last ${slicedNearMiss.length} months (${slicedNearMiss[0].month} – ${slicedNearMiss[slicedNearMiss.length - 1].month})` : ""}
            </div>
            <div className="mt-2 h-[160px] overflow-x-auto">
              <div className="h-full" style={{ minWidth: slicedNearMiss.length * 55 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={slicedNearMiss} margin={{ top: 6, right: 8, bottom: 10, left: 0 }}>
                    <CartesianGrid stroke="#E5E7EB" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: '#6B7280' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-40}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis width={24} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#4A57B9" strokeWidth={3} dot={{ r: 3, fill: '#6F80E8' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#DDE5F4' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[clamp(1rem,1.6vw,1.125rem)]" style={{ color: '#111827', fontWeight: 700 }}>Incident Severity Mix</div>
              <PeriodToggle
                options={[{ value: 6, label: "6M" }, { value: 12, label: "12M" }]}
                value={severityMixPeriod}
                onChange={setSeverityMixPeriod}
              />
            </div>
            <div className="mt-1 text-[11px]" style={{ color: '#9CA3AF' }}>
              {slicedSeverityMix.length > 0 ? `Monthly · last ${slicedSeverityMix.length} months (${slicedSeverityMix[0].label} – ${slicedSeverityMix[slicedSeverityMix.length - 1].label})` : ""}
            </div>
            <div className="mt-2 h-[175px] overflow-x-auto">
              <div className="h-full" style={{ minWidth: slicedSeverityMix.length * 55 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={slicedSeverityMix} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <YAxis width={24} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                    <Tooltip />
                    <Bar dataKey="low" stackId="a" fill="#6F80E8" name="Low" />
                    <Bar dataKey="medium" stackId="a" fill="#4A57B9" name="Medium" />
                    <Bar dataKey="high" stackId="a" fill="#38BDF8" name="High" />
                    <Bar dataKey="critical" stackId="a" fill="#0F766E" name="Critical" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 justify-center">
              {[['#6F80E8','Low'],['#4A57B9','Med'],['#38BDF8','High'],['#0F766E','Critical']].map(([color, label]) => (
                <div key={label} className="flex items-center gap-1 text-[10px]" style={{ color: '#6B7280' }}>
                  <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#DDE5F4' }}>
            <div className="mb-2 text-[clamp(1rem,1.6vw,1.125rem)]" style={{ color: '#111827', fontWeight: 700 }}>RCA Breakdown</div>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={rcaData} dataKey="value" nameKey="name" outerRadius={60} innerRadius={0} cx="50%" cy="50%">
                  {rcaData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
              {rcaData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-[11px]" style={{ color: '#374151' }}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} />
                  <span className="truncate max-w-[80px]" title={entry.name}>{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.9fr]">
        <div className="rounded-2xl bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ border: '1px solid #DDE5F4' }}>
          <div className="mb-3 text-[clamp(1rem,1.6vw,1.125rem)]" style={{ color: '#111827', fontWeight: 700 }}>Key Learnings</div>
          {learnings.length === 0 ? (
            <p className="text-[13px] py-2" style={{ color: '#9CA3AF' }}>No incident records to derive learnings from yet</p>
          ) : (
            <ul className="space-y-2 text-[14px]" style={{ color: '#4B5563' }}>
              {learnings.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ border: '1px solid #DDE5F4' }}>
          <div className="mb-3 text-[clamp(1rem,1.6vw,1.125rem)]" style={{ color: '#111827', fontWeight: 700 }}>Open Actions</div>
          {actionItems.length === 0 ? (
            <p className="text-[13px] py-2" style={{ color: '#9CA3AF' }}>No open CAPA actions</p>
          ) : (
            <div className="space-y-2 text-[14px]" style={{ color: '#374151' }}>
              {actionItems.map((item) => (
                <label key={item} className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded accent-[#4A57B9]" />
                  <span className="flex-1">{item}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ border: '1px solid #DDE5F4' }}>
        <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="text-[clamp(1rem,1.6vw,1.125rem)]" style={{ color: '#111827', fontWeight: 700 }}>
            All Incidents — {incidentsTotal}
          </div>
        </div>

        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search incidents…"
              className="h-9 w-full sm:w-56 rounded-lg border px-3 text-[13px] outline-none"
              style={{ borderColor: '#DBE7FF', color: '#0F172A' }}
            />
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 rounded-lg border bg-white px-2 text-[12px] outline-none" style={{ borderColor: '#DBE7FF', color: '#0F172A' }}>
                <option>All Types</option>
                {filterOptions.types.map((t) => <option key={t}>{t}</option>)}
              </select>
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="h-9 rounded-lg border bg-white px-2 text-[12px] outline-none" style={{ borderColor: '#DBE7FF', color: '#0F172A' }}>
                <option>All Severities</option>
                {filterOptions.severities.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-lg border bg-white px-2 text-[12px] outline-none" style={{ borderColor: '#DBE7FF', color: '#0F172A' }}>
                <option>All Status</option>
                {filterOptions.statuses.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-9 rounded-lg border bg-white px-2 text-[12px] outline-none" style={{ borderColor: '#DBE7FF', color: '#0F172A' }}>
                <option>All Sources</option>
                {SOURCE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {hasActiveIncidentFilters && (
            <button
              type="button"
              onClick={clearIncidentFilters}
              className="h-9 shrink-0 rounded-lg border px-3 text-[12px] font-semibold"
              style={{ borderColor: '#D8E1F5', color: '#4A57B9', background: '#F5F7FF' }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {(() => {
          if (incidentsLoading && allIncidents.length === 0) {
            return <p className="text-[13px] py-2" style={{ color: '#9CA3AF' }}>Loading incidents…</p>;
          }
          if (allIncidents.length === 0) {
            return (
              <p className="text-[13px] py-2" style={{ color: '#9CA3AF' }}>
                {hasActiveIncidentFilters ? 'No incidents found matching your filters.' : 'No incidents recorded yet'}
              </p>
            );
          }
          const rangeStart = (incidentsPage - 1) * PAGE_SIZE + 1;
          const rangeEnd = Math.min(incidentsPage * PAGE_SIZE, incidentsTotal);
          return (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {["Incident ID", "Type", "Severity", "Status", "Source", "Date"].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[11px] uppercase" style={{ color: '#64748B', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allIncidents.map(inc => (
                      <tr
                        key={inc.id}
                        className="cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                        style={{ borderTop: '1px solid #E2E8F0' }}
                        onClick={() => navigate(`/violations/${inc.id}`)}
                      >
                        <td className="px-3 py-2 text-[13px]" style={{ color: '#4A57B9', fontWeight: 600 }}>INC-{String(inc.id).padStart(5, '0')}</td>
                        <td className="px-3 py-2 text-[13px]" style={{ color: '#334155' }}>{inc.incident_type || '—'}</td>
                        <td className="px-3 py-2 text-[13px]" style={{ color: '#334155' }}>{inc.severity || '—'}</td>
                        <td className="px-3 py-2 text-[13px]" style={{ color: '#334155' }}>{inc.investigation_status || 'Pending'}</td>
                        <td className="px-3 py-2 text-[13px]">
                          {inc.source === 'Mobile App' ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                              📱 Mobile
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-100">
                              💻 Web
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[13px]" style={{ color: '#64748B' }}>
                          {inc.incident_date_time ? new Date(inc.incident_date_time).toLocaleDateString() : (inc.report_date || '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
                <span className="text-[12px]" style={{ color: '#64748B' }}>
                  Showing {rangeStart}–{rangeEnd} of {incidentsTotal} incidents
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    disabled={incidentsPage <= 1}
                    onClick={() => setIncidentsPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-md text-[12px] border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                    style={{ color: '#374151', borderColor: '#E2E8F0' }}
                  >
                    ← Previous
                  </button>
                  {getPageNumbers(incidentsPage, incidentsTotalPages).map((p, idx) =>
                    p === "…" ? (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-[12px]" style={{ color: '#94A3B8' }}>…</span>
                    ) : (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setIncidentsPage(p)}
                        className="min-w-[28px] px-2 py-1 rounded-md text-[12px] border"
                        style={
                          p === incidentsPage
                            ? { background: '#4A57B9', borderColor: '#4A57B9', color: '#fff', fontWeight: 600 }
                            : { color: '#374151', borderColor: '#E2E8F0' }
                        }
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    disabled={incidentsPage >= incidentsTotalPages}
                    onClick={() => setIncidentsPage((p) => Math.min(incidentsTotalPages, p + 1))}
                    className="px-2.5 py-1 rounded-md text-[12px] border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                    style={{ color: '#374151', borderColor: '#E2E8F0' }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => navigate('/near-miss')}
          className="rounded-full px-6 py-3 text-[16px] md:text-[17px] text-white shadow-[0_8px_18px_rgba(81,96,186,0.34)] transition-transform hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg, rgb(74, 87, 185) 0%, rgb(111, 128, 232) 100%)', fontWeight: 600 }}
        >
          Near Miss Reporting
        </button>
      </div>
    </div>
  );
}
