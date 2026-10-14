/**
 * WF-05 · the auditor's ten steps, from the phone.
 *
 * Steps 4 to 8 happen in the field, which is where the signal is not. Every call
 * that writes something the auditor did on site goes through `submitOrQueue`, so
 * a checklist answer given in a tank farm is stored and replayed rather than
 * lost — "the checklist must run fully offline and sync afterwards; this is not
 * optional for a field audit tool".
 *
 * Reads are not queued. A queued read is a stale read, and an auditor is better
 * told the brief pack could not be fetched than shown one from a fortnight ago.
 */
import { apiClient } from '../../api/client';
import { submitOrQueue, SubmitResult } from '../../services/offlineQueue';

// ── The vocabulary ───────────────────────────────────────────────────────────

/** The point rubric. Full compliance is worth twice an observation. */
export type ItemResponse = 'full' | 'partial' | 'none' | 'na';

export type Classification =
  | 'conformance' | 'observation' | 'minor_nc' | 'major_nc' | 'critical';

export type ScoreBand = 'excellent' | 'good' | 'acceptable' | 'poor';

export type OverallRating = 'satisfactory' | 'requires_improvement' | 'unsatisfactory';

export type StepState = 'done' | 'active' | 'blocked' | 'todo';

export interface AuditStep {
  number: number;
  key: string;
  phase: string;
  label: string;
  owner: string;
  owner_label?: string;
  state: StepState;
  automatic: boolean;
  hard_stop: boolean;
  on_mobile: boolean;
  detail?: string;
}

export interface ChecklistItem {
  id: number;
  seq?: number;
  section?: string | null;
  title: string;
  question?: string | null;
  clause?: string | null;
  is_critical: boolean;
  response?: ItemResponse | null;
  remarks?: string | null;
  classification?: Classification | null;
  evidence_count: number;
  points_earned?: number | null;
  points_possible?: number | null;
  answered_at?: string | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
}

export interface Evidence {
  id: number;
  audit_id: number;
  checklist_item_id?: number | null;
  finding_id?: number | null;
  kind: 'photo' | 'video' | 'document' | 'note' | 'scan' | 'interview';
  file_url?: string | null;
  caption?: string | null;
  scanned_ref?: string | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  captured_at?: string | null;
  subject_name?: string | null;
  interview_prompt?: string | null;
  competence_verified?: boolean | null;
}

export interface Finding {
  id: number;
  audit_id: number;
  checklist_item_id?: number | null;
  finding_ref?: string | null;
  section?: string | null;
  title: string;
  description?: string | null;
  clause?: string | null;
  classification: Classification;
  auto_classified: boolean;
  is_repeat: boolean;
  repeat_of_audit_id?: number | null;
  corrective_action_due?: string | null;
  capa_id?: number | null;
  status: string;
  verified_at?: string | null;
  verification_notes?: string | null;
  closed_at?: string | null;
  evidence: Evidence[];
}

export interface SectionScore {
  section: string;
  score: number;
  assessed: number;
  points_earned: number;
  points_possible: number;
  below_threshold: boolean;
}

export interface Audit {
  id: number;
  audit_ref?: string | null;
  title: string;
  checklist_type?: string | null;
  site_id?: number | null;
  site_name?: string | null;
  department?: string | null;
  shift?: string | null;
  auditor_id?: number | null;
  scheduled_date?: string | null;
  due_date?: string | null;
  status: string;
  priority?: string | null;
  progress?: number | null;
  compliance_score?: number | null;
  findings: ChecklistItem[];
  submitted_at?: string | null;

  trigger_type?: string | null;
  trigger_label?: string | null;
  audit_scope?: string | null;
  risk_band?: string | null;
  site_score?: number | null;
  audit_team: Array<{ user_id: number; role: string }>;
  auditee_manager_id?: number | null;
  auditee_notified_at?: string | null;
  notice_due_date?: string | null;
  brief_pack_generated_at?: string | null;
  brief_pack_reviewed_at?: string | null;
  opening_meeting?: Record<string, any> | null;
  opening_meeting_at?: string | null;
  closing_meeting?: Record<string, any> | null;
  closing_meeting_at?: string | null;
  auditee_confirmed_at?: string | null;
  auditee_signed_name?: string | null;
  findings_locked_at?: string | null;
  findings_locked: boolean;
  score_band?: ScoreBand | null;
  overall_rating?: OverallRating | null;
  section_scores: SectionScore[];
  finding_counts: Record<Classification, number>;
  classified_findings: Finding[];
  auditor_signed_name?: string | null;
  report_ref?: string | null;
  report_issued_at?: string | null;
  report_approved_at?: string | null;
  re_audit_required: boolean;
  re_audit_reason?: string | null;
  re_audit_due_date?: string | null;
  closed_at?: string | null;
  open_finding_count: number;

  steps: AuditStep[];
  current_step?: number | null;
  current_step_label?: string | null;

  stage?: string | null;
  stage_number?: number | null;
  stage_label?: string | null;
  completed_stages: string[];
  total_stages?: number | null;
}

export interface RespondResult {
  item: ChecklistItem;
  answered: number;
  total: number;
  running_score: number;
  running_band: ScoreBand;
  /** Set when a critical item scored zero — the alert has already gone out. */
  alert?: string | null;
  is_repeat: boolean;
}

export interface ScoreBreakdown {
  score: number;
  band: ScoreBand;
  band_label: string;
  points_earned: number;
  points_possible: number;
  assessed: number;
  not_applicable: number;
  unanswered: number;
  overall_rating: OverallRating;
  explanation: string;
  sections: SectionScore[];
  counts: Record<Classification, number>;
}

export interface ProgrammeRow {
  site_id?: number | null;
  site_name?: string | null;
  risk_band: string;
  band_label?: string | null;
  site_score?: number | null;
  qualifying?: string | null;
  inspection_frequency?: string | null;
  audit_frequency?: string | null;
  next_inspection_due?: string | null;
  next_audit_due?: string | null;
  last_audit_at?: string | null;
  re_audit_trigger?: string | null;
  overdue: boolean;
}

export interface AuditReport {
  audit_id: number;
  report_ref?: string | null;
  issued_at?: string | null;
  title: string;
  site_name?: string | null;
  checklist_type?: string | null;
  conducted_on?: string | null;
  lead_auditor?: string | null;
  score: ScoreBreakdown;
  findings: Finding[];
  benchmark: {
    previous_audit_ref?: string | null;
    previous_score?: number | null;
    previous_rating?: string | null;
    delta?: number | null;
    repeat_findings: number;
  };
  clause_map: Array<{ clause: string; findings: number; worst: Classification }>;
  escalations: Array<{ key: string; detail?: string | null }>;
  distributed_to: number[];
  signed_by?: string | null;
  auditee_signed_by?: string | null;
}

// ── Display metadata, mirrored from the backend's reference payload ──────────
//
// Duplicated here on purpose: the phone must render a classification chip before
// /audits/reference has ever answered, which on a first launch in a dead zone is
// the normal case. `loadReference()` overwrites these at runtime, so the backend
// stays the authority and this is only the cold-start fallback.

export const CLASSIFICATION_META: Record<Classification, {
  label: string; short: string; color: string; bg: string; severity: number;
  meaning: string; actionDays: number | null;
}> = {
  conformance: {
    label: 'Conformance', short: 'CONF', color: '#047857', bg: '#D1FAE5', severity: 0,
    meaning: 'Meets the requirement. Scored as a positive — audits record what is working, not only what is wrong.',
    actionDays: null,
  },
  observation: {
    label: 'Observation', short: 'OBS', color: '#1D4ED8', bg: '#DBEAFE', severity: 1,
    meaning: 'Compliant but improvable. Raises a finding, but not a non-conformance.',
    actionDays: null,
  },
  minor_nc: {
    label: 'Minor NC', short: 'MINOR', color: '#B45309', bg: '#FEF3C7', severity: 2,
    meaning: 'A lapse that does not undermine the system. Raised automatically when a section falls below 60%.',
    actionDays: 30,
  },
  major_nc: {
    label: 'Major NC', short: 'MAJOR', color: '#B91C1C', bg: '#FEE2E2', severity: 3,
    meaning: 'A systemic failure. Raised automatically when a critical item scores zero. Safety Manager notified within 24 hours; corrective action required within 7 days.',
    actionDays: 7,
  },
  critical: {
    label: 'Critical / Regulatory', short: 'CRITICAL', color: '#FFFFFF', bg: '#B91C1C', severity: 4,
    meaning: 'Immediate danger or a legal breach. Executive notified at once and work may be suspended.',
    actionDays: 1,
  },
};

export const RESPONSE_META: Record<ItemResponse, {
  label: string; points: string; color: string; bg: string;
}> = {
  full: { label: 'Full', points: '2 pts', color: '#047857', bg: '#D1FAE5' },
  partial: { label: 'Partial', points: '1 pt', color: '#B45309', bg: '#FEF3C7' },
  none: { label: 'None', points: '0 pts', color: '#B91C1C', bg: '#FEE2E2' },
  na: { label: 'N/A', points: 'excluded', color: '#475569', bg: '#F1F5F9' },
};

export const BAND_META: Record<ScoreBand, { label: string; range: string; color: string }> = {
  excellent: { label: 'Excellent', range: '90% and above', color: '#059669' },
  good: { label: 'Good', range: '75 – 89%', color: '#16A34A' },
  acceptable: { label: 'Acceptable', range: '60 – 74%', color: '#F59E0B' },
  poor: { label: 'Poor', range: 'Below 60%', color: '#DC2626' },
};

export const RATING_META: Record<OverallRating, { label: string; color: string; bg: string }> = {
  satisfactory: { label: 'Satisfactory', color: '#047857', bg: '#D1FAE5' },
  requires_improvement: { label: 'Requires Improvement', color: '#B45309', bg: '#FEF3C7' },
  unsatisfactory: { label: 'Unsatisfactory', color: '#B91C1C', bg: '#FEE2E2' },
};

export const RISK_BAND_META: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#FFFFFF', bg: '#DC2626' },
  high: { label: 'High', color: '#FFFFFF', bg: '#EA580C' },
  medium: { label: 'Medium', color: '#FFFFFF', bg: '#F59E0B' },
  low: { label: 'Low', color: '#FFFFFF', bg: '#059669' },
};

export interface AuditReference {
  flow: {
    steps: Array<AuditStep & { role_notes: Record<string, string> }>;
    roles: Array<{ key: string; label: string; surface: string; summary: string; owns: string[] }>;
    mobile_steps: number[];
    web_steps: number[];
    spec_mapping: Array<{ document_role: string; platform_role: string; note: string }>;
  };
  scoring: {
    points: Record<string, any>;
    formula: string;
    bands: Array<{ key: string; label: string; range: string; floor: number }>;
    alert_threshold: number;
    re_audit_threshold: number;
    section_nc_threshold: number;
    minor_nc_limit: number;
    classifications: Array<{ key: string; label: string; meaning: string; action_days: number | null }>;
    ratings: Record<string, string>;
  };
  triggers: Array<{ key: string; label: string; detail: string; requires_notice: boolean }>;
  frequency: Array<Record<string, any>>;
  escalations: Array<{ key: string; label: string; detail: string }>;
  notice_days: number;
  brief_pack_days: number;
}

let cachedReference: AuditReference | null = null;

// ── Payload builders ─────────────────────────────────────────────────────────

export interface OpeningMeetingPayload {
  scope: string;
  method: string;
  sampling_approach: string;
  attendees: string[];
  auditee_present: boolean;
  notes?: string;
  gps_latitude?: number;
  gps_longitude?: number;
}

export interface ClosingMeetingPayload {
  attendees: string[];
  factual_accuracy_confirmed: boolean;
  agreed_timeframes?: Record<string, string>;
  auditee_signature?: string;
  auditee_signed_name?: string;
  auditor_signature?: string;
  auditor_signed_name?: string;
  notes?: string;
  disputes?: string;
}

export interface EvidencePayload {
  checklist_item_id?: number;
  finding_id?: number;
  kind: Evidence['kind'];
  file_url?: string;
  caption?: string;
  scanned_ref?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  captured_at?: string;
  subject_employee_id?: number;
  subject_name?: string;
  interview_prompt?: string;
  competence_verified?: boolean;
}

const q = (label: string) => ({ label, client: 'default' as const });

export const auditService = {
  // ── Reference ─────────────────────────────────────────────────────────────
  /** The rubric, the classifications, the ten steps. Cached for the walk. */
  async loadReference(force = false): Promise<AuditReference | null> {
    if (cachedReference && !force) return cachedReference;
    try {
      const { data } = await apiClient.get<AuditReference>('/audits/reference');
      cachedReference = data;
      return data;
    } catch {
      return cachedReference;
    }
  },

  reference(): AuditReference | null {
    return cachedReference;
  },

  // ── Read ──────────────────────────────────────────────────────────────────
  async listAssigned(): Promise<Audit[]> {
    const { data } = await apiClient.get<Audit[]>('/audits/');
    return data;
  },

  async get(id: number): Promise<Audit> {
    const { data } = await apiClient.get<Audit>(`/audits/${id}`);
    return data;
  },

  async programme(refresh = false): Promise<ProgrammeRow[]> {
    const { data } = await apiClient.get<ProgrammeRow[]>('/audits/programme', {
      params: refresh ? { refresh: true } : undefined,
    });
    return data;
  },

  async escalations(): Promise<{
    audits_not_conducted: Array<Record<string, any>>;
    definitions: Array<{ key: string; label: string; detail: string }>;
  }> {
    const { data } = await apiClient.get('/audits/escalations');
    return data;
  },

  async score(id: number): Promise<ScoreBreakdown> {
    const { data } = await apiClient.get<ScoreBreakdown>(`/audits/${id}/score`);
    return data;
  },

  async report(id: number): Promise<AuditReport> {
    const { data } = await apiClient.get<AuditReport>(`/audits/${id}/report`);
    return data;
  },

  // ── Step 03 · brief pack ──────────────────────────────────────────────────
  async briefPack(id: number, regenerate = false): Promise<{
    audit_id: number; audit_ref?: string; generated_at?: string;
    reviewed_at?: string; due_date?: string; pack: Record<string, any>;
  }> {
    const { data } = await apiClient.get(`/audits/${id}/brief-pack`, {
      params: regenerate ? { regenerate: true } : undefined,
    });
    return data;
  },

  async markBriefReviewed(id: number): Promise<SubmitResult<Audit>> {
    return submitOrQueue<Audit>(`/audits/${id}/brief-pack/reviewed`, {}, q('Brief pack reviewed'));
  },

  // ── Step 04 · opening meeting ─────────────────────────────────────────────
  async openingMeeting(id: number, payload: OpeningMeetingPayload): Promise<SubmitResult<Audit>> {
    return submitOrQueue<Audit>(`/audits/${id}/opening-meeting`, payload, q('Opening meeting'));
  },

  // ── Step 05 · one answer at a time ────────────────────────────────────────
  /**
   * Not queued through `submitOrQueue`, because the caller needs the running
   * score and the critical alert back. The checklist screen holds the answer
   * locally and re-sends on reconnect instead — a queued answer whose alert
   * nobody saw is worse than one the screen knows is still pending.
   */
  async respond(
    auditId: number,
    itemId: number,
    body: {
      response: ItemResponse;
      remarks?: string;
      classification?: Classification;
      gps_latitude?: number;
      gps_longitude?: number;
    },
  ): Promise<RespondResult> {
    const { data } = await apiClient.post<RespondResult>(
      `/audits/${auditId}/items/${itemId}/respond`, body,
    );
    return data;
  },

  async resume(id: number): Promise<Audit> {
    const { data } = await apiClient.post<Audit>(`/audits/${id}/resume`, {});
    return data;
  },

  // ── Step 06 · evidence ────────────────────────────────────────────────────
  /** Upload the file first, then attach it. The file URL is what step 06 links. */
  async uploadEvidenceFile(
    auditId: number, photo: { uri: string; name: string; type: string },
  ): Promise<string> {
    const form = new FormData();
    form.append('file', photo as any);
    const { uploadClient } = await import('../../api/client');
    const { data } = await uploadClient.post(`/audits/${auditId}/evidence/upload`, form);
    return data.file_url;
  },

  async addEvidence(
    auditId: number, payload: EvidencePayload,
    photo?: { uri: string; name: string; type: string },
  ): Promise<SubmitResult<Evidence>> {
    return submitOrQueue<Evidence>(`/audits/${auditId}/evidence`, payload, {
      ...q(`Evidence — ${payload.caption || payload.kind}`),
      kind: photo ? 'multipart' : 'json',
      photos: photo ? [photo] : undefined,
    });
  },

  async listEvidence(auditId: number): Promise<Evidence[]> {
    const { data } = await apiClient.get<Evidence[]>(`/audits/${auditId}/evidence`);
    return data;
  },

  async deleteEvidence(auditId: number, evidenceId: number): Promise<void> {
    await apiClient.delete(`/audits/${auditId}/evidence/${evidenceId}`);
  },

  // ── Step 07 · classify and score ──────────────────────────────────────────
  async classify(
    id: number,
    body: {
      items?: Array<Partial<ChecklistItem> & { id: number; response?: ItemResponse | null }>;
      findings?: Array<{
        checklist_item_id?: number; section?: string; title: string;
        description?: string; clause?: string; classification: Classification;
        corrective_action_due?: string;
      }>;
      shift?: string;
      notes?: string;
    },
  ): Promise<SubmitResult<Audit>> {
    return submitOrQueue<Audit>(`/audits/${id}/classify`, body, q('Findings & score'));
  },

  // ── Step 08 · closing meeting ─────────────────────────────────────────────
  async closingMeeting(id: number, payload: ClosingMeetingPayload): Promise<SubmitResult<Audit>> {
    return submitOrQueue<Audit>(`/audits/${id}/closing-meeting`, payload, q('Closing meeting'));
  },

  // ── Step 09 · issue the report ────────────────────────────────────────────
  async issueReport(
    id: number, body: { auditor_signature: string; auditor_signed_name: string; summary?: string },
  ): Promise<SubmitResult<Audit>> {
    return submitOrQueue<Audit>(`/audits/${id}/issue-report`, body, q('Report signed & issued'));
  },

  // ── Step 10 · track the findings out ──────────────────────────────────────
  async findings(id: number, openOnly = false): Promise<Finding[]> {
    const { data } = await apiClient.get<Finding[]>(`/audits/${id}/findings`, {
      params: openOnly ? { open_only: true } : undefined,
    });
    return data;
  },

  /** Everything still to verify, across every audit this auditor holds. */
  async openFindings(): Promise<Finding[]> {
    const { data } = await apiClient.get<Finding[]>('/audits/findings/open');
    return data;
  },

  async verifyFinding(
    auditId: number, findingId: number,
    body: { effective: boolean; verification_notes?: string; gps_latitude?: number; gps_longitude?: number },
  ): Promise<SubmitResult<Finding>> {
    return submitOrQueue<Finding>(
      `/audits/${auditId}/findings/${findingId}/verify`, body,
      q(body.effective ? 'Finding verified closed' : 'Finding sent back'),
    );
  },

  async close(id: number): Promise<Audit> {
    const { data } = await apiClient.post<Audit>(`/audits/${id}/close`, {});
    return data;
  },
};

// ── Small helpers the screens share ──────────────────────────────────────────

export function bandFor(score?: number | null): ScoreBand {
  if (score == null) return 'poor';
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'acceptable';
  return 'poor';
}

/** The classification an answer starts at — the app's suggestion, not the answer. */
export function defaultClassification(
  response: ItemResponse | null | undefined, isCritical: boolean,
): Classification | null {
  if (!response || response === 'na') return null;
  if (isCritical && response === 'none') return 'major_nc';
  if (response === 'full') return 'conformance';
  if (response === 'partial') return 'observation';
  return 'minor_nc';
}

export function stepStateColor(state: StepState): { fg: string; bg: string } {
  switch (state) {
    case 'done': return { fg: '#047857', bg: '#D1FAE5' };
    case 'active': return { fg: '#1D4ED8', bg: '#DBEAFE' };
    case 'blocked': return { fg: '#B91C1C', bg: '#FEE2E2' };
    default: return { fg: '#94A3B8', bg: '#F1F5F9' };
  }
}
