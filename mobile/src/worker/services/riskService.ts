import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { submitOrQueue, type SubmitResult } from '../../services/offlineQueue';
import type { PhotoAttachment } from '../types';

/**
 * A worker's one-off risk observations on `risk_reports` — raising them, and
 * following each one to closure.
 *
 * Split out of `hazardService`, which had been carrying both this and the
 * standing hazard register. They are separate tables with separate lifecycles
 * and separate screens, and one service holding both is how a caller ends up
 * logging a register entry when it meant to report a sighting. `hazardService`
 * now owns only the register; this owns only observations.
 *
 * The stage fields come straight off `/risk-workflow/my-reports` — the backend
 * derives them from `workflow_status` and every role reads the same derivation,
 * so the worker, the supervisor and the manager cannot disagree about where a
 * risk has got to.
 */

/** What the risk form collects. The 5×5 matrix words, before translation. */
export interface ReportRiskRequest {
  /** The org's own category name, from the fetched list. Sent as a name
   *  because `risk_reports.risk_category` is a name column — the screen used
   *  to send a hard-coded id and this stored the digit. */
  category?: string;
  /** Short risk / hazard description */
  hazard_name: string;
  /** Consequence: Minor | Significant | Serious | Fatal */
  severity?: string;
  /** Likelihood: Rare | Unlikely | Possible | Likely */
  probability?: string;
  /** Where the worker says it is. Resolved to a station when the text matches
   *  one, kept as typed when it does not. */
  location?: string;
  /** The "It is still there" toggle. */
  still_present?: boolean;
  /** What the worker suggests should be done about it. */
  suggested_controls?: string;
  /** Photos and videos of the condition. */
  photos?: PhotoAttachment[];
}

/**
 * The risk screen speaks the 5x5 matrix words; the workflow API speaks its own
 * consequence scale plus a low/medium/high/critical severity that drives escalation.
 * Serious and Fatal map to high/critical so the supervisor's investigation routes
 * straight to the manager instead of waiting for approval.
 */
const CONSEQUENCE: Record<string, string> = {
  minor: 'minor',
  significant: 'moderate',
  serious: 'major',
  fatal: 'catastrophic',
};

const WORKFLOW_SEVERITY: Record<string, string> = {
  minor: 'low',
  significant: 'medium',
  serious: 'high',
  fatal: 'critical',
};

/** One of this worker's risk reports, with its position on the eight stages. */
export interface MyRisk {
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

/**
 * The WF-01 verdict, as the backend returns it under `details`.
 *
 * `risk_score` is the raw likelihood × consequence the worker's own answers
 * produced; `adjusted_risk_score` is that plus the mandatory uplifts, and it is
 * what banded the risk and set `blocks_work`. A worker who entered a 12 and
 * sees a High band needs both numbers or the rating looks arbitrary.
 */
export interface RiskDetails {
  risk_title?: string | null;
  risk_category?: string | null;
  likelihood?: string | null;
  consequence?: string | null;
  risk_score?: number | null;
  adjusted_risk_score?: number | null;
  uplift_total?: number | null;
  risk_band?: string | null;
  risk_colour?: string | null;
  blocks_work?: number | boolean | null;
  approval_route?: string | null;
  review_frequency?: string | null;
  risk_explanation?: string | null;
  existing_controls?: string | null;
  suggested_controls?: string | null;
  hazard_id?: number | null;
}

/** The full record, including what the supervisor and manager wrote on it. */
export interface RiskDetail extends MyRisk {
  root_cause: string | null;
  immediate_actions_taken: string | null;
  closure_notes: string | null;
  escalation_reason: string | null;
  closed_at: string | null;
  details: RiskDetails;
}

export const riskService = {
  /**
   * Report a risk. Goes to `risk_reports` (a worker's field observation), NOT
   * the `hazards` catalog — only the workflow table has a supervisor queue
   * behind it, and not the register either, which is `hazardService.logHazard`.
   */
  async reportRisk(payload: ReportRiskRequest): Promise<SubmitResult<unknown>> {
    const key = (payload.severity ?? '').trim().toLowerCase();
    const media = payload.photos ?? [];
    const hasMedia = media.length > 0;

    const body = {
      description: payload.hazard_name,
      risk_title: payload.hazard_name,
      risk_category: payload.category || undefined,
      // Three answers the screen has always collected and this body never
      // carried: they were typed, validated, rendered — and dropped here.
      location: payload.location || undefined,
      hazard_still_present: payload.still_present ? 'Yes' : 'No',
      suggested_controls: payload.suggested_controls || undefined,
      likelihood: (payload.probability ?? '').trim().toLowerCase() || undefined,
      consequence: CONSEQUENCE[key],
      severity: WORKFLOW_SEVERITY[key] ?? 'medium',
    };

    // Multipart only when there is something to attach, matching how near
    // misses and unsafe acts post. Until this existed the risk screen captured
    // evidence and then dropped it on the floor: the attachments were collected
    // and never referenced by the submit, so a worker photographed an unguarded
    // belt and the supervisor received a description and nothing else.
    // Offline: the files stay on the device and the body is rebuilt on replay.
    return submitOrQueue(
      ENDPOINTS.RISK.REPORT,
      body,
      {
        kind: hasMedia ? 'multipart' : 'json',
        photos: hasMedia ? media.map(m => ({ uri: m.uri, name: m.name, type: m.type })) : undefined,
        client: hasMedia ? 'workerUpload' : 'worker',
        label: 'Risk observation',
      },
    );
  },

  /** Every risk this worker reported, newest first, each with its stage. */
  async myRisks(): Promise<MyRisk[]> {
    const { data } = await apiClient.get<MyRisk[]>(ENDPOINTS.RISK.MY_REPORTS);
    return data ?? [];
  },

  async getRisk(id: number): Promise<RiskDetail> {
    const { data } = await apiClient.get<RiskDetail>(ENDPOINTS.RISK.DETAIL(id));
    return data;
  },
};
