import { useCallback, useMemo, useState } from 'react';
import type { ReportType } from '../api/endpoints';
import {
  reportWorkflowService,
  type ClosePayload,
  type InvestigatePayload,
  type ReportListItem,
  type ReportNextActionItem,
} from '../services/reportWorkflowService';
import { newestFirst } from '../utils/newestFirst';

/**
 * Queue state + workflow actions for one report type.
 *
 * `queue` is the outstanding-steps list rather than a plain status list. It was
 * /pending-review, which had two problems: it only knew the three supervisor
 * statuses, so a record moved past them disappeared with nothing saying who now
 * held it, and it carried no stage, so nothing on screen could say what was
 * owed. `/next-actions?mine_only=false` answers both in one request — every
 * open record, its stage, the one step outstanding, and whether it is this
 * user's own job or somebody else's.
 *
 * `closed` is fetched alongside it because the queues, by definition, cannot
 * show a finished record, and "what happened to the one I investigated last
 * week" is a question a supervisor actually asks.
 *
 * There is no longer a supervisor/manager switch: `/next-actions` resolves the
 * step against the caller's own role, so one call serves both and the two can
 * no longer be pointed at lists that disagree.
 */
export function useReportWorkflow(type: ReportType) {
  const service = useMemo(() => reportWorkflowService(type), [type]);

  const [queue, setQueue] = useState<ReportNextActionItem[]>([]);
  const [closed, setClosed] = useState<ReportListItem[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // mine_only=false so steps this role merely outranks come back too, each
      // flagged is_mine:false. That is what lets the screen say "waiting on the
      // manager" instead of showing an empty list.
      const q = await service.getNextActions(false, 100);
      setQueue(newestFirst(q.items));
      setError(null);
    } catch (e: any) {
      // 403 means this role has no business in this queue — say so rather than
      // leaving an empty list that looks like "nothing to review".
      setError(
        e?.response?.status === 403
          ? 'You are not authorized to view this queue.'
          : 'Could not load reports. Pull to retry.',
      );
    } finally {
      setLoading(false);
    }

    // Secondary, and deliberately not allowed to fail the whole refresh: a
    // supervisor who cannot list closed records should still get their queue.
    try {
      setClosed(newestFirst(await service.getAll({ stage: 'CLOSE', limit: 50 })));
    } catch {
      setClosed([]);
    }
  }, [service]);

  /** Run a workflow action, then refresh so the record moves to its next step. */
  const run = useCallback(
    async (id: number, action: () => Promise<unknown>) => {
      setBusyId(id);
      try {
        await action();
        await refresh();
        return true;
      } catch (e: any) {
        // The stage gates name what they refused and why, which beats anything
        // this hook could invent.
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
    closed,
    isLoading,
    busyId,
    error,
    refresh,

    // Supervisor
    acknowledge: (id: number, notes?: string) => run(id, () => service.acknowledge(id, notes)),
    startInvestigation: (id: number) => run(id, () => service.startInvestigation(id)),
    investigate: (id: number, payload: InvestigatePayload) =>
      run(id, () => service.investigate(id, payload)),
    escalate: (id: number, reason: string) => run(id, () => service.escalate(id, reason)),

    // Manager
    approve: (id: number, approved = true) => run(id, () => service.approveInvestigation(id, approved)),
    verifyEffectiveness: (id: number, effective: boolean, notes?: string) =>
      run(id, () => service.verifyEffectiveness(id, effective, notes)),
    close: (id: number, payload: ClosePayload) => run(id, () => service.close(id, payload)),
  };
}
