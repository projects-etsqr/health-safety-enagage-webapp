export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    PROFILE: '/auth/me',
    DELETE_ACCOUNT: '/auth/me',
    CHANGE_PASSWORD: '/auth/change-password',
  },
  PERMITS: {
    LIST: '/supervisor/permits',
    DETAIL: (id: string) => `/supervisor/permits/${id}`,
    APPROVE: (id: string) => `/supervisor/permits/${id}/approve`,
    REJECT: (id: string) => `/supervisor/permits/${id}/reject`,
    ACKNOWLEDGE: (id: string) => `/supervisor/permits/${id}/acknowledge`,
  },
  TEAM: {
    MEMBERS: '/supervisor/team/members',
    SHIFT_STATUS: '/supervisor/team/shift-status',
    TOOLBOX_TALK: '/supervisor/team/toolbox-talk',
    SUBMIT_TOOLBOX: '/supervisor/team/toolbox-talk/submit',
    ATTENDANCE: '/supervisor/team/attendance',
    FORCE_IN: (id: string) => `/supervisor/team/members/${id}/force-in`,
    LOG_HOURS: '/supervisor/team/log-hours',
  },
  COMPLIANCE: {
    METRICS: '/supervisor/compliance/metrics',
    EXCEPTIONS: '/supervisor/compliance/exceptions',
    GEAR_CHECK: '/supervisor/compliance/gear-check',
    EXPIRING_PERMITS: '/supervisor/compliance/expiring-permits',
    REMIND: (id: string) => `/supervisor/compliance/exceptions/${id}/remind`,
  },
  REPORTS: {
    LIST: '/supervisor/reports',
    SAFETY_WALKS: '/supervisor/reports/safety-walks',
    INCIDENTS: '/supervisor/reports/incidents',
  },
  DASHBOARD: {
    STATS:  '/supervisor/dashboard',
    ALERTS: '/supervisor/alerts',
  },
  // The eight-stage lifecycle. Every verb here now has a twin on the other
  // three report families — see `reportWorkflowEndpoints` below, which the
  // factory router builds from one definition, so a near miss runs exactly the
  // stages an incident does.
  INCIDENT_WORKFLOW: {
    ACKNOWLEDGE: (id: string) => `/incident-workflow/${id}/acknowledge`,
    START_INVESTIGATION: (id: string) => `/incident-workflow/${id}/start-investigation`,
    INVESTIGATE: (id: string) => `/incident-workflow/${id}/investigate`,
    ESCALATE: (id: string) => `/incident-workflow/${id}/escalate`,
    MANAGER_QUEUE: '/incident-workflow/manager-queue',
    APPROVE: (id: string) => `/incident-workflow/${id}/approve-investigation`,
    VERIFY_EFFECTIVENESS: (id: string) => `/incident-workflow/${id}/verify-effectiveness`,
    CLOSE: (id: string) => `/incident-workflow/${id}/close`,
    DETAIL: (id: string) => `/incident-workflow/${id}`,
    CAPA_MY_ACTIONS: '/incident-workflow/capa/my-actions',
    CAPA_COMPLETE: (id: string | number) => `/incident-workflow/capa/${id}/complete`,
    // Supervisors, not workers — a corrective action is a control change and
    // the accountable owner is the supervisor for that area.
    CAPA_ASSIGNABLE_OWNERS: '/incident-workflow/capa/assignable-owners',
    // "What do I do next" — the queue for the dashboard, and the stage tracker
    // plus outstanding step for one incident. Both read the same backend
    // resolver, so the list and the detail screen cannot disagree.
    NEXT_ACTIONS: '/incident-workflow/next-actions',
    NEXT_ACTION: (id: string | number) => `/incident-workflow/${id}/next-action`,
  },
} as const;

/**
 * The four worker-submitted report types, each with its own table and its own
 * routes on the backend. Every type exposes the identical Worker→Supervisor→Manager
 * verbs, so the supervisor and manager screens can drive any of them through one
 * shape instead of four hand-written services.
 */
export const REPORT_TYPES = ['incident', 'near_miss', 'unsafe_act', 'risk'] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

const REPORT_WORKFLOW_PREFIX: Record<ReportType, string> = {
  incident: '/incident-workflow',
  near_miss: '/near-miss-workflow',
  unsafe_act: '/unsafe-act-workflow',
  risk: '/risk-workflow',
};

/** Build the workflow endpoint set for one report type. */
export const reportWorkflowEndpoints = (type: ReportType) => {
  const base = REPORT_WORKFLOW_PREFIX[type];
  return {
    // Worker
    REPORT: `${base}/report`,
    MY_REPORTS: `${base}/my-reports`,
    // Supervisor
    PENDING_REVIEW: `${base}/pending-review`,
    ACKNOWLEDGE: (id: string | number) => `${base}/${id}/acknowledge`,
    START_INVESTIGATION: (id: string | number) => `${base}/${id}/start-investigation`,
    INVESTIGATE: (id: string | number) => `${base}/${id}/investigate`,
    ESCALATE: (id: string | number) => `${base}/${id}/escalate`,
    // Manager
    MANAGER_QUEUE: `${base}/manager-queue`,
    APPROVE: (id: string | number) => `${base}/${id}/approve-investigation`,
    VERIFY_EFFECTIVENESS: (id: string | number) => `${base}/${id}/verify-effectiveness`,
    CLOSE: (id: string | number) => `${base}/${id}/close`,
    // Stage 05 IMPROVE — corrective actions raised off this report type
    CAPA_MY_ACTIONS: `${base}/capa/my-actions`,
    CAPA_COMPLETE: (id: string | number) => `${base}/capa/${id}/complete`,
    // Supervisors, not workers — a corrective action is a control change and
    // the accountable owner is the supervisor for that area.
    CAPA_ASSIGNABLE_OWNERS: `${base}/capa/assignable-owners`,
    // "What do I do next" — the queue for a dashboard, and the stage tracker
    // plus outstanding step for one record. Both read the same backend
    // resolver, so a list and a detail screen cannot disagree.
    NEXT_ACTIONS: `${base}/next-actions`,
    NEXT_ACTION: (id: string | number) => `${base}/${id}/next-action`,
    // Shared
    // ALL is the whole lifecycle including closed records — the two queues only
    // ever show what is still waiting on somebody.
    ALL: `${base}/all`,
    STATS: `${base}/stats/summary`,
    DETAIL: (id: string | number) => `${base}/${id}`,
  };
};

/**
 * Permit to Work workflow (flow 6): Worker raises → Supervisor acknowledges →
 * Manager approves / rejects & monitors → Auditor verifies on site.
 */
export const PERMIT_WORKFLOW = {
  // Worker
  REQUEST: '/permit-workflow/request',
  MY_PERMITS: '/permit-workflow/my-permits',
  // Supervisor
  PENDING_REVIEW: '/permit-workflow/pending-review',
  ACKNOWLEDGE: (id: string | number) => `/permit-workflow/${id}/acknowledge`,
  // Manager
  MANAGER_QUEUE: '/permit-workflow/manager-queue',
  APPROVE: (id: string | number) => `/permit-workflow/${id}/approve`,
  REJECT: (id: string | number) => `/permit-workflow/${id}/reject`,
  ACTIVE: '/permit-workflow/active',
  // Stages 05 -> 06 -> 04 -> 06 -> 07. Approval grants the permit (IMPROVE);
  // activation is the separate act of starting work under it (VERIFY).
  ACTIVATE: (id: string | number) => `/permit-workflow/${id}/activate`,
  SUSPEND: (id: string | number) => `/permit-workflow/${id}/suspend`,
  RESUME: (id: string | number) => `/permit-workflow/${id}/resume`,
  COMPLETE_WORK: (id: string | number) => `/permit-workflow/${id}/complete-work`,
  CLOSE: (id: string | number) => `/permit-workflow/${id}/close`,
  // Auditor — an actor in this chain, unlike the report families: the on-site
  // check happens while the permit is live and moves it to `verified`.
  AUDIT_LIST: '/permit-workflow/audit-list',
  VERIFY: (id: string | number) => `/permit-workflow/${id}/verify`,
  // "What do I do next" — the queue, and the stage tracker plus outstanding
  // step for one permit. Both read the same backend resolver, so a list and a
  // detail screen cannot disagree.
  NEXT_ACTIONS: '/permit-workflow/next-actions',
  NEXT_ACTION: (id: string | number) => `/permit-workflow/${id}/next-action`,
  // Shared
  STATS: '/permit-workflow/stats/summary',
  DETAIL: (id: string | number) => `/permit-workflow/${id}`,
} as const;

/**
 * Hazard register workflow (flow 5): log → review → auditor verification.
 */
/**
 * The hazard register runs the same eight stages as every other safety event.
 * One verb per stage, mirroring /incident-workflow — `REVIEW` is the older
 * generic status setter and is kept only for callers that already use it, since
 * it records no stage ownership.
 */
export const HAZARD_REGISTER = {
  // 01 RECORD
  LOG: '/hazard-register/log',
  LIST: '/hazard-register',
  CATEGORIES: '/hazard-register/categories',
  MY_LOGS: '/hazard-register/my-logs',
  DETAIL: (id: string | number) => `/hazard-register/${id}`,

  // 02..08 — one verb per stage
  ASSESS: (id: string | number) => `/hazard-register/${id}/assess`,
  INTERIM_CONTROL: (id: string | number) => `/hazard-register/${id}/interim-control`,
  START_REVIEW: (id: string | number) => `/hazard-register/${id}/start-review`,
  FINDINGS: (id: string | number) => `/hazard-register/${id}/findings`,
  PLAN_CONTROLS: (id: string | number) => `/hazard-register/${id}/plan-controls`,
  SUBMIT_VERIFICATION: (id: string | number) => `/hazard-register/${id}/submit-verification`,
  VERIFY_CONTROLS: (id: string | number) => `/hazard-register/${id}/verify-controls`,
  LESSON: (id: string | number) => `/hazard-register/${id}/lesson`,
  CLOSE: (id: string | number) => `/hazard-register/${id}/close`,

  // "What is waiting on me", and the stage tracker for one hazard
  NEXT_ACTIONS: '/hazard-register/next-actions',
  NEXT_ACTION: (id: string | number) => `/hazard-register/${id}/next-action`,

  // Pre-stage escape hatch — sets status directly, records no stage ownership
  REVIEW: (id: string | number) => `/hazard-register/${id}/review`,

  // Auditor — post-closure assurance, gates nothing
  AUDIT_LIST: '/hazard-register/audit-list',
  VERIFY: (id: string | number) => `/hazard-register/${id}/verify`,
  STATS: '/hazard-register/stats/summary',
} as const;
