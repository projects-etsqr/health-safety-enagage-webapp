import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

/**
 * Everything this worker has submitted, from all five families, on one list.
 *
 * "Recent Submissions" on the Reports screen used to read `/worker/incidents`
 * and nothing else, so a worker who reported a near miss, an unsafe act, a risk
 * or a hazard saw no trace of it there — the screen said "Your reported
 * incidents and observations will appear here" and delivered only the first.
 * A reporter who cannot see what they reported stops reporting.
 *
 * Each family has its own table and its own endpoint, and the three shapes do
 * not agree: incidents carry `incident_ref` and `status`, the factory-built
 * families carry `workflow_status` and no reference at all, and the hazard
 * register carries `reference`, `register_status` and `hazard_name`. They are
 * normalised here rather than in the screen so the list has one shape to render
 * and one rule for sorting.
 */

export type SubmissionFamily = 'incident' | 'near_miss' | 'unsafe_act' | 'risk' | 'hazard';

export interface Submission {
  /** Unique across families — an incident and a near miss can share an id. */
  key: string;
  family: SubmissionFamily;
  reference: string;
  title: string;
  /** Raw status, as that family records it. The screen turns it into a label. */
  status: string | null;
  severity: string | null;
  /** ISO timestamp, for sorting. Null sorts last. */
  at: string | null;
}

export const FAMILY_LABEL: Record<SubmissionFamily, string> = {
  incident: 'Incident',
  near_miss: 'Near Miss',
  unsafe_act: 'Unsafe Act (reported before merge)',
  risk: 'Risk',
  hazard: 'Unsafe Act',
};

/** Matches the report tiles above the list, so a submission is the colour of
 *  the button that created it. */
export const FAMILY_TINT: Record<SubmissionFamily, { ink: string; tint: string }> = {
  incident:   { ink: '#DC2626', tint: '#FEE2E2' },
  near_miss:  { ink: '#B45309', tint: '#FEF3C7' },
  unsafe_act: { ink: '#1D4ED8', tint: '#DBEAFE' },
  risk:       { ink: '#6D28D9', tint: '#EDE9FE' },
  hazard:     { ink: '#1D4ED8', tint: '#DBEAFE' },
};

/** The API client unwraps `{success, data}`, but `/worker/incidents` nests its
 *  rows one level further under `items`. Both shapes end up here. */
function rows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function fetchIncidents(): Promise<Submission[]> {
  const { data } = await apiClient.get(ENDPOINTS.INCIDENTS.LIST, { params: { mine: true } });
  return rows(data).map((r: any) => ({
    key: `incident:${r.id}`,
    family: 'incident' as const,
    reference: r.incident_ref || `INC-${r.id}`,
    title: r.description || r.incident_type || 'Incident',
    status: r.status ?? null,
    severity: r.severity ?? null,
    at: r.created_at ?? null,
  }));
}

/** near miss, unsafe act and risk all come off the shared workflow factory, so
 *  one reader covers the three. `prefix` is the reference stem the rest of the
 *  platform prints for that family. */
async function fetchWorkflowFamily(
  family: Exclude<SubmissionFamily, 'incident' | 'hazard'>,
  url: string,
  prefix: string,
): Promise<Submission[]> {
  const { data } = await apiClient.get(url);
  return rows(data).map((r: any) => ({
    key: `${family}:${r.id}`,
    family,
    reference: `${prefix}-${r.id}`,
    title: r.description || FAMILY_LABEL[family],
    status: r.workflow_status ?? null,
    severity: r.severity ?? null,
    at: r.reported_at ?? r.created_at ?? null,
  }));
}

async function fetchHazards(): Promise<Submission[]> {
  const { data } = await apiClient.get(ENDPOINTS.HAZARD_REGISTER.MY_LOGS);
  return rows(data).map((r: any) => ({
    key: `hazard:${r.id}`,
    family: 'hazard' as const,
    reference: r.reference || `HAZ-${r.id}`,
    title: r.hazard_name || r.description || 'Unsafe act',
    status: r.register_status ?? null,
    severity: r.severity ?? null,
    at: r.logged_at ?? null,
  }));
}

export const submissionsService = {
  /**
   * All five families, newest first.
   *
   * Settled rather than all-or-nothing: one family's endpoint failing should
   * cost that family's rows, not the whole list. A worker offline mid-shift
   * still sees whatever came back.
   */
  async mine(): Promise<Submission[]> {
    const results = await Promise.allSettled([
      fetchIncidents(),
      fetchWorkflowFamily('near_miss', ENDPOINTS.NEAR_MISS.MY_REPORTS, 'NEA'),
      fetchWorkflowFamily('unsafe_act', ENDPOINTS.UNSAFE_ACT.MY_REPORTS, 'UNS'),
      fetchWorkflowFamily('risk', ENDPOINTS.RISK.MY_REPORTS, 'RIS'),
      fetchHazards(),
    ]);

    return results
      .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      .sort((a, b) => {
        // Undated rows sort last rather than to the top, where a missing
        // timestamp would otherwise read as the most recent thing submitted.
        if (!a.at) return 1;
        if (!b.at) return -1;
        return b.at.localeCompare(a.at);
      });
  },
};
