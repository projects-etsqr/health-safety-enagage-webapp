/**
 * WF-05 step 09 · report review, approval and distribution.
 *
 * "The full report — scores, findings, benchmark comparison, standard clause
 * mapping — is reviewed and distributed from the desktop, where a long document
 * is genuinely easier to work with."
 *
 * Nothing on this page conducts an audit. The auditor already signed it on the
 * phone; what happens here is reading it, approving it for wider distribution
 * and releasing it beyond the site — both the Admin's — and deciding
 * on a re-audit when one has been triggered.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft, CheckCircle2, FileText, Hand, Loader2, Lock, Printer, Repeat,
  Send, ShieldCheck, TriangleAlert,
} from "lucide-react";
import {
  approveReport, closeAudit, decideReAudit, distributeReport, formatDate, getAudit,
  getAuditReport, humanise, CLASSIFICATION_META, BAND_META,
  type Audit, type AuditReport, type Evidence,
} from "../../services/audits.service";
import {
  Banner, ClassificationChip, EmptyState, KeyValue, RatingChip, RiskBandChip,
  SectionBar, StepStrip,
} from "../components/audit/AuditPrimitives";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../context/AuthContext";

/**
 * Evidence stored as a server path (/uploads/audit/<uuid>.jpg), never a full
 * URL, so it survives the host changing. The files are mounted at the backend
 * root, outside the /api/v1 prefix — in dev the Vite proxy forwards /uploads,
 * in production the console and the API are served from the same origin.
 */
function mediaSrc(fileUrl?: string | null): string | undefined {
  if (!fileUrl) return undefined;
  if (/^(https?:|data:|blob:)/.test(fileUrl)) return fileUrl;
  return fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
}

const EVIDENCE_LABEL: Record<string, string> = {
  photo: "Photo", video: "Video", document: "Document",
  note: "Note", scan: "Reference", interview: "Interview",
};

/**
 * What the auditor captured on the walk.
 *
 * The report carried a count — "3 evidence" on a finding — and nothing else, so
 * the photographs and videos taken to prove a control existed only on the phone
 * that took them. The person reviewing the report is the one who most needs to
 * see them.
 */
function EvidenceGallery({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return null;
  const media = evidence.filter((e) => e.file_url && (e.kind === "photo" || e.kind === "video"));
  const written = evidence.filter((e) => !media.includes(e));

  return (
    <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px]">Evidence from the walk ({evidence.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {media.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {media.map((e) => (
              <figure key={e.id} className="overflow-hidden rounded-xl border border-slate-200">
                {e.kind === "video" ? (
                  <video
                    src={mediaSrc(e.file_url)}
                    controls
                    preload="metadata"
                    className="h-32 w-full bg-slate-900 object-cover"
                  />
                ) : (
                  <a href={mediaSrc(e.file_url)} target="_blank" rel="noreferrer">
                    <img
                      src={mediaSrc(e.file_url)}
                      alt={e.caption ?? "Audit evidence"}
                      className="h-32 w-full object-cover"
                      loading="lazy"
                    />
                  </a>
                )}
                <figcaption className="space-y-0.5 px-2 py-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    {EVIDENCE_LABEL[e.kind] ?? e.kind}
                    {e.gps_latitude != null && " · GPS"}
                  </p>
                  {e.caption && (
                    <p className="truncate text-[11px] text-slate-600" title={e.caption}>{e.caption}</p>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {written.length > 0 && (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {written.map((e) => (
              <div key={e.id} className="px-3 py-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {EVIDENCE_LABEL[e.kind] ?? e.kind}
                  {e.subject_name && ` · ${e.subject_name}`}
                  {e.scanned_ref && ` · ${e.scanned_ref}`}
                </p>
                {/* An interview is a question and an answer, and the answer is
                    not interpretable without the question. "Pulled the breaker,
                    no lock, no tag" means nothing until you know they were asked
                    to demonstrate isolation. */}
                {e.interview_prompt && (
                  <p className="mt-0.5 text-[12px] italic text-slate-500">
                    Asked: {e.interview_prompt}
                  </p>
                )}
                <p className="mt-0.5 text-[12px] text-slate-700">
                  {e.caption ?? (e.interview_prompt ? null : "—")}
                </p>
                {e.competence_verified != null && (
                  <p
                    className="mt-0.5 text-[11px] font-semibold"
                    style={{ color: e.competence_verified ? "#15803D" : "#BE123C" }}
                  >
                    Competence {e.competence_verified ? "verified against the matrix" : "NOT verified"}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** The two signatures taken on site, drawn on the auditor's phone. */
function Signatures({ audit }: { audit: Audit }) {
  const rows = [
    { label: "Auditor", name: audit.auditor_signed_name, sig: audit.auditor_signature, at: audit.report_issued_at },
    { label: "Auditee — factual accuracy", name: audit.auditee_signed_name, sig: audit.auditee_signature, at: audit.auditee_confirmed_at },
  ].filter((r) => r.sig || r.name);

  if (!rows.length) return null;

  return (
    <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px]">Signatures</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{r.label}</p>
            {r.sig ? (
              <img
                src={r.sig}
                alt={`${r.label} signature`}
                className="mt-1 h-20 w-full rounded-lg border border-slate-200 bg-white object-contain"
              />
            ) : (
              <p className="mt-1 rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] text-slate-400">
                Signed by name only — no drawn signature was captured
              </p>
            )}
            <p className="mt-1 text-[12px] font-semibold text-slate-800">{r.name ?? "—"}</p>
            <p className="text-[11px] text-slate-500">{formatDate(r.at)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Shared by two routes: /audits/:id (Admin — reviews, approves, distributes,
 * decides re-audits, closes) and /auditor/audits/:id (the assigned Auditor —
 * read-only; those four actions are the Admin's per WF-05 step 09/10, see the
 * page-top docstring). isAdmin below is the only branch point between them.
 */
export function AuditDetailPage() {
  const { id } = useParams();
  const auditId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const basePath = isAdmin ? "/audits" : "/auditor/audits";
  const listPath = isAdmin ? "/audits" : "/auditor";

  const [audit, setAudit] = useState<Audit | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [reAuditNote, setReAuditNote] = useState("");
  const [reAuditDate, setReAuditDate] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const a = await getAudit(auditId);
      setAudit(a);
      setReport(await getAuditReport(auditId).catch(() => null));
    } catch (e) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not load this audit.");
    } finally {
      setLoading(false);
      setBusy(null);
    }
  }, [auditId]);

  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "That did not work.");
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }
  if (!audit) {
    return (
      <div className="p-6">
        <Banner tone="danger" title="Audit unavailable" icon={<TriangleAlert className="h-4 w-4" />}>{error}</Banner>
      </div>
    );
  }

  const issued = !!audit.report_issued_at;
  const approved = !!audit.report_approved_at;
  const distributed = !!audit.distributed_beyond_site_at;
  const band = BAND_META[audit.score_band ?? "poor"];
  const delta = report?.benchmark?.delta;

  return (
    <div className="space-y-5 p-6 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(listPath)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {audit.audit_ref} · {audit.trigger_label ?? "Scheduled"} · {humanise(audit.audit_scope)}
            </p>
            <h1 className="text-[21px] font-bold text-slate-900">{audit.title}</h1>
            <p className="mt-0.5 text-[13px] text-slate-500">
              {audit.site_name ?? "—"}
              {audit.department && ` · ${audit.department}`}
              {" · conducted "}{formatDate(report?.conducted_on ?? audit.submitted_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <RiskBandChip value={audit.risk_band} />
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      {error && <Banner tone="danger" title="Something went wrong" icon={<TriangleAlert className="h-4 w-4" />}>{error}</Banner>}

      {audit.status === "immediate_action" && (
        <Banner tone="danger" title="Stopped — critical finding on site" icon={<Hand className="h-4 w-4" />}>
          Work may be suspended. The auditor contains the hazard and resumes the walk from the phone.
        </Banner>
      )}

      {!issued && (
        <Banner tone="info" title="No report yet" icon={<FileText className="h-4 w-4" />}>
          The report is signed and issued by the auditor on the phone, before they leave site. Nothing
          can be reviewed or distributed until then — the signature is what creates the corrective
          actions.
        </Banner>
      )}

      {/* The ten steps */}
      <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px]">
            Step {String(audit.current_step ?? 10).padStart(2, "0")} · {audit.current_step_label ?? "Closed"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StepStrip steps={audit.steps} />
        </CardContent>
      </Card>

      {issued && report && (
        <>
          {/* Headline */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
              <CardContent className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Score</p>
                <p className="mt-1 text-4xl font-bold" style={{ color: band.color }}>
                  {Math.round(report.score.score)}%
                </p>
                <p className="text-[12px] font-semibold" style={{ color: band.color }}>{report.score.band_label}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{report.score.explanation}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
              <CardContent className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Overall rating</p>
                <div className="mt-2"><RatingChip value={report.score.overall_rating} /></div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  Set from the finding counts, not the percentage. Any Major non-conformance or
                  regulatory breach makes an audit unsatisfactory whatever it scored.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(Object.keys(CLASSIFICATION_META) as Array<keyof typeof CLASSIFICATION_META>).map((k) => {
                    const n = report.score.counts?.[k] ?? 0;
                    if (!n) return null;
                    const m = CLASSIFICATION_META[k];
                    return (
                      <span key={k} className="rounded-md px-2 py-1 text-[10px] font-bold"
                            style={{ background: m.bg, color: m.color }}>
                        {n} {m.short}
                      </span>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
              <CardContent className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Benchmark against last time
                </p>
                {report.benchmark.previous_audit_ref ? (
                  <>
                    <p className="mt-1 text-3xl font-bold"
                       style={{ color: (delta ?? 0) >= 0 ? "#047857" : "#B91C1C" }}>
                      {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}
                      <span className="ml-1 text-[13px] font-semibold">pts</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      vs {report.benchmark.previous_score}% on {report.benchmark.previous_audit_ref}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[12px] text-slate-500">
                    No previous audit at this site — this one is the baseline.
                  </p>
                )}
                {report.benchmark.repeat_findings > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-700">
                    <Repeat className="h-3.5 w-3.5" />
                    {report.benchmark.repeat_findings} repeat finding(s)
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Re-audit */}
          {audit.re_audit_required && (
            <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]" style={{ background: "#FFFBFB" }}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-[15px] text-red-700">
                  <Repeat className="h-4 w-4" /> Re-audit triggered
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[12.5px] text-slate-700">
                  {audit.re_audit_reason} Due {formatDate(audit.re_audit_due_date)}.
                </p>
                {audit.re_audit_decision ? (
                  <Banner tone={audit.re_audit_decision === "waived" ? "warn" : "ok"}
                          title={`Decision: ${humanise(audit.re_audit_decision)}`}>
                    {audit.re_audit_decision_note}
                    {audit.re_audit_audit_id && (
                      <>
                        {" "}
                        <button className="font-semibold underline"
                                onClick={() => navigate(`${basePath}/${audit.re_audit_audit_id}`)}>
                          View the re-audit
                        </button>
                      </>
                    )}
                  </Banner>
                ) : isAdmin ? (
                  <>
                    <p className="text-[11.5px] text-slate-500">
                      The trigger fires on its own; the decision is the Admin's. Waiving a
                      mandatory re-audit requires a reason on the record.
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</p>
                        <input type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                               value={reAuditDate} onChange={(e) => setReAuditDate(e.target.value)} />
                      </div>
                      <input
                        className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                        placeholder="Reason / note"
                        value={reAuditNote} onChange={(e) => setReAuditNote(e.target.value)}
                      />
                      <Button size="sm" disabled={!!busy || !reAuditDate}
                              onClick={() => act("re-sched", () => decideReAudit(auditId, {
                                decision: "scheduled",
                                scheduled_date: new Date(reAuditDate).toISOString(),
                                note: reAuditNote || undefined,
                              }))}>
                        Schedule the re-audit
                      </Button>
                      <Button variant="outline" size="sm" disabled={!!busy || !reAuditNote.trim()}
                              onClick={() => act("re-waive", () => decideReAudit(auditId, {
                                decision: "waived", note: reAuditNote,
                              }))}>
                        Waive with reason
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-[11.5px] text-slate-500">
                    Waiting on your Admin to schedule or waive the re-audit.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Review & distribute */}
          <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)] print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-[15px]">Review &amp; distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatusPill ok label="Signed by the auditor" detail={audit.auditor_signed_name ?? "—"} />
                <StatusPill ok={approved} label="Reviewed &amp; approved"
                            detail={approved ? formatDate(audit.report_approved_at) : "Pending"} />
                <StatusPill ok={distributed} label="Distributed beyond site"
                            detail={distributed ? humanise(audit.distribution_scope) : "Not released"} />
              </div>

              {isAdmin && !approved && (
                <div className="flex flex-wrap items-end gap-2">
                  <input
                    className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                    placeholder="Approval note (optional)"
                    value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)}
                  />
                  <Button size="sm" disabled={!!busy}
                          onClick={() => act("approve", () => approveReport(auditId, { approved: true, notes: approvalNote || undefined }))}>
                    {busy === "approve" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
                    Approve for wider distribution
                  </Button>
                </div>
              )}

              {isAdmin && approved && !distributed && (
                <Button size="sm" disabled={!!busy}
                        onClick={() => act("distribute", () => distributeReport(auditId, { scope: "organisation" }))}>
                  {busy === "distribute" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                  Distribute across the organisation
                </Button>
              )}

              {isAdmin && !approved && (
                <p className="text-[11.5px] text-slate-500">
                  Distribution beyond the site is refused until the report has been reviewed and approved —
                  otherwise the review is decorative.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Sections */}
          {report.score.sections?.length > 0 && (
            <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
              <CardHeader className="pb-1">
                <CardTitle className="text-[15px]">Section scores</CardTitle>
              </CardHeader>
              <CardContent>
                {report.score.sections.map((s) => <SectionBar key={s.section} section={s} />)}
                <p className="mt-2 text-[11px] text-slate-500">
                  A section below 60% raises a Minor non-conformance of its own — a section falling
                  below the threshold is a lapse in the system, not in one item.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Findings */}
          <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-[15px]">Findings ({report.findings.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {report.findings.length === 0 ? (
                <EmptyState title="No findings recorded" />
              ) : (
                <div className="divide-y divide-slate-100">
                  {report.findings.map((f) => (
                    <div key={f.id} className="flex gap-4 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          {f.finding_ref} · {f.section ?? "General"}
                          {f.clause && ` · ${f.clause}`}
                          {f.auto_classified && " · auto"}
                        </p>
                        <p className="mt-0.5 text-[13px] font-semibold text-slate-900">{f.title}</p>
                        {f.description && <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{f.description}</p>}
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          {f.corrective_action_due ? `Action due ${formatDate(f.corrective_action_due)}` : "No action required"}
                          {f.capa_id && ` · CAPA raised`}
                          {` · ${humanise(f.status)}`}
                          {f.evidence?.length ? ` · ${f.evidence.length} evidence` : ""}
                        </p>
                        {f.verification_notes && (
                          <p className="mt-1 text-[11px] italic text-slate-500">
                            Verification: {f.verification_notes}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <ClassificationChip value={f.classification} repeat={f.is_repeat} small />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* What was captured on site: the media first, then who signed for it. */}
          <EvidenceGallery evidence={report.evidence ?? []} />

          <Signatures audit={audit} />

          {/* Clause mapping */}
          {report.clause_map?.length > 0 && (
            <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px]">Standard clause mapping</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {report.clause_map.map((c) => (
                    <div key={c.clause} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">{c.clause}</span>
                      <span className="flex-1 text-[12px] text-slate-600">
                        {c.findings} finding{c.findings === 1 ? "" : "s"}
                      </span>
                      <ClassificationChip value={c.worst} small />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* The record */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
          <CardHeader className="pb-1"><CardTitle className="text-[15px]">The record</CardTitle></CardHeader>
          <CardContent>
            <KeyValue k="Reference" v={audit.audit_ref ?? "—"} />
            <KeyValue k="Trigger" v={audit.trigger_label ?? "—"} />
            <KeyValue k="Auditee notified" v={formatDate(audit.auditee_notified_at)} />
            <KeyValue k="Brief reviewed" v={formatDate(audit.brief_pack_reviewed_at)} />
            <KeyValue k="Opening meeting" v={formatDate(audit.opening_meeting_at)} />
            <KeyValue k="Closing meeting" v={formatDate(audit.closing_meeting_at)} />
            <KeyValue
              k="Factual accuracy"
              v={audit.auditee_confirmed_at
                ? `Confirmed by ${audit.auditee_signed_name ?? "the supervisor"}`
                : "Not confirmed"}
            />
            <KeyValue
              k="Findings locked"
              v={audit.findings_locked
                ? <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />{formatDate(audit.findings_locked_at)}</span>
                : "Open to change"}
            />
            <KeyValue k="Report" v={audit.report_ref ? `${audit.report_ref} · ${formatDate(audit.report_issued_at)}` : "Not issued"} />
            <KeyValue k="Open findings" v={audit.open_finding_count} />
          </CardContent>
        </Card>

        {audit.opening_meeting && (
          <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <CardHeader className="pb-1"><CardTitle className="text-[15px]">Scope, as agreed</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-[12.5px]">
              {(["scope", "method", "sampling_approach"] as const).map((k) => (
                <div key={k}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {k.replace(/_/g, " ")}
                  </p>
                  <p className="mt-0.5 leading-relaxed text-slate-700">
                    {String((audit.opening_meeting as Record<string, unknown>)[k] ?? "—")}
                  </p>
                </div>
              ))}
              <p className="text-[11px] text-slate-400">
                Agreed jointly at the opening meeting, so there is no dispute afterwards about what was
                in or out of scope.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Close-out */}
      {issued && !audit.closed_at && (
        <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)] print:hidden">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-[13px] font-semibold text-slate-900">
                {audit.open_finding_count > 0
                  ? `${audit.open_finding_count} finding(s) still to be verified`
                  : "Every finding has been verified effective"}
              </p>
              <p className="mt-0.5 text-[11.5px] text-slate-500">
                An audit is not closed when the report is issued — it stays open until every corrective
                action it raised has been verified effective on site.
              </p>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                disabled={!!busy || audit.open_finding_count > 0}
                onClick={() => act("close", () => closeAudit(auditId))}
              >
                {busy === "close" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                Close the audit
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {audit.closed_at && (
        <Banner tone="ok" title={`Closed ${formatDate(audit.closed_at)}`} icon={<Lock className="h-4 w-4" />}>
          Every corrective action this audit raised was verified effective.
        </Banner>
      )}
    </div>
  );
}

function StatusPill({ ok, label, detail }: { ok?: boolean; label: string; detail: string }) {
  return (
    <div className="rounded-xl border p-3"
         style={{ borderColor: ok ? "#A7F3D0" : "#E2E8F0", background: ok ? "#F0FDF9" : "#FFFFFF" }}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-[12.5px] font-semibold" style={{ color: ok ? "#047857" : "#64748B" }}>{detail}</p>
    </div>
  );
}

export default AuditDetailPage;
