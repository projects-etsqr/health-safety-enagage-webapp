export interface Incident {
  id: string;
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  time: string;
  desc: string;
  status: string;
}

export interface Permit {
  id: string;
  type: string;
  area: string;
  applicant: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
}

export interface Complaint {
  id: string;
  title: string;
  category: string;
  status: string;
  time: string;
}

export interface Capa {
  id: string;
  desc: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Completed";
  dueDate: string;
  assignee: string;
  complianceChecked: boolean;
}

export interface Audit {
  id: string;
  title: string;
  score: string;
  status: "PASSED" | "FAILED" | "SCHEDULED";
  inspector: string;
}

export const INITIAL_INCIDENTS: Incident[] = [
  {
    id: "INC-9022",
    title: "Chemical Spill - Zone B",
    severity: "Critical",
    time: "2h ago",
    desc: "A containment drum seal failed during transport, causing approximately 50L of solvent to leak onto the loading dock floor.",
    status: "IN INVESTIGATION"
  },
  {
    id: "INC-9023",
    title: "Forklift Near-Miss",
    severity: "High",
    time: "5h ago",
    desc: "A forklift operator swerved to avoid a pedestrian walking in a designated vehicle lane. No injuries, but lane barriers were damaged.",
    status: "CLOSED"
  },
  {
    id: "INC-9024",
    title: "Electrical Hazard - Line 3",
    severity: "Medium",
    time: "1d ago",
    desc: "Exposed wiring was detected on the primary control panel of production Line 3 during routine maintenance.",
    status: "IN INVESTIGATION"
  }
];

export const INITIAL_PERMITS: Permit[] = [
  { id: "WRK-4001", type: "Hot Work Permit", area: "Boiler Room", applicant: "Sarah Connor", status: "PENDING" },
  { id: "WRK-4002", type: "Confined Space Entry", area: "Tank C-4", applicant: "John Doe", status: "APPROVED" },
  { id: "WRK-4003", type: "Height Access > 2m", area: "Roof West", applicant: "Mike Vance", status: "PENDING" },
  { id: "WRK-4004", type: "Electrical Isolation", area: "Substation 2", applicant: "Alex Mercer", status: "REJECTED" }
];

export const INITIAL_COMPLAINTS: Complaint[] = [
  { id: "CMP-301", title: "Blockage in Exit Path - Zone C", category: "Safety Hazard", status: "UNRESOLVED", time: "3h ago" },
  { id: "CMP-302", title: "Inadequate PPE Dispenser Refills", category: "Resource Shortage", status: "RESOLVED", time: "1d ago" },
  { id: "CMP-303", title: "Ventilation Noise in Cabin 4", category: "Ergonomics", status: "UNRESOLVED", time: "2d ago" }
];

export const INITIAL_CAPA: Capa[] = [
  { id: "CAPA-1082", desc: "Install safety guardrails along Line 2 mezzanine", priority: "High", status: "Open", dueDate: "2026-07-15", assignee: "David Miller", complianceChecked: false },
  { id: "CAPA-1083", desc: "Replace warning placards on nitrogen storage tanks", priority: "Medium", status: "In Progress", dueDate: "2026-07-20", assignee: "Robert Chen", complianceChecked: false },
  { id: "CAPA-1084", desc: "Update electrical lockout procedure document", priority: "Low", status: "Completed", dueDate: "2026-06-30", assignee: "Sarah Connor", complianceChecked: true }
];

export const INITIAL_AUDITS: Audit[] = [
  { id: "AUD-901", title: "Fire Safety Equipment Inspection", score: "94%", status: "PASSED", inspector: "Chief Inspector Vance" },
  { id: "AUD-902", title: "Annual Chemical Safety Audit", score: "68%", status: "FAILED", inspector: "Dr. Evelyn Reed" },
  { id: "AUD-903", title: "Zone A Ergonomics Evaluation", score: "Pending", status: "SCHEDULED", inspector: "Ergo team" }
];
