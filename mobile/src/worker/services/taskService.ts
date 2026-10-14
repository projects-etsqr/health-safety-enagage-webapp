import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { Task, TaskListResponse, CompleteStepRequest, ShiftSummary } from '../types';

export const taskService = {
  async getTasks(params?: { status?: string; priority?: string; date?: string }): Promise<TaskListResponse> {
    const { data } = await apiClient.get<TaskListResponse>(ENDPOINTS.TASKS.LIST, { params });
    return data;
  },

  async getTask(id: string): Promise<Task> {
    const { data } = await apiClient.get<Task>(ENDPOINTS.TASKS.DETAIL(id));
    return data;
  },

  async completeStep(payload: CompleteStepRequest): Promise<Task> {
    const { data } = await apiClient.post<Task>(
      ENDPOINTS.TASKS.COMPLETE_STEP(payload.task_id),
      payload,
    );
    return data;
  },

  async getShiftSummary(): Promise<ShiftSummary> {
    const { data } = await apiClient.get<ShiftSummary>(ENDPOINTS.TASKS.SHIFT_SUMMARY);
    return data;
  },
};
