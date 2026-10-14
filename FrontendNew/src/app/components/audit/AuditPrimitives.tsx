/**
 * WF-05 shared web UI.
 *
 * The rubric's vocabulary rendered once. A Major NC has to look identical on the
 * register, the report and the trends screen, or the reader has to re-learn the
 * colour coding on every page.
 */
import type { ReactNode } from "react";
import { Check, Lock, Zap, AlertCircle } from "lucide-react";
import {
  BAND_META, CLASSIFICATION_META, RATING_META, RISK_BAND_META, STEP_STATE_META,
  type AuditStep, type Classification, type OverallRating, type RiskBand, type ScoreBand,
} from "../../../services/audits.service";

export function ClassificationChip({
  value, repeat, small,
}: { value?: Classification | null; repeat?: boolean; small?: boolean }) {
  if (!value) return null;
  const m = CLASSIFICATION_META[value];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-md font-bold tracking-wide ${
          small ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"
        }`}
        style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}
      >
        {small ? m.short : m.label.toUpperCase()}
      </span>
      {repeat && (
        <span
          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold"
          style={{ background: "#FFEDD5", color: "#7C2D12", border: "1px solid #FED7AA" }}
          title="This finding was raised in one of the last two audits — a repeat is treated as more serious than a first occurrence."
        >
          REPEAT
        </span>
      )}
    </span>
  );
}

export function RatingChip({ value }: { value?: OverallRating | null }) {
  if (!value) return null;
  const m = RATING_META[value];
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold tracking-wide"
      style={{ background: m.bg, color: m.color }}
    >
      {m.label.toUpperCase()}
    </span>
  );
}

export function RiskBandChip({ value, small }: { value?: RiskBand | string | null; small?: boolean }) {
  if (!value) return null;
  const m = RISK_BAND_META[(value as RiskBand)] ?? RISK_BAND_META.low;
  return (
    <span
      className={`inline-flex items-center rounded-md font-bold tracking-wide ${
        small ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"
      }`}
      style={{ background: m.bg, color: m.color }}
    >
      {m.label.toUpperCase()}
    </span>
  );
}

export function ScoreBadge({ score, band }: { score?: number | null; band?: ScoreBand | null }) {
  if (score == null) return <span className="text-[12px] text-slate-400">—</span>;
  const m = BAND_META[band ?? "poor"];
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[15px] font-bold" style={{ color: m.color }}>{Math.round(score)}%</span>
      <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: m.color }}>
        {m.label}
      </span>
    </span>
  );
}

/** The ten steps as a strip. Compact renders pips for a table row. */
export function StepStrip({
  steps, compact, onStepClick,
}: { steps: AuditStep[]; compact?: boolean; onStepClick?: (s: AuditStep) => void }) {
  if (!steps?.length) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-[3px]" title={steps.map((s) => `${s.number} ${s.label}: ${s.state}`).join("\n")}>
        {steps.map((s) => (
          <span
            key={s.number}
            className="h-1.5 w-4 rounded-full"
            style={{ background: s.state === "todo" ? "#E2E8F0" : STEP_STATE_META[s.state].color }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {steps.map((s) => {
        const m = STEP_STATE_META[s.state];
        const Wrapper = onStepClick ? "button" : "div";
        return (
          <Wrapper
            key={s.number}
            onClick={onStepClick ? () => onStepClick(s) : undefined}
            className="min-w-[132px] shrink-0 rounded-xl border p-2.5 text-left"
            style={{ borderColor: s.state === "todo" ? "#E2E8F0" : m.color, background: "#FFFFFF" }}
          >
            <div className="mb-1 flex items-center justify-between">
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold"
                style={{ background: m.bg, color: m.color }}
              >
                {s.state === "done" ? <Check className="h-3 w-3" />
                  : s.state === "blocked" ? <Lock className="h-2.5 w-2.5" />
                    : String(s.number).padStart(2, "0")}
              </span>
              {s.automatic && <Zap className="h-3 w-3" style={{ color: "#EA580C" }} />}
              {s.hard_stop && !s.automatic && <AlertCircle className="h-3 w-3" style={{ color: "#DC2626" }} />}
            </div>
            <p className="text-[8px] font-bold uppercase tracking-[0.09em] text-slate-400">{s.phase}</p>
            <p className="text-[11.5px] font-bold leading-tight" style={{ color: s.state === "todo" ? "#94A3B8" : "#0F172A" }}>
              {s.label}
            </p>
            <p className="mt-1 text-[9px] font-semibold text-slate-500">{s.owner_label ?? s.owner}</p>
          </Wrapper>
        );
      })}
    </div>
  );
}

/** Finding counts as a compact row of chips. */
export function FindingCounts({ counts }: { counts?: Record<string, number> | null }) {
  if (!counts) return null;
  const keys = Object.keys(CLASSIFICATION_META) as Classification[];
  const any = keys.some((k) => (counts[k] ?? 0) > 0);
  if (!any) return <span className="text-[11px] text-slate-400">No findings</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {keys.map((k) => {
        const n = counts[k] ?? 0;
        if (!n) return null;
        const m = CLASSIFICATION_META[k];
        return (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
            style={{ background: m.bg, color: m.color }}
            title={m.label}
          >
            {n} {m.short}
          </span>
        );
      })}
    </div>
  );
}

export function Banner({
  tone, title, children, icon,
}: { tone: "info" | "warn" | "danger" | "ok"; title: string; children?: ReactNode; icon?: ReactNode }) {
  const map = {
    info: { bg: "#EFF6FF", border: "#BFDBFE", fg: "#1D4ED8" },
    warn: { bg: "#FFFBEB", border: "#FDE68A", fg: "#B45309" },
    danger: { bg: "#FEF2F2", border: "#FECACA", fg: "#B91C1C" },
    ok: { bg: "#ECFDF5", border: "#A7F3D0", fg: "#047857" },
  }[tone];
  return (
    <div
      className="flex gap-3 rounded-xl border p-3.5"
      style={{ background: map.bg, borderColor: map.border }}
    >
      {icon && <div style={{ color: map.fg }} className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0">
        <p className="text-[13px] font-bold" style={{ color: map.fg }}>{title}</p>
        {children && (
          <div className="mt-1 text-[12px] leading-relaxed" style={{ color: map.fg }}>{children}</div>
        )}
      </div>
    </div>
  );
}

export function SectionBar({ section }: { section: { section: string; score: number; below_threshold: boolean; assessed: number } }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[12px] font-semibold text-slate-800">{section.section}</p>
          <p className="text-[10px] text-slate-400">{section.assessed} item{section.assessed === 1 ? "" : "s"}</p>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(2, Math.min(100, section.score))}%`,
              background: section.below_threshold ? "#DC2626" : "#059669",
            }}
          />
        </div>
      </div>
      <span
        className="w-14 text-right text-[13px] font-bold"
        style={{ color: section.below_threshold ? "#DC2626" : "#047857" }}
      >
        {section.score}%
      </span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-12 text-center">
      <p className="text-[13px] font-semibold text-slate-600">{title}</p>
      {hint && <p className="max-w-md text-[12px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function KeyValue({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <span className="text-[12px] text-slate-500">{k}</span>
      <span className="text-right text-[12px] font-semibold text-slate-900">{v}</span>
    </div>
  );
}
