import axiosInstance from '../api/axiosInstance';

export interface EquipmentTypeCount {
  type: string;
  count: number;
}

export interface EquipmentSummary {
  total_equipment: number;
  status_counts: Record<string, number>;
  equipment_by_type: EquipmentTypeCount[];
  sce_count: number;
  sce_overdue_count: number;
  mtbf_avg_hours: number | null;
  pm_compliance_pct: number | null;
  pm_compliance_note: string;
  inspection_compliance_note: string;
}

export interface EquipmentRow {
  id: number;
  equipment_code: string;
  equipment_name: string;
  equipment_type: string | null;
  location_station: string | null;
  installation_date: string | null;
  pm_interval_days: number | null;
  last_pm_date: string | null;
  next_pm_due: string | null;
  pm_overdue: boolean;
  operating_hours_ytd: number | null;
  last_failure_date: string | null;
  mtbf_hours_estimated: number | null;
  safety_critical_sce: boolean;
  status: string | null;
}

export interface EquipmentInput {
  equipment_code: string;
  equipment_name: string;
  equipment_type?: string | null;
  location_station?: string | null;
  installation_date?: string | null;
  pm_interval_days?: number | null;
  last_pm_date?: string | null;
  next_pm_due?: string | null;
  operating_hours_ytd?: number | null;
  last_failure_date?: string | null;
  mtbf_hours_estimated?: number | null;
  safety_critical_sce?: boolean;
  status?: string | null;
}

export interface EquipmentPage {
  data: EquipmentRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EquipmentFilterOptions {
  types: string[];
  statuses: string[];
}

export const getEquipmentSummary = () =>
  axiosInstance.get<EquipmentSummary>('/equipment-register/summary').then((r) => r.data);

export const getEquipmentFilterOptions = () =>
  axiosInstance.get<EquipmentFilterOptions>('/equipment-register/filter-options').then((r) => r.data);

export const getEquipmentList = (
  page = 1,
  pageSize = 25,
  filters?: { status?: string; equipment_type?: string; sce?: string; q?: string },
) =>
  axiosInstance
    .get<EquipmentPage>('/equipment-register', { params: { page, pageSize, ...filters } })
    .then((r) => r.data);

export const createEquipment = (payload: EquipmentInput) =>
  axiosInstance.post<EquipmentRow>('/equipment-register', payload).then((r) => r.data);

export const updateEquipment = (id: number, payload: EquipmentInput) =>
  axiosInstance.put<EquipmentRow>(`/equipment-register/${id}`, payload).then((r) => r.data);

export const deleteEquipment = (id: number) =>
  axiosInstance.delete(`/equipment-register/${id}`);
