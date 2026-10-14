import {
  CheckCircle2, CircleDot, FileSearch, Flame, GraduationCap, Lock,
  Search, ShieldCheck, Siren, Wrench, type LucideIcon,
} from "lucide-react";

/**
 * The shared renderer for an eight-stage lifecycle trail.
 *
 * Incidents and near misses (and, when their admin pages arrive, unsafe acts
 * and risk reports) are deliberately served the *same* response shape by the
 * backend — see the note at the top of `report_trail_factory.py`. That only
 * pays off if one component renders all of them; two copies would drift the
 * first time a stage was restyled or a caveat reworded.
 *
 * The props are structural rather than imported from one family's service, so
 * any family whose trail matches the contract can render here without this
 * module depending on it.
 */

export type StageKey =
  | "RECORD" | "ASSESS" | "RESPOND" | "INVESTIGATE"
  | "IMPROVE" | "VERIFY" | "LEARN" | "CLOSE";

export const STAGE_ORDER: StageKey[] = [
  "RECORD", "ASSESS", "RESPOND", "INVESTIGATE", "IMPROVE", "VERIFY", "LEARN", "CLOSE",
];

export const STAGE_ICON: Record<StageKey, LucideIcon> = {
  RECORD: FileSearch,
  ASSESS: Siren,
  RESPOND: Flame,
  INVESTIGATE: Search,
  IMPROVE: Wrench,
  VERIFY: ShieldCheck,
  LEARN: GraduationCap,
  CLOSE: Lock,
};

export const PRIORITY_COLOR: Record<string, string> = {
  P1: "#DC2626", P2: "#EA580C", P3: "#CA8A04", P4: "#2563EB", P5: "#64748B",
};

export interface TrailActionLike {
  sequence: number;
  stage: StageKey | null;
  stage_number: number | null;
  action: string;
  detail: string | null;
  actor_id: number | null;
  actor_name: string | null;
  actor_ref: string | null;
  actor_job_role: string | null;
  actor_department: string | null;
  actor_username: string | null;
  occurred_at: string | null;
  source: string;
  timestamp_inferred: boolean;
  inferred_from?: string;
  reference: string | null;
  capa_status?: string | null;
}

export interface TrailStageLike {
  number: number;
  key: StageKey;
  label: string;
  description: string;
  state: "complete" | "current" | "skipped" | "pending";
  entered_at: string | null;
  last_action_at: string | null;
  action_count: number;
  actions: TrailActionLike[];
}

export interface TrailPersonLike {
  employee_id: number;
  employee_ref: string;
  name: string | null;
  job_role: string | null;
  department: string | null;
  employment_type: string | null;
  is_active: boolean;
  username: string | null;
  email: string | null;
  record_missing: boolean;
  workflow_roles: string[];
  action_count: number;
  actions: string[];
  first_action_at: string | null;
  last_action_at: string | null;
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function StatePill({ state }: Readonly<{ state: string }>) {
  const map: Record<string, { bg: string; fg: string; text: string }> = {
    complete: { bg: "#DCFCE7", fg: "#15803D", text: "Complete" },
    current: { bg: "#DBEAFE", fg: "#1D4ED8", text: "In progress" },
    skipped: { bg: "#FEF3C7", fg: "#B45309", text: "No action recorded" },
    pending: { bg: "#F1F5F9", fg: "#64748B", text: "Not reached" },
  };
  const s = map[state] ?? map.pending;
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.4px]"
      style={{ background: s.bg, color: s.fg, fontWeight: 700 }}>
      {s.text}
    </span>
  );
}

export function ActionRow({ action }: Readonly<{ action: TrailActionLike }>) {
  return (
    <li className="relative pl-5 pb-3 last:pb-0">
      <span className="absolute left-0 top-[6px] h-2 w-2 rounded-full"
        style={{ background: action.timestamp_inferred ? "#CBD5E1" : "#4A57B9" }} />
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[12.5px]" style={{ color: "#111827", fontWeight: 600 }}>
          {action.action}
        </span>
        {action.reference && (
          <span className="rounded px-1.5 py-0.5 text-[10px]"
            style={{ background: "#EEF2FB", color: "#4A57B9", fontWeight: 700 }}>
            {action.reference}
          </span>
        )}
        {action.capa_status && (
          <span className="text-[10.5px]" style={{ color: "#64748B" }}>
            status: {action.capa_status}
          </span>
        )}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]" style={{ color: "#64748B" }}>
        <span>{formatDateTime(action.occurred_at)}</span>
        {action.actor_name || action.actor_ref ? (
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span style={{ color: "#334155", fontWeight: 600 }}>
              {action.actor_name ?? "Unknown"}
            </span>
            {action.actor_ref && (
              <span className="rounded px-1 py-0.5 text-[10px] tabular-nums"
                style={{ background: "#F1F5F9", color: "#475569", fontWeight: 700 }}>
                {action.actor_ref}
              </span>
            )}
            {action.actor_job_role && <span>· {action.actor_job_role}</span>}
            {action.actor_username && <span style={{ color: "#94A3B8" }}>· @{action.actor_username}</span>}
          </span>
        ) : (
          <span style={{ color: "#B45309" }}>actor not recorded</span>
        )}
        <span style={{ color: "#94A3B8" }}>{action.source}</span>
      </div>
      {action.timestamp_inferred && (
        <div className="mt-0.5 text-[10.5px]" style={{ color: "#B45309" }}>
          Time inferred — this action has no timestamp of its own
          {action.inferred_from ? `, shown against ${action.inferred_from}` : ""}.
        </div>
      )}
      {action.detail && (
        <p className="mt-1 rounded-md px-2 py-1.5 text-[11.5px] leading-snug"
          style={{ background: "#F8FAFC", color: "#374151" }}>
          {action.detail}
        </p>
      )}
    </li>
  );
}

export function PersonCard({
  person,
  subjectNoun = "record",
}: Readonly<{ person: TrailPersonLike; subjectNoun?: string }>) {
  const initials = (person.name ?? "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: "#E3E9F6", background: "#FCFDFF" }}>
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] text-white"
          style={{ background: "linear-gradient(135deg, #505AB6, #7890F6)", fontWeight: 700 }}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[12.5px]" style={{ color: "#111827", fontWeight: 700 }}>
              {person.name ?? "Employee record missing"}
            </span>
            <span className="rounded px-1.5 py-0.5 text-[10px] tabular-nums"
              style={{ background: "#EEF2FB", color: "#3E4FB1", fontWeight: 700 }}>
              {person.employee_ref}
            </span>
            {!person.is_active && !person.record_missing && (
              <span className="rounded px-1.5 py-0.5 text-[9.5px]"
                style={{ background: "#F1F5F9", color: "#64748B", fontWeight: 700 }}>Inactive</span>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px]" style={{ color: "#64748B" }}>
            {person.job_role && <span>{person.job_role}</span>}
            {person.department && <span>· {person.department}</span>}
            {person.employment_type && <span>· {person.employment_type}</span>}
          </div>

          <div className="mt-1 flex flex-wrap gap-1">
            {person.workflow_roles.map((role) => (
              <span key={role} className="rounded-full px-2 py-0.5 text-[10px]"
                style={{ background: "#E4EAFC", color: "#2C3A8C", fontWeight: 700 }}>
                {role}
              </span>
            ))}
          </div>

          <div className="mt-1.5 text-[11px]" style={{ color: "#475569" }}>
            {person.action_count > 0 ? (
              <>
                <span style={{ fontWeight: 700 }}>{person.action_count}</span> action
                {person.action_count === 1 ? "" : "s"}: {person.actions.join(", ")}
              </>
            ) : (
              // Named on the record but with no action carrying their id — a real
              // state (assignment without a recorded step), not an error.
              <span style={{ color: "#94A3B8" }}>Named on the {subjectNoun}, no recorded action</span>
            )}
          </div>

          {person.username && (
            <div className="mt-1 text-[10.5px]" style={{ color: "#94A3B8" }}>
              login @{person.username}{person.email ? ` · ${person.email}` : ""}
            </div>
          )}
          {person.record_missing && (
            <div className="mt-1 text-[10.5px]" style={{ color: "#B91C1C" }}>
              The {subjectNoun} references this employee id but no employee row exists.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StageBlock({
  stage,
  subjectNoun = "record",
}: Readonly<{ stage: TrailStageLike; subjectNoun?: string }>) {
  const Icon = STAGE_ICON[stage.key];
  const done = stage.state === "complete";
  const current = stage.state === "current";
  const accent = done ? "#15803D" : current ? "#4A57B9" : stage.state === "skipped" ? "#B45309" : "#CBD5E1";

  return (
    <div className="relative pl-9 pb-5 last:pb-0">
      <span className="absolute left-[13px] top-7 bottom-0 w-px" style={{ background: "#E5EAF5" }} />
      <span className="absolute left-0 top-0 flex h-[27px] w-[27px] items-center justify-center rounded-full border-2 bg-white"
        style={{ borderColor: accent }}>
        {done ? <CheckCircle2 className="h-4 w-4" style={{ color: accent }} />
          : current ? <CircleDot className="h-4 w-4" style={{ color: accent }} />
            : <Icon className="h-3.5 w-3.5" style={{ color: accent }} />}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] tabular-nums" style={{ color: "#94A3B8", fontWeight: 700 }}>
          {String(stage.number).padStart(2, "0")}
        </span>
        <span className="text-[13px] uppercase tracking-[0.6px]" style={{ color: "#1F2937", fontWeight: 700 }}>
          {stage.label}
        </span>
        <StatePill state={stage.state} />
        <span className="text-[11px]" style={{ color: "#94A3B8" }}>
          {stage.action_count} action{stage.action_count === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-0.5 text-[11.5px]" style={{ color: "#6B7280" }}>{stage.description}</p>

      {stage.actions.length > 0 ? (
        <ul className="relative mt-2 border-l" style={{ borderColor: "#E5EAF5" }}>
          {stage.actions.map((a) => <ActionRow key={`${a.sequence}-${a.source}`} action={a} />)}
        </ul>
      ) : (
        <p className="mt-1.5 text-[11.5px]" style={{ color: "#94A3B8" }}>
          {stage.state === "skipped"
            ? `The ${subjectNoun} moved past this stage with nothing recorded against it.`
            : "Nothing recorded yet."}
        </p>
      )}
    </div>
  );
}
