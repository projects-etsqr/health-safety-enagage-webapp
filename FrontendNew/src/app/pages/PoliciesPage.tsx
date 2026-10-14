import { useState, useEffect } from "react";
import { SeverityBadge, StatusBadge } from "../components/shared/StatusBadge";
import { Plus, X, ChevronRight, ChevronDown, Edit, Trash2, Building2, Factory, MapPin } from "lucide-react";
import { getPolicies, type PolicyRecord } from "../../services/analytics.service";

function policyToRule(p: PolicyRecord) {
  return {
    id: `POL-${String(p.id).padStart(3, '0')}`,
    name: p.policy_name,
    zone: p.category || "General",
    ppe: "See Policy",
    severity: "Medium" as const,
    shift: "All",
    conditions: "Always",
    status: p.status || "Active",
    version: p.owner ? `By: ${p.owner}` : "v1.0",
  };
}

const slaConfig = [
  { severity: "Critical", resolution: "2 hours", warning: "1 hour", escalate: "2 hours" },
  { severity: "High", resolution: "8 hours", warning: "4 hours", escalate: "8 hours" },
  { severity: "Medium", resolution: "24 hours", warning: "12 hours", escalate: "24 hours" },
  { severity: "Low", resolution: "72 hours", warning: "48 hours", escalate: "72 hours" },
];

export function PoliciesPage() {
  const [activeTab, setActiveTab] = useState("active");
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderStep, setBuilderStep] = useState(1);
  const [showTree, setShowTree] = useState(false);
  const [policyRecords, setPolicyRecords] = useState<PolicyRecord[]>([]);

  useEffect(() => {
    getPolicies(100).then(setPolicyRecords).catch(console.error);
  }, []);

  const rules = policyRecords.map(policyToRule);

  const tabs = [
    { id: "active", label: "Active Rules" },
    { id: "history", label: "Rule History" },
    { id: "sla", label: "SLA Configuration" },
    { id: "escalation", label: "Escalation Rules" },
    { id: "auto", label: "Auto-Assignment" },
  ];

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <h1>Policies & Rules</h1>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b" style={{ borderColor: '#E2E8E2' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-[13px] transition-colors relative"
            style={{
              color: activeTab === tab.id ? '#1B5E20' : '#4A5568',
              fontWeight: activeTab === tab.id ? 600 : 400,
            }}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)' }} />
            )}
          </button>
        ))}
      </div>

      {activeTab === "active" && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <button
                onClick={() => setShowTree(!showTree)}
                className="px-3 py-2 rounded-lg border text-[14px] transition-colors hover:bg-[#F4F7F4]"
                style={{ borderColor: '#E2E8E2', color: '#4A5568', fontWeight: 500 }}
              >
                {showTree ? "Table View" : "Hierarchy View"}
              </button>
            </div>
            <button
              onClick={() => setShowBuilder(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[14px]"
              style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 600 }}
            >
              <Plus className="w-4 h-4" /> Create Rule
            </button>
          </div>

          {showTree ? (
            <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
              <h2 className="mb-4">Rule Inheritance</h2>
              <div className="space-y-2">
                <TreeItem icon={Building2} label="Company Level Rules" level={0} expanded>
                  <TreeItem icon={Factory} label="Plant Alpha Rules" level={1} expanded>
                    <TreeItem icon={MapPin} label="Zone A - Main Hall" level={2} count={2} />
                    <TreeItem icon={MapPin} label="Zone B - Loading Dock" level={2} count={3} />
                    <TreeItem icon={MapPin} label="Zone C - Chemical Store" level={2} count={4} expanded>
                      <TreeItem icon={MapPin} label="Zone C1 - Storage Area" level={3} count={1} />
                    </TreeItem>
                  </TreeItem>
                  <TreeItem icon={Factory} label="Plant Beta Rules" level={1} count={5} />
                </TreeItem>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#F4F7F4' }}>
                    {["Rule Name", "Zone", "PPE Required", "Severity", "Shift", "Conditions", "Status", "Version", "Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-left">
                        <span className="text-[12px] uppercase tracking-[0.4px]" style={{ color: '#9CA3AF', fontWeight: 600 }}>{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map(r => (
                    <tr key={r.id} className="group hover:bg-[#F9FBF9] transition-colors" style={{ borderBottom: '1px solid #EEF2EE' }}>
                      <td className="px-4 py-3 text-[14px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{r.name}</td>
                      <td className="px-4 py-3 text-[14px]" style={{ color: '#4A5568' }}>{r.zone}</td>
                      <td className="px-4 py-3 text-[14px]" style={{ color: '#0A0A0A' }}>{r.ppe}</td>
                      <td className="px-4 py-3"><SeverityBadge severity={r.severity} /></td>
                      <td className="px-4 py-3 text-[14px]" style={{ color: '#4A5568' }}>{r.shift}</td>
                      <td className="px-4 py-3 text-[14px]" style={{ color: '#4A5568' }}>{r.conditions}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-[14px]" style={{ color: '#9CA3AF' }}>{r.version}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#E8F5E9]">
                            <Edit className="w-4 h-4" style={{ color: '#4A5568' }} />
                          </button>
                          <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50">
                            <Trash2 className="w-4 h-4" style={{ color: '#DC2626' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === "sla" && (
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F4F7F4' }}>
                {["Severity", "Resolution Time", "Warning At", "Escalate After"].map(h => (
                  <th key={h} className="px-6 py-3 text-left">
                    <span className="text-[12px] uppercase tracking-[0.4px]" style={{ color: '#9CA3AF', fontWeight: 600 }}>{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slaConfig.map(s => (
                <tr key={s.severity} style={{ borderBottom: '1px solid #EEF2EE' }}>
                  <td className="px-6 py-4"><SeverityBadge severity={s.severity as any} /></td>
                  <td className="px-6 py-4 text-[14px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{s.resolution}</td>
                  <td className="px-6 py-4 text-[14px]" style={{ color: '#F59E0B', fontWeight: 500 }}>{s.warning}</td>
                  <td className="px-6 py-4 text-[14px]" style={{ color: '#DC2626', fontWeight: 500 }}>{s.escalate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rule Builder Slide-over */}
      {showBuilder && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowBuilder(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-white z-50 shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: '#E2E8E2' }}>
              <h2>Create Safety Rule</h2>
              <button onClick={() => setShowBuilder(false)} className="p-1.5 rounded-lg hover:bg-[#F4F7F4]">
                <X className="w-5 h-5" style={{ color: '#4A5568' }} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Steps */}
              <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    onClick={() => setBuilderStep(s)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] transition-all"
                    style={{
                      background: builderStep >= s ? 'linear-gradient(135deg, #1B5E20, #2E7D32)' : '#F3F4F6',
                      color: builderStep >= s ? '#fff' : '#9CA3AF',
                      fontWeight: 600,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {builderStep === 1 && (
                <div className="space-y-4">
                  <h3>Step 1 — Scope</h3>
                  <div>
                    <label className="block mb-1.5">Site</label>
                    <select className="w-full h-10 px-3 rounded-lg border text-[14px] bg-white" style={{ borderColor: '#E2E8E2' }}>
                      <option>Select site...</option>
                      <option>Plant Alpha</option>
                      <option>Plant Beta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1.5">Zone</label>
                    <select className="w-full h-10 px-3 rounded-lg border text-[14px] bg-white" style={{ borderColor: '#E2E8E2' }}>
                      <option>Select zone...</option>
                      <option>Zone A</option>
                      <option>Zone B</option>
                      <option>Zone C</option>
                    </select>
                  </div>
                </div>
              )}
              {builderStep === 2 && (
                <div className="space-y-4">
                  <h3>Step 2 — PPE Requirements</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {["Helmet", "Safety Vest", "Safety Shoes", "Gloves", "Goggles"].map(ppe => (
                      <label key={ppe} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-[#F4F7F4]" style={{ borderColor: '#E2E8E2', textTransform: 'none', fontSize: '13px', color: '#0A0A0A', fontWeight: 400 }}>
                        <input type="checkbox" className="w-4 h-4 rounded accent-[#2E7D32]" />
                        {ppe}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {builderStep === 3 && (
                <div className="space-y-4">
                  <h3>Step 3 — Severity</h3>
                  <div className="space-y-2">
                    {(["Low", "Medium", "High", "Critical"] as const).map(s => (
                      <label key={s} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-[#F4F7F4]" style={{ borderColor: '#E2E8E2', textTransform: 'none', fontSize: '13px', color: '#0A0A0A', fontWeight: 400 }}>
                        <input type="radio" name="severity" className="w-4 h-4 accent-[#2E7D32]" />
                        <SeverityBadge severity={s} />
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {builderStep === 4 && (
                <div className="space-y-4">
                  <h3>Step 4 — Conditions</h3>
                  <div>
                    <label className="block mb-1.5">Shift</label>
                    <div className="flex gap-2">
                      {["Day", "Night", "All"].map(s => (
                        <button key={s} className="px-4 py-2 rounded-lg border text-[14px]" style={{ borderColor: '#E2E8E2', color: '#4A5568' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1.5">Time Window</label>
                    <div className="flex gap-3">
                      <input type="time" className="flex-1 h-10 px-3 rounded-lg border text-[14px]" style={{ borderColor: '#E2E8E2' }} />
                      <input type="time" className="flex-1 h-10 px-3 rounded-lg border text-[14px]" style={{ borderColor: '#E2E8E2' }} />
                    </div>
                  </div>
                </div>
              )}
              {builderStep === 5 && (
                <div className="space-y-4">
                  <h3>Step 5 — Confidence Threshold</h3>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label>Threshold</label>
                      <span className="text-[14px]" style={{ color: '#1B5E20', fontWeight: 600 }}>75%</span>
                    </div>
                    <input type="range" min="0" max="100" defaultValue="75" className="w-full accent-[#2E7D32]" />
                    <div className="flex justify-between mt-1">
                      <span className="text-[12px]" style={{ color: '#9CA3AF' }}>0%</span>
                      <span className="text-[12px]" style={{ color: '#9CA3AF' }}>100%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: '#E2E8E2' }}>
              <button onClick={() => setShowBuilder(false)} className="px-4 py-2 rounded-lg text-[14px]" style={{ color: '#4A5568', fontWeight: 500 }}>
                Cancel
              </button>
              <button className="px-6 py-2 rounded-lg text-white text-[14px]" style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 600 }}>
                Save Rule
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TreeItem({ icon: Icon, label, level, count, expanded, children }: {
  icon: any; label: string; level: number; count?: number; expanded?: boolean; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(expanded ?? false);
  return (
    <div style={{ marginLeft: level * 24 }}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 py-2 w-full hover:bg-[#F4F7F4] rounded-lg px-2 transition-colors">
        {children ? (open ? <ChevronDown className="w-4 h-4" style={{ color: '#9CA3AF' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#9CA3AF' }} />) : <div className="w-4" />}
        <Icon className="w-4 h-4" style={{ color: '#2E7D32' }} />
        <span className="text-[14px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{label}</span>
        {count !== undefined && (
          <span className="text-[12px] px-2 py-0.5 rounded-full" style={{ background: '#E8F5E9', color: '#1B5E20', fontWeight: 500 }}>{count} rules</span>
        )}
      </button>
      {open && children}
    </div>
  );
}
