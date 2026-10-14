import { useCallback, useState } from 'react';
import type { ReportType } from '../api/endpoints';
import {
  reportWorkflowService,
  type ClosePayload,
  type ReportNextActionItem,
} from '../services/reportWorkflowService';

/**
 * The manager's combined queue across near miss, unsafe act and risk, with the
 * one step each record is actually waiting for.
 *
 * Incidents are deliberately excluded — ManagerAppRoot already loads those into
 * its own registry with CAPA/5-Whys screens attached.
 *
 * This used to read /manager-queue, which returned records but never said what
 * was owed on one, so the screen offered every record the same pair of buttons:
 * "send back" and "approve & close". That pairing is wrong for most of the
 * queue. Closure requires the record to have reached LEARN — its RCA approved,
 * its corrective actions completed and their effectiveness verified — so
 * "approve & close" on a record with an open CAPA approved it and then failed
 * at the closure gate, leaving it stranded one stage on with no explanation.
 *
 * `/next-actions` resolves the outstanding step per record against the caller's
 * role, so the screen can offer exactly the verb the backend will accept.
 */
const MANAGED_TYPES: ReportType[] = ['near_miss', 'unsafe_act', 'risk'];

export interface ManagerQueueItem extends ReportNextActionItem {
  report_type: ReportType;
}

/** Stable key across families — ids collide between tables. */
export const queueKey = (item: { report_type: ReportType; id: number }) =>
  `${item.report_type}:${item.id}`;

export function useManagerReportQueue() {
  const [queue, setQueue] = useState<ManagerQueueItem[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // One type failing (e.g. a 403) should not blank out the other two.
      const results = await Promise.allSettled(
        MANAGED_TYPES.map((t) => reportWorkflowService(t).getNextActions(false, 100)),
      );

      const rows: ManagerQueueItem[] = [];
      results.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          rows.push(
            ...res.value.items
              // Steps owned by the supervisor still come back so a manager can
              // see where a record is stuck; they are not the manager's queue.
              .filter((r) => r.is_mine)
              .map((r) => ({ ...r, report_type: (r.family ?? MANAGED_TYPES[i]) as ReportType })),
          );
        }
      });

      // Overdue first, then P1..P5, then longest waiting — the same ordering
      // each family's endpoint applies within itself, reapplied across all three.
      rows.sort((a, b) => {
        if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
        const p = (a.priority ?? 'P9').localeCompare(b.priority ?? 'P9');
        if (p !== 0) return p;
        return (a.waiting_since ?? '9999').localeCompare(b.waiting_since ?? '9999');
      });

      setQueue(rows);
      setError(results.every((r) => r.status === 'rejected') ? 'Could not load the queue.' : null);
    } finally {
      setLoading(false);
    }
  }, []);

  const run = useCallback(
    async (
      item: ManagerQueueItem,
      action: (svc: ReturnType<typeof reportWorkflowService>) => Promise<unknown>,
    ) => {
      const key = queueKey(item);
      setBusyId(key);
      try {
        await action(reportWorkflowService(item.report_type));
        await refresh();
        return true;
      } catch (e: any) {
        // The stage gates name what they refused and why — far more use than
        // "action failed", which is what sent people back to the API logs.
        setError(e?.response?.data?.detail || 'Action failed. Please try again.');
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  return {
    queue,
    isLoading,
    busyId,
    error,
    refresh,
    /** Stage 04 → 05. Approve the supervisor's investigation, or send it back. */
    approve: (item: ManagerQueueItem, approved = true) =>
      run(item, (svc) => svc.approveInvestigation(item.id, approved)),
    /**
     * Stage 06. `effective: false` returns the record to IMPROVE and reopens its
     * corrective actions — a control that did not hold means the hazard is live.
     */
    verifyEffectiveness: (item: ManagerQueueItem, effective: boolean, notes?: string) =>
      run(item, (svc) => svc.verifyEffectiveness(item.id, effective, notes)),
    /** Stage 05. Sign off the action holding an IMPROVE record. */
    completeCapa: (item: ManagerQueueItem, capaId: number, rating?: number) =>
      run(item, (svc) => svc.completeCapa(capaId, rating)),
    /** Stage 07 → 08. The lesson is captured as part of closing. */
    close: (item: ManagerQueueItem, payload: ClosePayload) =>
      run(item, (svc) => svc.close(item.id, payload)),
  };
}
