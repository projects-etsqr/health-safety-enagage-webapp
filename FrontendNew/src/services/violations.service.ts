import axiosInstance from '../api/axiosInstance';
import type { Violation, ViolationFilters, Action, Rule, PPEType } from '../types';

interface BackendIncident {
  id: number;
  report_date: string;
  incident_date_time: string;
  incident_type: string;
  severity: string;
  description: string;
  immediate_cause: string;
  investigation_status: string;
  capa_generated: string;
  days_away: number;
  root_cause_category: string;
}

interface BackendIncidentUpdate {
  investigation_status?: string;
}

interface BackendCapa {
  id: number;
  incident_id?: number;
  action_type: string;
  description: string;
  root_cause_addressed: string;
  due_date: string;
  status: string;
  effectiveness_rating: number;
}

export const getViolations = (_filters?: ViolationFilters) =>
  axiosInstance.get<BackendIncident[]>('/incidents/').then((r) =>
    r.data.map((inc) => ({
      Violation_ID: String(inc.id),
      Detected_At: inc.incident_date_time ?? inc.report_date,
      Camera_ID: '',
      Zone_ID: String(inc.id),
      Worker_ID: '',
      PPE_Missing: inc.incident_type ?? '',
      Severity: inc.severity ?? 'Medium',
      Status: inc.investigation_status ?? 'Open',
      Confidence_Score: 0.9,
      Shift: '',
      Thumbnail_URL: '',
      Description: inc.description ?? '',
    } as unknown as Violation))
  );

export const getViolationDetail = (violationId: string) =>
  axiosInstance.get<BackendIncident>(`/incidents/${violationId}`).then((r) => ({
    Violation_ID: String(r.data.id),
    Detected_At: r.data.incident_date_time ?? r.data.report_date,
    Camera_ID: '',
    Zone_ID: '',
    Worker_ID: '',
    PPE_Missing: r.data.incident_type ?? '',
    Severity: r.data.severity ?? 'Medium',
    Status: r.data.investigation_status ?? 'Open',
    Confidence_Score: 0.9,
    Shift: '',
    Thumbnail_URL: '',
    Description: r.data.description ?? '',
  } as unknown as Violation));

export const updateIncidentStatus = (incidentId: number, investigation_status: string) =>
  axiosInstance.put(`/incidents/${incidentId}`, { investigation_status } satisfies BackendIncidentUpdate);

export const updateCapaAction = (
  actionId: number,
  payload: { due_date?: string; responsible_person_id?: number },
) => axiosInstance.put(`/capa-actions/${actionId}`, payload);

export const completeCapaAction = (
  actionId: number,
  effectivenessRating?: number,
) =>
  axiosInstance.post(`/incident-workflow/capa/${actionId}/complete`, {
    effectiveness_rating: effectivenessRating ?? 5,
  });

export const getActions = (_violationId?: string, _status?: string) =>
  axiosInstance.get<BackendCapa[]>('/capa-actions/').then((r) =>
    r.data.map((a) => ({
      Action_ID: String(a.id),
      Violation_ID: String(a.incident_id ?? ''),
      Assigned_To: '',
      Status: a.status ?? 'Open',
      Priority: 'Medium',
      Description: a.description ?? '',
      Due_Date: a.due_date ?? '',
      Created_At: '',
    } as unknown as Action))
  );

export const getRules = (): Promise<Rule[]> => Promise.resolve([]);

export const getPPETypes = (): Promise<PPEType[]> => Promise.resolve([]);

export type { Violation, ViolationFilters, Action, Rule, PPEType };
