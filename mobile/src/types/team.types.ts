export type WorkerStatus = 'logged_in' | 'pending' | 'off_site' | 'leave' | 'active';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  zone: string;
  status: WorkerStatus;
  avatar?: string;
  scheduled_time?: string;
  phone?: string;
}

export interface ToolboxTalkMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  present: boolean;
}

export interface ToolboxTalk {
  id: string;
  title: string;
  scheduled_at: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  key_points: string[];
  attendees: ToolboxTalkMember[];
}

export interface ShiftStatus {
  total: number;
  logged_in: number;
  pending: number;
  is_live: boolean;
}

export interface PriorityAlert {
  id: string;
  type: string;
  message: string;
  zone: string;
  time_ago: string;
  worker_name?: string;
}

export interface TeamStats {
  total_workforce: number;
  present: number;
  off_site: number;
  pending: number;
  active_zones: number;
}
