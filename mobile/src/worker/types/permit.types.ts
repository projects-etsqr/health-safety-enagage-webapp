export type PermitType = 'hot_work' | 'confined_space' | 'working_at_height' | 'electrical' | 'excavation';
export type PermitStatus = 'draft' | 'pending_approval' | 'approved' | 'active' | 'closed' | 'rejected';

export interface SafetyGear {
  hard_hat: boolean;
  gloves: boolean;
  eye_protection: boolean;
  respirator: boolean;
  safety_harness?: boolean;
  hearing_protection?: boolean;
}

export interface PermitRequest {
  permit_type: PermitType;
  work_location: string;
  start_datetime: string;
  end_datetime: string;
  work_description: string;
  safety_gear: SafetyGear;
  risk_assessment_text: string;
  risk_assessment_file_url?: string;
  number_of_workers?: number;
}

export interface Permit {
  id: string;
  permit_ref: string;
  permit_type: PermitType;
  work_location: string;
  start_datetime: string;
  end_datetime: string;
  work_description: string;
  status: PermitStatus;
  requested_by: string;
  approved_by?: string;
  created_at: string;
  safety_gear: SafetyGear;

  /**
   * The permit's real lifecycle state, and where that puts it on the eight
   * stages. `status` above is the website's business field (Pending / Active /
   * Closed) and says nothing about the workflow, so it cannot answer "how far
   * along is my permit". Derived by the backend, never stored.
   */
  workflow_status?: string | null;
  stage?: string | null;
  stage_number?: number | null;
  stage_label?: string | null;
  completed_stages?: string[];
  total_stages?: number | null;
}

export interface PermitListResponse {
  items: Permit[];
  total: number;
}
