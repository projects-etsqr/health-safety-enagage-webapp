import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, MoreHorizontal } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import axiosInstance from "../../api/axiosInstance";
import { useAuth } from "../context/AuthContext";

interface AssetSummary {
  control_effectiveness_pct: number;
  maintenance_risk_pct: number;
  maintenance_risk_label: string;
  total_certs: number;
  valid_count: number;
  expiring_count: number;
  expired_count: number;
  failure_trend: { month: string; value: number }[];
  asset_incident_trend: { month: string; value: number }[];
  risk_table: { id: string; type: string; risk: string; status: string }[];
  overdue_inspections: { name: string; due: string; tone: string }[];
  barrier_checklist: { text: string; progress: number }[];
  heat_rows: string[];
  heat_cols: string[];
  heat_vals: number[][];
}

function heatColor(v: number) {
  if (v < 0.25) return "#43AA6A";
  if (v < 0.45) return "#86C779";
  if (v < 0.65) return "#F2D45F";
  if (v < 0.8)  return "#F2A444";
  if (v < 0.9)  return "#E97738";
  return "#D64745";
}

function riskColor(risk: string) {
  if (risk === "High") return "#B45309";
  return "#B7791F";
}

function statusColor(s: string) {
  return s.includes("Critical") ? "#991B1B" : "#92400E";
}

export function AssetsPage() {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState<AssetSummary | null>(null);

  useEffect(() => {
    axiosInstance.get<AssetSummary>("/analytics/asset-summary")
      .then(r => setData(r.data))
      .catch(console.error);
  }, []);

  const effectPct      = data?.control_effectiveness_pct ?? 0;
  const riskPct        = data?.maintenance_risk_pct ?? 0;
  const riskLabel      = data?.maintenance_risk_label ?? "—";
  const failureTrend   = data?.failure_trend ?? [];
  const incidentTrend  = data?.asset_incident_trend ?? [];
  const riskTable      = data?.risk_table ?? [];
  const overdueList    = data?.overdue_inspections ?? [];
  const checklist      = data?.barrier_checklist ?? [];
  const heatRows       = data?.heat_rows ?? [];
  const heatCols       = data?.heat_cols ?? [];
  const heatVals       = data?.heat_vals ?? [];

  // MoM label for failure trend
  const momPct = failureTrend.length >= 2
    ? Math.round(
        ((failureTrend[failureTrend.length - 1].value - failureTrend[failureTrend.length - 2].value) /
          Math.max(failureTrend[failureTrend.length - 2].value, 1)) * 100
      )
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h1>Welcome, {currentUser?.name || currentUser?.email || "User"}</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Asset Control Effectiveness */}
        <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[18px]" style={{ color: '#111827', fontWeight: 700 }}>Asset Control Effectiveness</div>
            <MoreHorizontal className="h-4 w-4" style={{ color: '#64748B' }} />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[54px] leading-none" style={{ color: '#0F172A', fontWeight: 700 }}>{effectPct}%</div>
              <div className="mt-1 text-[24px]" style={{ color: '#2F8C77', fontWeight: 600 }}>
                {data ? `▲ ${data.valid_count} valid of ${data.total_certs}` : "—"}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-20 w-40 overflow-hidden">
                <div
                  className="h-40 w-40 rounded-full border-[12px]"
                  style={{
                    borderColor: '#E2E8F0',
                    borderTopColor: '#6073B7',
                    borderRightColor: '#6073B7',
                    transform: 'translateX(20px) rotate(15deg)',
                  }}
                />
              </div>
              <span className="-mt-2 text-[16px]" style={{ color: '#1F2937', fontWeight: 600 }}>
                {effectPct >= 80 ? "Excellent" : effectPct >= 60 ? "Good" : effectPct > 0 ? "Needs Attention" : "No Data"}
              </span>
            </div>
          </div>
          <div className="mt-3 h-3 rounded-full" style={{ background: '#E5E7EB' }}>
            <div className="h-full rounded-full" style={{ width: `${effectPct}%`, background: 'linear-gradient(90deg, #6073B7 0%, #5566AA 100%)' }} />
          </div>
        </div>

        {/* Safety Maintenance Status */}
        <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[18px]" style={{ color: '#111827', fontWeight: 700 }}>Safety Maintenance Status</div>
            <MoreHorizontal className="h-4 w-4" style={{ color: '#64748B' }} />
          </div>
          <div className="text-[54px] leading-none" style={{ color: '#0F172A', fontWeight: 700 }}>{riskPct}%</div>
          <div className="mt-1 text-[24px]" style={{ color: '#B7791F', fontWeight: 600 }}>
            {data ? `⚠ ${riskLabel}` : "—"}
          </div>
          {data && (
            <div className="mt-2 flex gap-4 text-[13px]" style={{ color: '#4B5563' }}>
              <span><span className="font-semibold text-yellow-600">{data.expiring_count}</span> expiring soon</span>
              <span><span className="font-semibold text-red-600">{data.expired_count}</span> expired</span>
            </div>
          )}
          <div className="mt-4 h-3 rounded-full" style={{ background: '#E5E7EB' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(riskPct, 4)}%`, background: 'linear-gradient(90deg, #334155 0%, #0F172A 35%, #1F8F7C 100%)' }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1.35fr_1fr]">
        {/* Critical Asset Failure Trends */}
        <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[18px]" style={{ color: '#111827', fontWeight: 700 }}>Incident Trend</div>
            <span className="rounded-full px-3 py-1 text-[11px]" style={{ background: '#E8EDF8', color: '#4B5563', fontWeight: 700 }}>
              {momPct === null ? "No data yet" : `${momPct >= 0 ? "▲" : "▼"} ${Math.abs(momPct)}% MoM`}
            </span>
          </div>
          {failureTrend.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-[13px]" style={{ color: '#9CA3AF' }}>No incident data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={failureTrend}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#6477B6" strokeWidth={3} dot={{ fill: '#FFFFFF', stroke: '#6477B6', strokeWidth: 2, r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Asset Heat Map */}
        <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[18px]" style={{ color: '#111827', fontWeight: 700 }}>Asset Heat Map (Risk by Type)</div>
            <MoreHorizontal className="h-4 w-4" style={{ color: '#64748B' }} />
          </div>
          {heatRows.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-[13px]" style={{ color: '#9CA3AF' }}>No certificates yet</div>
          ) : (
            <>
              <div className="grid" style={{ gridTemplateColumns: `130px repeat(${Math.max(heatCols.length, 1)}, 1fr)`, gap: 2 }}>
                <div />
                {heatCols.map((col) => (
                  <div key={col} className="text-[10px] text-center truncate" style={{ color: '#475569' }}>{col}</div>
                ))}
                {heatRows.map((row, rIdx) => (
                  <>
                    <div key={`${row}-label`} className="text-[10px] py-1 truncate" style={{ color: '#475569' }}>{row}</div>
                    {(heatVals[rIdx] ?? []).map((v, cIdx) => (
                      <div key={`${row}-${cIdx}`} className="h-10 rounded-sm" style={{ background: heatColor(v) }} />
                    ))}
                  </>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-4 text-[11px]" style={{ color: '#475569' }}>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: '#43AA6A' }} />All valid</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: '#F2D45F' }} />Some expiring</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: '#D64745' }} />Expired</span>
              </div>
            </>
          )}
        </div>

        {/* Asset Incident Trend (Near Misses) */}
        <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[18px]" style={{ color: '#111827', fontWeight: 700 }}>Near Miss Trend</div>
            <span className="rounded-full px-3 py-1 text-[11px]" style={{ background: '#E8EDF8', color: '#4B5563', fontWeight: 700 }}>
              {incidentTrend.length === 0 ? "No data" : "Monthly"}
            </span>
          </div>
          {incidentTrend.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-[13px]" style={{ color: '#9CA3AF' }}>No near miss data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={incidentTrend}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="value" fill="#5E6B8E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.55fr_0.8fr]">
        {/* Asset Risk Table */}
        <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[18px]" style={{ color: '#111827', fontWeight: 700 }}>Asset Risk Table</div>
            <MoreHorizontal className="h-4 w-4" style={{ color: '#64748B' }} />
          </div>
          {riskTable.length === 0 ? (
            <p className="text-[13px] py-4 text-center" style={{ color: '#9CA3AF' }}>No expired or expiring certificates</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Asset ID', 'Type', 'Risk Score', 'Status'].map((h) => (
                    <th key={h} className="px-2 py-2 text-left text-[12px] uppercase" style={{ color: '#64748B', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {riskTable.map((row) => (
                  <tr key={row.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td className="px-2 py-2 text-[14px]" style={{ color: '#1F2937', fontWeight: 600 }}>{row.id}</td>
                    <td className="px-2 py-2 text-[14px]" style={{ color: '#334155' }}>{row.type}</td>
                    <td className="px-2 py-2 text-[14px] font-semibold" style={{ color: riskColor(row.risk) }}>{row.risk}</td>
                    <td className="px-2 py-2 text-[14px] font-semibold" style={{ color: statusColor(row.status) }}>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Overdue Inspections */}
        <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[18px]" style={{ color: '#111827', fontWeight: 700 }}>Overdue Inspections</div>
            <MoreHorizontal className="h-4 w-4" style={{ color: '#64748B' }} />
          </div>
          {overdueList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <CheckCircle2 className="h-8 w-8" style={{ color: '#22C55E' }} />
              <p className="text-[13px]" style={{ color: '#9CA3AF' }}>No overdue inspections</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overdueList.map((item) => (
                <div key={item.name} className="rounded-lg px-3 py-2" style={{ background: '#F8FAFC' }}>
                  <div className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 h-4 w-4" style={{ color: '#475569' }} />
                    <div className="flex-1">
                      <div className="text-[14px]" style={{ color: '#0F172A', fontWeight: 600 }}>{item.name}</div>
                      <div className="text-[12px]" style={{ color: '#64748B' }}>({item.due})</div>
                    </div>
                    <AlertTriangle className="h-4 w-4" style={{ color: item.tone === 'critical' ? '#B91C1C' : '#B7791F' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Certification Checklist */}
        <div className="rounded-2xl border bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: '#D8E2F4' }}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[18px]" style={{ color: '#111827', fontWeight: 700 }}>Certification Checklist</div>
            <MoreHorizontal className="h-4 w-4" style={{ color: '#64748B' }} />
          </div>
          {checklist.length === 0 ? (
            <p className="text-[13px] py-4 text-center" style={{ color: '#9CA3AF' }}>No certification types yet</p>
          ) : (
            <div className="space-y-3">
              {checklist.map((item) => (
                <div key={item.text}>
                  <div className="mb-1 flex items-center gap-2 text-[14px]" style={{ color: '#1F2937' }}>
                    <input type="checkbox" readOnly checked={item.progress === 100} className="h-4 w-4 rounded accent-[#5B6CB4]" />
                    <span className="truncate">{item.text}</span>
                    <span className="ml-auto text-[12px]" style={{ color: '#6B7280' }}>{item.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: '#E5E7EB' }}>
                    <div className="h-full rounded-full" style={{ width: `${item.progress}%`, background: '#6477B6' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 text-center text-[12px]" style={{ color: '#64748B' }}>
            <CheckCircle2 className="mr-1 inline h-4 w-4" />
            Ensure all certifications are current.
          </div>
        </div>
      </div>
    </div>
  );
}
