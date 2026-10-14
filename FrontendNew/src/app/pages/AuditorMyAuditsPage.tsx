/**
 * The Auditor's landing page: every audit assigned to them, newest due first.
 * GET /audits/ already scopes this server-side to Audit.auditor_id === the
 * caller (audit.py:490-491) — no client-side filtering needed.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { CalendarClock, Loader2, TriangleAlert } from "lucide-react";
import { formatDate, getAudits, humanise, type Audit } from "../../services/audits.service";
import { Banner, EmptyState, RiskBandChip, ScoreBadge, StepStrip } from "../components/audit/AuditPrimitives";
import { Card, CardContent } from "../components/ui/card";

export function AuditorMyAuditsPage() {
  const navigate = useNavigate();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setAudits(await getAudits());
    } catch (e) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not load your audits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const open = audits.filter((a) => !a.closed_at);
  const closed = audits.filter((a) => a.closed_at);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[19px] font-bold" style={{ color: "#0F172A" }}>My Audits</h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "#64748B" }}>
          Audits assigned to you. Conduct — opening meeting through issuing the report — happens on the
          EHSERA Intelligence mobile app; this view is for tracking status and reading the finished report.
        </p>
      </div>

      {error && <Banner tone="danger" title="Something went wrong" icon={<TriangleAlert className="h-4 w-4" />}>{error}</Banner>}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : audits.length === 0 ? (
        <Card className="border-none shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
          <CardContent className="p-0">
            <EmptyState title="No audits assigned yet" hint="Once your organisation's Admin assigns you an audit, it will appear here." />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <AuditGroup title={`Open (${open.length})`} audits={open} onOpen={(id) => navigate(`/auditor/audits/${id}`)} />
          )}
          {closed.length > 0 && (
            <AuditGroup title={`Closed (${closed.length})`} audits={closed} onOpen={(id) => navigate(`/auditor/audits/${id}`)} />
          )}
        </div>
      )}
    </div>
  );
}

function AuditGroup({ title, audits, onOpen }: { title: string; audits: Audit[]; onOpen: (id: number) => void }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "#94A3B8" }}>{title}</p>
      <div className="space-y-2.5">
        {audits.map((a) => (
          <Card
            key={a.id}
            className="cursor-pointer border-none shadow-[0_6px_16px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_10px_24px_rgba(15,23,42,0.1)]"
            onClick={() => onOpen(a.id)}
          >
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {a.audit_ref ?? `AUD-${String(a.id).padStart(6, "0")}`} · {humanise(a.audit_scope)}
                </p>
                <p className="truncate text-[14px] font-semibold text-slate-900">{a.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-slate-500">
                  {a.site_name ?? "—"}{a.department && ` · ${a.department}`}
                  {a.due_date && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" /> Due {formatDate(a.due_date)}
                    </span>
                  )}
                </p>
              </div>
              <div className="hidden shrink-0 lg:block">
                <StepStrip steps={a.steps} compact />
              </div>
              <div className="shrink-0 text-right">
                {a.report_issued_at ? <ScoreBadge score={a.compliance_score} band={a.score_band} /> : (
                  <span className="text-[11.5px] font-semibold text-slate-500">{a.current_step_label ?? "Not started"}</span>
                )}
              </div>
              <RiskBandChip value={a.risk_band} small />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
