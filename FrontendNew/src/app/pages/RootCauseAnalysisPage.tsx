import { useEffect, useState } from "react";
import { ArrowRight, Search, RefreshCw } from "lucide-react";
import { getRootCauseAnalysis, type RootCauseAnalysis, type RCAFilters } from "../../services/analytics.service";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Low: "bg-green-100 text-green-700",
};

const STATUS_COLORS: Record<string, string> = {
  Closed: "bg-green-100 text-green-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Pending: "bg-yellow-100 text-yellow-700",
};

export function RootCauseAnalysisPage() {
  const [records, setRecords] = useState<RootCauseAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RCAFilters>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRootCauseAnalysis(filters);
      setRecords(data);
    } catch {
      setError("Failed to load RCA records. Ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filters]);

  const stats = {
    total: records.length,
    closed: records.filter(r => r.Status === "Closed").length,
    inProgress: records.filter(r => r.Status === "In Progress").length,
    pending: records.filter(r => r.Status === "Pending").length,
  };
  const openReports = records.filter((r) => r.Status !== "Closed").slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Root Cause Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze incidents to determine underlying causes.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total RCAs", value: stats.total, color: "text-gray-900" },
          { label: "Closed", value: stats.closed, color: "text-green-600" },
          { label: "In Progress", value: stats.inProgress, color: "text-blue-600" },
          { label: "Pending", value: stats.pending, color: "text-yellow-600" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Risk Reports</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Unsafe conditions raised from the field, scored on WF-01 Likelihood × Consequence.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/risk/tracking">
              Lifecycle tracking <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Card className="border-slate-200">
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{records.length > 0 ? stats.total : 0}</p>
                <p className="text-xs text-muted-foreground">{stats.closed} closed</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">High or Critical</p>
                <p className="mt-1 text-3xl font-bold text-orange-600">0</p>
                <p className="text-xs text-muted-foreground">Banded on the adjusted score</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Blocking work</p>
                <p className="mt-1 text-3xl font-bold text-red-600">0</p>
                <p className="text-xs text-muted-foreground">Adjusted score ≥ 15</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="mt-1 text-3xl font-bold text-amber-700">0</p>
                <p className="text-xs text-muted-foreground">Past the response deadline</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Not yet assessed</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">0</p>
                <p className="text-xs text-muted-foreground">No score, so not on the matrix</p>
              </CardContent>
            </Card>
          </div>

          {openReports.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No risk reports have been raised yet. They arrive here from the mobile app.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Criticality</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openReports.map((row) => (
                    <TableRow key={row.RCA_ID}>
                      <TableCell className="font-mono text-xs">{row.RCA_ID}</TableCell>
                      <TableCell className="font-medium">{row.Root_Causes}</TableCell>
                      <TableCell>{row.Conducted_By}</TableCell>
                      <TableCell>{row.Completion_Date || "No Date"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                          ● High
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filters.status ?? "all"}
          onValueChange={v => setFilters(f => ({ ...f, status: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {["Closed", "In Progress", "Pending"].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600" />
            RCA Records ({records.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center text-sm text-red-500">{error}</div>
          ) : loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
          ) : records.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No records found.</div>
          ) : (
            <div className="divide-y">
              {records.map(r => (
                <div key={r.RCA_ID} className="p-4 hover:bg-muted/30 transition-colors">
                  {/* Row summary */}
                  <div
                    className="flex items-start justify-between gap-4 cursor-pointer"
                    onClick={() => setExpanded(expanded === r.RCA_ID ? null : r.RCA_ID)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{r.RCA_ID}</span>
                        <Badge variant="outline" className="text-xs">{r.Incident_Type}</Badge>
                        <span className="font-medium text-sm">{r.Incident_ID}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {r.Root_Causes}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground hidden sm:block">{r.Site_ID}</span>
                      <Badge className={`text-xs ${PRIORITY_COLORS[r.Priority] ?? ""}`} variant="outline">
                        {r.Priority}
                      </Badge>
                      <Badge className={`text-xs ${STATUS_COLORS[r.Status] ?? ""}`} variant="outline">
                        {r.Status}
                      </Badge>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded === r.RCA_ID && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-semibold text-gray-700 mb-1">Root Causes</p>
                        <p className="text-muted-foreground">{r.Root_Causes}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-700 mb-1">Contributing Factors</p>
                        <p className="text-muted-foreground">{r.Contributing_Factors}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-700 mb-1">Corrective Actions</p>
                        <p className="text-muted-foreground">{r.Corrective_Actions}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-700 mb-1">Preventive Measures</p>
                        <p className="text-muted-foreground">{r.Preventive_Measures}</p>
                      </div>
                      <div className="md:col-span-2 flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-3">
                        <span>Conducted by: <strong className="text-gray-900">{r.Conducted_By}</strong></span>
                        <span>Started: <strong className="text-gray-900">{r.Start_Date}</strong></span>
                        {r.Completion_Date && (
                          <span>Completed: <strong className="text-gray-900">{r.Completion_Date}</strong></span>
                        )}
                        <span>Zone: <strong className="text-gray-900">{r.Zone_ID}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
