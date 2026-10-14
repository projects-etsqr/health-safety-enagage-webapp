import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Mail, Plus, CheckCircle2, Clock, XCircle, Loader2, RefreshCw, Send,
  Trash2, RotateCcw, Search, X, AlertCircle, Building2, ArrowLeft,
  SlidersHorizontal, ChevronDown, Eye,
} from "lucide-react";
import {
  useListInvitesQuery,
  useInviteOrganisationMutation,
  useUpdateInviteStatusMutation,
  useResendInviteMutation,
  useDeleteInviteMutation,
  type OrganisationInvite,
  type InviteOrganisationPayload,
} from "@/features/superadmin/api/adminApi";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pending:  { label: "Pending",  bg: "#FEF3C7", color: "#92400E", border: "#FDE68A", icon: Clock },
  accepted: { label: "Accepted", bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7", icon: CheckCircle2 },
  expired:  { label: "Expired",  bg: "#FEE2E2", color: "#991B1B", border: "#FECACA", icon: XCircle },
} as const;

function StatusBadge({ status }: { status: OrganisationInvite["status"] }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.expired;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Mail; label: string; value: number; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border p-5 flex items-center gap-4" style={{ borderColor: "#E3E9F6" }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ color: "#111827" }}>{value}</div>
        <div className="text-[13px] font-medium" style={{ color: "#6B7280" }}>{label}</div>
      </div>
    </div>
  );
}

// ── New Invite Modal ──────────────────────────────────────────────────────────

function InviteModal({ open, onClose, onSuccess }: {
  open: boolean;
  onClose: () => void;
  onSuccess: (inv: OrganisationInvite) => void;
}) {
  const [inviteOrg, { isLoading }] = useInviteOrganisationMutation();
  const [form, setForm] = useState<InviteOrganisationPayload>({ organisation_name: "", admin_name: "", admin_email: "" });
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof InviteOrganisationPayload, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.organisation_name.trim() || !form.admin_name.trim() || !form.admin_email.trim()) {
      setError("All fields are required."); return;
    }
    const res = await inviteOrg(form);
    if ("error" in res) {
      const err = res.error as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? "Failed to send invite. Please try again.");
      return;
    }
    onSuccess(res.data);
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
              <h2 className="text-white font-bold text-base">New Organisation Invite</h2>
              <p className="text-white/75 text-xs">Credentials will be emailed to the admin</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#DC2626" }} />{error}
            </div>
          )}
          {([
            { name: "organisation_name" as const, label: "Organisation Name", placeholder: "Acme Corp Ltd", type: "text" },
            { name: "admin_name" as const, label: "Admin Full Name", placeholder: "Jane Smith", type: "text" },
            { name: "admin_email" as const, label: "Admin Email", placeholder: "jane@acmecorp.com", type: "email" },
          ]).map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>{f.label}</label>
              <input type={f.type} value={form[f.name]} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} required
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100" style={{ borderColor: "#E3E9F6" }} />
            </div>
          ))}
          <div className="p-3 rounded-xl text-xs leading-relaxed" style={{ background: "#F0F4FF", border: "1px solid #C7D7FD", color: "#1E40AF" }}>
            A temp password is auto-generated. A User account is created and credentials are emailed immediately.
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

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ invite, onClose, onResend, onDelete, onStatusChange, resending, deleting }: {
  invite: OrganisationInvite | null;
  onClose: () => void;
  onResend: (id: number) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, s: OrganisationInvite["status"]) => void;
  resending: boolean;
  deleting: boolean;
}) {
  if (!invite) return null;
  const cfg = STATUS_CFG[invite.status] ?? STATUS_CFG.expired;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col" style={{ borderLeft: "1px solid #E3E9F6" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b" style={{ borderColor: "#E3E9F6", background: "linear-gradient(135deg, #4A57B9, #6F80E8)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              {invite.organisation_name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-white font-bold text-sm">{invite.organisation_name}</div>
              <div className="text-white/70 text-xs">Invite #{invite.id}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#9CA3AF" }}>Status</div>
            <div className="flex items-center gap-3">
              <StatusBadge status={invite.status} />
              <select
                value={invite.status}
                onChange={(e) => onStatusChange(invite.id, e.target.value as OrganisationInvite["status"])}
                className="text-xs border rounded-lg px-2 py-1 outline-none ml-auto"
                style={{ borderColor: "#E3E9F6", color: "#374151" }}
              >
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Details</div>
            {[
              { label: "Organisation", value: invite.organisation_name },
              { label: "Admin Name", value: invite.admin_name },
              { label: "Admin Email", value: invite.admin_email },
              { label: "Invited On", value: new Date(invite.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) },
              { label: "Last Updated", value: new Date(invite.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-3 py-2 border-b" style={{ borderColor: "#F3F4F6" }}>
                <span className="text-xs font-medium flex-shrink-0" style={{ color: "#9CA3AF" }}>{label}</span>
                <span className="text-xs font-semibold text-right" style={{ color: "#111827" }}>{value}</span>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl text-xs leading-relaxed" style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
            {invite.status === "pending" && "This invite is awaiting the admin to log in and complete organisation setup."}
            {invite.status === "accepted" && "The admin has logged in. Organisation setup may be in progress or complete."}
            {invite.status === "expired" && "This invite has expired. Use Resend to generate new credentials."}
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 border-t space-y-2" style={{ borderColor: "#E3E9F6" }}>
          <button
            onClick={() => onResend(invite.id)}
            disabled={resending || invite.status === "accepted"}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
            style={{ background: "linear-gradient(135deg, #4A57B9, #6F80E8)", color: "#fff", opacity: (resending || invite.status === "accepted") ? 0.5 : 1 }}
          >
            {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {resending ? "Resending…" : "Resend Invitation"}
          </button>
          <button
            onClick={() => onDelete(invite.id)}
            disabled={deleting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
            style={{ borderColor: "#FECACA", color: "#DC2626", background: "#FEF2F2", opacity: deleting ? 0.5 : 1 }}
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? "Deleting…" : "Delete Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Delete Dialog ─────────────────────────────────────────────────────

function ConfirmDeleteDialog({ invite, onConfirm, onCancel, isLoading }: {
  invite: OrganisationInvite;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#FEF2F2" }}>
          <Trash2 className="w-6 h-6" style={{ color: "#DC2626" }} />
        </div>
        <h3 className="text-base font-bold text-center mb-2" style={{ color: "#111827" }}>Delete Invite?</h3>
        <p className="text-sm text-center mb-1" style={{ color: "#6B7280" }}>
          This will permanently delete the invite for <strong>{invite.organisation_name}</strong> and deactivate the admin account for <strong>{invite.admin_email}</strong>.
        </p>
        <p className="text-xs text-center mb-6" style={{ color: "#9CA3AF" }}>This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-semibold" style={{ borderColor: "#E3E9F6", color: "#374151" }}>Cancel</button>
          <button onClick={onConfirm} disabled={isLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "#DC2626", opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {isLoading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type FilterStatus = "all" | OrganisationInvite["status"];

export function InvitationsPage() {
  const navigate = useNavigate();
  const { data: invitesData, isLoading, refetch } = useListInvitesQuery(0, 200);
  const [updateStatus] = useUpdateInviteStatusMutation();
  const [resendInvite, { isLoading: resending }] = useResendInviteMutation();
  const [deleteInvite, { isLoading: deleting }] = useDeleteInviteMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<OrganisationInvite | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrganisationInvite | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const allInvites = invitesData?.items ?? [];

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  const filtered = useMemo(() => {
    let list = allInvites;
    if (filterStatus !== "all") list = list.filter((i) => i.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        i.organisation_name.toLowerCase().includes(q) ||
        i.admin_name.toLowerCase().includes(q) ||
        i.admin_email.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allInvites, filterStatus, search]);

  const stats = useMemo(() => ({
    total:    allInvites.length,
    pending:  allInvites.filter((i) => i.status === "pending").length,
    accepted: allInvites.filter((i) => i.status === "accepted").length,
    expired:  allInvites.filter((i) => i.status === "expired").length,
  }), [allInvites]);

  const handleInviteSuccess = (inv: OrganisationInvite) => {
    setModalOpen(false);
    showToast("success", `Invite sent to ${inv.admin_email} for ${inv.organisation_name}.`);
    void refetch();
  };

  const handleStatusChange = async (id: number, s: OrganisationInvite["status"]) => {
    const res = await updateStatus({ inviteId: id, status: s });
    if ("error" in res) { showToast("error", "Failed to update status."); return; }
    showToast("success", "Status updated.");
    void refetch();
    if (selectedInvite?.id === id) setSelectedInvite({ ...selectedInvite, status: s });
  };

  const handleResend = async (id: number) => {
    const res = await resendInvite(id);
    if ("error" in res) { showToast("error", "Failed to resend invitation."); return; }
    showToast("success", "Invitation resent with new credentials.");
    void refetch();
    if (selectedInvite?.id === id) setSelectedInvite(res.data);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const res = await deleteInvite(deleteTarget.id);
    if ("error" in res) { showToast("error", "Failed to delete invite."); return; }
    showToast("success", `Invite for ${deleteTarget.organisation_name} deleted.`);
    setDeleteTarget(null);
    if (selectedInvite?.id === deleteTarget.id) setSelectedInvite(null);
    void refetch();
  };

  return (
    <div className="p-6 space-y-6" style={{ background: "#F6F8FC", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/superadmin")} className="w-9 h-9 flex items-center justify-center rounded-xl border hover:bg-white transition-colors" style={{ borderColor: "#E3E9F6" }}>
            <ArrowLeft className="w-4 h-4" style={{ color: "#6B7280" }} />
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#111827" }}>Invitations</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>Manage all organisation admin invitations</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void refetch()} className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold" style={{ borderColor: "#E3E9F6", background: "#fff", color: "#374151" }}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "linear-gradient(135deg, #4A57B9, #6F80E8)" }}>
            <Plus className="w-4 h-4" /> New Invite
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={toast.type === "success" ? { background: "#ECFDF5", border: "1px solid #6EE7B7" } : { background: "#FEF2F2", border: "1px solid #FECACA" }}>
          {toast.type === "success"
            ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#059669" }} />
            : <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#DC2626" }} />}
          <p className="text-sm font-medium flex-1" style={{ color: toast.type === "success" ? "#065F46" : "#991B1B" }}>{toast.msg}</p>
          <button onClick={() => setToast(null)}><X className="w-4 h-4" style={{ color: "#9CA3AF" }} /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Mail}         label="Total Invites" value={stats.total}    color="#4A57B9" />
        <StatCard icon={Clock}        label="Pending"       value={stats.pending}  color="#F59E0B" />
        <StatCard icon={CheckCircle2} label="Accepted"      value={stats.accepted} color="#10B981" />
        <StatCard icon={XCircle}      label="Expired"       value={stats.expired}  color="#EF4444" />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border" style={{ borderColor: "#E3E9F6", overflow: "hidden" }}>
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b flex-wrap" style={{ borderColor: "#E9EEF8" }}>
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by org, name or email…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
              style={{ borderColor: "#E3E9F6" }}
            />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} /></button>}
          </div>

          {/* Status filter */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold"
              style={{ borderColor: filterStatus !== "all" ? "#4A57B9" : "#E3E9F6", background: filterStatus !== "all" ? "#EEF2FF" : "#fff", color: filterStatus !== "all" ? "#4A57B9" : "#374151" }}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {filterStatus === "all" ? "All Status" : STATUS_CFG[filterStatus as OrganisationInvite["status"]].label}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl border shadow-lg z-10 py-1" style={{ borderColor: "#E3E9F6" }}>
                {(["all", "pending", "accepted", "expired"] as const).map((s) => (
                  <button key={s} onClick={() => { setFilterStatus(s); setFilterOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 capitalize font-medium"
                    style={{ color: filterStatus === s ? "#4A57B9" : "#374151", background: filterStatus === s ? "#EEF2FF" : "transparent" }}>
                    {s === "all" ? "All Status" : STATUS_CFG[s].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-xs font-medium ml-auto" style={{ color: "#9CA3AF" }}>
            {filtered.length} of {allInvites.length} invites
          </span>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" style={{ color: "#4A57B9" }} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Mail className="w-12 h-12 mx-auto mb-3" style={{ color: "#D1D5DB" }} />
            <p className="text-sm font-semibold mb-1" style={{ color: "#374151" }}>
              {search || filterStatus !== "all" ? "No matching invites" : "No invites yet"}
            </p>
            <p className="text-xs mb-5" style={{ color: "#9CA3AF" }}>
              {search || filterStatus !== "all" ? "Try adjusting your search or filter." : "Send the first invitation to get started."}
            </p>
            {!search && filterStatus === "all" && (
              <button onClick={() => setModalOpen(true)} className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "linear-gradient(135deg, #4A57B9, #6F80E8)" }}>
                Send First Invite
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {["Organisation", "Admin Name", "Admin Email", "Status", "Invited On", "Updated", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "#6B7280" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-t hover:bg-blue-50/30 transition-colors cursor-pointer"
                    style={{ borderColor: "#F3F4F6", background: selectedInvite?.id === inv.id ? "#F0F4FF" : undefined }}
                    onClick={() => setSelectedInvite(inv)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: "linear-gradient(135deg, #4A57B9, #6F80E8)" }}>
                          {inv.organisation_name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold" style={{ color: "#111827" }}>{inv.organisation_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "#374151" }}>{inv.admin_name}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#9CA3AF" }} />
                        <span style={{ color: "#374151" }}>{inv.admin_email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs" style={{ color: "#6B7280" }}>
                      {new Date(inv.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs" style={{ color: "#6B7280" }}>
                      {new Date(inv.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button title="View details" onClick={() => setSelectedInvite(inv)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 transition-colors" style={{ color: "#4A57B9" }}>
                          <Eye className="w-4 h-4" />
                        </button>
                        <button title="Resend invitation" disabled={resending || inv.status === "accepted"} onClick={() => handleResend(inv.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-40" style={{ color: "#D97706" }}>
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button title="Delete invite" disabled={deleting} onClick={() => setDeleteTarget(inv)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40" style={{ color: "#DC2626" }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals & Overlays */}
      <InviteModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={handleInviteSuccess} />
      <DetailDrawer
        invite={selectedInvite}
        onClose={() => setSelectedInvite(null)}
        onResend={handleResend}
        onDelete={(id) => { const inv = allInvites.find((i) => i.id === id); if (inv) setDeleteTarget(inv); }}
        onStatusChange={handleStatusChange}
        resending={resending}
        deleting={deleting}
      />
      {deleteTarget && (
        <ConfirmDeleteDialog
          invite={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleting}
        />
      )}
    </div>
  );
}
