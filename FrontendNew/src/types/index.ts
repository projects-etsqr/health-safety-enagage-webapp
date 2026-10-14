// ============= Infrastructure =============
export interface Site {
  Site_ID: string;
  Site_Name: string;
  Location: string;
  Country: string;
  Timezone: string;
  Status: string;
  Total_Zones: number;
  Total_Workers: number;
  Compliance_Rate: number;
  Manager: string;
  Emergency_Contact: string;
  Established_Date: string;
}

export interface Zone {
  Zone_ID: string;
  Zone_Name: string;
  Site_ID: string;
  Zone_Type: string;
  Parent_Zone: string;
  Risk_Score: number;
  Status: string;
  Time_Activation: string;
  Required_PPE: string;
  Max_Occupancy: number;
}

export interface Shift {
  Shift_ID: string;
  Shift_Name: string;
  Start_Time: string;
  End_Time: string;
  Sites: string;
  Active_Rules: number;
  Status: string;
}


// ============= Personnel =============
export interface User {
  User_ID: string;
  Full_Name: string;
  Email: string;
  Role: string;
  Site_Assignment: string;
  Phone: string;
  Status: string;
  Last_Login: string;
  Join_Date: string;
}

export interface Worker {
  Worker_ID: string;
  Full_Name: string;
  Badge_Number: string;
  RFID_Tag: string;
  Contractor: string;
  Site_Assignment: string;
  Role: string;
  Shift: string;
  Status: string;
  Phone: string;
  Emergency_Contact: string;
  Hire_Date: string;
}

export interface Contractor {
  Contractor_ID: string;
  Contractor_Name: string;
  Contact_Person: string;
  Email: string;
  Phone: string;
  Safety_Score: number;
  Total_Workers: number;
  Active_Since: string;
  Contract_Expiry: string;
  Status: string;
  Certification: string;
}

export interface AccessLog {
  Log_ID: string;
  Worker_ID: string;
  RFID_Reader_ID: string;
  Gate_Name: string;
  Entry_Type: string;
  Timestamp: string;
  Result: string;
  Denial_Reason: string;
}

export interface SLAConfig {
  Severity: string;
  Resolution_Time_Hours: number;
  Warning_Time_Hours: number;
  Escalation_Time_Hours: number;
  Auto_Assign: string;
  Notification_Channel: string;
}

// ============= Violations =============
export interface Violation {
  Violation_ID: string;
  Violation_Type: string;
  Zone_ID: string;
  Site_ID: string;
  Severity: 'Critical' | 'High' | 'Medium' | 'Low';
  PPE_Missing: string;
  Worker_ID: string;
  Camera_ID: string;
  Shift: string;
  Detected_At: string;
  Status: string;
  Assigned_To: string;
  Confidence_Score: number;
  Image_Path: string;
}

export interface ViolationFilters {
  site_id?: string;
  zone_id?: string;
  severity?: string;
  status?: string;
  shift?: string;
}

export interface Action {
  Action_ID: string;
  Description: string;
  Violation_ID: string;
  Action_Type: string;
  Assigned_To: string;
  Due_Date: string;
  Priority: string;
  Status: string;
  Created_At: string;
  Completed_At: string;
}

export interface Rule {
  Rule_ID: string;
  Rule_Name: string;
  Zone_ID: string;
  Site_ID: string;
  PPE_Required: string;
  Severity: string;
  Shift: string;
  Conditions: string;
  Status: string;
  Version: string;
  Created_By: string;
  Created_At: string;
  Last_Modified: string;
}

export interface PPEType {
  PPE_ID: string;
  PPE_Name: string;
  Category: string;
  Color_Detection: string;
  Compliance_Standard: string;
  Min_Confidence: number;
  Status: string;
}

// ============= Compliance =============
export interface ComplianceStandard {
  Standard_ID: string;
  Standard_Name: string;
  Compliance_Rate: number;
  Last_Audit_Date: string;
  Next_Audit_Date: string;
  Auditor: string;
  Certificate_Number: string;
  Status: string;
}

export interface AuditTrail {
  id: number;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  record_id: string | null;
  previous_value: string | null;
  new_value: string | null;
  ip_address: string | null;
}

// ============= Analytics =============
export interface DashboardStats {
  total_violations_today: number;
  compliance_rate: number;
  open_actions: number;
  workers_on_site: number;
  avg_response_time: string;
}

export interface PPEComplianceData {
  name: string;
  violations: number;
}

export interface ZoneRiskData {
  name: string;
  risk: number;
  violations: number;
}

export interface NearMiss {
  NearMiss_ID: string;
  Title: string;
  Description: string;
  Site_ID: string;
  Zone_ID: string;
  Reported_By: string;
  Reported_At: string;
  Incident_Date: string;
  Category: string;
  Severity: 'Critical' | 'High' | 'Medium' | 'Low';
  Potential_Outcome: string;
  Immediate_Action: string;
  Status: string;
  Investigation_Status: string;
}

export interface NearMissFilters {
  site_id?: string;
  severity?: string;
  status?: string;
}

export interface RootCauseAnalysis {
  RCA_ID: string;
  Incident_ID: string;
  Incident_Type: string;
  Site_ID: string;
  Zone_ID: string;
  Conducted_By: string;
  Start_Date: string;
  Completion_Date: string;
  Root_Causes: string;
  Contributing_Factors: string;
  Corrective_Actions: string;
  Preventive_Measures: string;
  Status: string;
  Priority: string;
}

export interface RCAFilters {
  site_id?: string;
  status?: string;
}

export interface EquipmentCertification {
  Cert_ID: string;
  Equipment_Name: string;
  Equipment_Type: string;
  Site_ID: string;
  Zone_ID: string;
  Serial_Number: string;
  Manufacturer: string;
  Model: string;
  Certification_Type: string;
  Certified_By: string;
  Issue_Date: string;
  Expiry_Date: string;
  Next_Inspection: string;
  Status: string;
  Compliance_Standard: string;
}

export interface EquipmentCertFilters {
  site_id?: string;
  status?: string;
  equipment_type?: string;
}

// ============= Checklists =============
export interface ChecklistTemplateItem {
  section_name: string;
  item_no: number;
  item_text: string;
  is_required: number;
}

export interface ChecklistTemplate {
  checklist_type: string;
  display_name: string;
  description?: string | null;
  submitter_roles: string[];
  validator_roles: string[];
  items: ChecklistTemplateItem[];
  item_count: number;
  ui?: {
    form_title?: string;
    short_label?: string;
    version_tag?: string;
  } | null;
  sla?: {
    draft_submission_sla_hours?: number;
    validation_sla_hours?: number;
  } | null;
}

export interface ChecklistSubmissionSummary {
  submission_uuid: string;
  checklist_type: string;
  site_id?: string | null;
  zone_id?: string | null;
  shift_name?: string | null;
  checklist_date: string;
  submitted_by_email: string;
  submitted_by_role: string;
  status: string;
  created_at: string;
  updated_at: string;
  submit_due_at?: string | null;
  validate_due_at?: string | null;
  submit_sla_breached?: number;
  validate_sla_breached?: number;
}

export interface ChecklistSubmissionItemDetail extends ChecklistTemplateItem {
  response_value?: string | null;
  remark?: string | null;
  evidence_json?: string | null;
  updated_by_email?: string | null;
  updated_by_role?: string | null;
  updated_at?: string | null;
  attachments?: Array<{
    id: number;
    item_no: number;
    file_name: string;
    file_path: string;
    mime_type?: string | null;
    file_size_bytes?: number | null;
    uploaded_by_email?: string | null;
    uploaded_by_role?: string | null;
    created_at?: string | null;
  }>;
}

export interface ChecklistSubmissionDetail {
  submission: ChecklistSubmissionSummary & {
    validation_decision?: string | null;
    validation_notes?: string | null;
  };
  template: {
    checklist_type: string;
    display_name: string;
    submitter_roles: string[];
    validator_roles: string[];
    ui?: ChecklistTemplate['ui'];
    sla?: ChecklistTemplate['sla'];
  };
  items: ChecklistSubmissionItemDetail[];
  logs: Array<{
    action_type: string;
    actor_email: string;
    actor_role: string;
    from_status?: string | null;
    to_status?: string | null;
    notes?: string | null;
    created_at: string;
  }>;
}

export interface CreateChecklistSubmissionPayload {
  checklist_type: string;
  site_id?: string;
  zone_id?: string;
  shift_name?: string;
  checklist_date?: string;
  metadata?: Record<string, unknown>;
}

export interface SaveChecklistItemPayload {
  item_no: number;
  response_value?: string | null;
  remark?: string | null;
  evidence?: Record<string, unknown>;
}

// ============= Onboarding =============
export interface OnboardingAccessProfile {
  response_version?: string;
  source?: string;
  found: boolean;
  approved: boolean;
  approval_state?: string;
  reason?: string;
  onboarding_uuid?: string;
  company_name?: string;
  org_code?: string;
  country_code?: string;
  country_name?: string;
  admin_name?: string;
  admin_email?: string;
  worker_name?: string;
  worker_email?: string;
  user_name?: string;
  display_name?: string;
  user_email?: string;
  user_role?: 'Admin' | 'Site Engineer' | 'Site Inspector' | 'Worker/Contractor';
  subscription_plan?: 'Free' | 'Pro' | 'Enterprise';
  profile_source?: 'admin_email' | 'worker_email';
  selected_modules?: string[];
  selected_checklist_types?: string[];
  active_workers?: number;
  setup_required?: boolean;
  setup_completed?: boolean;
  configured_users_count?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingSubmissionPayload {
  company_name: string;
  country_code: string;
  country_name: string;
  use_global_layer: boolean;
  use_country_layer: boolean;
  use_org_layer: boolean;
  selected_checklist_types: string[];
  selected_modules: string[];
  site_count: number;
  zone_count: number;
  active_workers: number;
  admin_name: string;
  admin_email: string;
  admin_phone?: string;
  requirements_notes?: string;
}

export interface OnboardingSubmissionResponse {
  status: 'submitted';
  onboarding_uuid: string;
  org_code: string;
  dashboard_redirect: string;
  message: string;
}

export interface OnboardingLayerOption {
  id: string;
  label: string;
  file_name: string;
  layer: 'global' | 'country';
}

export interface OnboardingLayerOptionsResponse {
  country_code: string;
  global_options: OnboardingLayerOption[];
  country_options: OnboardingLayerOption[];
  counts: {
    global: number;
    country: number;
  };
}

export interface RequestStatusResponse {
  found: boolean;
  message?: string;
  onboarding_uuid?: string;
  company_name?: string;
  org_code?: string;
  country_code?: string;
  country_name?: string;
  status?: 'submitted' | 'approved' | 'archived';
  admin_name?: string;
  admin_email?: string;
  admin_phone?: string;
  active_workers?: number;
  selected_modules?: string[];
  selected_checklist_types?: string[];
  post_approval_setup?: {
    org_data_summary?: string;
    workers?: Array<{
      name: string;
      email: string;
      phone: string;
      role: 'Admin' | 'Site Engineer' | 'Site Inspector' | 'Worker/Contractor';
      employee_id?: string;
      certification?: string;
    }>;
    uploaded_files?: Array<{ original_name: string; stored_name: string; stored_path: string; content_type: string; size_bytes: number }>;
    worker_uploaded_files?: Array<{ original_name: string; stored_name: string; stored_path: string; content_type: string; size_bytes: number }>;
    saved_at?: string;
  };
  onboarding_requirements?: {
    profile?: Record<string, unknown>;
    industry_taxonomy?: Record<string, unknown>;
    plan_capabilities?: Record<string, unknown>;
    governance_layers?: Record<string, unknown>;
    kpi_sla?: Record<string, unknown>;
    risk_and_compliance?: Record<string, unknown>;
    emergency_readiness?: Record<string, unknown>;
    admin_ownership?: Record<string, unknown>;
    implementation?: Record<string, unknown>;
    custom_notes?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingProcessingQueueItem {
  onboarding_uuid: string;
  company_name: string;
  org_code: string;
  country_code?: string;
  admin_name?: string;
  admin_email?: string;
  status: 'submitted' | 'approved' | 'archived' | string;
  setup_ready: boolean;
  org_data_summary?: string;
  uploaded_files_count: number;
  worker_files_count: number;
  workers_count: number;
  processing: {
    status: 'pending' | 'processing' | 'completed' | 'failed' | string;
    started_at?: string | null;
    completed_at?: string | null;
    last_run_uuid?: string | null;
    last_error?: string | null;
    indexed_docs?: number | null;
    failed_files?: number | null;
    total_files?: number | null;
  };
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingProcessingQueueResponse {
  requests: OnboardingProcessingQueueItem[];
  count: number;
}

export interface StartOnboardingProcessingResponse {
  status: 'completed' | 'failed' | string;
  message?: string;
  onboarding_uuid: string;
  org_code: string;
  web_app_url?: string;
  mobile_app_url?: string;
  processing?: Record<string, unknown>;
  error?: string;
}

export interface PostApprovalSetupPayload {
  org_data_summary: string;
  workers: Array<{
    name: string;
    email: string;
    phone: string;
    role: 'Admin' | 'Site Engineer' | 'Site Inspector' | 'Worker/Contractor';
    employee_id?: string;
    certification?: string;
  }>;
  org_files?: File[];
  worker_files?: File[];
}

export interface PostApprovalSetupResponse {
  status: 'saved';
  message: string;
  org_code: string;
  company_name: string;
  web_app_url: string;
  mobile_app_url: string;
  uploaded_files_count?: number;
  worker_files_count?: number;
  max_workers_allowed?: number;
  configured_workers_count?: number;
}

export interface DeletePostApprovalFileResponse {
  status: 'deleted';
  stored_name: string;
  file_group: 'org' | 'worker';
}

// ============= Auth =============
export interface ThetaPasswordResetRequestResponse {
  status: 'otp_issued';
  email: string;
  org_code: string;
  delivery: 'email' | 'email_failed';
  delivery_detail?: string;
  dev_otp_preview?: string;
}

export interface ThetaPasswordResetConfirmResponse {
  status: 'password_reset_success';
  email: string;
  org_code: string;
  message: string;
}

export interface ThetaPasswordResetDirectResponse {
  status: 'password_reset_success';
  email: string;
  org_code: string;
  message: string;
}

export interface ThetaAuthLoginResponse {
  status: 'success' | 'password_setup_required' | 'pending_approval' | 'invalid_credentials' | 'not_found' | 'error';
  access_profile?: OnboardingAccessProfile;
  reason?: string;
  error?: string;
}

export interface OnboardingAccessRequestResponse {
  status: 'request_submitted' | 'already_provisioned';
  message: string;
  org_code: string;
  company_name?: string;
  approval_state?: string;
}

export interface OrgAccessRequestItem {
  request_id: number;
  onboarding_uuid: string;
  org_code: string;
  company_name?: string;
  admin_email?: string;
  name: string;
  email: string;
  phone?: string;
  role: 'Admin' | 'Site Engineer' | 'Site Inspector' | 'Worker/Contractor';
  status: 'requested' | 'invited' | 'active' | 'rejected' | string;
  created_at?: string;
  updated_at?: string;
}

export interface OrgAccessRequestsResponse {
  requests: OrgAccessRequestItem[];
  count: number;
}

export interface ReviewOrgAccessRequestResponse {
  status: 'reviewed';
  request_id: number;
  action: 'approve' | 'reject';
  role: 'Admin' | 'Site Engineer' | 'Site Inspector' | 'Worker/Contractor';
  worker_email: string;
  new_status: 'invited' | 'rejected' | string;
}

// ============= AI =============
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
