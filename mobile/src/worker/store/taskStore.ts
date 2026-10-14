import { create } from 'zustand';
import { taskService } from '../services/taskService';
import { Task, ShiftSummary, CompleteStepRequest } from '../types';

interface TaskStore {
  tasks: Task[];
  shiftSummary: ShiftSummary | null;
  isLoading: boolean;
  error: string | null;

  fetchTasks: (params?: { status?: string; priority?: string }) => Promise<void>;
  fetchShiftSummary: () => Promise<void>;
  completeStep: (payload: CompleteStepRequest) => Promise<void>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  shiftSummary: null,
  isLoading: false,
  error: null,

  fetchTasks: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const res = await taskService.getTasks(params);
      set({ tasks: res.items, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to load tasks', isLoading: false });
    }
  },

  fetchShiftSummary: async () => {
    try {
      const summary = await taskService.getShiftSummary();
      set({ shiftSummary: summary });
    } catch { /* non-blocking */ }
  },

  completeStep: async (payload) => {
    set({ isLoading: true });
    try {
      const updated = await taskService.completeStep(payload);
      set(state => ({
        tasks: state.tasks.map(t => t.id === updated.id ? updated : t),
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err?.message || 'Failed to complete step', isLoading: false });
    }
  },
}));
