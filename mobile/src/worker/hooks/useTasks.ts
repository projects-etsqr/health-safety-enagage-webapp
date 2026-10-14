import { useEffect } from 'react';
import { useTaskStore } from '../store/taskStore';

export function useTasks(params?: { status?: string; priority?: string }) {
  const { tasks, shiftSummary, isLoading, error, fetchTasks, fetchShiftSummary, completeStep } = useTaskStore();

  useEffect(() => {
    fetchTasks(params);
    fetchShiftSummary();
  }, []);

  return { tasks, shiftSummary, isLoading, error, completeStep, refetch: () => fetchTasks(params) };
}
