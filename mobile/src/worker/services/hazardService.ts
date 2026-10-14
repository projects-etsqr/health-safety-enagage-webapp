import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { submitOrQueue, type SubmitResult } from '../../services/offlineQueue';
import type { PhotoAttachment } from '../types';

/**
 * The standing hazard register (`hazards`) as the worker meets it: logging an
 * entry, and following it through the eight stages.
 *
 * Only the register. One-off risk observations on `risk_reports` used to live
 * here too and now have their own `riskService` — the two are different
 * tables with different lifecycles, and holding both behind one name is how a
 * caller ends up writing to the wrong one.
 */

/** What a worker logs into the standing hazard register. */
export interface LogHazardRequest {
  hazard_name: string;
  category_id?: number;
  description?: string;
  severity?: string;
  probability?: string;
  location?: string;
  location_station_id?: number;
  controls?: string;
  persons_exposed?: number;
  /** The "It is still there" toggle — collected by the form since it was
   *  written and, until now, never actually sent. */
  still_present?: boolean;
  /** Photos and video of the condition. */
  photos?: PhotoAttachment[];
  gps_latitude?: string;
  gps_longitude?: string;
}

/** One register entry as the worker sees it, with its derived stage. */
export interface MyHazard {
  id: number;
  reference: string | null;
  hazard_name: string | null;
  description: string | null;
  severity: string | null;
  probability: string | null;
  register_status: string | null;
  assessed_priority: string | null;
  risk_score: number | null;
  interim_control: string | null;
  planned_controls: string | null;
  station_name: string | null;
  category_name: string | null;
  logged_at: string | null;
  response_due_at: string | null;
  is_overdue: boolean | null;
  stage: string | null;
  stage_number: number | null;
  stage_label: string | null;
  completed_stages: string[];
  total_stages: number | null;
}

export const hazardService = {
  /**
   * Log a hazard into the standing register.
   *
   * Distinct from `riskService.reportRisk`, which writes a one-off observation
   * to `risk_reports`. This creates a register entry a supervisor assesses,
   * contains and controls, and which the worker can then follow through all
   * eight stages — the same lifecycle an incident runs.
   */
  async logHazard(payload: LogHazardRequest): Promise<SubmitResult<MyHazard>> {
    const { photos, ...body } = payload;
    const media = photos ?? [];
    const hasMedia = media.length > 0;

    // Multipart only when there is something to attach, matching how the four
    // report workflows post. Offline: the files stay on the device and the
    // body is rebuilt on replay.
    return submitOrQueue<MyHazard>(
      ENDPOINTS.HAZARD_REGISTER.LOG,
      body,
      {
        kind: hasMedia ? 'multipart' : 'json',
        photos: hasMedia ? media.map(m => ({ uri: m.uri, name: m.name, type: m.type })) : undefined,
        client: hasMedia ? 'workerUpload' : 'worker',
        label: 'Unsafe act register entry',
      },
    );
  },

  /** The org's own hazard categories, for the log form's dropdown.
   *
   *  The form used to carry these hard-coded as ids 1-10, which belong to
   *  organisation 1 — so a worker anywhere else picked a label from one org and
   *  filed the hazard against another's category row.
   */
  async categories(): Promise<Array<{ id: number; category_name: string }>> {
    const { data } = await apiClient.get<Array<{ id: number; category_name: string }>>(
      ENDPOINTS.HAZARD_REGISTER.CATEGORIES,
    );
    return data ?? [];
  },

  /** Every hazard this worker logged, newest first, each with its stage. */
  async myHazards(): Promise<MyHazard[]> {
    const { data } = await apiClient.get<MyHazard[]>(ENDPOINTS.HAZARD_REGISTER.MY_LOGS);
    return data ?? [];
  },

  async getHazard(id: number): Promise<MyHazard> {
    const { data } = await apiClient.get<MyHazard>(ENDPOINTS.HAZARD_REGISTER.DETAIL(id));
    return data;
  },
};
