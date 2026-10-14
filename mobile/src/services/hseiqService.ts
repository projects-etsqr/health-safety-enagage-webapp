/**
 * WF-06 … WF-09 API surface — the workflows added from HSE_Mobile_Architecture_v4.
 *
 * One module, shared by all four role apps, because the same endpoints back
 * different screens per role and the backend decides what each token may see.
 * The mobile app never asks for a wider scope than its role: RBAC is enforced
 * server-side, and a 403 here means the spec's interaction matrix is working.
 *
 * Note the apiClient response interceptor unwraps { success, data }, so these
 * read `res.data` and never `res.data.data`.
 */
import { apiClient } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────
export type GateVerdict = 'pass' | 'amber' | 'block';

export interface GateResult {
  gate_key: string;
  verdict: GateVerdict;
  reason: string;
  details: Record<string, any>;
  hard: boolean;
}

export interface GateEvaluation {
  overall: GateVerdict;
  blocked_reasons: string[];
  gates: GateResult[];
}

export interface CompetenceCardItem {
  requirement_name: string;
  competence_matrix_id?: number;
  is_safety_critical: boolean;
  status: 'valid' | 'expiring' | 'expired' | 'missing';
  expires_at?: string | null;
  days_to_expiry?: number | null;
  blocks_permit: boolean;
}

export interface CompetenceCard {
  employee_id: number;
  employee_name?: string;
  items: CompetenceCardItem[];
  valid_count: number;
  expiring_count: number;
  expired_count: number;
  missing_count: number;
  blocked_tasks: string[];
  is_new_worker: boolean;
}

export interface TeamMatrixRow {
  employee_id: number;
  employee_name?: string;
  valid_count: number;
  expiring_count: number;
  expired_count: number;
  missing_count: number;
  is_blocked: boolean;
  buddy_required: boolean;
}

export interface FatigueIndex {
  fatigue_index: number;
  band: 'acceptable' | 'amber' | 'signoff' | 'block';
  shift_component: number;
  consecutive_component: number;
  night_component: number;
  requires_supervisor_ack: boolean;
  requires_signoff: boolean;
  is_hard_block: boolean;
  explanation: string;
}

export interface FatigueDeclaration extends FatigueIndex {
  id: number;
  employee_id: number;
  declared_at?: string;
  shift_hours: number;
  consecutive_days: number;
  night_shifts_7d: number;
  supervisor_ack_at?: string | null;
  supervisor_signoff_at?: string | null;
  exception_at?: string | null;
  exception_reason?: string | null;
}

export interface ContractorCompany {
  id: number;
  company_name: string;
  prequalification_status: 'approved' | 'conditional' | 'barred' | 'pending';
  ltifr_3yr?: number | null;
  insurance_expiry?: string | null;
  suspended: number;
  suspended_reason?: string | null;
}

export interface RamsScore {
  id: number;
  contractor_company_id?: number | null;
  permit_id?: number | null;
  task_description?: string | null;
  hazard_identification: number;
  control_adequacy: number;
  competence_evidence: number;
  equipment_suitability: number;
  emergency_arrangements: number;
  supervision_arrangements: number;
  total_score: number;
  verdict: 'reject' | 'conditional' | 'approve';
  auditor_total_score?: number | null;
  auditor_notes?: string | null;
}

export interface JourneyPlan {
  id: number;
  employee_id: number;
  vehicle_id?: number | null;
  origin?: string | null;
  destination?: string | null;
  transport_mode: 'road' | 'rail' | 'marine' | 'air';
  route_score: number;
  mode_score: number;
  cargo_score: number;
  journey_risk_score: number;
  risk_band: 'low' | 'medium' | 'high';
  status: string;
  requires_authorisation: number;
  authorised_at?: string | null;
  checkin_interval_minutes: number;
  pretrip_completed_at?: string | null;
}

export interface CheckInMonitorRow {
  journey_plan_id: number;
  employee_id: number;
  employee_name?: string;
  destination?: string | null;
  risk_band: string;
  status: string;
  next_due_at?: string | null;
  minutes_overdue?: number | null;
  missed_count: number;
  is_escalated: boolean;
}

export interface Vehicle {
  id: number;
  registration: string;
  qr_code?: string | null;
  vehicle_type?: string | null;
  defect_status: 'none' | 'minor' | 'major' | 'grounded';
  roadworthiness_expiry?: string | null;
}

export interface SpsScore {
  scope: string;
  period_start: string;
  period_end: string;
  sps: number;
  band: 'critical' | 'high' | 'elevated' | 'acceptable' | 'low';
  domains: {
    hazard_exposure: number;
    control_integrity: number;
    work_discipline: number;
    human_readiness: number;
    org_health: number;
  };
  weights: Record<string, number>;
  stale_data_penalty: number;
  data_completeness: number;
  explanation: string;
  previous_sps?: number | null;
  delta?: number | null;
}

export interface SpsAlert {
  id: number;
  alert_type: 'delta' | 'band_change' | 'kpi_redline';
  delta?: number | null;
  previous_band?: string | null;
  new_band?: string | null;
  severity?: string | null;
  message?: string | null;
  suggested_capa?: Array<{ action: string; control_type?: string; due_days?: number }>;
  acknowledged_at?: string | null;
}

export interface MySafetyScore {
  employee_id: number;
  human_readiness: number;
  band: string;
  open_competence_gaps: number;
  safety_critical_gaps: number;
  latest_fatigue_index?: number | null;
  latest_fatigue_band?: string | null;
  blocked_tasks: string[];
  guidance: string;
}

export interface OverrideRecord {
  id: number;
  gate_key?: string | null;
  decision: 'accept' | 'amend' | 'reject';
  reason: string;
  context?: string | null;
  outcome?: string | null;
  original_verdict?: string | null;
  resulting_verdict?: string | null;
  overridden_by_role?: string | null;
  overridden_at?: string | null;
}

export interface Pirs {
  horizon_7d: number;
  horizon_30d: number;
  horizon_90d: number;
  band: string;
  domains: Array<{ name: string; score: number; weight: number; driver: string }>;
  top_drivers: string[];
  confidence: number;
  advisory_note: string;
}

// ── WF-06 · Competence ────────────────────────────────────────────────────────
export const competenceService = {
  async myCard(): Promise<CompetenceCard> {
    const res = await apiClient.get('/competence-matrix/my-card');
    return res.data;
  },
  async cardFor(employeeId: number): Promise<CompetenceCard> {
    const res = await apiClient.get(`/competence-matrix/card/${employeeId}`);
    return res.data;
  },
  async teamMatrix(): Promise<TeamMatrixRow[]> {
    const res = await apiClient.get('/competence-matrix/team');
    return res.data ?? [];
  },
  async matrix(): Promise<any[]> {
    const res = await apiClient.get('/competence-matrix');
    return res.data ?? [];
  },
  async createRequirement(body: any) {
    const res = await apiClient.post('/competence-matrix', body);
    return res.data;
  },
  async certificationTypes(): Promise<any[]> {
    const res = await apiClient.get('/competence-matrix/certification-types');
    return res.data ?? [];
  },
  async assignBuddy(employeeId: number, buddyEmployeeId: number) {
    const res = await apiClient.post('/competence-matrix/assign-buddy', {
      employee_id: employeeId,
      buddy_employee_id: buddyEmployeeId,
    });
    return res.data;
  },
  async recomputeGaps() {
    const res = await apiClient.post('/competence-matrix/recompute-gaps');
    return res.data;
  },
  async effectiveness(months = 12) {
    const res = await apiClient.get(`/competence-matrix/effectiveness?months=${months}`);
    return res.data;
  },
  async auditList(onlyExpired = true): Promise<TeamMatrixRow[]> {
    const res = await apiClient.get(`/competence-matrix/audit-list?only_expired=${onlyExpired}`);
    return res.data ?? [];
  },
  async myTraining(): Promise<any[]> {
    const res = await apiClient.get('/training-records/mine');
    return res.data ?? [];
  },
  async logTraining(body: any) {
    const res = await apiClient.post('/training-records', body);
    return res.data;
  },
  async verifyTraining(id: number) {
    const res = await apiClient.post(`/training-records/${id}/verify`, { verified: true });
    return res.data;
  },
  async toolboxAck(id: number) {
    const res = await apiClient.post(`/training-records/${id}/toolbox-ack`);
    return res.data;
  },
};

// ── WF-06 · Fatigue ───────────────────────────────────────────────────────────
export const fatigueService = {
  /** Live index shown before a permit request. Nothing is stored. */
  async index(shiftHours: number, consecutiveDays: number, nightShifts7d: number): Promise<FatigueIndex> {
    const res = await apiClient.get(
      `/fatigue/index?shift_hours=${shiftHours}&consecutive_days=${consecutiveDays}&night_shifts_7d=${nightShifts7d}`,
    );
    return res.data;
  },
  async declare(body: {
    shift_hours: number;
    consecutive_days: number;
    night_shifts_7d: number;
    task_intensity?: string;
  }): Promise<FatigueDeclaration> {
    const res = await apiClient.post('/fatigue/declare', body);
    return res.data;
  },
  async mine(): Promise<FatigueDeclaration[]> {
    const res = await apiClient.get('/fatigue/mine');
    return res.data ?? [];
  },
  async team(days = 1, band?: string): Promise<FatigueDeclaration[]> {
    const q = band ? `?days=${days}&band=${band}` : `?days=${days}`;
    const res = await apiClient.get(`/fatigue/team${q}`);
    return res.data ?? [];
  },
  async acknowledge(id: number, note?: string) {
    const res = await apiClient.post(`/fatigue/${id}/acknowledge`, { note });
    return res.data;
  },
  async signOff(id: number, note: string) {
    const res = await apiClient.post(`/fatigue/${id}/sign-off`, { note });
    return res.data;
  },
  /** Safety Manager only — the sole route past a >=20 hard block. */
  async exception(id: number, reason: string) {
    const res = await apiClient.post(`/fatigue/${id}/exception`, { reason });
    return res.data;
  },
  async auditList(days = 30): Promise<FatigueDeclaration[]> {
    const res = await apiClient.get(`/fatigue/audit-list?days=${days}`);
    return res.data ?? [];
  },
};

// ── Gate engine ───────────────────────────────────────────────────────────────
export const gateService = {
  async permitCheck(permitId: number, employeeIds?: number[]): Promise<GateEvaluation> {
    const res = await apiClient.post('/gates/permit-check', {
      permit_id: permitId,
      employee_ids: employeeIds,
    });
    return res.data;
  },
  async journeyCheck(journeyPlanId: number, weather?: Record<string, any>): Promise<GateEvaluation> {
    const res = await apiClient.post('/gates/journey-check', {
      journey_plan_id: journeyPlanId,
      weather,
    });
    return res.data;
  },
  /**
   * D4 core feature. Reason is mandatory and the backend refuses outright on a
   * hard block — an expired safety-critical cert or a fatigue index >= 20.
   */
  async override(body: {
    gate_decision_id?: number;
    subject_type?: string;
    subject_id?: number;
    gate_key?: string;
    decision: 'accept' | 'amend' | 'reject';
    reason: string;
    context?: string;
    outcome?: string;
    resulting_verdict?: string;
  }) {
    const res = await apiClient.post('/gates/override', body);
    return res.data;
  },
  async log(params?: { subject_type?: string; subject_id?: number; verdict?: string }) {
    const q = new URLSearchParams();
    if (params?.subject_type) q.append('subject_type', params.subject_type);
    if (params?.subject_id) q.append('subject_id', String(params.subject_id));
    if (params?.verdict) q.append('verdict', params.verdict);
    const res = await apiClient.get(`/gates/log${q.toString() ? `?${q}` : ''}`);
    return res.data ?? [];
  },
  async overrides(): Promise<OverrideRecord[]> {
    const res = await apiClient.get('/gates/overrides');
    return res.data ?? [];
  },
};

// ── WF-08 · Contractor ────────────────────────────────────────────────────────
export const contractorService = {
  async list(status?: string): Promise<ContractorCompany[]> {
    const res = await apiClient.get(`/contractors${status ? `?status=${status}` : ''}`);
    return res.data ?? [];
  },
  async get(id: number): Promise<ContractorCompany> {
    const res = await apiClient.get(`/contractors/${id}`);
    return res.data;
  },
  async create(body: any) {
    const res = await apiClient.post('/contractors', body);
    return res.data;
  },
  async prequalify(id: number, body: any = {}) {
    const res = await apiClient.post(`/contractors/${id}/prequalify`, body);
    return res.data;
  },
  async suspend(id: number, suspended: boolean, reason?: string) {
    const res = await apiClient.post(`/contractors/${id}/suspend`, { suspended, reason });
    return res.data;
  },
  async workers(companyId: number) {
    const res = await apiClient.get(`/contractors/${companyId}/workers`);
    return res.data ?? [];
  },
  async workerByBadge(badge: string) {
    const res = await apiClient.get(`/contractors/workers/by-badge/${encodeURIComponent(badge)}`);
    return res.data;
  },
  async setSiteAccess(workerId: number, status: 'granted' | 'revoked' | 'pending', toolbox = false) {
    const res = await apiClient.post(`/contractors/workers/${workerId}/access`, {
      site_access_status: status,
      toolbox_completed: toolbox,
    });
    return res.data;
  },
  async scorecards() {
    const res = await apiClient.get('/contractors/scorecards/list');
    return res.data ?? [];
  },
  async computeScorecards() {
    const res = await apiClient.post('/contractors/scorecards/compute');
    return res.data ?? [];
  },
  async scoreRams(body: any): Promise<RamsScore> {
    const res = await apiClient.post('/rams-scores', body);
    return res.data;
  },
  async ramsList(params?: { contractor_company_id?: number; permit_id?: number }): Promise<RamsScore[]> {
    const q = new URLSearchParams();
    if (params?.contractor_company_id) q.append('contractor_company_id', String(params.contractor_company_id));
    if (params?.permit_id) q.append('permit_id', String(params.permit_id));
    const res = await apiClient.get(`/rams-scores${q.toString() ? `?${q}` : ''}`);
    return res.data ?? [];
  },
  /** Auditor only — independent re-score against the same rubric. */
  async rescoreRams(id: number, body: any) {
    const res = await apiClient.post(`/rams-scores/${id}/rescore`, body);
    return res.data;
  },
};

// ── WF-09 · Transport ─────────────────────────────────────────────────────────
export const transportService = {
  async vehicles(): Promise<Vehicle[]> {
    const res = await apiClient.get('/vehicles');
    return res.data ?? [];
  },
  async vehicleByQr(code: string): Promise<Vehicle> {
    const res = await apiClient.get(`/vehicles/by-qr/${encodeURIComponent(code)}`);
    return res.data;
  },
  async inspectVehicle(id: number, defectStatus: string, notes?: string) {
    const res = await apiClient.post(`/vehicles/${id}/inspect`, {
      defect_status: defectStatus,
      defect_notes: notes,
    });
    return res.data;
  },
  async createJourney(body: any): Promise<JourneyPlan> {
    const res = await apiClient.post('/journey-plans', body);
    return res.data;
  },
  async myJourneys(): Promise<JourneyPlan[]> {
    const res = await apiClient.get('/journey-plans/mine');
    return res.data ?? [];
  },
  async pendingAuthorisation(): Promise<JourneyPlan[]> {
    const res = await apiClient.get('/journey-plans/pending-authorisation');
    return res.data ?? [];
  },
  async authorise(id: number, body: any = { approved: true }) {
    const res = await apiClient.post(`/journey-plans/${id}/authorise`, body);
    return res.data;
  },
  async preTrip(id: number, body: any) {
    const res = await apiClient.post(`/journey-plans/${id}/pre-trip`, body);
    return res.data;
  },
  /** Runs the departure gates. A block leaves the journey where it is. */
  async depart(id: number): Promise<GateEvaluation> {
    const res = await apiClient.post(`/journey-plans/${id}/depart`);
    return res.data;
  },
  async checkIn(id: number, body: any) {
    const res = await apiClient.post(`/journey-plans/${id}/check-in`, body);
    return res.data;
  },
  async arrive(id: number) {
    const res = await apiClient.post(`/journey-plans/${id}/arrive`);
    return res.data;
  },
  async checkIns(id: number) {
    const res = await apiClient.get(`/journey-plans/${id}/check-ins`);
    return res.data ?? [];
  },
  async monitor(): Promise<CheckInMonitorRow[]> {
    const res = await apiClient.get('/journey-plans/monitor');
    return res.data ?? [];
  },
  async kpis(days = 30) {
    const res = await apiClient.get(`/journey-plans/kpis?days=${days}`);
    return res.data;
  },
  async auditList(days = 30): Promise<JourneyPlan[]> {
    const res = await apiClient.get(`/journey-plans/audit-list?days=${days}`);
    return res.data ?? [];
  },
};

// ── WF-07 · Safety Performance Score ──────────────────────────────────────────
export const spsService = {
  async score(): Promise<SpsScore> {
    const res = await apiClient.get('/sps/score');
    return res.data;
  },
  async team(): Promise<SpsScore> {
    const res = await apiClient.get('/sps/team');
    return res.data;
  },
  async mine(): Promise<MySafetyScore> {
    const res = await apiClient.get('/sps/my-score');
    return res.data;
  },
  async compute() {
    const res = await apiClient.post('/sps/compute');
    return res.data;
  },
  async history(limit = 26) {
    const res = await apiClient.get(`/sps/history?limit=${limit}`);
    return res.data ?? [];
  },
  async alerts(unacknowledgedOnly = true): Promise<SpsAlert[]> {
    const res = await apiClient.get(`/sps/alerts?unacknowledged_only=${unacknowledgedOnly}`);
    return res.data ?? [];
  },
  async ackAlert(id: number, body: any = {}) {
    const res = await apiClient.post(`/sps/alerts/${id}/ack`, body);
    return res.data;
  },
  async dataQuality() {
    const res = await apiClient.get('/sps/data-quality');
    return res.data;
  },
};

// ── MOC-Lite · Change & Drift Log (C8) ────────────────────────────────────────
export interface ChangeEvent {
  id: number;
  change_type: 'procedure_update' | 'equipment_mod' | 'staffing_change' | 'temporary_arrangement';
  title: string;
  description?: string | null;
  risk_spike_score?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
  status: string;
  reviewed_at?: string | null;
  created_at?: string | null;
}

export const changeLogService = {
  async list(status?: string): Promise<ChangeEvent[]> {
    const res = await apiClient.get(`/change-log${status ? `?status=${status}` : ''}`);
    return res.data ?? [];
  },
  async raise(body: {
    change_type: string;
    title: string;
    description?: string;
    effective_from?: string;
    effective_to?: string;
  }) {
    const res = await apiClient.post('/change-log', body);
    return res.data;
  },
  async review(id: number, status: string, notes?: string) {
    const res = await apiClient.post(`/change-log/${id}/review`, { status, notes });
    return res.data;
  },
  /** Toolbox talk / safety walk — feeds the Org Health domain of the SPS. */
  async logInteraction(body: { interaction_type?: string; employee_id?: number; detail?: string }) {
    const res = await apiClient.post('/change-log/toolbox', body);
    return res.data;
  },
  /** Permit bypass / late closure — feeds the Work Discipline domain. */
  async logWorkEvent(body: { event_type: string; permit_id?: number; detail?: string }) {
    const res = await apiClient.post('/change-log/work-event', body);
    return res.data;
  },
};

// ── AI governance ─────────────────────────────────────────────────────────────
export const aiGovernanceService = {
  async log(params?: { mine_only?: boolean; undecided_only?: boolean }) {
    const q = new URLSearchParams();
    q.append('mine_only', String(params?.mine_only ?? true));
    q.append('undecided_only', String(params?.undecided_only ?? false));
    const res = await apiClient.get(`/ai-governance/log?${q}`);
    return res.data ?? [];
  },
  /** Accept / amend / reject — the learning loop's only input. */
  async decide(logId: number, decision: 'accept' | 'amend' | 'reject', reason?: string, amended?: string) {
    const res = await apiClient.post(`/ai-governance/${logId}/decide`, {
      decision,
      reason,
      amended_answer: amended,
    });
    return res.data;
  },
  async learning(days = 90) {
    const res = await apiClient.get(`/ai-governance/learning?days=${days}`);
    return res.data;
  },
  async modelGovernance() {
    const res = await apiClient.get('/ai-governance/model');
    return res.data;
  },
  async pirs(days = 90): Promise<Pirs> {
    const res = await apiClient.get(`/ai-governance/pirs?days=${days}`);
    return res.data;
  },
};
