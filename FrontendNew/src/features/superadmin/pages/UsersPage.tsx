import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Users, Search, Filter, Plus, RefreshCw, CheckCircle2, XCircle,
  AlertCircle, ChevronLeft, Trash2, MoreVertical, Mail, AtSign,
  Calendar, Clock, Shield, X, Loader2, CheckCheck, Ban, Eye,
  Key, ChevronDown, UserCog,
} from "lucide-react";
import {
  useListPlatformUsersQuery,
  useListRolesQuery,
  useToggleUserStatusMutation,
  useChangeUserRoleMutation,
  useDeletePlatformUserMutation,
  useCreatePlatformUserMutation,
  type PlatformUser,
  type AppRole,
  type CreateUserPayload,
} from "@/features/superadmin/api/adminApi";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  superadmin:     { color: "#6D28D9", bg: "#EDE9FE", border: "#C4B5FD" },
  admin:          { color: "#1D4ED8", bg: "#DBEAFE", border: "#93C5FD" },
  safety_manager: { color: "#0891B2", bg: "#CFFAFE", border: "#67E8F9" },
  supervisor:     { color: "#059669", bg: "#D1FAE5", border: "#6EE7B7" },
  operator:       { color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
  viewer:         { color: "#6B7280", bg: "#F3F4F6", border: "#D1D5DB" },
};

function roleStyle(name: string) {
  return ROLE_COLORS[name] ?? { color: "#4A57B9", bg: "#EEF2FF", border: "#C7D2FE" };
}

function avatarColor(str: string) {
  const palette = ["#4A57B9","#7C3AED","#0891B2","#059669","#D97706","#DC2626","#DB2777"];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function initials(name: string) {
  return name.split(/[@._\s]/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

// ── Role Badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role_name, role_label }: { role_name: string; role_label: string }) {
  const s = roleStyle(role_name);
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      <Shield className="w-2.5 h-2.5" />
      {role_label}
    </span>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{ background: "#D1FAE5", color: "#065F46", borderColor: "#6EE7B7" }}>
      <CheckCircle2 className="w-3 h-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{ background: "#FEE2E2", color: "#991B1B", borderColor: "#FECACA" }}>
      <XCircle className="w-3 h-3" /> Inactive
    </span>
  );
}

// ── Confirm Delete ────────────────────────────────────────────────────────────

function ConfirmDeleteDialog({ user, onConfirm, onCancel, loading }: {
  user: PlatformUser; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#FEE2E2" }}>
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <div className="font-bold" style={{ color: "#111827" }}>Delete User</div>
            <div className="text-xs" style={{ color: "#6B7280" }}>This cannot be undone</div>
          </div>
        </div>
        <p className="text-sm" style={{ color: "#374151" }}>
          Delete <strong>{user.username}</strong> ({user.email})? The account will be permanently removed.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border text-sm font-semibold" style={{ borderColor: "#E3E9F6", color: "#374151" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: "#DC2626", opacity: loading ? 0.7 : 1 }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create User Modal ─────────────────────────────────────────────────────────

function CreateUserModal({ open, onClose, onSuccess, roles }: {
  open: boolean; onClose: () => void; onSuccess: () => void; roles: AppRole[];
}) {
  const [createUser, { isLoading }] = useCreatePlatformUserMutation();
  const [form, setForm] = useState<CreateUserPayload>({ username: "", email: "", password: "", role_name: "viewer" });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof CreateUserPayload, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Username, email and password are required."); return;
    }
    const result = await createUser(form);
    if ("error" in result) {
      const err = result.error as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? "Failed to create user."); return;
    }
    setForm({ username: "", email: "", password: "", role_name: "viewer" });
    onSuccess();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#4A57B9,#6F80E8)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Create User</h2>
              <p className="text-white/75 text-xs">Add a new platform user</p>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>Username</label>
              <input value={form.username} onChange={(e) => set("username", e.target.value)}
                placeholder="john_doe" required
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
                style={{ borderColor: "#E3E9F6" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>Role</label>
              <div className="relative">
                <select value={form.role_name} onChange={(e) => set("role_name", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
                  style={{ borderColor: "#E3E9F6", color: "#374151" }}>
                  {roles.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#9CA3AF" }} />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>Email Address</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
              placeholder="john@company.com" required
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
              style={{ borderColor: "#E3E9F6" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>Password</label>
            <div className="relative">
              <input type={showPwd ? "text" : "password"} value={form.password} onChange={(e) => set("password", e.target.value)}
                placeholder="Minimum 8 characters" required
                className="w-full px-3 py-2.5 pr-10 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
                style={{ borderColor: "#E3E9F6" }} />
              <button type="button" onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }}>
                {showPwd ? <XCircle className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-semibold" style={{ borderColor: "#E3E9F6", color: "#374151" }}>Cancel</button>
            <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "linear-gradient(135deg,#4A57B9,#6F80E8)", opacity: isLoading ? 0.7 : 1 }}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isLoading ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ user, roles, onClose, onToggleStatus, onRoleChange, onDelete }: {
  user: PlatformUser;
  roles: AppRole[];
  onClose: () => void;
  onToggleStatus: () => Promise<void>;
  onRoleChange: (role: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [changingRole, setChangingRole] = useState(false);
  const col = avatarColor(user.username);

  const handleToggle = async () => { setToggling(true); await onToggleStatus(); setToggling(false); };
  const handleRole = async (r: string) => { setChangingRole(true); await onRoleChange(r); setChangingRole(false); };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-[420px] h-full bg-white shadow-2xl flex flex-col border-l overflow-hidden"
        style={{ borderColor: "#E3E9F6" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b"
          style={{ borderColor: "#E3E9F6", background: "linear-gradient(135deg,#4A57B9,#6F80E8)" }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
              style={{ background: `${col}cc`, border: "2px solid rgba(255,255,255,0.3)" }}>
              {initials(user.username)}
            </div>
            <div>
              <div className="font-bold text-white text-base leading-tight">{user.username}</div>
              <div className="text-white/70 text-xs mt-0.5">{user.email}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Status toggle */}
          <div className="bg-white rounded-2xl border p-4 flex items-center justify-between" style={{ borderColor: "#E3E9F6" }}>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#6B7280" }}>Account Status</div>
              <StatusBadge active={user.is_active} />
            </div>
            <button onClick={handleToggle} disabled={toggling}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-all"
              style={user.is_active
                ? { borderColor: "#FECACA", color: "#DC2626", background: "#FFF5F5" }
                : { borderColor: "#6EE7B7", color: "#065F46", background: "#F0FDF4" }}>
              {toggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : user.is_active ? <Ban className="w-3.5 h-3.5" /> : <CheckCheck className="w-3.5 h-3.5" />}
              {user.is_active ? "Deactivate" : "Activate"}
            </button>
          </div>

          {/* Role */}
          <div className="bg-white rounded-2xl border p-4 space-y-3" style={{ borderColor: "#E3E9F6" }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Role</div>
            <div className="flex items-center justify-between">
              <RoleBadge role_name={user.role_name} role_label={user.role_label} />
              {changingRole && <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#4A57B9" }} />}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {roles.filter((r) => r.name !== "superadmin").map((r) => {
                const s = roleStyle(r.name);
                const isCurrent = user.role_name === r.name;
                return (
                  <button key={r.name} disabled={isCurrent || changingRole} onClick={() => handleRole(r.name)}
                    className="px-3 py-2 rounded-xl border text-xs font-semibold transition-all text-left"
                    style={{
                      borderColor: isCurrent ? s.border : "#E3E9F6",
                      background: isCurrent ? s.bg : "#F9FAFB",
                      color: isCurrent ? s.color : "#6B7280",
                      opacity: changingRole && !isCurrent ? 0.5 : 1,
                    }}>
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-2xl border p-4 space-y-3" style={{ borderColor: "#E3E9F6" }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Account Info</div>
            {[
              { icon: AtSign,   label: "Username",   value: user.username },
              { icon: Mail,     label: "Email",      value: user.email },
              { icon: Key,      label: "Role Level", value: `Level ${user.role_level}` },
              { icon: Calendar, label: "Joined",     value: fmtDate(user.created_at) },
              { icon: Clock,    label: "Last Login", value: fmtDateTime(user.last_login) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#F3F4F6" }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: "#6B7280" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>{label}</div>
                  <div className="text-sm font-semibold truncate" style={{ color: "#111827" }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t" style={{ borderColor: "#E3E9F6" }}>
          <button onClick={onDelete}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors hover:bg-red-50"
            style={{ borderColor: "#FECACA", color: "#DC2626" }}>
            <Trash2 className="w-4 h-4" /> Delete User
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User Row ──────────────────────────────────────────────────────────────────

function UserRow({ user, roles, onView, onToggle, onRoleChange, onDelete }: {
  user: PlatformUser;
  roles: AppRole[];
  onView: () => void;
  onToggle: () => void;
  onRoleChange: (r: string) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const col = avatarColor(user.username);

  return (
    <tr className="border-t hover:bg-blue-50/30 transition-colors cursor-pointer" style={{ borderColor: "#F3F4F6" }}
      onClick={onView}>
      {/* Avatar + name */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: col }}>
            {initials(user.username)}
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: "#111827" }}>{user.username}</div>
            <div className="text-xs" style={{ color: "#9CA3AF" }}>{user.email}</div>
          </div>
        </div>
      </td>
      {/* Role */}
      <td className="px-4 py-3.5">
        <RoleBadge role_name={user.role_name} role_label={user.role_label} />
      </td>
      {/* Status */}
      <td className="px-4 py-3.5">
        <StatusBadge active={user.is_active} />
      </td>
      {/* Last Login */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#6B7280" }}>
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          {fmtDateTime(user.last_login)}
        </div>
      </td>
      {/* Joined */}
      <td className="px-4 py-3.5">
        <div className="text-xs" style={{ color: "#6B7280" }}>{fmtDate(user.created_at)}</div>
      </td>
      {/* Actions */}
      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex items-center justify-end">
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen((v) => !v)}>
            <MoreVertical className="w-4 h-4" style={{ color: "#6B7280" }} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 bg-white rounded-xl border shadow-xl z-20 w-48 overflow-hidden"
              style={{ borderColor: "#E3E9F6" }} onMouseLeave={() => setMenuOpen(false)}>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50" style={{ color: "#374151" }}
                onClick={() => { setMenuOpen(false); onView(); }}>
                <Eye className="w-4 h-4" /> View Details
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50" style={{ color: user.is_active ? "#DC2626" : "#065F46" }}
                onClick={() => { setMenuOpen(false); onToggle(); }}>
                {user.is_active ? <><Ban className="w-4 h-4" /> Deactivate</> : <><CheckCheck className="w-4 h-4" /> Activate</>}
              </button>
              {roles.filter((r) => r.name !== "superadmin" && r.name !== user.role_name).length > 0 && (
                <>
                  <div className="h-px mx-3 my-1" style={{ background: "#F3F4F6" }} />
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Change Role</div>
                  {roles.filter((r) => r.name !== "superadmin" && r.name !== user.role_name).map((r) => (
                    <button key={r.name} className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50" style={{ color: "#374151" }}
                      onClick={() => { setMenuOpen(false); onRoleChange(r.name); }}>
                      <Shield className="w-3.5 h-3.5" style={{ color: roleStyle(r.name).color }} />
                      {r.label}
                    </button>
                  ))}
                </>
              )}
              <div className="h-px mx-3 my-1" style={{ background: "#F3F4F6" }} />
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50" style={{ color: "#DC2626" }}
                onClick={() => { setMenuOpen(false); onDelete(); }}>
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function SuperAdminUsersPage() {
  const navigate = useNavigate();
  const { data: usersData, isLoading, refetch } = useListPlatformUsersQuery();
  const { data: roles = [] } = useListRolesQuery();
  const [toggleStatus] = useToggleUserStatusMutation();
  const [changeRole] = useChangeUserRoleMutation();
  const [deleteUser, { isLoading: deleting }] = useDeletePlatformUserMutation();

  const users = usersData?.items ?? [];

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selected, setSelected] = useState<PlatformUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlatformUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const matchQ = !q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role_label.toLowerCase().includes(q);
      const matchRole = roleFilter === "all" || u.role_name === roleFilter;
      const matchStatus = statusFilter === "all" || (statusFilter === "active" ? u.is_active : !u.is_active);
      return matchQ && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const roleCount: Record<string, number> = {};
    users.forEach((u) => { roleCount[u.role_name] = (roleCount[u.role_name] ?? 0) + 1; });
    return {
      total:    users.length,
      active:   users.filter((u) => u.is_active).length,
      inactive: users.filter((u) => !u.is_active).length,
      admins:   (roleCount["superadmin"] ?? 0) + (roleCount["admin"] ?? 0),
    };
  }, [users]);

  const handleToggle = async (user: PlatformUser) => {
    const result = await toggleStatus({ userId: user.id, is_active: !user.is_active });
    if ("error" in result) { showToast("Failed to update status", "error"); return; }
    showToast(`${user.username} ${user.is_active ? "deactivated" : "activated"}`);
    if (selected?.id === user.id) setSelected({ ...selected, is_active: !user.is_active });
    await refetch();
  };

  const handleRoleChange = async (user: PlatformUser, role_name: string) => {
    const result = await changeRole({ userId: user.id, role_name });
    if ("error" in result) { showToast("Failed to change role", "error"); return; }
    const newRole = roles.find((r) => r.name === role_name);
    showToast(`${user.username} → ${newRole?.label ?? role_name}`);
    if (selected?.id === user.id) setSelected({ ...selected, role_name, role_label: newRole?.label ?? role_name });
    await refetch();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const result = await deleteUser(confirmDelete.id);
    if ("error" in result) { showToast("Failed to delete user", "error"); setConfirmDelete(null); return; }
    showToast(`${confirmDelete.username} deleted`);
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
            <h1 className="text-xl font-bold" style={{ color: "#111827" }}>Platform Users</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>{stats.total} user{stats.total !== 1 ? "s" : ""} across all organisations</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()}
            className="w-9 h-9 rounded-xl border flex items-center justify-center hover:bg-gray-50 transition-colors"
            style={{ borderColor: "#E3E9F6" }} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} style={{ color: "#6B7280" }} />
          </button>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg,#4A57B9,#6F80E8)" }}>
            <Plus className="w-4 h-4" /> New User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Users",  value: stats.total,    icon: Users,        color: "#4A57B9", filter: null },
          { label: "Active",       value: stats.active,   icon: CheckCircle2, color: "#10B981", filter: "active" },
          { label: "Inactive",     value: stats.inactive, icon: XCircle,      color: "#EF4444", filter: "inactive" },
          { label: "Admins",       value: stats.admins,   icon: Shield,       color: "#7C3AED", filter: null },
        ].map(({ label, value, icon: Icon, color, filter }) => (
          <div key={label}
            className={`bg-white rounded-2xl border p-4 flex items-center gap-3 transition-all ${filter ? "cursor-pointer hover:shadow-md" : ""}`}
            style={{ borderColor: statusFilter === filter ? color : "#E3E9F6", boxShadow: statusFilter === filter ? `0 0 0 2px ${color}30` : undefined }}
            onClick={() => filter && setStatusFilter(filter as "active" | "inactive")}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: "#111827" }}>{value}</div>
              <div className="text-xs font-medium" style={{ color: "#6B7280" }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, email, role…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
            style={{ borderColor: "#E3E9F6" }} />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            className="pl-9 pr-8 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
            style={{ borderColor: "#E3E9F6", color: "#374151" }}>
            <option value="all">All Roles</option>
            {roles.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}
          </select>
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
            className="px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
            style={{ borderColor: "#E3E9F6", color: "#374151" }}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        {(search || roleFilter !== "all" || statusFilter !== "all") && (
          <button onClick={() => { setSearch(""); setRoleFilter("all"); setStatusFilter("all"); }}
            className="text-xs font-semibold px-3 py-2 rounded-xl border transition-colors hover:bg-gray-50"
            style={{ borderColor: "#E3E9F6", color: "#6B7280" }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#4A57B9" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border p-14 text-center" style={{ borderColor: "#E3E9F6" }}>
          <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <div className="font-semibold text-sm" style={{ color: "#374151" }}>
            {search || roleFilter !== "all" || statusFilter !== "all" ? "No users match your filters" : "No users yet"}
          </div>
          <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
            {search || roleFilter !== "all" || statusFilter !== "all" ? "Try adjusting your search or filters." : "Click 'New User' to create one."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E9F6" }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "#F3F4F6", background: "#F9FAFB" }}>
            <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>
              Showing {filtered.length} of {users.length} users
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {["User", "Role", "Status", "Last Login", "Joined", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "#6B7280" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    roles={roles}
                    onView={() => setSelected(u)}
                    onToggle={() => handleToggle(u)}
                    onRoleChange={(r) => handleRoleChange(u, r)}
                    onDelete={() => setConfirmDelete(u)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <DetailDrawer
          user={selected}
          roles={roles}
          onClose={() => setSelected(null)}
          onToggleStatus={() => handleToggle(selected)}
          onRoleChange={(r) => handleRoleChange(selected, r)}
          onDelete={() => { setSelected(null); setConfirmDelete(selected); }}
        />
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmDeleteDialog
          user={confirmDelete}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          loading={deleting}
        />
      )}

      {/* Create User Modal */}
      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => { setCreateOpen(false); showToast("User created successfully!"); void refetch(); }}
        roles={roles}
      />

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
