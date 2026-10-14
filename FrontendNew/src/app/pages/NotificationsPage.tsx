import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Bell, CheckCheck, Info, CheckCircle, AlertTriangle, Wrench, Megaphone, Loader2 } from "lucide-react";
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  resolveNotificationLink, type NotificationItem,
} from "../../services/notifications.service";

type Filter = "all" | "unread" | "read";

const TYPE_CONFIG: Record<NotificationItem["type"], { icon: React.ElementType; bg: string; color: string; label: string }> = {
  info:         { icon: Info,          bg: "#EFF6FF", color: "#1D4ED8", label: "Info" },
  success:      { icon: CheckCircle,   bg: "#F0FDF4", color: "#15803D", label: "Success" },
  warning:      { icon: AlertTriangle, bg: "#FFFBEB", color: "#B45309", label: "Warning" },
  maintenance:  { icon: Wrench,        bg: "#F3F4F6", color: "#4B5563", label: "Maintenance" },
  announcement: { icon: Megaphone,     bg: "#FAF5FF", color: "#7C3AED", label: "Announcement" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    setLoading(true);
    getNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const filtered = notifications.filter(n => {
    if (filter === "unread") return !n.is_read;
    if (filter === "read") return n.is_read;
    return true;
  });

  async function handleMarkRead(id: number) {
    await markNotificationRead(id).catch(() => {});
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    await markAllNotificationsRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setMarkingAll(false);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px]" style={{ color: '#0A0A0A', fontWeight: 700 }}>Notifications</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: '#6B7280' }}>
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-[13px] transition-colors hover:bg-[#F3F7FF] disabled:opacity-50"
            style={{ borderColor: '#DBE7FF', color: '#1D4ED8', fontWeight: 500 }}
          >
            {markingAll
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <CheckCheck className="w-4 h-4" />
            }
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: '#E2E8F0' }}>
        {(["all", "unread", "read"] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2.5 text-[13px] capitalize transition-colors relative"
            style={{ color: filter === f ? '#1D4ED8' : '#4A5568', fontWeight: filter === f ? 600 : 400 }}
          >
            {f}
            {f === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-[#DC2626] text-white" style={{ fontWeight: 600 }}>
                {unreadCount}
              </span>
            )}
            {filter === f && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t" style={{ background: '#1D4ED8' }} />
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
            <span className="text-[13px]" style={{ color: '#6B7280' }}>Loading notifications…</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#EFF6FF' }}>
            <Bell className="w-6 h-6" style={{ color: '#1D4ED8' }} />
          </div>
          <p className="text-[14px]" style={{ color: '#6B7280' }}>
            {filter === "unread" ? "No unread notifications" : filter === "read" ? "No read notifications" : "No notifications yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
            const Icon = cfg.icon;
            const link = resolveNotificationLink(n);
            return (
              <div
                key={n.id}
                role={link ? "button" : undefined}
                tabIndex={link ? 0 : undefined}
                onClick={link ? () => { if (!n.is_read) handleMarkRead(n.id); navigate(link); } : undefined}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${link ? "cursor-pointer hover:bg-[#F8FAFF]" : ""}`}
                style={{
                  background: n.is_read ? '#ffffff' : '#EFF6FF',
                  borderColor: n.is_read ? '#E2E8F0' : '#BFDBFE',
                }}
              >
                {/* Icon */}
                <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: cfg.bg }}>
                  <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className="text-[13px]"
                        style={{ color: '#0A0A0A', fontWeight: n.is_read ? 400 : 600 }}
                      >
                        {n.title}
                      </span>
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] uppercase"
                        style={{ background: cfg.bg, color: cfg.color, fontWeight: 600 }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px]" style={{ color: '#9CA3AF' }}>
                        {timeAgo(n.sent_at ?? n.created_at)}
                      </span>
                      {!n.is_read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                          className="text-[11px] px-2 py-0.5 rounded-md border transition-colors hover:bg-white"
                          style={{ borderColor: '#BFDBFE', color: '#1D4ED8', fontWeight: 500 }}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-[13px]" style={{ color: '#4B5563' }}>{n.message}</p>
                  {!n.is_read && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" />
                      <span className="text-[11px]" style={{ color: '#1D4ED8', fontWeight: 500 }}>Unread</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
