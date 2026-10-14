import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router";
import { StatusBadge } from "../components/shared/StatusBadge";
import { Upload, Plus, Trash2, FileText, Loader2, Copy, Check } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import { useAuth } from "../context/AuthContext";
import {
  useListApiIntegrationsQuery,
  useCreateApiIntegrationMutation,
  useDeleteApiIntegrationMutation,
} from "../../features/data-management/api/dataManagementApi";
import { getAuditTrail } from "../../services/compliance.service";
import type { AuditTrail } from "../../types";
import { SettingsFamilyTabBar } from "../components/audits/SettingsFamilyTabBar";

const VALID_SETTINGS_TABS = ["general", "integrations", "api", "webhooks", "branding", "knowledge", "formula", "audit"];

interface ContractorWeights {
  violation_penalty_per_violation: number;
  violation_penalty_cap: number;
  incident_penalty_multiplier: number;
  incident_penalty_cap: number;
}

interface RatingBandConfig {
  high_floor: number;
  high_label: string;
  mid_floor: number;
  mid_label: string;
  low_label: string;
}

interface RatingLabelsConfig {
  workforce_competency: RatingBandConfig;
  compliance_score: RatingBandConfig;
  workforce_exposure_risk: RatingBandConfig;
  asset_maintenance_risk: RatingBandConfig;
}

const RATING_SCALE_META: { key: keyof RatingLabelsConfig; title: string; hint: string }[] = [
  { key: "workforce_competency", title: "Workforce Competency", hint: "People page — share of employees with no open training-related CAPA." },
  { key: "compliance_score", title: "Overall Compliance", hint: "Compliance page — blended PTW / legal-register / audit-readiness score." },
  { key: "workforce_exposure_risk", title: "Workforce Exposure Risk", hint: "People page — recent incident + near-miss rate per employee." },
  { key: "asset_maintenance_risk", title: "Asset Maintenance Risk", hint: "Assets page — share of certifications expired or expiring soon." },
];

interface ApiKeyRecord {
  id: number;
  name: string;
  prefix: string;
  scopes: string;
  created_at: string;
  last_used_at: string | null;
}

interface WebhookRecord {
  id: number;
  url: string;
  event_types: string;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

interface DocRecord {
  id: string;
  file_name: string;
  size: string | null;
  uploaded_by: string;
  created_at: string;
}

interface OrgData {
  id: number;
  organisation_name: string;
  country: string | null;
  industry_sector: string | null;
  number_of_employees: number | null;
  headquarters_location: string | null;
  parent_company: string | null;
  regulatory_authority: string | null;
  iso_45001_status: string | null;
  establishment_date: string | null;
}

export function SettingsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = VALID_SETTINGS_TABS.includes(searchParams.get("tab") ?? "") ? searchParams.get("tab")! : "general";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isUploading, setIsUploading] = useState(false);
  const [docsList, setDocsList] = useState<DocRecord[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // General tab — real org data
  const [orgData, setOrgData] = useState<OrgData | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);

  // Integrations tab — real backend (shared with Data Management page)
  const { data: integrations, isLoading: integrationsLoading, refetch: refetchIntegrations } = useListApiIntegrationsQuery();
  const [createIntegration, { isLoading: connectingIntegration }] = useCreateApiIntegrationMutation();
  const [deleteIntegration] = useDeleteApiIntegrationMutation();
  const [newIntegration, setNewIntegration] = useState({ name: "", type: "custom", endpoint_url: "" });
  const [showAddIntegration, setShowAddIntegration] = useState(false);

  // API Keys tab
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchApiKeys = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/org-admin/settings/api-keys");
      setApiKeys((res.data as { data: ApiKeyRecord[] }).data ?? []);
    } catch (e) { console.error("Failed to load API keys", e); }
    finally { setApiKeysLoading(false); }
  }, []);
  useEffect(() => { fetchApiKeys(); }, [fetchApiKeys]);

  const handleGenerateKey = async () => {
    const name = newKeyName.trim() || `API Key ${apiKeys.length + 1}`;
    setGeneratingKey(true);
    try {
      const res = await axiosInstance.post("/org-admin/settings/api-keys", { name, scopes: "Read" });
      const data = (res.data as { data: ApiKeyRecord & { raw_key: string } }).data;
      setRevealedKey(data.raw_key);
      setNewKeyName("");
      await fetchApiKeys();
    } catch (e) { console.error("Failed to generate API key", e); }
    finally { setGeneratingKey(false); }
  };

  const handleRevokeKey = async (id: number) => {
    await axiosInstance.delete(`/org-admin/settings/api-keys/${id}`);
    setApiKeys(k => k.filter(x => x.id !== id));
  };

  // Webhooks tab
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [addingWebhook, setAddingWebhook] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/org-admin/settings/webhooks");
      setWebhooks((res.data as { data: WebhookRecord[] }).data ?? []);
    } catch (e) { console.error("Failed to load webhooks", e); }
    finally { setWebhooksLoading(false); }
  }, []);
  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const handleAddWebhook = async () => {
    if (!newWebhookUrl.trim()) return;
    setAddingWebhook(true);
    try {
      await axiosInstance.post("/org-admin/settings/webhooks", { url: newWebhookUrl.trim(), event_types: "" });
      setNewWebhookUrl("");
      await fetchWebhooks();
    } catch (e) { console.error("Failed to add webhook", e); }
    finally { setAddingWebhook(false); }
  };

  const handleDeleteWebhook = async (id: number) => {
    await axiosInstance.delete(`/org-admin/settings/webhooks/${id}`);
    setWebhooks(w => w.filter(x => x.id !== id));
  };

  // Branding tab
  const [branding, setBranding] = useState({ primary_color: "#1B5E20", logo_url: null as string | null });
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);

  useEffect(() => {
    axiosInstance.get("/org-admin/settings/branding")
      .then(r => setBranding((r.data as { data: typeof branding }).data))
      .catch(console.error);
  }, []);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBranding(b => ({ ...b, logo_url: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async () => {
    setBrandingSaving(true);
    setBrandingSaved(false);
    try {
      await axiosInstance.put("/org-admin/settings/branding", branding);
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 3000);
    } catch (e) { console.error("Failed to save branding", e); }
    finally { setBrandingSaving(false); }
  };

  useEffect(() => {
    axiosInstance
      .get<OrgData>("/organisations/me")
      .then((r) => setOrgData(r.data))
      .catch(console.error)
      .finally(() => setOrgLoading(false));
  }, []);

  const handleSaveOrg = async () => {
    if (!orgData) return;
    setOrgSaving(true);
    setOrgSaved(false);
    try {
      await axiosInstance.put(`/organisations/${orgData.id}`, {
        organisation_name: orgData.organisation_name,
        country: orgData.country,
        industry_sector: orgData.industry_sector,
        number_of_employees: orgData.number_of_employees,
        headquarters_location: orgData.headquarters_location,
        parent_company: orgData.parent_company,
        regulatory_authority: orgData.regulatory_authority,
        iso_45001_status: orgData.iso_45001_status,
        establishment_date: orgData.establishment_date,
      });
      setOrgSaved(true);
      setTimeout(() => setOrgSaved(false), 3000);
    } catch (e) {
      console.error("Failed to save org settings", e);
    } finally {
      setOrgSaving(false);
    }
  };

  // Audit Trail tab
  const [auditLogs, setAuditLogs] = useState<AuditTrail[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  useEffect(() => {
    getAuditTrail()
      .then(setAuditLogs)
      .catch((e) => console.error("Failed to load audit trail", e))
      .finally(() => setAuditLoading(false));
  }, []);

  // Formula & Rules tab — Contractor Risk Score weights
  const [contractorWeights, setContractorWeights] = useState<ContractorWeights | null>(null);
  const [formulaLoading, setFormulaLoading] = useState(true);
  const [formulaSaving, setFormulaSaving] = useState(false);
  const [formulaSaved, setFormulaSaved] = useState(false);

  const fetchFormulaConfig = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/org-admin/settings/formula-config");
      setContractorWeights((res.data as { data: { contractor_score: ContractorWeights } }).data.contractor_score);
    } catch (e) { console.error("Failed to load formula config", e); }
    finally { setFormulaLoading(false); }
  }, []);
  useEffect(() => { fetchFormulaConfig(); }, [fetchFormulaConfig]);

  const handleSaveFormulaConfig = async () => {
    if (!contractorWeights) return;
    setFormulaSaving(true);
    setFormulaSaved(false);
    try {
      await axiosInstance.put("/org-admin/settings/formula-config", { contractor_score: contractorWeights });
      setFormulaSaved(true);
      setTimeout(() => setFormulaSaved(false), 3000);
    } catch (e) { console.error("Failed to save formula config", e); }
    finally { setFormulaSaving(false); }
  };

  // Formula & Rules tab — Rating label wording (Excellent/Good/... , Low/Medium/High Risk)
  const [ratingLabels, setRatingLabels] = useState<RatingLabelsConfig | null>(null);
  const [ratingLabelsLoading, setRatingLabelsLoading] = useState(true);
  const [ratingLabelsSaving, setRatingLabelsSaving] = useState(false);
  const [ratingLabelsSaved, setRatingLabelsSaved] = useState(false);
  const [ratingLabelsError, setRatingLabelsError] = useState<string | null>(null);

  const fetchRatingLabels = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/org-admin/settings/rating-labels");
      setRatingLabels((res.data as { data: RatingLabelsConfig }).data);
    } catch (e) { console.error("Failed to load rating labels", e); }
    finally { setRatingLabelsLoading(false); }
  }, []);
  useEffect(() => { fetchRatingLabels(); }, [fetchRatingLabels]);

  const updateRatingBand = (scale: keyof RatingLabelsConfig, field: keyof RatingBandConfig, value: string | number) => {
    setRatingLabels(prev => prev ? { ...prev, [scale]: { ...prev[scale], [field]: value } } : prev);
  };

  const handleSaveRatingLabels = async () => {
    if (!ratingLabels) return;
    setRatingLabelsSaving(true);
    setRatingLabelsSaved(false);
    setRatingLabelsError(null);
    try {
      const res = await axiosInstance.put("/org-admin/settings/rating-labels", ratingLabels);
      setRatingLabels((res.data as { data: RatingLabelsConfig }).data);
      setRatingLabelsSaved(true);
      setTimeout(() => setRatingLabelsSaved(false), 3000);
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setRatingLabelsError(msg || "Failed to save rating labels");
    } finally { setRatingLabelsSaving(false); }
  };

  const tabs = [
    { id: "general", label: "General" },
    { id: "integrations", label: "Integrations" },
    { id: "api", label: "API Keys" },
    { id: "webhooks", label: "Webhooks" },
    { id: "branding", label: "Branding" },
    { id: "knowledge", label: "AI Knowledge Base" },
    { id: "formula", label: "Formula & Rules" },
  ];

  const fetchDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await axiosInstance.get("/org-admin/data-management/documents");
      const items = ((res.data as { data: { items: DocRecord[] } }).data?.items ?? []);
      setDocsList(items);
    } catch (e) { console.error("Failed to load documents", e); }
    finally { setDocsLoading(false); }
  }, []);
  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'docs');
      formData.append('record_type', 'Knowledge Base');

      await axiosInstance.post("/org-admin/data-management/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await fetchDocs();
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    await axiosInstance.delete(`/org-admin/data-management/documents/${docId}`);
    setDocsList(d => d.filter(x => x.id !== docId));
  };

  return (
    <div className="space-y-6">
      <SettingsFamilyTabBar />
      <h1>System Settings</h1>

      <div className="flex gap-1 border-b" style={{ borderColor: '#E2E8E2' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-[13px] transition-colors relative"
            style={{ color: activeTab === tab.id ? '#1B5E20' : '#4A5568', fontWeight: activeTab === tab.id ? 600 : 400 }}
          >
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)' }} />}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <div className="max-w-xl space-y-6">
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-1">Organisation Profile</h2>
            <p className="text-[12px] mb-5" style={{ color: '#6B7280' }}>
              Industry standards and profiles set during onboarding — permanently editable here.
            </p>
            {orgLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#1B5E20' }} />
                <span className="text-[13px]" style={{ color: '#9CA3AF' }}>Loading organisation…</span>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block mb-1.5">Organisation Name</label>
                  <input
                    value={orgData?.organisation_name ?? ""}
                    onChange={e => setOrgData(d => d ? { ...d, organisation_name: e.target.value } : d)}
                    className="w-full h-10 px-4 rounded-lg border text-[13px]"
                    style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                  />
                </div>
                <div>
                  <label className="block mb-1.5">Country</label>
                  <input
                    value={orgData?.country ?? ""}
                    onChange={e => setOrgData(d => d ? { ...d, country: e.target.value } : d)}
                    className="w-full h-10 px-4 rounded-lg border text-[13px]"
                    style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                    placeholder="e.g. United Kingdom"
                  />
                </div>
                <div>
                  <label className="block mb-1.5">Industry Sector</label>
                  <input
                    value={orgData?.industry_sector ?? ""}
                    onChange={e => setOrgData(d => d ? { ...d, industry_sector: e.target.value } : d)}
                    className="w-full h-10 px-4 rounded-lg border text-[13px]"
                    style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                    placeholder="e.g. Power & Utilities"
                  />
                </div>
                <div>
                  <label className="block mb-1.5">Headquarters Location</label>
                  <input
                    value={orgData?.headquarters_location ?? ""}
                    onChange={e => setOrgData(d => d ? { ...d, headquarters_location: e.target.value } : d)}
                    className="w-full h-10 px-4 rounded-lg border text-[13px]"
                    style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                    placeholder="e.g. Sheffield, England"
                  />
                </div>
                <div>
                  <label className="block mb-1.5">Number of Employees</label>
                  <input
                    type="number"
                    value={orgData?.number_of_employees ?? ""}
                    onChange={e => setOrgData(d => d ? { ...d, number_of_employees: Number(e.target.value) || null } : d)}
                    className="w-full h-10 px-4 rounded-lg border text-[13px]"
                    style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                  />
                </div>
                <div>
                  <label className="block mb-1.5">Regulatory Authority</label>
                  <input
                    value={orgData?.regulatory_authority ?? ""}
                    onChange={e => setOrgData(d => d ? { ...d, regulatory_authority: e.target.value } : d)}
                    className="w-full h-10 px-4 rounded-lg border text-[13px]"
                    style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                    placeholder="e.g. Health and Safety Executive (HSE)"
                  />
                </div>
                <div>
                  <label className="block mb-1.5">Parent Company</label>
                  <input
                    value={orgData?.parent_company ?? ""}
                    onChange={e => setOrgData(d => d ? { ...d, parent_company: e.target.value } : d)}
                    className="w-full h-10 px-4 rounded-lg border text-[13px]"
                    style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                    placeholder="e.g. Global Holdings PLC (leave blank if independent)"
                  />
                </div>
                <div>
                  <label className="block mb-1.5">Establishment Date</label>
                  <input
                    type="date"
                    value={orgData?.establishment_date ?? ""}
                    onChange={e => setOrgData(d => d ? { ...d, establishment_date: e.target.value } : d)}
                    className="w-full h-10 px-4 rounded-lg border text-[13px]"
                    style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                  />
                </div>
                <div>
                  <label className="block mb-1.5">ISO 45001 Status</label>
                  <select
                    value={orgData?.iso_45001_status ?? ""}
                    onChange={e => setOrgData(d => d ? { ...d, iso_45001_status: e.target.value } : d)}
                    className="w-full h-10 px-3 rounded-lg border text-[13px] bg-white"
                    style={{ borderColor: '#E2E8E2' }}
                  >
                    <option value="">Select status</option>
                    {["Certified", "In Progress", "Planned", "Not Started", "Expired"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveOrg}
                    disabled={orgSaving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-[13px] disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 600 }}
                  >
                    {orgSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {orgSaving ? "Saving…" : "Save Changes"}
                  </button>
                  {orgSaved && (
                    <span className="text-[13px]" style={{ color: '#2E7D32', fontWeight: 500 }}>
                      ✓ Saved successfully
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "integrations" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddIntegration(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px]"
              style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 600 }}
            >
              <Plus className="w-4 h-4" /> Add Integration
            </button>
          </div>
          {showAddIntegration && (
            <div className="bg-white rounded-xl border p-5 space-y-3" style={{ borderColor: '#E8EFE8' }}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  value={newIntegration.name}
                  onChange={e => setNewIntegration(v => ({ ...v, name: e.target.value }))}
                  placeholder="Integration name (e.g. Jira)"
                  className="h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: '#E2E8E2' }}
                />
                <input
                  value={newIntegration.endpoint_url}
                  onChange={e => setNewIntegration(v => ({ ...v, endpoint_url: e.target.value }))}
                  placeholder="Endpoint URL"
                  className="h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: '#E2E8E2' }}
                />
                <button
                  onClick={async () => {
                    if (!newIntegration.name.trim()) return;
                    await createIntegration(newIntegration);
                    setNewIntegration({ name: "", type: "custom", endpoint_url: "" });
                    setShowAddIntegration(false);
                    refetchIntegrations();
                  }}
                  disabled={connectingIntegration || !newIntegration.name.trim()}
                  className="h-10 px-4 rounded-lg text-white text-[13px] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 600 }}
                >
                  {connectingIntegration ? "Connecting…" : "Connect"}
                </button>
              </div>
            </div>
          )}
          {integrationsLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#1B5E20' }} />
              <span className="text-[13px]" style={{ color: '#9CA3AF' }}>Loading integrations…</span>
            </div>
          ) : integrations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ background: '#F4F7F4', borderRadius: 12 }}>
              <p className="text-[15px] mb-1" style={{ color: '#0A0A0A', fontWeight: 500 }}>No integrations connected</p>
              <p className="text-[13px]" style={{ color: '#9CA3AF' }}>Add one above to push data into HSE Platform via REST API</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {integrations.map(int => (
                <div key={int.id} className="bg-white rounded-xl border p-5" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[14px]" style={{ background: '#F4F7F4', color: '#1B5E20', fontWeight: 700 }}>
                      {int.name[0]}
                    </div>
                    <StatusBadge status={int.is_active ? "Connected" : "Disconnected"} size="sm" />
                  </div>
                  <div className="text-[14px] mb-1" style={{ color: '#0A0A0A', fontWeight: 600 }}>{int.name}</div>
                  <div className="text-[12px] mb-4" style={{ color: '#9CA3AF' }}>{int.description || int.endpoint_url || int.type}</div>
                  <button
                    onClick={async () => { await deleteIntegration(int.id); refetchIntegrations(); }}
                    className="w-full py-2 rounded-lg text-[12px] transition-colors"
                    style={{ border: '1px solid #DC2626', color: '#DC2626', fontWeight: 500 }}
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "api" && (
        <div className="space-y-4">
          {revealedKey && (
            <div className="rounded-xl p-4 border" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
              <div className="text-[13px] font-bold mb-2" style={{ color: '#92400E' }}>
                Copy this key now — it won't be shown again
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg text-[12px] font-mono break-all" style={{ background: '#fff', border: '1px solid #FDE68A', color: '#111827' }}>
                  {revealedKey}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(revealedKey); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }}
                  className="p-2 rounded-lg border flex-shrink-0" style={{ borderColor: '#FDE68A' }}
                >
                  {copiedKey ? <Check className="w-4 h-4" style={{ color: '#059669' }} /> : <Copy className="w-4 h-4" style={{ color: '#92400E' }} />}
                </button>
                <button onClick={() => setRevealedKey(null)} className="text-[12px] px-3 py-2" style={{ color: '#92400E' }}>Dismiss</button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key name (optional)"
              className="h-10 px-3 rounded-lg border text-[13px]" style={{ borderColor: '#E2E8E2' }}
            />
            <button
              onClick={handleGenerateKey}
              disabled={generatingKey}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 600 }}
            >
              {generatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Generate New Key
            </button>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
              <thead>
                <tr style={{ background: '#F4F7F4' }}>
                  {["Key Name", "Prefix", "Created", "Last Used", "Scopes", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left">
                      <span className="text-[11px] uppercase tracking-[0.5px]" style={{ color: '#9CA3AF', fontWeight: 600 }}>{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apiKeysLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px]" style={{ color: '#9CA3AF' }}>Loading…</td></tr>
                ) : apiKeys.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px]" style={{ color: '#9CA3AF' }}>No API keys yet</td></tr>
                ) : apiKeys.map(k => (
                  <tr key={k.id} style={{ borderBottom: '1px solid #EEF2EE' }}>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{k.name}</td>
                    <td className="px-4 py-3 text-[13px] font-mono" style={{ color: '#4A5568' }}>{k.prefix}</td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#9CA3AF' }}>{new Date(k.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#9CA3AF' }}>{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}</td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#4A5568' }}>{k.scopes}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRevokeKey(k.id)}
                        className="px-3 py-1 rounded text-[12px] border transition-colors hover:bg-red-50" style={{ borderColor: '#FEE2E2', color: '#DC2626', fontWeight: 500 }}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "webhooks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <input
              value={newWebhookUrl}
              onChange={e => setNewWebhookUrl(e.target.value)}
              placeholder="https://hooks.yoursystem.com/hse"
              className="h-10 px-3 rounded-lg border text-[13px] w-72" style={{ borderColor: '#E2E8E2' }}
            />
            <button
              onClick={handleAddWebhook}
              disabled={addingWebhook || !newWebhookUrl.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 600 }}
            >
              {addingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Webhook
            </button>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F4F7F4' }}>
                  {["URL", "Events", "Status", "Last Triggered", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left">
                      <span className="text-[11px] uppercase tracking-[0.5px]" style={{ color: '#9CA3AF', fontWeight: 600 }}>{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {webhooksLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px]" style={{ color: '#9CA3AF' }}>Loading…</td></tr>
                ) : webhooks.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px]" style={{ color: '#9CA3AF' }}>No webhooks configured</td></tr>
                ) : webhooks.map(w => (
                  <tr key={w.id} className="group" style={{ borderBottom: '1px solid #EEF2EE' }}>
                    <td className="px-4 py-3 text-[13px] font-mono" style={{ color: '#0A0A0A' }}>{w.url}</td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#4A5568' }}>{w.event_types || "All events"}</td>
                    <td className="px-4 py-3"><StatusBadge status={w.is_active ? "Active" : "Inactive"} size="sm" /></td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#9CA3AF' }}>{w.last_triggered_at ? new Date(w.last_triggered_at).toLocaleString() : "Never"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteWebhook(w.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "branding" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-6">Brand Customization</h2>
            <div className="space-y-5">
              <div>
                <label className="block mb-1.5">Logo</label>
                <label
                  className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-[#F4F7F4]" style={{ borderColor: '#E2E8E2' }}
                >
                  {branding.logo_url ? (
                    <img src={branding.logo_url} alt="Logo preview" className="h-16 object-contain mb-2" />
                  ) : (
                    <Upload className="w-6 h-6 mb-2" style={{ color: '#9CA3AF' }} />
                  )}
                  <span className="text-[12px]" style={{ color: '#4A5568' }}>{branding.logo_url ? "Change logo" : "Upload logo"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                </label>
              </div>
              <div>
                <label className="block mb-1.5">Primary Color</label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0" style={{ background: branding.primary_color }} />
                  <input
                    value={branding.primary_color}
                    onChange={e => setBranding(b => ({ ...b, primary_color: e.target.value }))}
                    className="flex-1 h-10 px-4 rounded-lg border text-[13px] font-mono"
                    style={{ borderColor: '#E2E8E2' }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveBranding}
                  disabled={brandingSaving}
                  className="px-6 py-2.5 rounded-lg text-white text-[13px] disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 600 }}
                >
                  {brandingSaving ? "Saving…" : "Save Branding"}
                </button>
                {brandingSaved && <span className="text-[13px]" style={{ color: '#2E7D32', fontWeight: 500 }}>✓ Saved successfully</span>}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-6">Preview</h2>
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#E2E8E2' }}>
              {/* Mini sidebar preview */}
              <div className="flex h-48">
                <div className="w-16" style={{ background: '#0D1F0D' }}>
                  <div className="p-2 space-y-2 mt-3">
                    {branding.logo_url && <img src={branding.logo_url} alt="" className="h-6 mb-2 mx-auto object-contain" />}
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-2 rounded-full" style={{ background: i === 1 ? branding.primary_color : '#1E2E1E' }} />
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="h-8 border-b flex items-center px-3" style={{ borderColor: '#E2E8E2' }}>
                    <div className="w-16 h-2 rounded-full" style={{ background: '#E2E8E2' }} />
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="h-3 w-24 rounded" style={{ background: '#E2E8E2' }} />
                    <div className="flex gap-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex-1 h-12 rounded-lg" style={{ background: '#F4F7F4' }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "knowledge" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-6">Organization Knowledge Base</h2>
            <div className="space-y-6">
              <div>
                <label className="block mb-1.5 font-medium text-[14px]">Upload Documents</label>
                <div 
                  className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-[#F4F7F4] transition-colors relative" 
                  style={{ borderColor: '#E2E8E2' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-8 h-8 mb-2 animate-spin" style={{ color: '#1B5E20' }} />
                      <span className="text-[14px]" style={{ color: '#4A5568' }}>Uploading document...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mb-2" style={{ color: '#9CA3AF' }} />
                      <span className="text-[14px]" style={{ color: '#4A5568' }}>Drag & drop or click to upload new documents</span>
                      <span className="text-[12px] mt-1" style={{ color: '#9CA3AF' }}>Supported formats: PDF, DOCX, TXT (Max 10MB)</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    accept=".pdf,.docx,.txt"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-3 font-medium text-[14px]">Uploaded Documents</label>
                <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#E2E8E2' }}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: '#F4F7F4' }}>
                        {["Document Name", "Size", "Uploaded By", "Date", "Actions"].map(h => (
                          <th key={h} className="px-4 py-3 text-left">
                            <span className="text-[11px] uppercase tracking-[0.5px]" style={{ color: '#9CA3AF', fontWeight: 600 }}>{h}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {docsLoading ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px]" style={{ color: '#9CA3AF' }}>Loading…</td></tr>
                      ) : docsList.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px]" style={{ color: '#9CA3AF' }}>No documents uploaded yet</td></tr>
                      ) : docsList.map((doc) => (
                        <tr key={doc.id} style={{ borderBottom: '1px solid #EEF2EE' }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" style={{ color: '#1B5E20' }} />
                              <span className="text-[13px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{doc.file_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[13px]" style={{ color: '#4A5568' }}>{doc.size || "—"}</td>
                          <td className="px-4 py-3 text-[13px]" style={{ color: '#9CA3AF' }}>{doc.uploaded_by}</td>
                          <td className="px-4 py-3 text-[13px]" style={{ color: '#9CA3AF' }}>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "—"}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleDeleteDoc(doc.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "formula" && (
        <div className="max-w-xl space-y-6">
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-1">Contractor Risk Score Weights</h2>
            <p className="text-[12px] mb-5" style={{ color: '#6B7280' }}>
              Tune how the Contractor Risk Score (Vendors page, Dashboard) penalises permit
              deviations and relative incident rate. Score = 10 − incident penalty − violation
              penalty, floored at 0.
            </p>
            {formulaLoading || !contractorWeights ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#1B5E20' }} />
                <span className="text-[13px]" style={{ color: '#9CA3AF' }}>Loading…</span>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block mb-1.5">Penalty per Contractor-Issued Permit Deviation</label>
                  <input
                    type="number" step="0.1" min="0"
                    value={contractorWeights.violation_penalty_per_violation}
                    onChange={e => setContractorWeights(w => w ? { ...w, violation_penalty_per_violation: Number(e.target.value) } : w)}
                    className="w-full h-10 px-4 rounded-lg border text-[13px]"
                    style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                  />
                </div>
                <div>
                  <label className="block mb-1.5">Max Violation Penalty (cap)</label>
                  <input
                    type="number" step="0.1" min="0"
                    value={contractorWeights.violation_penalty_cap}
                    onChange={e => setContractorWeights(w => w ? { ...w, violation_penalty_cap: Number(e.target.value) } : w)}
                    className="w-full h-10 px-4 rounded-lg border text-[13px]"
                    style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                  />
                </div>
                <div>
                  <label className="block mb-1.5">Relative Incident-Rate Penalty Multiplier</label>
                  <input
                    type="number" step="0.1" min="0"
                    value={contractorWeights.incident_penalty_multiplier}
                    onChange={e => setContractorWeights(w => w ? { ...w, incident_penalty_multiplier: Number(e.target.value) } : w)}
                    className="w-full h-10 px-4 rounded-lg border text-[13px]"
                    style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                  />
                </div>
                <div>
                  <label className="block mb-1.5">Max Incident Penalty (cap)</label>
                  <input
                    type="number" step="0.1" min="0"
                    value={contractorWeights.incident_penalty_cap}
                    onChange={e => setContractorWeights(w => w ? { ...w, incident_penalty_cap: Number(e.target.value) } : w)}
                    className="w-full h-10 px-4 rounded-lg border text-[13px]"
                    style={{ borderColor: '#E2E8E2', color: '#0A0A0A' }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveFormulaConfig}
                    disabled={formulaSaving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-[13px] disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 600 }}
                  >
                    {formulaSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {formulaSaving ? "Saving…" : "Save Weights"}
                  </button>
                  {formulaSaved && (
                    <span className="text-[13px]" style={{ color: '#2E7D32', fontWeight: 500 }}>✓ Saved successfully</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <h2 className="mb-1">Rating Labels</h2>
            <p className="text-[12px] mb-5" style={{ color: '#6B7280' }}>
              Rename the wording these scores are shown with, and move the cutoffs, to match how
              your industry talks about performance and risk.
            </p>
            {ratingLabelsLoading || !ratingLabels ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#1B5E20' }} />
                <span className="text-[13px]" style={{ color: '#9CA3AF' }}>Loading…</span>
              </div>
            ) : (
              <div className="space-y-6">
                {RATING_SCALE_META.map(({ key, title, hint }) => {
                  const cfg = ratingLabels[key];
                  return (
                    <div key={key} className="pt-5 first:pt-0 border-t first:border-t-0" style={{ borderColor: '#EEF2EE' }}>
                      <h3 className="text-[13px] mb-1" style={{ color: '#0A0A0A', fontWeight: 600 }}>{title}</h3>
                      <p className="text-[11px] mb-3" style={{ color: '#9CA3AF' }}>{hint}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block mb-1.5 text-[11px]" style={{ color: '#6B7280' }}>High band label</label>
                          <input
                            value={cfg.high_label}
                            onChange={e => updateRatingBand(key, "high_label", e.target.value)}
                            className="w-full h-9 px-3 rounded-lg border text-[13px]" style={{ borderColor: '#E2E8E2' }}
                          />
                          <label className="block mt-2 mb-1.5 text-[11px]" style={{ color: '#6B7280' }}>Applies at or above</label>
                          <input
                            type="number" step="1"
                            value={cfg.high_floor}
                            onChange={e => updateRatingBand(key, "high_floor", Number(e.target.value))}
                            className="w-full h-9 px-3 rounded-lg border text-[12px]" style={{ borderColor: '#E2E8E2' }}
                          />
                        </div>
                        <div>
                          <label className="block mb-1.5 text-[11px]" style={{ color: '#6B7280' }}>Mid band label</label>
                          <input
                            value={cfg.mid_label}
                            onChange={e => updateRatingBand(key, "mid_label", e.target.value)}
                            className="w-full h-9 px-3 rounded-lg border text-[13px]" style={{ borderColor: '#E2E8E2' }}
                          />
                          <label className="block mt-2 mb-1.5 text-[11px]" style={{ color: '#6B7280' }}>Applies at or above</label>
                          <input
                            type="number" step="1"
                            value={cfg.mid_floor}
                            onChange={e => updateRatingBand(key, "mid_floor", Number(e.target.value))}
                            className="w-full h-9 px-3 rounded-lg border text-[12px]" style={{ borderColor: '#E2E8E2' }}
                          />
                        </div>
                        <div>
                          <label className="block mb-1.5 text-[11px]" style={{ color: '#6B7280' }}>Low band label</label>
                          <input
                            value={cfg.low_label}
                            onChange={e => updateRatingBand(key, "low_label", e.target.value)}
                            className="w-full h-9 px-3 rounded-lg border text-[13px]" style={{ borderColor: '#E2E8E2' }}
                          />
                          <p className="mt-2 text-[11px]" style={{ color: '#9CA3AF' }}>Below the mid threshold</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleSaveRatingLabels}
                    disabled={ratingLabelsSaving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-[13px] disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 600 }}
                  >
                    {ratingLabelsSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {ratingLabelsSaving ? "Saving…" : "Save Rating Labels"}
                  </button>
                  {ratingLabelsSaved && (
                    <span className="text-[13px]" style={{ color: '#2E7D32', fontWeight: 500 }}>✓ Saved successfully</span>
                  )}
                  {ratingLabelsError && (
                    <span className="text-[13px]" style={{ color: '#B91C1C', fontWeight: 500 }}>{ratingLabelsError}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="space-y-4">
          <p className="text-[12px]" style={{ color: '#9CA3AF' }}>
            Admin actions on API keys, webhooks and branding — most recent 100 events.
          </p>
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr style={{ background: '#F4F7F4' }}>
                    {["Timestamp", "User", "Action", "Module", "Previous Value", "New Value"].map(h => (
                      <th key={h} className="px-4 py-3 text-left">
                        <span className="text-[11px] uppercase tracking-[0.5px]" style={{ color: '#9CA3AF', fontWeight: 600 }}>{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLoading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px]" style={{ color: '#9CA3AF' }}>Loading…</td></tr>
                  ) : auditLogs.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px]" style={{ color: '#9CA3AF' }}>No audit events recorded yet</td></tr>
                  ) : auditLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #EEF2EE' }}>
                      <td className="px-4 py-3 text-[13px]" style={{ color: '#9CA3AF' }}>{log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}</td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{log.user}</td>
                      <td className="px-4 py-3 text-[13px] capitalize" style={{ color: '#4A5568' }}>{log.action}</td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: '#4A5568' }}>{log.module}</td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: '#9CA3AF' }}>{log.previous_value || "—"}</td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: '#9CA3AF' }}>{log.new_value || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
