import apiClient, { uploadClient } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { submitOrQueue, type SubmitResult } from '../../services/offlineQueue';
import {
  Incident, IncidentListResponse,
  ReportIncidentRequest, ReportNearMissRequest, ReportUnsafeActRequest,
  PhotoAttachment,
} from '../types';

function buildFormData(payload: Record<string, any>, photos?: PhotoAttachment[]): FormData {
  const form = new FormData();
  form.append('data', JSON.stringify(payload));
  photos?.forEach((photo, i) => {
    // `media_`, not `photo_` — these are photos and videos. The backend
    // accepts both prefixes; see app/utils/report_media.py.
    form.append(`media_${i}`, { uri: photo.uri, name: photo.name, type: photo.type } as any);
  });
  return form;
}

export const incidentService = {
  async getIncidents(params?: { type?: string; status?: string; mine?: boolean }): Promise<IncidentListResponse> {
    const { data } = await apiClient.get<IncidentListResponse>(ENDPOINTS.INCIDENTS.LIST, { params });
    return data;
  },

  async getIncident(id: string): Promise<Incident> {
    const { data } = await apiClient.get<Incident>(ENDPOINTS.INCIDENTS.DETAIL(id));
    return data;
  },

  async reportIncident(payload: ReportIncidentRequest): Promise<SubmitResult<Incident>> {
    const photos = payload.photos ?? [];
    const hasPhotos = photos.length > 0;
    // Offline: the report is stored as a draft and replayed on reconnect. The
    // photo files stay on the device, so the multipart body is rebuilt then.
    return submitOrQueue<Incident>(
      ENDPOINTS.INCIDENTS.REPORT,
      hasPhotos ? { ...payload, photos: undefined } : payload,
      {
        kind: hasPhotos ? 'multipart' : 'json',
        photos: hasPhotos ? photos.map(p => ({ uri: p.uri, name: p.name, type: p.type })) : undefined,
        client: hasPhotos ? 'workerUpload' : 'worker',
        label: 'Incident report',
      },
    );
  },

  async reportNearMiss(payload: ReportNearMissRequest): Promise<SubmitResult<Incident>> {
    const photos = payload.photos ?? [];
    const hasPhotos = photos.length > 0;
    // Offline: the report is stored as a draft and replayed on reconnect. The
    // photo files stay on the device, so the multipart body is rebuilt then.
    return submitOrQueue<Incident>(
      ENDPOINTS.NEAR_MISS.REPORT,
      hasPhotos ? { ...payload, photos: undefined } : payload,
      {
        kind: hasPhotos ? 'multipart' : 'json',
        photos: hasPhotos ? photos.map(p => ({ uri: p.uri, name: p.name, type: p.type })) : undefined,
        client: hasPhotos ? 'workerUpload' : 'worker',
        label: 'Near miss report',
      },
    );
  },

  async reportUnsafeAct(payload: ReportUnsafeActRequest): Promise<SubmitResult<Incident>> {
    const photos = payload.photos ?? [];
    const hasPhotos = photos.length > 0;
    // Offline: the report is stored as a draft and replayed on reconnect. The
    // photo files stay on the device, so the multipart body is rebuilt then.
    return submitOrQueue<Incident>(
      ENDPOINTS.UNSAFE_ACT.REPORT,
      hasPhotos ? { ...payload, photos: undefined } : payload,
      {
        kind: hasPhotos ? 'multipart' : 'json',
        photos: hasPhotos ? photos.map(p => ({ uri: p.uri, name: p.name, type: p.type })) : undefined,
        client: hasPhotos ? 'workerUpload' : 'worker',
        label: 'Unsafe act report',
      },
    );
  },
};

/**
 * One of this worker's incidents, with its position on the eight stages.
 *
 * Incidents nest their stage block where the other families return it flat.
 * It is passed through as it arrives rather than reshaped here, so whatever
 * reads it next gets the server's own shape.
 */
export interface MyIncident {
  id: number;
  description: string | null;
  incident_type: string | null;
  severity: string | null;
  workflow_status: string | null;
  reported_at: string | null;
  created_at: string | null;
  incident_date_time: string | null;
  /** P1..P5 from the deterministic assessor, and its human label. */
  severity_priority: string | null;
  severity_label: string | null;
  is_hipo: boolean | null;
  is_recurring_pattern: boolean | null;
  anyone_injured: string | null;
  /** Reportable to the regulator. The worker who raised it should know. */
  statutory_reportable: boolean | null;
  statutory_due_at: string | null;
  investigation_due_at: string | null;
  stage: {
    stage: string | null;
    stage_number: number | null;
    stage_label: string | null;
    completed_stages: string[];
    total_stages: number | null;
    is_closed: boolean;
  } | null;
}

export const myIncidentsService = {
  /** Every incident this worker reported, newest first, each with its stage. */
  async mine(): Promise<MyIncident[]> {
    const { data } = await apiClient.get<MyIncident[]>(ENDPOINTS.INCIDENTS.MY_REPORTS);
    return data ?? [];
  },
};
