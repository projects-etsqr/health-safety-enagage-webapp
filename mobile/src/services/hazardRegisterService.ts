import { apiClient } from '../api/client';
import { HAZARD_REGISTER } from '../api/endpoints';
import type { StageInfo, WorkflowStageKey } from './workflowStages';

/**
 * The Hazard register workflow (flow 5), on the same eight stages as every
 * other safety event — see HSE_Workflow_Engine_Slide.pptx.
 *
 *   01 RECORD      log()                  → open
 *   02 ASSESS      assess()               → interim_control | under_review
 *   03 RESPOND     interimControl()       → interim_control
 *   04 INVESTIGATE startReview/findings() → under_review
 *   05 IMPROVE     planControls()         → controls_planned
 *                  submitForVerification()→ pending_verification
 *   06 VERIFY      verifyControls()       → controlled, or back to IMPROVE
 *   07 LEARN       captureLesson()        (stays controlled)
 *   08 CLOSE       close()                → closed
 *
 * Writes to the shared `hazards` register; the website's catalog reads are
 * untouched. `review()` is the older generic status setter — it still works but
 * records no stage ownership, so the verbs above are preferred.
 *
 * The stage never comes from this file. The backend derives it from
 * register_status and sends it down flat on every response, which is why
 * HazardRegisterItem carries the stage fields directly and `toStageInfo` in
 * ./workflowStages can normalise it alongside every other family.
 */

/** The register's own status vocabulary — one per stage from 02 onward. */
export type HazardRegisterStatus =
  | 'open'                  // 02 ASSESS
  | 'interim_control'       // 03 RESPOND
  | 'under_review'          // 04 INVESTIGATE
  | 'controls_planned'      // 05 IMPROVE
  | 'pending_verification'  // 06 VERIFY
  | 'controlled'            // 07 LEARN
  | 'closed';               // 08 CLOSE

/** Hierarchy of control, strongest first. PPE last, and it needs a reason. */
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

/** What each status is waiting for, for a list row that has no room for more. */
export const HAZARD_STATUS_LABEL: Record<string, string> = {
  open: 'Logged — needs assessment',
  interim_control: 'Interim control in place',
  under_review: 'Under review',
  controls_planned: 'Control planned — not yet verified',
  pending_verification: 'Awaiting verification',
  controlled: 'Controlled — lesson owed',
  closed: 'Closed',
};

export interface HazardRegisterItem {
  id: number;
  reference: string | null;
  hazard_name: string | null;
  category_id: number | null;
  description: string | null;
  severity: string | null;
  probability: string | null;
  /** The reporter's own scoring. `severity` and `probability` above are
   *  rewritten by stage 02, so these are the only record of what the person
   *  who found the hazard said. */
  reported_severity: string | null;
  reported_probability: string | null;
  /** What the reporter said is already protecting people. `controls` is
   *  overwritten by stage 05 with the planned measure. */
  existing_controls: string | null;
  /** Revised in place by stages 02 and 04, so frozen the same way. */
  reported_persons_exposed: number | null;
  register_status: HazardRegisterStatus | string | null;
  location_station_id: number | null;
  /** Where the worker said it is, when that matched no station on record. */
  location_other: string | null;
  /** The worker's "It is still there" answer. Null means they were not asked. */
  still_present: boolean | null;
  controls: string | null;
  logged_by: number | null;
  logged_at: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
  auditor_verified_by: number | null;
  auditor_verified_at: string | null;
  verification_notes: string | null;
  gps_latitude: string | null;
  gps_longitude: string | null;

  // 02 ASSESS
  assessed_priority: string | null;
  assessed_label: string | null;
  risk_score: number | null;
  assessed_by: number | null;
  assessed_at: string | null;
  response_due_at: string | null;

  // 03 RESPOND
  interim_control: string | null;
  interim_control_by: number | null;
  interim_control_at: string | null;
  work_stopped: number | null;

  // 04 INVESTIGATE
  review_started_at: string | null;
  root_cause: string | null;
  persons_exposed: number | null;

  // 05 IMPROVE
  planned_controls: string | null;
  control_hierarchy: ControlHierarchy | string | null;
  control_owner_id: number | null;
  control_due_date: string | null;
  controls_planned_by: number | null;
  controls_planned_at: string | null;

  // 06 VERIFY
  controls_verified_by: number | null;
  controls_verified_at: string | null;
  control_verification_notes: string | null;
  verification_failures: number | null;

  // 07 LEARN · 08 CLOSE
  lessons_learned: string | null;
  lesson_captured_by: number | null;
  lesson_captured_at: string | null;
  closure_notes: string | null;
  closed_by: number | null;
  closed_at: string | null;

  created_at: string | null;
  updated_at: string | null;
  /** Photos and video of the condition, as /uploads/ paths. */
  evidence: string[];

  // Derived server-side from register_status — flat shape, never stored.
  stage: WorkflowStageKey | null;
  stage_number: number | null;
  stage_label: string | null;
  completed_stages: string[];
  total_stages: number | null;

  // Resolved names, so a list row needs no lookup of its own.
  logged_by_name: string | null;
  reviewed_by_name: string | null;
  control_owner_name: string | null;
  assessed_by_name: string | null;
  interim_control_by_name: string | null;
  controls_planned_by_name: string | null;
  controls_verified_by_name: string | null;
  lesson_captured_by_name: string | null;
  closed_by_name: string | null;
  auditor_verified_by_name: string | null;
  station_name: string | null;
  category_name: string | null;
  is_overdue: boolean | null;
}

// ── Payloads, one per stage verb ────────────────────────────────────────────

export interface HazardLogPayload {
  hazard_name: string;
  category_id?: number;
  description?: string;
  severity?: string;
  probability?: string;
  location?: string;
  location_station_id?: number;
  controls?: string;
  persons_exposed?: number;
  gps_latitude?: string;
  gps_longitude?: string;
}

export interface HazardAssessPayload {
  severity?: string;
  probability?: string;
  persons_exposed?: number;
  /** True stops the job and routes the hazard to RESPOND rather than straight
   *  to the control review. */
  work_stopped?: boolean;
  assessment_notes?: string;
}

export interface HazardInterimControlPayload {
  interim_control: string;
  work_stopped?: boolean;
}

export interface HazardFindingsPayload {
  root_cause?: string;
  review_notes?: string;
  persons_exposed?: number;
}

export interface HazardPlanControlsPayload {
  planned_controls: string;
  control_hierarchy: ControlHierarchy;
  control_owner_id?: number;
  /** ISO date. */
  control_due_date?: string;
  /** Required by the backend when control_hierarchy is 'ppe'. */
  ppe_justification?: string;
}

export interface HazardVerifyControlsPayload {
  effective: boolean;
  verification_notes?: string;
}

export interface HazardClosePayload {
  closure_notes?: string;
  lessons_learned?: string;
}

export interface HazardReviewPayload {
  register_status?: HazardRegisterStatus;
  review_notes?: string;
  controls?: string;
  severity?: string;
}

/** One dot on the eight-stage tracker. */
export interface HazardTrackStage {
  number: number;
  key: WorkflowStageKey;
  label: string;
  short: string;
  state: 'done' | 'current' | 'pending';
}

/** Stage tracker + the one outstanding step, for a single hazard. */
export interface HazardNextAction {
  hazard_id: number;
  reference: string;
  register_status: string | null;
  stage: WorkflowStageKey | null;
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
  track: HazardTrackStage[];
}

/** A row on the "what is waiting on me" queue. */
export interface HazardQueueItem {
  family: 'hazard_register';
  id: number;
  reference: string;
  description: string;
  priority: string | null;
  severity_label: string | null;
  register_status: string | null;
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
  /** This user already did their part, whoever holds the step now. */
  handled_by_me?: boolean;
  due_at: string | null;
  is_overdue: boolean;
  work_stopped: boolean;
  station_name: string | null;
  waiting_since: string | null;
}

export interface HazardQueueResponse {
  count: number;
  items: HazardQueueItem[];
  mine_count: number;
}

export interface HazardRegisterStats {
  total: number;
  by_status: Record<string, number>;
  by_stage: Record<string, number>;
  by_priority: Record<string, number>;
  open: number;
  overdue: number;
}

export const hazardRegisterService = {
  // ── 01 RECORD ─────────────────────────────────────────────────────────────
  async log(payload: HazardLogPayload): Promise<HazardRegisterItem> {
    const { data } = await apiClient.post(HAZARD_REGISTER.LOG, payload);
    return data;
  },
  async myLogs(): Promise<HazardRegisterItem[]> {
    const { data } = await apiClient.get(HAZARD_REGISTER.MY_LOGS);
    return data ?? [];
  },
  async list(params?: {
    registerStatus?: string;
    stage?: WorkflowStageKey;
    openOnly?: boolean;
    q?: string;
    limit?: number;
  }): Promise<HazardRegisterItem[]> {
    const { data } = await apiClient.get(HAZARD_REGISTER.LIST, {
      params: {
        register_status: params?.registerStatus,
        stage: params?.stage,
        open_only: params?.openOnly,
        q: params?.q,
        limit: params?.limit,
      },
    });
    return data ?? [];
  },
  async get(id: number): Promise<HazardRegisterItem> {
    const { data } = await apiClient.get(HAZARD_REGISTER.DETAIL(id));
    return data;
  },

  // ── 02 ASSESS ─────────────────────────────────────────────────────────────
  async assess(id: number, payload: HazardAssessPayload): Promise<HazardRegisterItem> {
    const { data } = await apiClient.post(HAZARD_REGISTER.ASSESS(id), payload);
    return data;
  },

  // ── 03 RESPOND ────────────────────────────────────────────────────────────
  async interimControl(
    id: number,
    payload: HazardInterimControlPayload,
  ): Promise<HazardRegisterItem> {
    const { data } = await apiClient.post(HAZARD_REGISTER.INTERIM_CONTROL(id), payload);
    return data;
  },

  // ── 04 INVESTIGATE ────────────────────────────────────────────────────────
  async startReview(id: number, reviewNotes?: string): Promise<HazardRegisterItem> {
    const { data } = await apiClient.post(HAZARD_REGISTER.START_REVIEW(id), {
      review_notes: reviewNotes,
    });
    return data;
  },
  async recordFindings(id: number, payload: HazardFindingsPayload): Promise<HazardRegisterItem> {
    const { data } = await apiClient.post(HAZARD_REGISTER.FINDINGS(id), payload);
    return data;
  },

  // ── 05 IMPROVE ────────────────────────────────────────────────────────────
  async planControls(
    id: number,
    payload: HazardPlanControlsPayload,
  ): Promise<HazardRegisterItem> {
    const { data } = await apiClient.post(HAZARD_REGISTER.PLAN_CONTROLS(id), payload);
    return data;
  },
  async submitForVerification(
    id: number,
    implementationNotes?: string,
  ): Promise<HazardRegisterItem> {
    const { data } = await apiClient.post(HAZARD_REGISTER.SUBMIT_VERIFICATION(id), {
      implementation_notes: implementationNotes,
    });
    return data;
  },

  // ── 06 VERIFY ─────────────────────────────────────────────────────────────
  /**
   * `effective: false` is not a rejection of paperwork — it returns the hazard
   * to IMPROVE and counts the failure, because a control that did not hold
   * means the hazard is still live.
   */
  async verifyControls(
    id: number,
    payload: HazardVerifyControlsPayload,
  ): Promise<HazardRegisterItem> {
    const { data } = await apiClient.post(HAZARD_REGISTER.VERIFY_CONTROLS(id), payload);
    return data;
  },

  // ── 07 LEARN · 08 CLOSE ───────────────────────────────────────────────────
  async captureLesson(id: number, lessonsLearned: string): Promise<HazardRegisterItem> {
    const { data } = await apiClient.post(HAZARD_REGISTER.LESSON(id), {
      lessons_learned: lessonsLearned,
    });
    return data;
  },
  async close(id: number, payload?: HazardClosePayload): Promise<HazardRegisterItem> {
    const { data } = await apiClient.post(HAZARD_REGISTER.CLOSE(id), payload ?? {});
    return data;
  },

  // ── Queue and tracker ─────────────────────────────────────────────────────
  async getNextActions(mineOnly = true): Promise<HazardQueueResponse> {
    const { data } = await apiClient.get(HAZARD_REGISTER.NEXT_ACTIONS, {
      params: { mine_only: mineOnly },
    });
    return data ?? { count: 0, items: [], mine_count: 0 };
  },
  async getNextAction(id: number): Promise<HazardNextAction> {
    const { data } = await apiClient.get(HAZARD_REGISTER.NEXT_ACTION(id));
    return data;
  },

  // ── Pre-stage escape hatch ────────────────────────────────────────────────
  async review(id: number, payload: HazardReviewPayload): Promise<HazardRegisterItem> {
    const { data } = await apiClient.post(HAZARD_REGISTER.REVIEW(id), payload);
    return data;
  },

  // ── Auditor ───────────────────────────────────────────────────────────────
  async auditList(): Promise<HazardRegisterItem[]> {
    const { data } = await apiClient.get(HAZARD_REGISTER.AUDIT_LIST);
    return data ?? [];
  },
  async verify(id: number, notes?: string): Promise<HazardRegisterItem> {
    const { data } = await apiClient.post(HAZARD_REGISTER.VERIFY(id), {
      verification_notes: notes,
    });
    return data;
  },

  async stats(): Promise<HazardRegisterStats> {
    const { data } = await apiClient.get(HAZARD_REGISTER.STATS);
    return data;
  },
};

/** Convenience for screens that render the shared stage rail. */
export function hazardStageInfo(item: HazardRegisterItem | null): StageInfo | null {
  if (!item) return null;
  return {
    stage: item.stage,
    stage_number: item.stage_number,
    stage_label: item.stage_label,
    stage_description: null,
    total_stages: item.total_stages ?? 8,
    completed_stages: (item.completed_stages ?? []) as WorkflowStageKey[],
    is_closed: item.stage === 'CLOSE',
  };
}
