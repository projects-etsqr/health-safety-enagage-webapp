import { useLocation, useNavigate } from "react-router";
import { BookOpenText, Database, Lightbulb, PlayCircle, Settings as SettingsIcon } from "lucide-react";

const FAMILIES = [
  { name: "Settings", icon: SettingsIcon, path: "/settings", prefixes: ["/settings"] },
  { name: "Checklists", icon: BookOpenText, path: "/checklists", prefixes: ["/checklists"] },
  { name: "Data", icon: Database, path: "/data-management", prefixes: ["/data-management"] },
  { name: "Intelligence", icon: Lightbulb, path: "/ai-agent", prefixes: ["/ai-agent"] },
  { name: "Training", icon: PlayCircle, path: "/training", prefixes: ["/training"] },
];

/**
 * Switches between Settings, Checklists, Data and Intelligence — the four
 * items the sidebar used to hold as a submenu under "Settings" (see
 * Sidebar.tsx). Mounted on all four pages so the row stays on screen when you
 * move between them, the same reasoning EventFamilyTabBar uses for
 * Incidents/Hazards/Permits/Near Miss/Unsafe Act.
 */
export function SettingsFamilyTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {FAMILIES.map((family) => {
        const active = family.prefixes.some((p) => location.pathname.startsWith(p));
        return (
          <button
            key={family.name}
            type="button"
            onClick={() => navigate(family.path)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] transition-colors"
            style={{
              background: active ? "#4A57B9" : "#F1F5F9",
              color: active ? "#FFFFFF" : "#475569",
              fontWeight: active ? 700 : 500,
            }}
          >
            <family.icon className="h-3.5 w-3.5" />
            {family.name}
          </button>
        );
      })}
    </div>
  );
}
