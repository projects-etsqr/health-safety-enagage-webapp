import { apiClient } from '../api/client';
import { reportWorkflowEndpoints, type ReportType } from '../api/endpoints';
import type { WorkflowStageKey } from './workflowStages';

/**
 * Drives the Worker→Supervisor→Manager workflow for any report type.
 *
 * The backend builds the four routers from one factory, so every type exposes the
 * identical verbs. Mirroring that with a single service keeps the supervisor screens
 * from triplicating logic — `incidentWorkflowService` stays as-is because incidents
 * carry extra investigation fields (CAPA, days away) the other three do not.
 */

/** One row in a supervisor or manager queue. */
export interface ReportListItem {
  id: number;
  report_type: ReportType;
  workflow_status: string | null;
  severity: string | null;
  description: string | null;
  location_station_id: number | null;
  reported_by: number | null;
  reported_at: string | null;
  acknowledged_at: string | null;
  created_at: string | null;

  // Stage 02 ASSESS. Queues rank on the assessed priority, not on the
  // reporter's severity guess.
  assessed_priority: string | null;
  is_hipo: boolean | null;
  response_due_at: string | null;

  // Enough to draw the eight-stage rail on a card without opening the record.
  // The API has sent these since the factory learned the stages; they were
  // simply missing from this type, so every screen reading a queue row had to
  // cast to `any` to render a rail.
  stage: WorkflowStageKey | null;
  stage_number: number | null;
  stage_label: string | null;
  completed_stages: WorkflowStageKey[];
  total_stages: number | null;
}

export interface ReportDetail extends ReportListItem {
  /** Resolved names — the list rows carry only the ids these came from. */
  reported_by_name: string | null;
  station_name: string | null;
  witnesses: Array<{ name?: string; employee_id?: number } | string>;
  /** When the event happened, as opposed to when it was reported. */
  observed_at: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  /** Photos and videos the reporter attached, as /uploads/ paths. */
  evidence: string[];
  hazard_still_present: string | null;
  report_date: string | null;
  created_at: string | null;
  updated_at: string | null;

  /** The reviewers' own work, beyond root_cause and closure_notes. */
  /** Dict from the investigate form, bare list on older rows. */
  five_why_analysis: any;
  lessons_learned: string | null;
  supervisor_signature: string | null;
  manager_signature: string | null;
  investigation_started_at: string | null;
  assessed_at: string | null;
  capa_verified_at: string | null;
  capa_verification_notes: string | null;
  capa_verification_failures: number | null;
  assigned_supervisor_name: string | null;
  escalated_to_manager_name: string | null;
  capa_verified_by_name: string | null;
  auditor_verified_by_name: string | null;
  root_cause: string | null;
  immediate_actions_taken: string | null;
  escalation_reason: string | null;
  closure_notes: string | null;
  investigation_completed_at: string | null;
  escalated_at: string | null;
  approved_at: string | null;
  closed_at: string | null;
  assessed_label: string | null;
  assessment_trace: string | null;
  requires_systemic_rca: boolean | null;
  min_investigator: string | null;
  /** Type-specific columns — near misses carry potential_consequence etc. */
  details: Record<string, any>;
}

export interface InvestigatePayload {
  root_cause?: string;
  immediate_actions_taken?: string;
  five_why_analysis?: Record<string, any>;
  supervisor_signature?: string;
  /** Raising this to high/critical routes straight to the manager. */
  severity?: string;

  // ── Stage 05 IMPROVE ────────────────────────────────────────────────────────
  // The corrective action raised off the investigation. Without one there is
  // nothing to improve and nothing whose effectiveness could be confirmed, and
  // the record skips 05 and 06 entirely — which is why the form asks for it
  // here rather than leaving it to a separate CAPA screen.
  capa_description?: string;
  capa_responsible_person_id?: number;
  capa_due_date?: string;
  capa_severity_potential?: string;
  capa_systemic_risk?: string;
  capa_type?: string;
}

/**
 * The eight-stage tracker plus the one outstanding step, for a single record.
 *
 * Identical in shape to the incident and hazard-register equivalents, so
 * The stage fields are still returned and still correct; no mobile screen
 * currently draws them — see the note on WorkflowStageBar.
 */
export interface TrackStage {
  number: number;
  key: WorkflowStageKey;
  label: string;
  short: string;
  state: 'done' | 'current' | 'pending';
}

export interface ReportNextAction {
  family: ReportType;
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
  track: TrackStage[];
}

/** One row of "what is waiting on me". */
export interface ReportNextActionItem {
  family: ReportType;
  id: number;
  reference: string;
  description: string;
  priority: string | null;
  severity_label: string | null;
  /** The reporter's severity, for pre-selecting the investigation form. */
  severity: string | null;
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
  /**
   * This user already did their part, whoever holds the step now.
   *
   * Without it a record left the supervisor's list the moment they finished
   * with it — the step moved on, `is_mine` went false, and their own work
   * looked like it had vanished. Stamped from `assigned_supervisor_id`, which
   * the first transition sets and nothing overwrites.
   */
  handled_by_me?: boolean;
  /** The corrective action holding an IMPROVE row, when there is one. */
  subject: {
    id: number;
    reference: string;
    description: string;
    due_date: string | null;
    open_count: number;
    /** Who holds the action. Null means nobody has been named yet. */
    responsible_person_id: number | null;
    responsible_person_name: string | null;
  } | null;
  is_hipo: boolean;
  is_recurring: boolean;
  is_overdue: boolean;
  due_at: string | null;
  station_name: string | null;
  waiting_since: string | null;
}

/** Somebody a corrective action can be made accountable to. */
export interface CapaOwner {
  employee_id: number;
  name: string;
  department: string;
  role: string;
}

export interface ReportNextActionQueue {
  count: number;
  items: ReportNextActionItem[];
  mine_count: number;
}

export interface ClosePayload {
  closure_notes?: string;
  lessons_learned?: string;
  manager_signature?: string;
}

export interface WorkflowStats {
  report_type: ReportType;
  total: number;
  by_status: Record<string, number>;
  pending_supervisor: number;
  pending_manager: number;
}

export function reportWorkflowService(type: ReportType) {
  const E = reportWorkflowEndpoints(type);

  return {
    // ── Supervisor ────────────────────────────────────────────────────────────
    async getPendingReview(): Promise<ReportListItem[]> {
      const { data } = await apiClient.get(E.PENDING_REVIEW);
      return data ?? [];
    },

    async acknowledge(id: number, notes?: string): Promise<ReportDetail> {
      const { data } = await apiClient.post(E.ACKNOWLEDGE(id), { notes });
      return data;
    },

    /**
     * Stage 03 -> 04. Opens the investigation before any findings exist, so the
     * record sits visibly in INVESTIGATE while the work happens rather than
     * jumping from RESPOND straight to a finished RCA.
     */
    async startInvestigation(id: number): Promise<ReportDetail> {
      const { data } = await apiClient.post(E.START_INVESTIGATION(id), {});
      return data;
    },

    async investigate(id: number, payload: InvestigatePayload): Promise<ReportDetail> {
      const { data } = await apiClient.post(E.INVESTIGATE(id), payload);
      return data;
    },

    async escalate(id: number, reason: string, managerId?: number): Promise<ReportDetail> {
      const { data } = await apiClient.post(E.ESCALATE(id), {
        escalation_reason: reason,
        escalated_to_manager_id: managerId,
      });
      return data;
    },

    // ── Manager ───────────────────────────────────────────────────────────────
    async getManagerQueue(): Promise<ReportListItem[]> {
      const { data } = await apiClient.get(E.MANAGER_QUEUE);
      return data ?? [];
    },

    async approveInvestigation(id: number, approved = true, notes?: string): Promise<ReportDetail> {
      const { data } = await apiClient.post(E.APPROVE(id), { approved, notes });
      return data;
    },

    /**
     * Stage 06 VERIFY. `effective: false` returns the record to IMPROVE and
     * reopens its corrective actions — a control that did not hold means the
     * hazard is still live.
     */
    async verifyEffectiveness(
      id: number,
      effective: boolean,
      verificationNotes?: string,
    ): Promise<ReportDetail> {
      const { data } = await apiClient.post(E.VERIFY_EFFECTIVENESS(id), {
        effective,
        verification_notes: verificationNotes,
      });
      return data;
    },

    async close(id: number, payload: ClosePayload): Promise<ReportDetail> {
      const { data } = await apiClient.post(E.CLOSE(id), payload);
      return data;
    },

    /**
     * Who the corrective action can be assigned to. Fetched by the
     * investigation form: an action raised with no owner reaches nobody's task
     * list, so IMPROVE has nobody accountable for it.
     */
    /**
     * Who a corrective action can be handed to.
     *
     * `includeWorkers` widens past the supervisors and safety managers to the
     * whole workforce. A manager looking at a risk observation often knows the
     * fitter who is going to change the guard, and the lifecycle has always
     * allowed a worker to own an action — only the picker was narrow.
     */
    async getCapaOwners(includeWorkers = false): Promise<CapaOwner[]> {
      // The WF-04 route, not the family's own: this is the one that takes the
      // parameter, and it is the same query underneath either way.
      const { data } = await apiClient.get('/capa/assignable-owners', {
        params: includeWorkers ? { include_workers: true } : undefined,
      });
      return data ?? [];
    },

    /** Step 05 · name the person who will do it. */
    async assignCapa(capaId: number, responsiblePersonId: number): Promise<void> {
      await apiClient.post(`/capa/${capaId}/assign`, {
        responsible_person_id: responsiblePersonId,
      });
    },

    /**
     * Stage 05 IMPROVE — mark one corrective action done.
     *
     * The record only leaves IMPROVE when its *last* action closes, which the
     * backend checks; this returns what the record advanced to, if anything.
     */
    async completeCapa(capaId: number, effectivenessRating?: number) {
      const { data } = await apiClient.post(E.CAPA_COMPLETE(capaId), {
        effectiveness_rating: effectivenessRating,
      });
      return data as { subject_advanced_to?: string | null };
    },

    // ── Shared ────────────────────────────────────────────────────────────────
    /**
     * The whole lifecycle, closed records included, optionally one stage at a
     * time. The two queues only ever show what is still waiting on somebody, so
     * this is the only way to look back at what was closed.
     */
    async getAll(opts: { stage?: string; includeClosed?: boolean; limit?: number } = {}) {
      const { data } = await apiClient.get(E.ALL, {
        params: {
          stage: opts.stage,
          include_closed: opts.includeClosed ?? true,
          limit: opts.limit ?? 100,
        },
      });
      return (data ?? []) as ReportListItem[];
    },

    /**
     * Every open record of this type waiting on this user, with the exact step.
     *
     * `mineOnly` false returns steps this role merely outranks as well, each
     * flagged `is_mine: false` — which is what lets a screen say "waiting on the
     * manager" rather than showing an empty list.
     */
    async getNextActions(mineOnly = true, limit = 50): Promise<ReportNextActionQueue> {
      const { data } = await apiClient.get(E.NEXT_ACTIONS, {
        params: { mine_only: mineOnly, limit },
      });
      return data ?? { count: 0, items: [], mine_count: 0 };
    },

    /** Stage tracker + the one outstanding step, for one record's screen. */
    async getNextAction(id: number): Promise<ReportNextAction> {
      const { data } = await apiClient.get(E.NEXT_ACTION(id));
      return data;
    },

    async getStats(): Promise<WorkflowStats> {
      const { data } = await apiClient.get(E.STATS);
      return data;
    },

    async getDetail(id: number): Promise<ReportDetail> {
      const { data } = await apiClient.get(E.DETAIL(id));
      return data;
    },
  };
}
