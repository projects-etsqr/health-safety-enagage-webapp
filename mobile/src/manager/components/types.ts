import type { Incident, Permit, Complaint, Capa, Audit } from "../data/mockData";

/** The three families the manager's report approvals screen covers. */
export type ReportFamily = "near_miss" | "unsafe_act" | "risk";

/** Every screen the manager shell can render. Keep in sync with ManagerAppRoot's switch. */
export type ManagerScreen =
  | "login"
  | "app"
  | "investigation"
  | "assign_actions"
  | "unassigned_capa"
  | "incident_queue"
  | "compliance_approvals"
  | "permit_approvals"
  | "assigned_tasks"
  | "hazard_register"
  | "report_approvals"
  | "policy_management"
  | "ai_assistant"
  // ── WF-06 … WF-09 (HSE_Mobile_Architecture_v4) ──────────────────────────
  | "sps_dashboard"
  | "human_readiness"
  | "contractor_oversight"
  | "transport_oversight"
  | "ai_governance"
  | "training";

export interface ScreenProps {
  currentScreen: ManagerScreen;
  setCurrentScreen: (screen: ManagerScreen) => void;
  layoutVersion: "A" | "B";
  activeTab: number;
  setActiveTab: (tab: number) => void;
  employeeId: string;
  setEmployeeId: (id: string) => void;
  password: string;
  setPassword: (pass: string) => void;
  incidents: Incident[];
  setIncidents: React.Dispatch<React.SetStateAction<Incident[]>>;
  permits: Permit[];
  setPermits: React.Dispatch<React.SetStateAction<Permit[]>>;
  complaints: Complaint[];
  setComplaints: React.Dispatch<React.SetStateAction<Complaint[]>>;
  capaItems: Capa[];
  setCapaItems: React.Dispatch<React.SetStateAction<Capa[]>>;
  audits: Audit[];
  setAudits: React.Dispatch<React.SetStateAction<Audit[]>>;
  complaintSearch: string;
  setComplaintSearch: (search: string) => void;
  complaintFilter: string;
  setComplaintFilter: (filter: string) => void;
  selectedIncident: Incident;
  setSelectedIncident: (incident: Incident) => void;
  /**
   * Which report family the approvals screen opens on, set by the Tasks card
   * that navigated there. `null` means all three — the screen still offers the
   * other families as pills, so nothing becomes unreachable by arriving from a
   * card.
   */
  reportFamily: ReportFamily | null;
  setReportFamily: (family: ReportFamily | null) => void;
  whys: { why1: string; why2: string; why3: string; why4: string; why5: string };
  setWhys: React.Dispatch<React.SetStateAction<{ why1: string; why2: string; why3: string; why4: string; why5: string }>>;
  rcaDone: boolean;
  setRcaDone: (done: boolean) => void;
  actionDesc: string;
  setActionDesc: (desc: string) => void;
  actionPriority: "Critical" | "High" | "Medium" | "Low";
  setActionPriority: (p: "Critical" | "High" | "Medium" | "Low") => void;
  actionDueDate: string;
  setActionDueDate: (date: string) => void;
  actionAssignee: string;
  setActionAssignee: (name: string) => void;
  actionCompliance: boolean;
  setActionCompliance: (checked: boolean) => void;
  queuedActions: Omit<Capa, "id" | "status">[];
  setQueuedActions: React.Dispatch<React.SetStateAction<Omit<Capa, "id" | "status">[]>>;
  showToast: (msg: string) => void;
  isGeneratingAI: boolean;
  handleAIDraft: () => void;
  handleQueueAction: () => void;
  handleFinalizeActions: () => void;
}
