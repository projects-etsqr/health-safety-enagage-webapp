import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { InfoTooltip } from "../components/shared/InfoTooltip";
import {
  getEquipmentSummary,
  getEquipmentList,
  getEquipmentFilterOptions,
  createEquipment,
  type EquipmentSummary,
  type EquipmentRow,
  type EquipmentInput,
} from "../../services/equipment-register.service";

const EMPTY_FORM: EquipmentInput = {
  equipment_code: "",
  equipment_name: "",
  equipment_type: "",
  location_station: "",
  installation_date: "",
  pm_interval_days: null,
  last_pm_date: "",
  next_pm_due: "",
  operating_hours_ytd: null,
  last_failure_date: "",
  mtbf_hours_estimated: null,
  safety_critical_sce: false,
  status: "",
};

// ── Shared card wrapper — same pattern as VendorsPage/ActionsPage ──────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.08)] ${className}`}
      style={{ borderColor: "#D8E2F4" }}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[15px]" style={{ color: "#111827", fontWeight: 700 }}>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-6 text-center text-[12px]" style={{ color: "#9CA3AF" }}>{text}</div>
  );
}

// Shared formula/definition Info tooltip content for the Module 4 KPI cards —
// same pattern as the Dashboard and People pages' Info tooltips: shows the
// live current value alongside the definition/formula so it can never
// disagree with the number on the card itself.
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

function KpiCard({
  title, value, unit, note, tone, info,
}: {
  title: string; value: number | null; unit: string; note: string; tone: "good" | "warn" | "bad" | "neutral"; info?: React.ReactNode;
}) {
  const color = value === null ? "#9CA3AF"
    : tone === "good" ? "#166534" : tone === "warn" ? "#B45309" : tone === "bad" ? "#B91C1C" : "#111827";
  return (
    <Card>
      <div className="mb-3 flex items-center gap-1.5 text-[15px]" style={{ color: "#111827", fontWeight: 700 }}>
        {title}
        {info && (
          <InfoTooltip label={`${title} — how this is calculated`}>
            {info}
          </InfoTooltip>
        )}
      </div>
      <div className="text-[40px] leading-none" style={{ color, fontWeight: 700 }}>
        {value === null ? "N/A" : `${value}${unit}`}
      </div>
      <p className="mt-2 text-[11px] leading-snug" style={{ color: "#9CA3AF" }}>{note}</p>
    </Card>
  );
}

function StatusPill({ text, tone }: { text: string; tone: "green" | "amber" | "red" | "slate" }) {
  const map = {
    green: { bg: "#DCFCE7", color: "#166534" },
    amber: { bg: "#FEF3C7", color: "#B45309" },
    red: { bg: "#FEE2E2", color: "#B91C1C" },
    slate: { bg: "#F1F5F9", color: "#64748B" },
  }[tone];
  return (
    <span className="text-[10px] px-2.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: map.bg, color: map.color, fontWeight: 700 }}>
      {text}
    </span>
  );
}

function Skeleton({ h = "h-4" }: { h?: string }) {
  return <div className={`${h} rounded-lg animate-pulse`} style={{ background: "#F1F5F9" }} />;
}

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "slate"> = {
  "Operational": "green",
  "Under Maintenance": "amber",
};

const PAGE_SIZE = 25;

export function EquipmentCertificationPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<EquipmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [sceFilter, setSceFilter] = useState("All Equipment");
  const [currentPage, setCurrentPage] = useState(1);

  const [equipmentRows, setEquipmentRows] = useState<EquipmentRow[]>([]);
  const [equipmentTotal, setEquipmentTotal] = useState(0);
  const [equipmentTotalPages, setEquipmentTotalPages] = useState(0);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>([]);
  const [equipmentStatuses, setEquipmentStatuses] = useState<string[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<EquipmentInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refreshSummaryAndFilters = () => {
    getEquipmentSummary()
      .then(setSummary)
      .catch(() => setError("Failed to load equipment data"));
    getEquipmentFilterOptions()
      .then((opts) => {
        setEquipmentTypes(opts.types);
        setEquipmentStatuses(opts.statuses);
      })
      .catch(() => {});
  };

  useEffect(() => {
    getEquipmentSummary()
      .then(setSummary)
      .catch(() => setError("Failed to load equipment data"))
      .finally(() => setLoading(false));
    getEquipmentFilterOptions()
      .then((opts) => {
        setEquipmentTypes(opts.types);
        setEquipmentStatuses(opts.statuses);
      })
      .catch(() => {});
  }, []);

  const reloadList = () => {
    setEquipmentLoading(true);
    getEquipmentList(currentPage, PAGE_SIZE, {
      status: statusFilter,
      equipment_type: typeFilter,
      sce: sceFilter === "Safety-Critical Only" ? "Yes" : sceFilter === "Non-Critical Only" ? "No" : undefined,
      q: searchTerm || undefined,
    })
      .then((res) => {
        setEquipmentRows(res.data);
        setEquipmentTotal(res.total);
        setEquipmentTotalPages(res.totalPages);
      })
      .catch(() => {})
      .finally(() => setEquipmentLoading(false));
  };

  const handleAddEquipment = async () => {
    if (!form.equipment_code.trim() || !form.equipment_name.trim()) {
      setFormError("Equipment ID and Equipment Name are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload: EquipmentInput = {
        ...form,
        equipment_type: form.equipment_type || null,
        location_station: form.location_station || null,
        installation_date: form.installation_date || null,
        last_pm_date: form.last_pm_date || null,
        next_pm_due: form.next_pm_due || null,
        last_failure_date: form.last_failure_date || null,
        status: form.status || null,
      };
      await createEquipment(payload);
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      reloadList();
      refreshSummaryAndFilters();
    } catch {
      setFormError("Could not save equipment. Please check the fields and try again.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), searchInput ? 300 : 0);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, sceFilter]);

  useEffect(() => {
    setEquipmentLoading(true);
    getEquipmentList(currentPage, PAGE_SIZE, {
      status: statusFilter,
      equipment_type: typeFilter,
      sce: sceFilter === "Safety-Critical Only" ? "Yes" : sceFilter === "Non-Critical Only" ? "No" : undefined,
      q: searchTerm || undefined,
    })
      .then((res) => {
        setEquipmentRows(res.data);
        setEquipmentTotal(res.total);
        setEquipmentTotalPages(res.totalPages);
      })
      .catch(() => {})
      .finally(() => setEquipmentLoading(false));
  }, [currentPage, statusFilter, typeFilter, sceFilter, searchTerm]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div><Skeleton h="h-7" /><div className="mt-2"><Skeleton h="h-4" /></div></div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><Skeleton h="h-24" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2" style={{ color: "#EF4444" }} />
          <p className="text-[14px]" style={{ color: "#6B7280" }}>
            {error || "No data available"}
          </p>
        </div>
      </div>
    );
  }

  const totalEquipment = summary.total_equipment;
  const operationalCount = summary.status_counts["Operational"] ?? 0;
  const underMaintenanceCount = summary.status_counts["Under Maintenance"] ?? 0;
  const sceCount = summary.sce_count;
  const sceOverdueCount = summary.sce_overdue_count;
  const mtbfAvg = summary.mtbf_avg_hours;
  const pmCompliance = summary.pm_compliance_pct;
  const typeChartData = summary.equipment_by_type.slice(0, 8);

  const totalVisible = equipmentTotal;
  const startIndex = totalVisible === 0 ? 0 : (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalVisible);

  const hasActiveFilters =
    Boolean(searchInput.trim()) ||
    statusFilter !== "All Status" ||
    typeFilter !== "All Types" ||
    sceFilter !== "All Equipment";

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-[22px]" style={{ color: "#0A0A0A", fontWeight: 700 }}>Assets</h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>
          Welcome, {user?.name ?? "User"} — Module 4: Assets &amp; Operations, {totalEquipment} equipment item{totalEquipment !== 1 ? "s" : ""} registered
        </p>
      </div>

      {/* Module 4 KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Equipment"
          value={totalEquipment}
          unit=""
          note={`${operationalCount} operational, ${underMaintenanceCount} under maintenance`}
          tone="neutral"
          info={
            <MetricFormulaInfo
              title="Total Equipment"
              currentValue={`${totalEquipment}`}
              definition="The count of every equipment item registered in the organisation's asset register, regardless of status or type."
              note={`${operationalCount} currently Operational, ${underMaintenanceCount} Under Maintenance.`}
            />
          }
        />
        <KpiCard
          title="PM Compliance"
          value={pmCompliance}
          unit="%"
          note={summary.pm_compliance_note}
          tone={
            pmCompliance === null ? "neutral"
              : pmCompliance >= 90 ? "good"
              : pmCompliance >= 60 ? "warn" : "bad"
          }
          info={
            <MetricFormulaInfo
              title="PM Compliance"
              currentValue={pmCompliance === null ? "N/A" : `${pmCompliance}%`}
              definition="The share of equipment (with a Next PM Due date on file) that is not yet past that date."
              formula="(Equipment not past Next PM Due ÷ Equipment with a Next PM Due date) × 100"
              note={summary.pm_compliance_note}
            />
          }
        />
        <KpiCard
          title="Fleet MTBF"
          value={mtbfAvg}
          unit=" hrs"
          note="Mean time between failures, averaged across the register"
          tone={mtbfAvg === null ? "neutral" : "good"}
          info={
            <MetricFormulaInfo
              title="Fleet MTBF — Mean Time Between Failures"
              currentValue={mtbfAvg === null ? "N/A" : `${mtbfAvg} hrs`}
              definition="The average estimated operating time between failures, across all equipment that has an MTBF estimate on file. A higher number means equipment runs longer, on average, before failing."
              formula="Average of MTBF_Hours_Estimated across the register"
            />
          }
        />
        <KpiCard
          title="SCE Overdue"
          value={sceOverdueCount}
          unit={` of ${sceCount}`}
          note="Safety-critical equipment past its PM due date"
          tone={sceOverdueCount === 0 ? "good" : sceOverdueCount >= sceCount / 2 ? "bad" : "warn"}
          info={
            <MetricFormulaInfo
              title="SCE Overdue — Safety-Critical Equipment"
              currentValue={`${sceOverdueCount} of ${sceCount}`}
              definition="Of the equipment flagged Safety-Critical (SCE), how many are past their own Next PM Due date."
              formula="Count of SCE-flagged equipment where Next PM Due < today"
            />
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        {/* Equipment by Type */}
        <Card>
          <CardTitle>Equipment by Type</CardTitle>
          {typeChartData.length === 0 ? (
            <EmptyState text="No equipment registered" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={typeChartData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="type" tick={{ fill: "#111827", fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }} labelStyle={{ fontWeight: 600, color: "#111827" }} />
                <Bar dataKey="count" fill="#64748B" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="mt-2 text-[11px]" style={{ color: "#9CA3AF" }}>
            Registered equipment grouped by type, top 8 shown.
          </p>
        </Card>

        {/* Data gap summary */}
        <Card>
          <CardTitle>Data Gap Summary</CardTitle>
          <div className="space-y-2">
            <div className="rounded-xl border px-3 py-2 text-[12px]" style={{ borderColor: "#EEF2F7", background: "#FBFCFE", color: "#4B5563" }}>
              {summary.inspection_compliance_note}
            </div>
            <div className="rounded-xl border px-3 py-2 text-[12px]" style={{ borderColor: "#EEF2F7", background: "#FBFCFE", color: "#4B5563" }}>
              {summary.pm_compliance_note}
            </div>
          </div>
        </Card>
      </div>

      {/* Equipment Register */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle>Equipment Register</CardTitle>
          <button
            type="button"
            onClick={() => { setForm(EMPTY_FORM); setFormError(null); setShowAddModal(true); }}
            className="flex items-center gap-1.5 h-9 rounded-lg px-3.5 text-[13px] font-semibold text-white"
            style={{ background: "#4A57B9" }}
          >
            <Plus className="w-4 h-4" /> Add Equipment
          </button>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center mb-3">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search equipment..."
            className="h-10 w-full rounded-lg border px-4 text-[13px] outline-none"
            style={{ borderColor: "#D8E2F4", color: "#0F172A" }}
          />
          <div className="grid gap-3 grid-cols-3 flex-shrink-0">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-lg border bg-white px-3 text-[13px] outline-none" style={{ borderColor: "#D8E2F4", color: "#0F172A" }}>
              <option>All Status</option>
              {equipmentStatuses.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 rounded-lg border bg-white px-3 text-[13px] outline-none" style={{ borderColor: "#D8E2F4", color: "#0F172A" }}>
              <option>All Types</option>
              {equipmentTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={sceFilter} onChange={(e) => setSceFilter(e.target.value)} className="h-10 rounded-lg border bg-white px-3 text-[13px] outline-none" style={{ borderColor: "#D8E2F4", color: "#0F172A" }}>
              {["All Equipment", "Safety-Critical Only", "Non-Critical Only"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setStatusFilter("All Status");
                setTypeFilter("All Types");
                setSceFilter("All Equipment");
              }}
              className="h-10 rounded-lg border px-4 text-[13px] font-semibold flex-shrink-0"
              style={{ borderColor: "#D8E1F5", color: "#4A57B9", background: "#F5F7FF" }}
            >
              Clear Filters
            </button>
          )}
        </div>
        {equipmentRows.length === 0 ? (
          <EmptyState text={equipmentLoading ? "Loading…" : "No equipment found matching your filters"} />
        ) : (
          <>
            <div className="mb-2 text-[12px]" style={{ color: "#9CA3AF" }}>
              Showing {startIndex + 1}–{endIndex} of {totalVisible} equipment items
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["Equipment", "Type", "Location", "Status", "Next PM Due", "Operating Hrs YTD", "MTBF (hrs)", "SCE"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] uppercase" style={{ color: "#64748B", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {equipmentRows.map((row) => (
                    <tr key={row.id} style={{ borderTop: "1px solid #E2E8F0" }}>
                      <td className="px-3 py-2">
                        <div className="text-[11px] font-mono" style={{ color: "#9CA3AF" }}>{row.equipment_code}</div>
                        <div className="text-[13px]" style={{ color: "#0F172A", fontWeight: 600 }}>{row.equipment_name}</div>
                      </td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: "#334155" }}>{row.equipment_type ?? "—"}</td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: "#334155" }}>{row.location_station ?? "—"}</td>
                      <td className="px-3 py-2"><StatusPill text={row.status ?? "Unknown"} tone={STATUS_TONE[row.status ?? ""] ?? "slate"} /></td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: row.pm_overdue ? "#B91C1C" : "#334155", fontWeight: row.pm_overdue ? 700 : 400 }}>
                        {row.next_pm_due ?? "—"}{row.pm_overdue ? " (overdue)" : ""}
                      </td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: "#334155" }}>{row.operating_hours_ytd?.toLocaleString() ?? "—"}</td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: "#334155" }}>{row.mtbf_hours_estimated?.toLocaleString() ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.safety_critical_sce ? <StatusPill text="SCE" tone="amber" /> : <span style={{ color: "#CBD5E1" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[12px]" style={{ color: "#6B7280" }}>
                Showing {startIndex + 1}–{endIndex} of {totalVisible} equipment items
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  className="rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ color: currentPage === 1 ? "#94A3B8" : "#4A57B9", background: "#F4F7F4", border: "1px solid #E2E8F0" }}
                >
                  Previous
                </button>
                <span className="px-2 text-[13px]" style={{ color: "#475569" }}>
                  Page {equipmentTotalPages === 0 ? 0 : currentPage} of {equipmentTotalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= equipmentTotalPages}
                  onClick={() => setCurrentPage((page) => Math.min(equipmentTotalPages, page + 1))}
                  className="rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ color: currentPage >= equipmentTotalPages ? "#94A3B8" : "#4A57B9", background: "#F4F7F4", border: "1px solid #E2E8F0" }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Add Equipment Modal */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowAddModal(false)} />
          <div
            className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-[640px] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white"
            style={{ boxShadow: "0px 8px 32px rgba(0,0,0,0.16)" }}
          >
            <div className="px-8 py-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[17px]" style={{ color: "#0A0A0A", fontWeight: 700 }}>Add Equipment</h2>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg" style={{ color: "#6B7280" }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 rounded-lg px-3 py-2 text-[12px]" style={{ background: "#FEE2E2", color: "#B91C1C" }}>
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Equipment ID *">
                  <input value={form.equipment_code} onChange={(e) => setForm({ ...form, equipment_code: e.target.value })} placeholder="EQ-001" className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="Equipment Name *">
                  <input value={form.equipment_name} onChange={(e) => setForm({ ...form, equipment_name: e.target.value })} placeholder="Overhead Crane 1" className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="Equipment Type">
                  <input value={form.equipment_type ?? ""} onChange={(e) => setForm({ ...form, equipment_type: e.target.value })} placeholder="Crane" className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="Location / Station">
                  <input value={form.location_station ?? ""} onChange={(e) => setForm({ ...form, location_station: e.target.value })} placeholder="STN001" className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="Installation Date">
                  <input type="date" value={form.installation_date ?? ""} onChange={(e) => setForm({ ...form, installation_date: e.target.value })} className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="PM Interval (days)">
                  <input type="number" value={form.pm_interval_days ?? ""} onChange={(e) => setForm({ ...form, pm_interval_days: e.target.value ? Number(e.target.value) : null })} className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="Last PM Date">
                  <input type="date" value={form.last_pm_date ?? ""} onChange={(e) => setForm({ ...form, last_pm_date: e.target.value })} className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="Next PM Due">
                  <input type="date" value={form.next_pm_due ?? ""} onChange={(e) => setForm({ ...form, next_pm_due: e.target.value })} className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="Operating Hours (YTD)">
                  <input type="number" value={form.operating_hours_ytd ?? ""} onChange={(e) => setForm({ ...form, operating_hours_ytd: e.target.value ? Number(e.target.value) : null })} className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="Last Failure Date">
                  <input type="date" value={form.last_failure_date ?? ""} onChange={(e) => setForm({ ...form, last_failure_date: e.target.value })} className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="MTBF (hrs, estimated)">
                  <input type="number" step="0.1" value={form.mtbf_hours_estimated ?? ""} onChange={(e) => setForm({ ...form, mtbf_hours_estimated: e.target.value ? Number(e.target.value) : null })} className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="Status">
                  <select value={form.status ?? ""} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full h-10 px-3 rounded-lg border bg-white text-[13px]" style={{ borderColor: "#D8E2F4" }}>
                    <option value="">Select status</option>
                    <option value="Operational">Operational</option>
                    <option value="Under Maintenance">Under Maintenance</option>
                    <option value="Decommissioned">Decommissioned</option>
                  </select>
                </FormField>
                <label className="flex items-center gap-2 sm:col-span-2 text-[13px]" style={{ color: "#334155" }}>
                  <input
                    type="checkbox"
                    checked={!!form.safety_critical_sce}
                    onChange={(e) => setForm({ ...form, safety_critical_sce: e.target.checked })}
                  />
                  Safety-Critical Equipment (SCE)
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg text-[13px]" style={{ color: "#6B7280", fontWeight: 500 }}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleAddEquipment}
                  className="px-6 py-2 rounded-lg text-white text-[13px] disabled:opacity-60"
                  style={{ background: "#4A57B9", fontWeight: 600 }}
                >
                  {saving ? "Saving…" : "Add Equipment"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1.5 text-[12px]" style={{ color: "#4B5563", fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}
