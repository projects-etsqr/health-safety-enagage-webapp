import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Shield, ChevronLeft, Users, CheckCircle2, XCircle, Edit3,
  X, Loader2, AlertCircle, CheckCheck, Lock, Eye, Settings,
  Building2, BarChart3, ClipboardCheck, AlertTriangle, Briefcase,
  Lightbulb, FolderClosed, UserCog, Star,
} from "lucide-react";
import {
  useListRolesQuery,
  useUpdateRoleMutation,
  type AppRole,
} from "@/features/superadmin/api/adminApi";

// ── Permission matrix definition ──────────────────────────────────────────────

type AccessLevel = "full" | "manage" | "view" | "none";

interface PermissionRow {
  module: string;
  icon: typeof Shield;
  description: string;
  access: Record<string, AccessLevel>; // keyed by role.name
}

const PERMISSION_MATRIX: PermissionRow[] = [
  {
    module: "Super Admin Panel",
    icon: Star,
    description: "Access to platform-wide admin controls",
    access: { superadmin: "full", admin: "none", safety_manager: "none", supervisor: "none", operator: "none", viewer: "none" },
  },
  {
    module: "System Settings",
    icon: Settings,
    description: "Platform configuration and global settings",
    access: { superadmin: "full", admin: "view", safety_manager: "none", supervisor: "none", operator: "none", viewer: "none" },
  },
  {
    module: "User Management",
    icon: UserCog,
    description: "Create, edit and deactivate user accounts",
    access: { superadmin: "full", admin: "manage", safety_manager: "view", supervisor: "none", operator: "none", viewer: "none" },
  },
  {
    module: "Organisation Setup",
    icon: Building2,
    description: "Organisation profile, sites and compliance setup",
    access: { superadmin: "full", admin: "full", safety_manager: "manage", supervisor: "view", operator: "none", viewer: "none" },
  },
  {
    module: "Analytics & Reports",
    icon: BarChart3,
    description: "Dashboards, KPIs and exported reports",
    access: { superadmin: "full", admin: "full", safety_manager: "full", supervisor: "view", operator: "view", viewer: "view" },
  },
  {
    module: "Compliance & Audits",
    icon: ClipboardCheck,
    description: "Compliance checklists, audits and standards",
    access: { superadmin: "full", admin: "full", safety_manager: "manage", supervisor: "view", operator: "view", viewer: "view" },
  },
  {
    module: "Incidents & Near-Miss",
    icon: AlertTriangle,
    description: "Log, review and close safety incidents",
    access: { superadmin: "full", admin: "full", safety_manager: "manage", supervisor: "manage", operator: "manage", viewer: "view" },
  },
  {
    module: "Actions & CAPA",
    icon: Briefcase,
    description: "Corrective and preventive action workflows",
    access: { superadmin: "full", admin: "full", safety_manager: "manage", supervisor: "manage", operator: "view", viewer: "view" },
  },
  {
    module: "AI Intelligence",
    icon: Lightbulb,
    description: "AI-powered insights, predictions and agent",
    access: { superadmin: "full", admin: "full", safety_manager: "full", supervisor: "view", operator: "none", viewer: "none" },
  },
  {
    module: "Assets & Equipment",
    icon: FolderClosed,
    description: "Equipment registry, certifications and permits",
    access: { superadmin: "full", admin: "full", safety_manager: "manage", supervisor: "manage", operator: "view", viewer: "view" },
  },
  {
    module: "People & Workforce",
    icon: Users,
    description: "Employees, departments, training records",
    access: { superadmin: "full", admin: "full", safety_manager: "manage", supervisor: "manage", operator: "view", viewer: "view" },
  },
];

// ── Access level config ───────────────────────────────────────────────────────

const ACCESS_CFG: Record<AccessLevel, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  full:   { label: "Full",   color: "#065F46", bg: "#D1FAE5", border: "#6EE7B7", icon: CheckCheck   },
  manage: { label: "Manage", color: "#1D4ED8", bg: "#DBEAFE", border: "#93C5FD", icon: Edit3        },
  view:   { label: "View",   color: "#92400E", bg: "#FEF3C7", border: "#FDE68A", icon: Eye          },
  none:   { label: "None",   color: "#9CA3AF", bg: "#F3F4F6", border: "#E5E7EB", icon: XCircle      },
};

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_CFG: Record<string, { color: string; bg: string; border: string; gradient: string }> = {
  superadmin:     { color: "#6D28D9", bg: "#EDE9FE", border: "#C4B5FD", gradient: "linear-gradient(135deg,#6D28D9,#8B5CF6)" },
  admin:          { color: "#1D4ED8", bg: "#DBEAFE", border: "#93C5FD", gradient: "linear-gradient(135deg,#1D4ED8,#3B82F6)" },
  safety_manager: { color: "#0891B2", bg: "#CFFAFE", border: "#67E8F9", gradient: "linear-gradient(135deg,#0891B2,#06B6D4)" },
  supervisor:     { color: "#059669", bg: "#D1FAE5", border: "#6EE7B7", gradient: "linear-gradient(135deg,#059669,#10B981)" },
  operator:       { color: "#D97706", bg: "#FEF3C7", border: "#FDE68A", gradient: "linear-gradient(135deg,#D97706,#F59E0B)" },
  viewer:         { color: "#6B7280", bg: "#F3F4F6", border: "#D1D5DB", gradient: "linear-gradient(135deg,#6B7280,#9CA3AF)" },
};

function roleCfg(name: string) {
  return ROLE_CFG[name] ?? ROLE_CFG.viewer;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Access Cell ───────────────────────────────────────────────────────────────

function AccessCell({ level }: { level: AccessLevel }) {
  const cfg = ACCESS_CFG[level];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center justify-center">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
        style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
        <Icon className="w-2.5 h-2.5" />
        {cfg.label}
      </span>
    </div>
  );
}

// ── Edit Role Drawer ──────────────────────────────────────────────────────────

function EditRoleDrawer({ role, onClose, onSaved }: {
  role: AppRole;
  onClose: () => void;
  onSaved: (updated: AppRole) => void;
}) {
  const [updateRole, { isLoading }] = useUpdateRoleMutation();
  const [label, setLabel] = useState(role.label);
  const [description, setDescription] = useState(role.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const cfg = roleCfg(role.name);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) { setError("Label is required."); return; }
    const result = await updateRole({ roleId: role.id, label: label.trim(), description });
    if ("error" in result) {
      const err = result.error as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? "Failed to update role."); return;
    }
    onSaved(result.data);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-[400px] h-full bg-white shadow-2xl flex flex-col border-l overflow-hidden"
        style={{ borderColor: "#E3E9F6" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b flex-shrink-0"
          style={{ borderColor: "#E3E9F6", background: cfg.gradient }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-base">Edit Role</div>
              <div className="text-white/70 text-xs mt-0.5 font-mono">{role.name}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Immutable info */}
          <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "#E3E9F6", background: "#F9FAFB" }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>System Info (read-only)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#9CA3AF" }}>Role Key</div>
                <div className="font-mono text-sm font-semibold px-2.5 py-1.5 rounded-lg" style={{ background: cfg.bg, color: cfg.color }}>{role.name}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#9CA3AF" }}>Access Level</div>
                <div className="text-sm font-bold px-2.5 py-1.5 rounded-lg text-center" style={{ background: cfg.bg, color: cfg.color }}>Level {role.level}</div>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#9CA3AF" }}>Users with this role</div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: "#6B7280" }} />
                <span className="text-sm font-semibold" style={{ color: "#111827" }}>{role.user_count ?? 0} user{(role.user_count ?? 0) !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>

          {/* Editable fields */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Display Label</label>
            <input value={label} onChange={(e) => { setLabel(e.target.value); setError(null); }}
              placeholder="e.g. Safety Manager"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
              style={{ borderColor: "#E3E9F6" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={4} placeholder="Describe what this role can access…"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              style={{ borderColor: "#E3E9F6" }} />
          </div>

          {/* Access summary */}
          <div className="rounded-2xl border p-4 space-y-2" style={{ borderColor: "#E3E9F6" }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#6B7280" }}>Permission Summary</div>
            {PERMISSION_MATRIX.map((row) => {
              const level = row.access[role.name] ?? "none";
              const cfg2 = ACCESS_CFG[level];
              const Icon = cfg2.icon;
              return (
                <div key={row.module} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <row.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#9CA3AF" }} />
                    <span className="text-xs truncate" style={{ color: "#374151" }}>{row.module}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0"
                    style={{ background: cfg2.bg, color: cfg2.color, borderColor: cfg2.border }}>
                    <Icon className="w-2.5 h-2.5" />{cfg2.label}
                  </span>
                </div>
              );
            })}
          </div>
        </form>

        <div className="p-4 border-t flex gap-3 flex-shrink-0" style={{ borderColor: "#E3E9F6" }}>
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border text-sm font-semibold" style={{ borderColor: "#E3E9F6", color: "#374151" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold"
            style={{ background: cfg.gradient, opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isLoading ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Role Card ─────────────────────────────────────────────────────────────────

function RoleCard({ role, onEdit }: { role: AppRole; onEdit: () => void }) {
  const cfg = roleCfg(role.name);
  const fullCount  = PERMISSION_MATRIX.filter((r) => r.access[role.name] === "full").length;
  const manageCount = PERMISSION_MATRIX.filter((r) => r.access[role.name] === "manage").length;
  const viewCount  = PERMISSION_MATRIX.filter((r) => r.access[role.name] === "view").length;
  const noneCount  = PERMISSION_MATRIX.filter((r) => r.access[role.name] === "none").length;

  return (
    <div className="bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-all duration-150"
      style={{ borderColor: "#E3E9F6" }}>
      {/* Coloured header */}
      <div className="p-4 flex items-center justify-between" style={{ background: cfg.gradient }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-sm">{role.label}</div>
            <div className="text-white/65 text-[11px] font-mono">{role.name}</div>
          </div>
        </div>
        <button onClick={onEdit}
          className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          title="Edit role">
          <Edit3 className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Level badge */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
            Access Level {role.level}
          </span>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#6B7280" }}>
            <Users className="w-3.5 h-3.5" />
            <span className="font-semibold">{role.user_count ?? 0}</span>
            <span>users</span>
          </div>
        </div>

        {/* Description */}
        {role.description && (
          <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>{role.description}</p>
        )}

        {/* Permission mini-bar */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Permissions ({PERMISSION_MATRIX.length} modules)</div>
          <div className="flex gap-1 h-2 rounded-full overflow-hidden">
            {fullCount   > 0 && <div style={{ flex: fullCount,   background: "#10B981" }} title={`${fullCount} Full`} />}
            {manageCount > 0 && <div style={{ flex: manageCount, background: "#3B82F6" }} title={`${manageCount} Manage`} />}
            {viewCount   > 0 && <div style={{ flex: viewCount,   background: "#F59E0B" }} title={`${viewCount} View`} />}
            {noneCount   > 0 && <div style={{ flex: noneCount,   background: "#E5E7EB" }} title={`${noneCount} None`} />}
          </div>
          <div className="flex items-center gap-3 text-[10px]" style={{ color: "#6B7280" }}>
            {fullCount   > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "#10B981" }} />{fullCount} Full</span>}
            {manageCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "#3B82F6" }} />{manageCount} Manage</span>}
            {viewCount   > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "#F59E0B" }} />{viewCount} View</span>}
            {noneCount   > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "#E5E7EB" }} />{noneCount} None</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function RolesPermissionsPage() {
  const navigate = useNavigate();
  const { data: roles = [], isLoading, refetch } = useListRolesQuery();
  const [editing, setEditing] = useState<AppRole | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaved = (updated: AppRole) => {
    setEditing(null);
    showToast(`"${updated.label}" updated successfully`);
    void refetch();
  };

  // ordered by level desc (as returned by API)
  const roleNames = roles.map((r) => r.name);

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
            <h1 className="text-xl font-bold" style={{ color: "#111827" }}>Roles & Permissions</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>Platform-wide role hierarchy and module access control</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold" style={{ borderColor: "#E3E9F6", color: "#6B7280", background: "#F9FAFB" }}>
          <Lock className="w-3.5 h-3.5" />
          Role keys & levels are system-defined
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border" style={{ borderColor: "#E3E9F6", background: "#F9FAFB" }}>
        <span className="text-xs font-semibold" style={{ color: "#374151" }}>Access levels:</span>
        {(Object.entries(ACCESS_CFG) as [AccessLevel, typeof ACCESS_CFG[AccessLevel]][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <span key={key} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border"
              style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
              <Icon className="w-3 h-3" />{cfg.label}
            </span>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#4A57B9" }} />
        </div>
      ) : (
        <>
          {/* Role cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {roles.map((role) => (
              <RoleCard key={role.id} role={role} onEdit={() => setEditing(role)} />
            ))}
          </div>

          {/* Permissions matrix */}
          {roles.length > 0 && (
            <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E9F6" }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: "#F3F4F6", background: "#F9FAFB" }}>
                <h2 className="text-sm font-bold" style={{ color: "#111827" }}>Full Permissions Matrix</h2>
                <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>Module-level access for each role</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      <th className="px-5 py-3 text-left font-semibold whitespace-nowrap" style={{ color: "#374151", minWidth: 200 }}>
                        Module
                      </th>
                      {roles.map((role) => {
                        const cfg = roleCfg(role.name);
                        return (
                          <th key={role.name} className="px-4 py-3 text-center font-semibold whitespace-nowrap" style={{ minWidth: 110 }}>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border"
                              style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                              <Shield className="w-2.5 h-2.5" />
                              {role.label}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_MATRIX.map((row, idx) => (
                      <tr key={row.module}
                        className="border-t"
                        style={{ borderColor: "#F3F4F6", background: idx % 2 === 0 ? "#FFFFFF" : "#FAFBFF" }}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#F3F4F6" }}>
                              <row.icon className="w-3.5 h-3.5" style={{ color: "#6B7280" }} />
                            </div>
                            <div>
                              <div className="font-semibold text-xs" style={{ color: "#111827" }}>{row.module}</div>
                              <div className="text-[10px]" style={{ color: "#9CA3AF" }}>{row.description}</div>
                            </div>
                          </div>
                        </td>
                        {roleNames.map((rName) => (
                          <td key={rName} className="px-4 py-3">
                            <AccessCell level={row.access[rName] ?? "none"} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Drawer */}
      {editing && (
        <EditRoleDrawer
          role={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
