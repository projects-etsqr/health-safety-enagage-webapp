import { useState, useCallback } from 'react';
import { checklistService } from '../services/checklistService';
import { Checklist, SubmitChecklistRequest } from '../types';

export function useChecklists() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChecklists = useCallback(async (params?: { status?: string }) => {
    setLoading(true);
    try {
      const res = await checklistService.getChecklists(params);
      setChecklists(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load checklists');
    } finally {
      setLoading(false);
    }
  }, []);

  const submitChecklist = useCallback(async (payload: SubmitChecklistRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await checklistService.submitChecklist(payload);
      setChecklists(prev => prev.map(c => c.id === updated.id ? updated : c));
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to submit checklist');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { checklists, isLoading, error, fetchChecklists, submitChecklist };
}
