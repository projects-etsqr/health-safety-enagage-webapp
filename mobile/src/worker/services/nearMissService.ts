import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

/**
 * The near misses this worker reported, for following them to closure.
 *
 * Reporting one already lived in `incidentService.reportNearMiss` (stage 01
 * RECORD, with the offline queue behind it) and is deliberately left there.
 * What was missing is everything after: a worker could report a near miss and
 * never hear anything again, because nothing in the app read the record back.
 *
 * The stage fields come straight off `/near-miss-workflow/my-reports` — the
 * backend derives them from `workflow_status` and every role reads the same
 * derivation, so the worker, the supervisor and the manager cannot disagree
 * about where a near miss has got to.
 */

/** One of this worker's near misses, with its position on the eight stages. */
export interface MyNearMiss {
  id: number;
  report_type: string;
  workflow_status: string | null;
  severity: string | null;
  description: string | null;
  reported_at: string | null;
  acknowledged_at: string | null;
  created_at: string | null;
  assessed_priority: string | null;
  is_hipo: boolean | null;
  response_due_at: string | null;
  stage: string | null;
  stage_number: number | null;
  stage_label: string | null;
  completed_stages: string[];
  total_stages: number | null;
}

/** The full record, including what the supervisor and manager wrote on it. */
export interface NearMissDetail extends MyNearMiss {
  root_cause: string | null;
  immediate_actions_taken: string | null;
  closure_notes: string | null;
  escalation_reason: string | null;
  closed_at: string | null;
  details: Record<string, any>;
}

export const nearMissService = {
  /** Every near miss this worker reported, newest first, each with its stage. */
  async myNearMisses(): Promise<MyNearMiss[]> {
    const { data } = await apiClient.get<MyNearMiss[]>(ENDPOINTS.NEAR_MISS.MY_REPORTS);
    return data ?? [];
  },

  async getNearMiss(id: number): Promise<NearMissDetail> {
    const { data } = await apiClient.get<NearMissDetail>(ENDPOINTS.NEAR_MISS.DETAIL(id));
    return data;
  },
};
