import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { ArrowDown, ArrowUp } from "lucide-react";
import { getComplianceSummary, type ComplianceSummary } from "../../../services/analytics.service";
import { useAuth } from "../../context/AuthContext";
import { InfoTooltip } from "../shared/InfoTooltip";

// Shared formula/definition Info tooltip content for the Compliance page's
// KPI cards — same pattern as the Dashboard, Equipment and Vendors pages'
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

interface ComplianceKpi {
  title: string;
  value: string;
  sub: string;
  inline: string;
  trendDown: boolean;
  info: React.ReactNode;
}

export function ComplianceDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);

  useEffect(() => {
    getComplianceSummary().then(setSummary).catch(console.error);
  }, []);

  const findingsBySeverity = summary?.findings_by_severity ?? [];
  const complianceTrend = summary?.compliance_trend ?? [];
  const nonConformanceRows = summary?.non_conformance_rows ?? [];
  const mom = summary?.compliance_trend_mom ?? null;

  // Same compact KPI-strip pattern the Dashboard's leading-indicators panel
  // uses: title + info icon, one bold value, an optional trend arrow (from
  // the previous-12-month delta the API already computes but this page
  // never surfaced), and a one-line sub note.
  const kpis: ComplianceKpi[] = summary ? [
    {
      title: "Permit Compliance",
      value: `${summary.permit_compliance_pct}%`,
      sub: "PTW Compliance Rate",
      inline: summary.permit_compliance_prev_12mo_delta != null ? `${Math.abs(summary.permit_compliance_prev_12mo_delta)}%` : "",
      trendDown: (summary.permit_compliance_prev_12mo_delta ?? 0) < 0,
      info: (
        <MetricFormulaInfo
          title="Permit Compliance"
          currentValue={`${summary.permit_compliance_pct}%`}
          definition="The share of Permits to Work (PTW) that have been formally Closed out, of every permit ever issued."
          formula="(Closed Permits ÷ Total Permits) × 100"
          note="Also called PTW Compliance Rate. Trend arrow compares against the preceding 12-month window."
        />
      ),
    },
    {
      title: "LOTO Compliance",
      value: summary.loto_compliance_pct != null ? `${summary.loto_compliance_pct}%` : "N/A",
      sub: summary.loto_compliance_pct != null ? "Lockout/Isolation permits, no deviation" : "No lockout permits recorded",
      inline: "",
      trendDown: false,
      info: (
        <MetricFormulaInfo
          title="LOTO Compliance"
          currentValue={summary.loto_compliance_pct != null ? `${summary.loto_compliance_pct}%` : "N/A"}
          definition="Of Equipment Isolation/Lockout permits issued, the share with no deviation reported. A proxy for field-audited lockout compliance, not a true audit result."
          formula="(Lockout/Isolation Permits with No Deviation ÷ Lockout/Isolation Permits Issued) × 100"
        />
      ),
    },
    {
      title: "Corrective Action Closure Rate",
      value: `${summary.corrective_action_closure_rate}%`,
      sub: "CAPA actions closed",
      inline: summary.corrective_action_closure_prev_12mo_delta != null ? `${Math.abs(summary.corrective_action_closure_prev_12mo_delta)}%` : "",
      trendDown: (summary.corrective_action_closure_prev_12mo_delta ?? 0) < 0,
      info: (
        <MetricFormulaInfo
          title="Corrective Action Closure Rate"
          currentValue={`${summary.corrective_action_closure_rate}%`}
          definition="The share of CAPA (Corrective and Preventive Action) actions marked Completed, Closed, Verified, or Done, out of every CAPA action raised."
          formula="(CAPA Actions Completed ÷ Total CAPA Actions) × 100"
          note="Trend arrow compares against the preceding 12-month window."
        />
      ),
    },
    {
      title: "Compliance Score",
      value: `${summary.compliance_score}%`,
      sub: summary.compliance_label,
      inline: summary.compliance_score_prev_12mo_delta != null ? `${Math.abs(summary.compliance_score_prev_12mo_delta)}%` : "",
      trendDown: (summary.compliance_score_prev_12mo_delta ?? 0) < 0,
      info: (
        <MetricFormulaInfo
          title="Compliance Score"
          currentValue={`${summary.compliance_score}%`}
          definition="An overall compliance figure blending three independent measures: permit closure, policy/hazard category coverage, and audit readiness — each weighted equally."
          formula="Average of: Permit Compliance %, Policy–Hazard Coverage %, Audit Readiness %"
          note={summary.compliance_label}
        />
      ),
    },
    {
      title: "Policy–Hazard Coverage",
      value: `${summary.legal_register_coverage_pct}%`,
      sub: "Policy categories vs. hazard categories",
      inline: "",
      trendDown: false,
      info: (
        <MetricFormulaInfo
          title="Policy–Hazard Category Coverage"
          currentValue={`${summary.legal_register_coverage_pct}%`}
          definition="How many distinct hazard categories in the organisation's hazard register have at least a matching policy category on file — a rough proxy for legal/risk register coverage, not a full audit."
          formula="(Distinct Policy Categories ÷ Distinct Hazard Categories) × 100, capped at 100%"
        />
      ),
    },
    {
      title: "Audit Readiness Score",
      value: `${summary.audit_readiness_pct}%`,
      sub: summary.audit_readiness_label,
      inline: summary.audit_readiness_prev_12mo_delta != null ? `${Math.abs(summary.audit_readiness_prev_12mo_delta)}%` : "",
      trendDown: (summary.audit_readiness_prev_12mo_delta ?? 0) < 0,
      info: (
        <MetricFormulaInfo
          title="Audit Readiness Score"
          currentValue={`${summary.audit_readiness_pct}%`}
          definition="A blended, all-time score of the organisation's audit/inspection posture, combining Safety Walk compliance ratings and Auditor-app Audit compliance scores onto a common 0-100 scale. Same score shown on the Dashboard's leading-indicators panel."
          formula="Average of: (Safety Walk rating ÷ 5 × 100) and (Audit compliance score)"
          note={`${summary.audit_readiness_label}. Trend arrow compares against the preceding 12-month window.`}
        />
      ),
    },
    {
      title: "Policy Review Status",
      value: `${summary.policy_review_pct}%`,
      sub: "Current policies",
      inline: "",
      trendDown: false,
      info: (
        <MetricFormulaInfo
          title="Policy Review Status"
          currentValue={`${summary.policy_review_pct}%`}
          definition="The share of policies whose status is marked Current (i.e. not overdue for review), out of every policy on file."
          formula="(Current Policies ÷ Total Policies) × 100"
        />
      ),
    },
  ] : [];

  return (
    <div className="w-full space-y-4">
      <div className="rounded-2xl border px-5 py-4" style={{ borderColor: '#DCE4F3', background: '#FFFFFF' }}>
        <h1 className="text-[22px]" style={{ color: '#0A0A0A', fontWeight: 700 }}>Compliance &amp; Audits</h1>
        <p className="mt-1 text-[14px]" style={{ color: '#64748B' }}>
          Welcome, {user?.name || "User"} — organisation-wide permit, policy and audit posture.
        </p>
      </div>

      {/* KPI strip — same compact card grid as the Dashboard's leading-
          indicators panel, so this page reads as one system with it. */}
      <div className="rounded-2xl border p-4 md:p-5" style={{ borderColor: '#CFDCF5', background: '#F8FBFF' }}>
        <div className="grid grid-cols-1 auto-rows-fr gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((item) => (
            <div
              key={item.title}
              className="flex flex-col justify-center rounded-2xl border px-4 py-[14px] md:px-[18px] md:py-4"
              style={{ background: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 10px rgba(15, 23, 42, 0.08)' }}
            >
              <div className="flex items-center gap-1.5 text-[13px] leading-tight" style={{ color: '#1F2937', fontWeight: 600 }}>
                {item.title}
                <InfoTooltip label={`${item.title} — how this is calculated`}>
                  {item.info}
                </InfoTooltip>
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
            <h2 className="text-[clamp(1.15rem,2.3vw,1.5rem)]" style={{ color: '#111827', fontWeight: 700 }}>Compliance Trend</h2>
            <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest" style={{ background: mom !== null && mom < 0 ? '#FEF2F2' : '#EEF2FF', color: mom !== null && mom < 0 ? '#B91C1C' : '#4A57B9' }}>
              {mom === null ? "Not enough data yet" : `${mom >= 0 ? "Increased" : "Decreased"} ${Math.abs(mom)}% MoM`}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={complianceTrend}>
              <CartesianGrid stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#6073B7" strokeWidth={4} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border bg-white p-4 md:p-5" style={{ borderColor: '#D9E4F6', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)' }}>
          <h2 className="mb-4 text-[clamp(1.15rem,2.3vw,1.5rem)]" style={{ color: '#111827', fontWeight: 700 }}>Audit Findings by Severity</h2>
          {findingsBySeverity.every((f) => f.value === 0) ? (
            <div className="flex items-center justify-center text-[13px]" style={{ height: 280, color: "#9CA3AF" }}>
              No audit findings recorded yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={findingsBySeverity}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {findingsBySeverity.map((entry) => (
                    <Bar key={entry.name} dataKey="value" fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 md:p-5" style={{ borderColor: '#D9E4F6', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)' }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[clamp(1.15rem,2.3vw,1.5rem)]" style={{ color: '#111827', fontWeight: 700 }}>Non-Conformance</h2>
          <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-bold text-[#4A57B9]">OPEN {nonConformanceRows.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: '#E5E7EB' }}>
                {["ID", "Action", "Owner", "Due", "Criticality"].map((h) => (
                  <th key={h} className="px-2 py-2 first:pl-0 text-left text-[12px] uppercase tracking-wide" style={{ color: "#64748B", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nonConformanceRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-[13px]" style={{ color: "#9CA3AF" }}>No open non-conformance actions</td>
                </tr>
              ) : nonConformanceRows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0" style={{ borderColor: "#F1F5F9" }}>
                  <td className="px-2 py-3 first:pl-0 text-[13px]">
                    <button
                      type="button"
                      onClick={() => navigate(`/capa-actions/${row.capa_id}`)}
                      className="hover:underline"
                      style={{ color: "#4A57B9", fontWeight: 700 }}
                    >
                      {row.id}
                    </button>
                  </td>
                  <td className="px-2 py-3 text-[13px]" style={{ color: "#1F2937" }}>{row.action}</td>
                  <td className="px-2 py-3 text-[13px]" style={{ color: "#374151" }}>{row.owner}</td>
                  <td className="px-2 py-3 text-[13px] whitespace-nowrap" style={{ color: "#374151" }}>{row.due}</td>
                  <td className="px-2 py-3 text-[13px]" style={{ color: row.criticality === "High" ? "#991B1B" : row.criticality === "Medium" ? "#B7791F" : "#1D4ED8", fontWeight: 600 }}>
                    ● {row.criticality}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
