import { apiClient } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

// The stage vocabulary moved to ./workflowStages once five more families needed
// it. Re-exported so existing importers of this module keep working.
export {
  WORKFLOW_STAGES,
  type WorkflowStageKey,
  type StageInfo,
} from './workflowStages';

export interface ManagerVerifyPayload {
  effective: boolean;
  verification_notes?: string;
}

/**
 * "What do I do next" — one outstanding step on one incident.
 *
 * Resolved by the backend rather than by the screen, because the same answer
 * has to appear in two places (the dashboard queue and the incident header) and
 * two copies of a status→action table would drift apart the first time a
 * status was added.
 */
export interface NextActionItem {
  id: number;
  reference: string;
  description: string;
  priority: string | null;
  severity_label: string | null;
  workflow_status: string;
  stage: string | null;
  stage_number: number | null;
  stage_label: string | null;
  /** The step itself, e.g. "Sign off the outstanding corrective actions". */
  action: string;
  detail: string;
  /** Button label, e.g. "Sign off now". */
  cta: string;
  route: string;
  /** What clearing this step achieves, e.g. "Stage 06 VERIFY". */
  unblocks: string | null;
  owner_role: string;
  /** This step is this role's own job, not merely one they outrank. */
  is_mine: boolean;
  can_act: boolean;
  /** This user already did their part, whoever holds the step now. */
  handled_by_me?: boolean;
  /** The specific CAPA blocking an IMPROVE-stage incident, when there is one. */
  subject: {
    reference: string;
    description: string;
    due_date: string | null;
    open_count: number;
  } | null;
  is_hipo: boolean;
  is_recurring: boolean;
  statutory_reportable: boolean;
  is_overdue: boolean;
  due_at: string | null;
  waiting_since: string | null;
}

export interface NextActionsResponse {
  count: number;
  items: NextActionItem[];
  mine_count: number;
}

/** One dot on the eight-stage tracker. */
export interface TrackStage {
  number: number;
  key: string;
  label: string;
  short: string;
  state: 'done' | 'current' | 'pending';
}

export interface IncidentNextAction {
  incident_id: number;
  reference: string;
  workflow_status: string;
  stage: string | null;
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
  is_mine: boolean;
  track: TrackStage[];
}

export interface SupervisorInvestigatePayload {
  root_cause: string;
  five_why_analysis?: Array<{ why: string; answer: string }>;
  immediate_cause?: string;
  immediate_actions_taken?: string;
  root_cause_category?: string;
  severity_classification: string;
  days_away?: number;

  // WF-03 decision tree (Q2-Q4). The backend derives P1-P5, the investigation
  // SLA and statutory reportability from these — omit them and the incident
  // stays unclassified for its whole lifecycle.
  treatment_level?: 'none' | 'first_aid' | 'medical_treatment' | 'hospitalisation' | 'fatality';
  dangerous_occurrence?: boolean;
  worst_case_fatal?: boolean;
  occupational_disease?: boolean;
  loss_of_consciousness?: boolean;

  capa_description?: string;
  capa_responsible_person_id?: number;
  /** Omit to let the WF-04 rule set it from the CAPA type. */
  capa_due_date?: string;
  /** WF-04 matrix: 'low' | 'medium' | 'high' (or 1-3). */
  capa_severity_potential?: string;
  capa_systemic_risk?: string;
  capa_type?: string;

  escalate: boolean;
  escalation_reason?: string;
}

export interface ManagerApprovePayload {
  decision: 'approved' | 'rejected';
  notes?: string;
}

export interface ManagerClosePayload {
  closure_notes?: string;
  regulatory_notified?: string;
  lessons_learned?: string;
  communicated_to_teams?: string;
}

export const incidentWorkflowService = {
  async acknowledge(incidentId: string): Promise<any> {
    const { data } = await apiClient.post(ENDPOINTS.INCIDENT_WORKFLOW.ACKNOWLEDGE(incidentId), {});
    return data;
  },

  /**
   * Stage 03 -> 04. Opens the investigation before there are any findings, so
   * the incident is visibly *in* INVESTIGATE while the work happens rather than
   * appearing to jump from RESPOND to a finished RCA.
   */
  async startInvestigation(incidentId: string): Promise<any> {
    const { data } = await apiClient.post(ENDPOINTS.INCIDENT_WORKFLOW.START_INVESTIGATION(incidentId), {});
    return data;
  },

  async investigate(incidentId: string, payload: SupervisorInvestigatePayload): Promise<any> {
    const { data } = await apiClient.post(ENDPOINTS.INCIDENT_WORKFLOW.INVESTIGATE(incidentId), payload);
    return data;
  },

  async escalate(incidentId: string, reason: string, managerId?: number): Promise<any> {
    const { data } = await apiClient.post(ENDPOINTS.INCIDENT_WORKFLOW.ESCALATE(incidentId), {
      escalation_reason: reason,
      escalated_to_manager_id: managerId,
    });
    return data;
  },

  async getManagerQueue(): Promise<any[]> {
    const { data } = await apiClient.get(ENDPOINTS.INCIDENT_WORKFLOW.MANAGER_QUEUE);
    return data;
  },

  async approveInvestigation(incidentId: string, payload: ManagerApprovePayload): Promise<any> {
    const { data } = await apiClient.post(ENDPOINTS.INCIDENT_WORKFLOW.APPROVE(incidentId), payload);
    return data;
  },

  /**
   * Stage 06 VERIFY. `effective: false` is not a rejection of paperwork — it
   * sends the incident back to IMPROVE and reopens its corrective actions,
   * because a fix that did not hold means the hazard is still live.
   */
  async verifyEffectiveness(incidentId: string, payload: ManagerVerifyPayload): Promise<any> {
    const { data } = await apiClient.post(
      ENDPOINTS.INCIDENT_WORKFLOW.VERIFY_EFFECTIVENESS(incidentId),
      payload,
    );
    return data;
  },

  async close(incidentId: string, payload: ManagerClosePayload): Promise<any> {
    const { data } = await apiClient.post(ENDPOINTS.INCIDENT_WORKFLOW.CLOSE(incidentId), payload);
    return data;
  },

  async getDetail(incidentId: string): Promise<any> {
    const { data } = await apiClient.get(ENDPOINTS.INCIDENT_WORKFLOW.DETAIL(incidentId));
    return data;
  },

  /**
   * Who a corrective action can be assigned to — supervisors, not workers.
   * `/assigned-tasks/assignable-workers` lists only `operator` logins and is
   * for handing a worker a task, which is a different thing from owning a CAPA.
   */
  async getCapaAssignableOwners(): Promise<CapaOwner[]> {
    const { data } = await apiClient.get(ENDPOINTS.INCIDENT_WORKFLOW.CAPA_ASSIGNABLE_OWNERS);
    return Array.isArray(data) ? data : [];
  },

  async getMyCapaActions(): Promise<CapaAction[]> {
    const { data } = await apiClient.get(ENDPOINTS.INCIDENT_WORKFLOW.CAPA_MY_ACTIONS);
    return data ?? [];
  },

  async completeCapaAction(capaId: number, effectivenessRating?: number): Promise<CapaAction> {
    const { data } = await apiClient.post(ENDPOINTS.INCIDENT_WORKFLOW.CAPA_COMPLETE(capaId), {
      effectiveness_rating: effectivenessRating,
    });
    return data;
  },

  /** Every open incident waiting on this user, with the exact step it needs. */
  async getNextActions(mineOnly = true): Promise<NextActionsResponse> {
    const { data } = await apiClient.get(ENDPOINTS.INCIDENT_WORKFLOW.NEXT_ACTIONS, {
      params: { mine_only: mineOnly },
    });
    return data ?? { count: 0, items: [], mine_count: 0 };
  },

  /** Stage tracker + outstanding step for one incident. */
  async getNextAction(incidentId: number | string): Promise<IncidentNextAction> {
    const { data } = await apiClient.get(ENDPOINTS.INCIDENT_WORKFLOW.NEXT_ACTION(incidentId));
    return data;
  },
};

/** A supervisor who can be made accountable for a corrective action. */
export interface CapaOwner {
  employee_id: number;
  name: string;
  department: string;
  role: string;
}

export interface CapaAction {
  id: number;
  responsible_person_name?: string | null;
  priority_band?: string | null;
  incident_id: number | null;
  action_type: string | null;
  description: string | null;
  responsible_person_id: number | null;
  due_date: string | null;
  status: string | null;
}
