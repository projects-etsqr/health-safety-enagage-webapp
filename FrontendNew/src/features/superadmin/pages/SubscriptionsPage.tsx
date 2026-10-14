import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  CreditCard, ChevronLeft, Plus, RefreshCw, Search, Filter,
  CheckCircle2, XCircle, Clock, AlertCircle, X, Loader2,
  CheckCheck, Building2, Calendar, DollarSign, Users, Zap,
  TrendingUp, MoreVertical, Edit3, Trash2, ChevronDown, Star,
  ArrowUpRight, BadgeCheck,
} from "lucide-react";
import {
  useListSubscriptionsQuery,
  useListTenantsQuery,
  useCreateSubscriptionMutation,
  useUpdateSubscriptionMutation,
  useDeleteSubscriptionMutation,
  type Subscription,
  type CreateSubscriptionPayload,
} from "@/features/superadmin/api/adminApi";

// ── Plan config ───────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "trial",
    label: "Free Trial",
    price_monthly: 0,
    price_annual: 0,
    seats: 5,
    color: "#6B7280",
    bg: "#F3F4F6",
    border: "#D1D5DB",
    gradient: "linear-gradient(135deg,#6B7280,#9CA3AF)",
    features: ["5 users", "1 site", "Basic modules", "30-day trial"],
  },
  {
    name: "standard",
    label: "Standard",
    price_monthly: 49,
    price_annual: 470,
    seats: 50,
    color: "#1D4ED8",
    bg: "#DBEAFE",
    border: "#93C5FD",
    gradient: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
    features: ["50 users", "5 sites", "All core modules", "Email support"],
  },
  {
    name: "premium",
    label: "Premium",
    price_monthly: 149,
    price_annual: 1430,
    seats: 200,
    color: "#7C3AED",
    bg: "#EDE9FE",
    border: "#C4B5FD",
    gradient: "linear-gradient(135deg,#7C3AED,#8B5CF6)",
    features: ["200 users", "20 sites", "AI Intelligence", "Priority support"],
  },
  {
    name: "enterprise",
    label: "Enterprise",
    price_monthly: 0,
    price_annual: 0,
    seats: null,
    color: "#B45309",
    bg: "#FEF3C7",
    border: "#FDE68A",
    gradient: "linear-gradient(135deg,#B45309,#D97706)",
    features: ["Unlimited users", "Unlimited sites", "Custom AI", "Dedicated SLA"],
  },
];

const PLAN_MAP = Object.fromEntries(PLANS.map((p) => [p.name, p]));

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  active:    { label: "Active",    color: "#065F46", bg: "#D1FAE5", border: "#6EE7B7", icon: CheckCircle2 },
  trial:     { label: "Trial",     color: "#1D4ED8", bg: "#DBEAFE", border: "#93C5FD", icon: Zap          },
  cancelled: { label: "Cancelled", color: "#991B1B", bg: "#FEE2E2", border: "#FECACA", icon: XCircle      },
  expired:   { label: "Expired",   color: "#6B7280", bg: "#F3F4F6", border: "#D1D5DB", icon: Clock        },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return n === 0 ? "Custom" : `$${n.toLocaleString()}`;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function avatarColor(str: string) {
  const palette = ["#4A57B9","#7C3AED","#0891B2","#059669","#D97706","#DC2626"];
  let h = 0; for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
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

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.expired;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

// ── Confirm Delete ────────────────────────────────────────────────────────────

function ConfirmDeleteDialog({ sub, onConfirm, onCancel, loading }: {
  sub: Subscription; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#FEE2E2" }}>
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <div className="font-bold" style={{ color: "#111827" }}>Delete Subscription</div>
            <div className="text-xs" style={{ color: "#6B7280" }}>This action cannot be undone</div>
          </div>
        </div>
        <p className="text-sm" style={{ color: "#374151" }}>
          Delete the <strong>{sub.plan_label}</strong> subscription for <strong>{sub.org_name}</strong>?
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border text-sm font-semibold" style={{ borderColor: "#E3E9F6", color: "#374151" }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "#DC2626", opacity: loading ? 0.7 : 1 }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

function SubscriptionModal({ open, editing, onClose, onSuccess, tenants }: {
  open: boolean;
  editing: Subscription | null;
  onClose: () => void;
  onSuccess: () => void;
  tenants: { id: number; name: string }[];
}) {
  const [createSub, { isLoading: creating }] = useCreateSubscriptionMutation();
  const [updateSub, { isLoading: updating }] = useUpdateSubscriptionMutation();
  const isLoading = creating || updating;

  const [form, setForm] = useState<CreateSubscriptionPayload & { status?: string }>(() =>
    editing
      ? {
          invite_id: editing.invite_id,
          plan_name: editing.plan_name,
          billing_cycle: editing.billing_cycle,
          amount: editing.amount,
          seats: editing.seats,
          start_date: editing.start_date,
          end_date: editing.end_date,
          notes: editing.notes,
          status: editing.status,
        }
      : { invite_id: null, plan_name: "standard", billing_cycle: "monthly", amount: 49, seats: 50, start_date: new Date().toISOString().split("T")[0], end_date: null, notes: null },
  );
  const [error, setError] = useState<string | null>(null);

  const setPlan = (name: string) => {
    const p = PLAN_MAP[name];
    setForm((f) => ({ ...f, plan_name: name, amount: p?.price_monthly ?? 0, seats: p?.seats ?? null }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (editing) {
      const result = await updateSub({ subId: editing.id, ...form });
      if ("error" in result) { setError((result.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Update failed."); return; }
    } else {
      const result = await createSub(form);
      if ("error" in result) { setError((result.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Create failed."); return; }
    }
    onSuccess();
  };

  if (!open) return null;
  const selectedPlan = PLAN_MAP[form.plan_name ?? "standard"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between flex-shrink-0"
          style={{ background: selectedPlan?.gradient ?? "linear-gradient(135deg,#4A57B9,#6F80E8)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">{editing ? "Edit Subscription" : "New Subscription"}</h2>
              <p className="text-white/70 text-xs">Assign a plan to an organisation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
            </div>
          )}

          {/* Organisation */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Organisation</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
              <select value={form.invite_id ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, invite_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
                style={{ borderColor: "#E3E9F6", color: form.invite_id ? "#111827" : "#9CA3AF" }}>
                <option value="">— Unassigned / Manual —</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#9CA3AF" }} />
            </div>
          </div>

          {/* Plan */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Plan</label>
            <div className="grid grid-cols-2 gap-2">
              {PLANS.map((p) => (
                <button key={p.name} type="button" onClick={() => setPlan(p.name)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold text-left transition-all"
                  style={{
                    borderColor: form.plan_name === p.name ? p.border : "#E3E9F6",
                    background: form.plan_name === p.name ? p.bg : "#F9FAFB",
                    color: form.plan_name === p.name ? p.color : "#374151",
                  }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <span>{p.label}</span>
                  {p.price_monthly > 0 && <span className="ml-auto text-xs opacity-70">${p.price_monthly}/mo</span>}
                  {p.price_monthly === 0 && p.name !== "trial" && <span className="ml-auto text-xs opacity-70">Custom</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Billing cycle */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Billing Cycle</label>
              <div className="relative">
                <select value={form.billing_cycle}
                  onChange={(e) => {
                    const cycle = e.target.value;
                    const p = PLAN_MAP[form.plan_name ?? "standard"];
                    const amt = p ? (cycle === "annual" ? p.price_annual : p.price_monthly) : (form.amount ?? 0);
                    setForm((f) => ({ ...f, billing_cycle: cycle, amount: amt }));
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
                  style={{ borderColor: "#E3E9F6" }}>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#9CA3AF" }} />
              </div>
            </div>
            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Amount ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                <input type="number" min="0" step="0.01" value={form.amount ?? 0}
                  onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
                  style={{ borderColor: "#E3E9F6" }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Seats */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Seats (users)</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                <input type="number" min="1" value={form.seats ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="Unlimited"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
                  style={{ borderColor: "#E3E9F6" }} />
              </div>
            </div>
            {/* Status (edit only) */}
            {editing && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Status</label>
                <div className="relative">
                  <select value={form.status ?? "active"}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
                    style={{ borderColor: "#E3E9F6" }}>
                    <option value="trial">Trial</option>
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#9CA3AF" }} />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Start Date</label>
              <input type="date" value={form.start_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value || null }))}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
                style={{ borderColor: "#E3E9F6" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>End Date</label>
              <input type="date" value={form.end_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value || null }))}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
                style={{ borderColor: "#E3E9F6" }} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Notes (optional)</label>
            <textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
              rows={2} placeholder="e.g. 3-month discount applied…"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              style={{ borderColor: "#E3E9F6" }} />
          </div>
        </form>

        <div className="p-4 border-t flex gap-3 flex-shrink-0" style={{ borderColor: "#E3E9F6" }}>
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold" style={{ borderColor: "#E3E9F6", color: "#374151" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold"
            style={{ background: selectedPlan?.gradient ?? "linear-gradient(135deg,#4A57B9,#6F80E8)", opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isLoading ? "Saving…" : editing ? "Save Changes" : "Create Subscription"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Subscription Row ──────────────────────────────────────────────────────────

function SubRow({ sub, onEdit, onDelete, onStatusChange }: {
  sub: Subscription;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const plan = PLAN_MAP[sub.plan_name];
  const col = avatarColor(sub.org_name);

  return (
    <tr className="border-t hover:bg-blue-50/20 transition-colors" style={{ borderColor: "#F3F4F6" }}>
      {/* Org */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: col }}>
            {sub.org_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: "#111827" }}>{sub.org_name}</div>
            <div className="text-xs" style={{ color: "#9CA3AF" }}>{sub.admin_email}</div>
          </div>
        </div>
      </td>
      {/* Plan */}
      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
          style={{ background: plan?.bg ?? "#F3F4F6", color: plan?.color ?? "#6B7280", borderColor: plan?.border ?? "#D1D5DB" }}>
          <Star className="w-2.5 h-2.5" />{sub.plan_label}
        </span>
      </td>
      {/* Status */}
      <td className="px-4 py-3.5"><StatusBadge status={sub.status} /></td>
      {/* Billing */}
      <td className="px-4 py-3.5">
        <div className="text-sm font-semibold" style={{ color: "#111827" }}>
          {sub.amount === 0 ? "Custom" : `$${sub.amount.toLocaleString()}`}
        </div>
        <div className="text-[10px]" style={{ color: "#9CA3AF" }}>{sub.billing_cycle}</div>
      </td>
      {/* Seats */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#6B7280" }}>
          <Users className="w-3.5 h-3.5" />
          {sub.seats != null ? sub.seats : "∞"}
        </div>
      </td>
      {/* Dates */}
      <td className="px-4 py-3.5">
        <div className="text-xs" style={{ color: "#374151" }}>{fmtDate(sub.start_date)}</div>
        {sub.end_date && <div className="text-[10px]" style={{ color: "#9CA3AF" }}>→ {fmtDate(sub.end_date)}</div>}
      </td>
      {/* Actions */}
      <td className="px-4 py-3.5">
        <div className="relative flex items-center justify-end">
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen((v) => !v)}>
            <MoreVertical className="w-4 h-4" style={{ color: "#6B7280" }} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 bg-white rounded-xl border shadow-xl z-20 w-48 overflow-hidden"
              style={{ borderColor: "#E3E9F6" }} onMouseLeave={() => setMenuOpen(false)}>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50" style={{ color: "#374151" }}
                onClick={() => { setMenuOpen(false); onEdit(); }}>
                <Edit3 className="w-4 h-4" /> Edit
              </button>
              {sub.status !== "active" && (
                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-green-50" style={{ color: "#065F46" }}
                  onClick={() => { setMenuOpen(false); onStatusChange("active"); }}>
                  <CheckCheck className="w-4 h-4" /> Activate
                </button>
              )}
              {sub.status === "active" && (
                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50" style={{ color: "#DC2626" }}
                  onClick={() => { setMenuOpen(false); onStatusChange("cancelled"); }}>
                  <XCircle className="w-4 h-4" /> Cancel
                </button>
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

export function SubscriptionsPage() {
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useListSubscriptionsQuery();
  const { data: tenants = [] } = useListTenantsQuery();
  const [updateSub] = useUpdateSubscriptionMutation();
  const [deleteSub, { isLoading: deleting }] = useDeleteSubscriptionMutation();

  const subs = data?.items ?? [];
  const mrr = data?.mrr ?? 0;
  const arr = data?.arr ?? 0;

  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Subscription | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return subs.filter((s) => {
      const mQ = !q || s.org_name.toLowerCase().includes(q) || s.admin_email.toLowerCase().includes(q) || s.plan_label.toLowerCase().includes(q);
      const mP = planFilter === "all" || s.plan_name === planFilter;
      const mS = statusFilter === "all" || s.status === statusFilter;
      return mQ && mP && mS;
    });
  }, [subs, search, planFilter, statusFilter]);

  const stats = useMemo(() => ({
    total:    subs.length,
    active:   subs.filter((s) => s.status === "active").length,
    trial:    subs.filter((s) => s.status === "trial").length,
    cancelled: subs.filter((s) => s.status === "cancelled" || s.status === "expired").length,
  }), [subs]);

  const handleStatusChange = async (sub: Subscription, newStatus: string) => {
    const result = await updateSub({ subId: sub.id, status: newStatus });
    if ("error" in result) { showToast("Failed to update status", "error"); return; }
    showToast(`Subscription ${newStatus}`);
    void refetch();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const result = await deleteSub(confirmDelete.id);
    if ("error" in result) { showToast("Failed to delete", "error"); setConfirmDelete(null); return; }
    showToast(`Subscription deleted`);
    setConfirmDelete(null);
    void refetch();
  };

  const tenantList = Array.isArray(tenants) ? tenants : [];

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
            <h1 className="text-xl font-bold" style={{ color: "#111827" }}>Subscriptions</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>Manage organisation plans and billing</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()} className="w-9 h-9 rounded-xl border flex items-center justify-center hover:bg-gray-50 transition-colors"
            style={{ borderColor: "#E3E9F6" }} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} style={{ color: "#6B7280" }} />
          </button>
          <button onClick={() => { setEditing(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg,#4A57B9,#6F80E8)" }}>
            <Plus className="w-4 h-4" /> New Subscription
          </button>
        </div>
      </div>

      {/* Revenue KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Subscriptions", value: stats.total,    icon: CreditCard,   color: "#4A57B9", sub: `${stats.active} active` },
          { label: "Monthly Revenue",     value: `$${mrr.toLocaleString()}`, icon: DollarSign,   color: "#059669", sub: "MRR" },
          { label: "Annual Revenue",      value: `$${Math.round(arr).toLocaleString()}`, icon: TrendingUp, color: "#7C3AED", sub: "ARR" },
          { label: "Trial / Cancelled",   value: `${stats.trial} / ${stats.cancelled}`, icon: AlertCircle, color: "#D97706", sub: "needs attention" },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-white rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "#E3E9F6" }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <div className="text-xl font-bold" style={{ color: "#111827" }}>{value}</div>
              <div className="text-xs font-medium" style={{ color: "#6B7280" }}>{label}</div>
              <div className="text-[10px]" style={{ color: "#9CA3AF" }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Plan overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PLANS.map((plan) => {
          const count = subs.filter((s) => s.plan_name === plan.name && (s.status === "active" || s.status === "trial")).length;
          return (
            <button key={plan.name}
              onClick={() => setPlanFilter(planFilter === plan.name ? "all" : plan.name)}
              className="rounded-2xl border overflow-hidden text-left transition-all hover:shadow-md"
              style={{ borderColor: planFilter === plan.name ? plan.border : "#E3E9F6", boxShadow: planFilter === plan.name ? `0 0 0 2px ${plan.color}25` : undefined }}>
              <div className="px-4 pt-4 pb-2" style={{ background: plan.gradient }}>
                <div className="text-white font-bold text-sm">{plan.label}</div>
                <div className="text-white/70 text-xs">{plan.price_monthly > 0 ? `$${plan.price_monthly}/mo` : plan.name === "enterprise" ? "Custom" : "Free"}</div>
              </div>
              <div className="px-4 py-2.5 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#6B7280" }}>{plan.seats != null ? `${plan.seats} seats` : "Unlimited"}</span>
                  <span className="text-sm font-bold" style={{ color: plan.color }}>{count} org{count !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organisation, email, plan…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
            style={{ borderColor: "#E3E9F6" }} />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
            style={{ borderColor: "#E3E9F6", color: "#374151" }}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        {(search || planFilter !== "all" || statusFilter !== "all") && (
          <button onClick={() => { setSearch(""); setPlanFilter("all"); setStatusFilter("all"); }}
            className="text-xs font-semibold px-3 py-2 rounded-xl border hover:bg-gray-50"
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
          <CreditCard className="w-10 h-10 mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <div className="font-semibold text-sm" style={{ color: "#374151" }}>
            {search || planFilter !== "all" || statusFilter !== "all" ? "No subscriptions match your filters" : "No subscriptions yet"}
          </div>
          <p className="text-xs mt-1 mb-4" style={{ color: "#9CA3AF" }}>
            {search || planFilter !== "all" || statusFilter !== "all" ? "Try adjusting filters." : "Click 'New Subscription' to assign a plan to an organisation."}
          </p>
          {!search && planFilter === "all" && statusFilter === "all" && (
            <button onClick={() => { setEditing(null); setModalOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: "linear-gradient(135deg,#4A57B9,#6F80E8)" }}>
              <Plus className="w-4 h-4" /> New Subscription
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E9F6" }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "#F3F4F6", background: "#F9FAFB" }}>
            <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>
              {filtered.length} of {subs.length} subscription{subs.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2 text-xs" style={{ color: "#9CA3AF" }}>
              <BadgeCheck className="w-3.5 h-3.5" />
              <span>MRR: <strong style={{ color: "#059669" }}>${mrr.toLocaleString()}</strong></span>
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>ARR: <strong style={{ color: "#7C3AED" }}>${Math.round(arr).toLocaleString()}</strong></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {["Organisation", "Plan", "Status", "Billing", "Seats", "Dates", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "#6B7280" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => (
                  <SubRow key={sub.id} sub={sub}
                    onEdit={() => { setEditing(sub); setModalOpen(true); }}
                    onDelete={() => setConfirmDelete(sub)}
                    onStatusChange={(s) => handleStatusChange(sub, s)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <SubscriptionModal
        open={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSuccess={() => { setModalOpen(false); setEditing(null); showToast(editing ? "Subscription updated!" : "Subscription created!"); void refetch(); }}
        tenants={tenantList.map((t) => ({ id: t.id, name: t.name }))}
      />

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmDeleteDialog
          sub={confirmDelete}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          loading={deleting}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
