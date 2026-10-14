import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2, Plus, RefreshCcw, ShieldAlert, Trash2, X, XCircle, Clock } from 'lucide-react';
import {
  bootstrapChecklistTemplates,
  createChecklistTemplate,
  deactivateChecklistTemplate,
  getChecklistSubmissionDetail,
  getChecklistSubmissions,
  getChecklistTemplates,
  validateChecklistSubmission,
  type ChecklistSubmissionDetail,
  type ChecklistSubmissionSummary,
  type ChecklistTemplate,
} from '../../services/checklists.service';
import { useAuth } from '../context/AuthContext';
import { SettingsFamilyTabBar } from '../components/audits/SettingsFamilyTabBar';

const ROLE_OPTIONS = ['Admin', 'HSE Manager', 'Supervisor', 'Site Inspector', 'Site Engineer', 'Auditor'];

interface BuilderItem {
  section_name: string;
  item_text: string;
  is_required: boolean;
}

// ── Checklist Builder modal — Organisation Admin only, per client architecture
// (Web Portal: "Templates (Checklist, Audit, Permit)" is an Admin control-center item) ──
function ChecklistBuilder({ onClose, onCreated }: Readonly<{ onClose: () => void; onCreated: () => void }>) {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [submitterRoles, setSubmitterRoles] = useState<string[]>(['Supervisor']);
  const [validatorRoles, setValidatorRoles] = useState<string[]>(['Admin', 'HSE Manager']);
  const [items, setItems] = useState<BuilderItem[]>([{ section_name: 'General', item_text: '', is_required: true }]);
  const [submitSlaHours, setSubmitSlaHours] = useState(24);
  const [validateSlaHours, setValidateSlaHours] = useState(48);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleRole = (list: string[], setList: (v: string[]) => void, role: string) => {
    setList(list.includes(role) ? list.filter((r) => r !== role) : [...list, role]);
  };

  const updateItem = (i: number, patch: Partial<BuilderItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const handleCreate = async () => {
    setError(null);
    if (!displayName.trim()) { setError('Checklist name is required.'); return; }
    const cleanItems = items.filter((it) => it.item_text.trim());
    if (cleanItems.length === 0) { setError('Add at least one checklist item.'); return; }
    setSaving(true);
    try {
      await createChecklistTemplate({
        display_name: displayName.trim(),
        description: description.trim() || undefined,
        submitter_roles: submitterRoles,
        validator_roles: validatorRoles,
        items: cleanItems,
        sla: {
          draft_submission_sla_hours: submitSlaHours,
          validation_sla_hours: validateSlaHours,
        },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create checklist template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.45)' }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px]" style={{ color: '#0A0A0A', fontWeight: 700 }}>New Checklist Template</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" style={{ color: '#6B7280' }} />
          </button>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: '#FFF1F2', color: '#BE123C', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <div>
          <label className="block mb-1.5 text-[13px]" style={{ color: '#374151', fontWeight: 600 }}>Checklist Name *</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Weekly Fire Extinguisher Check"
            className="w-full h-10 px-3 rounded-lg border text-[13px]"
            style={{ borderColor: '#D6E4FF' }}
          />
        </div>

        <div>
          <label className="block mb-1.5 text-[13px]" style={{ color: '#374151', fontWeight: 600 }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this checklist for?"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border text-[13px]"
            style={{ borderColor: '#D6E4FF' }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block mb-1.5 text-[13px]" style={{ color: '#374151', fontWeight: 600 }}>Who submits this? (Mobile App)</label>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  onClick={() => toggleRole(submitterRoles, setSubmitterRoles, role)}
                  className="px-2.5 py-1 rounded-full text-[11px] border"
                  style={submitterRoles.includes(role)
                    ? { background: '#EFF6FF', borderColor: '#93C5FD', color: '#1D4ED8', fontWeight: 700 }
                    : { background: '#fff', borderColor: '#E5E7EB', color: '#6B7280' }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-[13px]" style={{ color: '#374151', fontWeight: 600 }}>Who validates this? (Web Portal)</label>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  onClick={() => toggleRole(validatorRoles, setValidatorRoles, role)}
                  className="px-2.5 py-1 rounded-full text-[11px] border"
                  style={validatorRoles.includes(role)
                    ? { background: '#ECFDF3', borderColor: '#86EFAC', color: '#15803D', fontWeight: 700 }
                    : { background: '#fff', borderColor: '#E5E7EB', color: '#6B7280' }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block mb-1.5 text-[13px]" style={{ color: '#374151', fontWeight: 600 }}>Submission SLA (hours)</label>
            <input
              type="number" min={1}
              value={submitSlaHours}
              onChange={(e) => setSubmitSlaHours(Number(e.target.value) || 24)}
              className="w-full h-10 px-3 rounded-lg border text-[13px]"
              style={{ borderColor: '#D6E4FF' }}
            />
            <p className="mt-1 text-[11px]" style={{ color: '#9CA3AF' }}>Time allowed to submit before it's flagged overdue.</p>
          </div>
          <div>
            <label className="block mb-1.5 text-[13px]" style={{ color: '#374151', fontWeight: 600 }}>Validation SLA (hours)</label>
            <input
              type="number" min={1}
              value={validateSlaHours}
              onChange={(e) => setValidateSlaHours(Number(e.target.value) || 48)}
              className="w-full h-10 px-3 rounded-lg border text-[13px]"
              style={{ borderColor: '#D6E4FF' }}
            />
            <p className="mt-1 text-[11px]" style={{ color: '#9CA3AF' }}>Time allowed for the validator to review before it's flagged overdue.</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[13px]" style={{ color: '#374151', fontWeight: 600 }}>Checklist Items *</label>
            <button
              onClick={() => setItems((prev) => [...prev, { section_name: prev.at(-1)?.section_name ?? 'General', item_text: '', is_required: true }])}
              className="flex items-center gap-1 text-[12px]" style={{ color: '#1D4ED8', fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" /> Add item
            </button>
          </div>
          <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border p-2.5" style={{ borderColor: '#E6EEFF' }}>
                <div className="flex-1 space-y-1.5">
                  <input
                    value={item.section_name}
                    onChange={(e) => updateItem(i, { section_name: e.target.value })}
                    placeholder="Section (e.g. PPE & Clothing)"
                    className="w-full h-8 px-2 rounded-md border text-[12px]" style={{ borderColor: '#E5E7EB' }}
                  />
                  <input
                    value={item.item_text}
                    onChange={(e) => updateItem(i, { item_text: e.target.value })}
                    placeholder="Checklist question / item text"
                    className="w-full h-8 px-2 rounded-md border text-[12px]" style={{ borderColor: '#E5E7EB' }}
                  />
                  <label className="flex items-center gap-1.5 text-[11px]" style={{ color: '#6B7280' }}>
                    <input
                      type="checkbox"
                      checked={item.is_required}
                      onChange={(e) => updateItem(i, { is_required: e.target.checked })}
                    />
                    Required
                  </label>
                </div>
                <button
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={items.length === 1}
                  className="p-1.5 rounded-lg flex-shrink-0"
                  style={{ color: items.length === 1 ? '#D1D5DB' : '#DC2626' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-[13px]" style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-[13px] disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)', fontWeight: 600 }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Creating…' : 'Create Checklist'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    submitted:  { bg: '#ECFDF3', color: '#15803D' },
    validated:  { bg: '#EFF6FF', color: '#1D4ED8' },
    approved:   { bg: '#ECFDF3', color: '#15803D' },
    rejected:   { bg: '#FFF1F2', color: '#BE123C' },
    draft:      { bg: '#FFF7ED', color: '#C2410C' },
  };
  const style = map[status?.toLowerCase()] ?? { bg: '#F3F4F6', color: '#374151' };
  return (
    <span
      className="text-[11px] px-2.5 py-1 rounded-full uppercase whitespace-nowrap"
      style={{ background: style.bg, color: style.color, fontWeight: 700 }}
    >
      {status}
    </span>
  );
}

// ── Compliance summary bar ────────────────────────────────────────────────────
function ComplianceBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px]" style={{ color: '#374151', fontWeight: 500 }}>{label}</span>
        <span className="text-[12px]" style={{ color: '#111827', fontWeight: 700 }}>{value}%</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: '#E2E8F0' }}>
        <div className="h-2 rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function ChecklistPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [submissions, setSubmissions] = useState<ChecklistSubmissionSummary[]>([]);
  const [activeSubmission, setActiveSubmission] = useState<ChecklistSubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [bootstrapping, setBootstrapping] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [deletingType, setDeletingType] = useState<string | null>(null);

  const refreshData = async () => {
    if (templates.length === 0 && submissions.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const [templateData, submissionData] = await Promise.all([
        getChecklistTemplates(),
        getChecklistSubmissions({ limit: 50 }),
      ]);
      setTemplates(templateData);
      setSubmissions(submissionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load checklist data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshData(); }, []);

  const openSubmission = async (uuid: string) => {
    setError(null);
    setMessage(null);
    try {
      const detail = await getChecklistSubmissionDetail(uuid);
      setActiveSubmission(detail);
    } catch {
      setError('Unable to load checklist detail.');
    }
  };

  const validate = async (decision: 'approved' | 'rejected', notes?: string) => {
    if (!activeSubmission) return;
    setValidating(true);
    setError(null);
    setMessage(null);
    try {
      await validateChecklistSubmission(
        activeSubmission.submission.submission_uuid,
        decision,
        notes,
      );
      await refreshData();
      const updated = await getChecklistSubmissionDetail(activeSubmission.submission.submission_uuid);
      setActiveSubmission(updated);
      setMessage(`Checklist ${decision === 'approved' ? 'approved' : 'rejected'} successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to validate checklist.');
    } finally {
      setValidating(false);
    }
  };

  const bootstrapIfNeeded = async () => {
    setBootstrapping(true);
    setError(null);
    setMessage(null);
    try {
      await bootstrapChecklistTemplates();
      await refreshData();
      setMessage('Checklist templates initialized.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initialize checklist templates.');
    } finally {
      setBootstrapping(false);
    }
  };

  // ── Compliance metrics derived from submissions ───────────────────────────
  const total = submissions.length;
  const submitted = submissions.filter((s) => ['submitted', 'validated', 'approved'].includes(s.status)).length;
  const approved = submissions.filter((s) => s.status === 'approved' || s.status === 'validated').length;
  const rejected = submissions.filter((s) => s.status === 'rejected').length;
  const pending = submissions.filter((s) => s.status === 'submitted').length;
  const submissionRate = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const approvalRate = submitted > 0 ? Math.round((approved / submitted) * 100) : 0;

  const filteredSubmissions = filterStatus === 'all'
    ? submissions
    : submissions.filter((s) => s.status === filterStatus);

  const isHSEManager = ['Admin', 'HSE Manager'].includes(user?.role ?? '');
  const isAdmin = user?.role === 'Admin';

  const handleDeactivate = async (checklistType: string) => {
    setDeletingType(checklistType);
    try {
      await deactivateChecklistTemplate(checklistType);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove checklist template.');
    } finally {
      setDeletingType(null);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsFamilyTabBar />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1>Checklist Review</h1>
          <p className="text-[13px] mt-1" style={{ color: '#4A5568' }}>
            Review submitted field checklists, validate compliance and track submission rates.
            <span className="ml-2 px-2 py-0.5 rounded-full text-[11px]" style={{ background: '#EFF6FF', color: '#1D4ED8', fontWeight: 700 }}>
              Field execution → Mobile App only
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowBuilder(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px]"
              style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', fontWeight: 600 }}
            >
              <Plus className="w-4 h-4" /> New Checklist
            </button>
          )}
          {isAdmin && templates.length === 0 && (
            <button
              onClick={bootstrapIfNeeded}
              disabled={bootstrapping}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)', fontWeight: 600 }}
            >
              {bootstrapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
              Init Templates
            </button>
          )}
          <button
            onClick={() => refreshData()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-white text-[13px]"
            style={{ borderColor: '#D6E4FF', color: '#1D4ED8', fontWeight: 600 }}
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: '#EFF6FF', color: '#1D4ED8', fontWeight: 500 }}>
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: '#FFF1F2', color: '#BE123C', fontWeight: 500 }}>
          {error}
        </div>
      )}

      {/* Compliance KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: 'Total Submissions', value: total, icon: ClipboardList, color: '#1D4ED8' },
          { label: 'Pending Validation', value: pending, icon: Clock, color: '#C2410C' },
          { label: 'Approved', value: approved, icon: CheckCircle2, color: '#15803D' },
          { label: 'Rejected', value: rejected, icon: XCircle, color: '#BE123C' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.07)]" style={{ borderColor: '#E6EEFF' }}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="text-[12px] uppercase tracking-[0.5px]" style={{ color: '#6B7280', fontWeight: 700 }}>{label}</span>
            </div>
            <div className="text-[36px] leading-none" style={{ color, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)_260px] gap-6">

        {/* Submissions list */}
        <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E6EEFF' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[16px]" style={{ fontWeight: 700 }}>Submissions</h2>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-8 px-2 rounded-lg border text-[12px] bg-white"
              style={{ borderColor: '#D6E4FF', color: '#374151' }}
            >
              <option value="all">All</option>
              <option value="submitted">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-auto pr-1">
            {loading && submissions.length === 0 ? (
              <div className="py-10 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#1D4ED8' }} />
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <p className="text-[13px] py-6 text-center" style={{ color: '#9CA3AF' }}>
                No submissions found.
              </p>
            ) : filteredSubmissions.map((sub) => (
              <button
                key={sub.submission_uuid}
                onClick={() => openSubmission(sub.submission_uuid)}
                className="w-full text-left rounded-xl border p-3 hover:bg-[#F8FAFF] transition-colors"
                style={{
                  borderColor: activeSubmission?.submission.submission_uuid === sub.submission_uuid
                    ? '#93C5FD' : '#E6EEFF',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] truncate" style={{ color: '#0A0A0A', fontWeight: 600 }}>
                      {sub.checklist_type.replaceAll('_', ' ')}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: '#6B7280' }}>
                      {sub.site_id || 'No site'} · {sub.checklist_date}
                    </div>
                  </div>
                  <StatusPill status={sub.status} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Submission detail — read only */}
        <div className="bg-white rounded-2xl border p-5 min-h-[500px]" style={{ borderColor: '#E6EEFF' }}>
          {!activeSubmission ? (
            <div className="h-full min-h-[460px] flex flex-col items-center justify-center text-center px-8">
              <ClipboardList className="w-12 h-12 mb-4" style={{ color: '#AFC4EE' }} />
              <h2 className="text-[18px] mb-2" style={{ color: '#0A0A0A', fontWeight: 700 }}>No submission selected</h2>
              <p className="text-[13px] max-w-md" style={{ color: '#6B7280' }}>
                Select a submission from the list to review its responses and validate compliance.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Submission header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[18px]" style={{ color: '#0A0A0A', fontWeight: 700 }}>
                    {activeSubmission.template.ui?.form_title || activeSubmission.template.display_name}
                  </h2>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-[12px]" style={{ color: '#6B7280' }}>
                    <span>Site: {activeSubmission.submission.site_id || '—'}</span>
                    <span>Zone: {activeSubmission.submission.zone_id || '—'}</span>
                    <span>Shift: {activeSubmission.submission.shift_name || '—'}</span>
                    <span>Date: {activeSubmission.submission.checklist_date}</span>
                  </div>
                </div>
                <StatusPill status={activeSubmission.submission.status} />
              </div>

              {/* Validate buttons — HSE Manager only, submitted only */}
              {isHSEManager && activeSubmission.submission.status === 'submitted' && (
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                  <span className="text-[13px] flex-1" style={{ color: '#0369A1', fontWeight: 600 }}>
                    This checklist is awaiting your validation.
                  </span>
                  <button
                    onClick={() => validate('approved')}
                    disabled={validating}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-[13px] disabled:opacity-60"
                    style={{ background: '#16A34A', fontWeight: 700 }}
                  >
                    {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Approve
                  </button>
                  <button
                    onClick={() => validate('rejected', 'Requires re-inspection')}
                    disabled={validating}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-[13px] disabled:opacity-60"
                    style={{ background: '#DC2626', fontWeight: 700 }}
                  >
                    {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Reject
                  </button>
                </div>
              )}

              {/* Items — read only */}
              <div className="space-y-3 max-h-[640px] overflow-auto pr-1">
                {activeSubmission.items.map((item) => {
                  const resp = item.response_value;
                  const respColor = resp === 'yes' ? '#15803D' : resp === 'no' ? '#BE123C' : '#6B7280';
                  return (
                    <div
                      key={item.item_no}
                      className="rounded-xl border p-4"
                      style={{ borderColor: '#E6EEFF', background: '#FCFDFF' }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <div className="text-[11px] uppercase tracking-[0.6px] mb-0.5" style={{ color: '#6B7280', fontWeight: 700 }}>
                            {item.section_name}
                          </div>
                          <div className="text-[13px]" style={{ color: '#0A0A0A', fontWeight: 600 }}>
                            {item.item_no}. {item.item_text}
                          </div>
                        </div>
                        {resp && (
                          <span
                            className="text-[11px] px-2.5 py-1 rounded-full uppercase whitespace-nowrap"
                            style={{ background: `${respColor}15`, color: respColor, fontWeight: 700 }}
                          >
                            {resp === 'yes' ? 'Compliant' : resp === 'no' ? 'Issue Found' : 'N/A'}
                          </span>
                        )}
                        {!resp && (
                          <span className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: '#F3F4F6', color: '#9CA3AF', fontWeight: 600 }}>
                            No response
                          </span>
                        )}
                      </div>
                      {item.remark && (
                        <p className="text-[12px] mt-1 pl-1" style={{ color: '#4A5568' }}>
                          Remark: {item.remark}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Workflow log */}
              {activeSubmission.logs.length > 0 && (
                <div className="rounded-xl border p-4" style={{ borderColor: '#E6EEFF' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-4 h-4" style={{ color: '#1D4ED8' }} />
                    <h3 className="text-[14px]" style={{ fontWeight: 700 }}>Workflow log</h3>
                  </div>
                  <div className="space-y-2">
                    {activeSubmission.logs.map((log, index) => (
                      <div key={`${log.created_at}-${index}`} className="text-[12px]" style={{ color: '#4A5568' }}>
                        <span style={{ fontWeight: 700 }}>{log.action_type}</span>
                        {' · '}{log.actor_role}
                        {' · '}{new Date(log.created_at).toLocaleString()}
                        {log.notes ? <span> — {log.notes}</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compliance metrics sidebar */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E6EEFF' }}>
            <h2 className="text-[15px] mb-4" style={{ fontWeight: 700 }}>Compliance Metrics</h2>
            <div className="space-y-4">
              <ComplianceBar label="Submission Rate" value={submissionRate} color="linear-gradient(90deg, #1D4ED8, #60A5FA)" />
              <ComplianceBar label="Approval Rate" value={approvalRate} color="linear-gradient(90deg, #16A34A, #4ADE80)" />
              <ComplianceBar
                label="Issue Rate"
                value={total > 0 ? Math.round((rejected / total) * 100) : 0}
                color="linear-gradient(90deg, #DC2626, #F87171)"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E6EEFF' }}>
            <h2 className="text-[15px] mb-3" style={{ fontWeight: 700 }}>Templates ({templates.length})</h2>
            <div className="space-y-2">
              {templates.length === 0 ? (
                <p className="text-[12px]" style={{ color: '#9CA3AF' }}>No templates loaded.</p>
              ) : templates.map((t) => (
                <div key={t.checklist_type} className="py-1.5 border-b last:border-0" style={{ borderColor: '#F1F5F9' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-[12px] truncate" style={{ color: '#374151', fontWeight: 500 }}>{t.display_name}</span>
                      {t.description && (
                        <span className="block text-[11px] truncate" style={{ color: '#9CA3AF' }}>{t.description}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#F0FFF4', color: '#15803D', fontWeight: 700 }}>
                        Active
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeactivate(t.checklist_type)}
                          disabled={deletingType === t.checklist_type}
                          className="p-1 rounded hover:bg-red-50"
                          title="Remove template"
                        >
                          {deletingType === t.checklist_type
                            ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#9CA3AF' }} />
                            : <Trash2 className="w-3 h-3" style={{ color: '#DC2626' }} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-4" style={{ background: '#FFF7ED', borderColor: '#FED7AA' }}>
            <div className="text-[12px]" style={{ color: '#C2410C', fontWeight: 700 }}>Field Execution</div>
            <p className="mt-1 text-[12px]" style={{ color: '#92400E' }}>
              Filling out checklists happens on the Mobile App. The Organisation Admin creates and manages
              checklist templates here — new templates appear on mobile automatically.
            </p>
          </div>
        </div>
      </div>

      {showBuilder && (
        <ChecklistBuilder
          onClose={() => setShowBuilder(false)}
          onCreated={() => { setShowBuilder(false); setMessage('Checklist template created.'); refreshData(); }}
        />
      )}
    </div>
  );
}
