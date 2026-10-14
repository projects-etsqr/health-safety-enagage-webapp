import axiosInstance from '../api/axiosInstance';

/**
 * Admin incident lifecycle tracking — every action from capture to closure.
 *
 * Backed by /incident-trail, which reconstructs the trail from the workflow
 * timestamps, CAPA rows and domain events rather than from `audit_logs` (that
 * table is empty — nothing writes to it yet).
 */

export type StageKey =
  | 'RECORD' | 'ASSESS' | 'RESPOND' | 'INVESTIGATE'
  | 'IMPROVE' | 'VERIFY' | 'LEARN' | 'CLOSE';

export const STAGE_ORDER: StageKey[] = [
  'RECORD', 'ASSESS', 'RESPOND', 'INVESTIGATE', 'IMPROVE', 'VERIFY', 'LEARN', 'CLOSE',
];

export interface TrailAction {
  sequence: number;
  stage: StageKey | null;
  stage_number: number | null;
  action: string;
  detail: string | null;
  actor_id: number | null;
  actor_name: string | null;
  /** `EMP-<employees.id>` — a display convention, not a stored staff code. */
  actor_ref: string | null;
  actor_job_role: string | null;
  actor_department: string | null;
  actor_username: string | null;
  occurred_at: string | null;
  source: string;
  /** True when the schema has no timestamp for this action and it was anchored
   *  to a neighbouring one. Rendered as an explicit caveat, never as fact. */
  timestamp_inferred: boolean;
  inferred_from?: string;
  reference: string | null;
  capa_status?: string | null;
  capa_due_date?: string | null;
  capa_priority?: string | null;
}

export interface TrailStage {
  number: number;
  key: StageKey;
  label: string;
  description: string;
  state: 'complete' | 'current' | 'skipped' | 'pending';
  entered_at: string | null;
  last_action_at: string | null;
  action_count: number;
  actions: TrailAction[];
}

export interface ChronologyWarning {
  action: string;
  stage: StageKey;
  occurred_at: string;
  source: string;
  precedes: string;
  precedes_at: string;
  reason: string;
}

/** A person who acted on the incident, with the identity an admin needs. */
export interface TrailPerson {
  employee_id: number;
  employee_ref: string;
  name: string | null;
  job_role: string | null;
  department: string | null;
  employment_type: string | null;
  is_active: boolean;
  username: string | null;
  email: string | null;
  /** True when the incident names an employee id with no matching employee row. */
  record_missing: boolean;
  workflow_roles: string[];
  action_count: number;
  actions: string[];
  first_action_at: string | null;
  last_action_at: string | null;
}

/** Free-text people the report names. Never linked to an employee row. */
export interface NamedInReport {
  injured_person: string | null;
  injured_body_part: string | null;
  witnesses: string[];
}

export interface Participant {
  employee_id: number;
  employee_ref: string;
  name: string | null;
  job_role: string | null;
  workflow_role: string;
}

export interface TrackedIncident {
  id: number;
  reference: string;
  description: string;
  incident_type: string | null;
  severity: string | null;
  severity_label: string | null;
  priority: string | null;
  workflow_status: string | null;
  stage: StageKey | null;
  stage_number: number | null;
  reported_at: string | null;
  closed_at: string | null;
  last_action_at: string | null;
  action_count: number;
  capa_total: number;
  capa_closed: number;
  is_hipo: boolean;
  is_recurring: boolean;
  statutory_reportable: boolean;
  is_overdue: boolean;
  reported_by_id: number | null;
  reported_by_name: string | null;
  supervisor_id: number | null;
  supervisor_name: string | null;
  manager_id: number | null;
  manager_name: string | null;
  participants: Participant[];
  participant_count: number;
}

export interface TrackedListResponse {
  count: number;
  items: TrackedIncident[];
  stage_counts: Record<StageKey, number>;
}

export interface IncidentTrailResponse {
  incident: {
    id: number;
    reference: string;
    description: string | null;
    incident_type: string | null;
    severity: string | null;
    severity_label: string | null;
    priority: string | null;
    workflow_status: string | null;
    stage: StageKey | null;
    stage_number: number | null;
    is_hipo: boolean;
    is_recurring: boolean;
    statutory_reportable: boolean;
    incident_date_time: string | null;
    reported_at: string | null;
    closed_at: string | null;
    root_cause: string | null;
    closure_notes: string | null;
    lessons_learned: string | null;
  };
  stages: TrailStage[];
  actions: TrailAction[];
  people: TrailPerson[];
  named_in_report: NamedInReport;
  unstaged_actions: TrailAction[];
  total_actions: number;
  total_stages: number;
  skipped_stages: StageKey[];
  chronology_warnings: ChronologyWarning[];
}

export const getTrackedIncidents = (params?: { stage?: string; q?: string; limit?: number }) =>
  axiosInstance
    .get<TrackedListResponse>('/incident-trail', { params })
    .then((r) => r.data);

export const getIncidentTrail = (incidentId: number) =>
  axiosInstance
    .get<IncidentTrailResponse>(`/incident-trail/${incidentId}`)
    .then((r) => r.data);
