/**
 * The Auditor's entire web experience: a read-only view of their own assigned
 * audits. Everything an Auditor actually DOES — opening meeting, checklist
 * responses, evidence, closing meeting, issuing the report — happens on the
 * phone (see backend/app/services/audit_steps.py's MOBILE_STEPS/WEB_STEPS
 * split, and mobile/src/auditor/). This layout exists so the account isn't
 * simply turned away at login, not to duplicate that field workflow.
 */
import { Navigate, Outlet, useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function AuditorLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  if (user?.role !== "Auditor") return <Navigate to="/" replace />;

  const handleLogout = () => { logout(); navigate("/auth/login", { replace: true }); };

  return (
    <div className="min-h-screen" style={{ background: "#F6F8FC" }}>
      <header className="flex items-center gap-3 border-b bg-white px-4 py-3 sm:px-6" style={{ borderColor: "#E3E9F6" }}>
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white">
          <img src="/logo.png" alt="HSE logo" className="h-full w-full object-cover" />
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold" style={{ color: "#111827" }}>EHSERA Intelligence</div>
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#4A57B9" }}>Auditor</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[13px] font-semibold" style={{ color: "#111827" }}>{user?.name || "Auditor"}</div>
            <div className="text-[11px]" style={{ color: "#9CA3AF" }}>{user?.email || ""}</div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: "linear-gradient(135deg, #4A57B9, #6F80E8)" }}>
            {user?.initials || "AU"}
          </div>
          <button onClick={handleLogout} className="rounded-md p-1.5" style={{ background: "#F4F7FF" }} title="Sign out">
            <LogOut className="h-4 w-4" style={{ color: "#63739B" }} />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
