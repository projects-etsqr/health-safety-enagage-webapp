import { Bell, ChevronDown, ChevronRight, Moon, Sun, LogOut, Settings as SettingsIcon, Menu, AlertTriangle, Clock, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useState, useRef, useEffect } from "react";
import {
  getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead,
  resolveNotificationLink, type NotificationItem,
} from "../../../services/notifications.service";

const breadcrumbMap: Record<string, string> = {
  "/": "Dashboard",
  "/violations": "Incidents",
  // Legacy path for the register that is now the Unsafe Act family.
  "/hazards": "Unsafe Act",
  "/near-miss": "Near Miss",
  "/unsafe-acts": "Unsafe Act",
  "/permits/tracking": "Permits",
  "/audits": "Audits",
  "/actions": "Work",
  "/checklists": "Daily Checklists",
  "/compliance": "Compliance",
  "/policies": "Policies & Rules",
  "/users": "Users",
  "/ai-agent": "AI Agent",
  "/analytics": "Analytics",
  "/billing": "Billing",
  "/notifications": "Notifications",
  "/engagement": "Engagement",
  "/equipment-certification": "Assets",
  "/root-cause-analysis": "Risk",
  "/vendors": "Vendors",
  "/settings": "System Settings",
};

interface TopNavbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenSidebar: () => void;
}

export function TopNavbar({ darkMode, onToggleDarkMode, onOpenSidebar }: TopNavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifItems, setNotifItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  const currentPage = breadcrumbMap[location.pathname] || "Dashboard";
  const orgLabel = (user?.companyName || user?.orgCode || "").trim();

  const handleLogout = () => {
    logout();
    navigate("/auth/login", { replace: true });
  };

  // Fetch notifications and unread count from API
  useEffect(() => {
    getUnreadCount().then(setUnreadCount).catch(() => setUnreadCount(0));
  }, []);

  function refreshNotifs() {
    getNotifications(0, 10)
      .then(setNotifItems)
      .catch(() => setNotifItems([]));
    getUnreadCount().then(setUnreadCount).catch(() => {});
  }

  useEffect(() => {
    if (showNotifMenu) refreshNotifs();
  }, [showNotifMenu]);

  async function markRead(id: number) {
    await markNotificationRead(id).catch(() => {});
    setNotifItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    await markAllNotificationsRead().catch(() => {});
    setNotifItems(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) setShowNotifMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="min-h-16 flex items-center gap-3 px-3 py-2 sm:px-4 md:px-6 border-b bg-card" style={{ borderColor: darkMode ? '#1E3663' : '#DBE7FF' }}>
      <button
        type="button"
        onClick={onOpenSidebar}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg md:hidden"
        style={{ background: darkMode ? '#172846' : '#F3F7FF', color: darkMode ? '#AFC4EE' : '#4A5568' }}
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Breadcrumb */}
      <div className="hidden items-center gap-1.5 text-[13px] md:flex" style={{ color: '#9CA3AF' }}>
        <img src="/logo.png" alt="HSE logo" className="h-6 w-6 rounded-md object-cover" />
        {orgLabel && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <span
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: darkMode ? '#11387D' : '#EFF6FF', color: '#1D4ED8', fontWeight: 600 }}
            >
              {orgLabel}
            </span>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5" />
        <span style={{ color: darkMode ? '#EEF4FF' : '#0A0A0A', fontWeight: 500 }}>{currentPage}</span>
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2 md:gap-3">

        {/* Dark mode toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg transition-colors hover:bg-[#F3F7FF]"
          style={darkMode ? { background: '#172846' } : {}}
        >
          {darkMode ? <Sun className="w-4 h-4" style={{ color: '#93C5FD' }} /> : <Moon className="w-4 h-4" style={{ color: '#4A5568' }} />}
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative p-2 rounded-lg transition-colors hover:bg-[#F3F7FF]"
            style={darkMode ? { background: '#172846' } : {}}
          >
            <Bell className="w-[18px] h-[18px]" style={{ color: darkMode ? '#AFC4EE' : '#4A5568' }} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[9px] flex items-center justify-center" style={{ fontWeight: 600 }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-xl border z-50 overflow-hidden"
              style={{ background: darkMode ? '#111827' : '#ffffff', borderColor: darkMode ? '#1E3663' : '#E2E8F0' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: darkMode ? '#1E3663' : '#E2E8F0' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[14px]" style={{ color: darkMode ? '#F0F4F0' : '#0A0A0A', fontWeight: 600 }}>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-[#DC2626] text-white" style={{ fontWeight: 600 }}>{unreadCount}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead()}
                      className="text-[12px] transition-colors hover:underline"
                      style={{ color: '#1D4ED8', fontWeight: 500 }}
                    >
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotifMenu(false)} className="p-0.5 rounded hover:bg-gray-100">
                    <X className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="max-h-72 overflow-y-auto">
                {notifItems.length === 0 ? (
                  <div className="py-10 text-center text-[13px]" style={{ color: '#9CA3AF' }}>
                    No notifications yet
                  </div>
                ) : (
                  notifItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        markRead(item.id);
                        navigate(resolveNotificationLink(item) ?? "/notifications");
                        setShowNotifMenu(false);
                      }}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50"
                      style={{ background: item.is_read ? 'transparent' : (darkMode ? '#0F2044' : '#EFF6FF') }}
                    >
                      <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: item.type === "warning" ? '#FFFBEB' : item.type === "success" ? '#F0FDF4' : '#EFF6FF' }}>
                        {item.type === "warning"
                          ? <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#D97706' }} />
                          : item.type === "success"
                          ? <Clock className="w-3.5 h-3.5" style={{ color: '#15803D' }} />
                          : <Clock className="w-3.5 h-3.5" style={{ color: '#1D4ED8' }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px]" style={{ color: darkMode ? '#F0F4F0' : '#0A0A0A', fontWeight: item.is_read ? 400 : 600 }}>
                            {item.title}
                          </span>
                          {!item.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8] flex-shrink-0" />}
                        </div>
                        <p className="mt-0.5 text-[12px] truncate" style={{ color: '#6B7280' }}>{item.message}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t px-4 py-2.5" style={{ borderColor: darkMode ? '#1E3663' : '#E2E8F0' }}>
                <button
                  onClick={() => { navigate("/notifications"); setShowNotifMenu(false); }}
                  className="w-full text-center text-[13px] transition-colors hover:underline"
                  style={{ color: '#1D4ED8', fontWeight: 500 }}
                >
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="hidden h-8 w-px sm:block" style={{ background: darkMode ? '#1E3663' : '#DBE7FF' }} />

        {/* User */}
        <div className="relative" ref={menuRef}>
          {/* Trigger */}
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-colors hover:bg-[#F3F7FF]"
            style={darkMode ? { background: showUserMenu ? '#172846' : 'transparent' } : { background: showUserMenu ? '#EFF6FF' : 'transparent' }}
          >
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0B3D91, #3B82F6)', fontWeight: 700 }}
            >
              {user?.initials || "JD"}
            </div>
            {/* Name + role stacked */}
            <div className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-[13px] max-w-[100px] truncate" style={{ color: darkMode ? '#EEF4FF' : '#0A0A0A', fontWeight: 600 }}>
                {user?.name || "User"}
              </span>
              <span className="text-[11px] uppercase" style={{ color: '#1D4ED8', fontWeight: 500 }}>
                {user?.role || "Admin"}
              </span>
            </div>
            <ChevronDown
              className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
              style={{ color: '#9CA3AF', transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-64 rounded-xl shadow-xl border z-50 overflow-hidden"
              style={{ background: darkMode ? '#111827' : '#ffffff', borderColor: darkMode ? '#1E3663' : '#E2E8F0' }}
            >
              {/* Profile header */}
              <div
                className="flex items-center gap-3 px-4 py-4"
                style={{ background: darkMode ? '#0F2044' : '#F8FAFF', borderBottom: `1px solid ${darkMode ? '#1E3663' : '#E2E8F0'}` }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[15px] flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #0B3D91, #3B82F6)', fontWeight: 700 }}
                >
                  {user?.initials || "JD"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] truncate" style={{ color: darkMode ? '#EEF4FF' : '#0A0A0A', fontWeight: 600 }}>
                    {user?.name || "User"}
                  </div>
                  <div className="text-[12px] truncate" style={{ color: '#6B7280' }}>
                    {user?.email || "user@organization.com"}
                  </div>
                  <span
                    className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] uppercase"
                    style={{ background: darkMode ? '#11387D' : '#EFF6FF', color: '#1D4ED8', fontWeight: 700 }}
                  >
                    {user?.role || "Admin"}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="py-1.5">
                <button
                  onClick={() => { navigate("/settings"); setShowUserMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50"
                  style={{ color: darkMode ? '#D1D5DB' : '#374151' }}
                >
                  <SettingsIcon className="w-4 h-4 flex-shrink-0" style={{ color: '#6B7280' }} />
                  Settings
                </button>
              </div>

              {/* Sign out */}
              <div className="border-t py-1.5" style={{ borderColor: darkMode ? '#1E3663' : '#E2E8F0' }}>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-red-50"
                  style={{ color: '#DC2626' }}
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
