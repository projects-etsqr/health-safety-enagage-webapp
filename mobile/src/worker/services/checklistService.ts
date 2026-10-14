import apiClient, { uploadClient } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { Checklist, ChecklistListResponse, SubmitChecklistRequest } from '../types';

/** A checklist submission record as returned by the /checklists API. */
export interface ChecklistSubmission {
  submission_uuid: string;
  checklist_type: string;
  checklist_date: string;
  submitted_by_email: string;
  submitted_by_role: string;
  status: 'draft' | 'submitted' | 'validated' | 'rejected';
  created_at: string;
  updated_at: string;
  submit_sla_breached: number;
  validate_sla_breached: number;
  validation_decision?: string | null;
  validation_notes?: string | null;
}

export const checklistService = {
  async getChecklists(params?: { status?: string; type?: string }): Promise<ChecklistListResponse> {
    const { data } = await apiClient.get<ChecklistListResponse>(ENDPOINTS.CHECKLISTS.LIST, { params });
    return data;
  },

  /** Checklists the signed-in user has started or submitted, newest first. */
  async getMySubmissions(params?: { status?: string; limit?: number }): Promise<ChecklistSubmission[]> {
    const { data } = await apiClient.get<ChecklistSubmission[]>(
      ENDPOINTS.CHECKLISTS.SUBMISSIONS,
      { params: { mine: true, ...params } },
    );
    return Array.isArray(data) ? data : [];
  },

  async getChecklist(id: string): Promise<Checklist> {
    const { data } = await apiClient.get<Checklist>(ENDPOINTS.CHECKLISTS.DETAIL(id));
    return data;
  },

  async submitChecklist(payload: SubmitChecklistRequest): Promise<Checklist> {
    const hasPhotos = payload.photo_urls && payload.photo_urls.length > 0;
    if (hasPhotos) {
      const form = new FormData();
      form.append('data', JSON.stringify({ ...payload, photo_urls: undefined }));
      payload.photo_urls!.forEach((uri, i) => {
        form.append(`photo_${i}`, { uri, name: `photo_${i}.jpg`, type: 'image/jpeg' } as any);
      });
      const { data } = await uploadClient.post<Checklist>(
        ENDPOINTS.CHECKLISTS.SUBMIT(payload.checklist_id), form,
      );
      return data;
    }
    const { data } = await apiClient.post<Checklist>(
      ENDPOINTS.CHECKLISTS.SUBMIT(payload.checklist_id), payload,
    );
    return data;
  },
};
