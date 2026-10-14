import { useEffect, useMemo, useState } from "react";
import { StatusBadge, ZoneBadge } from "../components/shared/StatusBadge";
import { Plus, MapPin, Edit, Trash2, ChevronRight, ChevronDown, X } from "lucide-react";
import { getShifts, getSites, getZones, type Shift, type Site, type Zone } from "../../services/infrastructure.service";

export function SitesZonesPage() {
  const [activeTab, setActiveTab] = useState("sites");
  const [showModal, setShowModal] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [siteRows, zoneRows, shiftRows] = await Promise.all([
          getSites(),
          getZones(),
          getShifts(),
        ]);
        setSites(siteRows || []);
        setZones(zoneRows || []);
        setShifts(shiftRows || []);
      } catch {
        setSites([]);
        setZones([]);
        setShifts([]);
      }
    };
    load();
  }, []);

  const siteNameById = useMemo(() => {
    const index: Record<string, string> = {};
    sites.forEach((s) => {
      index[String(s.Site_ID)] = s.Site_Name;
    });
    return index;
  }, [sites]);

  const tabs = [
    { id: "sites", label: "Sites" },
    { id: "zones", label: "Zones" },
    { id: "shifts", label: "Shifts" },
  ];

  return (
    <div className="space-y-6">
      <h1>Sites, Zones & Shifts</h1>

      <div className="flex gap-1 overflow-x-auto border-b" style={{ borderColor: '#DBE7FF' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-[13px] transition-colors relative"
            style={{
              color: activeTab === tab.id ? '#1D4ED8' : '#4A5568',
              fontWeight: activeTab === tab.id ? 600 : 400,
            }}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)' }} />
            )}
          </button>
        ))}
      </div>

      {activeTab === "sites" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.map(site => (
            <div key={site.Site_ID} className="bg-white rounded-xl border p-5" style={{ borderColor: '#E6EEFF', boxShadow: '0px 2px 12px rgba(11, 61, 145, 0.08)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3>{site.Site_Name}</h3>
                <StatusBadge status={site.Status} size="sm" />
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-[13px]" style={{ color: '#4A5568' }}>
                  <MapPin className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} /> {site.Location || '—'}
                </div>
                <div className="text-[12px]" style={{ color: '#9CA3AF' }}>{site.Timezone || '—'}</div>
                <div className="text-[12px]" style={{ color: '#9CA3AF' }}>{site.Total_Zones ?? 0} zones</div>
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[11px] uppercase tracking-[0.5px]" style={{ color: '#9CA3AF', fontWeight: 500 }}>Compliance</span>
                  <span className="text-[13px]" style={{ color: '#1D4ED8', fontWeight: 600 }}>{site.Compliance_Rate ?? 0}%</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: '#F3F7FF' }}>
                  <div className="h-full rounded-full" style={{ width: `${site.Compliance_Rate ?? 0}%`, background: 'linear-gradient(135deg, #0B3D91, #3B82F6)' }} />
                </div>
              </div>
            </div>
          ))}
          {/* Add Site Card */}
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl border-2 border-dashed p-5 flex flex-col items-center justify-center gap-3 transition-colors hover:bg-[#F3F7FF]"
            style={{ borderColor: '#DBE7FF' }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#EFF6FF' }}>
              <Plus className="w-6 h-6" style={{ color: '#1D4ED8' }} />
            </div>
            <span className="text-[13px]" style={{ color: '#1D4ED8', fontWeight: 500 }}>Add Site</span>
          </button>
        </div>
      )}

      {activeTab === "zones" && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <select className="px-3 py-2 rounded-lg border text-[13px] bg-white" style={{ borderColor: '#DBE7FF', color: '#4A5568' }}>
              <option>All Sites</option>
              {sites.map((s) => (
                <option key={s.Site_ID}>{s.Site_Name}</option>
              ))}
            </select>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px]" style={{ background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)', fontWeight: 600 }}>
              <Plus className="w-4 h-4" /> Add Zone
            </button>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E6EEFF', boxShadow: '0px 2px 12px rgba(11, 61, 145, 0.08)' }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
              <thead>
                <tr style={{ background: '#F3F7FF' }}>
                  {["Zone Name", "Type", "Parent Site", "Parent Zone", "Risk Score", "Status", "Time Activation", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left">
                      <span className="text-[11px] uppercase tracking-[0.5px]" style={{ color: '#9CA3AF', fontWeight: 600 }}>{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zones.map(z => (
                  <tr key={z.Zone_ID} className="group hover:bg-[#F8FAFF] transition-colors" style={{ borderBottom: '1px solid #E6EEFF' }}>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{z.Zone_Name}</td>
                    <td className="px-4 py-3"><ZoneBadge type={z.Zone_Type || 'General'} /></td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#4A5568' }}>{siteNameById[String(z.Site_ID)] || z.Site_ID}</td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#9CA3AF' }}>{z.Parent_Zone || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full" style={{ background: '#F3F7FF' }}>
                          <div className="h-full rounded-full" style={{ width: `${z.Risk_Score ?? 0}%`, background: (z.Risk_Score ?? 0) > 70 ? '#DC2626' : (z.Risk_Score ?? 0) > 40 ? '#F59E0B' : '#1D4ED8' }} />
                        </div>
                        <span className="text-[12px]" style={{ color: '#4A5568', fontWeight: 500 }}>{z.Risk_Score ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={z.Status} size="sm" /></td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#4A5568' }}>{z.Time_Activation || '24/7'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#EFF6FF]">
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
          </div>
        </>
      )}

      {activeTab === "shifts" && (
        <>
          <div className="flex justify-end">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px]" style={{ background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)', fontWeight: 600 }}>
              <Plus className="w-4 h-4" /> Add Shift
            </button>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E6EEFF', boxShadow: '0px 2px 12px rgba(11, 61, 145, 0.08)' }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
              <thead>
                <tr style={{ background: '#F3F7FF' }}>
                  {["Shift Name", "Start Time", "End Time", "Sites", "Active Employees"].map(h => (
                    <th key={h} className="px-6 py-3 text-left">
                      <span className="text-[11px] uppercase tracking-[0.5px]" style={{ color: '#9CA3AF', fontWeight: 600 }}>{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shifts.map(s => (
                  <tr key={s.Shift_ID} style={{ borderBottom: '1px solid #E6EEFF' }}>
                    <td className="px-6 py-4 text-[13px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{s.Shift_Name}</td>
                    <td className="px-6 py-4 text-[13px]" style={{ color: '#4A5568' }}>{s.Start_Time}</td>
                    <td className="px-6 py-4 text-[13px]" style={{ color: '#4A5568' }}>{s.End_Time}</td>
                    <td className="px-6 py-4 text-[13px]" style={{ color: '#4A5568' }}>{s.Sites}</td>
                    <td className="px-6 py-4 text-[13px]" style={{ color: '#1D4ED8', fontWeight: 500 }}>{s.Active_Rules}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Site Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowModal(false)} />
          <div className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-[560px] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white" style={{ boxShadow: '0px 8px 32px rgba(0,0,0,0.16)' }}>
            <div className="h-[3px]" style={{ background: 'linear-gradient(135deg, #0B3D91, #1D4ED8, #3B82F6)' }} />
            <div className="px-8 py-6">
              <div className="flex items-center justify-between mb-6">
                <h2>Add New Site</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-[#F3F7FF]">
                  <X className="w-5 h-5" style={{ color: '#4A5568' }} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1.5">Site Name</label>
                  <input className="w-full h-10 px-4 rounded-lg border text-[13px]" style={{ borderColor: '#DBE7FF' }} placeholder="Enter site name" />
                </div>
                <div>
                  <label className="block mb-1.5">Location</label>
                  <input className="w-full h-10 px-4 rounded-lg border text-[13px]" style={{ borderColor: '#DBE7FF' }} placeholder="City, State" />
                </div>
                <div>
                  <label className="block mb-1.5">Timezone</label>
                  <select className="w-full h-10 px-3 rounded-lg border text-[13px] bg-white" style={{ borderColor: '#DBE7FF' }}>
                    <option>Select timezone</option>
                    <option>EST (UTC-5)</option>
                    <option>CST (UTC-6)</option>
                    <option>MST (UTC-7)</option>
                    <option>PST (UTC-8)</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block mb-1.5">Operational Hours From</label>
                    <input type="time" className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: '#DBE7FF' }} />
                  </div>
                  <div>
                    <label className="block mb-1.5">Operational Hours To</label>
                    <input type="time" className="w-full h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: '#DBE7FF' }} />
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5">Contact Person</label>
                  <input className="w-full h-10 px-4 rounded-lg border text-[13px]" style={{ borderColor: '#DBE7FF' }} placeholder="Name" />
                </div>
                <div>
                  <label className="block mb-1.5">Contact Email</label>
                  <input type="email" className="w-full h-10 px-4 rounded-lg border text-[13px]" style={{ borderColor: '#DBE7FF' }} placeholder="email@company.com" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-[13px]" style={{ color: '#4A5568', fontWeight: 500 }}>
                  Cancel
                </button>
                <button className="px-6 py-2 rounded-lg text-white text-[13px]" style={{ background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)', fontWeight: 600 }}>
                  Add Site
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
