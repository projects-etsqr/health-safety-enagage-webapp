import axiosInstance from '../api/axiosInstance';

// ── Violations Summary ────────────────────────────────────────────────────────

export interface ViolationItem {
  label: string;
  value: number;
}

export interface RcaItem {
  name: string;
  value: number;
  color: string;
}

export interface SeverityMixItem {
  label: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ViolationsSummary {
  by_type: ViolationItem[];
  by_location: ViolationItem[];
  by_root_cause: RcaItem[];
  investigation_status: RcaItem[];
  monthly_trend: { month: string; value: number }[];
  near_miss_monthly: { month: string; value: number }[];
  downtime_by_type: ViolationItem[];
  open_capa_items: string[];
  severity_mix: SeverityMixItem[];
  injury_category: ViolationItem[];
  person_involved: ViolationItem[];
  injury_type: ViolationItem[];
  key_learnings: string[];
}

export const getViolationsSummary = (months = 10) =>
  axiosInstance
    .get<ViolationsSummary>(`/analytics/violations-summary?months=${months}`)
    .then((r) => r.data);

// ── Permits Summary ───────────────────────────────────────────────────────────

export interface PermitViolation {
  text: string;
  time: string;
}

export interface ActiveWorkRow {
  id: string;
  type: string;
  issued_by: string;
  location: string;
  status: string;
  expiry: string;
}

export interface ExpiryTimelineBar {
  label: string;
  left: number;
  width: number;
  color: string;
  rightText: string;
}

export interface WorkByType {
  name: string;
  active: number;
  closed: number;
  expired: number;
}

export interface PermitsSummary {
  active_permits: number;
  total_workers_on_site: number;
  risk_work_data: { subject: string; A: number }[];
  permit_violations: PermitViolation[];
  active_work_rows: ActiveWorkRow[];
  expiry_timeline: ExpiryTimelineBar[];
  work_exposure_hours: number;
  permit_compliance_pct: number;
  missing_controls: string[];
  work_by_type: WorkByType[];
  contractor_compliant_pct: number;
  contractor_non_compliant_pct: number;
}

export const getPermitsSummary = () =>
  axiosInstance.get<PermitsSummary>('/analytics/permits-summary').then((r) => r.data);

export interface PermitsPage {
  data: ActiveWorkRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const getAllPermits = (
  page = 1,
  pageSize = 25,
  filters?: { status?: string; permit_type?: string; location?: string; q?: string },
) =>
  axiosInstance
    .get<PermitsPage>('/analytics/permits/all', { params: { page, pageSize, ...filters } })
    .then((r) => r.data);

export interface PermitFilterOptions {
  types: string[];
  locations: string[];
}

export const getPermitFilterOptions = () =>
  axiosInstance.get<PermitFilterOptions>('/analytics/permits/filter-options').then((r) => r.data);

// ── Compliance Summary ──────────────────────────────────────────────────────────

export interface NonConformanceRow {
  id: string;
  capa_id: number;
  action: string;
  owner: string;
  due: string;
  criticality: string;
}

export interface ComplianceSummary {
  compliance_score: number;
  compliance_label: string;
  compliance_score_prev_12mo_delta: number | null;
  legal_register_coverage_pct: number;
  legal_register_label: string;
  audit_readiness_pct: number;
  audit_readiness_label: string;
  audit_readiness_prev_12mo_delta: number | null;
  permit_compliance_pct: number;
  permit_compliance_prev_12mo_delta: number | null;
  loto_compliance_pct: number | null;
  corrective_action_closure_rate: number;
  corrective_action_closure_prev_12mo_delta: number | null;
  policy_review_pct: number;
  compliance_trend: { month: string; value: number }[];
  compliance_trend_mom: number | null;
  findings_by_severity: { name: string; value: number; color: string }[];
  non_conformance_rows: NonConformanceRow[];
}

export const getComplianceSummary = () =>
  axiosInstance.get<ComplianceSummary>('/analytics/compliance-summary').then((r) => r.data);

// ── Risk Summary ──────────────────────────────────────────────────────────────

export interface TaskRow {
  id: string;
  desc: string;
  owner: string;
  due: string;
  status: string;
}

export interface AgingBar {
  bucket: string;
  low: number;
  medium: number;
  high: number;
  critical: number;
  line: number;
}

export interface RiskSummary {
  zone_risk: { zone: string; value: number }[];
  task_rows: TaskRow[];
  aging_bars: AgingBar[];
  kpis: {
    control_effectiveness: string;
    unverified_controls: number;
    risk_escalations: number;
  };
}

export const getRiskSummary = () =>
  axiosInstance.get<RiskSummary>('/analytics/risk-summary').then((r) => r.data);

export const getResidualRiskTrend = () =>
  axiosInstance.get<{ q: string; risk: number }[]>('/analytics/residual-risk-trend').then((r) => r.data);

export const getRiskMatrix = () =>
  axiosInstance.get<{ counts: number[][] }>('/analytics/risk-matrix').then((r) => r.data);

// ── Risk reports (`risk_reports`) ─────────────────────────────────────────────
//
// Distinct from getRiskMatrix / getRiskSummary above, which read the hazard
// register and incidents. The Risk page was built entirely on those two and so
// showed no risk report at all — these are what put its own data on it.

export interface RiskAxisPoint {
  /** How the console labels this row/column. */
  label: string;
  /** The 1-5 value it represents on the scoring scale. */
  score: number;
}

export interface RiskReportMatrix {
  /** counts[severityRow][likelihoodCol], worst first in both directions. */
  counts: number[][];
  severity_axis: RiskAxisPoint[];
  likelihood_axis: RiskAxisPoint[];
  bands: Record<'Low' | 'Medium' | 'High' | 'Critical', number>;
  uplift_prevalence: Record<string, number>;
  total: number;
  plotted: number;
  /**
   * Carrying a consequence or likelihood word outside the 5x5 vocabulary, so it
   * cannot be placed on the grid. Not the same as unscored — a risk can have a
   * score and a band and still be unplottable.
   */
  unplotted: number;
  blocks_work: number;
  average_adjusted_score: number | null;
  includes_closed: boolean;
}

export interface TopRisk {
  id: number;
  reference: string;
  title: string | null;
  band: string | null;
  raw_risk_score: number | null;
  adjusted_risk_score: number | null;
  uplift_total: number;
  blocks_work: boolean;
  workflow_status: string | null;
  stage: string | null;
  reported_at: string | null;
}

export interface RiskReportSummary {
  total: number;
  open: number;
  closed: number;
  blocks_work: number;
  high_or_critical: number;
  /** Open risks with no adjusted score at all. */
  unassessed: number;
  overdue: number;
  by_stage: Record<string, number>;
  top_risks: TopRisk[];
}

export const getRiskReportMatrix = (includeClosed = false) =>
  axiosInstance
    .get<RiskReportMatrix>('/analytics/risk-report-matrix', { params: { include_closed: includeClosed } })
    .then((r) => r.data);

export const getRiskReportSummary = () =>
  axiosInstance.get<RiskReportSummary>('/analytics/risk-report-summary').then((r) => r.data);

// ── Violation Detail ──────────────────────────────────────────────────────────

export interface ViolationDetail {
  id: string;
  incident_type: string;
  severity: string;
  raw_severity: string;
  investigation_status: string;
  status_step: number;
  incident_datetime: string;
  description: string;
  immediate_cause: string;
  root_cause: string;
  zone: string;
  station: string;
  site: string;
  reporter: string;
  permit_active: string;
  days_away: number;
  number_persons_involved: number;
  control_failure: string;
  capa_actions: {
    id: string;
    action_type: string;
    description: string;
    responsible_person: string;
    due_date: string | null;
    status: string;
  }[];
  timeline: { action: string; user: string; time: string; type: string }[];
  assignee: { name: string; role: string } | null;
  due_date: string | null;
  source?: string;
}

export const getViolationDetail = (incidentId: number) =>
  axiosInstance.get<ViolationDetail>(`/analytics/violation-detail/${incidentId}`).then((r) => r.data);

// ── Engagement Summary ────────────────────────────────────────────────────────

export interface EngagementSummary {
  reporting_rate: number;
  reporting_rate_mom: number;
  survey_score: number;
  survey_score_pct: number;
  survey_score_mom: number | null;
  safety_observations_pct: number;
  safety_walks_pct: number;
  toolbox_attendance_pct: number;
  site_participation_pct: number;
  top_recognitions: { name: string }[];
  open_actions: { text: string; status: string }[];
}

export const getEngagementSummary = () =>
  axiosInstance.get<EngagementSummary>('/analytics/engagement-summary').then((r) => r.data);

// ── Policies ──────────────────────────────────────────────────────────────────

export interface PolicyRecord {
  id: number;
  policy_name: string;
  category: string | null;
  issue_date: string | null;
  owner: string | null;
  status: string | null;
}

export const getPolicies = (limit = 100) =>
  axiosInstance
    .get<PolicyRecord[]>(`/policys/?limit=${limit}`)
    .then((r) => r.data);

// ── Near Miss ─────────────────────────────────────────────────────────────────

export interface NearMiss {
  NearMiss_ID: string;
  Title: string;
  Description: string;
  Site_ID: string;
  Zone_ID: string;
  Reported_By: string;
  Reported_At: string;
  Incident_Date: string;
  Category: string;
  Severity: 'Critical' | 'High' | 'Medium' | 'Low';
  Potential_Outcome: string;
  Immediate_Action: string;
  Status: string;
  Investigation_Status: string;
}

export interface NearMissFilters {
  site_id?: string;
  severity?: string;
  status?: string;
}

interface RawNearMiss {
  id: number;
  report_date: string | null;
  event_date_time: string | null;
  location_station_id: number | null;
  description: string | null;
  potential_consequence: string | null;
  underlying_cause: string | null;
  control_failure: string | null;
  reported_by: number | null;
  capa_escalation: string | null;
}

function mapNearMiss(r: RawNearMiss): NearMiss {
  const isCapa = (r.capa_escalation ?? '').toLowerCase() === 'yes';
  return {
    NearMiss_ID: String(r.id),
    Title: r.description?.split('.')[0]?.slice(0, 80) ?? `Near Miss #${r.id}`,
    Description: r.description ?? '',
    Site_ID: r.location_station_id ? String(r.location_station_id) : '—',
    Zone_ID: '—',
    Reported_By: r.reported_by ? `Employee #${r.reported_by}` : 'Unknown',
    Reported_At: r.report_date ?? '',
    Incident_Date: r.event_date_time ? r.event_date_time.split('T')[0] : (r.report_date ?? ''),
    Category: 'Near Miss',
    Severity: 'Medium',
    Potential_Outcome: r.potential_consequence ?? '',
    Immediate_Action: r.underlying_cause ?? '',
    Status: isCapa ? 'Under Investigation' : 'Open',
    Investigation_Status: isCapa ? 'In Progress' : 'Pending',
  };
}

// ── Root Cause Analysis ───────────────────────────────────────────────────────

export interface RootCauseAnalysis {
  RCA_ID: string;
  Incident_ID: string;
  Incident_Type: string;
  Site_ID: string;
  Zone_ID: string;
  Conducted_By: string;
  Start_Date: string;
  Completion_Date: string;
  Root_Causes: string;
  Contributing_Factors: string;
  Corrective_Actions: string;
  Preventive_Measures: string;
  Status: string;
  Priority: string;
}

export interface RCAFilters {
  site_id?: string;
  status?: string;
}

export async function getRootCauseAnalysis(filters: RCAFilters = {}): Promise<RootCauseAnalysis[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.site_id) params.set('site_id', filters.site_id);

  return axiosInstance
    .get<RootCauseAnalysis[]>(`/analytics/root-cause-analysis?${params.toString()}`)
    .then((r) => r.data);
}

// ── Equipment Certifications ──────────────────────────────────────────────────

export interface EquipmentCertification {
  Cert_ID: string;
  Equipment_Name: string;
  Equipment_Type: string;
  Site_ID: string;
  Zone_ID: string;
  Serial_Number: string;
  Manufacturer: string;
  Model: string;
  Certification_Type: string;
  Certified_By: string;
  Issue_Date: string;
  Expiry_Date: string;
  Next_Inspection: string;
  Status: string;
  Compliance_Standard: string;
}

export interface EquipmentCertFilters {
  site_id?: string;
  status?: string;
  equipment_type?: string;
}

export async function getEquipmentCertifications(filters: EquipmentCertFilters = {}): Promise<EquipmentCertification[]> {
  const params = new URLSearchParams();
  if (filters.status)         params.set('status', filters.status);
  if (filters.equipment_type) params.set('equipment_type', filters.equipment_type);
  if (filters.site_id)        params.set('site_id', filters.site_id);
  const qs = params.toString();
  return axiosInstance
    .get<EquipmentCertification[]>(`/equipment-certifications/${qs ? `?${qs}` : ''}`)
    .then((r) => r.data);
}

export interface CertCreate {
  equipment_name: string;
  equipment_type?: string;
  site_id?: number;
  zone?: string;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  certification_type?: string;
  certified_by?: string;
  issue_date?: string;
  expiry_date?: string;
  next_inspection_date?: string;
  compliance_standard?: string;
}

export async function createEquipmentCertification(payload: CertCreate): Promise<EquipmentCertification> {
  return axiosInstance.post<EquipmentCertification>('/equipment-certifications/', payload).then((r) => r.data);
}

export async function deleteEquipmentCertification(certId: string): Promise<void> {
  const id = certId.replace('CERT-', '').replace(/^0+/, '') || '0';
  await axiosInstance.delete(`/equipment-certifications/${id}`);
}

export async function getNearMiss(filters: NearMissFilters = {}): Promise<NearMiss[]> {
  const raw = await axiosInstance
    .get<RawNearMiss[]>('/near-misss/?limit=200')
    .then((r) => r.data);

  let results = raw.map(mapNearMiss);

  if (filters.severity) {
    results = results.filter((r) => r.Severity === filters.severity);
  }
  if (filters.status) {
    results = results.filter((r) => r.Status === filters.status);
  }
  if (filters.site_id) {
    results = results.filter((r) => r.Site_ID === filters.site_id);
  }

  return results;
}
