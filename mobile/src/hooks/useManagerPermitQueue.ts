import { useCallback, useState } from 'react';
import {
  permitWorkflowService,
  type PermitApprovePayload,
  type PermitListItem,
} from '../services/permitWorkflowService';

/**
 * The manager's permit view (flow 6, step 3): approve or reject permits a supervisor
 * has acknowledged, and monitor the permits that are currently active.
 */
export function useManagerPermitQueue() {
  const [queue, setQueue] = useState<PermitListItem[]>([]);
  const [active, setActive] = useState<PermitListItem[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [q, a] = await Promise.allSettled([
        permitWorkflowService.managerQueue(),
        permitWorkflowService.active(),
      ]);
      setQueue(q.status === 'fulfilled' ? q.value : []);
      setActive(a.status === 'fulfilled' ? a.value : []);
      setError(q.status === 'rejected' && a.status === 'rejected' ? 'Could not load permits.' : null);
    } finally {
      setLoading(false);
    }
  }, []);

  const run = useCallback(
    async (id: number, action: () => Promise<unknown>) => {
      setBusyId(id);
      try {
        await action();
        await refresh();
        return true;
      } catch {
        setError('Action failed. Please try again.');
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  return {
    queue,
    active,
    isLoading,
    busyId,
    error,
    refresh,
    approve: (id: number, payload?: PermitApprovePayload) =>
      run(id, () => permitWorkflowService.approve(id, payload)),
    reject: (id: number, reason: string) =>
      run(id, () => permitWorkflowService.reject(id, reason)),
  };
}
