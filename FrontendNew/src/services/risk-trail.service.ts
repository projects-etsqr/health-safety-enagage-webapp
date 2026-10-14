import axiosInstance from '../api/axiosInstance';
import type { StageKey, TrailActionLike, TrailPersonLike, TrailStageLike } from '../app/components/tracking/lifecycle';

/**
 * Admin risk-observation lifecycle tracking — every action from capture to closure.
 *
 * Backed by /risk-trail, which reconstructs the trail from the workflow
 * timestamps and the CAPA rows linked by the polymorphic (subject_family,
 * subject_id) pair. Same response shape as /incident-trail and /near-miss-trail
 * on purpose: the console renders all three through one component.
 *
 * Reads `risk_reports` — a worker's one-off sighting of an unsafe condition —
 * and NOT the standing hazard register, which has its own table, its own status
 * vocabulary and its own tracker in `hazard-register.service`. References here
 * are RIS-n; the register's are HAZ-n.
 *
 * This is the same table the mobile app writes to, so a risk raised on a phone
 * appears here the moment it is submitted, and each supervisor and manager step
 * lands as a new action on the trail.
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

/**
 * The WF-01 scoring block, carried by both the list row and the detail record.
 *
 * `raw_risk_score` is likelihood × consequence (1–25). `adjusted_risk_score` is
 * that plus the mandatory uplifts, capped at 25, and it is the number that
 * produced `risk_band` and decided `blocks_work`. Both are sent because they
 * answer different questions, and showing only the adjusted one makes the band
 * look wrong to anyone who checks the multiplication.
 */
export interface RiskScoring {
  risk_title: string | null;
  risk_category: string | null;
  likelihood: string | null;
  consequence: string | null;
  raw_risk_score: number | null;
  adjusted_risk_score: number | null;
  uplift_total: number;
  risk_band: string | null;
  risk_colour: string | null;
  blocks_work: boolean;
}

/** One mandatory uplift and whether this risk attracted it. */
export interface RiskUplift {
  key: string;
  label: string;
  points: number;
  applied: boolean;
}

export interface TrackedRisk extends RiskScoring {
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

export interface TrackedRiskListResponse {
  count: number;
  items: TrackedRisk[];
  stage_counts: Record<StageKey, number>;
}

export interface RiskTrailResponse {
  record: RiskScoring & {
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
    reported_at: string | null;
    observed_date_time: string | null;
    closed_at: string | null;
    root_cause: string | null;
    closure_notes: string | null;
    lessons_learned: string | null;
    verification_result: string | null;
    review_frequency: string | null;
    approval_route: string | null;
    risk_explanation: string | null;
    existing_controls: string | null;
    suggested_controls: string | null;
    hazard_id: number | null;
    uplifts: RiskUplift[];
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

export const getTrackedRisks = (params?: { stage?: string; q?: string; limit?: number }) =>
  axiosInstance
    .get<TrackedRiskListResponse>('/risk-trail', { params })
    .then((r) => r.data);

export const getRiskTrail = (recordId: number) =>
  axiosInstance
    .get<RiskTrailResponse>(`/risk-trail/${recordId}`)
    .then((r) => r.data);

/** Band → the colour the console paints it. Matches `risk_scoring.score_risk`. */
export const BAND_COLOR: Record<string, string> = {
  Low: '#16A34A',
  Medium: '#CA8A04',
  High: '#EA580C',
  Critical: '#DC2626',
};
