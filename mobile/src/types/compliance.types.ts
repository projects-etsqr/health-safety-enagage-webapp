export interface ComplianceMetrics {
  overall_pct: number;
  ppe_pct: number;
  training_pct: number;
  active_risks: number;
  active_personnel: number;
  site?: string;
  region?: string;
}

export interface ComplianceException {
  id: string;
  worker_name: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
  avatar?: string;
}

export interface GearCheckWorker {
  id: string;
  name: string;
  initials: string;
  passed: boolean;
  avatar?: string;
}

export interface ExpiringPermit {
  id: string;
  title: string;
  workers: number;
  expiry_date: string;
}

export interface DashboardStats {
  attendance_pct: number;
  safety_compliance_pct: number;
  active_permits: number;
  pending_permits: number;
}

export interface DashboardAlert {
  id: string;
  type: string;
  message: string;
  zone: string;
  time_ago: string;
  worker_name: string;
}
