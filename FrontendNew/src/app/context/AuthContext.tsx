import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { loginWithHSEBackend } from "../../services/auth.service";
import { checkOrgSetupRequired } from "../../services/organisation-setup.service";

export type LoginResult =
  | "success"
  | "org_setup_required"
  | "invalid_credentials"
  | "user_not_found"
  | "password_setup_required"
  | "pending_approval"
  | "access_denied"
  | "network_error"
  | "mobile_only"
  | "error";

const ADMIN_EMAIL = import.meta.env.VITE_DEV_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = import.meta.env.VITE_DEV_ADMIN_PASSWORD ?? "";
const SUPER_ADMIN_EMAIL = import.meta.env.VITE_DEV_SUPER_ADMIN_EMAIL ?? "";
const SUPER_ADMIN_PASSWORD = import.meta.env.VITE_DEV_SUPER_ADMIN_PASSWORD ?? "";
const SUPER_ADMIN_PASSWORD_ALT = import.meta.env.VITE_DEV_SUPER_ADMIN_PASSWORD_ALT ?? "";
const INSPECTOR_EMAIL = import.meta.env.VITE_DEV_INSPECTOR_EMAIL ?? "";
const INSPECTOR_PASSWORD = import.meta.env.VITE_DEV_INSPECTOR_PASSWORD ?? "";
const ENGINEER_EMAIL = import.meta.env.VITE_DEV_ENGINEER_EMAIL ?? "";
const ENGINEER_PASSWORD = import.meta.env.VITE_DEV_ENGINEER_PASSWORD ?? "";
const WORKER_EMAIL = import.meta.env.VITE_DEV_WORKER_EMAIL ?? "";
const WORKER_PASSWORD = import.meta.env.VITE_DEV_WORKER_PASSWORD ?? "";
const ENABLE_DEV_TEST_ACCOUNTS = import.meta.env.DEV && String(import.meta.env.VITE_ENABLE_DEV_TEST_ACCOUNTS ?? "false").toLowerCase() === "true";
const PRODUCT_ADMIN_EMAILS = new Set(
  String(import.meta.env.VITE_PRODUCT_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
const ENABLE_DEV_PRODUCT_ADMIN_FALLBACK = import.meta.env.DEV && String(import.meta.env.VITE_ENABLE_DEV_PRODUCT_ADMIN_FALLBACK ?? "true").toLowerCase() === "true";
const ENABLE_PROD_SUPERADMIN_HARDCODED_LOGIN = !import.meta.env.DEV && String(import.meta.env.VITE_ENABLE_PROD_SUPERADMIN_HARDCODED_LOGIN ?? "false").toLowerCase() === "true";

// ─────────────────────────────────────────────────────────────────────────────
// ROLE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All user roles supported in the HSE platform.
 *
 * - Admin          : Full system access — all KPIs, all pages, all actions.
 * - HSE Manager    : Full operational + compliance access across all sites.
 * - Safety Manager : Incidents, actions, workers, zones, contractors per site.
 * - Supervisor     : Day-to-day operational KPIs for their assigned site/shift.
 * - Auditor        : Read-only access to compliance, incidents summary & audit trail.
 * - Site Inspector : Custom role mapped to Supervisor.
 * - Site Engineer  : Custom role mapped to Safety Manager.
 * - Worker         : Custom role mapped to Auditor.
 * - Contractor     : External workforce role mapped to Auditor-level visibility.
 */
export type UserRole = "Admin" | "HSE Manager" | "Safety Manager" | "Supervisor" | "Auditor" | "Site Inspector" | "Site Engineer" | "Worker" | "Contractor";

export type UiModuleLabel =
  | "Dashboard"
  | "Incidents"
  | "Actions & SLA"
  | "Checklists"
  | "Compliance"
  | "Sites & Zones"
  | "Cameras & Devices"
  | "Near Miss"
  | "Root Cause Analysis"
  | "Equipment Certification"
  | "AI Agent";

const ALL_MODULE_LABELS: UiModuleLabel[] = [
  "Dashboard",
  "Incidents",
  "Actions & SLA",
  "Checklists",
  "Compliance",
  "Sites & Zones",
  "Cameras & Devices",
  "Near Miss",
  "Root Cause Analysis",
  "Equipment Certification",
  "AI Agent",
];

const ONBOARDING_MODULE_ALIASES: Record<string, UiModuleLabel> = {
  dashboard: "Dashboard",
  violations: "Incidents",
  incidents: "Incidents",
  "non-compliance": "Incidents",
  "incidents / non-compliance": "Incidents",
  "actions & sla": "Actions & SLA",
  actions: "Actions & SLA",
  checklists: "Checklists",
  compliance: "Compliance",
  "sites & zones": "Sites & Zones",
  "sites and zones": "Sites & Zones",
  "cameras & devices": "Cameras & Devices",
  "near miss": "Near Miss",
  "root cause analysis": "Root Cause Analysis",
  "equipment certification": "Equipment Certification",
  "ai agent": "AI Agent",
  "access intelligence": "AI Agent",
  "ai functionality": "AI Agent",
  chatbot: "AI Agent",
  "ai agent & chat interface": "AI Agent",
};

function normalizeModuleLabel(raw: string): UiModuleLabel | null {
  const key = raw.trim().toLowerCase();
  return ONBOARDING_MODULE_ALIASES[key] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export type KPICategory =
  | "Dashboard"
  | "Incidents"
  | "Actions & SLA"
  | "Workers & Access"
  | "Sites & Zones"
  | "Contractors"
  | "Devices & Infrastructure"
  | "Compliance";

export interface KPI {
  /** Unique identifier used in code to check access */
  id: string;
  /** Human-readable label shown on KPI cards */
  label: string;
  /** Grouping category */
  category: KPICategory;
  /** Page(s) where this KPI is rendered */
  pages: string[];
  /** Backend API endpoint or data source field that feeds this KPI */
  dataSource: string;
  /** API field / computation description */
  computation: string;
  /** Roles allowed to view this KPI */
  allowedRoles: UserRole[];
  /** Whether this KPI is already implemented in the UI */
  implemented: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI REGISTRY  — Single source of truth for every KPI in the platform
// ─────────────────────────────────────────────────────────────────────────────

export const KPI_REGISTRY: KPI[] = [
  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  {
    id: "total_violations_today",
    label: "Total Incidents Today",
    category: "Dashboard",
    pages: ["Dashboard"],
    dataSource: "/api/dashboard/stats",
    computation: "DashboardStats.total_violations_today",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: true,
  },
  {
    id: "compliance_rate",
    label: "Compliance Rate",
    category: "Dashboard",
    pages: ["Dashboard"],
    dataSource: "/api/dashboard/stats",
    computation: "DashboardStats.compliance_rate — % workers PPE-compliant",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor", "Auditor"],
    implemented: true,
  },
  {
    id: "open_actions",
    label: "Open Actions",
    category: "Dashboard",
    pages: ["Dashboard"],
    dataSource: "/api/dashboard/stats",
    computation: "DashboardStats.open_actions — count of Actions where Status != 'Closed'",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: true,
  },
  {
    id: "avg_response_time",
    label: "Avg Response Time",
    category: "Dashboard",
    pages: ["Dashboard"],
    dataSource: "/api/dashboard/stats",
    computation: "DashboardStats.avg_response_time — mean time from Detected_At to first action",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager"],
    implemented: true,
  },
  {
    id: "workers_on_site",
    label: "Workers on Site",
    category: "Dashboard",
    pages: ["Dashboard"],
    dataSource: "/api/dashboard/stats",
    computation: "DashboardStats.workers_on_site — count of Workers with Status = 'Active'",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: true,
  },

  // ── INCIDENTS ──────────────────────────────────────────────────────────────
  {
    id: "violations_by_severity",
    label: "Incidents by Severity",
    category: "Incidents",
    pages: ["Dashboard", "Incidents", "Analytics"],
    dataSource: "/api/violations",
    computation: "Group Incidents by Severity (Critical | High | Medium | Low) — count per bucket",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor", "Auditor"],
    implemented: false,
  },
  {
    id: "violations_by_shift",
    label: "Incidents by Shift",
    category: "Incidents",
    pages: ["Dashboard", "Analytics"],
    dataSource: "/api/violations",
    computation: "Group Incidents by Shift field — count per shift",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: false,
  },
  {
    id: "violations_by_zone",
    label: "Incidents by Zone",
    category: "Incidents",
    pages: ["Incidents", "Analytics", "Sites & Zones"],
    dataSource: "/api/violations",
    computation: "Group Incidents by Zone_ID — count per zone",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: false,
  },
  {
    id: "violations_by_ppe_type",
    label: "Incidents by PPE Type",
    category: "Incidents",
    pages: ["Incidents", "Analytics"],
    dataSource: "/api/violations",
    computation: "Group Incidents by PPE_Missing — count per PPE type",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor", "Auditor"],
    implemented: false,
  },
  {
    id: "false_positive_rate",
    label: "False Positive Rate",
    category: "Incidents",
    pages: ["Incidents", "Analytics"],
    dataSource: "/api/violations",
    computation: "count(Status = 'False Positive') / total incidents × 100",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager"],
    implemented: false,
  },
  {
    id: "avg_confidence_score",
    label: "Avg AI Confidence Score",
    category: "Incidents",
    pages: ["Incidents", "Analytics"],
    dataSource: "/api/violations",
    computation: "mean(Incidents.Confidence_Score)",
    allowedRoles: ["Admin", "HSE Manager"],
    implemented: false,
  },
  {
    id: "violation_acknowledgement_rate",
    label: "Violation Acknowledgement Rate",
    category: "Incidents",
    pages: ["Violations", "Analytics"],
    dataSource: "/api/violations",
    computation: "count(Status != 'Open') / total violations × 100",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: false,
  },

  // ── ACTIONS & SLA ──────────────────────────────────────────────────────────
  {
    id: "total_open_actions",
    label: "Total Open Actions",
    category: "Actions & SLA",
    pages: ["Actions"],
    dataSource: "/api/actions",
    computation: "count(Actions.Status = 'Open')",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: true,
  },
  {
    id: "overdue_actions",
    label: "Overdue Actions",
    category: "Actions & SLA",
    pages: ["Actions"],
    dataSource: "/api/actions",
    computation: "count(Status != 'Closed' AND Due_Date < today)",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: true,
  },
  {
    id: "due_today_actions",
    label: "Due Today",
    category: "Actions & SLA",
    pages: ["Actions"],
    dataSource: "/api/actions",
    computation: "count(Status != 'Closed' AND Due_Date = today)",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: true,
  },
  {
    id: "closed_this_month_actions",
    label: "Closed This Month",
    category: "Actions & SLA",
    pages: ["Actions"],
    dataSource: "/api/actions",
    computation: "count(Status = 'Closed' AND Completed_At within current month)",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: true,
  },
  {
    id: "sla_breach_rate",
    label: "SLA Breach Rate",
    category: "Actions & SLA",
    pages: ["Actions", "Analytics"],
    dataSource: "/api/actions + /api/sla-config",
    computation: "count(actions exceeding SLA.Resolution_Time_Hours per severity) / total × 100",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager"],
    implemented: false,
  },
  {
    id: "avg_resolution_time_by_severity",
    label: "Avg Resolution Time by Severity",
    category: "Actions & SLA",
    pages: ["Actions", "Analytics"],
    dataSource: "/api/actions",
    computation: "mean(Completed_At - Created_At) grouped by Actions.Priority",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager"],
    implemented: false,
  },
  {
    id: "action_completion_rate",
    label: "Action Completion Rate",
    category: "Actions & SLA",
    pages: ["Actions", "Analytics"],
    dataSource: "/api/actions",
    computation: "count(Status = 'Closed') / total actions × 100",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: false,
  },

  // ── WORKERS & ACCESS ───────────────────────────────────────────────────────
  {
    id: "gate_access_denial_rate",
    label: "Gate Access Denial Rate",
    category: "Workers & Access",
    pages: ["Sites & Zones", "Analytics"],
    dataSource: "/api/access-log",
    computation: "count(Result = 'Denied') / total access events × 100",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: false,
  },
  {
    id: "rfid_reads_today",
    label: "RFID Reads Today",
    category: "Workers & Access",
    pages: ["Cameras & Devices"],
    dataSource: "/api/rfid-readers",
    computation: "sum(RFIDReaders.Total_Reads_Today)",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager"],
    implemented: false,
  },
  {
    id: "active_workers_per_shift",
    label: "Active Workers per Shift",
    category: "Workers & Access",
    pages: ["Dashboard", "Analytics"],
    dataSource: "/api/workers",
    computation: "count(Workers.Status = 'Active') grouped by Workers.Shift",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: false,
  },

  // ── SITES & ZONES ──────────────────────────────────────────────────────────
  {
    id: "site_compliance_rate",
    label: "Site Compliance Rate",
    category: "Sites & Zones",
    pages: ["Dashboard", "Sites & Zones", "Analytics"],
    dataSource: "/api/sites",
    computation: "Sites.Compliance_Rate per site",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor", "Auditor"],
    implemented: false,
  },
  {
    id: "high_risk_zone_count",
    label: "High-Risk Zone Count",
    category: "Sites & Zones",
    pages: ["Dashboard", "Sites & Zones"],
    dataSource: "/api/zones",
    computation: "count(Zones.Risk_Score > 70)",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: false,
  },
  {
    id: "avg_zone_risk_score",
    label: "Avg Zone Risk Score",
    category: "Sites & Zones",
    pages: ["Sites & Zones", "Analytics"],
    dataSource: "/api/zones",
    computation: "mean(Zones.Risk_Score)",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: false,
  },

  // ── CONTRACTORS ────────────────────────────────────────────────────────────
  {
    id: "contractor_safety_score",
    label: "Contractor Safety Score",
    category: "Contractors",
    pages: ["Dashboard", "Analytics"],
    dataSource: "/api/contractors",
    computation: "Contractors.Safety_Score per contractor",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager"],
    implemented: false,
  },
  {
    id: "violations_per_contractor",
    label: "Violations per Contractor",
    category: "Contractors",
    pages: ["Analytics", "Violations"],
    dataSource: "/api/violations + /api/workers",
    computation: "Join Violations.Worker_ID → Workers.Contractor, count per contractor",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager"],
    implemented: false,
  },
  {
    id: "workers_per_contractor",
    label: "Workers per Contractor",
    category: "Contractors",
    pages: ["Analytics"],
    dataSource: "/api/contractors",
    computation: "Contractors.Total_Workers per contractor",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Supervisor"],
    implemented: false,
  },

  // ── DEVICES & INFRASTRUCTURE ───────────────────────────────────────────────
  {
    id: "camera_online_rate",
    label: "Camera Online Rate",
    category: "Devices & Infrastructure",
    pages: ["Cameras & Devices"],
    dataSource: "/api/cameras",
    computation: "count(Cameras.Status = 'Active') / total cameras × 100",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager"],
    implemented: false,
  },
  {
    id: "edge_device_cpu_usage",
    label: "Edge Device CPU Usage",
    category: "Devices & Infrastructure",
    pages: ["Cameras & Devices"],
    dataSource: "/api/edge-devices",
    computation: "mean(EdgeDevices.CPU_Usage) across Online devices",
    allowedRoles: ["Admin", "HSE Manager"],
    implemented: false,
  },
  {
    id: "edge_device_gpu_usage",
    label: "Edge Device GPU Usage",
    category: "Devices & Infrastructure",
    pages: ["Cameras & Devices"],
    dataSource: "/api/edge-devices",
    computation: "mean(EdgeDevices.GPU_Usage) across Online devices",
    allowedRoles: ["Admin", "HSE Manager"],
    implemented: false,
  },
  {
    id: "edge_device_memory_usage",
    label: "Edge Device Memory Usage",
    category: "Devices & Infrastructure",
    pages: ["Cameras & Devices"],
    dataSource: "/api/edge-devices",
    computation: "mean(EdgeDevices.Memory_Usage) across Online devices",
    allowedRoles: ["Admin", "HSE Manager"],
    implemented: false,
  },
  {
    id: "rfid_reader_uptime",
    label: "RFID Reader Uptime",
    category: "Devices & Infrastructure",
    pages: ["Cameras & Devices"],
    dataSource: "/api/rfid-readers",
    computation: "count(RFIDReaders.Status = 'Active') / total RFID readers × 100",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager"],
    implemented: false,
  },

  // ── COMPLIANCE ─────────────────────────────────────────────────────────────
  {
    id: "per_standard_compliance_rate",
    label: "Per-Standard Compliance Rate",
    category: "Compliance",
    pages: ["Compliance"],
    dataSource: "/api/compliance-standards",
    computation: "ComplianceStandards.Compliance_Rate per standard",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Auditor"],
    implemented: false,
  },
  {
    id: "days_until_next_audit",
    label: "Days Until Next Audit",
    category: "Compliance",
    pages: ["Compliance"],
    dataSource: "/api/compliance-standards",
    computation: "min(ComplianceStandards.Next_Audit_Date) - today",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Auditor"],
    implemented: false,
  },
  {
    id: "standards_needing_review",
    label: "Standards Needing Review",
    category: "Compliance",
    pages: ["Compliance"],
    dataSource: "/api/compliance-standards",
    computation: "count(ComplianceStandards.Status = 'Needs Review')",
    allowedRoles: ["Admin", "HSE Manager", "Safety Manager", "Auditor"],
    implemented: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROLE → KPI ACCESS MAP  (derived from registry, kept here as quick lookup)
// ─────────────────────────────────────────────────────────────────────────────

export const ROLE_KPI_MAP: Record<UserRole, string[]> = {
  Admin: KPI_REGISTRY.map((k) => k.id),
  "HSE Manager": KPI_REGISTRY.filter((k) => k.allowedRoles.includes("HSE Manager")).map((k) => k.id),
  "Safety Manager": KPI_REGISTRY.filter((k) => k.allowedRoles.includes("Safety Manager")).map((k) => k.id),
  Supervisor: KPI_REGISTRY.filter((k) => k.allowedRoles.includes("Supervisor")).map((k) => k.id),
  Auditor: KPI_REGISTRY.filter((k) => k.allowedRoles.includes("Auditor")).map((k) => k.id),
  "Site Inspector": KPI_REGISTRY.filter((k) => k.allowedRoles.includes("Supervisor")).map((k) => k.id),
  "Site Engineer": KPI_REGISTRY.filter((k) => k.allowedRoles.includes("Safety Manager")).map((k) => k.id),
  "Worker": KPI_REGISTRY.filter((k) => k.allowedRoles.includes("Auditor")).map((k) => k.id),
  "Contractor": KPI_REGISTRY.filter((k) => k.allowedRoles.includes("Auditor")).map((k) => k.id),
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — get KPI objects accessible to a given role
// ─────────────────────────────────────────────────────────────────────────────

export function getKPIsForRole(role: UserRole): KPI[] {
  return KPI_REGISTRY.filter((k) => k.allowedRoles.includes(role));
}

export function getKPIById(id: string): KPI | undefined {
  return KPI_REGISTRY.find((k) => k.id === id);
}

export function hasKPIAccess(role: UserRole, kpiId: string): boolean {
  return ROLE_KPI_MAP[role]?.includes(kpiId) ?? false;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH CONTEXT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  isSuperAdmin?: boolean;
  orgCode?: string;
  companyName?: string;
  allowedModules?: UiModuleLabel[];
  onboardingScoped?: boolean;
  onboardingSetupRequired?: boolean;
  onboardingSetupCompleted?: boolean;
  onboardingMaxUsers?: number;
  onboardingConfiguredUsers?: number;
}

export type SubscriptionPlan = "Free" | "Pro" | "Enterprise";

function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "free" || raw.includes("free")) return "Free";
  if (raw === "pro" || raw.includes("pro")) return "Pro";
  if (raw === "enterprise" || raw.includes("enterprise")) return "Enterprise";
  return null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  /** All KPI objects the current user is allowed to view */
  accessibleKPIs: KPI[];
  /** Check at runtime whether this user can see a specific KPI by id */
  canViewKPI: (kpiId: string) => boolean;
  canAccessModuleLabel: (label: UiModuleLabel) => boolean;
  isOnboardingScopedUser: boolean;
  login: (email: string, password: string, orgCode?: string) => Promise<LoginResult>;
  /** Not supported in backend-auth mode — kept for interface compatibility */
  signup: (email: string, password: string) => Promise<LoginResult>;
  /** Not supported in backend-auth mode — kept for interface compatibility */
  loginWithGoogle: () => Promise<LoginResult>;
  logout: () => void;
  markOnboardingSetupCompleted: () => void;
  subscriptionPlan: SubscriptionPlan;
  setSubscriptionPlan: (plan: SubscriptionPlan) => void;
}

const defaultAuthContextValue: AuthContextType = {
  isAuthenticated: false,
  user: null,
  accessibleKPIs: [],
  canViewKPI: () => false,
  canAccessModuleLabel: () => false,
  isOnboardingScopedUser: false,
  login: async () => "error",
  signup: async () => "error",
  loginWithGoogle: async () => "error",
  logout: () => {},
  markOnboardingSetupCompleted: () => {},
  subscriptionPlan: "Free",
  setSubscriptionPlan: () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContextValue);

// ─────────────────────────────────────────────────────────────────────────────
// AUTH PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // Validate stored session: require both the auth flag AND a JWT token
    return (
      localStorage.getItem("hse_auth") === "true" &&
      Boolean(localStorage.getItem("hse_jwt_token"))
    );
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem("hse_user");
      const storedUser = stored ? JSON.parse(stored) : null;
      // Sync name/initials from the JWT payload in case the token was refreshed
      const token = localStorage.getItem("hse_jwt_token");
      if (storedUser && token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (payload.full_name) {
            storedUser.name = payload.full_name;
            storedUser.initials = payload.full_name
              .split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
          }
          // If the JWT already has org_id, the user completed org setup.
          // Clear any stale wizard flags so they don't get redirected on refresh.
          if (payload.org_id && storedUser.onboardingSetupRequired) {
            storedUser.onboardingSetupRequired = false;
            storedUser.onboardingSetupCompleted = true;
          }
        } catch { /* malformed token — ignore */ }
      }
      return storedUser;
    } catch { return null; }
  });

  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>(() => {
    return normalizeSubscriptionPlan(localStorage.getItem("hse_subscription")) ?? "Free";
  });

  // Persist auth state changes to localStorage
  useEffect(() => {
    localStorage.setItem("hse_auth", String(isAuthenticated));
    if (user) {
      localStorage.setItem("hse_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("hse_user");
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    localStorage.setItem("hse_subscription", subscriptionPlan);
  }, [subscriptionPlan]);

  const currentUserAllowedModules = useMemo<UiModuleLabel[]>(() => {
    if (!user) return [];
    if (user.allowedModules && user.allowedModules.length > 0) return user.allowedModules;
    return ALL_MODULE_LABELS;
  }, [user]);

  const accessibleKPIs = useMemo<KPI[]>(() => {
    if (!user) return [];
    return getKPIsForRole(user.role);
  }, [user]);

  const canViewKPI = (kpiId: string): boolean => {
    if (!user) return false;
    return hasKPIAccess(user.role, kpiId);
  };

  const canAccessModuleLabel = (label: UiModuleLabel): boolean => {
    if (!user) return false;
    if (label === "AI Agent") {
      if (!user.onboardingScoped) return true;
      return currentUserAllowedModules.includes("AI Agent") || subscriptionPlan !== "Free";
    }
    return currentUserAllowedModules.includes(label);
  };

  const isOnboardingScopedUser = Boolean(user?.onboardingScoped);

  // ── Role mapping ────────────────────────────────────────────────────────────

  function mapBackendRole(backendRole: string): UserRole {
    switch (backendRole.toLowerCase()) {
      case "superadmin":
      case "admin":        return "Admin";
      case "hse_manager":
      case "safety_manager": return "HSE Manager";
      case "supervisor":   return "Supervisor";
      case "operator":     return "Worker";
      case "auditor":      return "Auditor";
      case "viewer":       return "Auditor";
      default:             return "Auditor";
    }
  }

  // ── Login ───────────────────────────────────────────────────────────────────

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // Dev test accounts (only active when VITE_ENABLE_DEV_TEST_ACCOUNTS=true in .env)
    if (ENABLE_DEV_TEST_ACCOUNTS) {
      const devAccounts: Array<{ email: string; password: string; name: string; role: UserRole; initials: string }> = [
        { email: ADMIN_EMAIL,      password: ADMIN_PASSWORD,      name: "HSE Admin",        role: "Admin",          initials: "AD" },
        { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD, name: "Super Admin",     role: "Admin",          initials: "SA" },
        { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD_ALT, name: "Super Admin", role: "Admin",          initials: "SA" },
        { email: INSPECTOR_EMAIL,  password: INSPECTOR_PASSWORD,  name: "Site Inspector",   role: "Site Inspector",  initials: "SI" },
        { email: ENGINEER_EMAIL,   password: ENGINEER_PASSWORD,   name: "Site Engineer",    role: "Site Engineer",   initials: "SE" },
        { email: WORKER_EMAIL,     password: WORKER_PASSWORD,     name: "Worker",           role: "Worker",          initials: "WK" },
      ];
      const match = devAccounts.find(
        (a) => a.email && a.email === trimmedEmail && a.password && a.password === trimmedPassword,
      );
      if (match) {
        const userData: AuthUser = {
          name: match.name, email: match.email, role: match.role,
          initials: match.initials, allowedModules: ALL_MODULE_LABELS,
        };
        setUser(userData);
        setIsAuthenticated(true);
        return "success";
      }
    }

    // Product-admin dev bypass
    if (ENABLE_DEV_PRODUCT_ADMIN_FALLBACK && PRODUCT_ADMIN_EMAILS.has(trimmedEmail) && trimmedPassword.length > 0) {
      const userData: AuthUser = {
        name: "Product Admin", email: trimmedEmail,
        role: "Admin", initials: "PA", allowedModules: ALL_MODULE_LABELS,
      };
      setUser(userData);
      setIsAuthenticated(true);
      return "success";
    }

    // HSE Backend JWT login
    try {
      const data = await loginWithHSEBackend(trimmedEmail, trimmedPassword);

      if (!data?.access_token) return "error";

      const backendRole = (data.user.role ?? "").toLowerCase();

      // Web is admin-only, with one exception: the Auditor's own narrow
      // "My Audits" view under /auditor (see AuditorLayout). HSE Manager,
      // Supervisor and Worker accounts are still mobile-only.
      const isAuditor = backendRole === "auditor";
      if (backendRole !== "admin" && backendRole !== "superadmin" && !isAuditor) {
        return "mobile_only";
      }

      localStorage.setItem("hse_jwt_token", data.access_token);

      const mappedRole = mapBackendRole(backendRole);
      const displayName = (data.user as { full_name?: string }).full_name || data.user.username;

      const userData: AuthUser = {
        name: displayName,
        email: data.user.email,
        role: mappedRole,
        initials: displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
        // The Auditor's whole web experience is the separate /auditor layout,
        // which does not consult this list — it stays empty rather than
        // ALL_MODULE_LABELS so nothing under AppLayout treats them as scoped-in
        // if a future change ever lets them reach it.
        allowedModules: isAuditor ? [] : ALL_MODULE_LABELS,
        isSuperAdmin: backendRole === "superadmin",
      };

      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem("hse_auth", "true");
      localStorage.setItem("hse_user", JSON.stringify(userData));

      // Check if this email has a pending org invite that needs setup
      try {
        const setupCheck = await checkOrgSetupRequired(trimmedEmail);
        if (setupCheck.needs_setup) {
          const enriched: AuthUser = { ...userData, onboardingSetupRequired: true, onboardingSetupCompleted: false };
          setUser(enriched);
          localStorage.setItem("hse_user", JSON.stringify(enriched));
          return "org_setup_required";
        }
      } catch {
        // Non-fatal — let user proceed to dashboard
      }

      return "success";
    } catch (err) {
      const msg = (err as Error)?.message ?? "";

      if (msg.includes("401")) {
        // Backend is reachable; credentials rejected or account inactive
        if (msg.toLowerCase().includes("inactive")) return "access_denied";
        return "invalid_credentials";
      }

      // Backend unreachable (connection refused, timeout, network error)
      return "network_error";
    }
  };

  // ── Logout ──────────────────────────────────────────────────────────────────

  const logout = () => {
    localStorage.removeItem("hse_jwt_token");
    localStorage.removeItem("hse_auth");
    localStorage.removeItem("hse_user");
    sessionStorage.removeItem("org_setup_wizard_session_reset");
    setIsAuthenticated(false);
    setUser(null);
  };

  // ── Stubs kept for interface compatibility ───────────────────────────────────

  const loginWithGoogle = async (): Promise<LoginResult> => "error";

  const signup = async (): Promise<LoginResult> => "error";

  // ── Onboarding setup helper ──────────────────────────────────────────────────

  const markOnboardingSetupCompleted = useCallback(() => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated: AuthUser = { ...prev, onboardingSetupRequired: false, onboardingSetupCompleted: true };
      localStorage.setItem("hse_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated, user, accessibleKPIs, canViewKPI, canAccessModuleLabel,
        isOnboardingScopedUser, login, signup, loginWithGoogle, logout,
        markOnboardingSetupCompleted, subscriptionPlan, setSubscriptionPlan,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
