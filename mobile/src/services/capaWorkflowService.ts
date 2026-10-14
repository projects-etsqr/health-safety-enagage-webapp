import { apiClient } from '../api/client';

/**
 * WF-04, the four steps that are somebody else's inbox rather than the owner's.
 *
 * The owner's half of the lifecycle already has screens: worker My Actions runs
 * start → progress → evidence → submit. What had no screen at all were the
 * steps the document places deliberately outside the owner's hands —
 *
 *   06  interim check      the Supervisor's 50% gate; submit refuses without it
 *   08  independent review anyone but the owner confirms the control is real
 *   10  approve closure    the Safety Manager, and only after all three checks
 *
 * — which meant an action could be worked to completion and then stop dead,
 * because "completing an action no longer closes it" and nothing in the app
 * could perform the steps that do.
 *
 * apiClient's interceptor strips the {success, data} envelope, so `res.data` is
 * already the payload here.
 */

export type CapaStage = 'interim' | 'review' | 'approval' | 'unassigned';

export interface CapaQueueItem {
  id: number;
  capa_ref: string | null;
  description: string | null;
  incident_id: number | null;
  subject_family: string | null;
  subject_id: number | null;
  status: string | null;
  step: number;
  step_label: string;
  priority_band: string | null;
  capa_type: string | null;
  due_date: string | null;
  elapsed_percent: number | null;
  is_overdue: boolean;
  escalation_level: number;
  responsible_person_id: number | null;
  responsible_person_name: string | null;
  systemic_flag: boolean;
  reopened_count: number;
}

export interface ClosureCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface CapaEvidenceItem {
  id: number;
  evidence_type: string;
  file_url: string | null;
  description: string | null;
  evidence_date: string | null;
  validation_result: string | null;
  rejection_reason: string | null;
}

export interface CapaDetail extends CapaQueueItem {
  action_plan: string | null;
  success_criteria: string | null;
  action_category: string | null;
  root_cause_addressed: string | null;
  interim_check_at: string | null;
  evidence_submitted_at: string | null;
  independent_review_at: string | null;
  independent_review_result: string | null;
  closure_checks: ClosureCheck[];
  evidence: CapaEvidenceItem[];
  next_action: string | null;
  is_locked: boolean;
}

export const capaWorkflowService = {
  /** The stage inbox. `my-actions` cannot answer these — it is the owner's list. */
  async queue(stage: CapaStage): Promise<CapaQueueItem[]> {
    const res = await apiClient.get('/capa/queue', { params: { stage } });
    return Array.isArray(res.data) ? res.data : [];
  },

  async detail(capaId: number): Promise<CapaDetail> {
    const res = await apiClient.get(`/capa/${capaId}`);
    return res.data;
  },

  /** Step 06 · the 50% gate. The owner cannot run it on their own action. */
  async interimCheck(capaId: number, progressIsReal: boolean, notes?: string): Promise<CapaDetail> {
    const res = await apiClient.post(`/capa/${capaId}/interim-check`, {
      progress_is_real: progressIsReal,
      notes,
    });
    return res.data;
  },

  /**
   * Step 08 · confirmed sends it to the Safety Manager, rejected sends it back
   * to the owner to correct and resubmit. The backend decides which — this only
   * reports what the reviewer saw.
   */
  async independentReview(capaId: number, confirmed: boolean, notes?: string): Promise<CapaDetail> {
    const res = await apiClient.post(`/capa/${capaId}/independent-review`, { confirmed, notes });
    return res.data;
  },

  /**
   * Step 10 · the final gate. The three closure checks are re-run server-side
   * and cannot be overridden, so a 400 here is the system refusing, not a bug.
   */
  async approveClosure(
    capaId: number,
    body: {
      approved: boolean;
      closure_notes?: string;
      lesson_learned?: string;
      effectiveness_rating?: number;
    },
  ): Promise<CapaDetail> {
    const res = await apiClient.post(`/capa/${capaId}/approve-closure`, body);
    return res.data;
  },
};
