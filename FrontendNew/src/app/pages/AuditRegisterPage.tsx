/**
 * WF-05 step 02 · the audit register.
 *
 * Every audit in the organisation and — the thing a status column cannot say —
 * which of the ten steps each is waiting on and who owes it. "In progress"
 * covered both "read the brief" and "hold the opening meeting", which are
 * different jobs on different days and different people's problem.
 *
 * The one action this screen owns is assigning the auditor, which the diagram
 * marks as a hard stop: the Admin "names who audits what, and must
 * ensure the auditor is independent of the area being audited". That rule is
 * enforced server-side — this screen surfaces the refusal rather than
 * re-implementing the check.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  CalendarPlus, Hand, Loader2, Search, TriangleAlert, UserCheck, X,
} from "lucide-react";
import { AuditsTabBar } from "../components/audits/AuditsTabBar";
import {
  assignTeam, currentStep, formatDate, getAuditKpis, getAuditReference, getAuditorRegister, getAudits,
  getTemplates, scheduleAudit, humanise,
  type Audit, type AuditKpis, type AuditReference, type AuditorRegisterRow, type Template,
} from "../../services/audits.service";
import {
  Banner, EmptyState, FindingCounts, RatingChip, RiskBandChip, ScoreBadge, StepStrip,
} from "../components/audit/AuditPrimitives";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { InfoTooltip } from "../components/shared/InfoTooltip";

// Shared formula/definition Info tooltip content for the Module 8 KPI tiles —
// same pattern as the Dashboard, Equipment, Vendors, Compliance, Risk and
// Actions pages' Info tooltips: shows the live current value alongside the
// definition/formula so it can never disagree with the number on the tile.
function MetricFormulaInfo({
  title,
  currentValue,
  definition,
  formula,
  note,
}: {
  title: string;
  currentValue: string;
  definition: string;
  formula?: string;
  note?: string;
}) {
  return (
    <div className="space-y-2.5 text-[12px] leading-snug" style={{ color: '#374151' }}>
      <div className="text-[13px] font-semibold" style={{ color: '#111827' }}>{title}</div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Current Value</div>
        <div className="text-[15px] font-bold" style={{ color: '#111827' }}>{currentValue}</div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Definition</div>
        <div>{definition}</div>
      </div>

      {formula && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Formula</div>
          <div className="mt-1 rounded-md p-1.5 font-mono text-[11px]" style={{ background: '#F8FAFC', color: '#111827' }}>{formula}</div>
        </div>
      )}

      {note && (
        <div className="text-[11px]" style={{ color: '#6B7280' }}>{note}</div>
      )}
    </div>
  );
}

// ── Module 8 KPI tile — same visual language as the Assets/Equipment
// register page (white card, big tone-coloured number, one-line note), per
// the client's own reference for this section. Named distinctly from the
// shadcn `Card` this page already imports so the two don't collide. ────────
function KpiTile({
  title, value, unit, note, tone, info,
}: {
  title: string; value: number | null; unit: string; note: string; tone: "good" | "warn" | "bad" | "neutral"; info?: React.ReactNode;
}) {
  const color = value === null ? "#9CA3AF"
    : tone === "good" ? "#166534" : tone === "warn" ? "#B45309" : tone === "bad" ? "#B91C1C" : "#111827";
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.08)]" style={{ borderColor: "#D8E2F4" }}>
      <div className="mb-3 flex items-center gap-1.5 text-[15px]" style={{ color: "#111827", fontWeight: 700 }}>
        {title}
        {info && (
          <InfoTooltip label={`${title} — how this is calculated`}>
            {info}
          </InfoTooltip>
        )}
      </div>
      <div className="text-[40px] leading-none" style={{ color, fontWeight: 700 }}>
        {value === null ? "N/A" : `${value}${unit}`}
      </div>
      <p className="mt-2 text-[11px] leading-snug" style={{ color: "#9CA3AF" }}>{note}</p>
    </div>
  );
}

function pctTone(value: number | null, goodFloor: number, warnFloor: number): "good" | "warn" | "bad" | "neutral" {
  if (value === null) return "neutral";
  return value >= goodFloor ? "good" : value >= warnFloor ? "warn" : "bad";
}

type Filter = "all" | "planning" | "in_field" | "reporting" | "verifying" | "closed";

const FILTERS: Array<{ key: Filter; label: string; test: (a: Audit) => boolean }> = [
  { key: "all", label: "All", test: () => true },
  { key: "planning", label: "Planning", test: (a) => (a.current_step ?? 1) <= 3 && !a.closed_at },
  { key: "in_field", label: "In field", test: (a) => { const s = a.current_step ?? 0; return s >= 4 && s <= 8 && !a.closed_at; } },
  { key: "reporting", label: "Reporting", test: (a) => (a.current_step ?? 0) === 9 && !a.closed_at },
  { key: "verifying", label: "Verifying", test: (a) => !!a.report_issued_at && !a.closed_at },
  { key: "closed", label: "Closed", test: (a) => !!a.closed_at },
];

export function AuditRegisterPage() {
  const navigate = useNavigate();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [kpis, setKpis] = useState<AuditKpis | null>(null);
  const [auditors, setAuditors] = useState<AuditorRegisterRow[]>([]);
  const [reference, setReference] = useState<AuditReference | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [assigning, setAssigning] = useState<Audit | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, k, r, ref, t] = await Promise.all([
        getAudits(),
        getAuditKpis().catch(() => null),
        getAuditorRegister().catch(() => [] as AuditorRegisterRow[]),
        getAuditReference().catch(() => null),
        // Only the Admin maintains templates, so a role that cannot read them
        // still gets the built-in types from the reference above rather than an
        // empty dropdown.
        getTemplates().catch(() => [] as Template[]),
      ]);
      setAudits(a);
      setKpis(k);
      setAuditors(r);
      setReference(ref);
      setTemplates(t);
    } catch (e) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not load audits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = FILTERS.find((f) => f.key === filter)!.test;
    return audits.filter((a) => {
      if (!test(a)) return false;
      if (!q) return true;
      return [a.title, a.site_name, a.department, a.checklist_type, a.audit_ref]
        .some((f) => (f ?? "").toLowerCase().includes(q));
    });
  }, [audits, query, filter]);

  const unassigned = audits.filter((a) => !a.auditor_id && !a.closed_at).length;
  const stopped = audits.filter((a) => a.status === "immediate_action");

  return (
    <div className="space-y-5 p-6">
      <AuditsTabBar />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Audit register</h1>
          <p className="mt-1 max-w-3xl text-[13px] text-slate-500">
            Every audit and the step it is waiting on. Steps 4 to 8 run on the phone in the field —
            what happens here is naming the auditor, and reading the result afterwards.
          </p>
        </div>
        <Button size="sm" onClick={() => setScheduling(true)}>
          <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
          Schedule an audit
        </Button>
      </div>

      {/* Module 8 (Compliance & Audits) KPI block — client's own KPI spec
          (HSEIQ_Full_KPI_with_SampleData.xlsx, M8_Compliance_Audits). */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile
          title="Audit Completion Rate"
          value={kpis?.audit_completion_rate_pct ?? null}
          unit="%"
          note={kpis ? `${kpis.detail.audits_completed} of ${kpis.detail.audits_planned} audits completed` : "Target: 100%"}
          tone={pctTone(kpis?.audit_completion_rate_pct ?? null, 90, 70)}
          info={
            <MetricFormulaInfo
              title="Audit Completion Rate"
              currentValue={kpis?.audit_completion_rate_pct != null ? `${kpis.audit_completion_rate_pct}%` : "N/A"}
              definition="The share of planned audits that have been closed out (closed_at set) or explicitly marked completed, out of every audit scheduled."
              formula="(Audits Completed ÷ Audits Planned) × 100"
              note={kpis ? `${kpis.detail.audits_completed} of ${kpis.detail.audits_planned} audits completed. Target: 100%.` : "Target: 100%."}
            />
          }
        />
        <KpiTile
          title="Finding Closure Rate"
          value={kpis?.finding_closure_rate_pct ?? null}
          unit="%"
          note={kpis ? `${kpis.detail.findings_closed} of ${kpis.detail.total_findings} findings closed` : "Target: 80%+ within 90 days"}
          tone={pctTone(kpis?.finding_closure_rate_pct ?? null, 80, 50)}
          info={
            <MetricFormulaInfo
              title="Finding Closure Rate"
              currentValue={kpis?.finding_closure_rate_pct != null ? `${kpis.finding_closure_rate_pct}%` : "N/A"}
              definition="The share of every audit finding (all classifications) that has reached a closed status, out of every finding ever raised."
              formula="(Findings Closed ÷ Total Findings) × 100"
              note={kpis ? `${kpis.detail.findings_closed} of ${kpis.detail.total_findings} findings closed. Target: 80%+ within 90 days.` : "Target: 80%+ within 90 days."}
            />
          }
        />
        <KpiTile
          title="NC Closure Rate"
          value={kpis?.nc_closure_rate_pct ?? null}
          unit="%"
          note={kpis ? `${kpis.detail.ncs_closed} of ${kpis.detail.total_ncs} non-conformances closed` : "Target: 100% within SLA"}
          tone={pctTone(kpis?.nc_closure_rate_pct ?? null, 90, 60)}
          info={
            <MetricFormulaInfo
              title="NC Closure Rate"
              currentValue={kpis?.nc_closure_rate_pct != null ? `${kpis.nc_closure_rate_pct}%` : "N/A"}
              definition="The share of findings classified as a non-conformance (major or minor NC) that have reached a closed status, out of every non-conformance raised."
              formula="(Non-Conformances Closed ÷ Total Non-Conformances) × 100"
              note={kpis ? `${kpis.detail.ncs_closed} of ${kpis.detail.total_ncs} non-conformances closed. Target: 100% within SLA.` : "Target: 100% within SLA."}
            />
          }
        />
        <KpiTile
          title="Regulatory Compliance"
          value={kpis?.regulatory_compliance_rate_pct ?? null}
          unit="%"
          note="Proxy from audit NC closure — no separate legal register exists yet to check against"
          tone={pctTone(kpis?.regulatory_compliance_rate_pct ?? null, 95, 80)}
          info={
            <MetricFormulaInfo
              title="Regulatory Compliance"
              currentValue={kpis?.regulatory_compliance_rate_pct != null ? `${kpis.regulatory_compliance_rate_pct}%` : "N/A"}
              definition="A proxy for regulatory compliance, computed identically to NC Closure Rate — the org has no separate legal/regulatory register yet to check findings against, so audit non-conformance closure stands in for it."
              formula="(Non-Conformances Closed ÷ Total Non-Conformances) × 100"
              note="Proxy from audit NC closure — no separate legal register exists yet to check against."
            />
          }
        />
        <KpiTile
          title="Overdue Findings"
          value={kpis?.overdue_findings_count ?? null}
          unit=""
          note="Corrective action past due, still open. Target: 0"
          tone={kpis == null ? "neutral" : kpis.overdue_findings_count === 0 ? "good" : "bad"}
          info={
            <MetricFormulaInfo
              title="Overdue Findings"
              currentValue={kpis?.overdue_findings_count != null ? String(kpis.overdue_findings_count) : "N/A"}
              definition="The count of findings that are still open (not in a closed status) and whose corrective action due date has already passed."
              formula="Count of findings where status is not closed AND corrective_action_due < today"
              note="Target: 0."
            />
          }
        />
      </div>

      {error && <Banner tone="danger" title="Something went wrong" icon={<TriangleAlert className="h-4 w-4" />}>{error}</Banner>}

      {stopped.length > 0 && (
        <Banner tone="danger" title={`${stopped.length} audit(s) stopped — critical finding on site`} icon={<Hand className="h-4 w-4" />}>
          Work may be suspended. The Safety Manager and the executive were notified on their phones the moment the
          item scored zero.
        </Banner>
      )}

      {unassigned > 0 && (
        <Banner tone="warn" title={`${unassigned} audit(s) have no auditor`} icon={<UserCheck className="h-4 w-4" />}>
          An audit cannot progress past step 02 until someone independent of the area being audited is
          named. That independence is what makes the finding credible.
        </Banner>
      )}

      <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
        <CardHeader className="gap-3 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-[13px]"
                placeholder="Search by site, reference or type"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {FILTERS.map((f) => {
              const n = audits.filter(f.test).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${
                    filter === f.key
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {f.label} ({n})
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : visible.length === 0 ? (
            <EmptyState title="No audits in this view" hint={query ? "Nothing matches that search." : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5 font-semibold">Audit</th>
                    <th className="px-4 py-2.5 font-semibold">Band</th>
                    <th className="px-4 py-2.5 font-semibold">Scheduled</th>
                    <th className="px-4 py-2.5 font-semibold">Progress</th>
                    <th className="px-4 py-2.5 font-semibold">Waiting on</th>
                    <th className="px-4 py-2.5 font-semibold">Result</th>
                    <th className="px-4 py-2.5 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((a) => {
                    const step = currentStep(a);
                    const isStopped = a.status === "immediate_action";
                    return (
                      <tr
                        key={a.id}
                        className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ${isStopped ? "bg-red-50/40" : ""}`}
                        onClick={() => navigate(`/audits/${a.id}`)}
                      >
                        <td className="px-4 py-3">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            {a.audit_ref} · {a.trigger_label ?? "Scheduled"}
                            {a.generated_by_programme && " · auto"}
                          </p>
                          <p className="mt-0.5 max-w-[280px] truncate text-[13px] font-semibold text-slate-900">{a.title}</p>
                          <p className="text-[11px] text-slate-500">{a.site_name ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3"><RiskBandChip value={a.risk_band} small /></td>
                        <td className="px-4 py-3 text-[12px] text-slate-600">{formatDate(a.scheduled_date)}</td>
                        <td className="px-4 py-3"><StepStrip steps={a.steps} compact /></td>
                        <td className="px-4 py-3">
                          {isStopped ? (
                            <span className="text-[11.5px] font-bold text-red-700">Stopped — contain the unsafe act</span>
                          ) : step ? (
                            <>
                              <p className="text-[11.5px] font-semibold text-slate-800">
                                {String(step.number).padStart(2, "0")} {step.label}
                              </p>
                              <p className="text-[10px] text-slate-400">{step.owner_label ?? step.owner}</p>
                            </>
                          ) : (
                            <span className="text-[11.5px] font-semibold text-emerald-700">Closed {formatDate(a.closed_at)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBadge score={a.compliance_score} band={a.score_band} />
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <RatingChip value={a.overall_rating} />
                          </div>
                          <div className="mt-1"><FindingCounts counts={a.finding_counts} /></div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!a.auditor_id && !a.closed_at && (
                            <Button
                              size="sm" variant="outline"
                              onClick={(e) => { e.stopPropagation(); setAssigning(a); }}
                            >
                              Assign
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {assigning && (
        <AssignDialog
          audit={assigning}
          auditors={auditors}
          busy={busy}
          onClose={() => setAssigning(null)}
          onAssign={async (auditorId, auditeeId) => {
            setBusy(true);
            setError(null);
            try {
              await assignTeam(assigning.id, {
                lead_auditor_id: auditorId,
                auditee_manager_id: auditeeId || undefined,
              });
              setAssigning(null);
              await load();
            } catch (e) {
              setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not assign.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {scheduling && (
        <ScheduleDialog
          reference={reference}
          auditors={auditors}
          templates={templates}
          busy={busy}
          onClose={() => setScheduling(false)}
          onSchedule={async (payload) => {
            setBusy(true);
            setError(null);
            try {
              await scheduleAudit(payload);
              setScheduling(false);
              await load();
            } catch (e) {
              setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not schedule.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-1 text-[12px] text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AssignDialog({
  audit, auditors, busy, onClose, onAssign,
}: {
  audit: Audit;
  auditors: AuditorRegisterRow[];
  busy: boolean;
  onClose: () => void;
  onAssign: (auditorId: number, auditeeId: number) => void;
}) {
  const [auditorId, setAuditorId] = useState<number>(0);
  const [auditeeId, setAuditeeId] = useState<string>("");

  return (
    <Modal
      title="Assign the auditor"
      subtitle={`${audit.audit_ref} — ${audit.site_name ?? "site"}`}
      onClose={onClose}
    >
      <Banner tone="info" title="Independence is the point">
        The auditor must be independent of the area being audited. An auditor who supervises that area
        is refused, not warned — a finding nobody believes is worth less than no finding.
      </Banner>

      <div className="mt-4 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Auditor</p>
        {auditors.length === 0 && (
          <p className="text-[12px] text-amber-700">
            No users hold the auditor role in this organisation yet.
          </p>
        )}
        {auditors.map((a) => (
          <button
            key={a.user_id}
            onClick={() => setAuditorId(a.user_id)}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
              auditorId === a.user_id ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-slate-900">{a.name ?? `User ${a.user_id}`}</p>
              <p className="text-[11px] text-slate-500">
                {a.audits_open} open · {a.audits_closed} closed
                {a.average_score != null && ` · avg ${a.average_score}%`}
              </p>
            </div>
            {a.expired_qualifications > 0 && (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                {a.expired_qualifications} EXPIRED
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Supervisor of the area (auditee)
        </p>
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
          placeholder="Employee id — they get two weeks' notice"
          value={auditeeId}
          onChange={(e) => setAuditeeId(e.target.value.replace(/\D/g, ""))}
        />
        <p className="mt-1 text-[11px] text-slate-400">
          The auditee is notified at least {14} days in advance, except for unannounced inspections,
          which carry no notice by design.
        </p>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          disabled={!auditorId || busy}
          onClick={() => onAssign(auditorId, Number(auditeeId) || 0)}
        >
          {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Assign
        </Button>
      </div>
    </Modal>
  );
}

/** The literal the "type it in" option carries — never a real checklist type. */
const CUSTOM_TYPE = "__custom__";

/**
 * What the checklist-type dropdown offers, best source first.
 *
 * The type is not a label: `audit_templates.resolve` matches it against the
 * organisation's templates to decide which questions seed the audit, so a typo
 * in a free-text box silently fell through to the generic six-item fallback and
 * the auditor arrived on site with the wrong checklist. The maintained
 * templates lead; the built-ins fill in behind them for an organisation that has
 * not seeded any yet; free text stays available because resolve() matches on a
 * substring and a bespoke type is still a legitimate thing to schedule.
 */
function checklistTypeOptions(
  templates: Template[],
  reference: AuditReference | null,
): Array<{ value: string; label: string; hint?: string }> {
  const seen = new Set<string>();
  const out: Array<{ value: string; label: string; hint?: string }> = [];

  for (const t of templates) {
    const type = (t.checklist_type ?? "").trim();
    if (!type) continue;
    const key = type.toLowerCase();
    // getTemplates returns each type's versions newest-first, so the first one
    // seen is the version an audit scheduled today would actually run.
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      value: type,
      label: type,
      hint: `${t.items.length} question${t.items.length === 1 ? "" : "s"} · v${t.version}${t.is_default ? " · default" : ""}`,
    });
  }

  for (const b of reference?.checklist_types ?? []) {
    if (seen.has(b.key.toLowerCase())) continue;
    seen.add(b.key.toLowerCase());
    out.push({ value: b.key, label: b.label, hint: "built-in checklist" });
  }

  return out;
}

function ScheduleDialog({
  reference, auditors, templates, busy, onClose, onSchedule,
}: {
  reference: AuditReference | null;
  auditors: AuditorRegisterRow[];
  templates: Template[];
  busy: boolean;
  onClose: () => void;
  onSchedule: (p: Parameters<typeof scheduleAudit>[0]) => void;
}) {
  const [title, setTitle] = useState("");
  const [checklistType, setChecklistType] = useState("");
  const [customType, setCustomType] = useState("");
  const options = useMemo(() => checklistTypeOptions(templates, reference), [templates, reference]);
  const chosenType = checklistType === CUSTOM_TYPE ? customType.trim() : checklistType;
  const chosenOption = options.find((o) => o.value === checklistType);
  const [siteName, setSiteName] = useState("");
  const [siteId, setSiteId] = useState("");
  const [trigger, setTrigger] = useState("scheduled_programme");
  const [scheduled, setScheduled] = useState("");
  const [auditorId, setAuditorId] = useState("");

  const chosen = reference?.triggers?.find((t) => t.key === trigger);

  return (
    <Modal
      title="Schedule an audit"
      subtitle="Outside the generated programme — one of the six things that starts an audit."
      onClose={onClose}
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">What starts it</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(reference?.triggers ?? []).map((t) => (
              <button
                key={t.key}
                onClick={() => setTrigger(t.key)}
                className={`rounded-xl border p-2.5 text-left ${
                  trigger === t.key ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <p className="text-[12px] font-semibold text-slate-900">{t.label}</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">{t.detail}</p>
              </button>
            ))}
          </div>
          {chosen && !chosen.requires_notice && (
            <p className="mt-2 text-[11px] text-amber-700">
              Unannounced — this trigger carries no notice period by design, so the supervisor is not
              told in advance.
            </p>
          )}
        </div>

        <Field label="Title">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                 value={title} onChange={(e) => setTitle(e.target.value)}
                 placeholder="e.g. Q3 Fire Safety Audit — Nacelle Line" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Checklist type">
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
              value={checklistType}
              onChange={(e) => setChecklistType(e.target.value)}
            >
              <option value="">Default checklist</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.hint ? `${o.label} — ${o.hint}` : o.label}
                </option>
              ))}
              <option value={CUSTOM_TYPE}>Other — type it in</option>
            </select>
            {checklistType === CUSTOM_TYPE && (
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="e.g. Working at Height"
                autoFocus
              />
            )}
            <p className="mt-1 text-[10.5px] leading-snug text-slate-500">
              {checklistType === CUSTOM_TYPE
                ? "Matched against the maintained templates; the closest one seeds the questions, or the built-in list does."
                : chosenOption?.hint === "built-in checklist"
                  ? "No maintained template covers this type yet — the built-in questions will be used."
                  : chosenOption
                    ? "The auditor gets this template's questions."
                    : "The organisation's default template, or the generic site inspection where none is set."}
            </p>
          </Field>
          <Field label="Scheduled date">
            <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                   value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
          </Field>
          <Field label="Site name">
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                   value={siteName} onChange={(e) => setSiteName(e.target.value)} />
          </Field>
          <Field label="Site id">
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                   value={siteId} onChange={(e) => setSiteId(e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
        <Field label="Auditor (optional — can be assigned later)">
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
            value={auditorId}
            onChange={(e) => setAuditorId(e.target.value)}
          >
            <option value="">Not yet assigned</option>
            {auditors.map((a) => (
              <option key={a.user_id} value={a.user_id}>{a.name ?? `User ${a.user_id}`}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          disabled={!title.trim() || busy || (checklistType === CUSTOM_TYPE && !customType.trim())}
          onClick={() => onSchedule({
            title: title.trim(),
            checklist_type: chosenType || undefined,
            site_name: siteName.trim() || undefined,
            site_id: siteId ? Number(siteId) : undefined,
            trigger_type: trigger,
            scheduled_date: scheduled ? new Date(scheduled).toISOString() : undefined,
            auditor_id: auditorId ? Number(auditorId) : undefined,
          })}
        >
          {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Schedule
        </Button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      {children}
    </div>
  );
}

export default AuditRegisterPage;
