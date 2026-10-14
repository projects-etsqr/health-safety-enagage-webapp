import { useNavigate } from "react-router";
import {
  ChevronLeft, RefreshCw, Users, Building2, CreditCard,
  DollarSign, Activity, CheckCircle2, Clock, XCircle, Loader2,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { usePlatformAnalyticsQuery } from "@/features/superadmin/api/adminApi";

// ── Colour palettes ───────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  trial:      "#9CA3AF",
  standard:   "#3B82F6",
  premium:    "#8B5CF6",
  enterprise: "#F59E0B",
};
const PLAN_LABELS: Record<string, string> = {
  trial: "Trial", standard: "Standard", premium: "Premium", enterprise: "Enterprise",
};

const STATUS_COLORS: Record<string, string> = {
  accepted:  "#10B981",
  pending:   "#F59E0B",
  expired:   "#EF4444",
};
const STATUS_LABELS: Record<string, string> = {
  accepted: "Active", pending: "Pending", expired: "Suspended",
};

const ROLE_PALETTE = ["#4A57B9","#7C3AED","#0891B2","#059669","#D97706","#EF4444"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color, trend }: {
  icon: typeof Users; label: string; value: string | number; sub?: string; color: string; trend?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border p-5 flex items-center gap-4" style={{ borderColor: "#E3E9F6" }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-bold" style={{ color: "#111827" }}>{value}</div>
        <div className="text-[13px] font-medium" style={{ color: "#6B7280" }}>{label}</div>
        {sub && <div className="text-[11px]" style={{ color: "#9CA3AF" }}>{sub}</div>}
      </div>
      {trend && (
        <div className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: "#D1FAE5", color: "#065F46" }}>
          {trend}
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E9F6" }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: "#F3F4F6" }}>
        <div className="font-bold text-sm" style={{ color: "#111827" }}>{title}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{sub}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border shadow-lg px-3 py-2.5" style={{ borderColor: "#E3E9F6" }}>
      {label && <div className="text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span style={{ color: "#6B7280" }}>{p.name}:</span>
          <span className="font-bold" style={{ color: "#111827" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Donut chart legend ────────────────────────────────────────────────────────

function DonutLegend({ data, colors, labels }: {
  data: { name: string; value: number }[];
  colors: Record<string, string>;
  labels: Record<string, string>;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="space-y-2 mt-2">
      {data.map((d) => (
        <div key={d.name} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[d.name] ?? "#9CA3AF" }} />
            <span className="text-xs truncate" style={{ color: "#374151" }}>{labels[d.name] ?? d.name}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-bold" style={{ color: "#111827" }}>{d.value}</span>
            <span className="text-[10px]" style={{ color: "#9CA3AF" }}>
              {total > 0 ? `${Math.round((d.value / total) * 100)}%` : "0%"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty chart state ─────────────────────────────────────────────────────────

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2">
      <Activity className="w-8 h-8" style={{ color: "#E5E7EB" }} />
      <span className="text-xs" style={{ color: "#9CA3AF" }}>{label}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function PlatformAnalyticsPage() {
  const navigate = useNavigate();
  const { data, isLoading, refetch } = usePlatformAnalyticsQuery();

  const ov = data?.overview;

  const tenantGrowth = (data?.tenant_growth ?? []).map((d) => ({ ...d, month: fmtMonth(d.month) }));
  const userGrowth   = (data?.user_growth   ?? []).map((d) => ({ ...d, month: fmtMonth(d.month) }));

  // Merge growth series on same month axis
  const growthMonths = Array.from(new Set([
    ...tenantGrowth.map((d) => d.month),
    ...userGrowth.map((d) => d.month),
  ]));
  const combinedGrowth = growthMonths.map((m) => ({
    month: m,
    tenants: tenantGrowth.find((d) => d.month === m)?.tenants ?? 0,
    users:   userGrowth.find((d)   => d.month === m)?.users   ?? 0,
  }));

  const tenantPieData = (data?.tenant_status ?? []).map((d) => ({ name: d.status, value: d.count }));
  const planPieData   = (data?.plan_distribution ?? []).map((d) => ({ name: d.plan, value: d.count }));
  const roleBarData   = (data?.role_distribution ?? []).filter((d) => d.count > 0);

  return (
    <div className="p-5 sm:p-7 space-y-6 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/superadmin")}
            className="w-9 h-9 rounded-xl border flex items-center justify-center hover:bg-gray-50 transition-colors"
            style={{ borderColor: "#E3E9F6" }}>
            <ChevronLeft className="w-4 h-4" style={{ color: "#6B7280" }} />
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#111827" }}>Platform Analytics</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>Real-time snapshot across all organisations and users</p>
          </div>
        </div>
        <button onClick={() => refetch()}
          className="w-9 h-9 rounded-xl border flex items-center justify-center hover:bg-gray-50 transition-colors"
          style={{ borderColor: "#E3E9F6" }} title="Refresh">
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} style={{ color: "#6B7280" }} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#4A57B9" }} />
        </div>
      ) : (
        <>
          {/* ── KPI Grid ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={Building2}   label="Total Tenants"   value={ov?.total_tenants   ?? 0} sub={`${ov?.active_tenants ?? 0} active`}    color="#4A57B9" />
            <KpiCard icon={Users}       label="Platform Users"  value={ov?.total_users     ?? 0} sub={`${ov?.active_users ?? 0} active`}       color="#059669" />
            <KpiCard icon={DollarSign}  label="MRR"             value={fmt$(ov?.mrr ?? 0)}         sub={`ARR ${fmt$(ov?.arr ?? 0)}`}            color="#7C3AED" />
            <KpiCard icon={CreditCard}  label="Subscriptions"   value={ov?.total_subs      ?? 0} sub={`${ov?.active_subs ?? 0} active`}        color="#0891B2" />
          </div>

          {/* ── Growth charts ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Section title="Tenant Growth" sub="New organisations invited per month">
              {combinedGrowth.length === 0 ? (
                <EmptyChart label="No tenant data yet — invite organisations to see growth" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={combinedGrowth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTenants" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#4A57B9" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#4A57B9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="tenants" name="Tenants" stroke="#4A57B9" strokeWidth={2} fill="url(#gradTenants)" dot={{ r: 3, fill: "#4A57B9" }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Section>

            <Section title="User Registrations" sub="New user accounts created per month">
              {userGrowth.length === 0 ? (
                <EmptyChart label="No user registration data yet" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={combinedGrowth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#059669" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="users" name="Users" stroke="#059669" strokeWidth={2} fill="url(#gradUsers)" dot={{ r: 3, fill: "#059669" }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Section>
          </div>

          {/* ── Distribution charts ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Tenant status donut */}
            <Section title="Tenant Status" sub="Distribution by invite status">
              {tenantPieData.length === 0 ? (
                <EmptyChart label="No tenants yet" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={tenantPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                        paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {tenantPieData.map((d) => (
                          <Cell key={d.name} fill={STATUS_COLORS[d.name] ?? "#9CA3AF"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, STATUS_LABELS[String(n)] ?? n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <DonutLegend data={tenantPieData} colors={STATUS_COLORS} labels={STATUS_LABELS} />
                </>
              )}
            </Section>

            {/* Plan distribution donut */}
            <Section title="Plan Distribution" sub="Active subscriptions by plan">
              {planPieData.length === 0 ? (
                <EmptyChart label="No active subscriptions yet" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={planPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                        paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {planPieData.map((d) => (
                          <Cell key={d.name} fill={PLAN_COLORS[d.name] ?? "#9CA3AF"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, PLAN_LABELS[String(n)] ?? n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <DonutLegend data={planPieData} colors={PLAN_COLORS} labels={PLAN_LABELS} />
                </>
              )}
            </Section>

            {/* Role distribution bar */}
            <Section title="User Roles" sub="User count per platform role">
              {roleBarData.length === 0 ? (
                <EmptyChart label="No users yet" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={roleBarData} layout="vertical" margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="role" tick={{ fontSize: 11, fill: "#374151" }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Users" radius={[0, 6, 6, 0]}>
                      {roleBarData.map((_, i) => (
                        <Cell key={i} fill={ROLE_PALETTE[i % ROLE_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Section>
          </div>

          {/* ── Revenue breakdown ─────────────────────────────────────────── */}
          {(data?.plan_distribution ?? []).length > 0 && (
            <Section title="Revenue by Plan" sub="Monthly revenue contribution per plan">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={(data?.plan_distribution ?? []).map((d) => ({
                    name: PLAN_LABELS[d.plan] ?? d.plan,
                    revenue: d.revenue,
                    orgs: d.count,
                  }))}
                  margin={{ top: 4, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#374151" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, "Revenue"]} />
                  <Bar dataKey="revenue" name="Revenue ($)" radius={[6, 6, 0, 0]}>
                    {(data?.plan_distribution ?? []).map((d, i) => (
                      <Cell key={i} fill={PLAN_COLORS[d.plan] ?? ROLE_PALETTE[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* ── Recent tenants + health strip ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            <Section title="Recent Tenants" sub="Latest organisations invited">
              {(data?.recent_tenants ?? []).length === 0 ? (
                <EmptyChart label="No tenants invited yet" />
              ) : (
                <div className="space-y-3">
                  {(data?.recent_tenants ?? []).map((t) => {
                    const sIcon = t.status === "accepted"
                      ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#10B981" }} />
                      : t.status === "pending"
                        ? <Clock className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} />
                        : <XCircle className="w-3.5 h-3.5" style={{ color: "#EF4444" }} />;
                    return (
                      <div key={t.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: "#F3F4F6" }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#4A57B9,#6F80E8)" }}>
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate" style={{ color: "#111827" }}>{t.name}</div>
                            <div className="text-xs" style={{ color: "#9CA3AF" }}>{fmtDate(t.created_at)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">{sIcon}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Platform health */}
            <Section title="Platform Health" sub="Quick status overview">
              <div className="space-y-3">
                {[
                  {
                    label: "Tenant Activation Rate",
                    value: ov?.total_tenants
                      ? `${Math.round(((ov.active_tenants) / ov.total_tenants) * 100)}%`
                      : "—",
                    fill: ov?.total_tenants ? (ov.active_tenants / ov.total_tenants) * 100 : 0,
                    color: "#4A57B9",
                  },
                  {
                    label: "User Active Rate",
                    value: ov?.total_users
                      ? `${Math.round((ov.active_users / ov.total_users) * 100)}%`
                      : "—",
                    fill: ov?.total_users ? (ov.active_users / ov.total_users) * 100 : 0,
                    color: "#059669",
                  },
                  {
                    label: "Subscription Coverage",
                    value: ov?.total_tenants
                      ? `${Math.round(((ov.active_subs) / Math.max(ov.total_tenants, 1)) * 100)}%`
                      : "—",
                    fill: ov?.total_tenants ? Math.min((ov.active_subs / Math.max(ov.total_tenants, 1)) * 100, 100) : 0,
                    color: "#7C3AED",
                  },
                  {
                    label: "Pending Onboarding",
                    value: `${ov?.pending_tenants ?? 0} tenant${(ov?.pending_tenants ?? 0) !== 1 ? "s" : ""}`,
                    fill: ov?.total_tenants ? ((ov.pending_tenants ?? 0) / Math.max(ov.total_tenants, 1)) * 100 : 0,
                    color: "#F59E0B",
                  },
                ].map(({ label, value, fill, color }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium" style={{ color: "#374151" }}>{label}</span>
                      <span className="text-xs font-bold" style={{ color }}>{value}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(fill, 100)}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
