import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  getTrackedNearMisses, type StageKey, type TrackedNearMiss,
} from "../../services/near-miss-trail.service";
import { PRIORITY_COLOR, STAGE_ORDER, formatDateTime } from "../components/tracking/lifecycle";
import { NearMissTabBar } from "../components/audits/NearMissTabBar";
import { EventFamilyTabBar } from "../components/audits/EventFamilyTabBar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

/**
 * Near miss register for the admin.
 *
 * Reads `/near-miss-trail`, the same source the lifecycle tracker uses, which
 * reads the same `near_misses` table the mobile app writes to. A near miss
 * reported on a phone appears here as soon as it is submitted.
 *
 * This page previously read the legacy `/near-misss/` CRUD router, whose
 * response carries neither `severity` nor `workflow_status`. The mapper filled
 * the gaps by hardcoding `Severity: 'Medium'` on every row and deriving Status
 * from `capa_escalation` — a checkbox the *worker* ticks at report time, not
 * the workflow state. So the severity filter matched nothing real, every record
 * read as Open or Under Investigation regardless of where it actually was, and
 * the Closed count was permanently zero even with 130 closed records in the
 * table. Severity, status and stage below are now the record's own.
 */

const STAGE_TINT: Record<string, { bg: string; fg: string }> = {
  RECORD: { bg: "#EEF2FB", fg: "#4A57B9" },
  ASSESS: { bg: "#FEF3C7", fg: "#B45309" },
  RESPOND: { bg: "#FFEDD5", fg: "#EA580C" },
  INVESTIGATE: { bg: "#DBEAFE", fg: "#1D4ED8" },
  IMPROVE: { bg: "#E0E7FF", fg: "#4338CA" },
  VERIFY: { bg: "#DCFCE7", fg: "#15803D" },
  LEARN: { bg: "#F3E8FF", fg: "#7E22CE" },
  CLOSE: { bg: "#F1F5F9", fg: "#475569" },
};

/** The workflow's own vocabulary, worded for an admin reading a register. */
const STATUS_LABEL: Record<string, string> = {
  reported: "Reported",
  acknowledged: "Acknowledged",
  under_investigation: "Under investigation",
  escalated: "Escalated",
  pending_approval: "Awaiting approval",
  capa_open: "Corrective action open",
  pending_verification: "Awaiting verification",
  approved: "Verified — awaiting closure",
  closed: "Closed",
};

export function NearMissPage() {
  const [records, setRecords] = useState<TrackedNearMiss[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<StageKey | "all">("all");
  const [priority, setPriority] = useState<string>("all");

  const fetchData = async () => {
    if (records.length === 0) setLoading(true);
    setError(null);
    try {
      setRecords((await getTrackedNearMisses({ limit: 300 })).items);
    } catch {
      setError("Failed to load near miss records. Ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData().catch(() => undefined); }, []);

  // Filtered client-side: the whole set is already loaded for the KPI counts,
  // and refetching per filter would make the tiles disagree with the table.
  const visible = useMemo(
    () => records.filter(
      (r) => (stage === "all" || r.stage === stage) && (priority === "all" || r.priority === priority),
    ),
    [records, stage, priority],
  );

  const stats = useMemo(() => ({
    total: records.length,
    hipo: records.filter((r) => r.is_hipo).length,
    open: records.filter((r) => r.workflow_status !== "closed").length,
    closed: records.filter((r) => r.workflow_status === "closed").length,
    overdue: records.filter((r) => r.is_overdue).length,
  }), [records]);

  return (
    <div className="space-y-6">
      <EventFamilyTabBar />
      <NearMissTabBar />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Near Miss</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every near miss on the eight-stage workflow, including those reported from the mobile app.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-gray-900" },
          { label: "High potential", value: stats.hipo, color: "text-red-600" },
          { label: "Open", value: stats.open, color: "text-blue-600" },
          { label: "Overdue", value: stats.overdue, color: "text-amber-600" },
          { label: "Closed", value: stats.closed, color: "text-emerald-600" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={stage} onValueChange={(v) => setStage(v as StageKey | "all")}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGE_ORDER.map((s, i) => (
              <SelectItem key={s} value={s}>{String(i + 1).padStart(2, "0")} {s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {["P1", "P2", "P3", "P4", "P5"].map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            Near Misses ({visible.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center text-sm text-red-500">{error}</div>
          ) : (loading && records.length === 0) ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
          ) : visible.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref</TableHead>
                    <TableHead>What happened</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>CAPA</TableHead>
                    <TableHead>Reported by</TableHead>
                    <TableHead>Reported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => {
                    const tint = STAGE_TINT[r.stage ?? ""] ?? STAGE_TINT.RECORD;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                        <TableCell className="max-w-[260px]">
                          <p className="font-medium text-sm truncate" title={r.description ?? ""}>
                            {r.description || "—"}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-0.5">
                            {r.potential_consequence && (
                              <span className="text-xs text-muted-foreground">
                                Risk: {r.potential_consequence.replace(/_/g, " ")}
                              </span>
                            )}
                            {r.is_hipo && (
                              <span className="text-[10px] font-bold text-red-600">HIGH POTENTIAL</span>
                            )}
                            {r.is_overdue && (
                              <span className="text-[10px] font-bold text-amber-600">OVERDUE</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{r.station_name ?? "—"}</TableCell>
                        <TableCell>
                          {r.priority ? (
                            <Badge
                              className="text-xs"
                              variant="outline"
                              style={{
                                background: `${PRIORITY_COLOR[r.priority] ?? "#64748B"}1A`,
                                color: PRIORITY_COLOR[r.priority] ?? "#64748B",
                                borderColor: "transparent",
                              }}
                            >
                              {r.priority}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">not triaged</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className="rounded px-2 py-0.5 text-[11px] font-bold"
                            style={{ background: tint.bg, color: tint.fg }}
                          >
                            {r.stage_number
                              ? `${String(r.stage_number).padStart(2, "0")} ${r.stage}`
                              : "unmapped"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {STATUS_LABEL[r.workflow_status ?? ""] ?? r.workflow_status ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.capa_total === 0
                            ? <span className="text-muted-foreground">—</span>
                            : `${r.capa_total - r.capa_open}/${r.capa_total}`}
                        </TableCell>
                        <TableCell className="text-sm">{r.reported_by_name ?? "—"}</TableCell>
                        <TableCell className="text-sm">{formatDateTime(r.reported_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
