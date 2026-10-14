import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bot, ChevronRight, Lightbulb, Mic, Send, ShieldAlert, TrendingUp, Zap,
  AlertTriangle, Activity, Clock, RefreshCw,
} from 'lucide-react';
import {
  Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart,
} from 'recharts';
import { chatWithAIAgent, type ChatMessage } from '../../services/ai.service';
import { getViolations } from '../../services/violations.service';
import { getZones } from '../../services/infrastructure.service';
import { FormattedMessage } from '../components/shared/FormattedMessage';
import { useAuth } from '../context/AuthContext';
import { SettingsFamilyTabBar } from '../components/audits/SettingsFamilyTabBar';
import axiosInstance from '../../api/axiosInstance';

// ─── Types ───────────────────────────────────────────────────────────────────
type UiMessage = {
  role: 'user' | 'ai';
  content: string;
  loading?: boolean;
  suggestions?: string[];
};

type ViolationsSummary = {
  by_type: { label: string; value: number }[];
  by_location: { label: string; value: number }[];
  by_root_cause: { name: string; value: number; color: string }[];
  investigation_status: { name: string; value: number; color: string }[];
  monthly_trend: { month: string; value: number }[];
  near_miss_monthly: { month: string; value: number }[];
  downtime_by_type: { label: string; value: number }[];
  severity_mix: { label: string; critical: number; high: number; medium: number; low: number }[];
  injury_category: { label: string; value: number }[];
  person_involved: { label: string; value: number }[];
};

type RiskSummary = {
  zone_risk: { zone: string; value: number }[];
  aging_bars: { bucket: string; low: number; medium: number; high: number; critical: number; line: number }[];
  kpis: { control_effectiveness: string; unverified_controls: number; risk_escalations: number };
};

// ─── Constants ───────────────────────────────────────────────────────────────
const STARTER_SUGGESTIONS = [
  'Show top safety risks this week',
  'Which zones have highest incident density?',
  'Give me 5 actions to reduce critical incidents',
];

const RISK_COLORS: Record<string, string> = {
  Critical: '#DC2626', High: '#F59E0B', Medium: '#1D4ED8', Low: '#9CA3AF',
};

const BRAND = {
  primary: '#0B3D91', accent: '#1D4ED8', light: '#DBEAFE',
  success: '#16A34A', warning: '#F59E0B', danger: '#DC2626',
  muted: '#9CA3AF', border: '#E5E7EB', bg: '#F9FAFB',
};

const ANALYSIS_MODULES = [
  { id: 'capa',       icon: '⚡', iconBg: '#FEF3C7', title: 'Open CAPA Actions',   sub: 'Corrective & preventive actions' },
  { id: 'critical',   icon: '🔴', iconBg: '#FEE2E2', title: 'Critical Incidents',  sub: 'Immediate investigation required' },
  { id: 'zones',      icon: '🗺️', iconBg: '#DBEAFE', title: 'Zone Risk Overview',  sub: 'Per-site incident density' },
  { id: 'compliance', icon: '✅', iconBg: '#D1FAE5', title: 'Compliance Status',   sub: 'Policy & checklist adherence' },
  { id: 'near-miss',  icon: '⚠️', iconBg: '#FEF9C3', title: 'Near Miss Analysis',  sub: 'Leading indicator tracking' },
  { id: 'training',   icon: '🎓', iconBg: '#EDE9FE', title: 'Training Gaps',       sub: 'Workforce competency risks' },
  { id: 'whatif',     icon: '🔮', iconBg: '#F0FDF4', title: 'What-If Scenarios',   sub: 'Risk projection simulations' },
  { id: 'summary',    icon: '📊', iconBg: '#F0F9FF', title: 'Full Safety Summary', sub: 'Organisation-wide overview' },
];

const MODULE_PROMPTS: Record<string, string> = {
  capa:       'Show me all open CAPA actions and prioritise them by risk.',
  critical:   'Analyse all critical incidents and identify root cause patterns.',
  zones:      'Which zones have the highest incident density? Show a breakdown.',
  compliance: 'What is our current compliance status across all policies and checklists?',
  'near-miss':'Analyse near-miss reports and identify leading indicators of future incidents.',
  training:   'Identify training gaps and workforce competency risks.',
  whatif:     'Simulate a 20% increase in workforce and show projected critical risks by zone.',
  summary:    'Give me a full safety summary for the organisation including all KPIs.',
};

// ─── Simple linear-regression forecast ───────────────────────────────────────
// Projects the next N periods from a numeric series using ordinary least
// squares on the index — good enough for a directional "where is this
// heading" signal, not a substitute for a real time-series model.
function linearForecast(values: number[], periodsAhead: number): number[] {
  const n = values.length;
  if (n === 0) return Array(periodsAhead).fill(0);
  if (n < 2) return Array(periodsAhead).fill(Math.round(values[0]));
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  values.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return Array.from({ length: periodsAhead }, (_, i) => Math.max(0, Math.round(slope * (n + i) + intercept)));
}

// ─── Small reusable chart-tooltip ────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      {label && <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>{label}</div>}
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: p.color || '#374151' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: p.color || '#374151', display: 'inline-block' }} />
          <span style={{ color: '#6B7280' }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function AIAgentPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'predictive' | 'whatif'>('chat');
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // ── Chat / Live data ────────────────────────────────────────────────────────
  const [riskData, setRiskData] = useState<{ zone: string; risk: string; predicted: number; confidence: number }[]>([]);
  const [insightData, setInsightData] = useState<{ text: string; metric: string }[]>([]);
  const [contextStats, setContextStats] = useState({ totalIncidents: 0, criticalIncidents: 0, totalZones: 0, highRiskZones: 0, openCapa: 0 });
  const [dataLoaded, setDataLoaded] = useState(false);

  // ── Predictive analytics data ───────────────────────────────────────────────
  const [violations, setViolations] = useState<ViolationsSummary | null>(null);
  const [riskSummaryFull, setRiskSummaryFull] = useState<RiskSummary | null>(null);
  const [predictiveLoaded, setPredictiveLoaded] = useState(false);
  const [predictiveLoading, setPredictiveLoading] = useState(false);

  // ── AI-generated forward-looking forecast narrative ─────────────────────────
  const [forecastNarrative, setForecastNarrative] = useState('');
  const [forecastNarrativeLoading, setForecastNarrativeLoading] = useState(false);
  const [forecastNarrativeError, setForecastNarrativeError] = useState(false);

  // ── What-If scenario builder inputs ──────────────────────────────────────────
  const [scenarioWorkforcePct, setScenarioWorkforcePct] = useState(0);
  const [scenarioShift, setScenarioShift] = useState<'normal' | 'extended' | 'night'>('normal');
  const [scenarioCapaDelay, setScenarioCapaDelay] = useState(0);
  const [scenarioSupervision, setScenarioSupervision] = useState(false);

  const orgLabel = user?.companyName?.trim() || user?.orgCode?.trim() || 'your organization';
  const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const [messages, setMessages] = useState<UiMessage[]>([{
    role: 'ai',
    content: 'HSE AI Assistant is ready. Select an analysis module from the left panel to run an instant analysis, or type a custom query below.',
    suggestions: STARTER_SUGGESTIONS,
  }]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // ── Load chat / sidebar live data ──────────────────────────────────────────
  const loadLiveData = useCallback(async () => {
    try {
      const [violationsRaw, zonesRaw, dashStats, riskSum] = await Promise.all([
        getViolations().catch(() => []),
        getZones().catch(() => []),
        axiosInstance.get('/dashboard/stats').then(r => r.data).catch(() => null),
        axiosInstance.get('/analytics/risk-summary').then(r => r.data).catch(() => null),
      ]);
      const totalIncidents = dashStats?.total_incidents ?? violationsRaw.length;
      const criticalIncidents = dashStats?.critical_incidents ?? 0;
      const openCapa = dashStats?.open_capa_actions ?? 0;
      const totalZones = zonesRaw.length;
      const zoneRiskRows: { zone: string; value: number }[] = riskSum?.zone_risk ?? [];
      const maxZoneVal = Math.max(...zoneRiskRows.map((z: any) => z.value), 1);
      const highRiskZones = zoneRiskRows.filter((z: any) => (z.value / maxZoneVal) * 100 >= 70).length;
      setContextStats({ totalIncidents, criticalIncidents, totalZones, highRiskZones, openCapa });

      // zone risk cards
      const zoneRisk: { zone: string; risk: string; predicted: number; confidence: number }[] = [];
      if (riskSum?.zone_risk?.length > 0) {
        const maxVal = Math.max(...riskSum.zone_risk.map((z: any) => z.value), 1);
        riskSum.zone_risk.slice(0, 3).forEach((z: any) => {
          const pct = (z.value / maxVal) * 100;
          zoneRisk.push({ zone: z.zone, risk: pct >= 70 ? 'Critical' : pct >= 40 ? 'High' : 'Medium', predicted: z.value, confidence: Math.min(99, 60 + Math.round(pct * 0.35)) });
        });
      }
      if (zoneRisk.length === 0) {
        zoneRisk.push(
          { zone: 'Incidents by Zone', risk: criticalIncidents > 3 ? 'Critical' : 'High', predicted: criticalIncidents, confidence: 90 },
          { zone: 'Open CAPA Actions', risk: openCapa > 10 ? 'High' : 'Medium', predicted: openCapa, confidence: 85 },
          { zone: 'Total Incidents', risk: totalIncidents > 20 ? 'High' : 'Medium', predicted: totalIncidents, confidence: 78 },
        );
      }
      setRiskData(zoneRisk);

      const insights: { text: string; metric: string }[] = [];
      insights.push({ text: `${openCapa} CAPA actions are currently open and require resolution`, metric: `${openCapa} open actions` });
      if (criticalIncidents > 0) {
        insights.push({ text: 'Critical incidents detected — immediate investigation required', metric: `${criticalIncidents} critical` });
      } else {
        insights.push({ text: 'No critical incidents in the selected period', metric: '✓ Zero critical' });
      }
      const ratio = totalIncidents > 0 ? Math.round((criticalIncidents / totalIncidents) * 100) : 0;
      insights.push({ text: `${orgLabel}: critical-to-total incident ratio`, metric: `${ratio}% critical rate` });
      setInsightData(insights);
      setDataLoaded(true);
    } catch (err) {
      console.warn('AI page data load error:', err);
      setDataLoaded(true);
    }
  }, [orgLabel]);

  // ── Load full analytics data for predictive tab ────────────────────────────
  const loadPredictiveData = useCallback(async () => {
    if (predictiveLoaded || predictiveLoading) return;
    setPredictiveLoading(true);
    try {
      const [vSum, rSum] = await Promise.all([
        axiosInstance.get('/analytics/violations-summary').then(r => r.data).catch(() => null),
        axiosInstance.get('/analytics/risk-summary').then(r => r.data).catch(() => null),
      ]);
      if (vSum) setViolations(vSum);
      if (rSum) setRiskSummaryFull(rSum);
      setPredictiveLoaded(true);
    } catch (err) {
      console.warn('Predictive data load error:', err);
      setPredictiveLoaded(true);
    } finally {
      setPredictiveLoading(false);
    }
  }, [predictiveLoaded, predictiveLoading]);

  // ── Generate the predictive forecast narrative (real DB snapshot, not a repeat of other tabs) ──
  const loadForecastNarrative = useCallback(async (force = false) => {
    if (forecastNarrativeLoading) return;
    if (!force && (forecastNarrative || forecastNarrativeError)) return;
    setForecastNarrativeLoading(true);
    setForecastNarrativeError(false);
    setForecastNarrative('');
    try {
      const reply = await chatWithAIAgent(
        'Give a short predictive forecast for the next 30 days of HSE risk — 3 to 4 crisp bullet points, no preamble, no restating totals I already have. ' +
        'Call out which specific incident type, root cause, or zone is most likely to escalate next based on the current trend, and one leading indicator to watch. ' +
        'Clearly label it as a data-driven estimate, not a guarantee.',
        [],
        (_delta, fullSoFar) => setForecastNarrative(fullSoFar),
      );
      setForecastNarrative(reply);
    } catch {
      setForecastNarrativeError(true);
    } finally {
      setForecastNarrativeLoading(false);
    }
  }, [forecastNarrative, forecastNarrativeError, forecastNarrativeLoading]);

  useEffect(() => { loadLiveData(); }, [loadLiveData]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (activeTab === 'predictive' || activeTab === 'whatif') loadPredictiveData(); }, [activeTab, loadPredictiveData]);
  useEffect(() => { if (activeTab === 'predictive' && predictiveLoaded) loadForecastNarrative(); }, [activeTab, predictiveLoaded, loadForecastNarrative]);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SR();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-US';
    recognitionRef.current.onresult = (e: any) => { setInput(e.results[0][0].transcript || ''); setIsListening(false); };
    recognitionRef.current.onerror = () => setIsListening(false);
    recognitionRef.current.onend = () => setIsListening(false);
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const askAi = async (question: string) => {
    if (!question.trim() || isProcessing) return;
    setIsProcessing(true);
    setMessages(prev => [...prev, { role: 'user', content: question }, { role: 'ai', content: '', loading: true }]);
    try {
      const nextHistory: ChatMessage[] = [...conversationHistory, { role: 'user', content: question }];
      let streamStarted = false;
      const reply = await chatWithAIAgent(question, conversationHistory, (_delta, fullSoFar) => {
        setMessages(prev => {
          const base = streamStarted ? prev.slice(0, -1) : prev.filter(m => !m.loading);
          return [...base, { role: 'ai', content: fullSoFar }];
        });
        streamStarted = true;
      });
      setConversationHistory([...nextHistory, { role: 'assistant', content: reply }]);
      setMessages(prev => [
        ...(streamStarted ? prev.slice(0, -1) : prev.filter(m => !m.loading)),
        { role: 'ai', content: reply, suggestions: ['Show next best actions', 'Summarize in 5 bullet points', 'Create a compliance checklist'] },
      ]);
    } catch (error: any) {
      setMessages(prev => [...prev.filter(m => !m.loading), { role: 'ai', content: `I couldn't complete this request: **${error?.message || 'Unknown error'}**. Please try again.` }]);
    } finally {
      setIsProcessing(false);
      setInput('');
    }
  };

  const handleMicClick = () => {
    if (!recognitionRef.current || isProcessing) return;
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); return; }
    recognitionRef.current.start();
    setIsListening(true);
  };

  const handleModuleClick = (moduleId: string) => {
    setActiveModule(moduleId);
    setActiveTab('chat');
    askAi(MODULE_PROMPTS[moduleId] || `Analyse ${moduleId} for ${orgLabel}`);
  };

  // ─── Derived predictive data ─────────────────────────────────────────────
  // Everything below feeds the Predictive tab only — deliberately excludes
  // breakdowns (root cause, investigation status, CAPA aging, downtime, top
  // locations) that already live on the Analytics/Risk pages verbatim. This
  // tab's job is forward-looking projections, not a re-skin of history.
  const trendData = (violations?.monthly_trend ?? []).map((m, i) => ({
    month: m.month,
    incidents: m.value,
    nearMiss: violations?.near_miss_monthly?.[i]?.value ?? 0,
  }));

  const zoneBarData = (riskSummaryFull?.zone_risk ?? riskData.map(r => ({ zone: r.zone, value: r.predicted }))).slice(0, 6);

  const capaEffectiveness = riskSummaryFull?.kpis?.control_effectiveness ?? '—';
  const capaEffectivenessNum = parseFloat(capaEffectiveness) || 0;
  const openCapaCount = riskSummaryFull?.kpis?.unverified_controls ?? contextStats.openCapa;
  const escalations = riskSummaryFull?.kpis?.risk_escalations ?? 0;

  // merge incident + near-miss trend for the combo chart — last 8 months
  const comboTrend = trendData.slice(-8);
  const monthsOfData = trendData.length;

  // ── 2-month forward projection off the incident trend (linear regression) ──
  const forecastValues = linearForecast(comboTrend.map(t => t.incidents), 2);
  const lastActualIncidents = comboTrend.length ? comboTrend[comboTrend.length - 1].incidents : 0;
  const forecastPctChange = lastActualIncidents > 0
    ? Math.round(((forecastValues[0] - lastActualIncidents) / lastActualIncidents) * 100)
    : (forecastValues[0] > 0 ? 100 : 0);
  const forecastChartData = comboTrend.length
    ? [
        ...comboTrend.map((d, i) => i === comboTrend.length - 1 ? { ...d, forecast: d.incidents } : { ...d, forecast: null }),
        ...forecastValues.map((v, i) => ({ month: `+${i + 1}mo`, incidents: null, nearMiss: null, forecast: v })),
      ]
    : [];

  const riskTrajectory: 'Rising' | 'Falling' | 'Stable' =
    forecastPctChange > 5 ? 'Rising' : forecastPctChange < -5 ? 'Falling' : 'Stable';
  // A 2-point OLS fit off 2-3 months of data is a coin flip dressed as a
  // number — surface that honestly instead of implying false precision.
  const confidenceLabel = monthsOfData >= 6 ? 'High' : monthsOfData >= 3 ? 'Medium' : 'Low';

  // ── Critical-severity rate trend + 1-month forecast (independent signal — ──
  // rate of critical incidents can rise even while total volume falls) ────
  const severityMonths = violations?.severity_mix ?? [];
  const criticalRateSeries = severityMonths.map(m => {
    const total = (m.critical || 0) + (m.high || 0) + (m.medium || 0) + (m.low || 0);
    return total > 0 ? Math.round((m.critical / total) * 100) : 0;
  });
  const criticalRateForecast = linearForecast(criticalRateSeries, 1)[0] ?? 0;
  const currentCriticalRate = criticalRateSeries.length ? criticalRateSeries[criticalRateSeries.length - 1] : 0;
  const criticalRateDelta = criticalRateForecast - currentCriticalRate;
  const criticalRateChartData = severityMonths.length
    ? [
        ...severityMonths.map((m, i) => ({
          month: m.label,
          rate: criticalRateSeries[i],
          rateForecast: i === severityMonths.length - 1 ? criticalRateSeries[i] : null,
        })),
        { month: '+1mo', rate: null, rateForecast: criticalRateForecast },
      ]
    : [];

  // ── CAPA backlog outlook — qualitative, since no historical open-count ──
  // time series exists to fit a real trend against.
  const capaOutlook: 'Growing' | 'Shrinking' | 'Stable' =
    openCapaCount > 0 && escalations / openCapaCount > 0.3 ? 'Growing'
    : capaEffectivenessNum >= 70 ? 'Shrinking'
    : 'Stable';
  const capaOutlookReason = capaOutlook === 'Growing'
    ? `${escalations} of ${openCapaCount} open actions are already overdue`
    : capaOutlook === 'Shrinking'
      ? `${capaEffectiveness} closure rate is outpacing new openings`
      : `${capaEffectiveness} closure rate roughly matches new openings`;

  // ── Zone escalation watchlist — projects each zone's current count using ──
  // the org-wide trend rate (no independent per-zone time series exists yet).
  const zoneWatchlist = [...zoneBarData]
    .map((z: any) => ({ ...z, projected: Math.max(0, Math.round(z.value * (1 + forecastPctChange / 100))) }))
    .sort((a, b) => b.projected - a.projected)
    .slice(0, 5);
  const maxZoneProjected = Math.max(...zoneWatchlist.map((z: any) => Math.max(z.value, z.projected)), 1);

  // ── What-If scenario model — deterministic, disclosed weights (not an AI ──
  // guess): each factor is a plainly labelled multiplier so the number is
  // auditable, and the AI is only asked to reason about it afterwards.
  const scenarioBaseline = lastActualIncidents || contextStats.totalIncidents || 0;
  const scenarioWorkforceEffect = Math.round(scenarioWorkforcePct * 0.6);
  const scenarioShiftEffect = scenarioShift === 'night' ? 18 : scenarioShift === 'extended' ? 10 : 0;
  const scenarioCapaEffect = Math.round(scenarioCapaDelay / 10) * 2;
  const scenarioSupervisionEffect = scenarioSupervision ? -12 : 0;
  const scenarioNetPct = scenarioWorkforceEffect + scenarioShiftEffect + scenarioCapaEffect + scenarioSupervisionEffect;
  const scenarioProjected = Math.max(0, Math.round(scenarioBaseline * (1 + scenarioNetPct / 100)));
  const scenarioFactors = [
    { label: 'Workforce change', pct: scenarioWorkforceEffect, active: scenarioWorkforcePct !== 0 },
    { label: scenarioShift === 'night' ? 'Night shift added' : scenarioShift === 'extended' ? 'Extended hours' : 'Shift pattern', pct: scenarioShiftEffect, active: scenarioShift !== 'normal' },
    { label: 'CAPA response delay', pct: scenarioCapaEffect, active: scenarioCapaDelay > 0 },
    { label: 'Extra safety supervision', pct: scenarioSupervisionEffect, active: scenarioSupervision },
  ].filter(f => f.active);

  const explainScenario = () => {
    const parts: string[] = [];
    if (scenarioWorkforcePct !== 0) parts.push(`a workforce change of ${scenarioWorkforcePct > 0 ? '+' : ''}${scenarioWorkforcePct}%`);
    if (scenarioShift === 'night') parts.push('adding a night shift');
    else if (scenarioShift === 'extended') parts.push('extending working hours');
    if (scenarioCapaDelay > 0) parts.push(`a ${scenarioCapaDelay}-day delay in CAPA closure`);
    if (scenarioSupervision) parts.push('adding dedicated safety supervision');
    const scenarioDesc = parts.length ? parts.join(', ') : 'no changes from the current baseline';
    setActiveTab('chat');
    askAi(
      `Evaluate this what-if scenario: ${scenarioDesc}. A quick deterministic model projects monthly incidents moving from a baseline of ${scenarioBaseline} to ${scenarioProjected} (${scenarioNetPct >= 0 ? '+' : ''}${scenarioNetPct}%). ` +
      `Using our real incident and root-cause data, sanity-check whether that direction and magnitude are plausible, and give 3 concrete mitigation actions if risk is rising.`
    );
  };

  return (
    <>
      <SettingsFamilyTabBar />
      {/* Height shrunk by the bar's own footprint (~46px) so the fixed-height
          chat panel below still ends flush with the viewport, not overflowing
          it by however tall the new row on top turned out to be. */}
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 158px)', background: '#fff', borderRadius: '12px', border: `1px solid ${BRAND.border}`, overflow: 'hidden' }}>

      {/* ═══ TOP HEADER ═══════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${BRAND.border}`, background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldAlert size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827', fontFamily: 'Inter, sans-serif' }}>HSE AI Assistant</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              <span style={{ fontSize: '12px', color: '#6B7280' }}>Engine active · Connected to live safety data</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: '#F3F4F6', borderRadius: '8px', padding: '3px' }}>
          {([['chat', 'AI Chat'], ['predictive', 'Predictive'], ['whatif', 'What-If']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ padding: '5px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: activeTab === id ? 600 : 400, border: 'none', cursor: 'pointer', background: activeTab === id ? '#fff' : 'transparent', color: activeTab === id ? '#1D4ED8' : '#6B7280', boxShadow: activeTab === id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ CHAT TAB ════════════════════════════════════════════════════ */}
      {activeTab === 'chat' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left panel */}
          <div style={{ width: '300px', flexShrink: 0, borderRight: `1px solid ${BRAND.border}`, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
            {/* Live stats grid */}
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: BRAND.muted }}>Live Data</span>
              {dataLoaded ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
                  {[
                    { label: 'Total Incidents', value: contextStats.totalIncidents, color: BRAND.accent },
                    { label: 'Critical', value: contextStats.criticalIncidents, color: BRAND.danger },
                    { label: 'Zones / Sites', value: contextStats.totalZones, color: BRAND.accent },
                    { label: 'Open CAPA', value: contextStats.openCapa, color: BRAND.warning },
                  ].map(s => (
                    <div key={s.label} style={{ background: BRAND.bg, borderRadius: '8px', padding: '8px 10px', border: `1px solid #F3F4F6` }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: '11px', color: BRAND.muted, marginTop: '3px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', color: BRAND.muted, fontSize: '12px' }}>
                  <div style={{ width: '14px', height: '14px', border: `2px solid ${BRAND.light}`, borderTopColor: BRAND.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Loading live data…
                </div>
              )}
            </div>
            {/* Modules list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px 8px' }}>
                <Bot size={12} color={BRAND.muted} />
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: BRAND.muted }}>Analysis Modules</span>
              </div>
              {ANALYSIS_MODULES.map(mod => (
                <button key={mod.id} onClick={() => handleModuleClick(mod.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', border: 'none', background: activeModule === mod.id ? '#EFF6FF' : 'transparent', cursor: 'pointer', textAlign: 'left', borderLeft: activeModule === mod.id ? `3px solid ${BRAND.accent}` : '3px solid transparent', transition: 'background 0.15s' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: mod.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{mod.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: activeModule === mod.id ? BRAND.accent : '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mod.title}</div>
                    <div style={{ fontSize: '11px', color: BRAND.muted, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mod.sub}</div>
                  </div>
                  <ChevronRight size={14} color={activeModule === mod.id ? BRAND.accent : '#D1D5DB'} />
                </button>
              ))}
            </div>
            {/* Insights footer */}
            {dataLoaded && insightData.length > 0 && (
              <div style={{ borderTop: '1px solid #F3F4F6', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                  <Lightbulb size={12} color={BRAND.warning} />
                  <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: BRAND.muted }}>Live Insights</span>
                </div>
                {insightData.slice(0, 2).map((ins, idx) => (
                  <div key={idx} style={{ marginBottom: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1.4' }}>{ins.text}</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: BRAND.accent, marginTop: '2px' }}>{ins.metric}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Right: console */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: `1px solid ${BRAND.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: BRAND.muted }}>{'>'}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#6B7280' }}>Analysis Console</span>
              </div>
              <button onClick={() => { setMessages([{ role: 'ai', content: 'HSE AI Assistant is ready. Select an analysis module from the left panel to run an instant analysis, or type a custom query below.', suggestions: STARTER_SUGGESTIONS }]); setConversationHistory([]); setActiveModule(null); }}
                style={{ fontSize: '11px', color: BRAND.muted, background: 'none', border: `1px solid ${BRAND.border}`, borderRadius: '6px', padding: '3px 10px', cursor: 'pointer' }}>
                Clear
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '82%' }}>
                    {msg.role === 'ai' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Bot size={13} color="#fff" />
                        </div>
                        <span style={{ fontSize: '11px', color: BRAND.muted, fontWeight: 500 }}>HSE AI · {nowTime}</span>
                      </div>
                    )}
                    <div style={msg.role === 'user'
                      ? { background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)', color: '#fff', borderRadius: '12px 12px 2px 12px', padding: '10px 16px', fontSize: '13px', lineHeight: '1.5' }
                      : { background: BRAND.bg, border: `1px solid ${BRAND.border}`, borderRadius: '2px 12px 12px 12px', padding: '12px 16px', fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                      {msg.loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {[0, 150, 300].map(d => <div key={d} style={{ width: '7px', height: '7px', borderRadius: '50%', background: BRAND.accent, animation: 'bounce 1s infinite', animationDelay: `${d}ms` }} />)}
                        </div>
                      ) : <FormattedMessage content={msg.content} isAI={msg.role === 'ai'} />}
                    </div>
                    {msg.role === 'ai' && !msg.loading && (
                      <div style={{ marginTop: '6px', paddingLeft: '4px' }}>
                        <button onClick={() => navigator.clipboard?.writeText(msg.content)}
                          style={{ fontSize: '11px', color: BRAND.muted, background: 'none', border: 'none', cursor: 'pointer' }}>Copy</button>
                      </div>
                    )}
                    {msg.suggestions && !msg.loading && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                        {msg.suggestions.map(s => (
                          <button key={s} onClick={() => askAi(s)}
                            style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', border: `1px solid ${BRAND.light}`, color: BRAND.accent, fontWeight: 500, background: '#fff', cursor: 'pointer' }}>{s}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${BRAND.border}`, background: '#fff', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: BRAND.bg, border: `1px solid ${BRAND.border}`, borderRadius: '10px', padding: '6px 6px 6px 16px' }}>
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAi(input)}
                  placeholder="Ask anything — including your own data, e.g. “summary of the last incident”"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: '#374151', fontFamily: 'inherit' }} />
                <button onClick={handleMicClick} disabled={isProcessing}
                  style={{ width: '32px', height: '32px', borderRadius: '7px', border: 'none', background: isListening ? BRAND.light : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mic size={15} color={isListening ? BRAND.accent : BRAND.muted} />
                </button>
                <button onClick={() => askAi(input)} disabled={isProcessing || !input.trim()}
                  style={{ width: '34px', height: '34px', borderRadius: '8px', border: 'none', background: isProcessing || !input.trim() ? BRAND.light : 'linear-gradient(135deg, #0B3D91, #1D4ED8)', cursor: isProcessing || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Send size={15} color="#fff" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PREDICTIVE ANALYTICS TAB ════════════════════════════════════ */}
      {/* Forward-looking only — the historical breakdowns (root cause,      */}
      {/* investigation status, CAPA aging, downtime, top locations) already */}
      {/* live on Analytics/Risk pages, so this tab doesn't repeat them.     */}
      {activeTab === 'predictive' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#F8FAFC' }}>

          {/* Loading overlay */}
          {predictiveLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '60px', color: BRAND.muted, fontSize: '13px' }}>
              <RefreshCw size={16} color={BRAND.accent} style={{ animation: 'spin 1s linear infinite' }} />
              Running predictive models…
            </div>
          )}

          {!predictiveLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* ── AI predictive forecast narrative ─────────────── */}
              <div style={{ background: '#fff', border: `1px solid ${BRAND.border}`, borderLeft: `4px solid ${BRAND.accent}`, borderRadius: '12px', padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: BRAND.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Bot size={16} color={BRAND.accent} />
                    </div>
                    <div>
                      <div style={{ color: '#111827', fontWeight: 700, fontSize: '13px' }}>30-Day Predictive Forecast</div>
                      <div style={{ color: BRAND.muted, fontSize: '11px', marginTop: '1px' }}>AI-generated from {orgLabel}'s live data — not a static chart repeat</div>
                    </div>
                  </div>
                  <button onClick={() => loadForecastNarrative(true)} disabled={forecastNarrativeLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${BRAND.border}`, background: '#fff', color: BRAND.muted, fontSize: '11px', cursor: forecastNarrativeLoading ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                    <RefreshCw size={11} color={BRAND.muted} style={forecastNarrativeLoading ? { animation: 'spin 1s linear infinite' } : undefined} />
                    Regenerate
                  </button>
                </div>
                <div style={{ background: BRAND.bg, border: `1px solid #F3F4F6`, borderRadius: '8px', padding: '14px 16px', minHeight: '48px' }}>
                  {forecastNarrativeError ? (
                    <span style={{ color: BRAND.danger, fontSize: '13px' }}>Couldn't generate a forecast right now. <button onClick={() => loadForecastNarrative(true)} style={{ color: BRAND.accent, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Try again</button>.</span>
                  ) : forecastNarrative ? (
                    <FormattedMessage content={forecastNarrative} isAI />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: BRAND.muted, fontSize: '13px' }}>
                      {[0, 150, 300].map(d => <div key={d} style={{ width: '6px', height: '6px', borderRadius: '50%', background: BRAND.accent, animation: 'bounce 1s infinite', animationDelay: `${d}ms` }} />)}
                      Generating forecast…
                    </div>
                  )}
                </div>
              </div>

              {/* ── Forecast KPI strip — every card is a projection, not a running total ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                {[
                  {
                    icon: <TrendingUp size={18} color={forecastPctChange > 0 ? BRAND.danger : forecastPctChange < 0 ? BRAND.success : BRAND.accent} />,
                    bg: forecastPctChange > 0 ? '#FEF2F2' : forecastPctChange < 0 ? '#F0FDF4' : '#EFF6FF',
                    label: 'Predicted Incidents — Next Month',
                    value: forecastValues[0] ?? '—',
                    sub: `${forecastPctChange > 0 ? '+' : ''}${forecastPctChange}% vs this month · linear trend`,
                  },
                  {
                    icon: <Activity size={18} color={riskTrajectory === 'Rising' ? BRAND.danger : riskTrajectory === 'Falling' ? BRAND.success : BRAND.warning} />,
                    bg: riskTrajectory === 'Rising' ? '#FEF2F2' : riskTrajectory === 'Falling' ? '#F0FDF4' : '#FFFBEB',
                    label: 'Risk Trajectory',
                    value: riskTrajectory,
                    sub: `based on last ${monthsOfData} month${monthsOfData === 1 ? '' : 's'} of incidents`,
                  },
                  {
                    icon: <AlertTriangle size={18} color={criticalRateDelta > 0 ? BRAND.danger : BRAND.success} />,
                    bg: criticalRateDelta > 0 ? '#FEF2F2' : '#F0FDF4',
                    label: 'Critical-Rate Forecast',
                    value: `${criticalRateForecast}%`,
                    sub: `${criticalRateDelta > 0 ? '+' : ''}${criticalRateDelta}pt vs current ${currentCriticalRate}%`,
                  },
                  {
                    icon: <Clock size={18} color={capaOutlook === 'Growing' ? BRAND.danger : capaOutlook === 'Shrinking' ? BRAND.success : BRAND.warning} />,
                    bg: capaOutlook === 'Growing' ? '#FEF2F2' : capaOutlook === 'Shrinking' ? '#F0FDF4' : '#FFFBEB',
                    label: 'CAPA Backlog Outlook',
                    value: capaOutlook,
                    sub: capaOutlookReason,
                  },
                ].map(k => (
                  <div key={k.label} style={{ background: '#fff', border: `1px solid ${BRAND.border}`, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {k.icon}
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>{k.value}</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{k.label}</div>
                      <div style={{ fontSize: '11px', color: BRAND.muted, marginTop: '2px' }}>{k.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Hero: incident trend + forecast (full width) ─────── */}
              <div style={{ background: '#fff', border: `1px solid ${BRAND.border}`, borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Incident Trend — 2-Month Forecast</div>
                    <div style={{ fontSize: '12px', color: BRAND.muted, marginTop: '2px' }}>Linear regression on {monthsOfData} month{monthsOfData === 1 ? '' : 's'} of incident history · dashed = projected</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: '#F3F4F6', color: '#6B7280' }}>
                      Confidence: {confidenceLabel}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: forecastPctChange > 0 ? '#FEF2F2' : '#F0FDF4', color: forecastPctChange > 0 ? BRAND.danger : BRAND.success }}>
                      Next month: {forecastValues[0] ?? '—'} ({forecastPctChange > 0 ? '+' : ''}{forecastPctChange}%)
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={forecastChartData.length ? forecastChartData : [{ month: 'N/A', incidents: 0, nearMiss: 0, forecast: null }]}>
                    <defs>
                      <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={BRAND.accent} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={BRAND.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: BRAND.muted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: BRAND.muted }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="incidents" name="Incidents" stroke={BRAND.accent} fill="url(#incGrad)" strokeWidth={2} dot={{ r: 3, fill: BRAND.accent }} connectNulls={false} />
                    <Line type="monotone" dataKey="nearMiss" name="Near Miss" stroke={BRAND.warning} strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3, fill: BRAND.warning }} connectNulls={false} />
                    <Line type="monotone" dataKey="forecast" name="Forecast" stroke={BRAND.danger} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: BRAND.danger }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* ── Critical-rate forecast + Zone escalation watchlist ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* Critical-rate trajectory */}
                <div style={{ background: '#fff', border: `1px solid ${BRAND.border}`, borderRadius: '12px', padding: '20px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Critical-Rate Trajectory</div>
                    <div style={{ fontSize: '12px', color: BRAND.muted, marginTop: '2px' }}>% of incidents rated critical, projected 1 month ahead</div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={criticalRateChartData.length ? criticalRateChartData : [{ month: 'N/A', rate: 0, rateForecast: null }]}>
                      <defs>
                        <linearGradient id="critGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={BRAND.danger} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={BRAND.danger} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: BRAND.muted }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: BRAND.muted }} axisLine={false} tickLine={false} width={32} unit="%" />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="rate" name="Critical %" stroke={BRAND.danger} fill="url(#critGrad)" strokeWidth={2} dot={{ r: 3, fill: BRAND.danger }} connectNulls={false} />
                      <Line type="monotone" dataKey="rateForecast" name="Forecast" stroke={BRAND.danger} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: BRAND.danger }} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Zone escalation watchlist */}
                <div style={{ background: '#fff', border: `1px solid ${BRAND.border}`, borderRadius: '12px', padding: '20px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Zone Escalation Watchlist</div>
                    <div style={{ fontSize: '12px', color: BRAND.muted, marginTop: '2px' }}>Current vs. next-period projection</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {zoneWatchlist.length ? zoneWatchlist.map((z: any) => {
                      const pctNow = Math.round((z.value / maxZoneProjected) * 100);
                      const pctProjected = Math.round((z.projected / maxZoneProjected) * 100);
                      const rising = z.projected > z.value;
                      const falling = z.projected < z.value;
                      const trendColor = rising ? BRAND.danger : falling ? BRAND.success : BRAND.muted;
                      return (
                        <div key={z.zone}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>{z.zone}</span>
                            <span style={{ fontSize: '11px', color: trendColor, fontWeight: 700 }}>
                              {z.value} → {z.projected} {rising ? '↑' : falling ? '↓' : '→'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <span style={{ fontSize: '9px', color: BRAND.muted, width: '52px', flexShrink: 0 }}>Now</span>
                            <div style={{ flex: 1, height: '6px', background: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pctNow}%`, background: BRAND.muted, borderRadius: '3px' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '9px', color: trendColor, fontWeight: 700, width: '52px', flexShrink: 0 }}>Projected</span>
                            <div style={{ flex: 1, height: '6px', background: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pctProjected}%`, background: trendColor, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div style={{ color: BRAND.muted, fontSize: '12px' }}>No zone data available</div>
                    )}
                  </div>
                  <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #F3F4F6', fontSize: '10px', color: BRAND.muted, lineHeight: '1.5' }}>
                    Projection applies the organisation-wide {forecastPctChange > 0 ? '+' : ''}{forecastPctChange}% trend to each zone's current baseline — not an independently modelled per-zone forecast.
                  </div>
                </div>
              </div>

              {/* ── AI Insight banner ──────────────────────────── */}
              <div style={{ background: BRAND.light, border: `1px solid #C7D9F5`, borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={20} color={BRAND.accent} />
                  </div>
                  <div>
                    <div style={{ color: '#111827', fontWeight: 700, fontSize: '14px' }}>Want deeper analysis?</div>
                    <div style={{ color: '#4B5A76', fontSize: '12px', marginTop: '3px' }}>Ask the AI to drill into any metric — root causes, zone patterns, or CAPA prioritisation</div>
                  </div>
                </div>
                <button onClick={() => { setActiveTab('chat'); askAi('Give me a full predictive risk analysis including top root causes, highest risk zones, and recommended actions.'); }}
                  style={{ padding: '9px 18px', borderRadius: '8px', background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  Run Full AI Analysis →
                </button>
              </div>

            </div>
          )}
        </div>
      )}

      {/* ═══ WHAT-IF TAB ═════════════════════════════════════════════════ */}
      {activeTab === 'whatif' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#F8FAFC' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '16px', alignItems: 'start' }}>

            {/* ── Scenario Builder ─────────────────────────────────────── */}
            <div style={{ background: '#fff', border: `1px solid ${BRAND.border}`, borderRadius: '12px', padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={18} color="#CA8A04" />
                </div>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Scenario Builder</span>
              </div>
              <p style={{ fontSize: '12px', color: BRAND.muted, lineHeight: '1.6', marginBottom: '20px' }}>
                Adjust the levers below — the projection updates instantly using a transparent, disclosed formula (not an AI guess). Use "Ask AI to explain" for a grounded read on whether the direction makes sense.
              </p>

              {/* Workforce change slider */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Workforce change</label>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: scenarioWorkforcePct > 0 ? BRAND.danger : scenarioWorkforcePct < 0 ? BRAND.success : BRAND.muted }}>
                    {scenarioWorkforcePct > 0 ? '+' : ''}{scenarioWorkforcePct}%
                  </span>
                </div>
                <input type="range" min={-30} max={50} step={5} value={scenarioWorkforcePct}
                  onChange={e => setScenarioWorkforcePct(Number(e.target.value))}
                  style={{ width: '100%', accentColor: BRAND.accent }} />
              </div>

              {/* Shift pattern */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Shift pattern</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {([['normal', 'Normal'], ['extended', 'Extended Hours'], ['night', 'Night Shift Added']] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setScenarioShift(id)}
                      style={{ flex: 1, padding: '7px 8px', borderRadius: '7px', fontSize: '11.5px', fontWeight: scenarioShift === id ? 700 : 500, border: `1px solid ${scenarioShift === id ? BRAND.accent : BRAND.border}`, background: scenarioShift === id ? BRAND.light : '#fff', color: scenarioShift === id ? BRAND.accent : '#6B7280', cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CAPA response delay slider */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>CAPA response delay</label>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: scenarioCapaDelay > 0 ? BRAND.danger : BRAND.muted }}>
                    {scenarioCapaDelay > 0 ? `+${scenarioCapaDelay} days` : 'No delay'}
                  </span>
                </div>
                <input type="range" min={0} max={60} step={5} value={scenarioCapaDelay}
                  onChange={e => setScenarioCapaDelay(Number(e.target.value))}
                  style={{ width: '100%', accentColor: BRAND.accent }} />
              </div>

              {/* Extra supervision toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', cursor: 'pointer' }}>
                <input type="checkbox" checked={scenarioSupervision} onChange={e => setScenarioSupervision(e.target.checked)}
                  style={{ width: '15px', height: '15px', accentColor: BRAND.accent }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Add dedicated safety supervision</span>
              </label>

              {/* Result panel */}
              <div style={{ background: BRAND.bg, border: `1px solid #F3F4F6`, borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: scenarioFactors.length ? '12px' : 0 }}>
                  <div>
                    <div style={{ fontSize: '10px', color: BRAND.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Baseline</div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#9CA3AF' }}>{scenarioBaseline}<span style={{ fontSize: '11px', fontWeight: 500 }}>/mo</span></div>
                  </div>
                  <div style={{ fontSize: '18px', color: BRAND.muted }}>→</div>
                  <div>
                    <div style={{ fontSize: '10px', color: BRAND.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scenario Projection</div>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: scenarioNetPct > 0 ? BRAND.danger : scenarioNetPct < 0 ? BRAND.success : '#111827' }}>
                      {scenarioProjected}<span style={{ fontSize: '12px', fontWeight: 500 }}>/mo</span>
                    </div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: scenarioNetPct > 0 ? '#FEF2F2' : scenarioNetPct < 0 ? '#F0FDF4' : '#F3F4F6', color: scenarioNetPct > 0 ? BRAND.danger : scenarioNetPct < 0 ? BRAND.success : '#6B7280', alignSelf: 'center' }}>
                    {scenarioNetPct > 0 ? '+' : ''}{scenarioNetPct}%
                  </span>
                </div>
                {scenarioFactors.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {scenarioFactors.map(f => (
                      <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ color: '#6B7280' }}>{f.label}</span>
                        <span style={{ fontWeight: 700, color: f.pct > 0 ? BRAND.danger : f.pct < 0 ? BRAND.success : BRAND.muted }}>{f.pct > 0 ? '+' : ''}{f.pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={explainScenario}
                style={{ marginTop: '14px', width: '100%', padding: '10px 18px', borderRadius: '8px', background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Bot size={15} /> Ask AI to Explain This Scenario
              </button>
            </div>

            {/* ── Quick Scenarios ──────────────────────────────────────── */}
            <div style={{ background: '#fff', border: `1px solid ${BRAND.border}`, borderRadius: '12px', padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TrendingUp size={18} color={BRAND.accent} />
                </div>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Quick Scenarios</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  'What if Zone A exposure hours rise by 25%?',
                  'What if corrective action SLA slips by 48 hours?',
                  'What if we add one extra safety supervisor to high-risk zones?',
                ].map(prompt => (
                  <button key={prompt} onClick={() => { setActiveTab('chat'); askAi(prompt); }}
                    style={{ padding: '9px 14px', borderRadius: '8px', border: `1px solid ${BRAND.border}`, background: '#fff', fontSize: '13px', color: '#374151', textAlign: 'left', cursor: 'pointer' }}>
                    {prompt}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #F3F4F6', fontSize: '10px', color: BRAND.muted, lineHeight: '1.5' }}>
                The scenario model applies fixed illustrative weights (workforce ≈0.6× incident scaling, night shift +18%, extended hours +10%, extra supervision −12%, CAPA delay +2% per 10 days) to your real monthly incident baseline — treat it as a directional estimate, not a certified risk assessment.
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
    </>
  );
}
