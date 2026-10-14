import { Check, X, CreditCard, Download } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    cta: "Current Plan",
    current: false,
    features: [
      { name: "Up to 5 users", included: true },
      { name: "1 site", included: true },
      { name: "Basic violation tracking", included: true },
      { name: "Email notifications", included: true },
      { name: "AI Agent", included: false },
      { name: "Predictive Analytics", included: false },
      { name: "Custom reports", included: false },
      { name: "API access", included: false },
      { name: "SSO", included: false },
    ],
  },
  {
    name: "Pro",
    price: "$49",
    period: "/user/month",
    cta: "Current Plan",
    current: true,
    features: [
      { name: "Up to 25 users", included: true },
      { name: "5 sites", included: true },
      { name: "Advanced violation tracking", included: true },
      { name: "All notifications", included: true },
      { name: "AI Agent", included: true },
      { name: "Predictive Analytics", included: true },
      { name: "Custom reports", included: true },
      { name: "API access", included: true },
      { name: "SSO", included: false },
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    cta: "Contact Sales",
    current: false,
    features: [
      { name: "Unlimited users", included: true },
      { name: "Unlimited sites", included: true },
      { name: "Full platform access", included: true },
      { name: "All notifications", included: true },
      { name: "AI Agent + What-If", included: true },
      { name: "Advanced Analytics", included: true },
      { name: "Custom reports", included: true },
      { name: "Full API access", included: true },
      { name: "SSO + SAML", included: true },
    ],
  },
];

const usageMetrics = [
  { label: "Users", used: 12, total: 25, unit: "" },
  { label: "Sites", used: 2, total: 5, unit: "" },
  { label: "Actions", used: 847, total: 1000, unit: "" },
  { label: "Storage", used: 4.2, total: 10, unit: "GB" },
];

const billingHistory = [
  { date: "Feb 1, 2026", plan: "Pro Plan", amount: "$588.00", status: "Paid", invoice: true },
  { date: "Jan 1, 2026", plan: "Pro Plan", amount: "$588.00", status: "Paid", invoice: true },
  { date: "Dec 1, 2025", plan: "Pro Plan", amount: "$539.00", status: "Paid", invoice: true },
  { date: "Nov 1, 2025", plan: "Pro Plan", amount: "$539.00", status: "Paid", invoice: true },
];

export function BillingPage() {
  const navigate = useNavigate();
  const { subscriptionPlan } = useAuth();

  return (
    <div className="space-y-6">
      <h1>Subscription & Billing</h1>

      {/* Current Plan Card */}
      <div className="bg-white rounded-xl border p-4 sm:p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)' }}>
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[20px]" style={{ fontFamily: 'DM Sans', fontWeight: 700, color: '#0A0A0A' }}>Pro Plan</span>
              <span className="px-2.5 py-1 rounded-full text-[11px] uppercase" style={{ background: '#D1FAE5', color: '#065F46', fontWeight: 600 }}>Active</span>
            </div>
            <span className="text-[14px]" style={{ color: '#4A5568' }}>12 users · Billed monthly</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="text-right">
            <div className="text-[12px]" style={{ color: '#9CA3AF' }}>Next billing date</div>
            <div className="text-[14px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>Mar 1, 2026</div>
          </div>
          <div className="text-right">
            <div className="text-[12px]" style={{ color: '#9CA3AF' }}>Amount</div>
            <div className="text-[14px]" style={{ color: '#0A0A0A', fontWeight: 600 }}>$588.00</div>
          </div>
          <button
            className="px-4 py-2 rounded-lg text-white text-[13px]"
            style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', fontWeight: 600 }}
            onClick={() => navigate(`/auth/onboarding/form?upgrade=1&target_plan=${encodeURIComponent(subscriptionPlan)}`)}
          >
            Upgrade
          </button>
        </div>
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {plans.map(plan => (
          <div
            key={plan.name}
            className="bg-white rounded-xl border p-6 relative overflow-hidden"
            style={{
              borderColor: plan.current ? '#2E7D32' : '#E8EFE8',
              boxShadow: plan.current ? '0px 4px 24px rgba(27, 94, 32, 0.15)' : '0px 2px 12px rgba(27, 94, 32, 0.08)',
            }}
          >
            {plan.current && (
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32, #43A047)' }} />
            )}
            <div className="text-center mb-6">
              <div className="text-[18px] mb-1" style={{ fontFamily: 'DM Sans', fontWeight: 700, color: '#0A0A0A' }}>{plan.name}</div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-[36px]" style={{ fontFamily: 'DM Sans', fontWeight: 700, background: 'linear-gradient(135deg, #1B5E20, #43A047)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {plan.price}
                </span>
                {plan.period && <span className="text-[14px]" style={{ color: '#9CA3AF' }}>{plan.period}</span>}
              </div>
            </div>
            <button
              className="w-full py-2.5 rounded-lg text-[13px] mb-6"
              style={
                plan.current
                  ? { background: '#F4F7F4', color: '#2E7D32', fontWeight: 600 }
                  : plan.name === "Enterprise"
                    ? { border: '1px solid #2E7D32', color: '#2E7D32', fontWeight: 600 }
                    : { background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', color: '#fff', fontWeight: 600 }
              }
            >
              {plan.cta}
            </button>
            <div className="space-y-3">
              {plan.features.map(f => (
                <div key={f.name} className="flex items-center gap-2">
                  {f.included ? (
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#2E7D32' }} />
                  ) : (
                    <X className="w-4 h-4 flex-shrink-0" style={{ color: '#D1D5DB' }} />
                  )}
                  <span className="text-[13px]" style={{ color: f.included ? '#0A0A0A' : '#9CA3AF' }}>{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Usage Metrics */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
        <h2 className="mb-6">Usage Metrics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {usageMetrics.map(m => {
            const percent = (m.used / m.total) * 100;
            const barColor = percent > 90 ? '#DC2626' : percent > 75 ? '#F59E0B' : '#2E7D32';
            return (
              <div key={m.label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{m.label}</span>
                  <span className="text-[13px]" style={{ color: '#4A5568' }}>
                    {m.used}{m.unit}/{m.total}{m.unit}
                  </span>
                </div>
                <div className="h-2.5 rounded-full" style={{ background: '#F4F7F4' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: barColor }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
        <h2 className="mb-4">Billing History</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
          <thead>
            <tr style={{ background: '#F4F7F4' }}>
              {["Date", "Plan", "Amount", "Status", "Invoice"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left">
                  <span className="text-[11px] uppercase tracking-[0.5px]" style={{ color: '#9CA3AF', fontWeight: 600 }}>{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {billingHistory.map((b, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #EEF2EE' }}>
                <td className="px-4 py-3 text-[13px]" style={{ color: '#4A5568' }}>{b.date}</td>
                <td className="px-4 py-3 text-[13px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>{b.plan}</td>
                <td className="px-4 py-3 text-[13px]" style={{ color: '#0A0A0A', fontWeight: 600 }}>{b.amount}</td>
                <td className="px-4 py-3">
                  <span className="px-2.5 py-1 rounded-full text-[11px] uppercase" style={{ background: '#D1FAE5', color: '#065F46', fontWeight: 600 }}>{b.status}</span>
                </td>
                <td className="px-4 py-3">
                  <button className="flex items-center gap-1 text-[13px]" style={{ color: '#2E7D32', fontWeight: 500 }}>
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E8EFE8', boxShadow: '0px 2px 12px rgba(27, 94, 32, 0.08)' }}>
        <h2 className="mb-4">Payment Method</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-10 rounded-lg flex items-center justify-center" style={{ background: '#F4F7F4' }}>
              <CreditCard className="w-6 h-6" style={{ color: '#1B5E20' }} />
            </div>
            <div>
              <div className="text-[14px]" style={{ color: '#0A0A0A', fontWeight: 500 }}>•••• •••• •••• 4242</div>
              <div className="text-[12px]" style={{ color: '#9CA3AF' }}>Expires 08/2028</div>
            </div>
          </div>
          <button className="w-full px-4 py-2 rounded-lg border text-[13px] sm:w-auto" style={{ borderColor: '#2E7D32', color: '#2E7D32', fontWeight: 500 }}>
            Update Payment Method
          </button>
        </div>
      </div>
    </div>
  );
}
