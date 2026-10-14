import { useState, useCallback } from 'react';
import { permitService } from '../services/permitService';
import type { Permit, PermitListResponse } from '../types/permit.types';

export function usePermits() {
  const [data, setData] = useState<PermitListResponse | null>(null);
  const [selectedPermit, setSelectedPermit] = useState<Permit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPermits = useCallback(async (params?: { status?: string; type?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await permitService.getPermits(params);
      setData(res);
    } catch {
      setError('Failed to load permits');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPermit = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const permit = await permitService.getPermit(id);
      setSelectedPermit(permit);
    } catch {
      setError('Failed to load permit details');
    } finally {
      setLoading(false);
    }
  }, []);

  const approvePermit = useCallback(async (id: string, notes?: string) => {
    await permitService.approvePermit(id, notes);
    await fetchPermits();
  }, [fetchPermits]);

  const rejectPermit = useCallback(async (id: string, reason: string) => {
    await permitService.rejectPermit(id, reason);
    await fetchPermits();
  }, [fetchPermits]);

  const acknowledgePermit = useCallback(async (id: string, checklist: Record<string, boolean>) => {
    await permitService.acknowledgePermit(id, checklist);
  }, []);

  return {
    permits: data?.items ?? [],
    stats: data,
    selectedPermit,
    loading,
    error,
    fetchPermits,
    fetchPermit,
    approvePermit,
    rejectPermit,
    acknowledgePermit,
  };
}
