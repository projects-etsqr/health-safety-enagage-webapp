/**
 * The mobile app has exactly four UI roles, but the backend uses richer role
 * names (e.g. an HSE Manager is stored as `safety_manager`, a worker as
 * `operator`). Routing is driven by these four canonical roles, so every backend
 * role must be normalised to one of them — otherwise, e.g., a `safety_manager`
 * session falls through to the worker stack instead of the manager app.
 */
export type AppRole = 'manager' | 'supervisor' | 'worker' | 'auditor';

export function normalizeRole(role?: string | null): AppRole | null {
  if (!role) return null;
  const r = role.toLowerCase().trim().replace(/[\s-]+/g, '_');
  switch (r) {
    case 'manager':
    case 'safety_manager':
    case 'hse_manager':
    case 'admin':
    case 'superadmin':
    case 'director':
      return 'manager';
    case 'supervisor':
      return 'supervisor';
    case 'operator':
    case 'worker':
      return 'worker';
    case 'auditor':
      return 'auditor';
    default:
      return null;
  }
}
