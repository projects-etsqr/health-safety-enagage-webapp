import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ChevronRight, ClipboardList, UserPlus } from "lucide-react";
import {
  assignCapa,
  getAllCapaActions,
  getAssignableOwners,
  type AssignableOwner,
  type CapaListItem,
} from "../../services/capa.service";

const PAGE_SIZE = 25;

// Windowed page list so very large datasets don't render hundreds of page buttons.
function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("…");
    result.push(p);
    prev = p;
  }
  return result;
}

// priority_band (the WF-04 matrix column) is never populated in this seed
// data — every row is NULL, which is why the column showed "—" everywhere.
// Same fallback the dashboard's Ranked Action Table already uses: derive it
// from the real status field instead (Overdue/In Progress are real values;
// due_date-vs-today is not reliable here — see dashboard.py's own comments).
function derivedPriority(band: string | null, status: string | null): string {
  if (band) return band;
  if (status === "Overdue") return "High";
  if (status === "In Progress") return "Medium";
  return "Low";
}

function priorityColor(priority: string) {
  switch (priority.toLowerCase()) {
    case "critical":
    case "high":
      return { background: "#FFF1F2", color: "#BE123C" };
    case "medium":
      return { background: "#FFF7ED", color: "#C2410C" };
    default:
      return { background: "#F1F5F9", color: "#475569" };
  }
}

// The three views this page offers. Unassigned is its own view rather than a
// column sort because it is the only one that is a work queue: every row in it
// is an action waiting on somebody to name an owner, and nothing chases it
// until they do.
type View = "all" | "overdue" | "unassigned";

export function CapaActionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View = searchParams.get("unassigned") === "1"
    ? "unassigned"
    : searchParams.get("overdue") === "1"
      ? "overdue"
      : "all";
  const overdueOnly = view === "overdue";
  const unassignedOnly = view === "unassigned";

  const setView = (next: View) =>
    setSearchParams(
      next === "overdue" ? { overdue: "1" } : next === "unassigned" ? { unassigned: "1" } : {},
      { replace: true },
    );

  // The owner picker is fetched once and shared by every row's dialog — it is
  // the same list for all of them and refetching per row would hit the API once
  // per assignment.
  const [owners, setOwners] = useState<AssignableOwner[]>([]);
  const [assigning, setAssigning] = useState<CapaListItem | null>(null);
  const [chosenOwner, setChosenOwner] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [items, setItems] = useState<CapaListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [overdueOnly, unassignedOnly]);

  useEffect(() => {
    setLoading(true);
    getAllCapaActions(page, PAGE_SIZE, overdueOnly, unassignedOnly)
      .then((res) => {
        setItems(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, overdueOnly, unassignedOnly, reloadKey]);

  useEffect(() => {
    getAssignableOwners().then(setOwners).catch(console.error);
  }, []);

  const openAssign = (row: CapaListItem) => {
    setAssigning(row);
    setChosenOwner(row.responsible_person_id ?? "");
    setAssignError(null);
  };

  const confirmAssign = async () => {
    if (!assigning || chosenOwner === "") return;
    setSaving(true);
    setAssignError(null);
    try {
      await assignCapa(assigning.id, Number(chosenOwner));
      setAssigning(null);
      // Refetch rather than patching the row in place: assigning resets the
      // escalation level server-side, so the row the list holds is stale in
      // more than just its assignee name.
      setReloadKey((k) => k + 1);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAssignError(detail || "Could not assign this action. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[19px]" style={{ color: "#0F172A", fontWeight: 700 }}>CAPA Actions</h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "#64748B" }}>
          Every corrective/preventive action raised for your organisation, real incident references included.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {([
          ["all", "All actions", { background: "#EEF2FF", borderColor: "#D8E1F5", color: "#4A57B9" }],
          ["overdue", "Overdue", { background: "#FFF7ED", borderColor: "#F4D6B0", color: "#B45309" }],
          ["unassigned", "Unassigned", { background: "#FEF2F2", borderColor: "#F5C2C7", color: "#BE123C" }],
        ] as [View, string, React.CSSProperties][]).map(([key, label, active]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold border"
            style={view === key ? active : { background: "#fff", borderColor: "#E2E8F0", color: "#64748B" }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border bg-white p-4 md:p-5" style={{ borderColor: "#D9E4F6", boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)" }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" style={{ color: "#4A57B9" }} />
            <h2 className="text-[clamp(1.05rem,2vw,1.3rem)]" style={{ color: "#111827", fontWeight: 700 }}>
              {overdueOnly ? "Overdue CAPA" : unassignedOnly ? "Waiting for an owner" : "All CAPA Actions"} — {total}
            </h2>
          </div>
        </div>

        {(() => {
          if (loading && items.length === 0) {
            return <p className="py-6 text-center text-[13px]" style={{ color: "#9CA3AF" }}>Loading…</p>;
          }
          if (items.length === 0) {
            return (
              <p className="py-6 text-center text-[13px]" style={{ color: "#9CA3AF" }}>
                {overdueOnly
                  ? "No overdue CAPA actions"
                  : unassignedOnly
                    ? "Every open action has an owner"
                    : "No CAPA actions recorded yet"}
              </p>
            );
          }
          return (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["Reference", "Action", "Priority", "Status", "Due Date", "Assignee"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[11px] uppercase" style={{ color: "#64748B", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => {
                      // incident_id is the reliable link for incident-raised CAPAs —
                      // subject_id alone misses older rows never backfilled with
                      // subject_family, which is why this can't check family first.
                      const incidentNum = row.incident_id ?? (row.subject_family === "incident" ? row.subject_id : null);
                      const incidentRef = incidentNum ? `INC-${String(incidentNum).padStart(5, "0")}` : null;
                      const label = (row.description || row.capa_type || "Corrective Action")
                        .replace(/\s*\b(for|addressing)\s+INC-?\d+\b\.?/gi, "")
                        .trim() || row.capa_type || "Corrective Action";
                      const priority = derivedPriority(row.priority_band, row.status);
                      const pColor = priorityColor(priority);
                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-[#F8FAFC] transition-colors"
                          style={{ borderTop: "1px solid #E2E8F0" }}
                        >
                          <td className="px-3 py-2 text-[13px] whitespace-nowrap">
                            {incidentRef ? (
                              <button
                                onClick={() => navigate(`/violations/${incidentRef}`)}
                                className="font-semibold hover:underline"
                                style={{ color: "#4A57B9" }}
                              >
                                {incidentRef}
                              </button>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>{row.capa_ref || "—"}</span>
                            )}
                          </td>
                          <td className="max-w-[320px] px-3 py-2 text-[13px]" style={{ color: "#111827" }}>
                            <span className="block truncate" title={label}>{label}</span>
                          </td>
                          <td className="px-3 py-2 text-[13px]">
                            <span className="inline-flex rounded-full px-2 py-1 text-[11px] font-bold" style={pColor}>
                              {priority}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[13px]" style={{ color: row.is_overdue ? "#C2410C" : "#334155", fontWeight: row.is_overdue ? 700 : 400 }}>
                            {row.status || "—"}
                          </td>
                          <td className="px-3 py-2 text-[13px] whitespace-nowrap" style={{ color: "#334155" }}>
                            {row.due_date ? new Date(row.due_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-3 py-2 text-[13px]" style={{ color: "#334155" }}>
                            {row.responsible_person_name ? (
                              <span className="inline-flex items-center gap-2">
                                {row.responsible_person_name}
                                <button
                                  onClick={() => openAssign(row)}
                                  className="text-[11px] font-semibold hover:underline"
                                  style={{ color: "#64748B" }}
                                >
                                  Reassign
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => openAssign(row)}
                                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold"
                                style={{ background: "#FEF2F2", borderColor: "#F5C2C7", color: "#BE123C" }}
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                Assign owner
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
                <span className="text-[12px]" style={{ color: "#64748B" }}>
                  Showing {rangeStart}–{rangeEnd} of {total} actions
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-md text-[12px] border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                    style={{ color: "#374151", borderColor: "#E2E8F0" }}
                  >
                    ← Previous
                  </button>
                  {getPageNumbers(page, totalPages).map((p, idx) =>
                    p === "…" ? (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-[12px]" style={{ color: "#94A3B8" }}>…</span>
                    ) : (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPage(p)}
                        className="min-w-[28px] px-2 py-1 rounded-md text-[12px] border"
                        style={
                          p === page
                            ? { background: "#4A57B9", borderColor: "#4A57B9", color: "#fff", fontWeight: 600 }
                            : { color: "#374151", borderColor: "#E2E8F0" }
                        }
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded-md text-[12px] border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                    style={{ color: "#374151", borderColor: "#E2E8F0" }}
                  >
                    Next <ChevronRight className="inline h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {assigning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15, 23, 42, 0.45)" }}
          onClick={() => !saving && setAssigning(null)}
        >
          <div
            className="w-full max-w-[440px] rounded-2xl bg-white p-5"
            style={{ boxShadow: "0 18px 40px rgba(15, 23, 42, 0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px]" style={{ color: "#0F172A", fontWeight: 700 }}>
              Assign {assigning.capa_ref || `CAPA-${String(assigning.id).padStart(6, "0")}`}
            </h3>
            <p className="mt-1 text-[12.5px]" style={{ color: "#64748B" }}>
              {assigning.description || "Corrective action"}
            </p>
            <p className="mt-2 text-[12px]" style={{ color: "#64748B" }}>
              Due {assigning.due_date ? new Date(assigning.due_date).toLocaleDateString() : "not set"} ·
              {" "}{assigning.capa_type || "unscored"} · {derivedPriority(assigning.priority_band, assigning.status)} priority
            </p>

            <label className="mt-4 block text-[12px] font-semibold" style={{ color: "#334155" }}>
              Owner
              <select
                value={chosenOwner}
                onChange={(e) => setChosenOwner(e.target.value === "" ? "" : Number(e.target.value))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-[13px] font-normal"
                style={{ borderColor: "#D9E4F6", color: "#0F172A" }}
              >
                <option value="">Choose a person…</option>
                {owners.map((o) => (
                  <option key={o.employee_id} value={o.employee_id}>
                    {o.name}{o.department ? ` — ${o.department}` : ""} ({o.role})
                  </option>
                ))}
              </select>
            </label>
            {owners.length === 0 && (
              <p className="mt-1.5 text-[11.5px]" style={{ color: "#B45309" }}>
                No supervisors or safety managers are listed for this organisation.
              </p>
            )}

            <p className="mt-3 text-[11.5px]" style={{ color: "#64748B" }}>
              The owner is notified straight away, and the escalation chain starts
              measuring against them at 50% of the deadline.
            </p>

            {assignError && (
              <p className="mt-3 text-[12px]" style={{ color: "#BE123C" }}>{assignError}</p>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setAssigning(null)}
                disabled={saving}
                className="rounded-lg border px-3.5 py-2 text-[13px] font-semibold disabled:opacity-40"
                style={{ borderColor: "#E2E8F0", color: "#475569" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmAssign}
                disabled={saving || chosenOwner === ""}
                className="rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                style={{ background: "#4A57B9" }}
              >
                {saving ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
