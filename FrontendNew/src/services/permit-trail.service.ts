import axiosInstance from '../api/axiosInstance';
import type { StageKey, TrailActionLike, TrailPersonLike, TrailStageLike } from '../app/components/tracking/lifecycle';

/**
 * Admin permit-to-work lifecycle tracking — every action from request to closure.
 *
 * Backed by /permit-trail, which reconstructs the trail from the workflow
 * timestamps on `permits_to_work`. Same response shape as /incident-trail and
 * /near-miss-trail on purpose: the console renders all three through one
 * component.
 *
 * This is the table the mobile app writes to, so a permit raised on a phone
 * appears here on submission, and each acknowledgement, approval, activation,
 * on-site verification and closure lands as a new action on the trail.
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

export interface TrackedPermit {
  id: number;
  reference: string;
  family: string;
  description: string | null;
  permit_type: string | null;
  station_name: string | null;
  workflow_status: string | null;
  stage: StageKey | null;
  stage_number: number | null;
  gate_status: string | null;
  is_high_energy: boolean;
  validity_start: string | null;
  validity_end: string | null;
  /** Past its validity while still live — work may be continuing under a dead permit. */
  is_overdue: boolean;
  requested_at: string | null;
  last_action_at: string | null;
  action_count: number;
  requested_by_id: number | null;
  requested_by_name: string | null;
  approved_by_id: number | null;
  approved_by_name: string | null;
  auditor_verified: boolean;
  verification_result: string | null;
}

export interface TrackedPermitListResponse {
  count: number;
  items: TrackedPermit[];
  stage_counts: Record<StageKey, number>;
}

export interface PermitTrailResponse {
  record: {
    id: number;
    reference: string;
    family: string;
    description: string | null;
    workflow_status: string | null;
    stage: StageKey | null;
    stage_number: number | null;
    gate_status: string | null;
    gate_blocked_reason: string | null;
    is_high_energy: boolean;
    validity_start: string | null;
    validity_end: string | null;
    requested_at: string | null;
    suspension_reason: string | null;
    rejection_reason: string | null;
    verification_result: string | null;
    verification_notes: string | null;
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

export const getTrackedPermits = (params?: { stage?: string; q?: string; limit?: number }) =>
  axiosInstance
    .get<TrackedPermitListResponse>('/permit-trail', { params })
    .then((r) => r.data);

export const getPermitTrail = (permitId: number) =>
  axiosInstance
    .get<PermitTrailResponse>(`/permit-trail/${permitId}`)
    .then((r) => r.data);
