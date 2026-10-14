/**
 * The eight stages of the workflow engine, shared by every event family.
 *
 * Mirrors backend/app/services/workflow_stages.py. The backend derives the
 * stage from each family's status column and sends it down; nothing here
 * re-derives it, because that mapping living in two places is how the two would
 * drift apart.
 *
 * Two response shapes exist in the API and both are supported deliberately:
 *
 *   nested  incidents        `{ stage: { stage, stage_number, ... } }`
 *   flat    everything else  `{ stage, stage_number, stage_label, ... }`
 *
 * The flat shape came first and several screens already read `stage_number` off
 * it directly, so it was left alone rather than broken for consistency's sake.
 * `toStageInfo` accepts either.
 */

export const WORKFLOW_STAGES = [
  'RECORD', 'ASSESS', 'RESPOND', 'INVESTIGATE',
  'IMPROVE', 'VERIFY', 'LEARN', 'CLOSE',
] as const;

export type WorkflowStageKey = (typeof WORKFLOW_STAGES)[number];

export interface StageInfo {
  stage: WorkflowStageKey | null;
  stage_number: number | null;
  stage_label: string | null;
  stage_description: string | null;
  total_stages: number;
  completed_stages: WorkflowStageKey[];
  is_closed: boolean;
}

/** Short labels — the rail is eight items wide on a phone, so these must be tight. */
export const STAGE_SHORT_LABEL: Record<WorkflowStageKey, string> = {
  RECORD: 'Record',
  ASSESS: 'Assess',
  RESPOND: 'Respond',
  INVESTIGATE: 'Investigate',
  IMPROVE: 'Improve',
  VERIFY: 'Verify',
  LEARN: 'Learn',
  CLOSE: 'Close',
};

/**
 * Normalise whatever a record carries into a StageInfo.
 *
 * Accepts the record itself, so callers can pass an incident, a near miss, a
 * permit or an audit without knowing which shape its endpoint returns. Returns
 * null when there is no stage at all — an unmapped status is a real condition
 * worth rendering as "unknown" rather than silently drawing stage 1.
 */
export function toStageInfo(source: any): StageInfo | null {
  if (!source) return null;

  // Nested shape: the record carries a `stage` object.
  const nested = source.stage;
  if (nested && typeof nested === 'object') {
    return {
      stage: nested.stage ?? null,
      stage_number: nested.stage_number ?? null,
      stage_label: nested.stage_label ?? null,
      stage_description: nested.stage_description ?? null,
      total_stages: nested.total_stages ?? WORKFLOW_STAGES.length,
      completed_stages: nested.completed_stages ?? [],
      is_closed: Boolean(nested.is_closed),
    };
  }

  // Flat shape: `stage` is the key string and the rest sit alongside it.
  if (typeof nested === 'string' || typeof source.stage_number === 'number') {
    const key = (typeof nested === 'string' ? nested : null) as WorkflowStageKey | null;
    return {
      stage: key,
      stage_number: source.stage_number ?? null,
      stage_label: source.stage_label ?? (key ? STAGE_SHORT_LABEL[key] : null),
      stage_description: source.stage_description ?? null,
      total_stages: source.total_stages ?? WORKFLOW_STAGES.length,
      completed_stages: source.completed_stages ?? [],
      is_closed: key === 'CLOSE',
    };
  }

  return null;
}
