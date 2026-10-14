import { useState, useCallback } from 'react';
import { permitService } from '../services/permitService';
import { Permit, PermitListResponse, PermitRequest } from '../types';

export function usePermits() {
  const [permits, setPermits] = useState<Permit[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPermits = useCallback(async (params?: { status?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await permitService.getPermits(params);
      setPermits(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load permits');
    } finally {
      setLoading(false);
    }
  }, []);

  const createPermit = useCallback(async (
    payload: PermitRequest,
    riskAssessmentFile?: { uri: string; name: string; type: string },
  ): Promise<Permit | null> => {
    setLoading(true);
    setError(null);
    try {
      const permit = await permitService.createPermitWithFile(payload, riskAssessmentFile);
      setPermits(prev => [permit, ...prev]);
      return permit;
    } catch (err: any) {
      setError(err?.message || 'Failed to submit permit');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const acknowledgePermit = useCallback(async (id: string): Promise<boolean> => {
    try {
      const updated = await permitService.acknowledgePermit(id);
      setPermits(prev => prev.map(p => p.id === id ? updated : p));
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * The holder's two steps. Both refetch rather than patching the row: the
   * backend decides the resulting state — an activation outside the validity
   * window is refused, and the permit may have moved on since the list loaded —
   * so the server's answer is the one worth rendering.
   *
   * The refusal text is returned rather than swallowed. "This permit expired on
   * 12 Aug at 18:00 and cannot be activated" is the whole answer, and a screen
   * that shows "Failed" instead sends the worker to find a supervisor.
   */
  const runPermitStep = useCallback(
    async (id: string, step: 'start' | 'complete'): Promise<string | null> => {
      try {
        if (step === 'start') {
          await permitService.startWork(id);
        } else {
          await permitService.completeWork(id);
        }
        await fetchPermits();
        return null;
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        if (typeof detail === 'string') return detail;
        if (detail?.message) return detail.message;
        return step === 'start' ? 'Could not start work.' : 'Could not finish work.';
      }
    },
    [fetchPermits],
  );

  const startWork = useCallback((id: string) => runPermitStep(id, 'start'), [runPermitStep]);
  const completeWork = useCallback((id: string) => runPermitStep(id, 'complete'), [runPermitStep]);

  return {
    permits, isLoading, error, fetchPermits, createPermit,
    acknowledgePermit, startWork, completeWork,
  };
}
