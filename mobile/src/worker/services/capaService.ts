import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

/**
 * WF-04 corrective actions, from the owner's side.
 *
 * The worker dashboard has shown an "Open CAPAs" count for a long time with no
 * screen behind it, because CAPAManagement is registered only in the supervisor
 * navigation stack. The backend has always counted a worker's own actions, and
 * the lifecycle document is explicit that the owner may be a worker — so this
 * fills in the missing half rather than adding a new capability.
 *
 * Note the response shape: apiClient's interceptor already unwraps
 * {success, data}, so these return the payload directly. Reaching for
 * `res.data.data` here silently yields undefined.
 */

export type CapaStatus =
  | 'Open'
  | 'In Progress'
  | 'Evidence Submitted'
  | 'Pending Review'
  | 'Pending Approval'
  | 'Closed'
  // Legacy rows, still in the table.
  | 'Completed'
  | 'Overdue';

export interface CapaSummary {
  id: number;
  capa_ref: string | null;
  description: string | null;
  subject_family: string | null;
  subject_id: number | null;
  status: CapaStatus;
  step: number;
  step_label: string | null;
  priority_band: string | null;
  capa_type: string | null;
  due_date: string | null;
  elapsed_percent: number | null;
  is_overdue: boolean;
  escalation_level: number;
  responsible_person_name: string | null;
  systemic_flag: boolean;
  reopened_count: number;
}

export interface CapaEvidenceItem {
  id: number;
  evidence_type: string;
  file_url: string | null;
  description: string | null;
  evidence_date: string | null;
  validation_result: string | null;
  rejection_reason: string | null;
}

export interface ClosureCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface CapaDetail extends CapaSummary {
  root_cause_addressed: string | null;
  action_plan: string | null;
  success_criteria: string | null;
  action_category: string | null;
  hierarchy_level: string | null;
  evidence_required: string | null;
  priority_explanation: string | null;
  /** Which evidence types this action's category will accept. */
  allowed_evidence_types: string[];
  closure_checks: ClosureCheck[];
  evidence: CapaEvidenceItem[];
  interim_check_at: string | null;
  evidence_submitted_at: string | null;
  is_locked: boolean;
  next_action: string | null;
}

export const capaService = {
  async myActions(includeClosed = false): Promise<CapaSummary[]> {
    const res = await apiClient.get(ENDPOINTS.CAPA.MY_ACTIONS, {
      params: { include_closed: includeClosed },
    });
    return (res.data as CapaSummary[]) ?? [];
  },

  async detail(id: number | string): Promise<CapaDetail> {
    const res = await apiClient.get(ENDPOINTS.CAPA.DETAIL(id));
    return res.data as CapaDetail;
  },

  async start(id: number | string): Promise<CapaDetail> {
    const res = await apiClient.post(ENDPOINTS.CAPA.START(id));
    return res.data as CapaDetail;
  },

  async addProgress(id: number | string, note: string, percentComplete?: number): Promise<CapaDetail> {
    const res = await apiClient.post(ENDPOINTS.CAPA.PROGRESS(id), {
      note,
      percent_complete: percentComplete,
    });
    return res.data as CapaDetail;
  },

  /**
   * Attaching evidence can legitimately fail — the wrong type for the action, or
   * a date before the action was raised. Those come back as a 400 with the
   * reason, which the screen shows verbatim rather than "something went wrong":
   * the reason is the whole point of the check.
   */
  async addEvidence(
    id: number | string,
    payload: { evidence_type: string; description?: string; file_url?: string; evidence_date?: string },
  ): Promise<CapaDetail> {
    const res = await apiClient.post(ENDPOINTS.CAPA.EVIDENCE(id), payload);
    return res.data as CapaDetail;
  },

  async uploadEvidenceFile(
    id: number | string,
    file: { uri: string; name: string; type: string },
  ): Promise<string> {
    const form = new FormData();
    // React Native's FormData wants this shape for a file part.
    form.append('file', file as unknown as Blob);
    const res = await apiClient.post(ENDPOINTS.CAPA.EVIDENCE_UPLOAD(id), form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return (res.data as { file_url: string }).file_url;
  },

  async submit(id: number | string, notes?: string): Promise<CapaDetail> {
    const res = await apiClient.post(ENDPOINTS.CAPA.SUBMIT(id), { notes });
    return res.data as CapaDetail;
  },
};
