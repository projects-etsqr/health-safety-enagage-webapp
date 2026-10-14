import apiClient from '../api/client';

export interface AssignedTaskListItem {
  id: number;
  title: string;
  description: string;
  location: string;
  priority: string;
  due_at: string | null;
  status: string;
  assigned_by_name: string;
  my_status?: string;
}

export interface AssignedTaskItem {
  id: number;
  item_no: number;
  item_text: string;
  is_required: boolean;
}

export interface AssignedTaskDetail {
  id: number;
  title: string;
  description: string;
  location: string;
  priority: string;
  due_at: string | null;
  assigned_by_name: string;
  items: AssignedTaskItem[];
  my_status: string | null;
  my_responses: Record<string, { answer: string | null; description: string }>;
}

export interface FillResponse {
  item_id: number;
  answer: 'Yes' | 'No' | null;
  description?: string;
}

export const assignedTaskService = {
  async list(): Promise<AssignedTaskListItem[]> {
    const { data } = await apiClient.get('assigned-tasks');
    return data?.items ?? [];
  },

  async getTask(id: number): Promise<AssignedTaskDetail> {
    const { data } = await apiClient.get(`assigned-tasks/${id}`);
    return data;
  },

  async fill(id: number, responses: FillResponse[]): Promise<{ task_id: number; status: string }> {
    const { data } = await apiClient.post(`assigned-tasks/${id}/fill`, { responses });
    return data;
  },
};
