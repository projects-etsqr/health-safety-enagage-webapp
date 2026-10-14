import { useLocation, useNavigate } from "react-router";
import { GitBranch, ListChecks } from "lucide-react";

const TABS = [
  // The overview keeps its original path: the sidebar's Risk entry and several
  // dashboard links already point at /root-cause-analysis, and renaming it would
  // break them for a cosmetic gain.
  { name: "Overview", icon: ListChecks, path: "/root-cause-analysis" },
  { name: "Lifecycle Tracking", icon: GitBranch, path: "/risk/tracking" },
];

/** Sub-navigation for the Risk section, matching the Incidents, Hazards and
 *  Near Miss sections rather than adding a sidebar submenu. */
export function RiskTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="mb-5 flex flex-wrap gap-1.5 border-b border-slate-200 pb-0">
      {TABS.map((tab) => {
        const active = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
            className="flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-[13px] transition-colors"
            style={{
              borderColor: active ? "#4A57B9" : "transparent",
              color: active ? "#4A57B9" : "#64748B",
              fontWeight: active ? 700 : 500,
              background: active ? "#F5F7FF" : "transparent",
            }}
          >
            <tab.icon className="h-4 w-4" />
            {tab.name}
          </button>
        );
      })}
    </div>
  );
}
