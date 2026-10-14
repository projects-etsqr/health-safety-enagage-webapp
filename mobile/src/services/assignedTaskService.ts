import { apiClient } from '../api/client';

export interface AssignableWorker {
  employee_id: number;
  name: string;
  department: string;
}

export interface ChecklistItemInput {
  item_text: string;
  is_required?: boolean;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  location?: string;
  priority?: string;         // low | medium | high
  due_at?: string;           // "YYYY-MM-DD HH:MM"
  items: ChecklistItemInput[];
  worker_ids: number[];
}

export interface AssignedTask {
  id: number;
  title: string;
  description: string;
  location: string;
  priority: string;
  due_at: string | null;
  status: string;
  created_at: string | null;
  assigned_by_id: number | null;
  assigned_by_name: string;
  worker_count: number;
  filled_count: number;
  my_status?: string;
}

export const assignedTaskService = {
  async getAssignableWorkers(): Promise<AssignableWorker[]> {
    const { data } = await apiClient.get('/assigned-tasks/assignable-workers');
    return Array.isArray(data) ? data : [];
  },

  async createTask(payload: CreateTaskPayload): Promise<{ id: number; title: string }> {
    const { data } = await apiClient.post('/assigned-tasks', payload);
    return data;
  },

  async listTasks(): Promise<AssignedTask[]> {
    const { data } = await apiClient.get('/assigned-tasks');
    return data?.items ?? [];
  },

  async getTask(id: number): Promise<any> {
    const { data } = await apiClient.get(`/assigned-tasks/${id}`);
    return data;
  },

  // Manager: all workers' filled responses for a task.
  async getResponses(id: number): Promise<any> {
    const { data } = await apiClient.get(`/assigned-tasks/${id}/responses`);
    return data;
  },

  // Manager: edit the checklist items (id present = update, absent = add; omitted = delete).
  async editItems(
    id: number,
    items: { id?: number; item_text: string; is_required?: boolean }[],
  ): Promise<any> {
    const { data } = await apiClient.put(`/assigned-tasks/${id}/items`, { items });
    return data;
  },
};
