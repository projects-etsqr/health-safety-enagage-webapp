import { useState, useCallback, useEffect } from 'react';
import { checklistService, ChecklistSubmission } from '../services/checklistService';

export function useMySubmissions() {
  const [submissions, setSubmissions] = useState<ChecklistSubmission[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSubmissions(await checklistService.getMySubmissions());
    } catch (err: any) {
      setError(err?.message || 'Failed to load submitted checklists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  return { submissions, isLoading, error, refetch: fetchSubmissions };
}
