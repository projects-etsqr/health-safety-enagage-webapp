import { useParams, useNavigate } from "react-router";
import { SeverityBadge, StatusBadge } from "../components/shared/StatusBadge";
import {
  ChevronRight, ArrowLeft, Check, Clock, AlertTriangle,
  Send, FileText, ShieldCheck, UserPlus
} from "lucide-react";
import { useState, useEffect } from "react";
import { getViolationDetail, type ViolationDetail } from "../../services/analytics.service";
import { updateIncidentStatus, updateCapaAction, completeCapaAction } from "../../services/violations.service";
import axiosInstance from "../../api/axiosInstance";

const STATUS_STEPS = ["Detected", "Assigned", "Acknowledged", "In Progress", "Closed"];

function timelineIcon(type: string) {
  if (type === "reported") return AlertTriangle;
  if (type === "capa") return ShieldCheck;
  if (type === "closed") return Check;
  return UserPlus;
}

function timelineColor(type: string) {
  if (type === "reported") return "#DC2626";
  if (type === "capa") return "#0284C7";
  if (type === "closed") return "#16A34A";
  return "#6D28D9";
}

function normaliseSeverity(s: string): "Low" | "Medium" | "High" | "Critical" {
  const lower = s.toLowerCase();
  if (lower === "critical" || lower === "high" || lower === "medium" || lower === "low") {
    return s as "Low" | "Medium" | "High" | "Critical";
  }
  return "Low";
}

export function ViolationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [comment, setComment] = useState("");
  const [detail, setDetail] = useState<ViolationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [employees, setEmployees] = useState<{ id: number; full_name: string }[]>([]);
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    const numId = parseInt(id.replace(/^INC-0*/i, ""), 10);
    if (isNaN(numId)) { setNotFound(true); setLoading(false); return; }
    getViolationDetail(numId)
      .then((d) => { setDetail(d); setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  useEffect(() => {
    axiosInstance.get<{ id: number; full_name: string }[]>('/employees/')
      .then((r) => setEmployees(r.data))
      .catch((e) => console.error("Error loading employees", e));
  }, []);

  useEffect(() => {
    if (!detail?.assignee) {
      setAssignedEmployeeId("");
      return;
    }
    const match = employees.find((emp) => emp.full_name === detail.assignee?.name);
    setAssignedEmployeeId(match ? String(match.id) : "");
  }, [detail?.assignee, employees]);

  const incidentId = id ? parseInt(id.replace(/^INC-0*/i, ""), 10) : NaN;

  const refreshDetail = async () => {
    if (Number.isNaN(incidentId)) return;
    const updated = await getViolationDetail(incidentId);
    setDetail(updated);
  };

  const changeStatus = async (nextStatus: string) => {
    if (Number.isNaN(incidentId) || !detail) return;
    setActionLoading(true);
    try {
      await updateIncidentStatus(incidentId, nextStatus);
      await refreshDetail();
    } finally {
      setActionLoading(false);
    }
  };

  const getPrimaryCapaActionId = () => {
    const raw = detail?.capa_actions?.[0]?.id ?? "";
    const match = raw.match(/(\d+)/);
    return match ? Number(match[1]) : NaN;
  };

  const saveDueDate = async (nextDate: string) => {
    const actionId = getPrimaryCapaActionId();
    if (Number.isNaN(actionId)) return;
    setActionLoading(true);
    try {
      await updateCapaAction(actionId, { due_date: nextDate || undefined });
      await refreshDetail();
    } finally {
      setActionLoading(false);
    }
  };

  const reassignAction = async () => {
    const actionId = getPrimaryCapaActionId();
    if (Number.isNaN(actionId)) return;
    if (!assignedEmployeeId) return;
    setActionLoading(true);
    try {
      await updateCapaAction(actionId, { responsible_person_id: Number(assignedEmployeeId) });
      await refreshDetail();
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptCapa = async (rawId: string) => {
    const match = rawId.match(/(\d+)/);
    const actionId = match ? Number(match[1]) : NaN;
    if (Number.isNaN(actionId)) return;
    setActionLoading(true);
    try {
      await completeCapaAction(actionId);
      await refreshDetail();
    } catch (e) {
      console.error(e);
      alert("Failed to accept CAPA action");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-[14px]" style={{ color: '#9CA3AF' }}>
        Loading incident detail…
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <AlertTriangle className="w-10 h-10" style={{ color: '#F59E0B' }} />
        <p className="text-[15px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>Incident not found</p>
        <button onClick={() => navigate("/violations")} className="text-[13px]" style={{ color: '#2E7D32' }}>
          ← Back to Incidents
        </button>
      </div>
    );
  }

  const currentStep = detail.status_step;
  const severityNorm = normaliseSeverity(detail.severity);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/violations")} className="flex items-center gap-1 text-[13px]" style={{ color: '#2E7D32', fontWeight: 500 }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
        <span className="text-[13px]" style={{ color: '#9CA3AF' }}>Incidents</span>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
        <span className="text-[13px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{detail.id}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 xl:col-span-2">
          {/* Incident Info Card */}
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <div className="flex items-center gap-3 mb-6">
              <h1 style={{ fontSize: 'clamp(1.35rem, 2.2vw, 1.75rem)' }}>{detail.id}</h1>
              <SeverityBadge severity={severityNorm} />
              <StatusBadge status={detail.investigation_status} />
            </div>

            {/* Status Tracker */}
            <div className="mb-6 overflow-x-auto">
              <div className="mb-2 flex min-w-[680px] items-center justify-between">
                {STATUS_STEPS.map((step, i) => (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] mb-1"
                        style={{
                          background: i <= currentStep ? 'linear-gradient(135deg, #1B5E20, #2E7D32)' : '#F3F4F6',
                          color: i <= currentStep ? '#fff' : '#9CA3AF',
                          fontWeight: 600,
                        }}
                      >
                        {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
                      </div>
                      <span className="text-[12px]" style={{ color: i <= currentStep ? '#1B5E20' : '#9CA3AF', fontWeight: 500 }}>{step}</span>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className="flex-1 h-0.5 mx-2 mt-[-16px]" style={{ background: i < currentStep ? '#2E7D32' : '#E2E8E2' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px mb-6" style={{ background: '#EEF2EE' }} />

            {/* Details Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                { label: "Type", value: detail.incident_type },
                { label: "Zone", value: detail.zone },
                { label: "Site", value: detail.site },
                { label: "Station", value: detail.station },
                { label: "Reported By", value: detail.reporter },
                { label: "Timestamp", value: detail.incident_datetime },
                { label: "Persons Involved", value: String(detail.number_persons_involved) },
                { label: "Days Away", value: detail.days_away > 0 ? String(detail.days_away) : "None" },
                { label: "Permit Active", value: detail.permit_active },
                { label: "Control Failure", value: detail.control_failure },
                { label: "Reporting Channel", value: detail.source || "Web App" },
              ].map(d => (
                <div key={d.label}>
                  <label className="block mb-1">{d.label}</label>
                  <span className="text-[14px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{d.value}</span>
                </div>
              ))}
            </div>

            {detail.description && (
              <div className="mt-4">
                <label className="block mb-2">Description</label>
                <p className="text-[14px]" style={{ color: '#4A5568' }}>{detail.description}</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block mb-2">Immediate Cause</label>
                <p className="text-[14px]" style={{ color: '#4A5568' }}>{detail.immediate_cause}</p>
              </div>
              <div>
                <label className="block mb-2">Root Cause</label>
                <p className="text-[14px]" style={{ color: '#4A5568' }}>{detail.root_cause}</p>
              </div>
            </div>
          </div>

          {/* Event Timeline */}
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-6">Event History</h2>
            {detail.timeline.length === 0 ? (
              <p className="text-[13px] py-2" style={{ color: '#9CA3AF' }}>No timeline events available</p>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px" style={{ background: '#E2E8E2' }} />
                {detail.timeline.map((event, i) => {
                  const Icon = timelineIcon(event.type);
                  const color = timelineColor(event.type);
                  return (
                    <div key={i} className="flex gap-4 mb-6 last:mb-0 relative">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center z-10 flex-shrink-0" style={{ background: color + '20' }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <div>
                        <div className="text-[14px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{event.action}</div>
                        <div className="text-[13px]" style={{ color: '#9CA3AF' }}>{event.user} · {event.time}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CAPA Actions */}
          {detail.capa_actions.length > 0 && (
            <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
              <h2 className="mb-4">CAPA Actions</h2>
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#F4F7F4' }}>
                    {["ID", "Action", "Description", "Owner", "Due Date", "Status", "Actions"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] uppercase" style={{ color: '#9CA3AF', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.capa_actions.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #EEF2EE' }}>
                      <td className="px-3 py-2 text-[12px] font-mono" style={{ color: '#4A5568' }}>{c.id}</td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{c.action_type}</td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: '#4A5568' }}>{c.description || "—"}</td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: '#4A5568' }}>{c.responsible_person}</td>
                      <td className="px-3 py-2 text-[13px]" style={{ color: '#4A5568' }}>{c.due_date || "—"}</td>
                      <td className="px-3 py-2"><StatusBadge status={c.status} size="sm" /></td>
                      <td className="px-3 py-2">
                        {c.status !== "Completed" && c.status !== "Closed" && c.status !== "Verified" && c.status !== "Done" && (
                          <button
                            onClick={() => handleAcceptCapa(c.id)}
                            disabled={actionLoading}
                            className="px-2 py-1 text-[12px] bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50 font-medium"
                          >
                            Accept
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Comments */}
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-6">Comments & Notes</h2>
            <div className="mb-6 flex flex-col items-center justify-center py-8" style={{ background: '#F4F7F4', borderRadius: 10 }}>
              <FileText className="w-8 h-8 mb-2" style={{ color: '#D1D5DB' }} />
              <p className="text-[13px]" style={{ color: '#9CA3AF' }}>No comments yet</p>
            </div>
            <div className="flex gap-3">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 h-10 px-4 rounded-lg border text-[14px] focus:outline-none"
                style={{ borderColor: '#E2E8E2' }}
                onFocus={(e) => { e.target.style.borderColor = '#2E7D32'; }}
                onBlur={(e) => { e.target.style.borderColor = '#E2E8E2'; }}
              />
              <button className="h-10 px-4 rounded-lg text-white text-[14px]" style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 500 }}>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h3 className="mb-4">Status Actions</h3>
            <div className="mb-4">
              <StatusBadge status={detail.investigation_status} />
            </div>
            <div className="space-y-2">
              <button onClick={() => changeStatus("Acknowledged")} disabled={actionLoading} className="w-full py-2 rounded-lg border text-[14px] transition-colors hover:bg-[#F4F7F4]" style={{ borderColor: '#E2E8E2', color: '#0A0A0A', fontWeight: 500 }}>Acknowledge</button>
              <button onClick={() => changeStatus("In Progress")} disabled={actionLoading} className="w-full py-2 rounded-lg border text-[14px] transition-colors hover:bg-[#F4F7F4]" style={{ borderColor: '#E2E8E2', color: '#0A0A0A', fontWeight: 500 }}>Mark In Progress</button>
              <button onClick={() => changeStatus("Closed")} disabled={actionLoading} className="w-full py-2 rounded-lg text-white text-[14px]" style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 500 }}>Close Incident</button>
              <button onClick={() => changeStatus("False Positive")} disabled={actionLoading} className="w-full py-2 rounded-lg border text-[14px] transition-colors hover:bg-gray-50" style={{ borderColor: '#E2E8E2', color: '#9CA3AF', fontWeight: 500 }}>False Positive</button>
              <button onClick={() => changeStatus("Open")} disabled={actionLoading} className="w-full py-2 rounded-lg text-[14px] text-[#DC2626] border transition-colors hover:bg-red-50" style={{ borderColor: '#FEE2E2', fontWeight: 500 }}>Reopen</button>
            </div>
          </div>

          {/* Assignment Card */}
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h3 className="mb-4">Assignment</h3>
            {detail.assignee ? (
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px]" style={{ background: 'linear-gradient(135deg, #1B5E20, #43A047)', fontWeight: 600 }}>
                  {detail.assignee.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-[14px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{detail.assignee.name}</div>
                  <div className="text-[13px]" style={{ color: '#9CA3AF' }}>{detail.assignee.role}</div>
                </div>
              </div>
            ) : (
              <p className="text-[13px] mb-4" style={{ color: '#9CA3AF' }}>No assignee yet</p>
            )}
            <div className="mb-4">
              <label className="block mb-1.5 text-[13px]" style={{ color: '#4A5568', fontWeight: 600 }}>Assign to Employee</label>
              <select
                value={assignedEmployeeId}
                onChange={(e) => setAssignedEmployeeId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border text-[14px] bg-white focus:outline-none"
                style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
              >
                <option value="">Select Employee...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.full_name}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={reassignAction} disabled={actionLoading || !assignedEmployeeId} className="w-full py-2 rounded-lg border text-[14px] transition-colors hover:bg-[#F4F7F4]" style={{ borderColor: '#E2E8E2', color: '#2E7D32', fontWeight: 500 }}>
              {detail.assignee ? "Reassign" : "Assign"}
            </button>
            {detail.due_date && (
              <div className="mt-4">
                <label className="block mb-1.5">Due Date</label>
                <input
                  type="date"
                  defaultValue={detail.due_date}
                  onChange={(e) => saveDueDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border text-[14px]"
                  style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                />
              </div>
            )}
          </div>

          {/* Resolution Form */}
          <div className="bg-white rounded-xl border p-6 relative overflow-hidden" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32, #43A047)' }} />
            <h3 className="mb-4">Resolution</h3>
            <div className="space-y-4">
              <div>
                <label className="block mb-1.5">Corrective Action Taken</label>
                <textarea
                  placeholder="Describe the corrective action..."
                  className="w-full h-24 px-3 py-2 rounded-lg border text-[14px] resize-none focus:outline-none"
                  style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                />
              </div>
              <div>
                <label className="block mb-1.5">Root Cause</label>
                <select className="w-full h-10 px-3 rounded-lg border text-[14px] bg-white" style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}>
                  <option>Select root cause...</option>
                  <option>Lack of Training</option>
                  <option>PPE Not Available</option>
                  <option>Worker Negligence</option>
                  <option>Equipment Malfunction</option>
                  <option>Inadequate Signage</option>
                </select>
              </div>
              <button onClick={() => changeStatus("Closed")} disabled={actionLoading} className="w-full py-2.5 rounded-lg text-white text-[14px]" style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 600 }}>
                Close Incident
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
