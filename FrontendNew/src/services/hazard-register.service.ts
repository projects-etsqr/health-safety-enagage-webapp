import axiosInstance from '../api/axiosInstance';
import type { StageKey } from './incident-trail.service';

/**
 * The hazard register (flow 5) — the standing `hazards` table, carried through
 * the same eight stages as an incident.
 *
 * Two backends sit behind this file and they answer different questions:
 *
 *   /unsafe-act-register        the live register — what is owed, and the verbs to do it
 *   /unsafe-act-register-trail  the audit view — what happened, by whom, when
 *
 * The file and its symbols keep the hazard_* names the table still uses. The
 * family is called Unsafe Act everywhere a user can read it (080).
 *
 * `StageKey` and `STAGE_ORDER` are imported from incident-trail.service rather
 * than redeclared: the eight stages are one vocabulary across every event
 * family, and a second copy would drift the first time a stage was renamed.
 */

export type { StageKey };
export { STAGE_ORDER } from './incident-trail.service';

/** The register's own status vocabulary — one per stage from 02 onward. */
export type RegisterStatus =
  | 'open'                  // 02 ASSESS
  | 'interim_control'       // 03 RESPOND
  | 'under_review'          // 04 INVESTIGATE
  | 'controls_planned'      // 05 IMPROVE
  | 'pending_verification'  // 06 VERIFY
  | 'controlled'            // 07 LEARN
  | 'closed';               // 08 CLOSE

export const REGISTER_STATUS_LABEL: Record<string, string> = {
  open: 'Logged — needs assessment',
  interim_control: 'Interim control in place',
  under_review: 'Under review',
  controls_planned: 'Control planned — not yet verified',
  pending_verification: 'Awaiting verification',
  controlled: 'Controlled — lesson owed',
  closed: 'Closed',
};

/** Hierarchy of control, strongest first. */
export const CONTROL_HIERARCHY = [
  'elimination', 'substitution', 'engineering', 'administrative', 'ppe',
] as const;
export type ControlHierarchy = (typeof CONTROL_HIERARCHY)[number];

export const HIERARCHY_LABEL: Record<ControlHierarchy, string> = {
  elimination: 'Eliminate',
  substitution: 'Substitute',
  engineering: 'Engineering',
  administrative: 'Administrative',
  ppe: 'PPE',
};

/**
 * How strong each level is, for the register's control-quality reporting.
 * Elimination removes the hazard; PPE only protects the person standing next to
 * it. A register closing most of its hazards on PPE is the signal stage 05
 * exists to surface, so the rank is carried rather than inferred from order.
 */
export const HIERARCHY_RANK: Record<ControlHierarchy, number> = {
  elimination: 5, substitution: 4, engineering: 3, administrative: 2, ppe: 1,
};

// ══════════════════════════════════════════════════════════════════════════════
// Trail — the audit view
// ══════════════════════════════════════════════════════════════════════════════

export interface HazardTrailAction {
  sequence: number;
  stage: StageKey | null;
  stage_number: number | null;
  action: string;
  detail: string | null;
  actor_id: number | null;
  occurred_at: string | null;
  source: string;
  /** True when the schema has no timestamp for this action and it was anchored
   *  to a neighbouring one. Rendered as an explicit caveat, never as fact. */
  timestamp_inferred: boolean;
  inferred_from?: string;
  reference: string | null;
}

export interface HazardTrailStage {
  number: number;
  key: StageKey;
  label: string;
  description: string;
  state: 'complete' | 'current' | 'skipped' | 'pending';
  entered_at: string | null;
  last_action_at: string | null;
  action_count: number;
  actions: HazardTrailAction[];
}

export interface HazardTrailPerson {
  employee_id: number;
  employee_ref: string;
  name: string | null;
  job_role: string | null;
  department: string | null;
  employment_type: string | null;
  is_active: boolean;
  username: string | null;
  email: string | null;
  /** True when the hazard names an employee id with no matching employee row. */
  record_missing: boolean;
  workflow_roles: string[];
  action_count: number;
  actions: string[];
  first_action_at: string | null;
  last_action_at: string | null;
}

export interface TrackedHazard {
  id: number;
  reference: string;
  description: string | null;
  hazard_name: string | null;
  category_name: string | null;
  station_name: string | null;
  severity: string | null;
  probability: string | null;
  risk_score: number | null;
  priority: string | null;
  severity_label: string | null;
  register_status: RegisterStatus | string | null;
  stage: StageKey | null;
  stage_number: number | null;
  control_hierarchy: ControlHierarchy | string | null;
  work_stopped: boolean;
  verification_failures: number;
  logged_at: string | null;
  closed_at: string | null;
  response_due_at: string | null;
  control_due_date: string | null;
  last_action_at: string | null;
  action_count: number;
  logged_by_id: number | null;
  logged_by_name: string | null;
  reviewed_by_id: number | null;
  reviewed_by_name: string | null;
  control_owner_id: number | null;
  control_owner_name: string | null;
  auditor_verified: boolean;
}

export interface TrackedHazardListResponse {
  count: number;
  items: TrackedHazard[];
  /** Counted over the whole register, not the returned page. */
  stage_counts: Record<StageKey, number>;
}

export interface HazardTrailResponse {
  hazard: {
    id: number;
    reference: string;
    hazard_name: string | null;
    description: string | null;
    severity: string | null;
    probability: string | null;
    risk_score: number | null;
    priority: string | null;
    severity_label: string | null;
    register_status: string | null;
    stage: StageKey | null;
    stage_number: number | null;
    work_stopped: boolean;
    persons_exposed: number | null;
    interim_control: string | null;
    root_cause: string | null;
    planned_controls: string | null;
    control_hierarchy: ControlHierarchy | string | null;
    control_due_date: string | null;
    verification_failures: number;
    control_verification_notes: string | null;
    lessons_learned: string | null;
    closure_notes: string | null;
    logged_at: string | null;
    response_due_at: string | null;
    closed_at: string | null;
    gps_latitude: string | null;
    gps_longitude: string | null;
  };
  stages: HazardTrailStage[];
  actions: HazardTrailAction[];
  people: HazardTrailPerson[];
  unstaged_actions: HazardTrailAction[];
  total_actions: number;
  total_stages: number;
  skipped_stages: StageKey[];
}

export const getTrackedHazards = (params?: { stage?: string; q?: string; limit?: number }) =>
  axiosInstance
    .get<TrackedHazardListResponse>('/unsafe-act-register-trail', { params })
    .then((r) => r.data);

export const getHazardTrail = (hazardId: number) =>
  axiosInstance
    .get<HazardTrailResponse>(`/unsafe-act-register-trail/${hazardId}`)
    .then((r) => r.data);

// ══════════════════════════════════════════════════════════════════════════════
// Register — the live view and the stage verbs
// ══════════════════════════════════════════════════════════════════════════════

export interface HazardRegisterEntry {
  id: number;
  reference: string | null;
  hazard_name: string | null;
  description: string | null;
  severity: string | null;
  probability: string | null;
  register_status: string | null;
  assessed_priority: string | null;
  assessed_label: string | null;
  risk_score: number | null;
  response_due_at: string | null;
  interim_control: string | null;
  work_stopped: number | null;
  root_cause: string | null;
  persons_exposed: number | null;
  planned_controls: string | null;
  control_hierarchy: string | null;
  control_due_date: string | null;
  control_verification_notes: string | null;
  verification_failures: number | null;
  lessons_learned: string | null;
  closure_notes: string | null;
  logged_at: string | null;
  closed_at: string | null;
  stage: StageKey | null;
  stage_number: number | null;
  stage_label: string | null;
  completed_stages: string[];
  total_stages: number | null;
  logged_by_name: string | null;
  reviewed_by_name: string | null;
  control_owner_name: string | null;
  station_name: string | null;
  category_name: string | null;
  is_overdue: boolean | null;
}

/** Stage tracker + the one outstanding step, for a single hazard. */
export interface HazardNextAction {
  hazard_id: number;
  reference: string;
  register_status: string | null;
  stage: StageKey | null;
  stage_number: number | null;
  stage_label: string | null;
  is_closed: boolean;
  next_action: {
    action: string;
    detail: string;
    owner_role: string;
    route: string;
    cta: string;
    unblocks: string | null;
  } | null;
  can_act: boolean;
  /** This step is this role's own job, not merely one they outrank. */
  is_mine: boolean;
  track: Array<{
    number: number;
    key: StageKey;
    label: string;
    short: string;
    state: 'done' | 'current' | 'pending';
  }>;
}

export interface HazardRegisterStats {
  total: number;
  by_status: Record<string, number>;
  by_stage: Record<StageKey, number>;
  by_priority: Record<string, number>;
  open: number;
  overdue: number;
}

export const getHazardRegister = (params?: {
  stage?: string;
  register_status?: string;
  open_only?: boolean;
  q?: string;
  limit?: number;
}) =>
  axiosInstance
    .get<HazardRegisterEntry[]>('/unsafe-act-register', { params })
    .then((r) => r.data ?? []);

export const getHazard = (id: number) =>
  axiosInstance.get<HazardRegisterEntry>(`/unsafe-act-register/${id}`).then((r) => r.data);

export const getHazardNextAction = (id: number) =>
  axiosInstance.get<HazardNextAction>(`/unsafe-act-register/${id}/next-action`).then((r) => r.data);

export const getHazardRegisterStats = () =>
  axiosInstance.get<HazardRegisterStats>('/unsafe-act-register/stats/summary').then((r) => r.data);

// ── Stage verbs ──────────────────────────────────────────────────────────────

export const assessHazard = (
  id: number,
  body: {
    severity?: string;
    probability?: string;
    persons_exposed?: number;
    work_stopped?: boolean;
    assessment_notes?: string;
  },
) => axiosInstance.post<HazardRegisterEntry>(`/unsafe-act-register/${id}/assess`, body).then((r) => r.data);

export const recordInterimControl = (
  id: number,
  body: { interim_control: string; work_stopped?: boolean },
) =>
  axiosInstance
    .post<HazardRegisterEntry>(`/unsafe-act-register/${id}/interim-control`, body)
    .then((r) => r.data);

export const startHazardReview = (id: number, review_notes?: string) =>
  axiosInstance
    .post<HazardRegisterEntry>(`/unsafe-act-register/${id}/start-review`, { review_notes })
    .then((r) => r.data);

export const recordHazardFindings = (
  id: number,
  body: { root_cause?: string; review_notes?: string; persons_exposed?: number },
) =>
  axiosInstance
    .post<HazardRegisterEntry>(`/unsafe-act-register/${id}/findings`, body)
    .then((r) => r.data);

export const planHazardControls = (
  id: number,
  body: {
    planned_controls: string;
    control_hierarchy: ControlHierarchy;
    control_owner_id?: number;
    control_due_date?: string;
    /** Required by the backend when control_hierarchy is 'ppe'. */
    ppe_justification?: string;
  },
) =>
  axiosInstance
    .post<HazardRegisterEntry>(`/unsafe-act-register/${id}/plan-controls`, body)
    .then((r) => r.data);

export const submitHazardForVerification = (id: number, implementation_notes?: string) =>
  axiosInstance
    .post<HazardRegisterEntry>(`/unsafe-act-register/${id}/submit-verification`, { implementation_notes })
    .then((r) => r.data);

/**
 * `effective: false` is not a rejection of paperwork — it returns the hazard to
 * IMPROVE and counts the failure, because a control that did not hold means the
 * hazard is still live.
 */
export const verifyHazardControls = (
  id: number,
  body: { effective: boolean; verification_notes?: string },
) =>
  axiosInstance
    .post<HazardRegisterEntry>(`/unsafe-act-register/${id}/verify-controls`, body)
    .then((r) => r.data);

export const captureHazardLesson = (id: number, lessons_learned: string) =>
  axiosInstance
    .post<HazardRegisterEntry>(`/unsafe-act-register/${id}/lesson`, { lessons_learned })
    .then((r) => r.data);

export const closeHazard = (
  id: number,
  body?: { closure_notes?: string; lessons_learned?: string },
) =>
  axiosInstance
    .post<HazardRegisterEntry>(`/unsafe-act-register/${id}/close`, body ?? {})
    .then((r) => r.data);
