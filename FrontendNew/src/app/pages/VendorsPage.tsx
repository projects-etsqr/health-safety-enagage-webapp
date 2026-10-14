import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, ShieldCheck, Loader2, Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { InfoTooltip } from "../components/shared/InfoTooltip";
import {
  getVendorSummary,
  createVendor,
  type VendorSummary,
  type VendorInput,
} from "../../services/vendors.service";

const EMPTY_FORM: VendorInput = {
  company_name: "",
  service_type: "",
  contract_start_date: "",
  contract_end_date: "",
  prequalification_status: "pending",
  iso_45001_certified: false,
  last_safety_audit_date: "",
  active: true,
};

// ── Shared card wrapper ───────────────────────────────────────────────────────
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

// ── Module 5 KPI card — client's own formula in the subtitle, not a
// re-classification of it ("Needs Attention"-style labels caused the same
// complaint on the Compliance page — see analytics.py's compliance_label). ──
// Shared formula/definition Info tooltip content for the Module 5 KPI cards —
// same pattern as the Dashboard and Equipment pages' Info tooltips: shows the
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

// ── Page skeleton loader ──────────────────────────────────────────────────────
function Skeleton({ h = "h-4" }: { h?: string }) {
  return <div className={`${h} rounded-lg animate-pulse`} style={{ background: "#F1F5F9" }} />;
}

const PREQUAL_TONE: Record<string, "green" | "amber" | "red" | "slate"> = {
  approved: "green",
  conditional: "amber",
  barred: "red",
  pending: "slate",
};

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1.5 text-[12px]" style={{ color: "#4B5563", fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function VendorsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<VendorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<VendorInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadSummary = () => {
    getVendorSummary()
      .then(setData)
      .catch(() => setError("Failed to load vendor data"));
  };

  useEffect(() => {
    getVendorSummary()
      .then(setData)
      .catch(() => setError("Failed to load vendor data"))
      .finally(() => setLoading(false));
  }, []);

  const handleAddVendor = async () => {
    if (!form.company_name.trim()) {
      setFormError("Company Name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await createVendor({
        ...form,
        service_type: form.service_type || null,
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || null,
        last_safety_audit_date: form.last_safety_audit_date || null,
      });
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      loadSummary();
    } catch {
      setFormError("Could not save vendor. Please check the fields and try again.");
    } finally {
      setSaving(false);
    }
  };

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

  if (error || !data) {
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

  const kpis = data.kpis ?? {
    contractor_trir: {
      value: null,
      contractor_injuries: 0,
      contractor_hours: 0,
      note: "No KPI data available yet",
    },
    induction_compliance_pct: {
      value: null,
      valid: 0,
      total: 0,
      note: "No KPI data available yet",
    },
    incident_contribution_pct: {
      value: null,
      contractor_injuries: 0,
      total_site_injuries: 0,
      note: "No KPI data available yet",
    },
    safety_score: {
      value: null,
      company_count: 0,
      note: "No KPI data available yet",
    },
  };
  const exposureHours = data.exposure_hours ?? [];
  const atRiskWorkers = data.at_risk_workers ?? [];
  const register = data.register ?? [];
  const totalContractors = data.total_contractors ?? 0;
  const expiringSoonCount = data.expiring_soon_count ?? 0;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-[22px]" style={{ color: "#0A0A0A", fontWeight: 700 }}>Vendors</h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>
          Welcome, {user?.name ?? "User"} — Module 5: Contractors &amp; Vendors, {totalContractors} contractor{totalContractors !== 1 ? "s" : ""} registered
        </p>
      </div>

      {/* Module 5 KPIs — same four the client's own spec defines */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Contractor TRIR"
          value={kpis.contractor_trir.value}
          unit=""
          note={`${kpis.contractor_trir.contractor_injuries} injuries × 200,000 ÷ ${kpis.contractor_trir.contractor_hours.toLocaleString()} hrs. ${kpis.contractor_trir.note}`}
          tone={kpis.contractor_trir.value === null ? "neutral" : kpis.contractor_trir.value === 0 ? "good" : "warn"}
          info={
            <MetricFormulaInfo
              title="Contractor TRIR — Total Recordable Incident Rate"
              currentValue={kpis.contractor_trir.value === null ? "N/A" : `${kpis.contractor_trir.value}`}
              definition="Recordable injuries among contractor-employed workers, per 200,000 hours worked by contractors — the same TRIR standard used site-wide, scoped to contractors only."
              formula="(Contractor Injuries × 200,000) ÷ Contractor Hours Worked"
              note={`${kpis.contractor_trir.contractor_injuries} injuries, ${kpis.contractor_trir.contractor_hours.toLocaleString()} logged contractor hours. ${kpis.contractor_trir.note}.`}
            />
          }
        />
        <KpiCard
          title="Induction Compliance"
          value={kpis.induction_compliance_pct.value}
          unit="%"
          note={`${kpis.induction_compliance_pct.valid} of ${kpis.induction_compliance_pct.total} inductions valid today. ${kpis.induction_compliance_pct.note}`}
          tone={
            kpis.induction_compliance_pct.value === null ? "neutral"
              : kpis.induction_compliance_pct.value >= 90 ? "good"
              : kpis.induction_compliance_pct.value >= 60 ? "warn" : "bad"
          }
          info={
            <MetricFormulaInfo
              title="Induction Compliance"
              currentValue={kpis.induction_compliance_pct.value === null ? "N/A" : `${kpis.induction_compliance_pct.value}%`}
              definition="The share of registered contractor workers whose site induction is still valid as of today."
              formula="(Workers with induction_valid_until ≥ today ÷ Total contractor workers) × 100"
              note={`${kpis.induction_compliance_pct.valid} of ${kpis.induction_compliance_pct.total} inductions valid today. ${kpis.induction_compliance_pct.note}.`}
            />
          }
        />
        <KpiCard
          title="Incident Contribution"
          value={kpis.incident_contribution_pct.value}
          unit="%"
          note={`${kpis.incident_contribution_pct.contractor_injuries} of ${kpis.incident_contribution_pct.total_site_injuries} site injuries. ${kpis.incident_contribution_pct.note}`}
          tone={kpis.incident_contribution_pct.value === null ? "neutral" : kpis.incident_contribution_pct.value > 30 ? "bad" : "good"}
          info={
            <MetricFormulaInfo
              title="Incident Contribution"
              currentValue={kpis.incident_contribution_pct.value === null ? "N/A" : `${kpis.incident_contribution_pct.value}%`}
              definition="What share of all site injuries were reported by a worker whose employment type is Contractor, out of every injury recorded org-wide."
              formula="(Contractor Injuries ÷ Total Site Injuries) × 100"
              note={`${kpis.incident_contribution_pct.contractor_injuries} of ${kpis.incident_contribution_pct.total_site_injuries} site injuries. ${kpis.incident_contribution_pct.note}.`}
            />
          }
        />
        <KpiCard
          title="Contractor Safety Score"
          value={kpis.safety_score.value}
          unit="/100"
          note={`Averaged across ${kpis.safety_score.company_count} companies. ${kpis.safety_score.note}`}
          tone={
            kpis.safety_score.value === null ? "neutral"
              : kpis.safety_score.value >= 75 ? "good"
              : kpis.safety_score.value >= 60 ? "warn" : "bad"
          }
          info={
            <MetricFormulaInfo
              title="Contractor Safety Score"
              currentValue={kpis.safety_score.value === null ? "N/A" : `${kpis.safety_score.value}/100`}
              definition="The average of each contractor company's latest safety scorecard (0-100), giving one figure across all active contractors. Same calculation shown on the Dashboard's leading-indicators panel."
              formula="Average of latest scorecard score, per contractor company"
              note={`Averaged across ${kpis.safety_score.company_count} companies. ${kpis.safety_score.note}.`}
            />
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        {/* Exposure Hours */}
        <Card>
          <CardTitle>Contractor Exposure Hours</CardTitle>
          {exposureHours.length === 0 ? (
            <EmptyState text="No contractor hours logged" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={exposureHours} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }} labelStyle={{ fontWeight: 600, color: "#111827" }} />
                <Bar dataKey="hours" fill="#64748B" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="mt-2 text-[11px]" style={{ color: "#9CA3AF" }}>
            Trailing 12 months, real logged hours per contractor company.
          </p>
        </Card>

        {/* Induction status */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle>Inductions Needing Attention</CardTitle>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" style={{ color: "#94A3B8" }} />
              <span className="text-[11px]" style={{ color: "#94A3B8" }}>{expiringSoonCount} expiring within 30 days</span>
            </div>
          </div>
          {atRiskWorkers.length === 0 ? (
            <EmptyState text="No expired or soon-to-expire inductions" />
          ) : (
            <div className="space-y-2">
              {atRiskWorkers.map((w, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "#EEF2F7", background: "#FBFCFE" }}>
                  <div className="min-w-0">
                    <div className="text-[12px] truncate" style={{ color: "#0F172A", fontWeight: 600 }}>{w.full_name}</div>
                    <div className="text-[11px] truncate" style={{ color: "#6B7280" }}>{w.company_name}{w.badge_no ? ` · ${w.badge_no}` : ""}</div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <StatusPill text={w.status} tone={w.status === "Expired" ? "red" : "amber"} />
                    <div className="mt-1 text-[10px]" style={{ color: "#9CA3AF" }}>
                      {w.induction_valid_until ? new Date(w.induction_valid_until).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

        {/* Contractor Register */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle>Contractor Register</CardTitle>
            <button
              type="button"
              onClick={() => { setForm(EMPTY_FORM); setFormError(null); setShowAddModal(true); }}
              className="flex items-center gap-1.5 h-9 rounded-lg px-3.5 text-[13px] font-semibold text-white"
              style={{ background: "#4A57B9" }}
            >
              <Plus className="w-4 h-4" /> Add Vendor
            </button>
          </div>
          {register.length === 0 ? (
            <EmptyState text="No contractor companies registered" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Company", "Service Type", "Prequalification", "ISO 45001", "Safety Score", "Contract", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] uppercase" style={{ color: "#64748B", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {register.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid #E2E8F0" }}>
                    <td className="px-3 py-2 text-[13px]" style={{ color: "#0F172A", fontWeight: 600 }}>{c.company_name}</td>
                    <td className="px-3 py-2 text-[13px]" style={{ color: "#334155" }}>{c.service_type ?? "—"}</td>
                    <td className="px-3 py-2"><StatusPill text={c.prequalification_status} tone={PREQUAL_TONE[c.prequalification_status] ?? "slate"} /></td>
                    <td className="px-3 py-2">
                      <StatusPill text={c.iso_45001_certified ? "Certified" : "Not Certified"} tone={c.iso_45001_certified ? "green" : "slate"} />
                    </td>
                    <td className="px-3 py-2 text-[13px]" style={{ color: "#0F172A", fontWeight: 600 }}>
                      {c.safety_score !== null ? `${c.safety_score}/100` : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px]" style={{ color: "#6B7280" }}>
                      {c.contract_start_date ?? "—"} → {c.contract_end_date ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill text={c.active ? "Active" : "Suspended"} tone={c.active ? "green" : "red"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Vendor Modal */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowAddModal(false)} />
          <div
            className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-[560px] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white"
            style={{ boxShadow: "0px 8px 32px rgba(0,0,0,0.16)" }}
          >
            <div className="px-8 py-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[17px]" style={{ color: "#0A0A0A", fontWeight: 700 }}>Add Vendor</h2>
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
                <FormField label="Company Name *">
                  <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Apex Scaffolding Ltd" className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="Service Type">
                  <input value={form.service_type ?? ""} onChange={(e) => setForm({ ...form, service_type: e.target.value })} placeholder="Scaffolding" className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="Contract Start Date">
                  <input type="date" value={form.contract_start_date ?? ""} onChange={(e) => setForm({ ...form, contract_start_date: e.target.value })} className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="Contract End Date">
                  <input type="date" value={form.contract_end_date ?? ""} onChange={(e) => setForm({ ...form, contract_end_date: e.target.value })} className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <FormField label="Prequalification Status">
                  <select value={form.prequalification_status} onChange={(e) => setForm({ ...form, prequalification_status: e.target.value })} className="w-full h-10 px-3 rounded-lg border bg-white text-[13px]" style={{ borderColor: "#D8E2F4" }}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="conditional">Conditional</option>
                    <option value="barred">Barred</option>
                  </select>
                </FormField>
                <FormField label="Last Safety Audit Date">
                  <input type="date" value={form.last_safety_audit_date ?? ""} onChange={(e) => setForm({ ...form, last_safety_audit_date: e.target.value })} className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: "#D8E2F4" }} />
                </FormField>
                <label className="flex items-center gap-2 text-[13px]" style={{ color: "#334155" }}>
                  <input type="checkbox" checked={!!form.iso_45001_certified} onChange={(e) => setForm({ ...form, iso_45001_certified: e.target.checked })} />
                  ISO 45001 Certified
                </label>
                <label className="flex items-center gap-2 text-[13px]" style={{ color: "#334155" }}>
                  <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  Active (unchecked = Suspended)
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg text-[13px]" style={{ color: "#6B7280", fontWeight: 500 }}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleAddVendor}
                  className="px-6 py-2 rounded-lg text-white text-[13px] disabled:opacity-60"
                  style={{ background: "#4A57B9", fontWeight: 600 }}
                >
                  {saving ? "Saving…" : "Add Vendor"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
