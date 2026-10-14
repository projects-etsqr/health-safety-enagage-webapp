import axiosInstance from '../api/axiosInstance';

/**
 * Web "Register Incident" — the client's ask: the same form/workflow the
 * mobile app uses, not a separate one that could drift or produce a
 * differently-shaped record. Posts to the exact endpoint the mobile app uses
 * (`POST /worker/incidents`, worker.py) so a web-registered incident is
 * classified, statutory-checked and linked into WF-01 risk reopening
 * identically to a mobile-submitted one — only `source: "Web App"` marks
 * where it came from (migration 077).
 */

export interface WorkingStationOption {
  id: number;
  station_name: string;
}

export interface HazardOption {
  id: number;
  hazard_name: string;
}

export const getWorkingStationOptions = () =>
  axiosInstance
    .get<WorkingStationOption[]>('/working-stations/', { params: { limit: 200 } })
    .then((r) => r.data);

export const getHazardOptions = () =>
  axiosInstance.get<HazardOption[]>('/hazards/').then((r) => r.data);

export interface RegisterIncidentPayload {
  incident_type: string;
  location_station_id?: number;
  incident_date_time: string;
  description: string;
  severity: string;
  immediate_cause: string;
  number_persons_involved?: number;
  anyone_injured: 'Yes' | 'No';
  injured_person_name?: string;
  injured_body_part?: string;
  // Feed _apply_severity_and_statutory (worker.py) the same decision-tree
  // inputs the mobile form collects — omitting them is what the backend
  // treats as its fail-safe "unclassified" path, not a neutral default.
  treatment_level?: string;
  dangerous_occurrence?: 'Yes' | 'No';
  worst_case_fatal?: 'Yes' | 'No';
  hazard_id?: number;
  control_failure: 'Yes' | 'No';
  hazard_still_present: 'Yes' | 'No';
  immediate_actions_taken?: string;
  witnesses?: { name: string }[];
}

export interface RegisterIncidentResult {
  success: boolean;
  data: {
    id: string;
    status: string;
    severity_priority: string | null;
    severity_label: string | null;
    investigation_due_at: string | null;
  };
}

export const registerIncident = (payload: RegisterIncidentPayload) =>
  axiosInstance
    .post<RegisterIncidentResult>('/worker/incidents', { data: { ...payload, source: 'Web App' } })
    .then((r) => r.data);
