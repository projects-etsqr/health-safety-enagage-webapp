import axiosInstance from '../api/axiosInstance';
import type { StageKey, TrailActionLike, TrailPersonLike, TrailStageLike } from '../app/components/tracking/lifecycle';

/**
 * Admin near-miss lifecycle tracking — every action from capture to closure.
 *
 * Backed by /near-miss-trail, which reconstructs the trail from the workflow
 * timestamps and the CAPA rows linked by the polymorphic (subject_family,
 * subject_id) pair. Same response shape as /incident-trail on purpose: the
 * console renders both through one component.
 *
 * This is the same `near_misses` table the mobile app writes to, so a near miss
 * reported on a phone appears here the moment it is submitted, and each
 * supervisor and manager step lands as a new action on the trail.
 */

export type { StageKey };
export { STAGE_ORDER } from '../app/components/tracking/lifecycle';

export type TrailAction = TrailActionLike;
export type TrailStage = TrailStageLike;
export type TrailPerson = TrailPersonLike;

export interface ChronologyWarning {
  action: string;
  stage: StageKey;
  occurred_at: string;
  source: string;
  precedes: string;
  precedes_at: string;
  reason: string;
}

export interface TrackedNearMiss {
  id: number;
  reference: string;
  family: string;
  description: string | null;
  station_name: string | null;
  severity: string | null;
  priority: string | null;
  severity_label: string | null;
  workflow_status: string | null;
  stage: StageKey | null;
  stage_number: number | null;
  is_hipo: boolean;
  is_recurring: boolean;
  potential_consequence: string | null;
  reported_at: string | null;
  closed_at: string | null;
  response_due_at: string | null;
  is_overdue: boolean;
  last_action_at: string | null;
  action_count: number;
  capa_total: number;
  capa_open: number;
  reported_by_id: number | null;
  reported_by_name: string | null;
  supervisor_id: number | null;
  supervisor_name: string | null;
  auditor_verified: boolean;
}

export interface TrackedNearMissListResponse {
  count: number;
  items: TrackedNearMiss[];
  stage_counts: Record<StageKey, number>;
}

export interface NearMissTrailResponse {
  record: {
    id: number;
    reference: string;
    family: string;
    description: string | null;
    severity: string | null;
    severity_label: string | null;
    priority: string | null;
    workflow_status: string | null;
    stage: StageKey | null;
    stage_number: number | null;
    is_hipo: boolean;
    is_recurring: boolean;
    potential_consequence: string | null;
    underlying_cause: string | null;
    event_date_time: string | null;
    reported_at: string | null;
    closed_at: string | null;
    root_cause: string | null;
    closure_notes: string | null;
    lessons_learned: string | null;
    verification_result: string | null;
  };
  stages: TrailStage[];
  actions: TrailAction[];
  people: TrailPerson[];
  named_in_report: { witnesses: string[] };
  unstaged_actions: TrailAction[];
  total_actions: number;
  total_stages: number;
  skipped_stages: StageKey[];
  chronology_warnings: ChronologyWarning[];
}

export const getTrackedNearMisses = (params?: { stage?: string; q?: string; limit?: number }) =>
  axiosInstance
    .get<TrackedNearMissListResponse>('/near-miss-trail', { params })
    .then((r) => r.data);

export const getNearMissTrail = (recordId: number) =>
  axiosInstance
    .get<NearMissTrailResponse>(`/near-miss-trail/${recordId}`)
    .then((r) => r.data);
