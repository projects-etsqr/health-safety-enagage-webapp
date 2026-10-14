/**
 * WF-05 · checklist templates and the auditor register. Admin, web only.
 *
 * "Maintains the checklist templates every audit runs from" and "maintains the
 * auditor register and their qualifications."
 *
 * Two rules the screen has to make visible rather than merely obey:
 *
 *   · **Editing supersedes.** A template is never rewritten in place, because an
 *     audit conducted last quarter ran against it as it stood then. Saving
 *     creates v2 and retires v1 — the old version stays readable.
 *
 *   · **Sections and critical flags are not decoration.** A section scoring
 *     below 60% raises a Minor NC on its own, and a critical item scoring zero
 *     is an automatic Major NC with an instant alert. How the Admin groups and
 *     flags items changes what audits find.
 */
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle, Check, ChevronDown, ChevronRight, Download, Loader2, Plus,
  Trash2, TriangleAlert, X,
} from "lucide-react";
import {
  createTemplate, formatDate, getAuditorRegister, getTemplates, retireTemplate,
  seedTemplates, updateTemplate,
  type AuditorRegisterRow, type Template, type TemplateItem,
} from "../../services/audits.service";
import { Banner, EmptyState } from "../components/audit/AuditPrimitives";
import { AuditsTabBar } from "../components/audits/AuditsTabBar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

type Tab = "templates" | "auditors";

export function AuditTemplatesPage() {
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [auditors, setAuditors] = useState<AuditorRegisterRow[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<Template | "new" | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [t, a] = await Promise.all([
        getTemplates(includeInactive),
        getAuditorRegister().catch(() => [] as AuditorRegisterRow[]),
      ]);
      setTemplates(t);
      setAuditors(a);
    } catch (e) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not load.");
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }, [includeInactive]);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "That did not work.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 p-6">
      <AuditsTabBar />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Templates &amp; auditors</h1>
          <p className="mt-1 max-w-3xl text-[13px] text-slate-500">
            The checklists every audit runs from, and who is qualified to run them. Both are the
            Admin's to maintain — the auditor consumes them.
          </p>
        </div>
        {tab === "templates" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => act(seedTemplates)} disabled={busy}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Import built-ins
            </Button>
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New template
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-1.5">
        {(["templates", "auditors"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg border px-4 py-2 text-[13px] font-semibold capitalize ${
              tab === t ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t} ({t === "templates" ? templates.length : auditors.length})
          </button>
        ))}
      </div>

      {error && <Banner tone="danger" title="Something went wrong" icon={<TriangleAlert className="h-4 w-4" />}>{error}</Banner>}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : tab === "templates" ? (
        <>
          <Banner tone="info" title="Editing creates a new version">
            A template is never rewritten in place. An audit conducted last quarter ran against it as
            it stood then, and changing it underneath would falsify the record of what was asked.
          </Banner>

          <label className="flex items-center gap-2 text-[12px] text-slate-600">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            Show superseded versions
          </label>

          <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <CardContent className="p-0">
              {templates.length === 0 ? (
                <EmptyState
                  title="No templates yet"
                  hint="Import the built-ins to start from the standard checklists, then edit them."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {templates.map((t) => {
                    const open = expanded === t.id;
                    const criticals = t.items.filter((i) => i.is_critical).length;
                    const sections = new Set(t.items.map((i) => i.section ?? "General")).size;
                    return (
                      <div key={t.id}>
                        <button
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                          onClick={() => setExpanded(open ? null : t.id)}
                        >
                          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[13.5px] font-semibold text-slate-900">{t.name}</p>
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">v{t.version}</span>
                              {t.is_default && <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">DEFAULT</span>}
                              {!t.is_active && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">SUPERSEDED</span>}
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {t.checklist_type ?? "Any type"} · {t.items.length} items · {sections} section
                              {sections === 1 ? "" : "s"} · {criticals} critical · used by {t.audits_using} audit
                              {t.audits_using === 1 ? "" : "s"}
                            </p>
                          </div>
                          {t.is_active && (
                            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <Button variant="outline" size="sm" onClick={() => setEditing(t)}>Edit</Button>
                              <Button variant="ghost" size="sm" onClick={() => act(() => retireTemplate(t.id))}>
                                <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                              </Button>
                            </div>
                          )}
                        </button>

                        {open && (
                          <div className="bg-slate-50/60 px-4 py-3 pl-11">
                            {t.description && <p className="mb-2 text-[12px] text-slate-600">{t.description}</p>}
                            <div className="divide-y divide-slate-200/70">
                              {t.items.map((i, n) => (
                                <div key={i.id ?? n} className="flex items-start gap-3 py-2">
                                  <span className="w-6 shrink-0 text-[10px] font-bold text-slate-400">{n + 1}</span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                        {i.section ?? "General"}
                                      </span>
                                      {i.clause && (
                                        <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                                          {i.clause}
                                        </span>
                                      )}
                                      {i.is_critical && (
                                        <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[8.5px] font-bold text-white">
                                          <AlertCircle className="h-2.5 w-2.5" /> CRITICAL
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[12.5px] font-semibold text-slate-800">{i.title}</p>
                                    {i.question && <p className="text-[11.5px] text-slate-500">{i.question}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">Auditor register</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {auditors.length === 0 ? (
              <EmptyState
                title="No auditors"
                hint="No users hold the auditor role in this organisation yet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-2.5 font-semibold">Auditor</th>
                      <th className="px-4 py-2.5 font-semibold">Workload</th>
                      <th className="px-4 py-2.5 font-semibold">Average score</th>
                      <th className="px-4 py-2.5 font-semibold">Last audit</th>
                      <th className="px-4 py-2.5 font-semibold">Qualifications</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditors.map((a) => (
                      <tr key={a.user_id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3">
                          <p className="text-[13px] font-semibold text-slate-900">{a.name ?? `User ${a.user_id}`}</p>
                          <p className="text-[11px] text-slate-500">{a.email ?? "—"}</p>
                          {!a.is_active && (
                            <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                              INACTIVE
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-slate-700">
                          {a.audits_open} open · {a.audits_closed} closed
                          <p className="text-[10.5px] text-slate-400">{a.audits_assigned} assigned in total</p>
                        </td>
                        <td className="px-4 py-3 text-[13px] font-semibold text-slate-700">
                          {a.average_score != null ? `${a.average_score}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-slate-600">{formatDate(a.last_audit_at)}</td>
                        <td className="px-4 py-3">
                          {a.qualifications.length === 0 ? (
                            <span className="text-[11.5px] text-slate-400">None recorded</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {a.qualifications.slice(0, 4).map((q, i) => (
                                <span
                                  key={i}
                                  className="rounded-md px-1.5 py-0.5 text-[9.5px] font-bold"
                                  style={q.expired
                                    ? { background: "#FEE2E2", color: "#B91C1C" }
                                    : { background: "#D1FAE5", color: "#047857" }}
                                  title={q.expires ? `Expires ${q.expires}` : undefined}
                                >
                                  {q.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {a.expired_qualifications > 0 && (
                            <p className="mt-1 text-[10.5px] font-semibold text-red-700">
                              {a.expired_qualifications} expired
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {editing && (
        <TemplateEditor
          template={editing === "new" ? null : editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            await act(async () => {
              if (editing === "new") await createTemplate(payload);
              else await updateTemplate(editing.id, payload);
              setEditing(null);
            });
          }}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  template, busy, onClose, onSave,
}: {
  template: Template | null;
  busy: boolean;
  onClose: () => void;
  onSave: (p: { name: string; checklist_type?: string; description?: string; standard?: string; is_default?: boolean; items: TemplateItem[] }) => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [checklistType, setChecklistType] = useState(template?.checklist_type ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [standard, setStandard] = useState(template?.standard ?? "");
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [items, setItems] = useState<TemplateItem[]>(
    template?.items.map((i) => ({ ...i })) ?? [{ title: "", section: "General", is_critical: false }],
  );

  const patch = (n: number, next: Partial<TemplateItem>) =>
    setItems((p) => p.map((it, i) => (i === n ? { ...it, ...next } : it)));

  const valid = name.trim() && items.some((i) => i.title.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">
              {template ? `Edit "${template.name}"` : "New checklist template"}
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">
              {template
                ? `Saving creates v${template.version + 1} and retires v${template.version}. The old version stays readable for the ${template.audits_using} audit(s) that used it.`
                : "Sections group items for scoring — a section below 60% raises a Minor NC on its own."}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Labelled label="Name">
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                   value={name} onChange={(e) => setName(e.target.value)} placeholder="Fire Safety" />
          </Labelled>
          <Labelled label="Checklist type (matched against the audit)">
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                   value={checklistType} onChange={(e) => setChecklistType(e.target.value)} placeholder="Fire Safety" />
          </Labelled>
          <Labelled label="Standard">
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                   value={standard} onChange={(e) => setStandard(e.target.value)} placeholder="ISO 45001" />
          </Labelled>
          <Labelled label="Description">
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                   value={description} onChange={(e) => setDescription(e.target.value)} />
          </Labelled>
        </div>

        <label className="mt-3 flex items-center gap-2 text-[12.5px] text-slate-700">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Use as the default when no template matches the audit type
        </label>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Items ({items.length})
            </p>
            <Button variant="outline" size="sm"
                    onClick={() => setItems((p) => [...p, { title: "", section: "General", is_critical: false }])}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add item
            </Button>
          </div>

          <div className="space-y-2">
            {items.map((it, n) => (
              <div key={n} className="rounded-xl border border-slate-200 p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px]"
                         placeholder="Section" value={it.section ?? ""}
                         onChange={(e) => patch(n, { section: e.target.value })} />
                  <input className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px]"
                         placeholder="Clause (e.g. ISO 45001 8.2)" value={it.clause ?? ""}
                         onChange={(e) => patch(n, { clause: e.target.value })} />
                  <button
                    onClick={() => setItems((p) => p.filter((_, i) => i !== n))}
                    className="rounded-lg p-1.5 hover:bg-slate-100"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </div>
                <input className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] font-semibold"
                       placeholder="Item title" value={it.title}
                       onChange={(e) => patch(n, { title: e.target.value })} />
                <input className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px]"
                       placeholder="The question the auditor answers on site" value={it.question ?? ""}
                       onChange={(e) => patch(n, { question: e.target.value })} />
                <label className="mt-2 flex items-center gap-2 text-[12px] text-slate-700">
                  <input type="checkbox" checked={it.is_critical}
                         onChange={(e) => patch(n, { is_critical: e.target.checked })} />
                  <span className="inline-flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-red-600" />
                    Critical — a zero here is an automatic Major NC and alerts the Safety Manager immediately
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!valid || busy}
            onClick={() => onSave({
              name: name.trim(),
              checklist_type: checklistType.trim() || undefined,
              description: description.trim() || undefined,
              standard: standard.trim() || undefined,
              is_default: isDefault,
              items: items.filter((i) => i.title.trim()).map((i, n) => ({ ...i, seq: n + 1 })),
            })}
          >
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            {template ? `Save as v${template.version + 1}` : "Create template"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      {children}
    </div>
  );
}

export default AuditTemplatesPage;
