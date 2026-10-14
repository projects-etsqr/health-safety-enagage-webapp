/**
 * WF-05 · the web console's half of the audit workflow.
 *
 * "Everything requiring observation, evidence or a signature happens where the
 * work is. Everything requiring reading, comparison or distribution happens
 * where the screen is bigger."
 *
 * So this deliberately does not wrap the conducting endpoints — no opening
 * meeting, no item responses, no evidence, no signatures. Those are the phone's.
 * What is here is the programme, the register, report review and distribution,
 * the templates and the cross-site trends.
 */
import axiosInstance from '../api/axiosInstance';

// ── Vocabulary ───────────────────────────────────────────────────────────────

export type Classification =
  | 'conformance' | 'observation' | 'minor_nc' | 'major_nc' | 'critical';

export type ScoreBand = 'excellent' | 'good' | 'acceptable' | 'poor';

export type OverallRating = 'satisfactory' | 'requires_improvement' | 'unsatisfactory';

export type RiskBand = 'critical' | 'high' | 'medium' | 'low';

export type StepState = 'done' | 'active' | 'blocked' | 'todo';

export interface AuditStep {
  number: number;
  key: string;
  phase: string;
  label: string;
  owner: string;
  owner_label?: string;
  state: StepState;
  automatic: boolean;
  hard_stop: boolean;
  on_mobile: boolean;
  detail?: string;
}

export interface ChecklistItem {
  id: number;
  seq?: number;
  section?: string | null;
  title: string;
  question?: string | null;
  clause?: string | null;
  is_critical: boolean;
  response?: string | null;
  remarks?: string | null;
  classification?: Classification | null;
  evidence_count: number;
  points_earned?: number | null;
  points_possible?: number | null;
}

export interface Evidence {
  id: number;
  checklist_item_id?: number | null;
  finding_id?: number | null;
  kind: 'photo' | 'video' | 'document' | 'note' | 'scan' | 'interview';
  file_url?: string | null;
  caption?: string | null;
  scanned_ref?: string | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  captured_at?: string | null;
  subject_name?: string | null;
  interview_prompt?: string | null;
  competence_verified?: boolean | null;
}

export interface Finding {
  id: number;
  audit_id: number;
  finding_ref?: string | null;
  section?: string | null;
  title: string;
  description?: string | null;
  clause?: string | null;
  classification: Classification;
  auto_classified: boolean;
  is_repeat: boolean;
  corrective_action_due?: string | null;
  capa_id?: number | null;
  status: string;
  verified_at?: string | null;
  verification_notes?: string | null;
  closed_at?: string | null;
  evidence: Evidence[];
}

export interface SectionScore {
  section: string;
  score: number;
  assessed: number;
  points_earned: number;
  points_possible: number;
  below_threshold: boolean;
}

export interface Audit {
  id: number;
  audit_ref?: string | null;
  title: string;
  checklist_type?: string | null;
  site_id?: number | null;
  site_name?: string | null;
  department?: string | null;
  auditor_id?: number | null;
  scheduled_date?: string | null;
  due_date?: string | null;
  status: string;
  priority?: string | null;
  progress?: number | null;
  compliance_score?: number | null;
  findings: ChecklistItem[];
  submitted_at?: string | null;

  trigger_type?: string | null;
  trigger_label?: string | null;
  audit_scope?: string | null;
  risk_band?: RiskBand | null;
  site_score?: number | null;
  audit_team: Array<{ user_id: number; role: string }>;
  auditee_manager_id?: number | null;
  auditee_notified_at?: string | null;
  notice_due_date?: string | null;
  brief_pack_reviewed_at?: string | null;
  opening_meeting?: Record<string, unknown> | null;
  opening_meeting_at?: string | null;
  closing_meeting?: Record<string, unknown> | null;
  closing_meeting_at?: string | null;
  auditee_confirmed_at?: string | null;
  auditee_signed_name?: string | null;
  /** The drawn signature, as the auditor's device captured it on site. */
  auditee_signature?: string | null;
  findings_locked: boolean;
  findings_locked_at?: string | null;
  score_band?: ScoreBand | null;
  overall_rating?: OverallRating | null;
  section_scores: SectionScore[];
  finding_counts: Record<Classification, number>;
  classified_findings: Finding[];
  auditor_signed_name?: string | null;
  auditor_signature?: string | null;
  report_ref?: string | null;
  report_issued_at?: string | null;
  report_approved_at?: string | null;
  report_approval_notes?: string | null;
  re_audit_required: boolean;
  re_audit_reason?: string | null;
  re_audit_due_date?: string | null;
  re_audit_decision?: string | null;
  re_audit_decided_at?: string | null;
  re_audit_decision_note?: string | null;
  re_audit_audit_id?: number | null;
  distribution_scope?: string | null;
  distributed_beyond_site_at?: string | null;
  template_id?: number | null;
  generated_by_programme: boolean;
  closed_at?: string | null;
  open_finding_count: number;

  steps: AuditStep[];
  current_step?: number | null;
  current_step_label?: string | null;

  stage?: string | null;
  stage_number?: number | null;
  stage_label?: string | null;
}

export interface ProgrammeRow {
  site_id?: number | null;
  site_name?: string | null;
  risk_band: RiskBand;
  band_label?: string | null;
  site_score?: number | null;
  qualifying?: string | null;
  inspection_frequency?: string | null;
  audit_frequency?: string | null;
  next_inspection_due?: string | null;
  next_audit_due?: string | null;
  last_audit_at?: string | null;
  re_audit_trigger?: string | null;
  overdue: boolean;
  programme_year?: number | null;
  authorised_at?: string | null;
  approved_at?: string | null;
  generated_at?: string | null;
  generated_count: number;
  scope_concerns?: string | null;
}

export interface GenerationResult {
  site_id?: number | null;
  site_name?: string | null;
  risk_band: string;
  inspections_created: number;
  audits_created: number;
  skipped_existing: number;
  total: number;
  reason?: string | null;
  created_ids: number[];
}

export interface ScoreBreakdown {
  score: number;
  band: ScoreBand;
  band_label: string;
  points_earned: number;
  points_possible: number;
  assessed: number;
  not_applicable: number;
  unanswered: number;
  overall_rating: OverallRating;
  explanation: string;
  sections: SectionScore[];
  counts: Record<Classification, number>;
}

export interface AuditReport {
  audit_id: number;
  report_ref?: string | null;
  issued_at?: string | null;
  title: string;
  site_name?: string | null;
  checklist_type?: string | null;
  conducted_on?: string | null;
  lead_auditor?: string | null;
  score: ScoreBreakdown;
  findings: Finding[];
  benchmark: {
    previous_audit_ref?: string | null;
    previous_score?: number | null;
    previous_rating?: string | null;
    delta?: number | null;
    repeat_findings: number;
  };
  clause_map: Array<{ clause: string; findings: number; worst: Classification }>;
  escalations: Array<{ key: string; detail?: string | null }>;
  distributed_to: number[];
  signed_by?: string | null;
  auditee_signed_by?: string | null;
  auditor_signature?: string | null;
  auditee_signature?: string | null;
  /** Every photo, video and note captured on the walk, not only what hangs off a finding. */
  evidence?: Evidence[];
}

export interface TemplateItem {
  id?: number;
  seq?: number;
  section?: string | null;
  title: string;
  question?: string | null;
  clause?: string | null;
  is_critical: boolean;
}

export interface Template {
  id: number;
  name: string;
  checklist_type?: string | null;
  description?: string | null;
  standard?: string | null;
  version: number;
  is_active: boolean;
  is_default: boolean;
  items: TemplateItem[];
  audits_using: number;
}

export interface AuditorRegisterRow {
  user_id: number;
  employee_id?: number | null;
  name?: string | null;
  email?: string | null;
  is_active: boolean;
  audits_assigned: number;
  audits_open: number;
  audits_closed: number;
  average_score?: number | null;
  last_audit_at?: string | null;
  qualifications: Array<{ name: string; completed?: string | null; expires?: string | null; expired: boolean }>;
  expired_qualifications: number;
}

export interface SiteTrend {
  site_id?: number | null;
  site_name?: string | null;
  risk_band?: string | null;
  audits_in_window: number;
  latest_score?: number | null;
  latest_band?: string | null;
  latest_rating?: string | null;
  latest_audit_ref?: string | null;
  latest_audit_date?: string | null;
  previous_score?: number | null;
  trend?: number | null;
  average_score: number;
  finding_counts: Record<string, number>;
  major_or_critical: number;
  open_re_audit: boolean;
  below_threshold_twice: boolean;
}

export interface RepeatFinding {
  title: string;
  section?: string | null;
  worst_classification: Classification;
  occurrences: number;
  site_count: number;
  site_names: string[];
  repeat_occurrences: number;
  audit_refs: string[];
  last_seen?: string | null;
  systemic: boolean;
}

export interface TrendsResponse {
  summary: {
    window_days: number;
    audits_completed: number;
    average_score: number;
    average_band: ScoreBand;
    finding_counts: Record<string, number>;
    ratings: Record<string, number>;
    open_non_conformances: number;
    open_re_audit_decisions: number;
    audits_closed: number;
    audits_open: number;
  };
  sites: SiteTrend[];
  repeat_findings: RepeatFinding[];
  escalations: {
    audits_not_conducted: Array<Record<string, unknown>>;
    definitions: Array<{ key: string; label: string; detail: string }>;
  };
}

export interface AuditReference {
  flow: {
    steps: Array<AuditStep & { role_notes: Record<string, string> }>;
    roles: Array<{ key: string; label: string; surface: string; summary: string; owns: string[] }>;
    mobile_steps: number[];
    web_steps: number[];
    spec_mapping: Array<{ document_role: string; platform_role: string; note: string }>;
  };
  scoring: {
    formula: string;
    formula_alt: string;
    formula_note: string;
    bands: Array<{ key: string; label: string; range: string; floor: number }>;
    alert_threshold: number;
    re_audit_threshold: number;
    section_nc_threshold: number;
    minor_nc_limit: number;
    classifications: Array<{ key: string; label: string; meaning: string; action_days: number | null }>;
    ratings: Record<string, string>;
  };
  triggers: Array<{ key: string; label: string; detail: string; requires_notice: boolean }>;
  frequency: Array<Record<string, string>>;
  escalations: Array<{ key: string; label: string; detail: string }>;
  notice_days: number;
  brief_pack_days: number;
  /** Types that work with no maintained template — the scheduling form's fallback. */
  checklist_types?: Array<{ key: string; label: string }>;
}

// ── Display metadata ─────────────────────────────────────────────────────────
//
// One rendering of the rubric's vocabulary, so the register, the report and the
// trends screen all state a Major NC identically. A chip that means one thing on
// one screen and another elsewhere is worse than no chip.

export const CLASSIFICATION_META: Record<
  Classification,
  { label: string; short: string; color: string; bg: string; border: string; severity: number }
> = {
  conformance: { label: 'Conformance', short: 'CONF', color: '#047857', bg: '#D1FAE5', border: '#A7F3D0', severity: 0 },
  observation: { label: 'Observation', short: 'OBS', color: '#1D4ED8', bg: '#DBEAFE', border: '#BFDBFE', severity: 1 },
  minor_nc: { label: 'Minor NC', short: 'MINOR', color: '#B45309', bg: '#FEF3C7', border: '#FDE68A', severity: 2 },
  major_nc: { label: 'Major NC', short: 'MAJOR', color: '#B91C1C', bg: '#FEE2E2', border: '#FECACA', severity: 3 },
  critical: { label: 'Critical / Regulatory', short: 'CRITICAL', color: '#FFFFFF', bg: '#B91C1C', border: '#991B1B', severity: 4 },
};

export const BAND_META: Record<ScoreBand, { label: string; range: string; color: string; bg: string }> = {
  excellent: { label: 'Excellent', range: '90% and above', color: '#047857', bg: '#D1FAE5' },
  good: { label: 'Good', range: '75 – 89%', color: '#15803D', bg: '#DCFCE7' },
  acceptable: { label: 'Acceptable', range: '60 – 74%', color: '#B45309', bg: '#FEF3C7' },
  poor: { label: 'Poor', range: 'Below 60%', color: '#B91C1C', bg: '#FEE2E2' },
};

export const RATING_META: Record<OverallRating, { label: string; color: string; bg: string }> = {
  satisfactory: { label: 'Satisfactory', color: '#047857', bg: '#D1FAE5' },
  requires_improvement: { label: 'Requires Improvement', color: '#B45309', bg: '#FEF3C7' },
  unsatisfactory: { label: 'Unsatisfactory', color: '#B91C1C', bg: '#FEE2E2' },
};

export const RISK_BAND_META: Record<RiskBand, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#FFFFFF', bg: '#DC2626' },
  high: { label: 'High', color: '#FFFFFF', bg: '#EA580C' },
  medium: { label: 'Medium', color: '#FFFFFF', bg: '#F59E0B' },
  low: { label: 'Low', color: '#FFFFFF', bg: '#059669' },
};

export const STEP_STATE_META: Record<StepState, { color: string; bg: string }> = {
  done: { color: '#047857', bg: '#D1FAE5' },
  active: { color: '#1D4ED8', bg: '#DBEAFE' },
  blocked: { color: '#B91C1C', bg: '#FEE2E2' },
  todo: { color: '#94A3B8', bg: '#F1F5F9' },
};

// Module 8 (Compliance & Audits) KPI block — client's own KPI spec
// (HSEIQ_Full_KPI_with_SampleData.xlsx, M8_Compliance_Audits).
export interface AuditKpis {
  audit_completion_rate_pct: number | null;
  finding_closure_rate_pct: number | null;
  nc_closure_rate_pct: number | null;
  regulatory_compliance_rate_pct: number | null;
  overdue_findings_count: number;
  detail: {
    audits_planned: number;
    audits_completed: number;
    total_findings: number;
    findings_closed: number;
    total_ncs: number;
    ncs_closed: number;
  };
}

// ── Calls ────────────────────────────────────────────────────────────────────

const unwrap = <T,>(r: { data: T }) => r.data;

export const getAuditReference = () =>
  axiosInstance.get<AuditReference>('/audits/reference').then(unwrap);

export const getAudits = () =>
  axiosInstance.get<Audit[]>('/audits/').then(unwrap);

export const getAuditKpis = () =>
  axiosInstance.get<AuditKpis>('/audits/kpis').then(unwrap);

export const getAudit = (id: number) =>
  axiosInstance.get<Audit>(`/audits/${id}`).then(unwrap);

export const getAuditScore = (id: number) =>
  axiosInstance.get<ScoreBreakdown>(`/audits/${id}/score`).then(unwrap);

export const getAuditReport = (id: number) =>
  axiosInstance.get<AuditReport>(`/audits/${id}/report`).then(unwrap);

export const getAuditFindings = (id: number, openOnly = false) =>
  axiosInstance
    .get<Finding[]>(`/audits/${id}/findings`, { params: openOnly ? { open_only: true } : undefined })
    .then(unwrap);

export const getBriefPack = (id: number) =>
  axiosInstance.get<{ pack: Record<string, unknown>; generated_at?: string; reviewed_at?: string }>(
    `/audits/${id}/brief-pack`,
  ).then(unwrap);

// Step 01-02 · schedule and assign
export interface ScheduleAuditPayload {
  title: string;
  checklist_type?: string;
  site_id?: number;
  site_name?: string;
  department?: string;
  scheduled_date?: string;
  due_date?: string;
  priority?: string;
  trigger_type?: string;
  audit_scope?: string;
  auditor_id?: number;
  auditee_manager_id?: number;
}

export const scheduleAudit = (payload: ScheduleAuditPayload) =>
  axiosInstance.post<Audit>('/audits/', payload).then(unwrap);

export const assignTeam = (
  id: number,
  payload: { lead_auditor_id: number; team_member_ids?: number[]; auditee_manager_id?: number; notes?: string },
) => axiosInstance.post<Audit>(`/audits/${id}/assign-team`, payload).then(unwrap);

// Step 01 · the programme
export const getProgramme = (refresh = false) =>
  axiosInstance
    .get<ProgrammeRow[]>('/audits/programme', { params: refresh ? { refresh: true } : undefined })
    .then(unwrap);

export const authoriseProgramme = (
  siteId: number,
  payload: { authorised: boolean; note?: string; scope_concerns?: string },
) => axiosInstance.post<ProgrammeRow>(`/audits/programme/${siteId}/authorise`, payload).then(unwrap);

export const approveProgramme = (payload: { approved: boolean; site_ids?: number[] }) =>
  axiosInstance.post<ProgrammeRow[]>('/audits/programme/approve', payload).then(unwrap);

export const generateCalendar = (payload: {
  year?: number;
  site_id?: number;
  checklist_type?: string;
  require_authorisation?: boolean;
}) => axiosInstance.post<GenerationResult[]>('/audits/programme/generate', payload).then(unwrap);

export const sendReminders = () =>
  axiosInstance.post<{ sent: number }>('/audits/programme/reminders', {}).then(unwrap);

// Step 09 · review, approve, distribute
export const approveReport = (id: number, payload: { approved: boolean; notes?: string }) =>
  axiosInstance.post<Audit>(`/audits/${id}/approve-report`, payload).then(unwrap);

export const distributeReport = (
  id: number,
  payload: { scope: string; recipient_employee_ids?: number[]; note?: string },
) => axiosInstance.post<Audit>(`/audits/${id}/distribute`, payload).then(unwrap);

// Step 10 · oversight
export const getTrends = (windowDays = 365) =>
  axiosInstance.get<TrendsResponse>('/audits/trends', { params: { window_days: windowDays } }).then(unwrap);

export const decideReAudit = (
  id: number,
  payload: { decision: 'scheduled' | 'waived'; note?: string; scheduled_date?: string; auditor_id?: number },
) => axiosInstance.post<Audit>(`/audits/${id}/re-audit-decision`, payload).then(unwrap);

export const closeAudit = (id: number) =>
  axiosInstance.post<Audit>(`/audits/${id}/close`, {}).then(unwrap);

// Admin · templates and the auditor register
export const getTemplates = (includeInactive = false) =>
  axiosInstance
    .get<Template[]>('/audits/templates', { params: includeInactive ? { include_inactive: true } : undefined })
    .then(unwrap);

export const createTemplate = (payload: {
  name: string;
  checklist_type?: string;
  description?: string;
  standard?: string;
  is_default?: boolean;
  items: TemplateItem[];
}) => axiosInstance.post<Template>('/audits/templates', payload).then(unwrap);

export const updateTemplate = (
  id: number,
  payload: Partial<{
    name: string;
    checklist_type: string;
    description: string;
    standard: string;
    is_default: boolean;
    items: TemplateItem[];
  }>,
) => axiosInstance.put<Template>(`/audits/templates/${id}`, payload).then(unwrap);

export const retireTemplate = (id: number) =>
  axiosInstance.delete(`/audits/templates/${id}`).then(() => undefined);

export const seedTemplates = () =>
  axiosInstance.post<Template[]>('/audits/templates/seed', {}).then(unwrap);

export const getAuditorRegister = () =>
  axiosInstance.get<AuditorRegisterRow[]>('/audits/auditors').then(unwrap);

// ── Helpers the pages share ──────────────────────────────────────────────────

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function bandFor(score?: number | null): ScoreBand {
  if (score == null) return 'poor';
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'acceptable';
  return 'poor';
}

/** The step the audit is waiting on, or undefined once it is closed. */
export function currentStep(audit: Audit): AuditStep | undefined {
  return audit.steps?.find((s) => s.state === 'active' || s.state === 'blocked');
}

export function humanise(value?: string | null): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
