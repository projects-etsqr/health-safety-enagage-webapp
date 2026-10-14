import { useState, useEffect } from "react";
import { AlertTriangle, Clock3, FileText, ShieldAlert } from "lucide-react";
import { Bar, BarChart, Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  getPermitsSummary,
  getAllPermits,
  getPermitFilterOptions,
  type PermitViolation,
  type ActiveWorkRow,
  type ExpiryTimelineBar,
  type WorkByType,
} from "../../services/analytics.service";
import { useAuth } from "../context/AuthContext";
import { InfoTooltip } from "../components/shared/InfoTooltip";

const PERMIT_LIST_PAGE_SIZE = 25;

function permitStatusTone(status: string) {
  if (status === "Active") return { bg: "#DCFCE7", color: "#166534", border: "#BBF7D0" };
  if (status === "Expiring Soon") return { bg: "#FEF3C7", color: "#B45309", border: "#FCD34D" };
  if (status === "Suspended") return { bg: "#FEF2F2", color: "#C2410C", border: "#FECACA" };
  if (status === "Expired") return { bg: "#FEE2E2", color: "#B91C1C", border: "#FECACA" };
  return { bg: "#F3F4F6", color: "#4B5563", border: "#E5E7EB" };
}

// Shared formula/definition Info tooltip content for this page's KPI boxes —
// same pattern as the Dashboard, Equipment, Vendors, Compliance and Risk
// pages' Info tooltips: shows the live current value alongside the
// definition/formula so it can never disagree with the number on the card.
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

function KpiBox({ title, value, subtitle, delta, valueColor = "#0F172A", info }: Readonly<{ title: string; value: string; subtitle: string; delta: string; valueColor?: string; info?: React.ReactNode }>) {
  const deltaColor = delta.includes("↓") ? "#B45309" : "#0F766E";
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
      <div className="flex items-center gap-1.5 text-[28px]" style={{ color: '#111827', fontWeight: 700 }}>
        {title}
        {info && (
          <InfoTooltip label={`${title} — how this is calculated`}>
            {info}
          </InfoTooltip>
        )}
      </div>
      <div className="mt-3 flex items-end gap-3">
        <div className="text-[52px] leading-none" style={{ color: valueColor, fontWeight: 700 }}>{value}</div>
        <div className="pb-2 text-[14px]" style={{ color: deltaColor, fontWeight: 600 }}>{delta}</div>
      </div>
      <div className="mt-3 text-[13px]" style={{ color: '#4B5563' }}>{subtitle}</div>
    </div>
  );
}

export function ActionsPage() {
  const { user } = useAuth();
  const [activePermits, setActivePermits] = useState<number | null>(null);
  const [riskWorkData, setRiskWorkData] = useState<{ subject: string; A: number }[]>([]);
  const [permitViolations, setPermitViolations] = useState<PermitViolation[]>([]);
  const [activeWorkRows, setActiveWorkRows] = useState<ActiveWorkRow[]>([]);
  const [expiryTimeline, setExpiryTimeline] = useState<ExpiryTimelineBar[]>([]);
  const [workExposureHours, setWorkExposureHours] = useState<number | null>(null);
  const [permitCompliancePct, setPermitCompliancePct] = useState<number | null>(null);
  const [missingControls, setMissingControls] = useState<string[]>([]);
  const [workByType, setWorkByType] = useState<WorkByType[]>([]);

  // ── Total Permit List — full paginated/searchable permit register ────────
  const [permitSearchInput, setPermitSearchInput] = useState("");
  const [permitSearchTerm, setPermitSearchTerm] = useState("");
  const [permitStatusFilter, setPermitStatusFilter] = useState("All Status");
  const [permitTypeFilter, setPermitTypeFilter] = useState("All Types");
  const [permitLocationFilter, setPermitLocationFilter] = useState("All Locations");
  const [permitListPage, setPermitListPage] = useState(1);
  const [permitListRows, setPermitListRows] = useState<ActiveWorkRow[]>([]);
  const [permitListTotal, setPermitListTotal] = useState(0);
  const [permitListTotalPages, setPermitListTotalPages] = useState(0);
  const [permitListLoading, setPermitListLoading] = useState(false);
  const [permitTypeOptions, setPermitTypeOptions] = useState<string[]>([]);
  const [permitLocationOptions, setPermitLocationOptions] = useState<string[]>([]);

  useEffect(() => {
    getPermitFilterOptions()
      .then((opts) => {
        setPermitTypeOptions(opts.types);
        setPermitLocationOptions(opts.locations);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setPermitSearchTerm(permitSearchInput.trim()), permitSearchInput ? 300 : 0);
    return () => clearTimeout(t);
  }, [permitSearchInput]);

  useEffect(() => {
    setPermitListPage(1);
  }, [permitSearchTerm, permitStatusFilter, permitTypeFilter, permitLocationFilter]);

  useEffect(() => {
    setPermitListLoading(true);
    getAllPermits(permitListPage, PERMIT_LIST_PAGE_SIZE, {
      status: permitStatusFilter,
      permit_type: permitTypeFilter,
      location: permitLocationFilter,
      q: permitSearchTerm || undefined,
    })
      .then((res) => {
        setPermitListRows(res.data);
        setPermitListTotal(res.total);
        setPermitListTotalPages(res.totalPages);
      })
      .catch(() => {})
      .finally(() => setPermitListLoading(false));
  }, [permitListPage, permitStatusFilter, permitTypeFilter, permitLocationFilter, permitSearchTerm]);

  useEffect(() => {
    getPermitsSummary().then((data) => {
      setActivePermits(data.active_permits);
      setRiskWorkData(data.risk_work_data);
      setPermitViolations(data.permit_violations);
      setActiveWorkRows(data.active_work_rows);
      setExpiryTimeline(data.expiry_timeline);
      setWorkExposureHours(data.work_exposure_hours);
      setPermitCompliancePct(data.permit_compliance_pct);
      setMissingControls(data.missing_controls);
      setWorkByType(data.work_by_type);
    }).catch(console.error);
  }, []);

  const permitListStart = permitListTotal === 0 ? 0 : (permitListPage - 1) * PERMIT_LIST_PAGE_SIZE;
  const permitListEnd = Math.min(permitListStart + PERMIT_LIST_PAGE_SIZE, permitListTotal);
  const hasActivePermitFilters =
    Boolean(permitSearchInput.trim()) ||
    permitStatusFilter !== "All Status" ||
    permitTypeFilter !== "All Types" ||
    permitLocationFilter !== "All Locations";

  return (
    <div className="space-y-5">
      <div>
        <h1>Welcome, {user?.name || "User"}</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <KpiBox
          title="Active Permits"
          value={activePermits !== null ? String(activePermits) : "—"}
          delta=""
          subtitle="Permits Currently in Progress"
          valueColor="#0F766E"
          info={
            <MetricFormulaInfo
              title="Active Permits"
              currentValue={activePermits !== null ? String(activePermits) : "—"}
              definition="The count of Permits to Work (PTW) whose status is currently Active — work in progress right now, org-wide."
              formula={'Count of Permits to Work where status = "Active"'}
            />
          }
        />
        <KpiBox
          title="Work Exposure Hours"
          value={workExposureHours !== null ? workExposureHours.toLocaleString() : "—"}
          delta=""
          subtitle="Total Hours Across Active Permits"
          valueColor="#A16207"
          info={
            <MetricFormulaInfo
              title="Work Exposure Hours"
              currentValue={workExposureHours !== null ? workExposureHours.toLocaleString() : "—"}
              definition="The total worker-hours of exposure represented by every currently Active permit — each permit's requested duration multiplied by how many workers it covers, summed across all active permits."
              formula="Σ (Duration Requested (hrs) × Number of Workers), across Active permits"
            />
          }
        />
        <KpiBox
          title="Permit Compliance %"
          value={permitCompliancePct !== null ? `${permitCompliancePct}%` : "—"}
          delta=""
          subtitle="No Deviation or Incident Reported"
          valueColor="#39498F"
          info={
            <MetricFormulaInfo
              title="Permit Compliance %"
              currentValue={permitCompliancePct !== null ? `${permitCompliancePct}%` : "—"}
              definition="The share of every permit ever issued that has been formally Closed out. Same PTW Compliance Rate shown on the Compliance page."
              formula="(Closed Permits ÷ Total Permits) × 100"
            />
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-1 text-[24px]" style={{ color: '#111827', fontWeight: 700 }}>High Risk Work</div>
          <div className="mb-2 text-[11px]" style={{ color: '#9CA3AF' }}>
            Active permits weighted by permit-type risk level (Critical/High/Medium/Low)
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={riskWorkData}>
              <PolarGrid stroke="#D1D5DB" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#111827', fontSize: 13 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Risk" dataKey="A" fill="#6B7FC9" fillOpacity={0.45} stroke="#5C6FB6" strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
            <div className="mb-2 text-[24px]" style={{ color: '#111827', fontWeight: 700 }}>Work by Permit Type</div>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={workByType} layout="vertical" barSize={22}>
                <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#111827', fontSize: 12 }} axisLine={false} tickLine={false} width={88} />
                <Tooltip />
                <Bar dataKey="active" stackId="a" fill="#415A98" />
                <Bar dataKey="closed" stackId="a" fill="#63B5D1" />
                <Bar dataKey="expired" stackId="a" fill="#9FD5E7" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#E7A7A7', background: '#FFF5F5' }}>
              <div className="mb-2 flex items-center gap-2 text-[24px]" style={{ color: '#111827', fontWeight: 700 }}>
                Permit Violations <AlertTriangle className="h-5 w-5" style={{ color: '#B91C1C' }} />
              </div>
              <div className="space-y-2">
                {permitViolations.map((item) => (
                  <div key={item.text} className="flex items-center justify-between text-[13px]" style={{ color: '#7F1D1D' }}>
                    <span>{item.text}</span>
                    <span style={{ fontWeight: 700 }}>{item.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4', background: '#FFFDF8' }}>
              <div className="mb-2 flex items-center gap-2 text-[24px]" style={{ color: '#111827', fontWeight: 700 }}>
                Missing Work Controls
              </div>
              <div className="space-y-2 text-[13px]" style={{ color: '#78350F' }}>
                {missingControls.length === 0 ? (
                  <p style={{ color: '#9CA3AF' }}>No active permits with reported deviations.</p>
                ) : missingControls.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-3 text-[24px]" style={{ color: '#111827', fontWeight: 700 }}>Active Work Table</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {["Permit ID", "Work Type", "Issued By", "Location", "Status", "Expiry"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[12px] uppercase" style={{ color: '#64748B', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeWorkRows.map((row) => (
                  <tr key={row.id + row.type} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td className="px-3 py-2 text-[13px]" style={{ color: '#0F172A', fontWeight: 600 }}>{row.id}</td>
                    <td className="px-3 py-2 text-[13px]" style={{ color: '#334155' }}>{row.type}</td>
                    <td className="px-3 py-2 text-[13px]" style={{ color: '#334155' }}>{row.issued_by}</td>
                    <td className="px-3 py-2 text-[13px]" style={{ color: '#334155' }}>{row.location}</td>
                    <td className="px-3 py-2 text-[12px]"><span className="rounded-full px-2 py-0.5" style={{ background: '#DCFCE7', color: '#166534', fontWeight: 700 }}>{row.status}</span></td>
                    <td className="px-3 py-2 text-[13px]" style={{ color: '#334155' }}>{row.expiry}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-1 text-[24px]" style={{ color: '#111827', fontWeight: 700 }}>Permit Expiry Timeline</div>
          <div className="mb-3 flex items-center gap-4 text-[11px]" style={{ color: '#475569' }}>
            <span>Now</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded" style={{ background: '#D64545' }} />1h</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded" style={{ background: '#E8B441' }} />Warning 4h</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded" style={{ background: '#42A5C6' }} />Safe 4h</span>
            <span>Next 8 Hours</span>
          </div>
          <div className="space-y-3">
            {expiryTimeline.map((bar) => (
              <div key={bar.label}>
                <div className="mb-1 text-[11px]" style={{ color: '#64748B' }}>{bar.label}</div>
                <div className="relative h-5 rounded" style={{ background: '#F1F5F9' }}>
                  <div
                    className="absolute top-0 h-5 rounded px-2 text-[10px] leading-5 text-white"
                    style={{ left: `${bar.left}%`, width: `${bar.width}%`, background: bar.color, fontWeight: 700 }}
                  >
                    {bar.rightText}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[14px] text-white" style={{ background: 'linear-gradient(135deg, #606AB9 0%, #7A80D1 100%)', fontWeight: 600 }}>
              <Clock3 className="h-4 w-4" />
              Near Miss Reporting
            </button>
          </div>
        </div>
      </div>

      {/* Total Permit List — full paginated/searchable permit register, same
      data and component pattern as EquipmentCertificationPage's table */}
      <div className="rounded-2xl border bg-white shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
        <div className="p-4 pb-0">
          <div className="flex items-center gap-2 text-[24px]" style={{ color: '#111827', fontWeight: 700 }}>
            <FileText className="h-5 w-5" style={{ color: '#415A98' }} />
            Total Permit List
          </div>
        </div>
        <div className="border-b px-4 py-3 mt-3" style={{ borderColor: '#EEF2F7' }}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <input
                value={permitSearchInput}
                onChange={(e) => setPermitSearchInput(e.target.value)}
                placeholder="Search permits..."
                className="h-10 w-full rounded-lg border px-4 text-[13px] outline-none"
                style={{ borderColor: "#DBE7FF", color: "#0F172A" }}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <select value={permitStatusFilter} onChange={(e) => setPermitStatusFilter(e.target.value)} className="h-10 rounded-lg border bg-white px-3 text-[13px] outline-none" style={{ borderColor: "#DBE7FF", color: "#0F172A" }}>
                  {["All Status", "Active", "Expired", "Expiring Soon", "Suspended", "Closed"].map((item) => <option key={item}>{item}</option>)}
                </select>
                <select value={permitTypeFilter} onChange={(e) => setPermitTypeFilter(e.target.value)} className="h-10 rounded-lg border bg-white px-3 text-[13px] outline-none" style={{ borderColor: "#DBE7FF", color: "#0F172A" }}>
                  <option>All Types</option>
                  {permitTypeOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
                <select value={permitLocationFilter} onChange={(e) => setPermitLocationFilter(e.target.value)} className="h-10 rounded-lg border bg-white px-3 text-[13px] outline-none" style={{ borderColor: "#DBE7FF", color: "#0F172A" }}>
                  <option>All Locations</option>
                  {permitLocationOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>
            {hasActivePermitFilters && (
              <button
                type="button"
                onClick={() => {
                  setPermitSearchInput("");
                  setPermitStatusFilter("All Status");
                  setPermitTypeFilter("All Types");
                  setPermitLocationFilter("All Locations");
                }}
                className="h-10 rounded-lg border px-4 text-[13px] font-semibold"
                style={{ borderColor: "#D8E1F5", color: "#4A57B9", background: "#F5F7FF" }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
        <div className="px-4 py-3 text-[12px]" style={{ color: "#6B7280" }}>
          {permitListLoading
            ? "Loading…"
            : permitListTotal === 0
              ? "No permits found matching your filters."
              : `Showing ${permitListStart + 1}–${permitListEnd} of ${permitListTotal} permits`}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {["Permit", "Type", "Issued By", "Location", "Status", "Expiry"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[11px] uppercase" style={{ color: '#64748B', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permitListRows.map((row) => {
                const tone = permitStatusTone(row.status);
                return (
                  <tr key={row.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td className="px-3 py-2 font-mono text-[12px]" style={{ color: '#334155' }}>{row.id}</td>
                    <td className="px-3 py-2 text-[13px]" style={{ color: '#334155' }}>{row.type}</td>
                    <td className="px-3 py-2 text-[13px]" style={{ color: '#334155' }}>{row.issued_by}</td>
                    <td className="px-3 py-2 text-[13px]" style={{ color: '#334155' }}>{row.location}</td>
                    <td className="px-3 py-2 text-[12px]">
                      <span className="rounded-full px-2 py-0.5" style={{ background: tone.bg, color: tone.color, fontWeight: 700 }}>{row.status}</span>
                    </td>
                    <td className="px-3 py-2 text-[13px]" style={{ color: '#334155' }}>{row.expiry}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: '#EEF2F7' }}>
          <div className="text-[12px]" style={{ color: "#6B7280" }}>
            {permitListTotal === 0 ? "No permits found matching your filters." : `Showing ${permitListStart + 1}–${permitListEnd} of ${permitListTotal} permits`}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={permitListPage === 1}
              onClick={() => setPermitListPage((page) => Math.max(1, page - 1))}
              className="rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: permitListPage === 1 ? "#94A3B8" : "#4A57B9", background: "#F4F7F4", border: "1px solid #E2E8F0" }}
            >
              Previous
            </button>
            <span className="px-2 text-[13px]" style={{ color: "#475569" }}>
              Page {permitListTotalPages === 0 ? 0 : permitListPage} of {permitListTotalPages}
            </span>
            <button
              type="button"
              disabled={permitListPage >= permitListTotalPages}
              onClick={() => setPermitListPage((page) => Math.min(permitListTotalPages, page + 1))}
              className="rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: permitListPage >= permitListTotalPages ? "#94A3B8" : "#4A57B9", background: "#F4F7F4", border: "1px solid #E2E8F0" }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
