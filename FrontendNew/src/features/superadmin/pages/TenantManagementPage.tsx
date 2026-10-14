import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Building2, Search, Filter, Plus, RefreshCw, CheckCircle2, Clock,
  XCircle, AlertCircle, ChevronLeft, Eye, Trash2, MoreVertical,
  Mail, User, Calendar, Hash, CreditCard, Globe, Shield, X,
  Send, Loader2, CheckCheck, Ban, RotateCcw,
} from "lucide-react";
import {
  useListTenantsQuery,
  useUpdateTenantStatusMutation,
  useDeleteTenantMutation,
  useInviteOrganisationMutation,
  type Tenant,
  type OrganisationInvite,
} from "@/features/superadmin/api/adminApi";

// ── Types ─────────────────────────────────────────────────────────────────────

type TenantStatus = "active" | "pending" | "suspended";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<TenantStatus, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  active:    { label: "Active",    color: "#065F46", bg: "#D1FAE5", border: "#6EE7B7", icon: CheckCircle2 },
  pending:   { label: "Pending",   color: "#92400E", bg: "#FEF3C7", border: "#FDE68A", icon: Clock        },
  suspended: { label: "Suspended", color: "#991B1B", bg: "#FEE2E2", border: "#FECACA", icon: XCircle      },
};

const PLAN_COLORS: Record<string, string> = {
  Standard: "#4A57B9",
  Premium:  "#7C3AED",
  Enterprise: "#0891B2",
};

function avatarColor(name: string) {
  const colors = ["#4A57B9","#7C3AED","#0891B2","#059669","#D97706","#DC2626","#DB2777"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TenantStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border"
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onDismiss }: { msg: string; type: "success" | "error"; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold"
      style={{ background: type === "success" ? "#065F46" : "#991B1B", color: "#fff", minWidth: 260 }}>
      {type === "success" ? <CheckCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      <span className="flex-1">{msg}</span>
      <button onClick={onDismiss}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
    </div>
  );
}

// ── Confirm Delete Dialog ─────────────────────────────────────────────────────

function ConfirmDeleteDialog({ tenant, onConfirm, onCancel, loading }: {
  tenant: Tenant; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#FEE2E2" }}>
            <Trash2 className="w-5 h-5" style={{ color: "#DC2626" }} />
          </div>
          <div>
            <div className="font-bold" style={{ color: "#111827" }}>Delete Tenant</div>
            <div className="text-xs" style={{ color: "#6B7280" }}>This action cannot be undone</div>
          </div>
        </div>
        <p className="text-sm" style={{ color: "#374151" }}>
          Are you sure you want to delete <strong>{tenant.name}</strong>? The invite record will be removed and the admin account deactivated.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border text-sm font-semibold" style={{ borderColor: "#E3E9F6", color: "#374151" }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "#DC2626", opacity: loading ? 0.7 : 1 }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invite Modal ──────────────────────────────────────────────────────────────

function InviteModal({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: (inv: OrganisationInvite) => void;
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
      setError(err?.response?.data?.detail ?? "Failed to send invite."); return;
    }
    onSuccess(result.data);
    setForm({ organisation_name: "", admin_name: "", admin_email: "" });
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#4A57B9,#6F80E8)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">New Tenant</h2>
              <p className="text-white/75 text-xs">Credentials sent to admin email</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />{error}
            </div>
          )}
          {[
            { name: "organisation_name", label: "Organisation Name", placeholder: "Acme Corp Ltd", type: "text" },
            { name: "admin_name",        label: "Admin Full Name",   placeholder: "Jane Smith",    type: "text" },
            { name: "admin_email",       label: "Admin Email",       placeholder: "jane@acme.com", type: "email" },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>{f.label}</label>
              <input type={f.type} value={form[f.name as keyof typeof form]}
                onChange={(e) => set(f.name, e.target.value)}
                placeholder={f.placeholder} required
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
                style={{ borderColor: "#E3E9F6" }} />
            </div>
          ))}
          <div className="p-3 rounded-xl text-xs leading-relaxed" style={{ background: "#F0F4FF", border: "1px solid #C7D7FD", color: "#1E40AF" }}>
            <strong>What happens next:</strong> A temp password is generated, a user account is created, and credentials are emailed to the admin.
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-semibold" style={{ borderColor: "#E3E9F6", color: "#374151" }}>Cancel</button>
            <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "linear-gradient(135deg,#4A57B9,#6F80E8)", opacity: isLoading ? 0.7 : 1 }}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isLoading ? "Sending…" : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ tenant, onClose, onStatusChange, onDelete }: {
  tenant: Tenant;
  onClose: () => void;
  onStatusChange: (status: TenantStatus) => Promise<void>;
  onDelete: () => void;
}) {
  const [updating, setUpdating] = useState(false);

  const handleStatus = async (s: TenantStatus) => {
    setUpdating(true);
    await onStatusChange(s);
    setUpdating(false);
  };

  const col = avatarColor(tenant.name);
  const planColor = PLAN_COLORS[tenant.plan] ?? "#4A57B9";

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-[420px] h-full bg-white shadow-2xl flex flex-col border-l overflow-hidden" style={{ borderColor: "#E3E9F6" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b" style={{ borderColor: "#E3E9F6", background: "linear-gradient(135deg,#4A57B9,#6F80E8)" }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0" style={{ background: "rgba(255,255,255,0.2)" }}>
              {initials(tenant.name)}
            </div>
            <div>
              <div className="font-bold text-white text-base leading-tight">{tenant.name}</div>
              <div className="text-white/70 text-xs mt-0.5 font-mono">{tenant.org_code}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status */}
          <div className="bg-white rounded-2xl border p-4 space-y-3" style={{ borderColor: "#E3E9F6" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Status</span>
              <StatusBadge status={tenant.status as TenantStatus} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["active","pending","suspended"] as TenantStatus[]).map((s) => {
                const cfg = STATUS_CFG[s];
                const Icon = cfg.icon;
                const isCurrent = tenant.status === s;
                return (
                  <button key={s} disabled={isCurrent || updating} onClick={() => handleStatus(s)}
                    className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-semibold transition-all"
                    style={{
                      borderColor: isCurrent ? cfg.border : "#E3E9F6",
                      background: isCurrent ? cfg.bg : "#F9FAFB",
                      color: isCurrent ? cfg.color : "#6B7280",
                      opacity: updating && !isCurrent ? 0.5 : 1,
                    }}>
                    {updating && !isCurrent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-2xl border p-4 space-y-3" style={{ borderColor: "#E3E9F6" }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Organisation Details</div>
            {[
              { icon: Building2, label: "Name",     value: tenant.name },
              { icon: Hash,      label: "Org Code", value: tenant.org_code, mono: true },
              { icon: CreditCard,label: "Plan",     value: tenant.plan, colored: planColor },
              { icon: Globe,     label: "Status",   value: tenant.status },
              { icon: Calendar,  label: "Created",  value: fmtDate(tenant.created_at) },
            ].map(({ icon: Icon, label, value, mono, colored }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#F3F4F6" }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: "#6B7280" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>{label}</div>
                  <div className={`text-sm font-semibold truncate ${mono ? "font-mono" : ""}`} style={{ color: colored ?? "#111827" }}>{value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Admin */}
          <div className="bg-white rounded-2xl border p-4 space-y-3" style={{ borderColor: "#E3E9F6" }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Organisation Admin</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: col }}>
                {initials(tenant.admin_name)}
              </div>
              <div>
                <div className="font-semibold text-sm" style={{ color: "#111827" }}>{tenant.admin_name}</div>
                <div className="text-xs" style={{ color: "#6B7280" }}>{tenant.admin_email}</div>
              </div>
            </div>
          </div>

          {/* Plan */}
          <div className="rounded-2xl border p-4" style={{ borderColor: "#E3E9F6", background: "#F8FAFF" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: planColor }} />
                <span className="text-sm font-bold" style={{ color: planColor }}>{tenant.plan} Plan</span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: planColor + "18", color: planColor }}>
                Active Subscription
              </span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t flex gap-3" style={{ borderColor: "#E3E9F6" }}>
          <button onClick={onDelete}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors hover:bg-red-50"
            style={{ borderColor: "#FECACA", color: "#DC2626" }}>
            <Trash2 className="w-4 h-4" /> Delete Tenant
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tenant Card ───────────────────────────────────────────────────────────────

function TenantCard({ tenant, onView, onStatusChange, onDelete }: {
  tenant: Tenant;
  onView: () => void;
  onStatusChange: (s: TenantStatus) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const col = avatarColor(tenant.name);
  const planColor = PLAN_COLORS[tenant.plan] ?? "#4A57B9";

  return (
    <div className="bg-white rounded-2xl border hover:shadow-md transition-all duration-150 cursor-pointer group overflow-hidden"
      style={{ borderColor: "#E3E9F6" }} onClick={onView}>
      {/* Top strip */}
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${col}, ${col}88)` }} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${col}, ${col}bb)` }}>
              {initials(tenant.name)}
            </div>
            <div>
              <div className="font-bold text-[14px] leading-tight" style={{ color: "#111827" }}>{tenant.name}</div>
              <div className="text-[11px] font-mono mt-0.5" style={{ color: "#9CA3AF" }}>{tenant.org_code}</div>
            </div>
          </div>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMenuOpen((v) => !v)}>
              <MoreVertical className="w-4 h-4" style={{ color: "#6B7280" }} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 bg-white rounded-xl border shadow-xl z-10 w-44 overflow-hidden" style={{ borderColor: "#E3E9F6" }}
                onMouseLeave={() => setMenuOpen(false)}>
                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50" style={{ color: "#374151" }}
                  onClick={() => { setMenuOpen(false); onView(); }}>
                  <Eye className="w-4 h-4" /> View Details
                </button>
                {tenant.status !== "active" && (
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-green-50" style={{ color: "#065F46" }}
                    onClick={() => { setMenuOpen(false); onStatusChange("active"); }}>
                    <CheckCheck className="w-4 h-4" /> Activate
                  </button>
                )}
                {tenant.status !== "suspended" && (
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50" style={{ color: "#DC2626" }}
                    onClick={() => { setMenuOpen(false); onStatusChange("suspended"); }}>
                    <Ban className="w-4 h-4" /> Suspend
                  </button>
                )}
                {tenant.status !== "pending" && (
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-yellow-50" style={{ color: "#92400E" }}
                    onClick={() => { setMenuOpen(false); onStatusChange("pending"); }}>
                    <RotateCcw className="w-4 h-4" /> Set Pending
                  </button>
                )}
                <div className="h-px mx-3" style={{ background: "#F3F4F6" }} />
                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50" style={{ color: "#DC2626" }}
                  onClick={() => { setMenuOpen(false); onDelete(); }}>
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
            <User className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{tenant.admin_name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
            <Mail className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{tenant.admin_email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{fmtDate(tenant.created_at)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <StatusBadge status={tenant.status as TenantStatus} />
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: planColor + "15", color: planColor }}>
            {tenant.plan}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function TenantManagementPage() {
  const navigate = useNavigate();
  const { data: tenants = [], isLoading, refetch } = useListTenantsQuery();
  const [updateStatus] = useUpdateTenantStatusMutation();
  const [deleteTenant, { isLoading: deleting }] = useDeleteTenantMutation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TenantStatus | "all">("all");
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Tenant | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tenants.filter((t) => {
      const matchSearch = !q || t.name.toLowerCase().includes(q) || t.org_code.toLowerCase().includes(q) || t.admin_name.toLowerCase().includes(q) || t.admin_email.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tenants, search, statusFilter]);

  const stats = useMemo(() => ({
    total:     tenants.length,
    active:    tenants.filter((t) => t.status === "active").length,
    pending:   tenants.filter((t) => t.status === "pending").length,
    suspended: tenants.filter((t) => t.status === "suspended").length,
  }), [tenants]);

  const handleStatusChange = async (tenant: Tenant, status: TenantStatus) => {
    const result = await updateStatus({ tenantId: tenant.id, status });
    if ("error" in result) { showToast("Failed to update status", "error"); return; }
    showToast(`${tenant.name} marked as ${status}`);
    if (selected?.id === tenant.id) setSelected({ ...selected, status });
    await refetch();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const result = await deleteTenant(confirmDelete.id);
    if ("error" in result) { showToast("Failed to delete tenant", "error"); setConfirmDelete(null); return; }
    showToast(`${confirmDelete.name} deleted`);
    setConfirmDelete(null);
    if (selected?.id === confirmDelete.id) setSelected(null);
    await refetch();
  };

  return (
    <div className="p-5 sm:p-7 space-y-6 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/superadmin")}
            className="w-9 h-9 rounded-xl border flex items-center justify-center hover:bg-gray-50 transition-colors"
            style={{ borderColor: "#E3E9F6" }}>
            <ChevronLeft className="w-4 h-4" style={{ color: "#6B7280" }} />
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#111827" }}>Tenant Management</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>{stats.total} tenant{stats.total !== 1 ? "s" : ""} registered on the platform</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()} className="w-9 h-9 rounded-xl border flex items-center justify-center hover:bg-gray-50 transition-colors" style={{ borderColor: "#E3E9F6" }} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} style={{ color: "#6B7280" }} />
          </button>
          <button onClick={() => setInviteOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#4A57B9,#6F80E8)" }}>
            <Plus className="w-4 h-4" /> New Tenant
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Tenants",    value: stats.total,     icon: Building2,    color: "#4A57B9", click: "all"      },
          { label: "Active",           value: stats.active,    icon: CheckCircle2, color: "#10B981", click: "active"   },
          { label: "Pending Setup",    value: stats.pending,   icon: Clock,        color: "#F59E0B", click: "pending"  },
          { label: "Suspended",        value: stats.suspended, icon: XCircle,      color: "#EF4444", click: "suspended"},
        ].map(({ label, value, icon: Icon, color, click }) => (
          <button key={label} onClick={() => setStatusFilter(click as TenantStatus | "all")}
            className="bg-white rounded-2xl border p-4 flex items-center gap-3 text-left transition-all hover:shadow-md"
            style={{ borderColor: statusFilter === click ? color : "#E3E9F6", boxShadow: statusFilter === click ? `0 0 0 2px ${color}30` : undefined }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: "#111827" }}>{value}</div>
              <div className="text-xs font-medium" style={{ color: "#6B7280" }}>{label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, org code, admin…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
            style={{ borderColor: "#E3E9F6" }} />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TenantStatus | "all")}
            className="pl-9 pr-8 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
            style={{ borderColor: "#E3E9F6", color: "#374151" }}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#4A57B9" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border p-14 text-center" style={{ borderColor: "#E3E9F6" }}>
          <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <div className="font-semibold text-sm" style={{ color: "#374151" }}>
            {search || statusFilter !== "all" ? "No tenants match your filters" : "No tenants yet"}
          </div>
          <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
            {search || statusFilter !== "all" ? "Try adjusting your search or filter." : "Click 'New Tenant' to invite your first organisation."}
          </p>
          {(search || statusFilter !== "all") && (
            <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="mt-3 text-xs font-semibold" style={{ color: "#4A57B9" }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((tenant) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              onView={() => setSelected(tenant)}
              onStatusChange={(s) => handleStatusChange(tenant, s)}
              onDelete={() => setConfirmDelete(tenant)}
            />
          ))}
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <DetailDrawer
          tenant={selected}
          onClose={() => setSelected(null)}
          onStatusChange={(s) => handleStatusChange(selected, s)}
          onDelete={() => { setSelected(null); setConfirmDelete(selected); }}
        />
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmDeleteDialog
          tenant={confirmDelete}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          loading={deleting}
        />
      )}

      {/* Invite Modal */}
      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={() => { setInviteOpen(false); showToast("Tenant invited successfully!"); void refetch(); }}
      />

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
