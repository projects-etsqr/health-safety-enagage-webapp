import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getSafetyWalkSummary,
  getSafetyWalkRegister,
  getSafetyWalkFilterOptions,
  type SafetyWalkSummary,
  type SafetyWalkRow,
} from "../../services/safety-walk.service";

// ── Shared card wrapper — same pattern as the Assets/Equipment register page ───
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

function KpiCard({
  title, value, unit, note, tone,
}: {
  title: string; value: number | null; unit: string; note: string; tone: "good" | "warn" | "bad" | "neutral";
}) {
  const color = value === null ? "#9CA3AF"
    : tone === "good" ? "#166534" : tone === "warn" ? "#B45309" : tone === "bad" ? "#B91C1C" : "#111827";
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
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

const PRIORITY_TONE: Record<string, "green" | "amber" | "red" | "slate"> = {
  Critical: "red",
  High: "amber",
  Medium: "slate",
};

const PAGE_SIZE = 25;

export function SafetyWalkPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<SafetyWalkSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [currentPage, setCurrentPage] = useState(1);

  const [rows, setRows] = useState<SafetyWalkRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [types, setTypes] = useState<string[]>([]);

  useEffect(() => {
    getSafetyWalkSummary()
      .then(setSummary)
      .catch(() => setError("Failed to load safety walk data"))
      .finally(() => setLoading(false));
    getSafetyWalkFilterOptions()
      .then((opts) => setTypes(opts.types))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), searchInput ? 300 : 0);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter]);

  useEffect(() => {
    setRowsLoading(true);
    getSafetyWalkRegister(currentPage, PAGE_SIZE, {
      inspection_type: typeFilter === "All Types" ? undefined : typeFilter,
      q: searchTerm || undefined,
    })
      .then((res) => {
        setRows(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch(() => {})
      .finally(() => setRowsLoading(false));
  }, [currentPage, typeFilter, searchTerm]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div><Skeleton h="h-7" /><div className="mt-2"><Skeleton h="h-4" /></div></div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
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

  const typeChartData = summary.breakdown_by_type;
  const totalVisible = total;
  const startIndex = totalVisible === 0 ? 0 : (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalVisible);
  const hasActiveFilters = Boolean(searchInput.trim()) || typeFilter !== "All Types";

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-[22px]" style={{ color: "#0A0A0A", fontWeight: 700 }}>Site Inspections</h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>
          Welcome, {user?.name ?? "User"} — Workforce: Site Inspection Metrics, {summary.total_inspections} safety walk{summary.total_inspections !== 1 ? "s" : ""} logged from the field
        </p>
      </div>

      {/* Site Inspection Summary KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Total Inspections"
          value={summary.total_inspections}
          unit=""
          note="Safety walks logged, including those raised on the mobile app"
          tone="neutral"
        />
        <KpiCard
          title="Avg. Compliance Rating"
          value={summary.avg_compliance_rating}
          unit=" / 5"
          note="Average across every logged inspection"
          tone={summary.avg_compliance_rating === null ? "neutral" : summary.avg_compliance_rating >= 4 ? "good" : summary.avg_compliance_rating >= 3 ? "warn" : "bad"}
        />
        <KpiCard
          title="Avg. Housekeeping Rating"
          value={summary.avg_housekeeping_rating}
          unit=" / 5"
          note="Average across every logged inspection"
          tone={summary.avg_housekeeping_rating === null ? "neutral" : summary.avg_housekeeping_rating >= 4 ? "good" : summary.avg_housekeeping_rating >= 3 ? "warn" : "bad"}
        />
        <KpiCard
          title="Critical Issue Inspections"
          value={summary.inspections_with_critical_issue}
          unit={` of ${summary.total_inspections}`}
          note="Inspections that logged at least one critical issue"
          tone={summary.inspections_with_critical_issue === 0 ? "good" : "bad"}
        />
        <KpiCard
          title="Follow-Up Rate"
          value={summary.follow_up_rate_pct}
          unit="%"
          note={`${summary.inspections_requiring_follow_up} of ${summary.total_inspections} inspections flagged for follow-up`}
          tone={summary.follow_up_rate_pct === null ? "neutral" : summary.follow_up_rate_pct <= 25 ? "good" : summary.follow_up_rate_pct <= 50 ? "warn" : "bad"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        {/* Breakdown by inspection type */}
        <Card>
          <CardTitle>Inspections by Type</CardTitle>
          {typeChartData.length === 0 ? (
            <EmptyState text="No safety walks logged" />
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
            Logged inspections grouped by type.
          </p>
        </Card>

        {/* Data gap summary */}
        <Card>
          <CardTitle>Data Gap Summary</CardTitle>
          <div className="space-y-2">
            <div className="rounded-xl border px-3 py-2 text-[12px]" style={{ borderColor: "#EEF2F7", background: "#FBFCFE", color: "#4B5563" }}>
              This is real general site-inspection data, shown as context — it does not compute
              &quot;Leadership Safety Walk Compliance %&quot;, which needs a scheduled-walks baseline
              this data doesn&apos;t carry.
            </div>
            <div className="rounded-xl border px-3 py-2 text-[12px]" style={{ borderColor: "#EEF2F7", background: "#FBFCFE", color: "#4B5563" }}>
              {summary.total_issues_found} total issue{summary.total_issues_found !== 1 ? "s" : ""} found across all logged inspections.
            </div>
          </div>
        </Card>
      </div>

      {/* Inspection Register */}
      <Card>
        <CardTitle>Inspection Register</CardTitle>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center mb-3">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by type, location or inspector..."
            className="h-10 w-full rounded-lg border px-4 text-[13px] outline-none"
            style={{ borderColor: "#D8E2F4", color: "#0F172A" }}
          />
          <div className="grid gap-3 grid-cols-1 flex-shrink-0" style={{ minWidth: 180 }}>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 rounded-lg border bg-white px-3 text-[13px] outline-none" style={{ borderColor: "#D8E2F4", color: "#0F172A" }}>
              <option>All Types</option>
              {types.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setSearchInput(""); setTypeFilter("All Types"); }}
              className="h-10 rounded-lg border px-4 text-[13px] font-semibold flex-shrink-0"
              style={{ borderColor: "#D8E1F5", color: "#4A57B9", background: "#F5F7FF" }}
            >
              Clear Filters
            </button>
          )}
        </div>
        {rows.length === 0 ? (
          <EmptyState text={rowsLoading ? "Loading…" : "No safety walks found matching your filters"} />
        ) : (
          <>
            <div className="mb-2 text-[12px]" style={{ color: "#9CA3AF" }}>
              Showing {startIndex + 1}–{endIndex} of {totalVisible} inspections
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["Reference", "Type", "Location", "Inspector", "Date", "Issues", "Housekeeping", "Compliance", "Priority"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] uppercase" style={{ color: "#64748B", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} style={{ borderTop: "1px solid #E2E8F0" }}>
                      <td className="px-3 py-2 text-[11px] font-mono" style={{ color: "#4A57B9", fontWeight: 700 }}>{row.reference}</td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: "#334155" }}>{row.inspection_type ?? "—"}</td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: "#334155" }}>{row.location}</td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: "#334155" }}>{row.inspector}</td>
                      <td className="px-3 py-2 text-[12px]" style={{ color: "#6B7280" }}>
                        {row.inspection_date_time ? new Date(row.inspection_date_time).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: row.critical_issues > 0 ? "#B91C1C" : "#334155", fontWeight: row.critical_issues > 0 ? 700 : 400 }}>
                        {row.issues_found}{row.critical_issues > 0 ? ` (${row.critical_issues} critical)` : ""}
                      </td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: "#334155" }}>{row.housekeeping_rating ?? "—"}</td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: "#334155" }}>{row.compliance_rating ?? "—"}</td>
                      <td className="px-3 py-2"><StatusPill text={row.priority} tone={PRIORITY_TONE[row.priority] ?? "slate"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[12px]" style={{ color: "#6B7280" }}>
                Showing {startIndex + 1}–{endIndex} of {totalVisible} inspections
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
                  Page {totalPages === 0 ? 0 : currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  className="rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ color: currentPage >= totalPages ? "#94A3B8" : "#4A57B9", background: "#F4F7F4", border: "1px solid #E2E8F0" }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
