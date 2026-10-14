/**
 * Read-only CAPA detail — the destination a "CAPA-000123 is overdue"
 * notification deep-links to (see notifications.service.ts's
 * resolveNotificationLink). Before this page existed the notification bell
 * could only send the reader to the generic /capa-actions list, which is
 * exactly the "clicked it and it didn't open" gap raised in the client
 * review: /capa/{id} already returned everything needed, nothing rendered it.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { getCapaDetail, type CapaDetail } from "../../services/capa.service";
import { Badge } from "../components/ui/badge";

function statusTone(status: string | null): { background: string; color: string } {
  const s = (status || "").toLowerCase();
  if (s === "overdue") return { background: "#FEF2F2", color: "#B91C1C" };
  if (s === "completed" || s === "closed") return { background: "#F0FDF4", color: "#15803D" };
  if (s === "in progress") return { background: "#EFF6FF", color: "#1D4ED8" };
  return { background: "#F1F5F9", color: "#475569" };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No date set";
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function CapaDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const capaId = Number(id);

  const [detail, setDetail] = useState<CapaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(capaId) || capaId <= 0) { setNotFound(true); setLoading(false); return; }
    setLoading(true);
    getCapaDetail(capaId)
      .then((d) => { setDetail(d); setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [capaId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-[14px]" style={{ color: "#9CA3AF" }}>
        Loading action detail…
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <AlertTriangle className="w-10 h-10" style={{ color: "#F59E0B" }} />
        <p className="text-[15px]" style={{ color: "#0A0A0A", fontWeight: 500 }}>Action not found</p>
        <button onClick={() => navigate("/capa-actions")} className="text-[13px]" style={{ color: "#2E7D32" }}>
          ← Back to Actions
        </button>
      </div>
    );
  }

  const tone = statusTone(detail.status);

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate("/capa-actions")} className="flex items-center gap-1 text-[13px]" style={{ color: "#2E7D32", fontWeight: 500 }}>
        <ArrowLeft className="w-4 h-4" /> Back to Actions
      </button>

      <div className="rounded-2xl border bg-white p-6" style={{ borderColor: "#D9E4F6", boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 style={{ fontSize: "clamp(1.25rem, 2.2vw, 1.6rem)", color: "#111827", fontWeight: 700 }}>
                {detail.capa_ref ?? `CAPA-${String(detail.id).padStart(6, "0")}`}
              </h1>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={tone}>
                {detail.status ?? "Unknown"}
              </span>
              {detail.is_overdue && (
                <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
                  Overdue
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
              {detail.step_label ?? "—"}{detail.total_steps ? ` · step of ${detail.total_steps}` : ""}
            </p>
          </div>
          {detail.priority_band && (
            <Badge variant="outline" className="text-[11px]">{detail.priority_band} priority</Badge>
          )}
        </div>

        {detail.incident_id && (
          <button
            onClick={() => navigate(`/violations/INC-${String(detail.incident_id).padStart(5, "0")}`)}
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold hover:underline"
            style={{ color: "#4A57B9" }}
          >
            Raised from INC-{String(detail.incident_id).padStart(5, "0")} <ExternalLink className="h-3 w-3" />
          </button>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Assignee" value={detail.responsible_person_name ?? "Unassigned"} />
          <Field label="Due date" value={formatDate(detail.due_date)} />
          <Field label="Action type" value={detail.action_type ?? detail.capa_type_label ?? "—"} />
          <Field label="Category" value={detail.action_category ?? "—"} />
          <Field label="Escalation level" value={detail.escalation_level != null ? String(detail.escalation_level) : "0"} />
          {detail.reopened_count != null && detail.reopened_count > 0 && (
            <Field label="Reopened" value={`${detail.reopened_count} time${detail.reopened_count === 1 ? "" : "s"}`} />
          )}
        </div>

        {detail.description && (
          <Section title="Description" text={detail.description} />
        )}
        {detail.action_plan && (
          <Section title="Action plan" text={detail.action_plan} />
        )}
        {detail.success_criteria && (
          <Section title="Success criteria" text={detail.success_criteria} />
        )}
        {detail.priority_explanation && (
          <Section title="Why this priority" text={detail.priority_explanation} />
        )}
        {detail.lesson_learned && (
          <Section title="Lesson learned" text={detail.lesson_learned} />
        )}

        {detail.next_action && (
          <div className="mt-5 rounded-xl border p-3 text-[13px]" style={{ borderColor: "#E3EAF8", background: "#F8FBFF", color: "#374151" }}>
            <span className="font-semibold" style={{ color: "#4A57B9" }}>Next: </span>{detail.next_action}
          </div>
        )}

        {detail.closure_checks.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-wide" style={{ color: "#64748B" }}>Closure checks</div>
            <div className="space-y-1.5">
              {detail.closure_checks.map((check) => (
                <div key={check.key} className="flex items-start gap-2 text-[13px]" style={{ color: "#374151" }}>
                  {check.passed
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#15803D" }} />
                    : <Circle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#CBD5E1" }} />}
                  <span>
                    <span style={{ fontWeight: 600 }}>{check.label}</span>
                    {check.detail && <span style={{ color: "#6B7280" }}> — {check.detail}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#94A3B8" }}>{label}</div>
      <div className="mt-0.5 text-[13.5px]" style={{ color: "#111827" }}>{value}</div>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-5">
      <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wide" style={{ color: "#64748B" }}>{title}</div>
      <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: "#374151" }}>{text}</p>
    </div>
  );
}
