import { createBrowserRouter, Navigate, useRouteError } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { SuperAdminLayout } from "./components/layout/SuperAdminLayout";
import { AuditorLayout } from "./components/layout/AuditorLayout";
import { AuditorMyAuditsPage } from "./pages/AuditorMyAuditsPage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ViolationsPage } from "./pages/ViolationsPage";
import { ViolationDetailPage } from "./pages/ViolationDetailPage";
import { IncidentTrackingPage } from "./pages/IncidentTrackingPage";
// Flow 5 · the hazard register, on the same eight stages as an incident
import { HazardRegisterPage } from "./pages/HazardRegisterPage";
import { HazardTrackingPage } from "./pages/HazardTrackingPage";
import { NearMissTrackingPage } from "./pages/NearMissTrackingPage";
import { RegisterIncidentPage } from "./pages/RegisterIncidentPage";
import { PermitTrackingPage } from "./pages/PermitTrackingPage";
import { RiskTrackingPage } from "./pages/RiskTrackingPage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { UsersPage } from "./pages/UsersPage";
import { ActionsPage } from "./pages/ActionsPage";
import { CapaActionsPage } from "./pages/CapaActionsPage";
import { CapaDetailPage } from "./pages/CapaDetailPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AIAgentPage } from "./pages/AIAgentPage";
import { CompliancePage } from "./pages/CompliancePage";
// WF-05 · the web console's half of the audit workflow
import { AuditProgrammePage } from "./pages/AuditProgrammePage";
import { AuditRegisterPage } from "./pages/AuditRegisterPage";
import { AuditDetailPage } from "./pages/AuditDetailPage";
import { AuditTrendsPage } from "./pages/AuditTrendsPage";
import { AuditTemplatesPage } from "./pages/AuditTemplatesPage";
import { ChecklistPage } from "./pages/ChecklistPage";
import { BillingPage } from "./pages/BillingPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { SubscriptionPage } from "./pages/SubscriptionPage";
import { NearMissPage } from "./pages/NearMissPage";
import { SafetyWalkPage } from "./pages/SafetyWalkPage";
import { RiskPage } from "./pages/RiskPage";
import { RootCauseAnalysisPage } from "./pages/RootCauseAnalysisPage";
import { AssetsPage } from "./pages/AssetsPage";
import { EquipmentCertificationPage } from "./pages/EquipmentCertificationPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { SuperAdminDashboardPage } from "./pages/SuperAdminDashboardPage";
import { OrgSetupPage } from "./pages/OrgSetupPage";
import { OrgSetupWizardPage } from "./pages/OrgSetupWizardPage";
import { DataManagementPage } from "./pages/DataManagementPage";
import { VendorsPage } from "./pages/VendorsPage";
import { TrainingPage } from "./pages/TrainingPage";
import { SuperAdminInvitationsPage } from "./pages/SuperAdminInvitationsPage";
import { SuperAdminTenantsPage } from "./pages/SuperAdminTenantsPage";
import { SuperAdminUsersPage } from "./pages/SuperAdminUsersPage";
import { SuperAdminRolesPage } from "./pages/SuperAdminRolesPage";
// Restores a reference the "sites-zones" route below still makes. Commit
// 3d17a20 dropped this import but left the route, which broke the build.
import { SitesZonesPage } from "./pages/SitesZonesPage";
import type { ComponentType } from "react";

function RouteErrorFallback() {
  const error = useRouteError() as { message?: string; statusText?: string } | undefined;
  const detail = error?.message || error?.statusText || "Unexpected route error";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#F3F7FF",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          background: "#fff",
          border: "1px solid #D6E4FF",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ margin: "0 0 8px", color: "#0A0A0A" }}>Page failed to load</h2>
        <p style={{ margin: "0 0 12px", color: "#374151" }}>An unexpected app error occurred.</p>
        <p style={{ margin: "0 0 16px", color: "#6B7280", fontSize: 13 }}>Details: {detail}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            background: "linear-gradient(135deg, #0B3D91, #1D4ED8)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}

const DashboardRoute = DashboardPage;
const ViolationsRoute = ViolationsPage;
const ViolationDetailRoute = ViolationDetailPage;
const ActionsRoute = ActionsPage;
const ChecklistsRoute = ChecklistPage;
const ComplianceRoute = CompliancePage;
const SitesZonesRoute = SitesZonesPage;
const AIAgentRoute = AIAgentPage;
const AnalyticsRoute = AnalyticsPage;
const NearMissRoute = NearMissPage;
const RootCauseAnalysisRoute = RiskPage;
const EquipmentCertificationRoute = EquipmentCertificationPage;

function hiddenForOnboarding<T extends object>(Component: ComponentType<T>) {
  return function HiddenForOnboardingScopedRoute(props: T) {
    return (
      <ProtectedRoute hideForOnboardingScoped>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

const PoliciesRoute = hiddenForOnboarding(PoliciesPage);
const UsersRoute = UsersPage;
const BillingRoute = hiddenForOnboarding(BillingPage);
const NotificationsRoute = NotificationsPage;
const EngagementRoute = NotificationsPage;
const SettingsRoute = hiddenForOnboarding(SettingsPage);
const SubscriptionRoute = hiddenForOnboarding(SubscriptionPage);

export const router = createBrowserRouter([
  {
    path: "/auth/login",
    Component: LoginPage,
    errorElement: <RouteErrorFallback />,
  },
  {
    path: "/auth/signup",
    Component: () => <Navigate to="/auth/login?mode=signup" replace />,
  },
  {
    path: "/org-setup",
    Component: OrgSetupPage,
  },
  {
    path: "/auth/onboarding",
    Component: OnboardingPage,
  },
  {
    path: "/auth/onboarding/form",
    Component: OnboardingPage,
  },
  {
    path: "/auth/onboarding/admin",
    Component: OnboardingPage,
  },
  {
    path: "/auth/onboarding/tracker",
    Component: OnboardingPage,
  },
  {
    path: "/login",
    Component: () => <Navigate to="/auth/login" replace />,
  },
  {
    path: "/onboarding",
    Component: () => <Navigate to="/auth/onboarding" replace />,
  },
  {
    path: "/onboarding/form",
    Component: () => <Navigate to="/auth/onboarding/form" replace />,
  },
  {
    path: "/onboarding/admin",
    Component: () => <Navigate to="/auth/onboarding/admin" replace />,
  },
  {
    path: "/onboarding/tracker",
    Component: () => <Navigate to="/auth/onboarding/tracker" replace />,
  },
  {
    path: "/",
    Component: ProtectedLayout,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, Component: DashboardRoute },
      { path: "violations", Component: ViolationsRoute },
      // Own top-level path rather than `violations/tracking`, which would sit
      // alongside `violations/:id` and read as an incident with id "tracking".
      { path: "incidents/tracking", Component: IncidentTrackingPage },
      // Legacy paths. The hazard register is the Unsafe Act family now, served
      // from /unsafe-acts below; these stay so old links and bookmarks resolve.
      { path: "hazards", Component: HazardRegisterPage },
      { path: "hazards/tracking", Component: HazardTrackingPage },
      // Literal path before violations/:id, same reason as audits/programme below.
      { path: "violations/register", Component: RegisterIncidentPage },
      { path: "violations/:id", Component: ViolationDetailRoute },
      { path: "actions", Component: ActionsRoute },
      { path: "capa-actions", Component: CapaActionsPage },
      { path: "capa-actions/:id", Component: CapaDetailPage },
      { path: "checklists", Component: ChecklistsRoute },
      { path: "compliance", Component: ComplianceRoute },
      // Literal paths before the :id one — "programme" must not be read as an id.
      { path: "audits", Component: AuditRegisterPage },
      { path: "audits/programme", Component: AuditProgrammePage },
      { path: "audits/trends", Component: AuditTrendsPage },
      { path: "audits/templates", Component: AuditTemplatesPage },
      { path: "audits/:id", Component: AuditDetailPage },
      { path: "safety-walks", Component: SafetyWalkPage },
      { path: "sites-zones", Component: SitesZonesPage },
      { path: "policies", Component: PoliciesRoute },
      { path: "users", Component: UsersRoute },
      { path: "analytics", Component: AnalyticsRoute },
      { path: "ai-agent", Component: AIAgentRoute },
      { path: "billing", Component: BillingRoute },
      { path: "notifications", Component: NotificationsRoute },
      { path: "engagement", Component: EngagementRoute },
      { path: "settings", Component: SettingsRoute },
      { path: "subscription", Component: SubscriptionRoute },
      { path: "near-miss", Component: NearMissRoute },
      { path: "near-miss/tracking", Component: NearMissTrackingPage },
      // The single Unsafe Act family: the register flow that used to be called
      // "Hazards". It kept its implementation (the eight-stage working
      // register with its stage forms) and took the Unsafe Act name.
      { path: "unsafe-acts", Component: HazardRegisterPage },
      { path: "unsafe-acts/tracking", Component: HazardTrackingPage },
      { path: "permits/tracking", Component: PermitTrackingPage },
      { path: "root-cause-analysis", Component: RootCauseAnalysisRoute },
      // The Risk section's second tab. Its own top-level path rather than
      // `root-cause-analysis/tracking`, matching how incidents keep their
      // tracker off `violations/:id`.
      { path: "risk/tracking", Component: RiskTrackingPage },
      { path: "equipment-certification", Component: EquipmentCertificationRoute },
      { path: "org-setup-wizard", Component: OrgSetupWizardPage },
      { path: "data-management", Component: DataManagementPage },
      { path: "vendors", Component: VendorsPage },
      { path: "training", Component: TrainingPage },
    ],
  },
  {
    path: "/auditor",
    Component: AuditorLayout,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, Component: AuditorMyAuditsPage },
      { path: "audits/:id", Component: AuditDetailPage },
    ],
  },
  {
    path: "/superadmin",
    Component: SuperAdminLayout,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, Component: SuperAdminDashboardPage },
      { path: "invitations", Component: SuperAdminInvitationsPage },
      { path: "tenants", Component: SuperAdminTenantsPage },
      { path: "users", Component: SuperAdminUsersPage },
      { path: "roles", Component: SuperAdminRolesPage },
    ],
  },
  {
    path: "*",
    Component: () => <Navigate to="/auth/login" replace />,
    errorElement: <RouteErrorFallback />,
  },
]);
