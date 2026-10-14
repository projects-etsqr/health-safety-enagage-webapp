import axiosInstance from '../api/axiosInstance';

export interface DashboardStats {
  total_incidents: number;
  open_capa_actions: number;
  overdue_capa: number;
  active_permits: number;
  total_employees: number;
  total_sites: number;
  near_misses_count: number;
  safety_walks_count: number;
  avg_compliance_rating: number;
  avg_housekeeping_rating: number;
  critical_incidents: number;
  capa_completion_rate: number;
  /** The date window actually applied server-side (after resolving a preset's
   *  `days` against the org's own latest recorded data) — null/null for "All". */
  period_start: string | null;
  period_end: string | null;
}

export interface CapaAction {
  id: number;
  description: string;
  action_type: string;
  root_cause_addressed: string;
  status: string;
  due_date: string | null;
  is_overdue: boolean;
  incident_id: number;
  assignee: string;
  priority: string;
}

export interface OverdueCapa {
  id: number;
  incident_id: number;
  description: string;
  action_type: string;
  status: string;
  due_date: string | null;
  days_overdue: number;
  label: string;
}

export interface IncidentByCategory {
  name: string;
  data: number;
}

export interface ComplianceTrend {
  date: string;
  score: number;
}

export interface RecentSafetyWalk {
  id: number;
  reference: string;
  inspection_date_time: string | null;
  location: string;
  inspector: string;
  inspection_type: string;
  issues_found: number;
  critical_issues: number;
  compliance_rating: number;
  follow_up_required: boolean;
  priority: string;
}

export interface RecentNearMiss {
  id: number;
  reference: string;
  report_date: string | null;
  event_date_time: string | null;
  location: string;
  description: string;
  potential_consequence: string;
  underlying_cause: string;
  reporter: string;
  capa_escalation: boolean;
  severity: string;
}

export interface PredictiveInjuryRiskDetail {
  current_window_start: string;
  current_window_end: string;
  previous_window_start: string;
  previous_window_end: string;
  period_days: number;
  /** 'custom' for an explicit From/To range; 'preset_anchor' for a 7D/30D/
   *  90D/1Y button (anchored on the org's latest recorded data, not today);
   *  'default_90d' for "All", which falls back to the same 90-day anchor. */
  period_source: 'custom' | 'preset_anchor' | 'default_90d';
  current_incident_count: number;
  current_weight_sum: number;
  previous_incident_count: number;
  previous_weight_sum: number;
}

export interface LeadingIndicators {
  predictive_injury_risk_score: number;
  predictive_injury_risk_previous_score: number;
  predictive_injury_risk_trend: number;
  predictive_injury_risk_detail: PredictiveInjuryRiskDetail;
  trir: number;
  ltif: number;
  ltifr?: number;
  ltisr?: number;
  dart_rate?: number;
  far?: number;
  near_miss_ratio?: number | string;
  contractor_risk_label: string;
  contractor_risk_score: number;
  contractor_risk_score_10?: number;
  contractor_has_contractors?: boolean;
  contractor_safety_score?: number | null;
  contractor_safety_company_count?: number;
  audit_readiness_score: number;
  audit_readiness_label: string;
}

export interface ActivePermit {
  id: number;
  permit_ref: string;
  permit_type: string;
  location: string;
  work_description: string;
  number_of_workers: number;
  validity_start: string | null;
  validity_end: string | null;
  status: string;
}

// `days` (7/30/90/365) is how the preset buttons ask for "last N days" —
// resolved server-side against the org's own latest recorded data instead of
// the real system clock, so a preset never silently returns empty because
// the browser's "today" has drifted past where the data actually is.
// `startDate`/`endDate` remain for the Custom picker's explicit range.
export const getDashboardStats = (startDate?: string, endDate?: string, days?: number) =>
  axiosInstance.get<DashboardStats>('/dashboard/stats', {
    params: { start_date: startDate, end_date: endDate, days },
  }).then((r) => r.data);

export const getLeadingIndicators = (startDate?: string, endDate?: string, days?: number) =>
  axiosInstance.get<LeadingIndicators>('/dashboard/leading-indicators', {
    params: { start_date: startDate, end_date: endDate, days },
  }).then((r) => r.data);

export const getCapaActions = (limit = 10, startDate?: string, endDate?: string, days?: number) =>
  axiosInstance.get<CapaAction[]>('/dashboard/capa-actions', {
    params: { limit, start_date: startDate, end_date: endDate, days },
  }).then((r) => r.data);

export const getOverdueCapa = (limit = 10, startDate?: string, endDate?: string, days?: number) =>
  axiosInstance.get<OverdueCapa[]>('/dashboard/overdue-capa', {
    params: { limit, start_date: startDate, end_date: endDate, days },
  }).then((r) => r.data);

export const getIncidentsByCategory = (startDate?: string, endDate?: string, days?: number) =>
  axiosInstance.get<IncidentByCategory[]>('/dashboard/incidents-by-category', {
    params: { start_date: startDate, end_date: endDate, days },
  }).then((r) => r.data);

export const getComplianceTrend = (days = 30) =>
  axiosInstance.get<ComplianceTrend[]>('/dashboard/compliance-trend', { params: { days } }).then((r) => r.data);

export const getSafetyWalksRecent = (limit = 5, startDate?: string, endDate?: string, days?: number) =>
  axiosInstance.get<RecentSafetyWalk[]>('/dashboard/safety-walks-recent', {
    params: { limit, start_date: startDate, end_date: endDate, days },
  }).then((r) => r.data);

export const getNearMissesRecent = (limit = 5, startDate?: string, endDate?: string, days?: number) =>
  axiosInstance.get<RecentNearMiss[]>('/dashboard/near-misses-recent', {
    params: { limit, start_date: startDate, end_date: endDate, days },
  }).then((r) => r.data);

export const getActivePermits = (limit = 10) =>
  axiosInstance.get<ActivePermit[]>('/dashboard/permits-active', { params: { limit } }).then((r) => r.data);
