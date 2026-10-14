export type TaskPriority = 'CRITICAL' | 'HIGH' | 'ROUTINE';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';
export type TaskType = 'maintenance' | 'inspection' | 'permit' | 'training' | 'audit';

export interface TaskStep {
  num: number;
  title: string;
  description: string;
  safety_note?: string;
  highlight_refs?: string[];
  is_completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  location: string;
  priority: TaskPriority;
  status: TaskStatus;
  type: TaskType;
  due_at: string;
  shift_date: string;
  steps: TaskStep[];
  total_steps: number;
  completed_steps: number;
  assigned_to: string;
  created_at: string;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
}

export interface CompleteStepRequest {
  task_id: string;
  step_num: number;
  notes?: string;
  photo_url?: string;
}

export interface ShiftSummary {
  total_tasks: number;
  completed_tasks: number;
  shift_start: string;
  shift_end: string;
  progress_pct: number;
  active_permits?: number;
}
