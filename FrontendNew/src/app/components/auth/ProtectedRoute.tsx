import { Navigate } from "react-router";
import { useLocation } from "react-router";
import { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import type { ReactNode } from "react";
import type { UiModuleLabel } from "../../context/AuthContext";

/** Organisation id from the login JWT. `undefined` means there is no token to read. */
function readJwtOrgId(): number | null | undefined {
  const token = localStorage.getItem("hse_jwt_token");
  if (!token) return undefined;
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as { org_id?: number | null };
    if (payload.org_id == null) return null;
    const orgId = Number(payload.org_id);
    return Number.isFinite(orgId) ? orgId : null;
  } catch {
    return undefined;
  }
}

export function ProtectedRoute({
  children,
  requiredModule,
  hideForOnboardingScoped,
}: {
  children: ReactNode;
  requiredModule?: UiModuleLabel;
  hideForOnboardingScoped?: boolean;
}) {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  // Web is admin-only (see AuthContext.login) — but a session created before that
  // gate existed, or restored from stale localStorage, can still carry a non-admin
  // role. Sign those out rather than leaving the full dashboard reachable.
  const isWebAllowedRole = Boolean(user?.isSuperAdmin) || user?.role === "Admin";
  useEffect(() => {
    if (isAuthenticated && !isWebAllowedRole) {
      logout();
    }
  }, [isAuthenticated, isWebAllowedRole, logout]);

  if (!isAuthenticated || !isWebAllowedRole) {
    return <Navigate to="/auth/login" replace />;
  }

  // Keep these props accepted for compatibility, but do not fallback to base URL.
  void requiredModule;
  void hideForOnboardingScoped;

  const setupRequired = Boolean(user?.onboardingSetupRequired && !user?.onboardingSetupCompleted);
  // Login writes organisation_id into the JWT. Null means wizard step 1 never
  // linked this admin, and Data Management would otherwise POST organisation_id=-1.
  // Superadmin is platform-scoped and is left on /superadmin.
  const orgId = readJwtOrgId();
  // Step 8 sets onboardingSetupCompleted before leaving the wizard. The JWT
  // still carries a null org_id until the next login, but the API reads the
  // organisation from the user row, which step 1 has already filled in.
  const adminMissingOrg = user?.role === "Admin" && !user?.isSuperAdmin && !user?.onboardingSetupCompleted && orgId !== undefined && (orgId == null || orgId < 1);
  if ((setupRequired || adminMissingOrg) && location.pathname !== "/org-setup-wizard") {
    return <Navigate to="/org-setup-wizard" replace />;
  }

  return <>{children}</>;
}
