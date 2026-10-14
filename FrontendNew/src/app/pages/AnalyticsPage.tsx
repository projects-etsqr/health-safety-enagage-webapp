import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { Download, Calendar, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { getViolationsSummary, getPermitsSummary, type RcaItem, type SeverityMixItem, type WorkByType } from "../../services/analytics.service";
import { getSites } from "../../services/infrastructure.service";

const ppeData: { name: string; compliance: number }[] = [];

const VALID_TABS = ["overview", "ppe", "contractor", "zone", "trend", "custom"];

export function AnalyticsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = VALID_TABS.includes(searchParams.get("tab") ?? "") ? searchParams.get("tab")! : "overview";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [pieData, setPieData] = useState<RcaItem[]>([]);
  const [zoneRiskData, setZoneRiskData] = useState<{ name: string; risk: number; violations: number }[]>([]);
  const [trendData, setTrendData] = useState<{ month: string; violations: number; resolved: number }[]>([]);
  const [severityMix, setSeverityMix] = useState<SeverityMixItem[]>([]);
  const [personInvolved, setPersonInvolved] = useState<{ label: string; value: number }[]>([]);
  const [siteNames, setSiteNames] = useState<string[]>([]);
  const [contractorCompliantPct, setContractorCompliantPct] = useState<number | null>(null);
  const [contractorNonCompliantPct, setContractorNonCompliantPct] = useState<number | null>(null);
  const [contractorWorkByType, setContractorWorkByType] = useState<WorkByType[]>([]);

  useEffect(() => {
    getSites().then((sites) => setSiteNames(sites.map((s) => s.Site_Name))).catch(console.error);
  }, []);

  useEffect(() => {
    getViolationsSummary(12).then((data) => {
      setPieData(data.by_root_cause);
      setSeverityMix(data.severity_mix);
      setPersonInvolved(data.person_involved);

      // Normalize to 0-100 relative to the busiest location — the risk-color
      // thresholds below (40/70) are calibrated for a percentage scale, and
      // raw incident counts here are small (single digits), so using the
      // raw count directly left every bar permanently green.
      const maxLocationCount = Math.max(1, ...data.by_location.map((loc) => loc.value));
      setZoneRiskData(
        data.by_location.map((loc) => ({
          name: loc.label,
          risk: Math.round((loc.value / maxLocationCount) * 100),
          violations: loc.value,
        }))
      );

      const nearMissMap: Record<string, number> = {};
      data.near_miss_monthly.forEach((nm) => { nearMissMap[nm.month] = nm.value; });
      setTrendData(
        data.monthly_trend.map((t) => ({
          month: t.month,
          violations: t.value,
          resolved: nearMissMap[t.month] ?? 0,
        }))
      );
    }).catch(console.error);
  }, []);

  useEffect(() => {
    getPermitsSummary().then((data) => {
      setContractorCompliantPct(data.contractor_compliant_pct);
      setContractorNonCompliantPct(data.contractor_non_compliant_pct);
      setContractorWorkByType(data.work_by_type);
    }).catch(console.error);
  }, []);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "ppe", label: "PPE Compliance" },
    { id: "contractor", label: "Contractor Performance" },
    { id: "zone", label: "Zone Risk" },
    { id: "trend", label: "Trend Reports" },
    { id: "custom", label: "Custom Reports" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1>Analytics & Reports</h1>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-[13px]" style={{ borderColor: '#E2E8E2', color: '#4A5568' }}>
            <Calendar className="w-3.5 h-3.5" /> Last 12 Months
          </div>
          <button
            disabled
            title="Export is not available yet"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-[13px] cursor-not-allowed opacity-50"
            style={{ borderColor: '#E2E8E2', color: '#4A5568', fontWeight: 500 }}
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b" style={{ borderColor: '#E2E8E2' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-[13px] transition-colors relative"
            style={{ color: activeTab === tab.id ? '#1B5E20' : '#4A5568', fontWeight: activeTab === tab.id ? 600 : 400 }}
          >
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)' }} />}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Violation Breakdown */}
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-6">Violation Type Breakdown</h2>
            <div className="flex items-center gap-8">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
                    <span className="text-[13px]" style={{ color: '#4A5568' }}>{d.name}</span>
                    <span className="text-[13px]" style={{ color: '#0A0A0A', fontWeight: 600 }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Zone Risk */}
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-6">Zone Risk Distribution</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={zoneRiskData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2EE" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8E2', borderRadius: 8 }} />
                <Bar dataKey="risk" radius={[4, 4, 0, 0]} barSize={32}>
                  {zoneRiskData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.risk > 70 ? '#DC2626' : entry.risk > 40 ? '#F59E0B' : '#2E7D32'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Trend */}
          <div className="bg-white rounded-xl border p-6 xl:col-span-2" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-6">Monthly Violations vs Near Misses</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2EE" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8E2', borderRadius: 8 }} />
                <Line type="monotone" dataKey="violations" stroke="#1B5E20" strokeWidth={2} dot={{ fill: '#1B5E20', r: 3 }} />
                <Line type="monotone" dataKey="resolved" stroke="#43A047" strokeWidth={2} dot={{ fill: '#43A047', r: 3 }} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5" style={{ background: '#1B5E20' }} />
                <span className="text-[12px]" style={{ color: '#4A5568' }}>Incidents</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 border-t-2 border-dashed" style={{ borderColor: '#43A047' }} />
                <span className="text-[12px]" style={{ color: '#4A5568' }}>Near Misses</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "ppe" && (
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
          <h2 className="mb-6">PPE Compliance by Type</h2>
          {ppeData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ background: '#F4F7F4', borderRadius: 12 }}>
              <p className="text-[15px] mb-1" style={{ color: '#0A0A0A', fontWeight: 500 }}>No PPE compliance data available</p>
              <p className="text-[13px]" style={{ color: '#9CA3AF' }}>PPE tracking has not been configured for this organisation</p>
            </div>
          ) : (
            <div className="space-y-5">
              {ppeData.map(p => (
                <div key={p.name}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[14px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{p.name}</span>
                    <span className="text-[14px]" style={{ color: p.compliance >= 90 ? '#2E7D32' : p.compliance >= 80 ? '#F59E0B' : '#DC2626', fontWeight: 600 }}>{p.compliance}%</span>
                  </div>
                  <div className="h-3 rounded-full" style={{ background: '#F4F7F4' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${p.compliance}%`,
                        background: p.compliance >= 90 ? 'linear-gradient(135deg, #1B5E20, #43A047)' : p.compliance >= 80 ? '#F59E0B' : '#DC2626',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "contractor" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
              <div className="text-[14px] mb-2" style={{ color: '#4A5568', fontWeight: 600 }}>Contractor Permit Compliance</div>
              <div className="text-[52px] leading-none" style={{ color: '#2E7D32', fontWeight: 700 }}>{contractorCompliantPct !== null ? `${contractorCompliantPct}%` : "—"}</div>
              <div className="mt-2 text-[13px]" style={{ color: '#9CA3AF' }}>Permits with no deviation or incident</div>
            </div>
            <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
              <div className="text-[14px] mb-2" style={{ color: '#4A5568', fontWeight: 600 }}>Contractor Non-Compliance</div>
              <div className="text-[52px] leading-none" style={{ color: '#DC2626', fontWeight: 700 }}>{contractorNonCompliantPct !== null ? `${contractorNonCompliantPct}%` : "—"}</div>
              <div className="mt-2 text-[13px]" style={{ color: '#9CA3AF' }}>Permits with reported deviations</div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
              <h2 className="mb-1">Incidents by Reporter's Employment Type</h2>
              <p className="mb-5 text-[11px]" style={{ color: '#9CA3AF' }}>
                Grouped by who reported the incident, not necessarily who was affected
              </p>
              {personInvolved.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-[13px]" style={{ color: '#9CA3AF' }}>No incident data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={personInvolved}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2EE" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8E2', borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={36} fill="#1B5E20" name="Incidents" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
              <h2 className="mb-6">Permit Status by Type</h2>
              {contractorWorkByType.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-[13px]" style={{ color: '#9CA3AF' }}>No permit data available</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={contractorWorkByType} layout="vertical" barSize={18}>
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8E2', borderRadius: 8 }} />
                      <Bar dataKey="active" stackId="a" fill="#2E7D32" name="Active" />
                      <Bar dataKey="closed" stackId="a" fill="#43A047" name="Closed" />
                      <Bar dataKey="expired" stackId="a" fill="#9CA3AF" name="Expired" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-3 text-[12px]" style={{ color: '#4A5568' }}>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#2E7D32' }} /> Active</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#43A047' }} /> Closed</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#9CA3AF' }} /> Expired</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "zone" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-6">Incident Count by Zone / Site</h2>
            {zoneRiskData.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-[13px]" style={{ color: '#9CA3AF' }}>No zone risk data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={zoneRiskData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2EE" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8E2', borderRadius: 8 }} formatter={(v) => [v, 'Incidents']} />
                  <Bar dataKey="violations" radius={[4, 4, 0, 0]} barSize={40} name="Incidents">
                    {zoneRiskData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.risk > 70 ? '#DC2626' : entry.risk > 40 ? '#F59E0B' : '#2E7D32'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {zoneRiskData.length > 0 && (
            <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
              <h2 className="mb-4">Zone Risk Summary</h2>
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#F4F7F4' }}>
                    {["Zone / Site", "Incidents", "Risk Level"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] uppercase" style={{ color: '#9CA3AF', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zoneRiskData.map((z) => (
                    <tr key={z.name} style={{ borderBottom: '1px solid #EEF2EE' }}>
                      <td className="px-4 py-3 text-[13px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{z.name}</td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: '#4A5568' }}>{z.violations}</td>
                      <td className="px-4 py-3">
                        <span className="px-3 py-1 rounded-full text-[12px]" style={{
                          background: z.risk > 70 ? '#FEE2E2' : z.risk > 40 ? '#FEF3C7' : '#DCFCE7',
                          color: z.risk > 70 ? '#991B1B' : z.risk > 40 ? '#92400E' : '#166534',
                          fontWeight: 600,
                        }}>
                          {z.risk > 70 ? 'High' : z.risk > 40 ? 'Medium' : 'Low'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "trend" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-6">Monthly Incidents vs Near Misses</h2>
            {trendData.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-[13px]" style={{ color: '#9CA3AF' }}>No trend data available</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2EE" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8E2', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="violations" stroke="#1B5E20" strokeWidth={2} dot={{ fill: '#1B5E20', r: 3 }} name="Incidents" />
                    <Line type="monotone" dataKey="resolved" stroke="#43A047" strokeWidth={2} dot={{ fill: '#43A047', r: 3 }} strokeDasharray="5 5" name="Near Misses" />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5" style={{ background: '#1B5E20' }} />
                    <span className="text-[12px]" style={{ color: '#4A5568' }}>Incidents</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 border-t-2 border-dashed" style={{ borderColor: '#43A047' }} />
                    <span className="text-[12px]" style={{ color: '#4A5568' }}>Near Misses</span>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-6">Incident Severity Mix by Month</h2>
            {severityMix.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-[13px]" style={{ color: '#9CA3AF' }}>No severity data available</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={severityMix}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2EE" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8E2', borderRadius: 8 }} />
                    <Bar dataKey="critical" stackId="a" fill="#DC2626" name="Critical" />
                    <Bar dataKey="high" stackId="a" fill="#F59E0B" name="High" />
                    <Bar dataKey="medium" stackId="a" fill="#2E7D32" name="Medium" />
                    <Bar dataKey="low" stackId="a" fill="#43A047" name="Low" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-6 mt-4 text-[12px]" style={{ color: '#4A5568' }}>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#DC2626' }} /> Critical</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#F59E0B' }} /> High</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#2E7D32' }} /> Medium</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#43A047' }} /> Low</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "custom" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Left - Parameters */}
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-6">Report Builder</h2>
            <div className="space-y-4">
              <div>
                <label className="block mb-1.5">Report Type</label>
                <select className="w-full h-10 px-3 rounded-lg border text-[13px] bg-white" style={{ borderColor: '#E2E8E2' }}>
                  <option>Violation Summary</option>
                  <option>Compliance Report</option>
                  <option>Contractor Performance</option>
                  <option>Zone Risk Assessment</option>
                </select>
              </div>
              <div>
                <label className="block mb-1.5">Date Range</label>
                <div className="flex gap-2">
                  <input type="date" className="flex-1 h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: '#E2E8E2' }} />
                  <input type="date" className="flex-1 h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: '#E2E8E2' }} />
                </div>
              </div>
              <div>
                <label className="block mb-1.5">Sites</label>
                <div className="space-y-1.5">
                  {siteNames.map(s => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer" style={{ textTransform: 'none', color: '#0A0A0A', fontWeight: 400, fontSize: '13px' }}>
                      <input type="checkbox" className="w-4 h-4 accent-[#2E7D32]" /> {s}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block mb-1.5">Severity</label>
                <div className="flex gap-2 flex-wrap">
                  {["Critical", "High", "Medium", "Low"].map(s => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border" style={{ borderColor: '#E2E8E2', textTransform: 'none', color: '#4A5568', fontWeight: 400, fontSize: '13px' }}>
                      <input type="checkbox" className="w-3.5 h-3.5 accent-[#2E7D32]" /> {s}
                    </label>
                  ))}
                </div>
              </div>
              <button
                disabled
                title="Custom report generation is not available yet"
                className="w-full py-2.5 rounded-lg text-white text-[13px] mt-4 cursor-not-allowed opacity-50"
                style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 600 }}
              >
                Generate Report
              </button>
            </div>
          </div>

          {/* Right - Preview */}
          <div className="bg-white rounded-xl border p-6 xl:col-span-2" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2>Report Preview</h2>
              <button
                disabled
                title="No report has been generated yet"
                className="flex items-center gap-2 px-4 py-2 rounded-lg border text-[13px] cursor-not-allowed opacity-50"
                style={{ borderColor: '#E2E8E2', color: '#4A5568', fontWeight: 500 }}
              >
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
            <div className="flex flex-col items-center justify-center py-16" style={{ background: '#F4F7F4', borderRadius: 12 }}>
              <BarChart3 className="w-12 h-12 mb-4" style={{ color: '#9CA3AF' }} />
              <p className="text-[15px] mb-1" style={{ color: '#0A0A0A', fontWeight: 500 }}>No report generated yet</p>
              <p className="text-[13px]" style={{ color: '#9CA3AF' }}>Configure parameters and click "Generate Report"</p>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Reports section removed — not yet functional in POC phase */}
    </div>
  );
}
