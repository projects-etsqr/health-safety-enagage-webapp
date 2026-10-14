import { apiClient } from '../api/client';
import { PERMIT_WORKFLOW } from '../api/endpoints';
import type { WorkflowStageKey } from './workflowStages';

/**
 * Drives the Permit to Work workflow (flow 6):
 *   Worker raises → Supervisor acknowledges → Manager approves/rejects & monitors →
 *   Auditor verifies the permit is valid and displayed on site.
 *
 * The backend keeps permits in their own table with a `workflow_status` state machine
 * that runs alongside the website's `status` field (only approval flips status='Active').
 */
export interface PermitListItem {
  id: number;
  permit_ref: string | null;
  permit_type_id: number | null;
  workflow_status: string | null;
  status: string | null;
  work_description: string | null;
  location_station_id: number | null;
  requested_by: number | null;
  requested_at: string | null;
  validity_end: string | null;
  /** Why the gates refused, when the permit is sitting at RESPOND. */
  gate_status?: string | null;
  gate_blocked_reason?: string | null;

  // Position on the eight stages, derived by the backend from workflow_status.
  // The API has always sent these; the type simply never declared them, so
  // every screen wanting to draw the rail had to cast to `any`.
  stage: WorkflowStageKey | null;
  stage_number: number | null;
  stage_label: string | null;
  completed_stages: WorkflowStageKey[];
  total_stages: number | null;
}

/** One step of the eight, as the tracker renders it. */
export interface PermitTrackStage {
  number: number;
  key: WorkflowStageKey;
  label: string;
  short: string;
  state: 'done' | 'current' | 'pending';
}

/**
 * The stage tracker plus the one outstanding step for a single permit.
 *
 * Identical in shape to the incident, hazard and near-miss equivalents, so
 * The stage fields are still returned and still correct; no mobile screen
 * currently draws them — see the note on WorkflowStageBar.
 */
export interface PermitNextAction {
  family: string;
  record_id: number;
  reference: string;
  workflow_status: string | null;
  stage: WorkflowStageKey | null;
  stage_number: number | null;
  stage_label: string | null;
  is_closed: boolean;
  /** May this user perform the step at all? */
  can_act: boolean;
  /** Is it *their* step, rather than one they merely outrank? */
  is_mine: boolean;
  next_action: {
    action: string;
    detail: string;
    owner_role: string;
    route: string;
    cta: string;
    unblocks: string | null;
  } | null;
  track: PermitTrackStage[];
}

/** One row of "what is waiting on me" across the permit estate. */
export interface PermitNextActionItem {
  family: string;
  id: number;
  reference: string;
  description: string;
  permit_type_id: number | null;
  workflow_status: string | null;
  stage: WorkflowStageKey | null;
  stage_number: number | null;
  stage_label: string | null;
  action: string;
  detail: string;
  cta: string;
  route: string;
  unblocks: string | null;
  owner_role: string;
  is_mine: boolean;
  can_act: boolean;
  station_name: string | null;
  validity_start: string | null;
  validity_end: string | null;
  /** Past its validity while still live — work may be going on under a dead permit. */
  is_overdue: boolean;
  auditor_verified: boolean;
  waiting_since: string | null;
}

export interface PermitNextActionQueue {
  count: number;
  items: PermitNextActionItem[];
  mine_count: number;
}

export interface PermitDetail extends PermitListItem {
  duration_requested_hours: number | null;
  number_of_workers: number | null;
  validity_start: string | null;
  acknowledged_by: number | null;
  acknowledged_at: string | null;
  supervisor_notes: string | null;
  approved_by: number | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  auditor_verified_by: number | null;
  auditor_verified_at: string | null;
  verification_result: string | null;
  verification_notes: string | null;
}

export interface PermitRequestPayload {
  permit_type?: string;
  permit_type_id?: number;
  work_description?: string;
  location?: string;
  location_station_id?: number;
  duration_requested_hours?: number;
  number_of_workers?: number;
  validity_start?: string;
  validity_end?: string;
}

export interface PermitApprovePayload {
  validity_start?: string;
  validity_end?: string;
  notes?: string;
}

export const permitWorkflowService = {
  // ── Worker ──────────────────────────────────────────────────────────────────
  async request(payload: PermitRequestPayload): Promise<PermitDetail> {
    const { data } = await apiClient.post(PERMIT_WORKFLOW.REQUEST, payload);
    return data;
  },
  async myPermits(): Promise<PermitListItem[]> {
    const { data } = await apiClient.get(PERMIT_WORKFLOW.MY_PERMITS);
    return data ?? [];
  },

  // ── Supervisor ────────────────────────────────────────────────────────────────
  async pendingReview(): Promise<PermitListItem[]> {
    const { data } = await apiClient.get(PERMIT_WORKFLOW.PENDING_REVIEW);
    return data ?? [];
  },
  async acknowledge(id: number, supervisorNotes?: string): Promise<PermitDetail> {
    const { data } = await apiClient.post(PERMIT_WORKFLOW.ACKNOWLEDGE(id), {
      supervisor_notes: supervisorNotes,
    });
    return data;
  },

  // ── Manager ─────────────────────────────────────────────────────────────────
  async managerQueue(): Promise<PermitListItem[]> {
    const { data } = await apiClient.get(PERMIT_WORKFLOW.MANAGER_QUEUE);
    return data ?? [];
  },
  async approve(id: number, payload: PermitApprovePayload = {}): Promise<PermitDetail> {
    const { data } = await apiClient.post(PERMIT_WORKFLOW.APPROVE(id), payload);
    return data;
  },
  async reject(id: number, reason: string): Promise<PermitDetail> {
    const { data } = await apiClient.post(PERMIT_WORKFLOW.REJECT(id), { rejection_reason: reason });
    return data;
  },
  /**
   * Every open permit waiting on this user, with the exact step it needs.
   *
   * `mineOnly` false returns steps this role merely outranks as well, each
   * flagged `is_mine: false` — which is what lets a screen say "waiting on the
   * auditor" rather than showing an empty list.
   */
  async getNextActions(mineOnly = true, limit = 50): Promise<PermitNextActionQueue> {
    const { data } = await apiClient.get(PERMIT_WORKFLOW.NEXT_ACTIONS, {
      params: { mine_only: mineOnly, limit },
    });
    return data ?? { count: 0, items: [], mine_count: 0 };
  },

  /** Stage tracker + the one outstanding step, for one permit's screen. */
  async getNextAction(id: number): Promise<PermitNextAction> {
    const { data } = await apiClient.get(PERMIT_WORKFLOW.NEXT_ACTION(id));
    return data;
  },

  async active(): Promise<PermitListItem[]> {
    const { data } = await apiClient.get(PERMIT_WORKFLOW.ACTIVE);
    return data ?? [];
  },
  /**
   * Stage 05 -> 06. Work starts under the permit.
   *
   * An issued permit and one being worked under are different things: the first
   * is a granted authorisation, the second is live work relying on its controls
   * right now.
   */
  /**
   * Score the method statement against this permit, on the six-criterion rubric.
   *
   * This is what unblocks `gate_rams_linked`, and until now nothing in the app
   * could do it. The gate is satisfied by a Flow-B risk assessment or, failing
   * that, a RAMS score carrying this permit's id — and the only screen that
   * created a RAMS score scored a *contractor company* and never sent
   * `permit_id`, so it could not satisfy the gate for any permit ever raised.
   * With `risk_assessments` empty too, every permit stopped at approval with
   * "No approved risk assessment covers this work."
   *
   * 80+ passes the gate, 60-79 is conditional (amber, still approvable), under
   * 60 is a rejection the gate blocks on — which is the rubric doing its job,
   * not a failure to score.
   */
  async scoreRams(
    permitId: number,
    criteria: {
      hazard_identification: number;
      control_adequacy: number;
      competence_evidence: number;
      equipment_suitability: number;
      emergency_arrangements: number;
      supervision_arrangements: number;
    },
    taskDescription?: string,
  ): Promise<{ total_score: number; verdict: string }> {
    const { data } = await apiClient.post('/rams-scores', {
      permit_id: permitId,
      task_description: taskDescription,
      ...criteria,
    });
    return data;
  },

  async activate(id: number): Promise<PermitDetail> {
    const { data } = await apiClient.post(PERMIT_WORKFLOW.ACTIVATE(id), {});
    return data;
  },

  /**
   * Stage 06 -> 04. Work stops and the cause is established before anyone goes
   * back in. This is the permit's genuine investigate state.
   */
  async suspend(id: number, reason: string): Promise<PermitDetail> {
    const { data } = await apiClient.post(PERMIT_WORKFLOW.SUSPEND(id), { reason });
    return data;
  },

  /** Stage 04 -> 06. Cause established, work may restart. */
  async resume(id: number): Promise<PermitDetail> {
    const { data } = await apiClient.post(PERMIT_WORKFLOW.RESUME(id), {});
    return data;
  },

  /** Stage 06 -> 07. Work finished; the permit is spent and owes its lesson. */
  async completeWork(id: number): Promise<PermitDetail> {
    const { data } = await apiClient.post(PERMIT_WORKFLOW.COMPLETE_WORK(id), {});
    return data;
  },

  /**
   * Close-out at end of work. `deviation_reported` is required because it is the only
   * source for LOTO Compliance % and Permit Deviation Rate.
   *
   * There used to be a second, earlier `close(id, notes)` above this one. It was
   * unreachable — TypeScript takes the last declaration — so every call already
   * used this signature, and it was one of the repo's standing type errors.
   */
  async close(id: number, payload: {
    deviation_reported: 'Yes' | 'No';
    incident_occurred?: 'Yes' | 'No';
    work_start_actual?: string;
    work_end_actual?: string;
    supervisor_notes?: string;
  }): Promise<PermitDetail> {
    const { data } = await apiClient.post(PERMIT_WORKFLOW.CLOSE(id), payload);
    return data;
  },

  // ── Auditor ─────────────────────────────────────────────────────────────────
  async auditList(): Promise<PermitListItem[]> {
    const { data } = await apiClient.get(PERMIT_WORKFLOW.AUDIT_LIST);
    return data ?? [];
  },
  async verify(id: number, result: string, notes?: string): Promise<PermitDetail> {
    const { data } = await apiClient.post(PERMIT_WORKFLOW.VERIFY(id), {
      verification_result: result,
      verification_notes: notes,
    });
    return data;
  },

  // ── Shared ──────────────────────────────────────────────────────────────────
  async detail(id: number): Promise<PermitDetail> {
    const { data } = await apiClient.get(PERMIT_WORKFLOW.DETAIL(id));
    return data;
  },
  async stats() {
    const { data } = await apiClient.get(PERMIT_WORKFLOW.STATS);
    return data;
  },
};
