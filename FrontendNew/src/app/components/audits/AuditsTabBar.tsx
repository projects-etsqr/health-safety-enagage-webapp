import { useLocation, useNavigate } from "react-router";
import { BookOpenText, CalendarClock, ListChecks, TrendingUp } from "lucide-react";

const TABS = [
  { name: "Register", icon: ListChecks, path: "/audits" },
  // "Audit Schedule", not "Programme". The page books each site's visits for
  // the year; "programme" is the industry word for that and means nothing to
  // someone meeting the product for the first time.
  { name: "Audit Schedule", icon: CalendarClock, path: "/audits/programme" },
  { name: "Trends", icon: TrendingUp, path: "/audits/trends" },
  { name: "Templates", icon: BookOpenText, path: "/audits/templates" },
];

/** Sub-navigation for the Audits section, shown at the top of each audit
 *  page instead of as a sidebar submenu. */
export function AuditsTabBar() {
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
