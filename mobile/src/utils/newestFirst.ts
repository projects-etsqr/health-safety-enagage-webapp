/**
 * Newest entry at the top of an entry list.
 *
 * The backends sort their queues for triage — overdue first, then P1..P5, then
 * longest-waiting — which answers "what is most urgent" and is right for a
 * dashboard. It is not what someone scanning the entries their team just sent
 * up is looking for: a report filed this morning could sit twenty rows down
 * behind older ones, and it read as though it had not arrived.
 *
 * So the entry lists order by when the record was raised, newest first. The
 * urgency is still on every card — overdue and priority are rendered there —
 * it is no longer what decides the order.
 *
 * Each family names its timestamp differently and some queue rows carry none,
 * so `id` is the last resort: the ids are per-family and monotonic, which makes
 * the highest one the most recent entry.
 */

const TIME_KEYS = [
  'reported_at',
  'logged_at',
  'waiting_since',
  'created_at',
  'observed_at',
] as const;

function raisedAt(row: Record<string, unknown>): number {
  for (const key of TIME_KEYS) {
    const value = row[key];
    if (typeof value === 'string' && value) {
      const t = Date.parse(value);
      if (!Number.isNaN(t)) return t;
    }
  }
  return 0;
}

/** A new array, newest first. Never mutates the caller's list. */
export function newestFirst<T extends { id?: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const diff = raisedAt(b as Record<string, unknown>) - raisedAt(a as Record<string, unknown>);
    if (diff !== 0) return diff;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}
