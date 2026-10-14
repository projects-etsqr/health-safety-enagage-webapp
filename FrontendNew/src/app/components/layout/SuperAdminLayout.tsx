import { useState } from "react";
import { Outlet, useNavigate, useLocation, Navigate } from "react-router";
import {
  LayoutDashboard, Building2, Mail, Users, Shield,
  LogOut, ShieldCheck,
  Menu, X, ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { name: "Dashboard",          icon: LayoutDashboard,   path: "/superadmin" },
  { name: "Invitations",        icon: Mail,              path: "/superadmin/invitations" },
  { name: "Tenant Management",  icon: Building2,         path: "/superadmin/tenants" },
  { name: "Users",              icon: Users,             path: "/superadmin/users" },
  { name: "Roles & Permissions",icon: Shield,            path: "/superadmin/roles" },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

function SuperAdminSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [hovered, setHovered] = useState<string | null>(null);

  const isActive = (path: string) =>
    path === "/superadmin"
      ? location.pathname === "/superadmin"
      : location.pathname.startsWith(path);

  const go = (path: string) => { navigate(path); onClose(); };

  const handleLogout = () => { logout(); navigate("/auth/login", { replace: true }); };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 bg-black/35 transition-opacity duration-200 lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[250px] h-full flex flex-col border-r transition-transform duration-200 lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ background: "linear-gradient(180deg, #FCFDFF 0%, #F4F7FD 100%)", borderColor: "#E3E9F6" }}
      >
        {/* Logo + badge */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "#E9EEF8" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-white">
                <img src="/logo.png" alt="HSE logo" className="h-full w-full object-cover" />
              </div>
              <div>
                <span className="text-[15px] font-bold" style={{ color: "#111827" }}>EHSERA Intelligence</span>
                <div className="mt-0.5">
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: "#EEF2FF", color: "#4A57B9" }}>
                    Super Admin
                  </span>
                </div>
              </div>
            </div>
            <button className="lg:hidden text-gray-400 hover:text-gray-600" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            const isHov = hovered === item.name;
            return (
              <button
                key={item.name}
                onClick={() => go(item.path)}
                onMouseEnter={() => setHovered(item.name)}
                onMouseLeave={() => setHovered(null)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
                style={active
                  ? { background: "linear-gradient(135deg, #4A57B9 0%, #6F80E8 100%)", boxShadow: "0 6px 16px rgba(79,94,190,0.28)" }
                  : { background: isHov ? "#EEF2FB" : "transparent" }}
              >
                <item.icon className="w-[17px] h-[17px] flex-shrink-0" style={{ color: active ? "#fff" : "#7C869C" }} />
                <span className="text-[13px] flex-1 text-left" style={{ color: active ? "#fff" : "#2F3A4F", fontWeight: active ? 600 : 500 }}>
                  {item.name}
                </span>
                {active && <ChevronRight className="w-3.5 h-3.5 text-white/70" />}
              </button>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="px-4 py-4 border-t" style={{ borderColor: "#E4EAF7" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold" style={{ background: "linear-gradient(135deg, #4A57B9, #6F80E8)" }}>
              {user?.initials || "SA"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate" style={{ color: "#111827" }}>{user?.name || "Super Admin"}</div>
              <div className="text-[10px]" style={{ color: "#9CA3AF" }}>{user?.email || ""}</div>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-md" style={{ background: "#F4F7FF" }} title="Sign out">
              <LogOut className="w-4 h-4" style={{ color: "#63739B" }} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────────

const BREADCRUMBS: Record<string, string> = {
  "/superadmin":               "Dashboard",
  "/superadmin/invitations":   "Invitations",
  "/superadmin/tenants":       "Tenant Management",
  "/superadmin/users":         "Users",
  "/superadmin/roles":         "Roles & Permissions",
};

function SuperAdminTopBar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const location = useLocation();
  const title = BREADCRUMBS[location.pathname] ?? "Super Admin";

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b bg-white" style={{ borderColor: "#E3E9F6" }}>
      <button className="lg:hidden p-1.5 rounded-lg" style={{ color: "#63739B" }} onClick={onOpenSidebar}>
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2 text-xs" style={{ color: "#9CA3AF" }}>
        <span>Super Admin</span>
        <ChevronRight className="w-3 h-3" />
        <span className="font-semibold" style={{ color: "#111827" }}>{title}</span>
      </div>
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function SuperAdminLayout() {
  const { isAuthenticated, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  if (!user?.isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <div className="h-screen overflow-hidden" style={{ backgroundColor: "#F6F8FC", backgroundImage: "radial-gradient(#D8DFEC 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
      <div className="h-full p-2 sm:p-3 md:p-4">
        <div className="h-full w-full rounded-[18px] sm:rounded-[22px] border overflow-hidden flex" style={{ background: "#F8FAFF", borderColor: "#DCE4F3", boxShadow: "0 18px 40px rgba(17,25,40,0.14)" }}>
          <SuperAdminSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden" style={{ background: "#F7F9FE" }}>
            <SuperAdminTopBar onOpenSidebar={() => setSidebarOpen(true)} />
            <main className="flex-1 min-h-0 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
