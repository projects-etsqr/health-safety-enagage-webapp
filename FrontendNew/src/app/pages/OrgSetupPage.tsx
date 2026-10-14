import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, X, ChevronDown, ChevronUp, ShieldCheck, Info,
  Building2, MapPin, Users, ClipboardList, Activity, BarChart3, Wrench,
  HardHat, Clock,
} from "lucide-react";
import {
  uploadExcelStream,
  type SheetEvent,
} from "../../services/organisation-setup.service";

// ── Sheet schema: required & optional columns ─────────────────────────────────
interface SheetSchema {
  key: string;
  excelName: string;
  label: string;
  icon: React.ElementType;
  color: string;
  required: string[];
  optional: string[];
  note?: string;
}

const SHEET_SCHEMAS: SheetSchema[] = [
  {
    key: "organisation", excelName: "Organisation", label: "Organisation",
    icon: Building2, color: "#1D4ED8",
    required: ["Organisation_Name"],
    optional: ["Country", "Industry_Sector", "Number_of_Employees", "Headquarters_Location", "Parent_Company", "ISO_45001_Status", "Regulatory_Authority", "Establishment_Date"],
  },
  {
    key: "sites", excelName: "Sites", label: "Sites",
    icon: MapPin, color: "#0891B2",
    required: ["Site_Name"],
    optional: ["Address", "Postcode", "City", "Type", "Operational_Status", "Number_of_Working_Stations", "Capacity", "Primary_Products", "Hazard_Classification"],
  },
  {
    key: "hazard_categories", excelName: "Hazard_Categories", label: "Hazard Categories",
    icon: AlertCircle, color: "#EA580C",
    required: ["Category_Name"],
    optional: ["Description"],
  },
  {
    key: "hazards", excelName: "Hazards", label: "Hazards",
    icon: AlertCircle, color: "#B91C1C",
    required: ["Hazard_Category_ID", "Hazard_Name"],
    optional: ["Severity", "Probability"],
    note: "Hazard_Category_ID must reference a valid Hazard_Categories row (e.g. HC001)",
  },
  {
    key: "roles", excelName: "Roles", label: "Roles",
    icon: ShieldCheck, color: "#D97706",
    required: ["Role_Name"],
    optional: ["Job_Category", "Authority_Level", "Permit_Authority", "Safety_Signatory"],
  },
  {
    key: "permit_types", excelName: "Permit_Types", label: "Permit Types",
    icon: ClipboardList, color: "#9333EA",
    required: ["Permit_Type_Name"],
    optional: ["Risk_Level", "Validity_Period_Hours", "Concurrent_Limit"],
  },
  {
    key: "training_programs", excelName: "Training_Programs", label: "Training Programs",
    icon: ShieldCheck, color: "#0D9488",
    required: ["Training_Name"],
    optional: ["Duration_Hours", "Frequency", "Certification", "Expiry_Months"],
  },
  {
    key: "policies", excelName: "Policies", label: "Policies",
    icon: ClipboardList, color: "#2563EB",
    required: ["Policy_Name"],
    optional: ["Category", "Issue_Date", "Owner", "Status"],
  },
  {
    key: "departments", excelName: "Departments", label: "Departments",
    icon: Building2, color: "#7C3AED",
    required: ["Site_ID", "Department_Name"],
    optional: ["Manager_ID", "Number_of_Teams"],
    note: "Site_ID must reference a valid Sites row (e.g. SITE001). Manager_ID linked after Employees are imported.",
  },
  {
    key: "working_stations", excelName: "Working_Stations", label: "Working Stations",
    icon: MapPin, color: "#059669",
    required: ["Station_Name", "Site_ID"],
    optional: ["Department", "Zone_Classification", "Primary_Hazards", "Staffing_Requirement", "Equipment_List", "Permit_Types_Required", "Access_Restrictions"],
    note: "Primary_Hazards must reference a valid Hazards row (e.g. HAZ001).",
  },
  {
    key: "equipment", excelName: "Equipment_Register", label: "Equipment Register",
    icon: Wrench, color: "#0EA5E9",
    required: ["Equipment_ID", "Equipment_Name"],
    optional: ["Equipment_Type", "Location_Station", "Installation_Date", "PM_Interval_Days", "Last_PM_Date", "Next_PM_Due", "Operating_Hours_YTD", "Last_Failure_Date", "MTBF_Hours_Estimated", "Safety_Critical_SCE", "Status"],
    note: "Location_Station is a free-text code (e.g. STN001) — not linked to the Working_Stations sheet. Safety_Critical_SCE is Yes/No.",
  },
  {
    key: "contractor_companies", excelName: "Contractor_Companies", label: "Contractor Companies",
    icon: HardHat, color: "#B45309",
    required: ["Contractor_ID", "Company_Name"],
    optional: ["Service_Type", "Contract_Start_Date", "Contract_End_Date", "Prequalification_Status", "ISO_45001_Certified", "Last_Safety_Audit_Date", "Safety_Performance_Score_0_100", "Active_Y_N"],
    note: "Prequalification_Status is one of Approved/Conditional/Barred/Pending. Safety_Performance_Score_0_100 becomes this quarter's Contractor Scorecard entry.",
  },
  {
    key: "contractor_workers", excelName: "Contractor_Workers", label: "Contractor Workers",
    icon: Users, color: "#B45309",
    required: ["Worker_ID", "Contractor_ID", "Full_Name"],
    optional: ["Badge_No", "Trade", "Induction_Date", "Induction_Valid_Until", "Site_Access_Status"],
    note: "Contractor_ID must reference a valid Contractor_Companies row (e.g. CONT001).",
  },
  {
    key: "contractor_hours", excelName: "Contractor_Hours", label: "Contractor Hours",
    icon: Clock, color: "#B45309",
    required: ["Row_ID", "Contractor_ID", "Year", "Month"],
    optional: ["Hours_Worked"],
    note: "Contractor_ID must reference a valid Contractor_Companies row (e.g. CONT001). One row per contractor per calendar month.",
  },
  {
    key: "employees", excelName: "Employees", label: "Employees",
    icon: Users, color: "#DC2626",
    required: ["Full_Name"],
    optional: ["Date_of_Birth", "Gender", "Employment_Type", "Employment_Start_Date", "Job_Title (Role_ID)", "Department (Dept_ID)", "Shift_Pattern", "Manager_ID", "Induction_Date", "Active_Status"],
    note: "Job_Title uses Role IDs (e.g. ROLE001). Department uses Dept IDs (e.g. DEPT001). Manager_ID is self-referential.",
  },
  {
    key: "dept_managers", excelName: "Departments (manager update)", label: "Dept. Manager Links",
    icon: Users, color: "#7C3AED",
    required: [],
    optional: ["Manager_ID"],
    note: "Automatic step — updates Department.Manager_ID after Employees are inserted to resolve the circular dependency.",
  },
  {
    key: "permits_to_work", excelName: "Permits_To_Work", label: "Permits to Work",
    icon: ClipboardList, color: "#4F46E5",
    required: ["Permit_Type_ID", "Date_Issued"],
    optional: ["Time_Issued", "Location_Station_ID", "Work_Description", "Duration_Requested_Hours", "Issued_By", "Approved_By", "Validity_Start", "Validity_End", "Work_Start_Actual", "Work_End_Actual", "Number_of_Workers", "Status", "Deviation_Reported", "Incident_Occurred"],
    note: "Permit_Type_ID e.g. PT001. Location_Station_ID e.g. STN001. Issued_By / Approved_By must reference Employee IDs.",
  },
  {
    key: "incidents", excelName: "Incidents", label: "Incidents",
    icon: Activity, color: "#DC2626",
    required: [],
    optional: ["Report_Date", "Incident_DateTime", "Location_Station", "Incident_Type", "Severity", "Number_Persons_Involved", "Description", "Immediate_Cause", "Root_Cause", "Hazard_Involved", "Permit_Active", "Control_Failure", "Reported_By", "Investigation_Status", "CAPA_Generated", "Days_Away", "Root_Cause_Category"],
    note: "All columns optional. Hazard_Involved e.g. HAZ001. Reported_By e.g. EMP001.",
  },
  {
    key: "near_misses", excelName: "Near_Misses", label: "Near Misses",
    icon: Activity, color: "#D97706",
    required: [],
    optional: ["Report_Date", "Event_DateTime", "Location_Station", "Description", "Potential_Consequence", "Hazard_Involved", "Underlying_Cause", "Control_Failure", "Reported_By", "CAPA_Escalation"],
  },
  {
    key: "safety_walks", excelName: "Safety_Walks", label: "Safety Walks",
    icon: ShieldCheck, color: "#16A34A",
    required: [],
    optional: ["Inspection_DateTime", "Location_Station", "Inspector", "Inspection_Type", "Issues_Found", "Critical_Issues", "Housekeeping_Rating", "Compliance_Rating", "Follow_Up_Required"],
    note: "Inspector must reference an Employee ID (e.g. EMP001).",
  },
  {
    key: "capa_actions", excelName: "CAPA_Actions", label: "CAPA Actions",
    icon: ClipboardList, color: "#7C3AED",
    required: [],
    optional: ["Incident_ID", "Action_Type", "Description", "Root_Cause_Addressed", "Responsible_Person", "Due_Date", "Status", "Effectiveness_Rating"],
    note: "Incident_ID must reference a valid Incidents row (e.g. INC00001).",
  },
  {
    key: "shift_schedule", excelName: "Shift_Schedule", label: "Shift Schedule",
    icon: BarChart3, color: "#0369A1",
    required: ["Employee_ID", "Shift_Date"],
    optional: ["Shift_Type", "Shift_Start", "Shift_End", "Actual_Hours_Worked", "Station_Assigned", "Supervisor"],
    note: "Largest sheet (~73k rows). Employee_ID e.g. EMP001. Station_Assigned e.g. STN001.",
  },
];

const SCHEMA_MAP = Object.fromEntries(SHEET_SCHEMAS.map((s) => [s.key, s]));

// ── Queue item status type ────────────────────────────────────────────────────
type ItemStatus = "pending" | "processing" | "done" | "error" | "skipped";

interface QueueItem {
  key: string;
  label: string;
  status: ItemStatus;
  count?: number;
  error?: string;
}

// ── Small components ──────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "processing") return <Loader2 size={16} color="#1D4ED8" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />;
  if (status === "done")       return <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0 }} />;
  if (status === "error")      return <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0 }} />;
  return <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #D1D5DB", flexShrink: 0 }} />;
}

function FieldPill({ label, required }: { label: string; required: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 500,
        background: required ? "#EFF6FF" : "#F9FAFB",
        color: required ? "#1D4ED8" : "#6B7280",
        border: `1px solid ${required ? "#BFDBFE" : "#E5E7EB"}`,
        margin: "2px 3px 2px 0",
      }}
    >
      {label}
      {required && <span style={{ color: "#DC2626", marginLeft: 2 }}>*</span>}
    </span>
  );
}

function SchemaCard({ schema, open, onToggle }: { schema: SheetSchema; open: boolean; onToggle: () => void }) {
  const Icon = schema.icon;
  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 8,
        background: "#fff",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${schema.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={14} color={schema.color} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A", flex: 1 }}>{schema.label}</span>
        {schema.required.length > 0 && (
          <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 600, marginRight: 4 }}>
            {schema.required.length} required
          </span>
        )}
        {open ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
      </button>

      {open && (
        <div style={{ padding: "0 14px 12px", borderTop: "1px solid #F3F4F6" }}>
          {schema.required.length > 0 && (
            <div style={{ marginTop: 10, marginBottom: 6 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.4px" }}>Required columns</p>
              <div>{schema.required.map((f) => <FieldPill key={f} label={f} required />)}</div>
            </div>
          )}
          {schema.optional.length > 0 && (
            <div style={{ marginBottom: schema.note ? 6 : 0 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.4px" }}>Optional columns</p>
              <div>{schema.optional.map((f) => <FieldPill key={f} label={f} required={false} />)}</div>
            </div>
          )}
          {schema.required.length === 0 && schema.optional.length === 0 && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>Automatic step — no columns required.</p>
          )}
          {schema.note && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, padding: "7px 10px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 7 }}>
              <Info size={13} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 11, color: "#92400E", lineHeight: 1.5 }}>{schema.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Step = "select" | "queue" | "done";

export function OrgSetupPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("select");
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [openSchemas, setOpenSchemas] = useState<Set<string>>(new Set());

  // Queue state
  const [queue, setQueue] = useState<QueueItem[]>(() =>
    SHEET_SCHEMAS.map((s) => ({ key: s.key, label: s.label, status: "pending" as ItemStatus })),
  );
  const [totalRows, setTotalRows] = useState(0);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [hasErrors, setHasErrors] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("hse_user");
      const u = raw ? JSON.parse(raw) : null;
      if (u?.email) setAdminEmail(u.email);
      if (u?.orgName) setOrgName(u.orgName);
    } catch { /* ignore */ }
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setFileError("Please upload an Excel file (.xlsx or .xls only).");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setFileError("File size must be under 50 MB.");
      return;
    }
    setFileError(null);
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const toggleSchema = (key: string) => {
    setOpenSchemas((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const updateQueueItem = (key: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item) => item.key === key ? { ...item, ...patch } : item));
  };

  const startImport = async () => {
    if (!selectedFile) return;
    setStep("queue");
    setGlobalError(null);
    setHasErrors(false);
    setTotalRows(0);
    setQueue(SHEET_SCHEMAS.map((s) => ({ key: s.key, label: s.label, status: "pending" })));

    try {
      await uploadExcelStream(adminEmail, selectedFile, (event: SheetEvent) => {
        if (event.type === "fatal") {
          setGlobalError(event.error ?? "A fatal error occurred on the server.");
          return;
        }
        if (event.type === "processing" && event.key) {
          updateQueueItem(event.key, { status: "processing" });
        }
        if (event.type === "done" && event.key) {
          updateQueueItem(event.key, { status: "done", count: event.count ?? 0 });
        }
        if (event.type === "error" && event.key) {
          updateQueueItem(event.key, { status: "error", error: event.error });
          setHasErrors(true);
        }
        if (event.type === "complete") {
          setTotalRows(event.total_rows ?? 0);
          setHasErrors(event.has_errors ?? false);
          setStep("done");
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed. Please try again.";
      setGlobalError(msg);
    }
  };

  const retry = () => {
    setStep("select");
    setSelectedFile(null);
    setFileError(null);
    setGlobalError(null);
    setHasErrors(false);
    setQueue(SHEET_SCHEMAS.map((s) => ({ key: s.key, label: s.label, status: "pending" })));
  };

  const errorItems = queue.filter((q) => q.status === "error");
  const doneItems  = queue.filter((q) => q.status === "done");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#F0F4FF 0%,#E8F0FE 100%)",
        fontFamily: "'Segoe UI',Arial,sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          background: "linear-gradient(135deg,#0B3D91,#1D4ED8)",
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <ShieldCheck size={22} color="#fff" />
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>EHSERA Intelligence</span>
        {orgName && (
          <>
            <span style={{ color: "rgba(255,255,255,0.4)", margin: "0 6px" }}>|</span>
            <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
              Setting up <strong style={{ color: "#fff" }}>{orgName}</strong>
            </span>
          </>
        )}
      </div>

      {/* Progress steps */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #E5E7EB",
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {(["select", "queue", "done"] as Step[]).map((s, i) => {
          const labels = ["1. Select File", "2. Import Queue", "3. Complete"];
          const active = s === step;
          const past = (["select","queue","done"] as Step[]).indexOf(step) > i;
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 14px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  background: active ? "#1D4ED8" : past ? "#DCFCE7" : "#F3F4F6",
                  color: active ? "#fff" : past ? "#065F46" : "#9CA3AF",
                }}
              >
                {past && !active && <CheckCircle2 size={13} />}
                {labels[i]}
              </span>
              {i < 2 && <span style={{ color: "#D1D5DB" }}>›</span>}
            </div>
          );
        })}
      </div>

      {/* Main content */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "32px 24px",
          display: "grid",
          gridTemplateColumns: step === "select" ? "1fr 360px" : "1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* ── SELECT FILE STEP ──────────────────────────────────── */}
        {step === "select" && (
          <>
            {/* Left: Upload card */}
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #E5E7EB",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                padding: "32px",
              }}
            >
              <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#0A0A0A" }}>
                Organisation Data Setup
              </h1>
              <p style={{ margin: "0 0 28px", color: "#6B7280", fontSize: 14, lineHeight: 1.6 }}>
                Upload the EHSERA Intelligence Excel workbook to import all your organisation data at once.
                The file must contain all {SHEET_SCHEMAS.length} sheets listed on the right.
              </p>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? "#1D4ED8" : selectedFile ? "#059669" : "#D1D5DB"}`,
                  borderRadius: 14,
                  background: dragging ? "#EEF2FF" : selectedFile ? "#F0FDF4" : "#FAFAFA",
                  padding: "40px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  marginBottom: 20,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                {selectedFile ? (
                  <>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                      <FileSpreadsheet size={28} color="#16A34A" />
                    </div>
                    <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#0A0A0A", fontSize: 16 }}>{selectedFile.name}</p>
                    <p style={{ margin: "0 0 12px", color: "#6B7280", fontSize: 13 }}>
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB — ready to import
                    </p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setFileError(null); }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", border: "1px solid #FECACA", borderRadius: 6, background: "#FEF2F2", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      <X size={12} /> Remove file
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                      <Upload size={26} color="#1D4ED8" />
                    </div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#374151", fontSize: 15 }}>Drag & drop your Excel file here</p>
                    <p style={{ margin: 0, color: "#9CA3AF", fontSize: 13 }}>or click to browse — .xlsx / .xls, max 50 MB</p>
                  </>
                )}
              </div>

              {/* Validation error */}
              {fileError && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
                  <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ margin: 0, color: "#991B1B", fontSize: 13 }}>{fileError}</p>
                </div>
              )}

              {/* What this does info */}
              <div style={{ background: "#F0F4FF", border: "1px solid #C7D7FD", borderRadius: 10, padding: "14px 16px", marginBottom: 24 }}>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.4px" }}>What happens after upload</p>
                <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                  <li>All {SHEET_SCHEMAS.length} sheets are imported in the correct order (respecting foreign keys)</li>
                  <li>String ID prefixes (EMP001, SITE001, STN001…) are automatically stripped</li>
                  <li>Each sheet is processed and validated individually in the queue</li>
                  <li>Errors are shown per sheet — other sheets continue even if one fails</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={startImport}
                disabled={!selectedFile}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "14px 20px",
                  border: "none",
                  borderRadius: 10,
                  background: selectedFile ? "linear-gradient(135deg,#0B3D91,#1D4ED8)" : "#E5E7EB",
                  color: selectedFile ? "#fff" : "#9CA3AF",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: selectedFile ? "pointer" : "not-allowed",
                  boxShadow: selectedFile ? "0 4px 14px rgba(11,61,145,0.3)" : "none",
                  transition: "all 0.2s",
                }}
              >
                <Upload size={18} />
                Start Import Queue
                <ArrowRight size={16} />
              </button>
            </div>

            {/* Right: Schema reference */}
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #E5E7EB",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                padding: "24px",
                maxHeight: "75vh",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Info size={16} color="#1D4ED8" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A" }}>
                  Required &amp; Optional Fields
                </span>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
                Click any sheet to see its column requirements.
                <span style={{ color: "#DC2626" }}> *</span> = required column.
              </p>
              {SHEET_SCHEMAS.map((schema) => (
                <SchemaCard
                  key={schema.key}
                  schema={schema}
                  open={openSchemas.has(schema.key)}
                  onToggle={() => toggleSchema(schema.key)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── QUEUE STEP ───────────────────────────────────────── */}
        {(step === "queue" || step === "done") && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "22px 28px",
                borderBottom: "1px solid #E5E7EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0A0A0A" }}>
                  {step === "queue" ? "Importing Sheets…" : hasErrors ? "Import Completed with Errors" : "Import Complete!"}
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
                  {step === "queue"
                    ? `Processing ${SHEET_SCHEMAS.length} sheets in sequence`
                    : `${doneItems.length} of ${SHEET_SCHEMAS.length} sheets imported · ${totalRows.toLocaleString()} total rows`}
                </p>
              </div>
              {step === "done" && (
                <div style={{ display: "flex", gap: 10 }}>
                  {hasErrors && (
                    <button
                      type="button"
                      onClick={retry}
                      style={{ padding: "9px 18px", border: "1.5px solid #D1D5DB", borderRadius: 8, background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      Retry Upload
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/", { replace: true })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "9px 18px",
                      border: "none",
                      borderRadius: 8,
                      background: "linear-gradient(135deg,#0B3D91,#1D4ED8)",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Go to Dashboard <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Global fatal error */}
            {globalError && (
              <div style={{ margin: "16px 28px 0", display: "flex", alignItems: "flex-start", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px" }}>
                <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#991B1B", fontSize: 14 }}>Upload failed</p>
                  <p style={{ margin: 0, color: "#991B1B", fontSize: 13 }}>{globalError}</p>
                  <button
                    type="button"
                    onClick={retry}
                    style={{ marginTop: 10, padding: "6px 14px", border: "1.5px solid #FECACA", borderRadius: 6, background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Error summary */}
            {step === "done" && errorItems.length > 0 && (
              <div style={{ margin: "16px 28px 0", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#C2410C" }}>
                  {errorItems.length} sheet{errorItems.length > 1 ? "s" : ""} failed to import
                </p>
                {errorItems.map((item) => (
                  <div key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                    <AlertCircle size={13} color="#EA580C" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#9A3412" }}>{item.label}: </span>
                      <span style={{ fontSize: 12, color: "#9A3412" }}>{item.error}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Queue list */}
            <div style={{ padding: "16px 28px 24px" }}>
              {queue.map((item, idx) => {
                const schema = SCHEMA_MAP[item.key];
                const Icon = schema?.icon ?? ClipboardList;
                const color = schema?.color ?? "#1D4ED8";
                const rowBg = item.status === "processing" ? "#F0F4FF"
                  : item.status === "done" ? "#F0FDF4"
                  : item.status === "error" ? "#FEF2F2"
                  : "#FAFAFA";
                const borderColor = item.status === "processing" ? "#BFDBFE"
                  : item.status === "done" ? "#BBF7D0"
                  : item.status === "error" ? "#FECACA"
                  : "#E5E7EB";
                return (
                  <div
                    key={item.key}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: `1px solid ${borderColor}`,
                      background: rowBg,
                      marginBottom: 8,
                      transition: "all 0.3s",
                    }}
                  >
                    {/* Step number / status icon */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 2 }}>
                      <StatusIcon status={item.status} />
                      {idx < queue.length - 1 && (
                        <div style={{ width: 1, height: 16, background: "#E5E7EB" }} />
                      )}
                    </div>

                    {/* Sheet icon */}
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={16} color={color} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{item.label}</span>
                        {item.status === "processing" && (
                          <span style={{ fontSize: 11, color: "#1D4ED8", fontWeight: 600 }}>Importing…</span>
                        )}
                        {item.status === "done" && (
                          <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>
                            {item.count?.toLocaleString()} rows imported
                          </span>
                        )}
                        {item.status === "error" && (
                          <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 600 }}>Failed</span>
                        )}
                        {item.status === "pending" && (
                          <span style={{ fontSize: 11, color: "#9CA3AF" }}>Waiting…</span>
                        )}
                      </div>

                      {/* Inline error detail */}
                      {item.status === "error" && item.error && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: "7px 10px",
                            background: "#FEF2F2",
                            border: "1px solid #FECACA",
                            borderRadius: 6,
                            fontSize: 12,
                            color: "#991B1B",
                            fontFamily: "monospace",
                            wordBreak: "break-word",
                          }}
                        >
                          {item.error}
                        </div>
                      )}

                      {/* Required columns hint when pending or processing */}
                      {(item.status === "pending" || item.status === "processing") && schema?.required.length > 0 && (
                        <p style={{ margin: "3px 0 0", fontSize: 11, color: "#9CA3AF" }}>
                          Requires: {schema.required.join(", ")}
                        </p>
                      )}
                    </div>

                    {/* Row count badge */}
                    {item.status === "done" && item.count !== undefined && (
                      <div
                        style={{
                          padding: "3px 10px",
                          borderRadius: 20,
                          background: "#DCFCE7",
                          color: "#065F46",
                          fontSize: 12,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {item.count.toLocaleString()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom summary */}
            {step === "done" && !hasErrors && (
              <div
                style={{
                  margin: "0 28px 24px",
                  padding: "16px 20px",
                  background: "linear-gradient(135deg,#065F46,#059669)",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <CheckCircle2 size={28} color="#fff" />
                <div>
                  <p style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 15 }}>
                    All {SHEET_SCHEMAS.length} sheets imported successfully
                  </p>
                  <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
                    {totalRows.toLocaleString()} total records are now available in your HSE dashboard.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
