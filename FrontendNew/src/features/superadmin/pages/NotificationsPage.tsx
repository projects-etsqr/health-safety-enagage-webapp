import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Bell, ChevronLeft, Plus, RefreshCw, Search, Filter, Send,
  Trash2, X, Loader2, CheckCheck, AlertCircle, Clock, Info,
  CheckCircle2, AlertTriangle, Wrench, Megaphone, MoreVertical,
  Building2, Globe, Mail, Eye, ChevronDown, FileText,
} from "lucide-react";
import {
  useListNotificationsQuery,
  useListTenantsQuery,
  useCreateNotificationMutation,
  useSendNotificationMutation,
  useDeleteNotificationMutation,
  type PlatformNotification,
  type CreateNotificationPayload,
} from "@/features/superadmin/api/adminApi";

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CFG = {
  info:         { label: "Info",         color: "#1D4ED8", bg: "#DBEAFE", border: "#93C5FD", icon: Info         },
  success:      { label: "Success",      color: "#059669", bg: "#D1FAE5", border: "#6EE7B7", icon: CheckCircle2 },
  warning:      { label: "Warning",      color: "#D97706", bg: "#FEF3C7", border: "#FDE68A", icon: AlertTriangle },
  maintenance:  { label: "Maintenance",  color: "#7C3AED", bg: "#EDE9FE", border: "#C4B5FD", icon: Wrench       },
  announcement: { label: "Announcement", color: "#0891B2", bg: "#CFFAFE", border: "#67E8F9", icon: Megaphone    },
} as const;

type NotifType = keyof typeof TYPE_CFG;

const STATUS_CFG = {
  draft:  { label: "Draft",  color: "#6B7280", bg: "#F3F4F6", border: "#D1D5DB", icon: FileText     },
  sent:   { label: "Sent",   color: "#065F46", bg: "#D1FAE5", border: "#6EE7B7", icon: CheckCheck   },
  failed: { label: "Failed", color: "#991B1B", bg: "#FEE2E2", border: "#FECACA", icon: AlertCircle  },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function truncate(s: string, n = 90) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onDismiss }: { msg: string; type: "success" | "error"; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold"
      style={{ background: type === "success" ? "#065F46" : "#991B1B", color: "#fff", minWidth: 260 }}>
      {type === "success" ? <CheckCheck className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      <span className="flex-1">{msg}</span>
      <button onClick={onDismiss}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
    </div>
  );
}

// ── Type Badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: NotifType }) {
  const cfg = TYPE_CFG[type] ?? TYPE_CFG.info;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "draft" | "sent" | "failed" }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ notif, onClose, onSend, onDelete, sending }: {
  notif: PlatformNotification;
  onClose: () => void;
  onSend: () => void;
  onDelete: () => void;
  sending: boolean;
}) {
  const typeCfg = TYPE_CFG[notif.type as NotifType] ?? TYPE_CFG.info;
  const TypeIcon = typeCfg.icon;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-[440px] h-full bg-white shadow-2xl flex flex-col border-l overflow-hidden"
        style={{ borderColor: "#E3E9F6" }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 flex items-center justify-between flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${typeCfg.color}, ${typeCfg.color}cc)` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <TypeIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm leading-tight">{notif.title}</div>
              <div className="text-white/70 text-xs mt-0.5">{typeCfg.label} Notification</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Status row */}
          <div className="flex items-center justify-between p-4 rounded-2xl border" style={{ borderColor: "#E3E9F6" }}>
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Status</div>
              <StatusBadge status={notif.status} />
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#9CA3AF" }}>Emails Sent</div>
              <div className="flex items-center gap-1.5 justify-end">
                <Mail className="w-3.5 h-3.5" style={{ color: "#6B7280" }} />
                <span className="text-sm font-bold" style={{ color: "#111827" }}>{notif.email_sent_count}</span>
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="rounded-2xl border p-4 space-y-2" style={{ borderColor: "#E3E9F6" }}>
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Message</div>
            <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{notif.message}</p>
          </div>

          {/* Target */}
          <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "#E3E9F6" }}>
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Target</div>
            <div className="flex items-center gap-3">
              {notif.target_type === "all" ? (
                <>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EEF2FF" }}>
                    <Globe className="w-4 h-4" style={{ color: "#4A57B9" }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "#111827" }}>All Organisations</div>
                    <div className="text-xs" style={{ color: "#9CA3AF" }}>Broadcast to every tenant admin</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EEF2FF" }}>
                    <Building2 className="w-4 h-4" style={{ color: "#4A57B9" }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "#111827" }}>{notif.target_org_name ?? "Specific Organisation"}</div>
                    <div className="text-xs" style={{ color: "#9CA3AF" }}>Targeted notification</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "#E3E9F6" }}>
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Timeline</div>
            {[
              { icon: Clock,   label: "Created",  value: fmtDateTime(notif.created_at) },
              { icon: Send,    label: "Sent At",  value: fmtDateTime(notif.sent_at)    },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#F3F4F6" }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: "#6B7280" }} />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>{label}</div>
                  <div className="text-xs font-semibold" style={{ color: "#374151" }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3 flex-shrink-0" style={{ borderColor: "#E3E9F6" }}>
          {notif.status === "draft" && (
            <button onClick={onSend} disabled={sending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity"
              style={{ background: `linear-gradient(135deg, ${typeCfg.color}, ${typeCfg.color}cc)`, opacity: sending ? 0.7 : 1 }}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Sending…" : "Send Now"}
            </button>
          )}
          <button onClick={onDelete}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold hover:bg-red-50 transition-colors"
            style={{ borderColor: "#FECACA", color: "#DC2626" }}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Compose Panel ─────────────────────────────────────────────────────────────

function ComposePanel({ open, onClose, onSuccess, tenants }: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenants: { id: number; name: string }[];
}) {
  const [createNotif, { isLoading: creating }] = useCreateNotificationMutation();
  const [sendNotif,   { isLoading: sending  }] = useSendNotificationMutation();

  const [form, setForm] = useState<CreateNotificationPayload>({
    title: "", message: "", type: "info", target_type: "all", target_invite_id: null,
  });
  const [sendNow, setSendNow] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CreateNotificationPayload>(k: K, v: CreateNotificationPayload[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };

  const isLoading = creating || sending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) { setError("Title and message are required."); return; }
    const result = await createNotif(form);
    if ("error" in result) {
      setError((result.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to create."); return;
    }
    if (sendNow) {
      await sendNotif(result.data.id);
    }
    setForm({ title: "", message: "", type: "info", target_type: "all", target_invite_id: null });
    onSuccess();
  };

  const selectedType = TYPE_CFG[form.type as NotifType] ?? TYPE_CFG.info;
  const charCount = form.message.length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-[480px] h-full bg-white shadow-2xl flex flex-col border-l overflow-hidden"
        style={{ borderColor: "#E3E9F6" }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 flex items-center justify-between flex-shrink-0 border-b" style={{ borderColor: "#E3E9F6", background: "linear-gradient(135deg,#4A57B9,#6F80E8)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-base">Compose Notification</div>
              <div className="text-white/70 text-xs">Send to organisations via email</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
            </div>
          )}

          {/* Type selector */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "#374151" }}>Notification Type</label>
            <div className="grid grid-cols-5 gap-2">
              {(Object.entries(TYPE_CFG) as [NotifType, typeof TYPE_CFG[NotifType]][]).map(([key, cfg]) => {
                const Icon = cfg.icon;
                const selected = form.type === key;
                return (
                  <button key={key} type="button" onClick={() => set("type", key)}
                    className="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border text-[10px] font-semibold transition-all"
                    style={{
                      borderColor: selected ? cfg.border : "#E3E9F6",
                      background: selected ? cfg.bg : "#F9FAFB",
                      color: selected ? cfg.color : "#9CA3AF",
                    }}>
                    <Icon className="w-4 h-4" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "#374151" }}>Send To</label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { value: "all",      label: "All Organisations", icon: Globe,     desc: "Broadcast to every tenant" },
                { value: "specific", label: "Specific Tenant",   icon: Building2, desc: "One organisation only"    },
              ].map((opt) => {
                const Icon = opt.icon;
                const selected = form.target_type === opt.value;
                return (
                  <button key={opt.value} type="button" onClick={() => set("target_type", opt.value)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all"
                    style={{
                      borderColor: selected ? "#93C5FD" : "#E3E9F6",
                      background: selected ? "#DBEAFE" : "#F9FAFB",
                    }}>
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: selected ? "#1D4ED8" : "#9CA3AF" }} />
                    <div>
                      <div className="text-xs font-semibold" style={{ color: selected ? "#1D4ED8" : "#374151" }}>{opt.label}</div>
                      <div className="text-[10px]" style={{ color: "#9CA3AF" }}>{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {form.target_type === "specific" && (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                <select value={form.target_invite_id ?? ""}
                  onChange={(e) => set("target_invite_id", e.target.value ? Number(e.target.value) : null)}
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
                  style={{ borderColor: "#E3E9F6", color: form.target_invite_id ? "#111827" : "#9CA3AF" }}>
                  <option value="">— Select organisation —</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#9CA3AF" }} />
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Subject / Title</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Scheduled Maintenance — 18 Jun 2026"
              maxLength={120}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
              style={{ borderColor: "#E3E9F6" }} />
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold" style={{ color: "#374151" }}>Message</label>
              <span className="text-[10px]" style={{ color: charCount > 800 ? "#EF4444" : "#9CA3AF" }}>{charCount}/1000</span>
            </div>
            <textarea value={form.message} onChange={(e) => set("message", e.target.value)}
              rows={6} maxLength={1000}
              placeholder="Write your notification message here…"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 resize-none leading-relaxed"
              style={{ borderColor: "#E3E9F6" }} />
          </div>

          {/* Preview card */}
          {(form.title || form.message) && (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: selectedType.border }}>
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: selectedType.bg }}>
                <selectedType.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: selectedType.color }} />
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: selectedType.color }}>Preview</span>
              </div>
              {form.title && <div className="px-4 pt-3 text-sm font-bold" style={{ color: "#111827" }}>{form.title}</div>}
              {form.message && <div className="px-4 pt-1.5 pb-3 text-xs leading-relaxed" style={{ color: "#6B7280" }}>{truncate(form.message, 160)}</div>}
            </div>
          )}

          {/* Send now toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl border" style={{ borderColor: "#E3E9F6", background: "#F9FAFB" }}>
            <div>
              <div className="text-sm font-semibold" style={{ color: "#111827" }}>Send immediately</div>
              <div className="text-xs" style={{ color: "#9CA3AF" }}>Off = save as draft only</div>
            </div>
            <button type="button" onClick={() => setSendNow((v) => !v)}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ background: sendNow ? "#4A57B9" : "#D1D5DB" }}>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: sendNow ? "translateX(1.25rem)" : "translateX(0.125rem)" }} />
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3 flex-shrink-0" style={{ borderColor: "#E3E9F6" }}>
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border text-sm font-semibold" style={{ borderColor: "#E3E9F6", color: "#374151" }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity"
            style={{ background: "linear-gradient(135deg,#4A57B9,#6F80E8)", opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : sendNow ? <Send className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            {isLoading ? "Processing…" : sendNow ? "Send Notification" : "Save as Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Notification Row ──────────────────────────────────────────────────────────

function NotifRow({ notif, onView, onSend, onDelete, sending }: {
  notif: PlatformNotification;
  onView: () => void;
  onSend: () => void;
  onDelete: () => void;
  sending: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const typeCfg = TYPE_CFG[notif.type as NotifType] ?? TYPE_CFG.info;
  const TypeIcon = typeCfg.icon;

  return (
    <tr className="border-t hover:bg-blue-50/20 transition-colors cursor-pointer"
      style={{ borderColor: "#F3F4F6" }} onClick={onView}>
      {/* Icon + title */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: typeCfg.bg }}>
            <TypeIcon className="w-4 h-4" style={{ color: typeCfg.color }} />
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: "#111827" }}>{notif.title}</div>
            <div className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{truncate(notif.message, 60)}</div>
          </div>
        </div>
      </td>
      {/* Type */}
      <td className="px-4 py-4 whitespace-nowrap"><TypeBadge type={notif.type as NotifType} /></td>
      {/* Target */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#6B7280" }}>
          {notif.target_type === "all"
            ? <><Globe className="w-3.5 h-3.5" /><span>All Orgs</span></>
            : <><Building2 className="w-3.5 h-3.5" /><span className="truncate max-w-[120px]">{notif.target_org_name ?? "Specific"}</span></>
          }
        </div>
      </td>
      {/* Status */}
      <td className="px-4 py-4 whitespace-nowrap"><StatusBadge status={notif.status} /></td>
      {/* Sent count */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#6B7280" }}>
          <Mail className="w-3.5 h-3.5" />
          <span className="font-semibold" style={{ color: "#111827" }}>{notif.email_sent_count}</span>
        </div>
      </td>
      {/* Date */}
      <td className="px-4 py-4">
        <div className="text-xs" style={{ color: "#6B7280" }}>{fmtDate(notif.sent_at ?? notif.created_at)}</div>
      </td>
      {/* Actions */}
      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex items-center justify-end">
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen((v) => !v)}>
            <MoreVertical className="w-4 h-4" style={{ color: "#6B7280" }} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 bg-white rounded-xl border shadow-xl z-20 w-44 overflow-hidden"
              style={{ borderColor: "#E3E9F6" }} onMouseLeave={() => setMenuOpen(false)}>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50" style={{ color: "#374151" }}
                onClick={() => { setMenuOpen(false); onView(); }}>
                <Eye className="w-4 h-4" /> View Details
              </button>
              {notif.status === "draft" && (
                <button disabled={sending} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-blue-50" style={{ color: "#1D4ED8" }}
                  onClick={() => { setMenuOpen(false); onSend(); }}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Now
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

export function NotificationsPage() {
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useListNotificationsQuery();
  const { data: tenants = [] } = useListTenantsQuery();
  const [sendNotif, { isLoading: sending }] = useSendNotificationMutation();
  const [deleteNotif, { isLoading: deleting }] = useDeleteNotificationMutation();

  const notifications = data?.items ?? [];
  const stats = data?.stats ?? { total: 0, sent: 0, draft: 0, failed: 0 };

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [selected, setSelected] = useState<PlatformNotification | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlatformNotification | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return notifications.filter((n) => {
      const mQ = !q || n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
      const mT = typeFilter === "all" || n.type === typeFilter;
      const mS = statusFilter === "all" || n.status === statusFilter;
      return mQ && mT && mS;
    });
  }, [notifications, search, typeFilter, statusFilter]);

  const handleSend = async (notif: PlatformNotification) => {
    const result = await sendNotif(notif.id);
    if ("error" in result) { showToast("Failed to send notification", "error"); return; }
    showToast(`"${notif.title}" sent successfully`);
    if (selected?.id === notif.id) setSelected({ ...selected, status: "sent" });
    void refetch();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const result = await deleteNotif(confirmDelete.id);
    if ("error" in result) { showToast("Failed to delete", "error"); setConfirmDelete(null); return; }
    showToast("Notification deleted");
    setConfirmDelete(null);
    if (selected?.id === confirmDelete.id) setSelected(null);
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
            <h1 className="text-xl font-bold" style={{ color: "#111827" }}>Notifications</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>Broadcast messages to organisation admins</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()}
            className="w-9 h-9 rounded-xl border flex items-center justify-center hover:bg-gray-50 transition-colors"
            style={{ borderColor: "#E3E9F6" }} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} style={{ color: "#6B7280" }} />
          </button>
          <button onClick={() => setComposeOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg,#4A57B9,#6F80E8)" }}>
            <Plus className="w-4 h-4" /> Compose
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total",   value: stats.total,  color: "#4A57B9", icon: Bell,        filter: "all"    },
          { label: "Sent",    value: stats.sent,   color: "#059669", icon: CheckCheck,  filter: "sent"   },
          { label: "Draft",   value: stats.draft,  color: "#D97706", icon: FileText,    filter: "draft"  },
          { label: "Failed",  value: stats.failed, color: "#EF4444", icon: AlertCircle, filter: "failed" },
        ].map(({ label, value, color, icon: Icon, filter }) => (
          <button key={label}
            onClick={() => setStatusFilter(statusFilter === filter ? "all" : filter)}
            className="bg-white rounded-2xl border p-4 flex items-center gap-3 text-left hover:shadow-md transition-all"
            style={{
              borderColor: statusFilter === filter ? color : "#E3E9F6",
              boxShadow: statusFilter === filter ? `0 0 0 2px ${color}25` : undefined,
            }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: color + "18" }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: "#111827" }}>{value}</div>
              <div className="text-xs font-medium" style={{ color: "#6B7280" }}>{label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or message…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
            style={{ borderColor: "#E3E9F6" }} />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="pl-9 pr-8 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
            style={{ borderColor: "#E3E9F6", color: "#374151" }}>
            <option value="all">All Types</option>
            {(Object.entries(TYPE_CFG) as [NotifType, typeof TYPE_CFG[NotifType]][]).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        {(search || typeFilter !== "all" || statusFilter !== "all") && (
          <button onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); }}
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
          <Bell className="w-10 h-10 mx-auto mb-3" style={{ color: "#E5E7EB" }} />
          <div className="font-semibold text-sm" style={{ color: "#374151" }}>
            {search || typeFilter !== "all" || statusFilter !== "all"
              ? "No notifications match your filters"
              : "No notifications yet"}
          </div>
          <p className="text-xs mt-1 mb-4" style={{ color: "#9CA3AF" }}>
            {search || typeFilter !== "all" || statusFilter !== "all"
              ? "Try adjusting your filters."
              : "Click Compose to send your first notification."}
          </p>
          {!search && typeFilter === "all" && statusFilter === "all" && (
            <button onClick={() => setComposeOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: "linear-gradient(135deg,#4A57B9,#6F80E8)" }}>
              <Plus className="w-4 h-4" /> Compose
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E9F6" }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: "#F3F4F6", background: "#F9FAFB" }}>
            <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>
              {filtered.length} of {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {["Notification", "Type", "Target", "Status", "Emails", "Date", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "#6B7280" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => (
                  <NotifRow key={n.id} notif={n}
                    onView={() => setSelected(n)}
                    onSend={() => handleSend(n)}
                    onDelete={() => setConfirmDelete(n)}
                    sending={sending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compose panel */}
      <ComposePanel
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSuccess={() => {
          setComposeOpen(false);
          showToast("Notification created successfully!");
          void refetch();
        }}
        tenants={tenantList.map((t) => ({ id: t.id, name: t.name }))}
      />

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer
          notif={selected}
          onClose={() => setSelected(null)}
          onSend={() => handleSend(selected)}
          onDelete={() => { setSelected(null); setConfirmDelete(selected); }}
          sending={sending}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#FEE2E2" }}>
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="font-bold" style={{ color: "#111827" }}>Delete Notification</div>
                <div className="text-xs" style={{ color: "#6B7280" }}>This cannot be undone</div>
              </div>
            </div>
            <p className="text-sm" style={{ color: "#374151" }}>
              Delete <strong>"{confirmDelete.title}"</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl border text-sm font-semibold" style={{ borderColor: "#E3E9F6", color: "#374151" }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
                style={{ background: "#DC2626", opacity: deleting ? 0.7 : 1 }}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
