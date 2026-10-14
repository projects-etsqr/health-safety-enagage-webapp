export type CheckResult = 'pass' | 'fail' | null;
export type ChecklistStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  is_mandatory: boolean;
  result: CheckResult;
}

export interface Checklist {
  id: string;
  title: string;
  checklist_type: string;
  equipment_name: string;
  items: ChecklistItem[];
  total_items: number;
  completed_items: number;
  status: ChecklistStatus;
  created_at: string;
}

export interface SubmitChecklistRequest {
  checklist_id: string;
  results: { item_id: string; result: CheckResult; notes?: string }[];
  overall_comments: string;
  photo_urls?: string[];
}

export interface ChecklistListResponse {
  items: Checklist[];
  total: number;
}
