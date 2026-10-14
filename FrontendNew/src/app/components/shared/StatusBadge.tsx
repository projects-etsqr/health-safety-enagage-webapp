interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  "Open": { bg: "#DBEAFE", text: "#1D4ED8" },
  "Acknowledged": { bg: "#FEF3C7", text: "#92400E" },
  "In Progress": { bg: "#EDE9FE", text: "#6D28D9" },
  "Closed": { bg: "#DBEAFE", text: "#1E3A8A" },
  "False Positive": { bg: "#F3F4F6", text: "#6B7280" },
  "Active": { bg: "#DBEAFE", text: "#1E3A8A" },
  "Inactive": { bg: "#F3F4F6", text: "#6B7280" },
  "Offline": { bg: "#FEE2E2", text: "#991B1B" },
  "On Time": { bg: "#DBEAFE", text: "#1E3A8A" },
  "Due Soon": { bg: "#FEF3C7", text: "#92400E" },
  "Overdue": { bg: "#FEE2E2", text: "#991B1B" },
  "Delivered": { bg: "#DBEAFE", text: "#1E3A8A" },
  "Failed": { bg: "#FEE2E2", text: "#991B1B" },
  "Pending": { bg: "#FEF3C7", text: "#92400E" },
  "Connected": { bg: "#DBEAFE", text: "#1E3A8A" },
  "Disconnected": { bg: "#F3F4F6", text: "#6B7280" },
  "Allowed": { bg: "#DBEAFE", text: "#1E3A8A" },
  "Denied": { bg: "#FEE2E2", text: "#991B1B" },
  "Online": { bg: "#DBEAFE", text: "#1E3A8A" },
  "Outdated": { bg: "#FEF3C7", text: "#92400E" },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const style = statusStyles[status] || { bg: "#F3F4F6", text: "#6B7280" };
  return (
    <span
      className={`inline-flex items-center rounded-full uppercase ${size === "sm" ? "px-2 py-0.5 text-[9px]" : "px-3 py-1 text-[11px]"}`}
      style={{ background: style.bg, color: style.text, fontWeight: 600 }}
    >
      {status}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: "Low" | "Medium" | "High" | "Critical";
}

const severityStyles: Record<string, { bg: string; text: string }> = {
  "Low": { bg: "#DBEAFE", text: "#1E3A8A" },
  "Medium": { bg: "#FEF3C7", text: "#92400E" },
  "High": { bg: "#FEE2E2", text: "#991B1B" },
  "Critical": { bg: "#0B3D91", text: "#FFFFFF" },
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const style = severityStyles[severity];
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase"
      style={{ background: style.bg, color: style.text, fontWeight: 600 }}
    >
      {severity}
    </span>
  );
}

interface RoleBadgeProps {
  role: string;
}

const roleStyles: Record<string, { bg: string; text: string }> = {
  "Admin": { bg: "#DBEAFE", text: "#1E3A8A" },
  "Supervisor": { bg: "#DBEAFE", text: "#1E3A8A" },
  "Auditor": { bg: "#F3F4F6", text: "#6B7280" },
  "HSE Manager": { bg: "#EDE9FE", text: "#6D28D9" },
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const style = roleStyles[role] || { bg: "#F3F4F6", text: "#6B7280" };
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase"
      style={{ background: style.bg, color: style.text, fontWeight: 600 }}
    >
      {role}
    </span>
  );
}

interface ZoneBadgeProps {
  type: string;
}

const zoneStyles: Record<string, { bg: string; text: string }> = {
  "Mandatory PPE": { bg: "#DBEAFE", text: "#1E3A8A" },
  "Restricted": { bg: "#FEE2E2", text: "#991B1B" },
  "Hazard": { bg: "#FEF3C7", text: "#92400E" },
};

export function ZoneBadge({ type }: ZoneBadgeProps) {
  const style = zoneStyles[type] || { bg: "#F3F4F6", text: "#6B7280" };
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase"
      style={{ background: style.bg, color: style.text, fontWeight: 600 }}
    >
      {type}
    </span>
  );
}
