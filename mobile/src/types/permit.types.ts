export type PermitStatus =
  | 'pending'
  | 'ready_for_review'
  | 'awaiting_signature'
  | 'under_revision'
  | 'approved'
  | 'active'
  | 'closed'
  | 'rejected';

export type PermitRisk = 'high' | 'medium' | 'low';

export interface SafetyChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface Permit {
  id: string;
  permit_ref: string;
  permit_type: string;
  title: string;
  location: string;
  requestor: string;
  team?: string;
  status: PermitStatus;
  risk_level: PermitRisk;
  validity_start?: string;
  validity_end?: string;
  safety_checklist?: SafetyChecklistItem[];
  date_issued?: string;
}

export interface PermitListResponse {
  items: Permit[];
  total: number;
  pending_count: number;
  approved_today: number;
  risk_flags: number;
}
