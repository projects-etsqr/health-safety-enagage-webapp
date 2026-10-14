import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Building2, Users, ClipboardList, Activity, ArrowRight, CheckCircle2, Clock, XCircle,
  Globe, Mail as MailIcon, Shield,
  AlertCircle, Send, RefreshCw, Plus, X, Loader2,
} from "lucide-react";
import {
  useListTenantsQuery,
  useListInvitesQuery,
  useInviteOrganisationMutation,
  useUpdateInviteStatusMutation,
  type OrganisationInvite,
} from "@/features/superadmin/api/adminApi";
import { useGetOnboardingProcessingQueueQuery } from "@/features/onboarding/api/onboardingApi";

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: typeof Building2; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border p-5 flex items-center gap-4" style={{ borderColor: "#E3E9F6" }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ color: "#111827" }}>{value}</div>
        <div className="text-[13px] font-medium" style={{ color: "#6B7280" }}>{label}</div>
        {sub && <div className="text-[11px]" style={{ color: "#9CA3AF" }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: "#10B981",
  pending: "#F59E0B",
  suspended: "#EF4444",
  inactive: "#9CA3AF",
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  active: CheckCircle2,
  pending: Clock,
  suspended: XCircle,
  inactive: XCircle,
};

// ── Invite Modal ──────────────────────────────────────────────────────────────

function InviteModal({
  open, onClose, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (invite: OrganisationInvite) => void;
}) {
  const [inviteOrg, { isLoading }] = useInviteOrganisationMutation();
  const [form, setForm] = useState({ organisation_name: "", admin_name: "", admin_email: "" });
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.organisation_name.trim() || !form.admin_name.trim() || !form.admin_email.trim()) {
      setError("All fields are required."); return;
    }
    const result = await inviteOrg(form);
    if ("error" in result) {
      const err = result.error as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? "Failed to send invite. Try again.");
      return;
    }
    onSuccess(result.data);
    setForm({ organisation_name: "", admin_name: "", admin_email: "" });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #4A57B9, #6F80E8)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Invite Organisation</h2>
              <p className="text-white/75 text-xs">Credentials will be sent to the admin email</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
              {error}
            </div>
          )}
          {[
            { name: "organisation_name", label: "Organisation Name", placeholder: "Acme Corp Ltd", type: "text" },
            { name: "admin_name", label: "Admin Full Name", placeholder: "Jane Smith", type: "text" },
            { name: "admin_email", label: "Admin Email Address", placeholder: "jane@acmecorp.com", type: "email" },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>{f.label}</label>
              <input
                type={f.type}
                value={form[f.name as keyof typeof form]}
                onChange={(e) => set(f.name, e.target.value)}
                placeholder={f.placeholder}
                required
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
                style={{ borderColor: "#E3E9F6" }}
              />
            </div>
          ))}
          <div className="p-3 rounded-xl text-xs leading-relaxed" style={{ background: "#F0F4FF", border: "1px solid #C7D7FD", color: "#1E40AF" }}>
            <strong>What happens next:</strong> A temporary password is auto-generated, a user account is created, and credentials are sent to the admin email.
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-semibold" style={{ borderColor: "#E3E9F6", color: "#374151" }}>Cancel</button>
            <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "linear-gradient(135deg, #4A57B9, #6F80E8)", opacity: isLoading ? 0.7 : 1 }}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isLoading ? "Sending…" : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Invites Table ─────────────────────────────────────────────────────────────

const INVITE_STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending:  { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A", label: "Pending" },
  accepted: { bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7", label: "Accepted" },
  expired:  { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA", label: "Expired" },
};

function InvitesTable({ invites, onStatusChange }: {
  invites: OrganisationInvite[];
  onStatusChange: (id: number, status: "pending" | "accepted" | "expired") => void;
}) {
  if (invites.length === 0) return (
    <div className="text-center py-10 text-sm" style={{ color: "#9CA3AF" }}>No invites yet</div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "#F9FAFB" }}>
            {["Organisation", "Admin Name", "Admin Email", "Status", "Invited On", "Actions"].map((h) => (
              <th key={h} className="px-5 py-3 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "#6B7280" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invites.map((inv) => {
            const s = INVITE_STATUS_STYLE[inv.status] ?? INVITE_STATUS_STYLE.expired;
            return (
              <tr key={inv.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: "#F3F4F6" }}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #4A57B9, #6F80E8)" }}>
                      {inv.organisation_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold" style={{ color: "#111827" }}>{inv.organisation_name}</span>
                  </div>
                </td>
                <td className="px-5 py-3" style={{ color: "#374151" }}>{inv.admin_name}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    <MailIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#9CA3AF" }} />
                    <span style={{ color: "#374151" }}>{inv.admin_email}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    {s.label}
                  </span>
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-xs" style={{ color: "#6B7280" }}>
                  {new Date(inv.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td className="px-5 py-3">
                  <select
                    value={inv.status}
                    onChange={(e) => onStatusChange(inv.id, e.target.value as "pending" | "accepted" | "expired")}
                    className="text-xs border rounded-lg px-2 py-1 outline-none"
                    style={{ borderColor: "#E3E9F6", color: "#374151" }}
                  >
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="expired">Expired</option>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { data: tenants = [], isLoading: tenantsLoading, refetch: refetchTenants } = useListTenantsQuery();
  const { data: invitesData, isLoading: invitesLoading, refetch: refetchInvites } = useListInvitesQuery();
  const { data: queue } = useGetOnboardingProcessingQueueQuery();
  const [updateStatus] = useUpdateInviteStatusMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tenants" | "invites">("tenants");

  const invites = invitesData?.items ?? [];
  const active = tenants.filter((t) => t.status === "active").length;
  const pending = tenants.filter((t) => t.status === "pending").length;
  const queueCount = queue?.items?.length ?? 0;

  const handleInviteSuccess = (invite: OrganisationInvite) => {
    setModalOpen(false);
    setSuccessMsg(`Invite sent to ${invite.admin_email} for ${invite.organisation_name}.`);
    setTimeout(() => setSuccessMsg(null), 6000);
    void refetchTenants();
    void refetchInvites();
  };

  const handleStatusChange = async (id: number, status: "pending" | "accepted" | "expired") => {
    await updateStatus({ inviteId: id, status });
    void refetchInvites();
    void refetchTenants();
  };

  return (
    <div className="p-6 space-y-6" style={{ background: "#F6F8FC", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#111827" }}>Super Admin Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>Platform-wide overview — all tenants, onboarding, system health</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { void refetchTenants(); void refetchInvites(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold"
            style={{ borderColor: "#E3E9F6", background: "#fff", color: "#374151" }}
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #4A57B9, #6F80E8)" }}
          >
            <Plus className="w-4 h-4" /> New Tenant
          </button>
        </div>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "#ECFDF5", border: "1px solid #6EE7B7" }}>
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#059669" }} />
          <p className="text-sm font-medium" style={{ color: "#065F46" }}>{successMsg}</p>
          <button className="ml-auto" onClick={() => setSuccessMsg(null)}><X className="w-4 h-4" style={{ color: "#6B7280" }} /></button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2}    label="Total Tenants"     value={tenantsLoading ? "…" : tenants.length} color="#4A57B9" />
        <StatCard icon={CheckCircle2} label="Active Tenants"    value={active}      color="#10B981" />
        <StatCard icon={Clock}        label="Pending Approval"  value={pending}     sub="Awaiting review"   color="#F59E0B" />
        <StatCard icon={ClipboardList} label="Processing Queue" value={queueCount}  sub="Onboarding jobs"   color="#8B5CF6" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["tenants", "invites"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} className="px-5 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all" style={activeTab === t ? { background: "#fff", color: "#4A57B9", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } : { color: "#6B7280" }}>
            {t === "tenants" ? `Tenants (${tenants.length})` : `Invites (${invites.length})`}
          </button>
        ))}
      </div>

      {/* Tenant list */}
      {activeTab === "tenants" && (
        <div className="bg-white rounded-2xl border" style={{ borderColor: "#E3E9F6" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#E9EEF8" }}>
            <h2 className="text-[15px] font-bold" style={{ color: "#111827" }}>Tenants</h2>
            <button onClick={() => setActiveTab("invites")} className="flex items-center gap-1 text-sm font-medium" style={{ color: "#4A57B9" }}>
              View invites <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {tenantsLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#4A57B9" }} /></div>
          ) : tenants.length === 0 ? (
            <div className="p-10 text-center">
              <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: "#D1D5DB" }} />
              <p className="text-sm font-medium mb-1" style={{ color: "#6B7280" }}>No tenants yet</p>
              <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>Send an invitation to create the first organisation admin account.</p>
              <button onClick={() => setModalOpen(true)} className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "linear-gradient(135deg, #4A57B9, #6F80E8)" }}>
                Invite First Tenant
              </button>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
              {tenants.slice(0, 8).map((tenant) => {
                const color = STATUS_COLORS[tenant.status] ?? "#9CA3AF";
                const Icon = STATUS_ICONS[tenant.status] ?? Activity;
                return (
                  <div
                    key={tenant.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: "linear-gradient(135deg, #4A57B9, #6F80E8)" }}>
                        {tenant.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "#111827" }}>{tenant.name}</div>
                        <div className="text-xs" style={{ color: "#9CA3AF" }}>{tenant.org_code} · {tenant.plan}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                      <span className="text-xs font-medium capitalize" style={{ color }}>{tenant.status}</span>
                    </div>
                  </div>
                );
              })}
              {tenants.length > 8 && (
                <div className="px-5 py-3 text-center">
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>Showing 8 of {tenants.length} tenants</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Invites table */}
      {activeTab === "invites" && (
        <div className="bg-white rounded-2xl border" style={{ borderColor: "#E3E9F6", overflow: "hidden" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#E9EEF8" }}>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold" style={{ color: "#111827" }}>Organisation Invites</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "#EEF2FF", color: "#4A57B9" }}>{invites.length}</span>
            </div>
            <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl" style={{ background: "#EEF2FF", color: "#4A57B9" }}>
              <Plus className="w-3.5 h-3.5" /> Send Invite
            </button>
          </div>
          {invitesLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#4A57B9" }} /></div>
          ) : (
            <InvitesTable invites={invites} onStatusChange={handleStatusChange} />
          )}
        </div>
      )}

      {/* Quick nav */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Tenant Management",   path: "/superadmin/tenants",       icon: Globe },
          { label: "Invitations",         path: "/superadmin/invitations",   icon: MailIcon },
          { label: "Users",               path: "/superadmin/users",         icon: Users },
          { label: "Roles & Permissions", path: "/superadmin/roles",         icon: Shield },
        ].map(({ label, path, icon: Icon }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="bg-white rounded-xl border p-4 flex flex-col items-start gap-3 text-left hover:shadow-md transition-shadow"
            style={{ borderColor: "#E3E9F6" }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#EEF2FB" }}>
              <Icon className="w-4 h-4" style={{ color: "#4A57B9" }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: "#111827" }}>{label}</span>
          </button>
        ))}
      </div>

      <InviteModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={handleInviteSuccess} />
    </div>
  );
}
