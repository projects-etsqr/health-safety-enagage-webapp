import axiosInstance from '../api/axiosInstance';

export interface SafetyWalkTypeBreakdown {
  type: string;
  count: number;
  avg_compliance_rating: number | null;
}

export interface SafetyWalkSummary {
  total_inspections: number;
  avg_compliance_rating: number | null;
  avg_housekeeping_rating: number | null;
  inspections_with_critical_issue: number;
  inspections_requiring_follow_up: number;
  follow_up_rate_pct: number | null;
  total_issues_found: number;
  breakdown_by_type: SafetyWalkTypeBreakdown[];
}

export interface SafetyWalkRow {
  id: number;
  reference: string;
  inspection_date_time: string | null;
  location: string;
  inspector: string;
  inspection_type: string | null;
  issues_found: number;
  critical_issues: number;
  housekeeping_rating: number | null;
  compliance_rating: number | null;
  follow_up_required: boolean;
  priority: 'Critical' | 'High' | 'Medium';
}

export interface SafetyWalkPage {
  data: SafetyWalkRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SafetyWalkFilterOptions {
  types: string[];
}

export const getSafetyWalkSummary = () =>
  axiosInstance.get<SafetyWalkSummary>('/safety-walks/summary').then((r) => r.data);

export const getSafetyWalkFilterOptions = () =>
  axiosInstance.get<SafetyWalkFilterOptions>('/safety-walks/filter-options').then((r) => r.data);

export const getSafetyWalkRegister = (
  page = 1,
  pageSize = 25,
  filters?: { inspection_type?: string; q?: string },
) =>
  axiosInstance
    .get<SafetyWalkPage>('/safety-walks/register', { params: { page, pageSize, ...filters } })
    .then((r) => r.data);
