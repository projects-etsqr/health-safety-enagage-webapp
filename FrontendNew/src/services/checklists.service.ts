import axiosInstance from '../api/axiosInstance';
import type {
  ChecklistTemplate,
  ChecklistSubmissionSummary,
  ChecklistSubmissionDetail,
  CreateChecklistSubmissionPayload,
  SaveChecklistItemPayload,
} from '../types';

export const bootstrapChecklistTemplates = () =>
  axiosInstance
    .post<{ status: string; message: string; counts: Record<string, number> }>(
      '/checklists/templates/bootstrap',
    )
    .then((r) => r.data);

export const getChecklistTemplates = () =>
  axiosInstance.get<ChecklistTemplate[]>('/checklists/templates').then((r) => r.data);

export interface CreateChecklistTemplatePayload {
  display_name: string;
  description?: string;
  submitter_roles: string[];
  validator_roles: string[];
  items: { section_name: string; item_text: string; is_required: boolean }[];
  sla?: { draft_submission_sla_hours: number; validation_sla_hours: number };
}

export const createChecklistTemplate = (payload: CreateChecklistTemplatePayload) =>
  axiosInstance.post<ChecklistTemplate>('/checklists/templates', payload).then((r) => r.data);

export const deactivateChecklistTemplate = (checklistType: string) =>
  axiosInstance.delete(`/checklists/templates/${checklistType}`).then((r) => r.data);

export const createChecklistSubmission = (payload: CreateChecklistSubmissionPayload) =>
  axiosInstance
    .post<{
      submission_uuid: string;
      status: string;
      deadline?: { submit_due_at?: string; validate_due_at?: string | null };
    }>('/checklists/submissions', payload)
    .then((r) => r.data);

export const saveChecklistSubmissionItems = (
  submissionUuid: string,
  items: SaveChecklistItemPayload[],
) =>
  axiosInstance
    .put<{ status: string; updated_items: number }>(
      `/checklists/submissions/${submissionUuid}/items`,
      { items },
    )
    .then((r) => r.data);

export const submitChecklistSubmission = (submissionUuid: string) =>
  axiosInstance
    .post<{ status: string; submission_uuid: string }>(
      `/checklists/submissions/${submissionUuid}/submit`,
    )
    .then((r) => r.data);

export const validateChecklistSubmission = (
  submissionUuid: string,
  decision: 'approved' | 'rejected',
  notes?: string,
) =>
  axiosInstance
    .post<{ status: string; submission_uuid: string }>(
      `/checklists/submissions/${submissionUuid}/validate`,
      { decision, notes },
    )
    .then((r) => r.data);

export const getChecklistSubmissions = (
  filters?: Record<string, string | number | undefined>,
) => {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  const query = params.toString();
  return axiosInstance
    .get<ChecklistSubmissionSummary[]>(`/checklists/submissions${query ? `?${query}` : ''}`)
    .then((r) => r.data);
};

export const getChecklistSubmissionDetail = (submissionUuid: string) =>
  axiosInstance
    .get<ChecklistSubmissionDetail>(`/checklists/submissions/${submissionUuid}`)
    .then((r) => r.data);

export type {
  ChecklistTemplate,
  ChecklistSubmissionSummary,
  ChecklistSubmissionDetail,
  CreateChecklistSubmissionPayload,
  SaveChecklistItemPayload,
};
