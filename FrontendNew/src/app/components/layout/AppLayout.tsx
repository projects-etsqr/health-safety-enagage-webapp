import { Outlet, useNavigate } from "react-router";
import { Sidebar } from "./Sidebar";
import { TopNavbar } from "./TopNavbar";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ArrowRight, X } from "lucide-react";

const DEFAULT_APP_TITLE = "Enterprise EHSERA Intelligence App UI";

export function AppLayout() {
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dismissedSetupPrompt, setDismissedSetupPrompt] = useState(false);
  const navigate = useNavigate();
  const { user, isOnboardingScopedUser } = useAuth();

  const setupRequired = Boolean(user?.onboardingSetupRequired && !user?.onboardingSetupCompleted);
  const showSetupPrompt = Boolean(setupRequired && isOnboardingScopedUser && !dismissedSetupPrompt);

  useEffect(() => {
    if (!setupRequired) {
      setDismissedSetupPrompt(false);
    }
  }, [setupRequired, user?.email, user?.orgCode]);

  useEffect(() => {
    const orgName = (user?.companyName || user?.orgCode || "").trim();
    const displayName = (user?.name || "").trim();

    if (isOnboardingScopedUser && orgName) {
      document.title = displayName
        ? `${orgName} • ${displayName} | EHSERA Intelligence`
        : `${orgName} | EHSERA Intelligence`;
      return;
    }

    if (displayName) {
      document.title = `${displayName} | EHSERA Intelligence`;
      return;
    }

    document.title = DEFAULT_APP_TITLE;
  }, [isOnboardingScopedUser, user?.companyName, user?.name, user?.email]);

  return (
    <div
      className={`h-screen overflow-hidden ${darkMode ? 'dark' : ''}`}
      style={
        darkMode
          ? { background: '#070F21' }
          : {
              backgroundColor: '#F6F8FC',
              backgroundImage: 'radial-gradient(#D8DFEC 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            }
      }
    >
      <div className="h-full p-2 sm:p-3 md:p-4">
        <div
          className="h-full w-full rounded-[18px] border overflow-hidden flex sm:rounded-[22px]"
          style={{
            background: darkMode ? '#070F21' : '#F8FAFF',
            borderColor: darkMode ? '#1E3663' : '#DCE4F3',
            boxShadow: darkMode ? 'none' : '0 18px 40px rgba(17, 25, 40, 0.14)',
          }}
        >
          <Sidebar mobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden" style={{ background: darkMode ? '#070F21' : '#F7F9FE' }}>
            <TopNavbar
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode(!darkMode)}
              onOpenSidebar={() => setSidebarOpen(true)}
            />
            <main className="flex-1 min-h-0 overflow-auto p-2 sm:p-3 md:p-4 lg:p-5" style={{ background: darkMode ? '#070F21' : '#F7F9FE' }}>
              <Outlet context={{ darkMode }} />
            </main>
          </div>
        </div>
      </div>

      {showSetupPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(7, 15, 33, 0.45)' }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border bg-white p-6 shadow-2xl"
            style={{ borderColor: '#D6E4FF' }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[20px]" style={{ color: '#0A0A0A', fontWeight: 700 }}>
                  Welcome! Complete organization onboarding
                </h2>
                <p className="mt-1 text-[13px]" style={{ color: '#4A5568' }}>
                  Your request is approved. One final setup and your tenant is fully ready.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissedSetupPrompt(true)}
                className="rounded-lg p-2 hover:bg-[#F3F7FF]"
                aria-label="Close onboarding setup prompt"
              >
                <X className="h-4 w-4" style={{ color: '#4A5568' }} />
              </button>
            </div>

            <div
              className="mb-5 rounded-xl border p-4"
              style={{ borderColor: '#E5EDFF', background: '#F7FAFF' }}
            >
              <ul className="list-disc space-y-1 pl-5 text-[13px]" style={{ color: '#1F3257' }}>
                <li>Add your organization units/sites and primary users.</li>
                <li>Tell us which checklist standards you follow.</li>
                <li>Upload historical and org data in any format (Excel, CSV, PDF, docs, etc.).</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDismissedSetupPrompt(true)}
                className="rounded-lg border px-4 py-2 text-[13px]"
                style={{ borderColor: '#D6E4FF', color: '#4A5568', fontWeight: 600 }}
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissedSetupPrompt(true);
                  navigate('/users?tab=onboarding-setup');
                }}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] text-white"
                style={{ background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)', fontWeight: 600 }}
              >
                Start onboarding setup
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
