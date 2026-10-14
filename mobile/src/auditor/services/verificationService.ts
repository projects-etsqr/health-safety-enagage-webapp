import { apiClient } from '../../api/client';
import { PERMIT_WORKFLOW, HAZARD_REGISTER } from '../../api/endpoints';

export interface PermitToVerify {
  id: number;
  permit_ref?: string | null;
  work_description?: string | null;
  location_station_id?: number | null;
  validity_end?: string | null;
  workflow_status?: string | null;
  auditor_verified_at?: string | null;
  verification_result?: string | null;
}

export interface HazardToVerify {
  id: number;
  hazard_name?: string | null;
  severity?: string | null;
  register_status?: string | null;
  controls?: string | null;
  auditor_verified_at?: string | null;
}

export interface CloseOutIncident {
  id: number;
  reference: string;
  incident_type?: string | null;
  severity?: string | null;
  workflow_status?: string | null;
  investigation_status?: string | null;
  has_five_why: boolean;
  closure_notes?: string | null;
  lessons_learned?: string | null;
  communicated_to_teams?: string | null;
  manager_signature?: string | null;
  closed_at?: string | null;
  auditor_verified_at?: string | null;
  verification_notes?: string | null;
}

export interface TrailEntry {
  reference: string;
  record_id: number;
  module: string;
  action: string;
  occurred_at: string | null;
}

/** Spec's PTW verification outcomes, mapped to the values the backend stores. */
export const VERIFICATION_RESULTS = [
  { label: 'Pass', value: 'valid' },
  { label: 'Fail', value: 'invalid' },
  { label: 'Conditional', value: 'not_displayed' },
] as const;

export const verificationService = {
  async permitsToVerify(): Promise<PermitToVerify[]> {
    const { data } = await apiClient.get(PERMIT_WORKFLOW.AUDIT_LIST);
    return Array.isArray(data) ? data : [];
  },

  async verifyPermit(id: number, result: string, notes?: string) {
    const { data } = await apiClient.post(PERMIT_WORKFLOW.VERIFY(id), {
      verification_result: result,
      verification_notes: notes,
    });
    return data;
  },

  async hazardsToVerify(): Promise<HazardToVerify[]> {
    const { data } = await apiClient.get(HAZARD_REGISTER.AUDIT_LIST);
    return Array.isArray(data) ? data : [];
  },

  async verifyHazard(id: number, notes?: string) {
    const { data } = await apiClient.post(HAZARD_REGISTER.VERIFY(id), {
      verification_notes: notes,
    });
    return data;
  },

  /** Incidents whose close-out the auditor validates (read + sign-off only). */
  async closeOutList(): Promise<CloseOutIncident[]> {
    const { data } = await apiClient.get('/incident-workflow/audit-list');
    return Array.isArray(data) ? data : [];
  },

  async verifyCloseOut(id: number, notes?: string) {
    const { data } = await apiClient.post(`/incident-workflow/${id}/verify`, {
      verification_notes: notes,
    });
    return data;
  },

  async auditTrail(module?: string): Promise<TrailEntry[]> {
    const { data } = await apiClient.get('/audit-trail', {
      params: module ? { module } : undefined,
    });
    return Array.isArray(data) ? data : [];
  },
};
