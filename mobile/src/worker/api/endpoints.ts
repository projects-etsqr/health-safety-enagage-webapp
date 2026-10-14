export const ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/employee/refresh',
    PROFILE: '/auth/me',
    DELETE_ACCOUNT: '/auth/me',
    CHANGE_PASSWORD: '/auth/change-password',
    /** Full employee record for the signed-in user (role, department, manager, dates). */
    MY_EMPLOYEE_PROFILE: '/employees/me',
    /** Profile photo, stored as a base64 data URI. */
    MY_EMPLOYEE_PHOTO: '/employees/me/photo',
  },

  // Tasks
  TASKS: {
    LIST: '/worker/tasks',
    DETAIL: (id: string) => `/worker/tasks/${id}`,
    COMPLETE_STEP: (id: string) => `/worker/tasks/${id}/complete-step`,
    SHIFT_SUMMARY: '/worker/tasks/shift-summary',
  },

  // Permits
  PERMITS: {
    LIST: '/worker/permits',
    CREATE: '/worker/permits',
    DETAIL: (id: string) => `/worker/permits/${id}`,
    ACKNOWLEDGE: (id: string) => `/worker/permits/${id}/acknowledge`,
    // The holder's own two steps, on the permit workflow rather than the
    // `/worker/*` shim: starting work under an issued permit and finishing it.
    // The flow gives both to the worker, and until now neither had a button —
    // they were reachable only from the supervisor's screen, so a worker held a
    // permit they could not start and could not hand back. The endpoints allow
    // the permit holder through by name, which is what this app is.
    START_WORK: (id: string | number) => `/permit-workflow/${id}/activate`,
    COMPLETE_WORK: (id: string | number) => `/permit-workflow/${id}/complete-work`,
  },

  // Incidents
  INCIDENTS: {
    LIST: '/worker/incidents',
    REPORT: '/worker/incidents',
    DETAIL: (id: string) => `/worker/incidents/${id}`,
    MY_REPORTS: '/incident-workflow/my-reports',
  },

  // Near miss / unsafe act / risk each have their own table and their own
  // Worker→Supervisor→Manager workflow. The old /worker/incidents/near-miss and
  // /worker/incidents/unsafe-act paths never existed on the backend and 404'd.
  NEAR_MISS: {
    REPORT: '/near-miss-workflow/report',
    MY_REPORTS: '/near-miss-workflow/my-reports',
    DETAIL: (id: string | number) => `/near-miss-workflow/${id}`,
  },

  UNSAFE_ACT: {
    REPORT: '/unsafe-act-workflow/report',
    MY_REPORTS: '/unsafe-act-workflow/my-reports',
    DETAIL: (id: string | number) => `/unsafe-act-workflow/${id}`,
  },

  RISK: {
    REPORT: '/risk-workflow/report',
    MY_REPORTS: '/risk-workflow/my-reports',
    DETAIL: (id: string | number) => `/risk-workflow/${id}`,
  },

  // WF-04 corrective actions. A worker can own one — the lifecycle document's
  // owner row is "whoever is assigned: worker, supervisor or manager" — but
  // until now there was no worker screen behind the dashboard's "Open CAPAs"
  // count, so an assigned action was unreachable on this app.
  CAPA: {
    MY_ACTIONS: '/capa/my-actions',
    DETAIL: (id: string | number) => `/capa/${id}`,
    START: (id: string | number) => `/capa/${id}/start`,
    PROGRESS: (id: string | number) => `/capa/${id}/progress`,
    EVIDENCE: (id: string | number) => `/capa/${id}/evidence`,
    EVIDENCE_UPLOAD: (id: string | number) => `/capa/${id}/evidence/upload`,
    SUBMIT: (id: string | number) => `/capa/${id}/submit`,
    CLOSURE_CHECKS: (id: string | number) => `/capa/${id}/closure-checks`,
  },

  // Hazard catalog (reference data), NOT worker risk reports — those go to RISK above.
  HAZARDS: {
    CATEGORIES: '/hazard-categorys',
    LIST: '/hazards/',
  },

  /**
   * The standing hazard register (flow 5) — the `hazards` table, carried
   * through the same eight stages as an incident.
   *
   * A third distinct thing from the two above, and the distinction matters:
   * HAZARDS is the read-only catalog, RISK is a worker's one-off risk
   * observation on `risk_reports`, and this is the register entry that gets
   * assessed, contained, controlled, verified and closed. A worker logs to it
   * and can then follow it through all eight stages.
   */
  HAZARD_REGISTER: {
    LOG: '/hazard-register/log',
    CATEGORIES: '/hazard-register/categories',
    MY_LOGS: '/hazard-register/my-logs',
    DETAIL: (id: string | number) => `/hazard-register/${id}`,
    NEXT_ACTION: (id: string | number) => `/hazard-register/${id}/next-action`,
  },

  // Reference data used to resolve foreign keys on report forms.
  LOOKUPS: {
    WORKING_STATIONS: '/working-stations/',
    EMPLOYEES: '/employees/',
  },

  // Shift check-in — writes the man-hours that every rate KPI divides by.
  SHIFTS: {
    MY_SHIFTS: '/worker/shift/my-shifts',
    CHECK_IN: '/worker/shift/check-in',
  },

  // Checklists
  CHECKLISTS: {
    LIST: '/worker/checklists',
    DETAIL: (id: string) => `/worker/checklists/${id}`,
    SUBMIT: (id: string) => `/worker/checklists/${id}/submit`,
    // Real submission records (the /checklists API the checklist screen writes to),
    // as opposed to the /worker/checklists stubs above.
    SUBMISSIONS: '/checklists/submissions',
  },

  // Training — admin-curated videos targeted at the caller's own role.
  TRAINING: {
    LIST: '/training-videos/mine',
    COMMENTS: (id: number) => `/training-videos/${id}/comments`,
  },

  // Notifications
  NOTIFICATIONS: {
    LIST: '/worker/notifications',
    MARK_READ: (id: string) => `/worker/notifications/${id}/read`,
    MARK_ALL_READ: '/worker/notifications/read-all',
  },
} as const;
