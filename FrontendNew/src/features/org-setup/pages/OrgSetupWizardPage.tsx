import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/app/context/AuthContext";
import {
  CheckCircle2, Circle, Loader2, Building2, ChevronRight, ChevronDown,
  Upload, Download, Plus, Trash2, X, Check, AlertTriangle, FileText,
  Brain, Zap, BarChart3, Users, Shield, Clock, Wrench, HardHat,
} from "lucide-react";
import {
  useGetOrgSetupProgressQuery, useGetOrgSetupStep1Query, useGetOrgSetupStep2Query,
  useGetOrgSetupStep3SitesQuery, useGetOrgSetupStep4UsersQuery, useGetOrgSetupStep5Query,
  useGetOrgSetupStep6DocumentsQuery, useGetOrgSetupStep6aImportsQuery, useGetOrgSetupStep7Query,
  useSaveOrgSetupStep1Mutation, useSaveOrgSetupStep2Mutation, useCreateOrgSetupSiteMutation,
  useBulkUploadOrgSetupSitesMutation, useCreateOrgSetupUserMutation, useBulkUploadOrgSetupUsersMutation,
  useSaveOrgSetupStep5Mutation, useUploadOrgSetupKnowledgeMutation, useImportOrgSetupDataMutation,
  useBulkImportModuleMutation, useSaveOrgSetupStep7Mutation, useActivateOrganizationMutation,
  useHrmsImportMutation, useParseOrgExcelMutation, useConnectOrgApiMutation,
  resetOrgSetupWizard,
} from "@/features/org-setup/api/orgSetupApi";

// ── Helpers ────────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

async function downloadTemplate(path: string, filename: string) {
  const token = localStorage.getItem("hse_jwt_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STEP_LABELS = ["Organisation Details","Compliance","Sites","Users","Workflows","Knowledge","AI Setup","Review"];

const INDUSTRY_SECTORS = ["Construction","Oil & Gas","Manufacturing","Mining","Logistics & Transport","Power & Utilities","Healthcare","Chemicals","Agriculture","Other"];
const ISO_45001_STATUSES = ["Certified","In Progress","Planned","Not Started","Expired"];
const SITE_TYPES = ["Site","Plant","Branch","Zone","Department","Unit","Manufacturing & Assembly","Warehouse","Distribution Centre","Research & Development"];
const OPERATIONAL_STATUSES = ["Active","Inactive","Under Construction","Maintenance","Decommissioned"];
const HAZARD_CLASSIFICATIONS = ["Low Risk","Medium Risk","High Risk","Critical"];
const USER_ROLES = ["Site HSE Manager","Supervisor","Worker","Auditor"];
const WORKFLOW_CARDS = [
  { key: "permitWorkflows", label: "Permit Workflows" },
  { key: "incidentWorkflows", label: "Incident Workflows" },
  { key: "auditWorkflows", label: "Audit Workflows" },
  { key: "capaWorkflows", label: "CAPA Workflows" },
  { key: "escalationRules", label: "Escalation Rules" },
  { key: "approvalLevels", label: "Approval Levels / Closure Rules" },
];
const AI_FEATURES = [
  { key: "aiAssistant", label: "AI Assistant", desc: "Natural language interface for HSE queries and guidance" },
  { key: "predictiveRiskEngine", label: "Predictive Risk Engine", desc: "ML-powered risk prediction based on historical data" },
  { key: "complianceAI", label: "Compliance AI", desc: "Automated compliance monitoring and gap analysis" },
  { key: "aiRecommendations", label: "AI Recommendations", desc: "Contextual safety recommendations and best practices" },
  { key: "benchmarkingEngine", label: "Benchmarking Engine", desc: "Industry benchmark comparisons and performance tracking" },
  { key: "fatigueAnalysis", label: "Fatigue Analysis", desc: "Worker fatigue detection and shift schedule optimization" },
  { key: "trendAnalysis", label: "Trend Analysis", desc: "Incident and near-miss trend detection and forecasting" },
];
const DOC_TYPES = ["Policy","Procedure","Risk Assessment","Training Material","Audit Report","SOP","Regulation","Other"];
const DATA_IMPORT_TYPES = [
  { key: "employees", label: "Employees", icon: Users },
  { key: "departments", label: "Departments", icon: Building2 },
  { key: "working_stations", label: "Working Stations", icon: BarChart3 },
  { key: "roles", label: "Roles", icon: Shield },
  { key: "policies", label: "Policies", icon: FileText },
  { key: "permit_types", label: "Permit Types", icon: FileText },
  { key: "hazard_categories", label: "Hazard Categories", icon: AlertTriangle },
  { key: "hazards", label: "Hazards", icon: AlertTriangle },
  { key: "training_programs", label: "Training Programs", icon: Brain },
  { key: "permits_to_work", label: "Permits To Work", icon: FileText },
  { key: "incidents", label: "Incidents", icon: AlertTriangle },
  { key: "near_misses", label: "Near Misses", icon: Shield },
  { key: "safety_walks", label: "Safety Walks", icon: Check },
  { key: "capa_actions", label: "CAPA Actions", icon: Zap },
  { key: "shift_schedule", label: "Shift Schedule", icon: Clock },
  { key: "equipment", label: "Equipment Register", icon: Wrench },
  { key: "contractor_companies", label: "Contractor Companies", icon: HardHat },
  { key: "contractor_workers", label: "Contractor Workers", icon: Users },
  { key: "contractor_hours", label: "Contractor Hours", icon: Clock },
];

type FieldDef = { label: string; key: string; type: string; placeholder?: string; options?: string[]; required?: boolean };
const IMPORT_FIELDS: Record<string, FieldDef[]> = {
  employees: [
    { label: "Employee ID", key: "employee_id", type: "text", placeholder: "EMP001", required: true },
    { label: "Full Name", key: "full_name", type: "text", placeholder: "Jessica Hernandez", required: true },
    { label: "Date of Birth", key: "date_of_birth", type: "date" },
    { label: "Gender", key: "gender", type: "select", options: ["M","F","Other"] },
    { label: "Employment Type", key: "employment_type", type: "select", options: ["Permanent","Contract","Part-time","Temporary"] },
    { label: "Employment Start Date", key: "employment_start_date", type: "date" },
    { label: "Job Title / Role ID", key: "job_title", type: "text", placeholder: "ROLE001 or Plant Manager" },
    { label: "Department", key: "department", type: "text", placeholder: "DEPT001 or Heavy Assembly" },
    { label: "Shift Pattern", key: "shift_pattern", type: "select", options: ["Rotating","Days","Nights","Afternoon","Fixed"] },
    { label: "Manager ID", key: "manager_id", type: "text", placeholder: "EMP001" },
    { label: "Active Status", key: "active_status", type: "select", options: ["Active","Inactive","On Leave"] },
  ],
  departments: [
    { label: "Department ID", key: "department_id", type: "text", placeholder: "DEPT001", required: true },
    { label: "Site ID", key: "site_id", type: "text", placeholder: "SITE001", required: true },
    { label: "Department Name", key: "department_name", type: "text", placeholder: "Heavy Assembly", required: true },
    { label: "Manager ID", key: "manager_id", type: "text", placeholder: "EMP001" },
  ],
  roles: [
    { label: "Role ID", key: "role_id", type: "text", placeholder: "ROLE001", required: true },
    { label: "Role Name", key: "role_name", type: "text", placeholder: "Plant Manager", required: true },
    { label: "Job Category", key: "job_category", type: "text", placeholder: "Senior Management" },
    { label: "Authority Level", key: "authority_level", type: "number", placeholder: "5" },
  ],
  incidents: [
    { label: "Incident ID", key: "incident_id", type: "text", placeholder: "INC00001", required: true },
    { label: "Report Date", key: "report_date", type: "date", required: true },
    { label: "Incident Type", key: "incident_type", type: "select", options: ["Injury","Damage","Near-miss","Fire","Environmental","Unsafe Act","Unsafe Condition"] },
    { label: "Severity", key: "severity", type: "select", options: ["Minor","Significant","Serious","Lost Time","Fatality"] },
    { label: "Description", key: "description", type: "textarea", placeholder: "Brief description…" },
  ],
};

// ── Style helpers ──────────────────────────────────────────────────────────────
const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100";
const inputStyle = { borderColor: "#E3E9F6" };
const labelCls = "block text-xs font-semibold mb-1";
const labelStyle = { color: "#6B7280" };
const primaryBtnCls = "px-4 py-2 rounded-xl text-white text-sm font-semibold flex items-center gap-2 transition-opacity";
const primaryBtnStyle = { background: "linear-gradient(135deg, #4A57B9, #6F80E8)" };
const secondaryBtnCls = "px-4 py-2 rounded-xl text-sm font-semibold border flex items-center gap-2 transition-colors";
const secondaryBtnStyle = { borderColor: "#E3E9F6", color: "#6B7280" };
const cardCls = "bg-white rounded-2xl border p-5";
const cardStyle = { borderColor: "#E3E9F6" };

// ── Step Indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ currentStep, completedSteps, onStepClick }: { currentStep: number; completedSteps: number[]; onStepClick?: (step: number) => void }) {
  return (
    <div className="bg-white rounded-2xl border p-5 overflow-x-auto" style={{ borderColor: "#E3E9F6" }}>
      <div className="flex items-center min-w-max gap-0">
        {STEP_LABELS.map((label, idx) => {
          const step = idx + 1;
          const isActive = step === currentStep;
          const isDone = completedSteps.includes(step);
          const isClickable = isDone && onStepClick;
          return (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${isClickable ? "cursor-pointer hover:opacity-80" : ""}`}
                  style={isDone ? { background: "#10B981", color: "#fff" } : isActive ? { background: "linear-gradient(135deg, #4A57B9, #6F80E8)", color: "#fff", boxShadow: "0 4px 12px rgba(74,87,185,0.35)" } : { background: "#F3F4F6", color: "#9CA3AF" }}
                  onClick={() => isClickable && onStepClick(step)}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : <span>{step}</span>}
                </div>
                <span className="text-[10px] font-semibold text-center w-16 leading-tight" style={{ color: isActive ? "#4A57B9" : isDone ? "#10B981" : "#9CA3AF" }}>{label}</span>
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div className="h-0.5 w-8 mx-1 mb-5 rounded-full" style={{ background: completedSteps.includes(step) ? "#10B981" : "#E3E9F6" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 1 ─────────────────────────────────────────────────────────────────────

type OrgForm = { organisationId: string; organisationName: string; country: string; industrySector: string; numberOfEmployees: string; headquartersLocation: string; parentCompany: string; iso45001Status: string; regulatoryAuthority: string; establishmentDate: string; };
const EMPTY_FORM: OrgForm = { organisationId: "", organisationName: "", country: "", industrySector: "", numberOfEmployees: "", headquartersLocation: "", parentCompany: "", iso45001Status: "", regulatoryAuthority: "", establishmentDate: "" };

function OrgDetailsForm({ form, set }: { form: OrgForm; set: (k: string, v: string) => void }) {
  const req = <span style={{ color: "#EF4444" }}> *</span>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div><label className={labelCls} style={labelStyle}>Organisation ID</label><input className={inputCls} style={inputStyle} placeholder="e.g. ORG-001" value={form.organisationId} onChange={(e) => set("organisationId", e.target.value)} /></div>
      <div><label className={labelCls} style={labelStyle}>Organisation Name{req}</label><input className={inputCls} style={inputStyle} placeholder="Enter organisation name" value={form.organisationName} onChange={(e) => set("organisationName", e.target.value)} /></div>
      <div><label className={labelCls} style={labelStyle}>Country{req}</label><input className={inputCls} style={inputStyle} placeholder="e.g. United Kingdom" value={form.country} onChange={(e) => set("country", e.target.value)} /></div>
      <div><label className={labelCls} style={labelStyle}>Industry Sector{req}</label><select className={inputCls} style={inputStyle} value={form.industrySector} onChange={(e) => set("industrySector", e.target.value)}><option value="">Select industry sector</option>{form.industrySector && !INDUSTRY_SECTORS.includes(form.industrySector) && <option value={form.industrySector}>{form.industrySector}</option>}{INDUSTRY_SECTORS.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
      <div><label className={labelCls} style={labelStyle}>Number of Employees{req}</label><input type="number" className={inputCls} style={inputStyle} placeholder="0" min="0" value={form.numberOfEmployees} onChange={(e) => set("numberOfEmployees", e.target.value)} /></div>
      <div><label className={labelCls} style={labelStyle}>Headquarters Location</label><input className={inputCls} style={inputStyle} placeholder="City, Country" value={form.headquartersLocation} onChange={(e) => set("headquartersLocation", e.target.value)} /></div>
      <div><label className={labelCls} style={labelStyle}>Parent Company</label><input className={inputCls} style={inputStyle} placeholder="Parent company name (if any)" value={form.parentCompany} onChange={(e) => set("parentCompany", e.target.value)} /></div>
      <div><label className={labelCls} style={labelStyle}>ISO 45001 Status</label><select className={inputCls} style={inputStyle} value={form.iso45001Status} onChange={(e) => set("iso45001Status", e.target.value)}><option value="">Select status</option>{ISO_45001_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
      <div><label className={labelCls} style={labelStyle}>Regulatory Authority</label><input className={inputCls} style={inputStyle} placeholder="e.g. HSE UK, OSHA" value={form.regulatoryAuthority} onChange={(e) => set("regulatoryAuthority", e.target.value)} /></div>
      <div><label className={labelCls} style={labelStyle}>Establishment Date</label><input type="date" className={inputCls} style={inputStyle} value={form.establishmentDate} onChange={(e) => set("establishmentDate", e.target.value)} /></div>
    </div>
  );
}

function Step1({ onNext, dataEntryOption: parentDataEntryOption, onDataEntryChange }: { onNext: () => void; dataEntryOption: "manual" | "excel" | "api"; onDataEntryChange: (opt: "manual" | "excel" | "api") => void }) {
  const [saveStep1, { isLoading: saving }] = useSaveOrgSetupStep1Mutation();
  const [parseExcel, { isLoading: parsing }] = useParseOrgExcelMutation();
  const [connectApi, { isLoading: connecting }] = useConnectOrgApiMutation();
  const { data: saved } = useGetOrgSetupStep1Query();
  const excelRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<OrgForm>(EMPTY_FORM);
  const [excelStatus, setExcelStatus] = useState<"idle"|"success"|"error">("idle");
  const [excelMsg, setExcelMsg] = useState("");
  const [apiUrl, setApiUrl] = useState(""); const [apiKey, setApiKey] = useState(""); const [apiToken, setApiToken] = useState("");
  const [apiStatus, setApiStatus] = useState<"idle"|"success"|"error">("idle"); const [apiMsg, setApiMsg] = useState("");
  const [step1Error, setStep1Error] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (saved && Object.keys(saved).length > 0) {
      const s = saved as Record<string, unknown>;
      setForm({ organisationId: String(s.organisationId ?? ""), organisationName: String(s.organisationName ?? ""), country: String(s.country ?? ""), industrySector: String(s.industrySector ?? ""), numberOfEmployees: String(s.numberOfEmployees ?? ""), headquartersLocation: String(s.headquartersLocation ?? ""), parentCompany: String(s.parentCompany ?? ""), iso45001Status: String(s.iso45001Status ?? ""), regulatoryAuthority: String(s.regulatoryAuthority ?? ""), establishmentDate: String(s.establishmentDate ?? "") });
      if (s.dataEntryOption && ["manual","excel","api"].includes(s.dataEntryOption as string)) onDataEntryChange(s.dataEntryOption as "manual"|"excel"|"api");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setExcelStatus("idle");
    const fd = new FormData(); fd.append("file", file);
    const result = await parseExcel(fd);
    const parsed = ("data" in result ? result.data : {}) as Record<string, string>;
    const fieldCount = Object.keys(parsed ?? {}).filter((k) => parsed[k] && k !== "_error").length;
    if (fieldCount > 0) {
      const { _error: _e, ...fields } = parsed; void _e;
      if (fields.industrySector) { const m = INDUSTRY_SECTORS.find((s) => s.toLowerCase() === fields.industrySector.toLowerCase()); if (m) fields.industrySector = m; }
      if (fields.iso45001Status) { const m = ISO_45001_STATUSES.find((s) => s.toLowerCase() === fields.iso45001Status.toLowerCase()); if (m) fields.iso45001Status = m; }
      setForm((f) => ({ ...f, ...fields })); setExcelStatus("success"); setExcelMsg(`${fieldCount} fields imported`);
    } else { setExcelStatus("error"); setExcelMsg(parsed?._error || "Could not read org details from file."); }
    if (excelRef.current) excelRef.current.value = "";
  };

  const handleApiConnect = async () => {
    if (!apiUrl.trim()) { setApiStatus("error"); setApiMsg("Please enter an API URL"); return; }
    setApiStatus("idle");
    const result = await connectApi({ url: apiUrl.trim(), api_key: apiKey.trim(), token: apiToken.trim() });
    if ("data" in result && result.data) {
      const d = (result.data as { data?: Record<string, string> }).data ?? {};
      const fieldCount = Object.keys(d).filter((k) => d[k]).length;
      if (fieldCount > 0) { setForm((f) => ({ ...f, ...d })); setApiStatus("success"); setApiMsg(`Connected! ${fieldCount} fields populated`); }
      else { setApiStatus("success"); setApiMsg("Connected successfully. No matching fields found — fill in manually."); }
    } else { setApiStatus("error"); setApiMsg("Connection failed — check the URL and try again"); }
  };

  const handleNext = async () => {
    if (!form.organisationName.trim()) { setStep1Error("Organisation Name is required."); return; }
    if (!form.country.trim()) { setStep1Error("Country is required."); return; }
    if (!form.industrySector) { setStep1Error("Industry Sector is required."); return; }
    setStep1Error("");
    await saveStep1({ ...form, numberOfEmployees: Number(form.numberOfEmployees) || 0, dataEntryOption: parentDataEntryOption, ...(parentDataEntryOption === "api" ? { apiUrl, apiKey, apiToken } : {}) });
    onNext();
  };

  const methods = [
    { key: "manual" as const, label: "Manual Entry", icon: "✏️", desc: "Fill in the organization details directly", color: "#4A57B9", bg: "#EEF2FF" },
    { key: "excel" as const, label: "Excel / CSV Upload", icon: "📊", desc: "Upload a spreadsheet to auto-populate details", color: "#059669", bg: "#D1FAE5" },
    { key: "api" as const, label: "API Integration", icon: "🔗", desc: "Connect to your ERP or HRMS via REST API", color: "#7C3AED", bg: "#F5F3FF" },
  ];
  const active = parentDataEntryOption;

  return (
    <div className="space-y-5">
      <div className={cardCls} style={cardStyle}>
        <h2 className="text-base font-bold mb-1" style={{ color: "#111827" }}>How would you like to set up your organization?</h2>
        <p className="text-xs mb-4" style={{ color: "#6B7280" }}>Select a method — your choice determines how data is entered in all steps.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {methods.map((m) => (
            <button key={m.key} type="button" onClick={() => onDataEntryChange(m.key)} className="p-5 rounded-2xl border-2 text-left transition-all" style={active === m.key ? { borderColor: m.color, background: m.bg, boxShadow: `0 0 0 3px ${m.color}22` } : { borderColor: "#E3E9F6", background: "#fff" }}>
              <div className="text-2xl mb-2">{m.icon}</div>
              <div className="text-sm font-bold mb-1" style={{ color: active === m.key ? m.color : "#111827" }}>{m.label}</div>
              <div className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>{m.desc}</div>
              {active === m.key && <div className="mt-2 text-xs font-semibold px-2 py-0.5 rounded-full w-fit" style={{ background: m.color, color: "#fff" }}>Selected</div>}
            </button>
          ))}
        </div>
      </div>

      {active === "excel" && (
        <div className={cardCls} style={{ ...cardStyle, borderColor: "#059669", borderWidth: 2 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold" style={{ color: "#111827" }}>Upload Organisation Details</h2>
            <button className={secondaryBtnCls} style={secondaryBtnStyle} onClick={() => downloadTemplate("/org-setup/step1/template", "org_details_template.csv")}><Download className="w-4 h-4" /> Download Template</button>
          </div>
          {excelStatus === "success" && <div className="mb-4 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "#D1FAE5", color: "#059669" }}>✓ {excelMsg}</div>}
          {excelStatus === "error" && <div className="mb-4 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "#FEF2F2", color: "#EF4444" }}>{excelMsg}</div>}
          <label className="flex flex-col items-center justify-center w-full py-10 rounded-2xl border-2 border-dashed cursor-pointer" style={{ borderColor: "#6EE7B7", background: "#F0FDF4" }}>
            {parsing ? <Loader2 className="w-10 h-10 mb-3 animate-spin" style={{ color: "#059669" }} /> : <Upload className="w-10 h-10 mb-3" style={{ color: "#059669" }} />}
            <span className="text-sm font-bold" style={{ color: "#059669" }}>{parsing ? "Parsing file…" : "Click to upload"}</span>
            <span className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Excel (.xlsx, .xls) or CSV</span>
            <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelUpload} />
          </label>
        </div>
      )}

      {active === "api" && (
        <div className={cardCls} style={{ ...cardStyle, borderColor: "#7C3AED", borderWidth: 2 }}>
          <h2 className="text-base font-bold mb-1" style={{ color: "#111827" }}>Connect via API</h2>
          {apiStatus === "success" && <div className="mb-4 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "#F5F3FF", color: "#7C3AED" }}>✓ {apiMsg}</div>}
          {apiStatus === "error" && <div className="mb-4 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "#FEF2F2", color: "#EF4444" }}>{apiMsg}</div>}
          <div className="space-y-3">
            <div><label className={labelCls} style={labelStyle}>API Endpoint URL *</label><input className={inputCls} style={inputStyle} placeholder="https://api.yourcompany.com/org/info" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className={labelCls} style={labelStyle}>API Key</label><input className={inputCls} style={inputStyle} placeholder="Your API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></div>
              <div><label className={labelCls} style={labelStyle}>Bearer Token</label><input className={inputCls} style={inputStyle} placeholder="Bearer token" value={apiToken} onChange={(e) => setApiToken(e.target.value)} /></div>
            </div>
            <button className={primaryBtnCls} style={{ ...primaryBtnStyle, background: "linear-gradient(135deg,#7C3AED,#9F67F5)" }} onClick={handleApiConnect} disabled={connecting}>
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}{connecting ? "Connecting…" : "Connect & Pull Data"}
            </button>
          </div>
        </div>
      )}

      <div className={cardCls} style={{ ...cardStyle, ...(active === "manual" ? { borderColor: "#4A57B9", borderWidth: 2 } : {}) }}>
        <h2 className="text-base font-bold mb-4" style={{ color: "#111827" }}>Organisation Details</h2>
        <OrgDetailsForm form={form} set={set} />
      </div>

      {step1Error && <div className="px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2" style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA" }}><AlertTriangle className="w-4 h-4 flex-shrink-0" />{step1Error}</div>}
      <div className="flex justify-end">
        <button className={primaryBtnCls} style={primaryBtnStyle} onClick={handleNext} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Next Step <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 2 ─────────────────────────────────────────────────────────────────────

const STANDARD_DETAILS = [
  { id: "ISO 45001", label: "ISO 45001", desc: "International standard for Occupational Health & Safety management systems.", badge: "Most common", badgeColor: "#4A57B9" },
  { id: "ISO 14001", label: "ISO 14001", desc: "Environmental Management System standard.", badge: "Environmental", badgeColor: "#059669" },
  { id: "OSHA", label: "OSHA", desc: "US Occupational Safety and Health Administration regulations.", badge: "US-based", badgeColor: "#D97706" },
  { id: "HSE", label: "UK HSE", desc: "Health and Safety Executive framework for UK-based operations.", badge: "UK-based", badgeColor: "#DC2626" },
  { id: "Internal SOP", label: "Internal SOP Only", desc: "Your organisation uses its own internal SOPs.", badge: "Custom", badgeColor: "#6B7280" },
];
const DEFAULT_SEVERITY = [
  { level: "Low", color: "#10B981", description: "Minor injury or near-miss — first aid only, no lost time." },
  { level: "Medium", color: "#F59E0B", description: "Medical treatment required — restricted duties." },
  { level: "High", color: "#EF4444", description: "Lost-time injury — more than 1 shift missed." },
  { level: "Critical", color: "#7C3AED", description: "Fatality, permanent disability, or major impact." },
];
const PERMIT_DETAILS = [
  { id: "Hot Work", label: "Hot Work", desc: "Welding, cutting, grinding — any work producing heat or sparks.", icon: "🔥" },
  { id: "Electrical", label: "Electrical Work", desc: "Live electrical work, isolation, LOTO procedures.", icon: "⚡" },
  { id: "Work at Height", label: "Work at Height", desc: "Scaffolding, roofing, ladders — anything above 2m.", icon: "🪜" },
  { id: "Confined Space", label: "Confined Space", desc: "Entry into tanks, silos, vaults or any enclosed space.", icon: "🚧" },
  { id: "Excavation", label: "Excavation", desc: "Ground-breaking, trenching, underground works.", icon: "⛏️" },
  { id: "Cold Work", label: "Cold Work", desc: "Non-sparking, low-energy maintenance work.", icon: "🔧" },
];

function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [saveStep2, { isLoading }] = useSaveOrgSetupStep2Mutation();
  const { data: saved2 } = useGetOrgSetupStep2Query();
  const [selectedStandards, setSelectedStandards] = useState<string[]>([]);
  const [regulatoryRegion, setRegulatoryRegion] = useState("");
  const [severityMatrix, setSeverityMatrix] = useState(DEFAULT_SEVERITY.map((r) => ({ level: r.level, description: r.description })));
  const [auditFrequency, setAuditFrequency] = useState(""); const [criticalDays, setCriticalDays] = useState("7"); const [standardDays, setStandardDays] = useState("30");
  const [selectedPermits, setSelectedPermits] = useState<string[]>([]);
  const [step2Error, setStep2Error] = useState("");

  useEffect(() => {
    if (saved2 && Object.keys(saved2).length > 0) {
      const s = saved2 as Record<string, unknown>;
      if (Array.isArray(s.applicableStandards)) setSelectedStandards(s.applicableStandards as string[]);
      if (typeof s.regulatoryRegion === "string") setRegulatoryRegion(s.regulatoryRegion);
      if (typeof s.auditFrequency === "string") setAuditFrequency(s.auditFrequency);
      if (s.capaSlaCriticalDays != null) setCriticalDays(String(s.capaSlaCriticalDays));
      if (s.capaSlaStandardDays != null) setStandardDays(String(s.capaSlaStandardDays));
      if (Array.isArray(s.permitTypes)) setSelectedPermits(s.permitTypes as string[]);
      if (Array.isArray(s.incidentSeverityMatrix)) setSeverityMatrix(s.incidentSeverityMatrix as typeof severityMatrix);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved2]);

  const toggleStandard = (id: string) => setSelectedStandards((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const togglePermit = (id: string) => setSelectedPermits((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const updateSeverity = (idx: number, desc: string) => setSeverityMatrix((p) => p.map((r, i) => i === idx ? { ...r, description: desc } : r));

  const handleNext = async () => {
    if (selectedStandards.length === 0) { setStep2Error("Please select at least one safety standard."); return; }
    setStep2Error("");
    await saveStep2({ applicableStandards: selectedStandards, regulatoryRegion, incidentSeverityMatrix: severityMatrix, auditFrequency, capaSlaCriticalDays: Number(criticalDays) || 7, capaSlaStandardDays: Number(standardDays) || 30, permitTypes: selectedPermits });
    onNext();
  };

  return (
    <div className="space-y-5">
      <div className={cardCls} style={cardStyle}>
        <h2 className="text-base font-bold mb-1" style={{ color: "#111827" }}>Which safety standards does your organisation follow?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {STANDARD_DETAILS.map((std) => {
            const active = selectedStandards.includes(std.id);
            return (
              <button key={std.id} type="button" onClick={() => toggleStandard(std.id)} className="text-left p-4 rounded-xl border-2 transition-all" style={active ? { borderColor: std.badgeColor, background: std.badgeColor + "0D" } : { borderColor: "#E3E9F6", background: "#fff" }}>
                <div className="flex items-center justify-between mb-1.5"><span className="text-sm font-bold" style={{ color: active ? std.badgeColor : "#111827" }}>{std.label}</span><div className="flex items-center gap-2"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: std.badgeColor + "18", color: std.badgeColor }}>{std.badge}</span>{active && <Check className="w-4 h-4" style={{ color: std.badgeColor }} />}</div></div>
                <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>{std.desc}</p>
              </button>
            );
          })}
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Regulatory Region</label>
          <input className={inputCls} style={inputStyle} placeholder="e.g. United Kingdom (UK HSE)" value={regulatoryRegion} onChange={(e) => setRegulatoryRegion(e.target.value)} />
        </div>
      </div>

      <div className={cardCls} style={cardStyle}>
        <h2 className="text-base font-bold mb-4" style={{ color: "#111827" }}>Incident Severity Matrix</h2>
        <div className="space-y-3">
          {severityMatrix.map((row, idx) => {
            const meta = DEFAULT_SEVERITY.find((d) => d.level === row.level)!;
            return (
              <div key={row.level} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-24 text-center px-2 py-1.5 rounded-lg" style={{ background: meta.color + "18", border: `1px solid ${meta.color}40` }}><span className="text-xs font-bold block" style={{ color: meta.color }}>{row.level}</span></div>
                <div className="flex-1"><input className={inputCls} style={inputStyle} value={row.description} onChange={(e) => updateSeverity(idx, e.target.value)} /></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={cardCls} style={cardStyle}>
        <h2 className="text-base font-bold mb-4" style={{ color: "#111827" }}>Permit Types Required</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PERMIT_DETAILS.map((permit) => {
            const active = selectedPermits.includes(permit.id);
            return (
              <button key={permit.id} type="button" onClick={() => togglePermit(permit.id)} className="text-left p-3.5 rounded-xl border-2 transition-all flex items-start gap-3" style={active ? { borderColor: "#4A57B9", background: "#EEF2FF" } : { borderColor: "#E3E9F6", background: "#fff" }}>
                <span className="text-xl flex-shrink-0">{permit.icon}</span>
                <div className="flex-1"><div className="flex items-center justify-between"><span className="text-sm font-bold" style={{ color: active ? "#4A57B9" : "#111827" }}>{permit.label}</span>{active && <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#4A57B9" }} />}</div><p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#6B7280" }}>{permit.desc}</p></div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={cardCls} style={cardStyle}>
        <h2 className="text-base font-bold mb-4" style={{ color: "#111827" }}>Audit Schedule & Closure Timelines</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
          <div><label className={labelCls} style={labelStyle}>Audit Frequency</label><select className={inputCls} style={inputStyle} value={auditFrequency} onChange={(e) => setAuditFrequency(e.target.value)}><option value="">Select frequency</option><option value="Monthly">Monthly</option><option value="Quarterly">Quarterly</option><option value="Bi-Annual">Bi-Annual</option><option value="Annual">Annual</option></select></div>
          <div><label className={labelCls} style={labelStyle}>Critical Finding Closure (days)</label><input type="number" min="1" placeholder="7" value={criticalDays} onChange={(e) => setCriticalDays(e.target.value)} className={inputCls} style={inputStyle} /></div>
          <div><label className={labelCls} style={labelStyle}>Standard Finding Closure (days)</label><input type="number" min="1" placeholder="30" value={standardDays} onChange={(e) => setStandardDays(e.target.value)} className={inputCls} style={inputStyle} /></div>
        </div>
      </div>

      {step2Error && <div className="px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2" style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA" }}><AlertTriangle className="w-4 h-4 flex-shrink-0" />{step2Error}</div>}
      <div className="flex justify-between">
        <button className={secondaryBtnCls} style={secondaryBtnStyle} onClick={onBack}>Back</button>
        <button className={primaryBtnCls} style={primaryBtnStyle} onClick={handleNext} disabled={isLoading}>{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Next Step <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── Step 3 ─────────────────────────────────────────────────────────────────────

function Step3({ onNext, onBack, dataEntryOption }: { onNext: () => void; onBack: () => void; dataEntryOption: "manual"|"excel"|"api" }) {
  const { data: sites = [], isLoading: sitesLoading, refetch } = useGetOrgSetupStep3SitesQuery();
  const [createSite, { isLoading: creating }] = useCreateOrgSetupSiteMutation();
  const [bulkUpload, { isLoading: uploading }] = useBulkUploadOrgSetupSitesMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadSuccess, setUploadSuccess] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [form, setForm] = useState({ name: "", type: "", address: "", postcode: "", city: "", operationalStatus: "", workingStations: "", capacity: "", primaryProducts: "", hazardClassification: "" });
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!form.name.trim()) { setError("Site name is required"); return; }
    setError("");
    await createSite({ name: form.name, type: form.type, address: form.address, postcode: form.postcode, city: form.city, operationalStatus: form.operationalStatus, workingStations: form.workingStations, capacity: form.capacity, primaryProducts: form.primaryProducts, hazardClassification: form.hazardClassification });
    setForm({ name: "", type: "", address: "", postcode: "", city: "", operationalStatus: "", workingStations: "", capacity: "", primaryProducts: "", hazardClassification: "" });
    refetch();
  };

  const handleBulkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadError(""); setUploadSuccess(null);
    const fd = new FormData(); fd.append("file", file);
    const result = await bulkUpload(fd);
    if ("error" in result) { setUploadError("Upload failed — please check the file format."); }
    else { const d = result.data as { count?: number; error?: string } | undefined; if (d?.error) setUploadError(d.error); else if ((d?.count ?? 0) === 0) setUploadError("No sites were imported. Check the template format."); else setUploadSuccess(d?.count ?? 0); }
    refetch();
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-5">
      {(dataEntryOption === "excel" || dataEntryOption === "api") && (
        <div className={cardCls} style={{ ...cardStyle, borderColor: "#4A57B9", borderWidth: 2 }}>
          <div className="flex items-center justify-between mb-3"><h2 className="text-base font-bold" style={{ color: "#111827" }}>Bulk Upload Sites</h2><button className={secondaryBtnCls} style={secondaryBtnStyle} onClick={() => downloadTemplate("/org-setup/step3/template", "sites_template.csv")}><Download className="w-4 h-4" /> Template</button></div>
          {uploadSuccess !== null && <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: "#D1FAE5", color: "#059669" }}>✓ {uploadSuccess} site{uploadSuccess !== 1 ? "s" : ""} imported</div>}
          {uploadError && <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: "#EF4444" }}>{uploadError}</div>}
          <label className="flex flex-col items-center justify-center w-full py-8 rounded-xl border-2 border-dashed cursor-pointer mb-3" style={{ borderColor: "#C7D2FE", background: uploading ? "#F5F7FF" : "#F8FAFF" }}>
            {uploading ? <Loader2 className="w-8 h-8 mb-2 animate-spin" style={{ color: "#4A57B9" }} /> : <Upload className="w-8 h-8 mb-2" style={{ color: "#4A57B9" }} />}
            <span className="text-sm font-semibold" style={{ color: "#4A57B9" }}>{uploading ? "Uploading…" : "Click to upload"}</span>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBulkFile} />
          </label>
        </div>
      )}

      <div className={cardCls} style={cardStyle}>
        <h2 className="text-base font-bold mb-4" style={{ color: "#111827" }}>Add a Site Manually</h2>
        {error && <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: "#EF4444" }}>{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div><label className={labelCls} style={labelStyle}>Site Name *</label><input className={inputCls} style={inputStyle} placeholder="e.g. Bridgend Manufacturing" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div><label className={labelCls} style={labelStyle}>Type</label><select className={inputCls} style={inputStyle} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}><option value="">Select type</option>{SITE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="md:col-span-2"><label className={labelCls} style={labelStyle}>Address</label><input className={inputCls} style={inputStyle} placeholder="Street address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
          <div><label className={labelCls} style={labelStyle}>Postcode</label><input className={inputCls} style={inputStyle} placeholder="e.g. CF31 3TR" value={form.postcode} onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))} /></div>
          <div><label className={labelCls} style={labelStyle}>City</label><input className={inputCls} style={inputStyle} placeholder="e.g. Bridgend" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></div>
          <div><label className={labelCls} style={labelStyle}>Operational Status</label><select className={inputCls} style={inputStyle} value={form.operationalStatus} onChange={(e) => setForm((f) => ({ ...f, operationalStatus: e.target.value }))}><option value="">Select status</option>{OPERATIONAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className={labelCls} style={labelStyle}>Hazard Classification</label><select className={inputCls} style={inputStyle} value={form.hazardClassification} onChange={(e) => setForm((f) => ({ ...f, hazardClassification: e.target.value }))}><option value="">Select</option>{HAZARD_CLASSIFICATIONS.map((h) => <option key={h} value={h}>{h}</option>)}</select></div>
        </div>
        <button className={primaryBtnCls} style={primaryBtnStyle} onClick={handleAdd} disabled={creating}>{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Add Site</button>
      </div>

      <div className={cardCls} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: "#E3E9F6" }}><h2 className="text-base font-bold" style={{ color: "#111827" }}>Sites ({sites.length})</h2></div>
        {sitesLoading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#4A57B9" }} /></div>
          : sites.length === 0 ? <div className="text-center py-10 text-sm" style={{ color: "#9CA3AF" }}>No sites added yet</div>
          : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr style={{ background: "#F9FAFB" }}><th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Name</th><th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Type</th><th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>City</th><th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Status</th></tr></thead><tbody>{sites.map((site) => (<tr key={site.id} className="border-t hover:bg-gray-50" style={{ borderColor: "#F3F4F6" }}><td className="px-4 py-3 font-medium" style={{ color: "#111827" }}>{site.name}</td><td className="px-4 py-3"><span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: "#EEF2FF", color: "#4A57B9" }}>{site.type || "—"}</span></td><td className="px-4 py-3" style={{ color: "#6B7280" }}>{site.city || "—"}</td><td className="px-4 py-3" style={{ color: "#6B7280" }}>{site.operationalStatus || "—"}</td></tr>))}</tbody></table></div>}
      </div>

      {sites.length === 0 && !sitesLoading && <div className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: "#FEF2F2", color: "#EF4444" }}>Add at least one site before proceeding.</div>}
      <div className="flex justify-between">
        <button className={secondaryBtnCls} style={secondaryBtnStyle} onClick={onBack}>Back</button>
        <button className={primaryBtnCls} style={primaryBtnStyle} onClick={onNext} disabled={sites.length === 0}>Next Step <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── Step 4 ─────────────────────────────────────────────────────────────────────

function Step4({ onNext, onBack, dataEntryOption }: { onNext: () => void; onBack: () => void; dataEntryOption: "manual"|"excel"|"api" }) {
  const { data: fetchedUsers = [], isLoading: usersLoading, refetch } = useGetOrgSetupStep4UsersQuery();
  const [createUser, { isLoading: creating }] = useCreateOrgSetupUserMutation();
  const [bulkUpload, { isLoading: uploading }] = useBulkUploadOrgSetupUsersMutation();
  const [hrmsImport, { isLoading: hrmsLoading }] = useHrmsImportMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "", department: "" });
  const [recentlyImportedUsers, setRecentlyImportedUsers] = useState<typeof fetchedUsers>([]);
  const users = [
    ...fetchedUsers,
    ...recentlyImportedUsers.filter((imported) => !fetchedUsers.some((user) => user.id === imported.id)),
  ];
  const [error, setError] = useState(""); const [uploadSuccess, setUploadSuccess] = useState<number | null>(null); const [uploadError, setUploadError] = useState("");
  const [showHrmsModal, setShowHrmsModal] = useState(false); const [hrmsUrl, setHrmsUrl] = useState(""); const [hrmsToken, setHrmsToken] = useState(""); const [hrmsError, setHrmsError] = useState("");

  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError("Name and email are required"); return; }
    setError("");
    await createUser({ name: form.name, email: form.email, role: form.role, department: form.department });
    setForm({ name: "", email: "", role: "", department: "" }); refetch();
  };

  const handleBulkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadError(""); setUploadSuccess(null);
    const fd = new FormData(); fd.append("file", file);
    const result = await bulkUpload(fd);
    if ("data" in result) {
      const d = result.data as { count?: number; error?: string; users?: typeof fetchedUsers };
      if (d?.error) { setUploadError(d.error); }
      else if ((d?.count ?? 0) === 0) { setUploadError("No users were imported. Check the file has Name, Email, Role, Department columns and that emails are not already registered."); }
      else { setUploadSuccess(d?.count ?? 0); setRecentlyImportedUsers(d.users ?? []); }
    } else { setUploadError("Upload failed. Check file has Name, Email, Role, Department columns."); }
    refetch(); if (fileRef.current) fileRef.current.value = "";
  };

  const handleHrmsConnect = async () => {
    if (!hrmsUrl.trim()) { setHrmsError("Please enter the HRMS API URL"); return; }
    setHrmsError("");
    const result = await hrmsImport({ url: hrmsUrl.trim(), token: hrmsToken.trim() });
    if ("data" in result && (result.data as { error?: string })?.error) { setHrmsError((result.data as { error: string }).error); return; }
    setShowHrmsModal(false); setHrmsUrl(""); setHrmsToken(""); refetch();
  };

  return (
    <div className="space-y-5">
      {showHrmsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" style={{ border: "1px solid #E3E9F6" }}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-base font-bold" style={{ color: "#111827" }}>Import from HRMS</h3><button onClick={() => setShowHrmsModal(false)}><X className="w-5 h-5" style={{ color: "#9CA3AF" }} /></button></div>
            {hrmsError && <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: "#EF4444" }}>{hrmsError}</div>}
            <label className={labelCls} style={labelStyle}>HRMS API Endpoint URL *</label>
            <input className={`${inputCls} mb-3`} style={inputStyle} placeholder="https://hrms.company.com/api/employees" value={hrmsUrl} onChange={(e) => setHrmsUrl(e.target.value)} />
            <label className={labelCls} style={labelStyle}>API Token (optional)</label>
            <input className={`${inputCls} mb-4`} style={inputStyle} placeholder="Bearer token or API key" value={hrmsToken} onChange={(e) => setHrmsToken(e.target.value)} />
            <div className="flex gap-3">
              <button className={primaryBtnCls} style={primaryBtnStyle} onClick={handleHrmsConnect} disabled={hrmsLoading}>{hrmsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Connect & Import</button>
              <button className={secondaryBtnCls} style={secondaryBtnStyle} onClick={() => setShowHrmsModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {(dataEntryOption === "excel" || dataEntryOption === "api") && (
        <div className={cardCls} style={{ ...cardStyle, borderColor: "#4A57B9", borderWidth: 2 }}>
          <div className="flex items-center justify-between mb-3"><h2 className="text-base font-bold" style={{ color: "#111827" }}>Bulk Upload Users</h2><button className={secondaryBtnCls} style={secondaryBtnStyle} onClick={() => downloadTemplate("/org-setup/step4/template", "users_template.csv")}><Download className="w-4 h-4" /> Template</button></div>
          {uploadSuccess !== null && <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: "#D1FAE5", color: "#059669" }}>✓ {uploadSuccess} user{uploadSuccess !== 1 ? "s" : ""} imported</div>}
          {uploadError && <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: "#EF4444" }}>{uploadError}</div>}
          <label className="flex flex-col items-center justify-center w-full py-8 rounded-xl border-2 border-dashed cursor-pointer mb-3" style={{ borderColor: "#C7D2FE", background: uploading ? "#F5F7FF" : "#F8FAFF" }}>
            {uploading ? <Loader2 className="w-8 h-8 mb-2 animate-spin" style={{ color: "#4A57B9" }} /> : <Upload className="w-8 h-8 mb-2" style={{ color: "#4A57B9" }} />}
            <span className="text-sm font-semibold" style={{ color: "#4A57B9" }}>{uploading ? "Uploading…" : "Click to upload"}</span>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBulkFile} />
          </label>
          <button className={secondaryBtnCls} style={secondaryBtnStyle} onClick={() => setShowHrmsModal(true)}><Users className="w-4 h-4" /> Import from HRMS</button>
        </div>
      )}

      <div className={cardCls} style={cardStyle}>
        <h2 className="text-base font-bold mb-4" style={{ color: "#111827" }}>Add User Manually</h2>
        {error && <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: "#EF4444" }}>{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div><label className={labelCls} style={labelStyle}>Full Name *</label><input className={inputCls} style={inputStyle} placeholder="Full name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div><label className={labelCls} style={labelStyle}>Email *</label><input type="email" className={inputCls} style={inputStyle} placeholder="user@company.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div><label className={labelCls} style={labelStyle}>Role</label><select className={inputCls} style={inputStyle} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}><option value="">Select role</option>{USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
          <div><label className={labelCls} style={labelStyle}>Department</label><input className={inputCls} style={inputStyle} placeholder="Department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} /></div>
        </div>
        <button className={primaryBtnCls} style={primaryBtnStyle} onClick={handleAdd} disabled={creating}>{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Add User</button>
      </div>

      <div className={cardCls} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: "#E3E9F6" }}><h2 className="text-base font-bold" style={{ color: "#111827" }}>Users ({users.length})</h2></div>
        {usersLoading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#4A57B9" }} /></div>
          : users.length === 0 ? <div className="text-center py-10 text-sm" style={{ color: "#9CA3AF" }}>No users added yet</div>
          : <table className="w-full text-sm"><thead><tr style={{ background: "#F9FAFB" }}><th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Name</th><th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Email</th><th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Role</th><th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Department</th></tr></thead><tbody>{users.map((user) => (<tr key={user.id} className="border-t hover:bg-gray-50" style={{ borderColor: "#F3F4F6" }}><td className="px-5 py-3 font-medium" style={{ color: "#111827" }}>{user.name}</td><td className="px-5 py-3" style={{ color: "#6B7280" }}>{user.email}</td><td className="px-5 py-3"><span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: "#EEF2FF", color: "#4A57B9" }}>{user.role}</span></td><td className="px-5 py-3" style={{ color: "#6B7280" }}>{user.department}</td></tr>))}</tbody></table>}
      </div>

      {users.length === 0 && !usersLoading && <div className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: "#FEF2F2", color: "#EF4444" }}>Add at least one user before proceeding.</div>}
      <div className="flex justify-between">
        <button className={secondaryBtnCls} style={secondaryBtnStyle} onClick={onBack}>Back</button>
        <button className={primaryBtnCls} style={primaryBtnStyle} onClick={onNext} disabled={users.length === 0}>Next Step <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── Step 5 ─────────────────────────────────────────────────────────────────────

type WorkflowState = Record<string, { enabled: boolean; config: string; expanded: boolean }>;

function Step5({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [saveStep5, { isLoading }] = useSaveOrgSetupStep5Mutation();
  const { data: saved5 } = useGetOrgSetupStep5Query();
  const initialWorkflows: WorkflowState = {};
  WORKFLOW_CARDS.forEach(({ key }) => { initialWorkflows[key] = { enabled: true, config: "", expanded: false }; });
  const [workflows, setWorkflows] = useState<WorkflowState>(initialWorkflows);

  useEffect(() => {
    if (saved5 && Object.keys(saved5).length > 0) {
      const s = saved5 as Record<string, unknown>;
      if (Array.isArray(s.workflows)) {
        const saved = s.workflows as { name: string; enabled: boolean; config: string }[];
        setWorkflows((prev) => { const next = { ...prev }; saved.forEach(({ name, enabled, config }) => { const card = WORKFLOW_CARDS.find((c) => c.label === name); if (card) next[card.key] = { enabled, config, expanded: false }; }); return next; });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved5]);

  const toggle = (key: string, field: "enabled"|"expanded") => setWorkflows((prev) => ({ ...prev, [key]: { ...prev[key], [field]: !prev[key][field] } }));
  const setConfig = (key: string, v: string) => setWorkflows((prev) => ({ ...prev, [key]: { ...prev[key], config: v } }));

  const handleNext = async () => {
    await saveStep5({ workflows: WORKFLOW_CARDS.map(({ key, label }) => ({ name: label, enabled: workflows[key].enabled, config: workflows[key].config })) });
    onNext();
  };

  return (
    <div className="space-y-5">
      <div className={cardCls} style={cardStyle}>
        <h2 className="text-base font-bold mb-4" style={{ color: "#111827" }}>Workflow Configuration</h2>
        <div className="space-y-3">
          {WORKFLOW_CARDS.map(({ key, label }) => (
            <div key={key} className="rounded-xl border" style={{ borderColor: "#E3E9F6" }}>
              <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => toggle(key, "expanded")}>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggle(key, "enabled"); }} className="rounded-full flex items-center p-0.5 transition-colors" style={{ width: "2.5rem", height: "1.5rem", background: workflows[key].enabled ? "linear-gradient(135deg, #4A57B9, #6F80E8)" : "#E5E7EB" }}>
                    <span className="block w-4 h-4 rounded-full bg-white shadow transition-transform" style={{ transform: workflows[key].enabled ? "translateX(1rem)" : "translateX(0)" }} />
                  </button>
                  <span className="text-sm font-semibold" style={{ color: "#111827" }}>{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={workflows[key].enabled ? { background: "#D1FAE5", color: "#059669" } : { background: "#F3F4F6", color: "#9CA3AF" }}>{workflows[key].enabled ? "Enabled" : "Disabled"}</span>
                  {workflows[key].expanded ? <ChevronDown className="w-4 h-4" style={{ color: "#9CA3AF" }} /> : <ChevronRight className="w-4 h-4" style={{ color: "#9CA3AF" }} />}
                </div>
              </div>
              {workflows[key].expanded && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: "#F3F4F6" }}>
                  <label className={`${labelCls} mt-3`} style={labelStyle}>Configuration / Description</label>
                  <textarea className={inputCls} style={inputStyle} rows={3} placeholder={`Enter ${label} configuration…`} value={workflows[key].config} onChange={(e) => setConfig(key, e.target.value)} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between">
        <button className={secondaryBtnCls} style={secondaryBtnStyle} onClick={onBack}>Back</button>
        <button className={primaryBtnCls} style={primaryBtnStyle} onClick={handleNext} disabled={isLoading}>{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Next Step <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── Step 6 ─────────────────────────────────────────────────────────────────────

function Step6({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [tab, setTab] = useState<"knowledge"|"import">("knowledge");
  const { data: documents = [], isLoading: docsLoading, refetch: refetchDocs } = useGetOrgSetupStep6DocumentsQuery();
  const { data: imports = [], isLoading: importsLoading, refetch: refetchImports } = useGetOrgSetupStep6aImportsQuery();
  const [uploadKnowledge, { isLoading: uploading }] = useUploadOrgSetupKnowledgeMutation();
  const [importData, { isLoading: importingLegacy }] = useImportOrgSetupDataMutation();
  const [bulkImportModule, { isLoading: importingBulk }] = useBulkImportModuleMutation();
  const importing = importingLegacy || importingBulk;
  const docFileRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [docForm, setDocForm] = useState({ name: "", type: "" });
  const [docUploadStatus, setDocUploadStatus] = useState<"idle"|"success"|"error">("idle");
  const [docUploadMsg, setDocUploadMsg] = useState("");
  const [selectedDataType, setSelectedDataType] = useState("");
  const [importMethod, setImportMethod] = useState<"manual"|"bulk"|"api">("bulk");
  const [apiUrl, setApiUrl] = useState("");
  const [manualFormData, setManualFormData] = useState<Record<string, string>>({});
  const [bulkResult, setBulkResult] = useState<{ count: number; errors?: string[] } | null>(null);
  const [localDocs, setLocalDocs] = useState<{ id: string; name: string; type: string; uploadedAt: string; size: string }[]>([]);
  const allDocs = [...localDocs.filter(ld => !documents.find(d => d.id === ld.id)), ...documents];

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setDocUploadStatus("idle"); setDocUploadMsg("");
    const fd = new FormData(); fd.append("file", file); fd.append("name", docForm.name || file.name); fd.append("doc_type", docForm.type || "Other");
    const result = await uploadKnowledge(fd);
    if ("data" in result && result.data) {
      setLocalDocs(prev => [...prev, result.data as { id: string; name: string; type: string; uploadedAt: string; size: string }]);
      setDocUploadStatus("success");
      setDocUploadMsg(`"${docForm.name || file.name}" uploaded successfully`);
      setDocForm({ name: "", type: "" });
    } else {
      setDocUploadStatus("error");
      setDocUploadMsg("Upload failed. Please try again.");
    }
    void refetchDocs();
    if (docFileRef.current) docFileRef.current.value = "";
  };

  const handleImport = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    setBulkResult(null);
    if (importMethod === "api") { await importData({ dataType: selectedDataType, method: "api", url: apiUrl }); refetchImports(); return; }
    const file = e?.target.files?.[0]; if (!file) return;
    const result = await bulkImportModule({ module: selectedDataType, file });
    if ("data" in result && result.data) setBulkResult(result.data);
    refetchImports(); if (importFileRef.current) importFileRef.current.value = "";
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["knowledge","import"] as const).map((t) => (<button key={t} onClick={() => setTab(t)} className="px-5 py-1.5 rounded-lg text-sm font-semibold transition-all" style={tab === t ? { background: "#fff", color: "#4A57B9", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } : { color: "#6B7280" }}>{t === "knowledge" ? "Knowledge Centre" : "AI Data Import"}</button>))}
      </div>

      {tab === "knowledge" && (
        <>
          <div className={cardCls} style={cardStyle}>
            <h2 className="text-base font-bold mb-4" style={{ color: "#111827" }}>Upload Document</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div><label className={labelCls} style={labelStyle}>Document Name</label><input className={inputCls} style={inputStyle} placeholder="Document name" value={docForm.name} onChange={(e) => setDocForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div><label className={labelCls} style={labelStyle}>Document Type</label><select className={inputCls} style={inputStyle} value={docForm.type} onChange={(e) => setDocForm((f) => ({ ...f, type: e.target.value }))}><option value="">Select type</option>{DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            </div>
            {docUploadStatus === "success" && <div className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "#D1FAE5", color: "#059669" }}>✓ {docUploadMsg}</div>}
            {docUploadStatus === "error" && <div className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "#FEF2F2", color: "#EF4444" }}>{docUploadMsg}</div>}
            <label className="flex flex-col items-center justify-center w-full py-8 rounded-xl border-2 border-dashed cursor-pointer" style={{ borderColor: "#C7D2FE", background: uploading ? "#EEF2FF" : "#F5F7FF" }}>
              {uploading ? <Loader2 className="w-8 h-8 mb-2 animate-spin" style={{ color: "#4A57B9" }} /> : <Upload className="w-8 h-8 mb-2" style={{ color: "#4A57B9" }} />}
              <span className="text-sm font-semibold" style={{ color: "#4A57B9" }}>{uploading ? "Uploading…" : "Click to upload"}</span>
              <span className="text-xs mt-1" style={{ color: "#9CA3AF" }}>PDF, DOCX, XLSX, CSV — Max 50MB</span>
              <input ref={docFileRef} type="file" className="hidden" accept=".pdf,.docx,.doc,.xlsx,.xls,.csv" onChange={handleDocUpload} />
            </label>
          </div>
          <div className={cardCls} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: "#E3E9F6" }}><h2 className="text-base font-bold" style={{ color: "#111827" }}>Documents ({allDocs.length})</h2></div>
            {docsLoading && allDocs.length === 0 ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#4A57B9" }} /></div>
              : allDocs.length === 0 ? <div className="text-center py-10 text-sm" style={{ color: "#9CA3AF" }}>No documents uploaded yet</div>
              : <table className="w-full text-sm"><thead><tr style={{ background: "#F9FAFB" }}><th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Name</th><th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Type</th><th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Uploaded</th></tr></thead><tbody>{allDocs.map((doc) => (<tr key={doc.id} className="border-t" style={{ borderColor: "#F3F4F6" }}><td className="px-5 py-3 font-medium" style={{ color: "#111827" }}>{doc.name}</td><td className="px-5 py-3"><span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: "#EEF2FF", color: "#4A57B9" }}>{doc.type}</span></td><td className="px-5 py-3" style={{ color: "#6B7280" }}>{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : "—"}</td></tr>))}</tbody></table>}
          </div>
        </>
      )}

      {tab === "import" && (
        <>
          <div className={cardCls} style={cardStyle}>
            <h2 className="text-base font-bold mb-4" style={{ color: "#111827" }}>Select Data Type</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {DATA_IMPORT_TYPES.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => setSelectedDataType(key)} className="p-3 rounded-xl border-2 text-center transition-all" style={selectedDataType === key ? { borderColor: "#4A57B9", background: "#EEF2FF" } : { borderColor: "#E3E9F6", background: "#fff" }}>
                  <Icon className="w-5 h-5 mx-auto mb-1.5" style={{ color: selectedDataType === key ? "#4A57B9" : "#9CA3AF" }} />
                  <span className="text-xs font-semibold" style={{ color: selectedDataType === key ? "#4A57B9" : "#374151" }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={cardCls} style={cardStyle}>
            <h2 className="text-base font-bold mb-4" style={{ color: "#111827" }}>Import Method</h2>
            <div className="flex gap-3 mb-5 flex-wrap">
              {(["manual","bulk","api"] as const).map((m) => (<button key={m} type="button" onClick={() => setImportMethod(m)} className="px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all capitalize" style={importMethod === m ? { borderColor: "#4A57B9", background: "#EEF2FF", color: "#4A57B9" } : { borderColor: "#E3E9F6", color: "#6B7280" }}>{m === "manual" ? "Manual Entry" : m === "bulk" ? "Bulk Upload" : "API"}</button>))}
            </div>

            {importMethod === "manual" && (() => {
              const fields = selectedDataType ? (IMPORT_FIELDS[selectedDataType] ?? []) : [];
              if (!selectedDataType) return <div className="p-4 rounded-xl text-sm" style={{ background: "#F9FAFB", color: "#6B7280" }}>Select a data type above to see the entry form.</div>;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fields.map((f) => (
                      <div key={f.key} className={f.type === "textarea" ? "md:col-span-2" : ""}>
                        <label className={labelCls} style={labelStyle}>{f.label}{f.required && <span style={{ color: "#EF4444" }}> *</span>}</label>
                        {f.type === "select" ? <select className={inputCls} style={inputStyle} value={manualFormData[f.key] ?? ""} onChange={(e) => setManualFormData((d) => ({ ...d, [f.key]: e.target.value }))}><option value="">Select…</option>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                          : f.type === "textarea" ? <textarea rows={3} className={inputCls} style={inputStyle} placeholder={f.placeholder} value={manualFormData[f.key] ?? ""} onChange={(e) => setManualFormData((d) => ({ ...d, [f.key]: e.target.value }))} />
                          : <input type={f.type} className={inputCls} style={inputStyle} placeholder={f.placeholder} value={manualFormData[f.key] ?? ""} onChange={(e) => setManualFormData((d) => ({ ...d, [f.key]: e.target.value }))} />}
                      </div>
                    ))}
                  </div>
                  <button className={primaryBtnCls} style={primaryBtnStyle} onClick={async () => { await importData({ dataType: selectedDataType, method: "manual", ...manualFormData }); setManualFormData({}); refetchImports(); }}><Check className="w-4 h-4" />Save Record</button>
                </div>
              );
            })()}

            {importMethod === "bulk" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold cursor-pointer" style={{ borderColor: "#E3E9F6", color: "#4A57B9", opacity: (!selectedDataType || importing) ? 0.6 : 1 }}>
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{importing ? "Importing…" : "Upload File (.xlsx / .csv)"}
                    <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} disabled={!selectedDataType || importing} />
                  </label>
                  <button className={secondaryBtnCls} style={{ ...secondaryBtnStyle, opacity: selectedDataType ? 1 : 0.5 }} disabled={!selectedDataType} onClick={() => selectedDataType && downloadTemplate(`/v1/org-setup/template/${selectedDataType}`, `${selectedDataType}_template.csv`)}><Download className="w-4 h-4" /> Template</button>
                </div>
                {bulkResult && <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium" style={{ background: (bulkResult.errors?.length ?? 0) > 0 ? "#FEF3C7" : "#D1FAE5", color: (bulkResult.errors?.length ?? 0) > 0 ? "#92400E" : "#065F46" }}><Check className="w-4 h-4" />{bulkResult.count} records imported</div>}
              </div>
            )}

            {importMethod === "api" && (
              <div className="space-y-3">
                <div><label className={labelCls} style={labelStyle}>API Endpoint URL</label><input className={inputCls} style={inputStyle} placeholder="https://api.example.com/data" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} /></div>
                <button className={primaryBtnCls} style={primaryBtnStyle} onClick={() => handleImport()} disabled={importing || !selectedDataType}>{importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}Connect & Import</button>
              </div>
            )}
          </div>

          <div className={cardCls} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: "#E3E9F6" }}><h2 className="text-base font-bold" style={{ color: "#111827" }}>Import History ({imports.length})</h2></div>
            {importsLoading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#4A57B9" }} /></div>
              : imports.length === 0 ? <div className="text-center py-10 text-sm" style={{ color: "#9CA3AF" }}>No imports yet</div>
              : <table className="w-full text-sm"><thead><tr style={{ background: "#F9FAFB" }}><th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Data Type</th><th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Method</th><th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Records</th><th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: "#6B7280" }}>Date</th></tr></thead><tbody>{imports.map((imp) => (<tr key={imp.id} className="border-t" style={{ borderColor: "#F3F4F6" }}><td className="px-5 py-3 font-medium capitalize" style={{ color: "#111827" }}>{imp.dataType.replace(/_/g, " ")}</td><td className="px-5 py-3 capitalize" style={{ color: "#6B7280" }}>{imp.method}</td><td className="px-5 py-3" style={{ color: "#6B7280" }}>{imp.records}</td><td className="px-5 py-3" style={{ color: "#6B7280" }}>{new Date(imp.importedAt).toLocaleDateString()}</td></tr>))}</tbody></table>}
          </div>
        </>
      )}

      <div className="flex justify-between">
        <button className={secondaryBtnCls} style={secondaryBtnStyle} onClick={onBack}>Back</button>
        <button className={primaryBtnCls} style={primaryBtnStyle} onClick={onNext}>Next Step <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── Step 7 ─────────────────────────────────────────────────────────────────────

function Step7({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [saveStep7, { isLoading }] = useSaveOrgSetupStep7Mutation();
  const { data: saved7 } = useGetOrgSetupStep7Query();
  const initialState: Record<string, boolean> = {};
  AI_FEATURES.forEach(({ key }) => { initialState[key] = true; });
  const [features, setFeatures] = useState<Record<string, boolean>>(initialState);

  useEffect(() => {
    if (saved7 && Object.keys(saved7).length > 0) {
      const s = saved7 as Record<string, unknown>;
      if (Array.isArray(s.aiFeatures)) {
        const saved = s.aiFeatures as { name: string; enabled: boolean }[];
        setFeatures((prev) => { const next = { ...prev }; saved.forEach(({ name, enabled }) => { const feat = AI_FEATURES.find((f) => f.label === name); if (feat) next[feat.key] = enabled; }); return next; });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved7]);

  const toggle = (key: string) => setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));

  const aiIcons: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = { aiAssistant: Brain, predictiveRiskEngine: BarChart3, complianceAI: Shield, aiRecommendations: Zap, benchmarkingEngine: BarChart3, fatigueAnalysis: Clock, trendAnalysis: BarChart3 };

  const handleNext = async () => {
    await saveStep7({ aiFeatures: AI_FEATURES.map(({ key, label }) => ({ name: label, enabled: features[key] })) });
    onNext();
  };

  return (
    <div className="space-y-5">
      <div className={cardCls} style={cardStyle}>
        <h2 className="text-base font-bold mb-2" style={{ color: "#111827" }}>AI & Intelligence Features</h2>
        <p className="text-sm mb-5" style={{ color: "#6B7280" }}>Enable or disable AI-powered capabilities for your organisation</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AI_FEATURES.map(({ key, label, desc }) => {
            const Icon = aiIcons[key] || Brain;
            const enabled = features[key];
            return (
              <div key={key} className="flex items-start gap-4 p-4 rounded-xl border-2 transition-all" style={enabled ? { borderColor: "#4A57B9", background: "#F5F7FF" } : { borderColor: "#E3E9F6", background: "#fff" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: enabled ? "linear-gradient(135deg, #4A57B9, #6F80E8)" : "#F3F4F6" }}><Icon className="w-5 h-5" style={{ color: enabled ? "#fff" : "#9CA3AF" }} /></div>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold mb-0.5" style={{ color: "#111827" }}>{label}</div><div className="text-xs" style={{ color: "#6B7280" }}>{desc}</div></div>
                <button type="button" onClick={() => toggle(key)} className="flex-shrink-0 rounded-full flex items-center p-0.5 transition-colors" style={{ width: "2.5rem", height: "1.5rem", background: enabled ? "linear-gradient(135deg, #4A57B9, #6F80E8)" : "#E5E7EB" }}>
                  <span className="block w-4 h-4 rounded-full bg-white shadow transition-transform" style={{ transform: enabled ? "translateX(1rem)" : "translateX(0)" }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between">
        <button className={secondaryBtnCls} style={secondaryBtnStyle} onClick={onBack}>Back</button>
        <button className={primaryBtnCls} style={primaryBtnStyle} onClick={handleNext} disabled={isLoading}>{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Next Step <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── Step 8 ─────────────────────────────────────────────────────────────────────

function Step8({ onBack, completedSteps }: { onBack: () => void; completedSteps: number[] }) {
  const navigate = useNavigate();
  const { markOnboardingSetupCompleted } = useAuth();
  const [activateOrg, { isLoading }] = useActivateOrganizationMutation();
  const { data: sites = [] } = useGetOrgSetupStep3SitesQuery();
  const { data: users = [] } = useGetOrgSetupStep4UsersQuery();
  const { data: documents = [] } = useGetOrgSetupStep6DocumentsQuery();
  const { data: imports = [] } = useGetOrgSetupStep6aImportsQuery();
  const [activated, setActivated] = useState(false);

  const handleActivate = async () => {
    await activateOrg({ confirmed: true });
    setActivated(true);
  };

  const checkItems = [
    { label: "Organization Details", done: completedSteps.includes(1) },
    { label: "Compliance Setup", done: completedSteps.includes(2) },
    { label: `Sites & Departments (${sites.length})`, done: completedSteps.includes(3) },
    { label: `Users & Roles (${users.length})`, done: completedSteps.includes(4) },
    { label: "Workflows Configured", done: completedSteps.includes(5) },
    { label: `Knowledge Documents (${documents.length})`, done: completedSteps.includes(6) },
    { label: `Data Imports (${imports.length})`, done: completedSteps.includes(6) },
    { label: "AI Configuration", done: completedSteps.includes(7) },
  ];

  if (activated) {
    return (
      <div className="bg-white rounded-2xl border p-10 text-center" style={{ borderColor: "#E3E9F6" }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "#D1FAE5" }}><CheckCircle2 className="w-10 h-10" style={{ color: "#10B981" }} /></div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "#111827" }}>Organisation Activated Successfully!</h2>
        <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: "#6B7280" }}>Your organisation has been fully configured. All features are now available.</p>
        <button className={`${primaryBtnCls} mx-auto`} style={{ ...primaryBtnStyle, padding: "12px 32px" }} onClick={() => { markOnboardingSetupCompleted(); navigate("/", { replace: true }); }}>Go to Dashboard <ChevronRight className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className={cardCls} style={cardStyle}>
        <h2 className="text-base font-bold mb-5" style={{ color: "#111827" }}>Setup Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {checkItems.map(({ label, done }) => (
            <div key={label} className="flex items-center gap-3 p-4 rounded-xl border" style={done ? { borderColor: "#A7F3D0", background: "#F0FDF4" } : { borderColor: "#FDE68A", background: "#FFFBEB" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={done ? { background: "#10B981" } : { background: "#F59E0B" }}>{done ? <Check className="w-4 h-4 text-white" /> : <AlertTriangle className="w-4 h-4 text-white" />}</div>
              <span className="text-sm font-semibold" style={{ color: "#111827" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={cardCls} style={cardStyle}>
        <h2 className="text-base font-bold mb-2" style={{ color: "#111827" }}>Ready to Activate</h2>
        <p className="text-sm mb-5" style={{ color: "#6B7280" }}>Clicking "Confirm & Activate" will finalise the setup and make all features live.</p>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <button className={secondaryBtnCls} style={secondaryBtnStyle} onClick={onBack}>Back</button>
          <button className={`${primaryBtnCls} px-8 py-3 text-base`} style={{ ...primaryBtnStyle, background: "linear-gradient(135deg, #059669, #10B981)" }} onClick={handleActivate} disabled={isLoading}>{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}Confirm & Activate</button>
        </div>
      </div>
    </div>
  );
}

// ── Step Requirements Sidebar ─────────────────────────────────────────────────

const STEP_REQUIREMENTS: Record<number, { fields: string[]; requiredFields: string[]; validations: string[]; color: string; bg: string }> = {
  1: { fields: ["Organisation Name","Country","Industry Sector","Number of Employees","Headquarters Location","Parent Company","ISO 45001 Status","Regulatory Authority","Establishment Date"], requiredFields: ["Organisation Name","Country","Industry Sector"], validations: ["Organisation Name must be unique","Number of Employees must be positive","Establishment Date must be in the past"], color: "#4A57B9", bg: "#EEF2FF" },
  2: { fields: ["Applicable Standards","Regulatory Region","Audit Frequency","CAPA SLA Critical Days","CAPA SLA Standard Days","Permit Types","Incident Severity Matrix"], requiredFields: ["Applicable Standards"], validations: ["At least one safety standard must be selected","CAPA SLA days must be positive integers","Critical days should be less than Standard days"], color: "#059669", bg: "#D1FAE5" },
  3: { fields: ["Site Name","Type","Address","Postcode","City","Operational Status","Working Stations","Capacity","Primary Products","Hazard Classification"], requiredFields: ["Site Name"], validations: ["Site Name must be unique within the organisation","At least one site must be added to proceed","Bulk upload requires Site Name column"], color: "#D97706", bg: "#FEF3C7" },
  4: { fields: ["Full Name","Email Address","Role","Department"], requiredFields: ["Full Name","Email Address"], validations: ["Email must be valid format","Email must be unique","At least one user must be added to proceed"], color: "#7C3AED", bg: "#F5F3FF" },
  5: { fields: ["Workflow Name","Enabled / Disabled","Configuration"], requiredFields: [], validations: ["All workflows enabled by default","Configuration field accepts JSON or plain text","Workflows can be reconfigured after setup"], color: "#0891B2", bg: "#ECFEFF" },
  6: { fields: ["Document Name","Document Type","File Upload","Data Type","Import Method"], requiredFields: ["Document Name","File Upload"], validations: ["Accepted: PDF, DOCX, XLSX, CSV","Max file size: 50 MB","Data type must be selected before bulk upload"], color: "#DC2626", bg: "#FEF2F2" },
  7: { fields: ["AI Assistant","Predictive Risk Engine","Compliance AI","AI Recommendations","Benchmarking","Fatigue Analysis","Trend Analysis"], requiredFields: [], validations: ["AI features can be toggled at any time","Enabled features consume API quota from your plan"], color: "#4A57B9", bg: "#EEF2FF" },
  8: { fields: ["Organisation Details","Compliance Setup","Sites & Departments","Users & Roles","Workflows","Knowledge Documents","AI Configuration"], requiredFields: [], validations: ["All steps should be completed before activation","Users receive email invitations on activation","You can return to any step using the progress bar"], color: "#059669", bg: "#D1FAE5" },
};

function StepRequirementsSidebar({ step }: { step: number }) {
  const cfg = STEP_REQUIREMENTS[step];
  if (!cfg) return null;
  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-5" style={{ background: "#fff", borderColor: "#E3E9F6" }}>
      <div>
        <div className="flex items-center gap-2 mb-3"><FileText className="w-4 h-4" style={{ color: cfg.color }} /><span className="text-sm font-bold" style={{ color: "#111827" }}>Required Fields</span><span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>{cfg.fields.length} fields</span></div>
        <div className="space-y-1.5">
          {cfg.fields.map((field) => {
            const required = cfg.requiredFields.includes(field);
            return (
              <div key={field} className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: required ? `${cfg.color}10` : "#F9FAFB", border: `1px solid ${required ? cfg.color + "30" : "#E3E9F6"}` }}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: required ? cfg.color : "#D1D5DB" }} />
                <span className="text-[11px] font-medium flex-1" style={{ color: "#374151" }}>{field}</span>
                {required && <span className="text-[9px] font-bold uppercase" style={{ color: cfg.color }}>Required</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-3"><Shield className="w-4 h-4" style={{ color: "#4A57B9" }} /><span className="text-sm font-bold" style={{ color: "#111827" }}>Validation Rules</span></div>
        <div className="space-y-1.5">
          {cfg.validations.map((rule) => (
            <div key={rule} className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#10B981" }} /><span className="text-[11px]" style={{ color: "#6B7280" }}>{rule}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

export function OrgSetupWizardPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [wizardReady, setWizardReady] = useState(false);
  const [dataEntryOption, setDataEntryOption] = useState<"manual"|"excel"|"api">("manual");

  const { data: progressRaw, isLoading: progressLoading, refetch: refetchProgress } = useGetOrgSetupProgressQuery();
  const { data: step1Saved } = useGetOrgSetupStep1Query();

  // Reset backend wizard state on first visit per browser session so a new org
  // admin always starts from step 1 (not from a previous user's in-memory state).
  useEffect(() => {
    const sessionKey = "org_setup_wizard_session_reset";
    if (!sessionStorage.getItem(sessionKey)) {
      resetOrgSetupWizard().finally(() => {
        sessionStorage.setItem(sessionKey, "1");
        setWizardReady(true);
        refetchProgress();
      });
    } else {
      setWizardReady(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!wizardReady || progressLoading || progressLoaded) return;
    const raw = progressRaw as unknown as { steps_completed?: number[]; activated?: boolean } | undefined;
    const done: number[] = raw?.steps_completed ?? [];
    setCompletedSteps(done);
    if (done.length > 0) setCurrentStep(Math.min(Math.max(...done) + 1, 8));
    setProgressLoaded(true);
  }, [progressRaw, progressLoading, progressLoaded, wizardReady]);

  useEffect(() => {
    if (step1Saved) {
      const s = step1Saved as unknown as { dataEntryOption?: string };
      if (s.dataEntryOption && ["manual","excel","api"].includes(s.dataEntryOption)) setDataEntryOption(s.dataEntryOption as "manual"|"excel"|"api");
    }
  }, [step1Saved]);

  const markDone = (step: number) => setCompletedSteps((prev) => prev.includes(step) ? prev : [...prev, step]);
  const goNext = (fromStep: number) => { markDone(fromStep); setCurrentStep(fromStep + 1); };
  const goBack = (fromStep: number) => setCurrentStep(fromStep - 1);

  const stepTitles = ["Organisation Details","Industry & Compliance Setup","Site Structure Setup","Roles & Users Setup","Workflow Configuration","Knowledge Centre & AI Data Import","AI & Intelligence Setup","Review & Activate"];

  return (
    <div className="p-6 space-y-5" style={{ background: "#F6F8FC", minHeight: "100vh" }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4A57B9, #6F80E8)" }}><Building2 className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#111827" }}>Organisation Setup</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>{(wizardReady && progressLoaded) ? `Step ${currentStep} of 8 — ${stepTitles[currentStep - 1]}` : "Preparing your workspace…"}</p>
          </div>
        </div>
        {completedSteps.length > 0 && currentStep > 1 && (
          <button className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors" style={{ borderColor: "#E3E9F6", color: "#6B7280", background: "#fff" }} onClick={() => { resetOrgSetupWizard(); setCurrentStep(1); setCompletedSteps([]); setProgressLoaded(false); }}>↺ Start Over</button>
        )}
      </div>

      <StepIndicator currentStep={currentStep} completedSteps={completedSteps} onStepClick={(step) => setCurrentStep(step)} />

      <div className="grid xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2">
          {(!wizardReady || !progressLoaded) ? (
            <div className="flex justify-center items-center py-24 bg-white rounded-2xl border" style={{ borderColor: "#E3E9F6" }}>
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#4A57B9" }} />
            </div>
          ) : (
            <>
              {currentStep === 1 && <Step1 onNext={() => goNext(1)} dataEntryOption={dataEntryOption} onDataEntryChange={setDataEntryOption} />}
              {currentStep === 2 && <Step2 onNext={() => goNext(2)} onBack={() => goBack(2)} />}
              {currentStep === 3 && <Step3 onNext={() => goNext(3)} onBack={() => goBack(3)} dataEntryOption={dataEntryOption} />}
              {currentStep === 4 && <Step4 onNext={() => goNext(4)} onBack={() => goBack(4)} dataEntryOption={dataEntryOption} />}
              {currentStep === 5 && <Step5 onNext={() => goNext(5)} onBack={() => goBack(5)} />}
              {currentStep === 6 && <Step6 onNext={() => goNext(6)} onBack={() => goBack(6)} />}
              {currentStep === 7 && <Step7 onNext={() => goNext(7)} onBack={() => goBack(7)} />}
              {currentStep === 8 && <Step8 onBack={() => goBack(8)} completedSteps={completedSteps} />}
            </>
          )}
        </div>
        <div className="sticky top-6"><StepRequirementsSidebar step={currentStep} /></div>
      </div>
    </div>
  );
}
