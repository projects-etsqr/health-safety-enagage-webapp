import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useSearchParams } from 'react-router';
import { useLocation } from 'react-router';
import {
	Activity, AlertTriangle, ArrowRight, ArrowLeft, Building2, Check,
	CheckCircle2, ClipboardCheck, Cpu, Factory, FileText, Globe2,
	Rocket, Shield, Sparkles, Users, Lock, Heart, X, Search, Eye,
	Trash2, Zap, RefreshCcw, PlayCircle, ServerCog
} from 'lucide-react';
import {
	submitClientOnboarding,
	fetchOnboardingRequests,
	fetchOnboardingProcessingQueue,
	deleteOnboardingRequest,
	updateOnboardingStatus,
	startOnboardingProcessing,
	fetchRequestStatusByEmail,
	fetchOnboardingLayerOptions,
} from '../../services/onboarding.service';
import type {
	OnboardingLayerOption,
	OnboardingProcessingQueueItem,
	RequestStatusResponse,
} from '../../types';
import { useAuth } from '../context/AuthContext';
import './OnboardingPage.css';

	function generateTempPassword(email: string) {
		const local = (email.split('@')[0] || 'User').replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
		const rand = Math.random().toString(36).slice(2, 8);
		return `HSE@${local}${rand}`;
	}

/* ─── Constants ─── */
const COUNTRY_OPTIONS = [
	{ code: 'US', name: 'United States' },
	{ code: 'CA', name: 'Canada' },
	{ code: 'BR', name: 'Brazil' },
	{ code: 'AR', name: 'Argentina' },
	{ code: 'UK', name: 'United Kingdom' },
	{ code: 'FR', name: 'France' },
	{ code: 'DE', name: 'Germany' },
	{ code: 'IT', name: 'Italy' },
	{ code: 'ZA', name: 'South Africa' },
	{ code: 'NG', name: 'Nigeria' },
	{ code: 'EG', name: 'Egypt' },
	{ code: 'AE', name: 'United Arab Emirates' },
	{ code: 'SA', name: 'Saudi Arabia' },
	{ code: 'IN', name: 'India' },
	{ code: 'CN', name: 'China' },
	{ code: 'JP', name: 'Japan' },
	{ code: 'SG', name: 'Singapore' },
	{ code: 'AU', name: 'Australia' },
	{ code: 'NZ', name: 'New Zealand' },
];
const MODULE_OPTIONS = [
	'Dashboard', 'Violations', 'Actions & SLA', 'Checklists', 'Compliance',
	'Sites & Zones', 'Cameras & Devices', 'Near Miss', 'Root Cause Analysis',
	'Equipment Certification', 'AI Agent',
];
const INDUSTRY_OPTIONS = ['Construction', 'Oil & Gas', 'Manufacturing', 'Mining', 'Logistics & Transport', 'Power & Utilities', 'Other'];
const SUBSCRIPTION_PLAN_OPTIONS = ['Free', 'Pro', 'Enterprise'];
const FREE_DEFAULT_MODULES = ['Dashboard', 'Checklists', 'Sites & Zones', 'Violations', 'AI Agent'];
const PRO_DEFAULT_MODULES = [...MODULE_OPTIONS];
const FREE_DEFAULT_KPIS = ['TRIR', 'PPE Compliance %', 'Near Miss Reporting Rate'];
const FREE_TRIAL_DAYS = 30;
const FREE_KPI_LIMIT = 3;
const PRO_KPI_LIMIT = 6;
const FREE_PLAN_LIMITS = {
	sites: 1,
	zones: 3,
	activeWorkers: 12,
	employees: 20,
	contractors: 6,
};
const PRO_PLAN_LIMITS = {
	sites: 3,
	zones: 12,
	activeWorkers: 120,
	employees: 150,
	contractors: 40,
};
type IndustryProfile = {
	riskOptions: string[];
	certificationOptions: string[];
	kpiOptions: string[];
	defaultRisks: string[];
	defaultCertifications: string[];
	defaultKpis: string[];
	taxonomy: {
		sector: string;
		riskDomainTags: string[];
		complianceFrameworkTags: string[];
		kpiThemeTags: string[];
		dataLabelPrefix: string;
	};
};

const INDUSTRY_PROFILE_MAP: Record<string, IndustryProfile> = {
	Construction: {
		riskOptions: ['Work at Height (Scaffolds/Roofs)', 'Excavation & Trenching', 'Hot Work & Welding Operations', 'Crane, Lifting & Rigging Operations', 'Mobile Plant & Site Traffic Management', 'Temporary Power & Electrical Isolation (LOTO)'],
		certificationOptions: ['ISO 45001', 'ISO 14001', 'OSHA Program Alignment', 'Client-led HSE Program'],
		kpiOptions: ['TRIR', 'PPE Compliance %', 'Open Violations', 'Critical Incident Count', 'Near Miss Reporting Rate', 'Corrective Action Closure SLA', 'Toolbox Talk Completion %'],
		defaultRisks: ['Work at Height (Scaffolds/Roofs)', 'Hot Work & Welding Operations'],
		defaultCertifications: ['ISO 45001'],
		defaultKpis: ['TRIR', 'PPE Compliance %'],
		taxonomy: {
			sector: 'construction',
			riskDomainTags: ['height_safety', 'permit_to_work', 'lifting_operations'],
			complianceFrameworkTags: ['iso_45001', 'site_hse_program'],
			kpiThemeTags: ['incident_prevention', 'ppe_compliance', 'closure_timeliness'],
			dataLabelPrefix: 'hse.construction',
		},
	},
	'Oil & Gas': {
		riskOptions: ['Process Safety / Hydrocarbon Release Risk', 'Confined Space Entry (CS Entry)', 'Hot Work in Hazardous Areas', 'Pressure Systems & Line Breaking', 'Energy Isolation (LOTO) & SIMOPS', 'Chemical Exposure & H2S Handling'],
		certificationOptions: ['ISO 45001', 'ISO 14001', 'OSHA Program Alignment', 'Internal HSE Framework'],
		kpiOptions: ['TRIR', 'Critical Incident Count', 'Open Violations', 'Corrective Action Closure SLA', 'Near Miss Reporting Rate', 'Checklist Submission Timeliness'],
		defaultRisks: ['Confined Space Entry (CS Entry)', 'Hot Work in Hazardous Areas'],
		defaultCertifications: ['ISO 45001', 'ISO 14001'],
		defaultKpis: ['TRIR', 'Critical Incident Count'],
		taxonomy: {
			sector: 'oil_and_gas',
			riskDomainTags: ['process_safety', 'ptw_controls', 'isolation_management'],
			complianceFrameworkTags: ['iso_45001', 'iso_14001', 'process_hse_standards'],
			kpiThemeTags: ['critical_event_prevention', 'incident_frequency', 'action_closure'],
			dataLabelPrefix: 'hse.oilgas',
		},
	},
	Manufacturing: {
		riskOptions: ['Machine Guarding / Rotating Equipment Exposure', 'Energy Isolation (LOTO) During Maintenance', 'Chemical Handling & Industrial Hygiene Exposure', 'Forklift & Internal Traffic Movement', 'Hot Work in Production Areas'],
		certificationOptions: ['ISO 45001', 'ISO 14001', 'Internal HSE Framework'],
		kpiOptions: ['TRIR', 'PPE Compliance %', 'Open Violations', 'Corrective Action Closure SLA', 'Toolbox Talk Completion %', 'Checklist Submission Timeliness'],
		defaultRisks: ['Energy Isolation (LOTO) During Maintenance', 'Chemical Handling & Industrial Hygiene Exposure'],
		defaultCertifications: ['ISO 45001'],
		defaultKpis: ['TRIR', 'Corrective Action Closure SLA'],
		taxonomy: {
			sector: 'manufacturing',
			riskDomainTags: ['machine_safety', 'energy_isolation', 'industrial_hygiene'],
			complianceFrameworkTags: ['iso_45001', 'iso_14001'],
			kpiThemeTags: ['line_safety_compliance', 'corrective_action_speed', 'inspection_discipline'],
			dataLabelPrefix: 'hse.manufacturing',
		},
	},
	Mining: {
		riskOptions: ['Mobile Equipment & Haul Road Interaction', 'Ground Control / Slope Stability', 'Blasting Operations & Explosives Handling', 'Confined Space (Silos, Bins, Tanks)', 'Dust, Silica & Ventilation Exposure', 'Heavy Lifting & Recovery Operations'],
		certificationOptions: ['ISO 45001', 'Internal HSE Framework', 'Client-led HSE Program'],
		kpiOptions: ['TRIR', 'Critical Incident Count', 'Near Miss Reporting Rate', 'Open Violations', 'Corrective Action Closure SLA'],
		defaultRisks: ['Mobile Equipment & Haul Road Interaction', 'Confined Space (Silos, Bins, Tanks)'],
		defaultCertifications: ['ISO 45001'],
		defaultKpis: ['TRIR', 'Near Miss Reporting Rate'],
		taxonomy: {
			sector: 'mining',
			riskDomainTags: ['mobile_equipment_safety', 'ground_control', 'high_energy_tasks'],
			complianceFrameworkTags: ['iso_45001', 'mining_hse_standards'],
			kpiThemeTags: ['high_potential_events', 'near_miss_reporting', 'action_closure'],
			dataLabelPrefix: 'hse.mining',
		},
	},
	'Logistics & Transport': {
		riskOptions: ['Driver Fatigue & Journey Risk Management', 'Vehicle Reversing / Yard Traffic Interaction', 'Loading-Unloading & Dock Safety', 'Manual Handling & Musculoskeletal Risk', 'Battery Charging / Fuel Handling Safety'],
		certificationOptions: ['ISO 45001', 'OSHA Program Alignment', 'Client-led HSE Program'],
		kpiOptions: ['TRIR', 'Open Violations', 'Near Miss Reporting Rate', 'Checklist Submission Timeliness', 'Corrective Action Closure SLA'],
		defaultRisks: ['Driver Fatigue & Journey Risk Management'],
		defaultCertifications: ['ISO 45001'],
		defaultKpis: ['TRIR', 'Checklist Submission Timeliness'],
		taxonomy: {
			sector: 'logistics_transport',
			riskDomainTags: ['fleet_safety', 'loading_unloading', 'route_risk_management'],
			complianceFrameworkTags: ['transport_hse_program', 'iso_45001'],
			kpiThemeTags: ['driver_safety', 'inspection_timeliness', 'violation_reduction'],
			dataLabelPrefix: 'hse.logistics',
		},
	},
	'Power & Utilities': {
		riskOptions: ['Live Electrical Work / Arc Flash Exposure', 'Switchgear & HV Isolation (LOTO)', 'Work at Height on Towers / Poles', 'Confined Space in Pits / Vaults', 'Hot Work During Shutdown Maintenance', 'Chemical Handling (Water Treatment / Oils)'],
		certificationOptions: ['ISO 45001', 'ISO 14001', 'Internal HSE Framework'],
		kpiOptions: ['TRIR', 'Critical Incident Count', 'PPE Compliance %', 'Corrective Action Closure SLA', 'Checklist Submission Timeliness'],
		defaultRisks: ['Switchgear & HV Isolation (LOTO)', 'Work at Height on Towers / Poles'],
		defaultCertifications: ['ISO 45001', 'ISO 14001'],
		defaultKpis: ['TRIR', 'Critical Incident Count'],
		taxonomy: {
			sector: 'power_utilities',
			riskDomainTags: ['electrical_safety', 'maintenance_control', 'permit_governance'],
			complianceFrameworkTags: ['iso_45001', 'iso_14001', 'utility_safety_program'],
			kpiThemeTags: ['high_risk_task_control', 'incident_prevention', 'closure_timeliness'],
			dataLabelPrefix: 'hse.power',
		},
	},
	Other: {
		riskOptions: ['Work at Height', 'Confined Space Entry', 'Hot Work Operations', 'Energy Isolation (LOTO)', 'Vehicle & Traffic Interaction', 'Chemical Handling & Storage', 'Manual Handling / Ergonomic Risk'],
		certificationOptions: ['ISO 45001', 'ISO 14001', 'OSHA Program Alignment', 'Internal HSE Framework', 'Client-led HSE Program'],
		kpiOptions: ['TRIR', 'PPE Compliance %', 'Open Violations', 'Critical Incident Count', 'Near Miss Reporting Rate', 'Corrective Action Closure SLA', 'Toolbox Talk Completion %', 'Checklist Submission Timeliness'],
		defaultRisks: ['Work at Height'],
		defaultCertifications: ['ISO 45001'],
		defaultKpis: ['TRIR'],
		taxonomy: {
			sector: 'general_industry',
			riskDomainTags: ['general_hse_controls'],
			complianceFrameworkTags: ['iso_45001'],
			kpiThemeTags: ['incident_frequency', 'compliance_tracking'],
			dataLabelPrefix: 'hse.general',
		},
	},
};

const slugifyLabel = (value: string) =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');

const reconcileSelection = (current: string[], allowed: string[], defaults: string[]) => {
	const allowedSet = new Set(allowed);
	const kept = current.filter((item) => allowedSet.has(item));
	if (kept.length > 0) return Array.from(new Set(kept));
	const fallback = defaults.filter((item) => allowedSet.has(item));
	if (fallback.length > 0) return Array.from(new Set(fallback));
	return allowed.length > 0 ? [allowed[0]] : [];
};

const ALL_CARDS = [
	{ icon: <Cpu size={18} />, title: 'Unified EHSERA Intelligence Core', text: 'Connected control tower for incidents, inspections, corrective actions, and compliance evidence.' },
	{ icon: <Sparkles size={18} />, title: 'AI-assisted Safety Ops', text: 'Context-aware recommendations for risk prioritization and proactive interventions.' },
	{ icon: <Globe2 size={18} />, title: 'Multi-site Governance', text: 'Global standards with country and organization layers for region-specific workflows.' },
	{ icon: <Building2 size={18} />, title: 'Structured Setup', text: 'Capture organization profile, sites, work zones, and workforce scale.' },
	{ icon: <AlertTriangle size={18} />, title: 'Risk-led Execution', text: 'Prioritize high-risk activities and permit controls before go-live.' },
	{ icon: <Activity size={18} />, title: 'Operational Readiness', text: 'Track emergency response, incident trends, and training cadence.' },
	{ icon: <FileText size={18} />, title: 'Implementation Governance', text: 'Align integrations, ownership, and onboarding milestones.' },
];

const STEPS = [
	{ name: 'Organization', desc: 'Profile & layers', icon: <Factory size={16} /> },
	{ name: 'Modules & Scale', desc: 'Templates & workforce', icon: <ClipboardCheck size={16} /> },
	{ name: 'Knowledge & Compliance', desc: 'AI-ready risk knowledge', icon: <Shield size={16} /> },
	{ name: 'Contact Info', desc: 'Response, ownership, go-live', icon: <Users size={16} /> },
	{ name: 'SLA / KPI', desc: 'Monitoring targets & sign-off', icon: <Activity size={16} /> },
	{ name: 'Plan Benefits', desc: 'Free vs Pro vs Enterprise', icon: <Sparkles size={16} /> },
];

const FORM_STEPS = 5;
const INFO_STEP_INDEX = 5;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+[1-9]\d{6,14}$/;
const PRODUCT_ADMIN_EMAILS = new Set(
	String(import.meta.env.VITE_PRODUCT_ADMIN_EMAILS ?? '')
		.split(',')
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean),
);

/* ─── Main Component ─── */
export function OnboardingPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const { isAuthenticated, user, signup, login, logout } = useAuth();
	const isUpgradeMode = searchParams.get('upgrade') === '1';
	const targetPlanParam = searchParams.get('target_plan');

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState('');
	const [currentStep, setCurrentStep] = useState(0);
	const [view, setView] = useState<'form' | 'admin' | 'tracker'>('form');
	const [submissionSuccess, setSubmissionSuccess] = useState<{ onboardingUuid: string; orgCode: string; tempPassword?: string } | null>(null);
	const isSuperAdmin = Boolean(PRODUCT_ADMIN_EMAILS.has(user?.email?.trim().toLowerCase() || ''));

	const resolveRequestedView = () => {
		const normalizedPath = location.pathname.replace(/\/+$/, '').toLowerCase();
		if (normalizedPath.endsWith('/admin')) return 'admin';
		if (normalizedPath.endsWith('/tracker')) return 'tracker';
		if (normalizedPath.endsWith('/form')) return 'form';
		return (searchParams.get('view') || '').toLowerCase();
	};

	useEffect(() => {
		const requestedView = resolveRequestedView();
		if (requestedView === 'tracker') {
			setView('tracker');
			return;
		}
		if (requestedView === 'form') {
			setView('form');
			setCurrentStep(0);
			return;
		}
		if (requestedView === 'admin' && isSuperAdmin) {
			setView('admin');
			return;
		}
		setView('form');
		setCurrentStep(0);
	}, [searchParams, location.pathname, isSuperAdmin]);

	useEffect(() => {
		const requestedView = resolveRequestedView();
		const canStayOnAdminView = requestedView === 'admin' && isSuperAdmin;
		const canStayOnUpgradeFormView = requestedView === 'form' && isUpgradeMode && Boolean(user?.email);
		if (isAuthenticated && !canStayOnAdminView && !canStayOnUpgradeFormView) {
			navigate('/', { replace: true });
		}
	}, [isAuthenticated, isSuperAdmin, isUpgradeMode, user?.email, navigate, searchParams, location.pathname]);

	const openHseApp = () => {
		if (isAuthenticated) {
			navigate('/', { replace: true });
			return;
		}
		navigate('/auth/login', { replace: true });
	};



	const [companyName, setCompanyName] = useState('');
	const [countryCode, setCountryCode] = useState('IN');
	const [useCountryLayer, setUseCountryLayer] = useState(true);
	const [useOrgLayer, setUseOrgLayer] = useState(true);
	const [kbFiles, setKbFiles] = useState<File[]>([]);
	const [industryType, setIndustryType] = useState('Construction');
	const [subscriptionPlan, setSubscriptionPlan] = useState<'Free' | 'Pro' | 'Enterprise'>('Free');
	const [globalLayerOptions, setGlobalLayerOptions] = useState<OnboardingLayerOption[]>([]);
	const [countryLayerOptions, setCountryLayerOptions] = useState<OnboardingLayerOption[]>([]);
	const [globalChecklistTypes, setGlobalChecklistTypes] = useState<string[]>([]);
	const [countryChecklistTypes, setCountryChecklistTypes] = useState<string[]>([]);
	const [selectedChecklistTypes, setSelectedChecklistTypes] = useState<string[]>([]);
	const [selectedModules, setSelectedModules] = useState<string[]>(['Dashboard', 'Violations', 'Checklists', 'AI Agent']);
	const [siteCount, setSiteCount] = useState(1);
	const [zoneCount, setZoneCount] = useState(6);
	const [activeWorkers, setActiveWorkers] = useState(100);
	const [roleBreakdown, setRoleBreakdown] = useState({ admin: 2, engineer: 18, inspector: 10, contractor: 30, worker: 40 });
	const [showRoleDrilldown, setShowRoleDrilldown] = useState(false);
	const [employeeCount, setEmployeeCount] = useState<number | ''>('');
	const [contractorCount, setContractorCount] = useState<number | ''>('');
	const [shiftPattern, setShiftPattern] = useState('2 shifts');

	const [selectedRisks, setSelectedRisks] = useState<string[]>(['Work at Height', 'Hot Work']);
	const [selectedCertifications, setSelectedCertifications] = useState<string[]>(['ISO 45001']);
	const [ptwInUse, setPtwInUse] = useState(true);
	const [dailyToolboxTalk, setDailyToolboxTalk] = useState(true);
	const [incidentRate, setIncidentRate] = useState('1.2');
	const [lastAuditDate, setLastAuditDate] = useState('');
	const [onsiteClinicAvailable, setOnsiteClinicAvailable] = useState(false);
	const [fireEvacuationDrillCadence, setFireEvacuationDrillCadence] = useState('Quarterly');

	const [emergencyContacts, setEmergencyContacts] = useState<Array<{ name: string; phone: string }>>([
		{ name: '', phone: '' },
	]);
	const [goLiveTargetDate, setGoLiveTargetDate] = useState('');
	const [integrationNeeds, setIntegrationNeeds] = useState('ERP, Access Control');
	const [trainingPlan, setTrainingPlan] = useState('Role-based training for Admin, Supervisors, and Workers');
	const [requirementsNotes, setRequirementsNotes] = useState('');

	const [adminName, setAdminName] = useState('');
	const [adminEmail, setAdminEmail] = useState('');
	const [adminPhone, setAdminPhone] = useState('');
	const [adminDesignation, setAdminDesignation] = useState('HSE Manager');
	const [selectedKpis, setSelectedKpis] = useState<string[]>(['TRIR / LTIR', 'PPE Compliance %', 'Corrective Action Closure SLA']);
	const [customKpiInputs, setCustomKpiInputs] = useState<string[]>(['']);
	const [criticalClosureSlaHours, setCriticalClosureSlaHours] = useState(4);
	const [standardClosureSlaHours, setStandardClosureSlaHours] = useState(24);
	const [kpiReportingCadence, setKpiReportingCadence] = useState('Weekly');
	const [acceptDataPolicy, setAcceptDataPolicy] = useState(false);
	const [confirmLeadershipCommitment, setConfirmLeadershipCommitment] = useState(false);
	const [layerOptionsError, setLayerOptionsError] = useState('');
	const [upgradePrefillLoaded, setUpgradePrefillLoaded] = useState(false);
	const isEnterprisePlan = subscriptionPlan === 'Enterprise';
	const isProPlan = subscriptionPlan === 'Pro';
	const isFreePlan = subscriptionPlan === 'Free';
	const canEditFullConfig = isEnterprisePlan || isProPlan;
	const canEditModules = isEnterprisePlan;
	const canEditLastAudit = true;
	const canEditIncidentRate = true;
	const canEditKpi = isEnterprisePlan || isProPlan;
	const canEditCustomKpi = isEnterprisePlan;
	const kpiSelectionLimit = isEnterprisePlan ? Number.MAX_SAFE_INTEGER : isProPlan ? PRO_KPI_LIMIT : FREE_KPI_LIMIT;
	const planLimits = isFreePlan ? FREE_PLAN_LIMITS : isProPlan ? PRO_PLAN_LIMITS : null;
	const industryProfile = useMemo(
		() => INDUSTRY_PROFILE_MAP[industryType] ?? INDUSTRY_PROFILE_MAP.Other,
		[industryType],
	);
	const availableRiskOptions = industryProfile.riskOptions;
	const availableCertificationOptions = industryProfile.certificationOptions;
	const availableKpiOptions = industryProfile.kpiOptions;

	useEffect(() => {
		if (isFreePlan || isProPlan) {
			setRoleBreakdown((prev) => {
				const engineer = siteCount;
				const inspector = siteCount;
				const currentTotal = prev.admin + prev.engineer + prev.inspector + prev.contractor + prev.worker;
				
				if (prev.engineer === engineer && prev.inspector === inspector && currentTotal === activeWorkers) return prev;
				
				const admin = prev.admin > 0 ? prev.admin : 1;
				let contractor = prev.contractor > 0 ? prev.contractor : 1;
				let worker = activeWorkers - admin - engineer - inspector - contractor;
				
				// Handle scaling difference properly
				if (worker < 1) {
					// Scale down contractor if worker is less than 1
					const deficit = 1 - worker;
					contractor = Math.max(1, contractor - deficit);
					worker = activeWorkers - admin - engineer - inspector - contractor;
				} else if (worker > activeWorkers) {
					worker = Math.max(1, activeWorkers - admin - engineer - inspector - contractor);
				}
				
				// Optional: Ensure total is exact by adjusting worker or contractor proportionately if needed? 
				// The worker formula `activeWorkers - admin - engineer - inspector - contractor` natively guarantees sum = activeWorkers
				// Let's just return it cleanly
				return {
					...prev,
					engineer,
					inspector,
					contractor: Math.max(1, contractor),
					worker: Math.max(1, worker)
				};
			});
		}
	}, [siteCount, activeWorkers, isFreePlan, isProPlan]);

	useEffect(() => {
		if (!isUpgradeMode || !targetPlanParam) return;
		if (SUBSCRIPTION_PLAN_OPTIONS.includes(targetPlanParam)) {
			setSubscriptionPlan(targetPlanParam as 'Free' | 'Pro' | 'Enterprise');
		}
	}, [isUpgradeMode, targetPlanParam]);

	useEffect(() => {
		const requestedView = resolveRequestedView();
		if (!isUpgradeMode || requestedView !== 'form' || !isAuthenticated || !user?.email || upgradePrefillLoaded) {
			return;
		}

		const hydrateFromLastSubmission = async () => {
			try {
				const status = await fetchRequestStatusByEmail(user.email);
				if (!status?.found) {
					setUpgradePrefillLoaded(true);
					return;
				}

				setCompanyName(status.company_name || '');
				setCountryCode((status.country_code || 'IN').toUpperCase());
				setSelectedModules(Array.isArray(status.selected_modules) ? status.selected_modules : []);
				setSelectedChecklistTypes(Array.isArray(status.selected_checklist_types) ? status.selected_checklist_types : []);
				setSiteCount(Math.max(1, Number(status.onboarding_requirements?.plan_capabilities?.site_limit || 1)));
				setZoneCount(Math.max(1, Number(status.onboarding_requirements?.plan_capabilities?.zone_limit || 1)));
				setActiveWorkers(Math.max(1, Number(status.active_workers || 1)));

				const profile = (status.onboarding_requirements?.profile || {}) as Record<string, any>;
				if (profile.subscription_plan && SUBSCRIPTION_PLAN_OPTIONS.includes(profile.subscription_plan)) {
					setSubscriptionPlan(profile.subscription_plan as 'Free' | 'Pro' | 'Enterprise');
				}
				if (profile.industry_type && INDUSTRY_OPTIONS.includes(profile.industry_type)) {
					setIndustryType(profile.industry_type);
				}
				setEmployeeCount(Math.max(1, Number(profile.employee_count || employeeCount)));
				setContractorCount(Math.max(0, Number(profile.contractor_count || contractorCount)));
				setShiftPattern(String(profile.shift_pattern || shiftPattern));

				const risk = (status.onboarding_requirements?.risk_and_compliance || {}) as Record<string, any>;
				if (Array.isArray(risk.high_risk_activities)) setSelectedRisks(risk.high_risk_activities);
				if (Array.isArray(risk.certifications)) setSelectedCertifications(risk.certifications);
				if (typeof risk.permit_to_work_in_use === 'boolean') setPtwInUse(risk.permit_to_work_in_use);
				if (typeof risk.daily_toolbox_talk === 'boolean') setDailyToolboxTalk(risk.daily_toolbox_talk);
				if (typeof risk.trir !== 'undefined') setIncidentRate(String(risk.trir));
				if (risk.last_audit_date) setLastAuditDate(String(risk.last_audit_date));

				const emergency = (status.onboarding_requirements?.emergency_readiness || {}) as Record<string, any>;
				if (Array.isArray(emergency.emergency_contacts) && emergency.emergency_contacts.length > 0) {
					setEmergencyContacts(
						emergency.emergency_contacts.map((contact: any) => ({
							name: String(contact?.name || ''),
							phone: String(contact?.phone || ''),
						})),
					);
				}
				if (typeof emergency.onsite_clinic_available === 'boolean') setOnsiteClinicAvailable(emergency.onsite_clinic_available);
				if (emergency.evacuation_drill_cadence) setFireEvacuationDrillCadence(String(emergency.evacuation_drill_cadence));

				const adminOwnership = (status.onboarding_requirements?.admin_ownership || {}) as Record<string, any>;
				setAdminName(String(adminOwnership.admin_name || status.admin_name || ''));
				setAdminEmail(String(adminOwnership.admin_email || status.admin_email || user.email || ''));
				setAdminPhone(String(adminOwnership.admin_phone || status.admin_phone || ''));
				setAdminDesignation(String(adminOwnership.admin_designation || adminDesignation));

				const implementation = (status.onboarding_requirements?.implementation || {}) as Record<string, any>;
				if (implementation.target_go_live_date) setGoLiveTargetDate(String(implementation.target_go_live_date));
				if (implementation.integration_needs) setIntegrationNeeds(String(implementation.integration_needs));
				if (implementation.training_plan) setTrainingPlan(String(implementation.training_plan));

				const kpi = (status.onboarding_requirements?.kpi_sla || {}) as Record<string, any>;
				if (Array.isArray(kpi.selected_kpis)) setSelectedKpis(kpi.selected_kpis);
				if (Array.isArray(kpi.custom_kpis) && kpi.custom_kpis.length > 0) setCustomKpiInputs(kpi.custom_kpis.map(String));
				if (kpi.reporting_cadence) setKpiReportingCadence(String(kpi.reporting_cadence));
				if (kpi.sla_targets?.critical_action_closure_hours) setCriticalClosureSlaHours(Number(kpi.sla_targets.critical_action_closure_hours));
				if (kpi.sla_targets?.standard_action_closure_hours) setStandardClosureSlaHours(Number(kpi.sla_targets.standard_action_closure_hours));

				const customNotes = status.onboarding_requirements?.custom_notes;
				if (typeof customNotes === 'string') setRequirementsNotes(customNotes);

				setCurrentStep(0);
			} finally {
				setUpgradePrefillLoaded(true);
			}
		};

		void hydrateFromLastSubmission();
	}, [
		isUpgradeMode,
		isAuthenticated,
		user?.email,
		upgradePrefillLoaded,
		location.pathname,
		searchParams,
	]);

	useEffect(() => {
		if (isFreePlan) {
			setSelectedModules(FREE_DEFAULT_MODULES);
			setSiteCount(FREE_PLAN_LIMITS.sites);
			setZoneCount(FREE_PLAN_LIMITS.zones);
			setActiveWorkers(FREE_PLAN_LIMITS.activeWorkers);
			setEmployeeCount(FREE_PLAN_LIMITS.employees);
			setContractorCount(FREE_PLAN_LIMITS.contractors);
			setShiftPattern('1 shift');

			setSelectedRisks(reconcileSelection([], availableRiskOptions, industryProfile.defaultRisks));
			setSelectedCertifications(reconcileSelection([], availableCertificationOptions, industryProfile.defaultCertifications));
			setPtwInUse(true);
			setDailyToolboxTalk(true);
			setOnsiteClinicAvailable(false);
			setLastAuditDate('');

			setSelectedKpis(reconcileSelection(FREE_DEFAULT_KPIS, availableKpiOptions, industryProfile.defaultKpis).slice(0, FREE_KPI_LIMIT));
			setCustomKpiInputs(['']);
			setCriticalClosureSlaHours(24);
			setStandardClosureSlaHours(72);
			setKpiReportingCadence('Monthly');
			return;
		}

		if (isProPlan) {
			setSelectedModules(PRO_DEFAULT_MODULES);
			setSiteCount((prev) => Math.min(Math.max(prev || 1, 1), PRO_PLAN_LIMITS.sites));
			setZoneCount((prev) => Math.min(Math.max(prev || 1, 1), PRO_PLAN_LIMITS.zones));
			setActiveWorkers(PRO_PLAN_LIMITS.activeWorkers);
			setEmployeeCount((prev) => Math.min(Math.max(prev || 1, 1), PRO_PLAN_LIMITS.employees));
			setContractorCount((prev) => Math.min(Math.max(prev || 0, 0), PRO_PLAN_LIMITS.contractors));
			setLastAuditDate('');

			setSelectedKpis((prev) => reconcileSelection(prev, availableKpiOptions, industryProfile.defaultKpis).slice(0, PRO_KPI_LIMIT));
			setCustomKpiInputs(['']);
			setCriticalClosureSlaHours((prev) => Math.max(prev || 8, 1));
			setStandardClosureSlaHours((prev) => Math.max(prev || 48, 1));
			setKpiReportingCadence((prev) => prev || 'Weekly');
		}
	}, [isFreePlan, isProPlan, availableRiskOptions, availableCertificationOptions, availableKpiOptions, industryProfile]);

	useEffect(() => {
		if (canEditFullConfig) {
			setSelectedRisks((prev) => reconcileSelection(prev, availableRiskOptions, industryProfile.defaultRisks));
			setSelectedCertifications((prev) => reconcileSelection(prev, availableCertificationOptions, industryProfile.defaultCertifications));
		}

		if (canEditKpi) {
			setSelectedKpis((prev) => reconcileSelection(prev, availableKpiOptions, industryProfile.defaultKpis).slice(0, kpiSelectionLimit));
		}
	}, [industryProfile, canEditFullConfig, canEditKpi, availableRiskOptions, availableCertificationOptions, availableKpiOptions, kpiSelectionLimit]);

	useEffect(() => {
		const loadLayerOptions = async () => {
			try {
				setLayerOptionsError('');
				const response = await fetchOnboardingLayerOptions(countryCode);
				const nextGlobal = response.global_options || [];
				const nextCountry = response.country_options || [];

				setGlobalLayerOptions(nextGlobal);
				setCountryLayerOptions(nextCountry);

				setGlobalChecklistTypes((prev) => {
					const allowed = new Set(nextGlobal.map((o) => o.id));
					const kept = prev.filter((id) => allowed.has(id));
					if (kept.length > 0) return kept;
					return nextGlobal.length > 0 ? [nextGlobal[0].id] : [];
				});

				setCountryChecklistTypes((prev) => {
					const allowed = new Set(nextCountry.map((o) => o.id));
					const kept = prev.filter((id) => allowed.has(id));
					if (kept.length > 0) return kept;
					return nextCountry.length > 0 ? [nextCountry[0].id] : [];
				});
			} catch (err) {
				setGlobalLayerOptions([]);
				setCountryLayerOptions([]);
				setGlobalChecklistTypes([]);
				setCountryChecklistTypes([]);
				setLayerOptionsError(err instanceof Error ? err.message : 'Failed to load layer options');
			}
		};

		void loadLayerOptions();
	}, [countryCode]);

	useEffect(() => {
		const merged = Array.from(new Set([
			...globalChecklistTypes,
			...(useCountryLayer ? countryChecklistTypes : []),
		]));
		setSelectedChecklistTypes(merged);
	}, [globalChecklistTypes, countryChecklistTypes, useCountryLayer]);

	const country = useMemo(() => COUNTRY_OPTIONS.find((c) => c.code === countryCode) ?? COUNTRY_OPTIONS[0], [countryCode]);
	const toggle = (cur: string[], val: string, set: (v: string[]) => void) => set(cur.includes(val) ? cur.filter((i) => i !== val) : [...cur, val]);
	const setCustomKpiValue = (index: number, value: string) => {
		setCustomKpiInputs((prev) => prev.map((item, i) => (i === index ? value : item)));
	};
	const setEmergencyContactField = (index: number, key: 'name' | 'phone', value: string) => {
		setEmergencyContacts((prev) => prev.map((contact, i) => (i === index ? { ...contact, [key]: value } : contact)));
	};
	const addEmergencyContact = () => {
		setEmergencyContacts((prev) => [...prev, { name: '', phone: '' }]);
	};
	const removeEmergencyContact = (index: number) => {
		setEmergencyContacts((prev) => (prev.length <= 1 ? [{ name: '', phone: '' }] : prev.filter((_, i) => i !== index)));
	};
	const addCustomKpiInput = () => {
		setCustomKpiInputs((prev) => [...prev, '']);
	};
	const removeCustomKpiInput = (index: number) => {
		setCustomKpiInputs((prev) => (prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index)));
	};

	const backToLogin = () => {
		navigate('/auth/login', { replace: true });
	};

	const exitAdminToLogin = () => {
		logout();
		navigate('/auth/login?force=1', { replace: true });
	};

	useEffect(() => {
		if (view !== 'admin') return;

		window.history.pushState({ adminPanelGuard: true }, '', window.location.href);

		const onPopState = () => {
			logout();
			navigate('/auth/login?force=1', { replace: true });
		};

		window.addEventListener('popstate', onPopState);
		return () => {
			window.removeEventListener('popstate', onPopState);
		};
	}, [view, logout, navigate]);

	const validateStep = (step: number) => {
		const normalizedCustomKpis = customKpiInputs.map((kpi) => kpi.trim()).filter(Boolean);
		const normalizedEmergencyContacts = emergencyContacts
			.map((contact) => ({ name: contact.name.trim(), phone: contact.phone.trim() }))
			.filter((contact) => contact.name || contact.phone);
		if (step === 0) {
			if (!companyName.trim()) return 'Please enter company name.';
			if (!useCountryLayer && !useOrgLayer) return 'Enable Country or Organization layer.';
			if (globalLayerOptions.length > 0 && !globalChecklistTypes.length) return 'Select at least one Global layer item from AI feeding data.';
			if (useCountryLayer && countryLayerOptions.length > 0 && !countryChecklistTypes.length) return 'Select at least one Country layer item from AI feeding data.';
			if (!selectedChecklistTypes.length) return 'No selectable layer data found. Add files under AI feeding Data/global (and country folder if needed).';
		}
		if (step === 1) { if (!selectedChecklistTypes.length) return 'Select at least one checklist.'; if (!selectedModules.length) return 'Select at least one module.'; if (siteCount < 1 || zoneCount < 1 || activeWorkers < 1) return 'Counts must be > 0.'; }
		if (step === 2 && canEditFullConfig && !selectedRisks.length) return 'Select at least one high-risk activity.';
		if (step === 3) {
			if (!normalizedEmergencyContacts.length) return 'Provide at least one emergency contact.';
			const invalidEmergency = normalizedEmergencyContacts.find((contact) => !contact.name || !PHONE_REGEX.test(contact.phone));
			if (invalidEmergency) return 'Each emergency contact needs name and valid phone with country code, e.g. +919876543210.';
			if (!adminName.trim()) return 'Enter admin name.';
			if (!EMAIL_REGEX.test(adminEmail.trim().toLowerCase())) return 'Enter a valid admin email.';
			if (!PHONE_REGEX.test(adminPhone.trim())) return 'Admin phone must include country code, e.g. +919876543210.';
		}
		if (step === 4) {
			if (canEditKpi && !selectedKpis.length && !normalizedCustomKpis.length) return 'Select at least one KPI or add a custom KPI for your HSE environment.';
			if (selectedKpis.length > kpiSelectionLimit) return `Selected KPI count exceeds plan limit (${kpiSelectionLimit}).`;
			if (criticalClosureSlaHours < 1 || standardClosureSlaHours < 1) return 'SLA hours must be greater than 0.';
			if (!acceptDataPolicy || !confirmLeadershipCommitment) return 'Accept declarations to continue.';
		}
		if (step === 5) {
			// Informational tier summary step; no extra validation required.
		}
		return '';
	};

	const handleNext = () => {
		if (currentStep >= FORM_STEPS - 1) {
			return;
		}
		const e = validateStep(currentStep);
		if (e) { setError(e); return; }
		setError('');
		setCurrentStep((s) => Math.min(s + 1, FORM_STEPS - 1));
	};
	const handlePrev = () => { setError(''); setCurrentStep((s) => Math.max(s - 1, 0)); };

	const handleSubmit = async () => {
		for (let s = 0; s < FORM_STEPS; s++) { const e = validateStep(s); if (e) { setError(e); setCurrentStep(s); return; } }
		setError(''); setIsSubmitting(true);
		try {
			const normalizedAdminEmail = adminEmail.trim().toLowerCase();
			const trialEndsAt = new Date(Date.now() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
			const normalizedEmergencyContacts = emergencyContacts
				.map((contact) => ({ name: contact.name.trim(), phone: contact.phone.trim() }))
				.filter((contact) => contact.name && contact.phone);
			const primaryEmergencyContact = normalizedEmergencyContacts[0] || { name: '', phone: '' };
			const normalizedCustomKpis = customKpiInputs.map((kpi) => kpi.trim()).filter(Boolean);
			const baseKpis = Array.from(new Set((canEditKpi ? selectedKpis : FREE_DEFAULT_KPIS).slice(0, kpiSelectionLimit)));
			const allSelectedKpis = Array.from(new Set([...baseKpis, ...(canEditCustomKpi ? normalizedCustomKpis : [])]));
			const dataLabelPrefix = industryProfile.taxonomy.dataLabelPrefix;
			const toLabeledItem = (category: 'risk' | 'certification' | 'kpi', value: string) => ({
				label: `${dataLabelPrefix}:${category}:${slugifyLabel(value)}`,
				value,
			});
			const tempPassword = generateTempPassword(normalizedAdminEmail);
			const result = await submitClientOnboarding({
				company_name: companyName.trim(), country_code: country.code, country_name: country.name,
				use_global_layer: true, use_country_layer: useCountryLayer, use_org_layer: useOrgLayer,
				selected_checklist_types: selectedChecklistTypes, selected_modules: selectedModules,
				site_count: siteCount, zone_count: zoneCount, active_workers: activeWorkers,
				admin_name: adminName.trim(), admin_email: normalizedAdminEmail, admin_phone: adminPhone.trim(),
				requirements_notes: JSON.stringify({
					profile: {
						industry_type: industryType,
						subscription_plan: subscriptionPlan,
						employee_count: employeeCount,
						contractor_count: contractorCount,
						shift_pattern: shiftPattern,
						operational_languages: 'English',
					},
					industry_taxonomy: {
						version: 'v1',
						selected_industry: industryType,
						sector: industryProfile.taxonomy.sector,
						label_prefix: dataLabelPrefix,
						tags: {
							risk_domains: industryProfile.taxonomy.riskDomainTags,
							compliance_frameworks: industryProfile.taxonomy.complianceFrameworkTags,
							kpi_themes: industryProfile.taxonomy.kpiThemeTags,
						},
						catalogs: {
							risk_options: availableRiskOptions,
							certification_options: availableCertificationOptions,
							kpi_options: availableKpiOptions,
						},
						labeled_selections: {
							high_risk_activities: selectedRisks.map((item) => toLabeledItem('risk', item)),
							certifications: selectedCertifications.map((item) => toLabeledItem('certification', item)),
							kpis: allSelectedKpis.map((item) => toLabeledItem('kpi', item)),
						},
					},
					plan_capabilities: {
						mode: isEnterprisePlan ? 'enterprise_full' : isProPlan ? 'pro_kpi_user' : 'free_user_only',
						can_edit_full_config: canEditFullConfig,
						can_edit_kpi: canEditKpi,
						can_edit_custom_kpi: canEditCustomKpi,
						kpi_selection_limit: kpiSelectionLimit,
						site_limit: planLimits?.sites ?? null,
						zone_limit: planLimits?.zones ?? null,
						active_worker_limit: planLimits?.activeWorkers ?? null,
						free_trial_days: isFreePlan ? FREE_TRIAL_DAYS : null,
						trial_ends_at: isFreePlan ? trialEndsAt : null,
						last_audit_editable: true,
						user_step_open: true,
					},
					governance_layers: {
						global_selected_checklists: globalChecklistTypes,
						country_selected_checklists: useCountryLayer ? countryChecklistTypes : [],
						global_options_source: 'AI feeding Data/global',
						country_options_source: `AI feeding Data/country/${country.code}`,
					},
					onboarding_artifacts: {
						auto_org_folder_provisioned: true,
					},
					risk_and_compliance: { high_risk_activities: selectedRisks, certifications: selectedCertifications, permit_to_work_in_use: ptwInUse, daily_toolbox_talk: dailyToolboxTalk, trir: incidentRate, last_audit_date: lastAuditDate },
					emergency_readiness: {
						emergency_focal_point: primaryEmergencyContact.name,
						emergency_contact_phone: primaryEmergencyContact.phone,
						emergency_contacts: normalizedEmergencyContacts,
						onsite_clinic_available: onsiteClinicAvailable,
						evacuation_drill_cadence: fireEvacuationDrillCadence,
					},
					admin_ownership: { admin_name: adminName.trim(), admin_email: normalizedAdminEmail, admin_phone: adminPhone.trim(), admin_designation: adminDesignation },
					implementation: { target_go_live_date: goLiveTargetDate, integration_needs: integrationNeeds, training_plan: trainingPlan },
					kpi_sla: {
						selected_kpis: allSelectedKpis,
						custom_kpis: canEditCustomKpi ? normalizedCustomKpis : [],
						reporting_cadence: kpiReportingCadence,
						sla_targets: {
							critical_action_closure_hours: criticalClosureSlaHours,
							standard_action_closure_hours: standardClosureSlaHours,
						},
					},
					declarations: { data_policy_accepted: acceptDataPolicy, leadership_commitment_confirmed: confirmLeadershipCommitment },
					usage_window: {
						free_plan_trial_days: isFreePlan ? FREE_TRIAL_DAYS : null,
						trial_ends_at: isFreePlan ? trialEndsAt : null,
					},
					custom_notes: requirementsNotes.trim(),
				}, null, 2),
			});

			// Auto-provision account with temporary password and route straight into HSE dashboard.
			let provisioned = await signup(normalizedAdminEmail, tempPassword);
			if (provisioned !== 'success') {
				// If account already exists, try temp-password login once.
				provisioned = await login(normalizedAdminEmail, tempPassword);
			}

			if (provisioned === 'success') {
				navigate('/', { replace: true });
				setIsSubmitting(false);
				return;
			}

			setSubmissionSuccess({ onboardingUuid: result.onboarding_uuid, orgCode: result.org_code, tempPassword });
			setIsSubmitting(false);
		} catch (err) {
			const msg = err instanceof Error ? err.message : '';
			setError(msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') ? 'Cannot reach backend. Start backend on port 5000.' : msg || 'Submission failed.');
			setIsSubmitting(false);
		}
	};

	/* ═══════ ADMIN VIEW ═══════ */
	if (view === 'admin') {
		return (
			<div className="ob-page">
				<Header onAction={exitAdminToLogin} actionLabel={<><ArrowLeft size={14} /> Exit Admin</>} badge="Product Owner Dashboard" />
				<AdminView />
			</div>
		);
	}

	if (view === 'tracker') {
		return (
			<div className="ob-page">
				<Header onAction={backToLogin} actionLabel={<><ArrowLeft size={14} /> Back</>} badge="Customer Request Tracker" />
				<RequestTracker />
			</div>
		);
	}

	/* ═══════ ONBOARDING FLOW ═══════ */
	return (
		<div className="ob-page">
			<Header onAction={backToLogin} actionLabel={<><ArrowLeft size={14} /> Back</>} badge={currentStep === INFO_STEP_INDEX ? 'Plan Benefits (Info)' : `Step ${currentStep + 1} / ${FORM_STEPS}`} />
			<div className="ob-flow-layout">
				{/* Sidebar */}
				<nav className="ob-sidebar">
					<div className="ob-sidebar-title">Onboarding Steps</div>
					{STEPS.map((s, i) => (
						<button
							type="button"
							key={s.name}
							onClick={() => setCurrentStep(i)}
							className={`ob-sidebar-step ${i === currentStep ? 'active' : ''} ${(i < currentStep && i < FORM_STEPS) ? 'completed' : ''}`}
							style={{ width: '100%', textAlign: 'left' }}
						>
							<div className="ob-sidebar-num">{(i < currentStep && i < FORM_STEPS) ? <Check size={13} /> : i + 1}</div>
							<div className="ob-sidebar-step-info">
								<span className="ob-sidebar-step-name">{s.name}</span>
								<span className="ob-sidebar-step-desc">{s.desc}</span>
							</div>
						</button>
					))}
				</nav>

				{/* Main content */}
				<div className="ob-main" key={currentStep}>
					{currentStep !== INFO_STEP_INDEX && (
						<div className="ob-progress-bar"><div className="ob-progress-fill" style={{ width: `${((Math.min(currentStep, FORM_STEPS - 1) + 1) / FORM_STEPS) * 100}%` }} /></div>
					)}

					{currentStep === 0 && <Step0 {...{ kbFiles, setKbFiles, companyName, setCompanyName, countryCode, setCountryCode, industryType, setIndustryType, subscriptionPlan, setSubscriptionPlan, useCountryLayer, setUseCountryLayer, useOrgLayer, setUseOrgLayer, globalLayerOptions, countryLayerOptions, globalChecklistTypes, setGlobalChecklistTypes, countryChecklistTypes, setCountryChecklistTypes, selectedCertifications, setSelectedCertifications, certificationOptions: availableCertificationOptions, layerOptionsError, toggle, canEditFullConfig, isProPlan }} />}
					{currentStep === 1 && <Step1 {...{ selectedChecklistTypes, setSelectedChecklistTypes, selectedModules, setSelectedModules, siteCount, setSiteCount, zoneCount, setZoneCount, activeWorkers, setActiveWorkers, roleBreakdown, setRoleBreakdown, showRoleDrilldown, setShowRoleDrilldown, employeeCount, setEmployeeCount, contractorCount, setContractorCount, shiftPattern, setShiftPattern, toggle, canEditFullConfig, canEditModules, isProPlan, planLimits }} />}
					{currentStep === 2 && <Step2 {...{ industryType, riskOptions: availableRiskOptions, selectedRisks, setSelectedRisks, ptwInUse, setPtwInUse, dailyToolboxTalk, setDailyToolboxTalk, onsiteClinicAvailable, setOnsiteClinicAvailable, incidentRate, setIncidentRate, lastAuditDate, setLastAuditDate, fireEvacuationDrillCadence, setFireEvacuationDrillCadence, toggle, canEditFullConfig, canEditLastAudit, canEditIncidentRate, isProPlan }} />}
					{currentStep === 3 && <Step3 {...{ emergencyContacts, setEmergencyContactField, addEmergencyContact, removeEmergencyContact, goLiveTargetDate, setGoLiveTargetDate, integrationNeeds, setIntegrationNeeds, trainingPlan, setTrainingPlan, requirementsNotes, setRequirementsNotes, adminName, setAdminName, adminEmail, setAdminEmail, adminPhone, setAdminPhone, adminDesignation, setAdminDesignation }} />}
					{currentStep === 4 && <Step4 {...{ industryType, kpiOptions: availableKpiOptions, selectedKpis, setSelectedKpis, customKpiInputs, setCustomKpiValue, addCustomKpiInput, removeCustomKpiInput, criticalClosureSlaHours, setCriticalClosureSlaHours, standardClosureSlaHours, setStandardClosureSlaHours, kpiReportingCadence, setKpiReportingCadence, acceptDataPolicy, setAcceptDataPolicy, confirmLeadershipCommitment, setConfirmLeadershipCommitment, toggle, canEditKpi, canEditCustomKpi, kpiSelectionLimit, isProPlan, isEnterprisePlan, isFreePlan }} />}
					{currentStep === 5 && <Step5 subscriptionPlan={subscriptionPlan} />}

					{error && <div className="ob-error">{error}</div>}

					<div className="ob-footer">
						<button type="button" onClick={currentStep === INFO_STEP_INDEX ? () => setCurrentStep(FORM_STEPS - 1) : handlePrev} disabled={currentStep === 0} className="ob-btn-secondary"><ArrowLeft size={14} /> {currentStep === INFO_STEP_INDEX ? 'Back to Form' : 'Previous'}</button>
						{currentStep === INFO_STEP_INDEX ? (
							<button type="button" onClick={() => setCurrentStep(FORM_STEPS - 1)} className="ob-btn-primary">Go to Submission Step <ArrowRight size={14} /></button>
						) : currentStep < FORM_STEPS - 1 ? (
							<button type="button" onClick={handleNext} className="ob-btn-primary">Continue <ArrowRight size={14} /></button>
						) : (
							<button type="button" onClick={handleSubmit} disabled={isSubmitting} className="ob-btn-primary">{isSubmitting ? 'Submitting…' : 'Submit Onboarding'} {!isSubmitting && <CheckCircle2 size={15} />}</button>
						)}
					</div>
				</div>
			</div>
			{submissionSuccess && (
				<div className="ob-modal-overlay" onClick={() => setSubmissionSuccess(null)}>
					<div className="ob-modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
						<div className="ob-modal-header">
							<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
								<CheckCircle2 size={22} color="#2E7D32" />
								<h2 style={{ margin: 0 }}>Onboarding Submitted</h2>
							</div>
							<button onClick={() => setSubmissionSuccess(null)} className="ob-modal-close"><X size={20} /></button>
						</div>
						<div className="ob-modal-body" style={{ display: 'grid', gap: 12 }}>
							<p style={{ margin: 0, color: 'var(--text-secondary)' }}>
								Onboarding completed successfully. Your environment will be ready soon, and you will receive an acknowledgement email from our team.
							</p>
							{(subscriptionPlan === 'Pro' || subscriptionPlan === 'Enterprise') && (
								<div style={{ background: '#FFF8E1', border: '1px solid #FFE0B2', borderRadius: 8, padding: 12, fontSize: 13, color: '#8A6D3B' }}>
									<b>Next Step:</b> Payment verification pending for {subscriptionPlan} plan. Please wait for product admin approval after onboarding review.
								</div>
							)}
							<div style={{ background: '#f6fbf6', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13 }}>
								<div><b>Request ID:</b> {submissionSuccess.onboardingUuid}</div>
								<div><b>Org Code:</b> {submissionSuccess.orgCode}</div>
								{submissionSuccess.tempPassword && <div><b>Temporary Password:</b> {submissionSuccess.tempPassword}</div>}
							</div>
							<p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
								Use this temp password if you are sent to login. You can change it after sign-in.
							</p>
						</div>
						<div className="ob-modal-footer" style={{ justifyContent: 'flex-end' }}>
							<button type="button" onClick={() => { setSubmissionSuccess(null); openHseApp(); }} className="ob-btn-modal-proceed">
								Go to HSE App
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

/* ═══════ Header ═══════ */
function Header({ onAction, actionLabel, badge }: { onAction: () => void; actionLabel: any; badge?: string }) {
	return (
		<header className="ob-header">
			<div className="ob-header-brand">
				<img src="/logo.png" alt="HSE logo" className="ob-header-logo" />
				<span>THETA</span><span className="brand-accent">AI</span><span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>HSE Platform</span>
			</div>
			<div className="ob-header-right">
				{badge && <span className="ob-step-badge">{badge}</span>}
				<button type="button" onClick={onAction} className="ob-header-btn">{actionLabel}</button>
			</div>
		</header>
	);
}

/* ═══════ Shared Components ═══════ */
function DropdownMultiSelect({ label, options, selected, onToggle, disabled, placeholder = "Select option(s)..." }: { label: string; options: { label: string; value: string }[] | string[]; selected: string[]; onToggle: (val: string) => void; disabled?: boolean; placeholder?: string }) {
	const [open, setOpen] = useState(false);
	return (
		<div style={{ position: 'relative', marginBottom: '16px', width: '100%' }}>
			<span className="ob-field-label">{label}</span>
			<div
				className={`ob-select ${disabled ? 'disabled' : ''}`}
				onClick={() => !disabled && setOpen(!open)}
				style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer', background: disabled ? '#f3f4f6' : '#fff' }}
			>
				<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px' }}>
					{selected.length > 0 ? `${selected.length} selected` : placeholder}
				</span>
				<span style={{ fontSize: '10px' }}>▼</span>
			</div>
			{open && !disabled && (
				<>
					<div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }} onClick={() => setOpen(false)} />
					<div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
						{options.length > 0 ? options.map((opt: any) => {
							const optLabel = typeof opt === 'string' ? opt : opt.label;
							const optValue = typeof opt === 'string' ? opt : opt.value;
							const isChecked = selected.includes(optValue);
							return (
								<label key={optValue} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', margin: 0 }}>
									<input
										type="checkbox"
										checked={isChecked}
										onChange={() => onToggle(optValue)}
										style={{ marginRight: '8px' }}
									/>
									<span style={{ fontSize: '14px', color: '#374151' }}>{optLabel}</span>
								</label>
							);
						}) : <div style={{ padding: '8px 12px', fontSize: '14px', color: '#9CA3AF' }}>No options available</div>}
					</div>
				</>
			)}
		</div>
	);
}

/* ═══════ Step Components ═══════ */
function Step0(p: any) {
	return (<>
		<div className="ob-section-header"><h2><Factory size={20} /> Organization Footprint</h2><p>Define your foundational profile and governance layers</p></div>
		{!p.canEditFullConfig && (
			<div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
				{p.isProPlan ? 'Pro plan: core configuration is active with controlled limits.' : 'Free plan: controls are visible but locked, with starter limits and trial window.'}
			</div>
		)}
		<div className="ob-fields-2">
			<Field label="Organization Name"><input value={p.companyName} onChange={(e: any) => p.setCompanyName(e.target.value)} placeholder="Enter company name" className="ob-input" /></Field>
			<Field label="Country"><select value={p.countryCode} onChange={(e: any) => p.setCountryCode(e.target.value)} className="ob-select" disabled={!p.canEditFullConfig}>{COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></Field>
			<Field label="Industry Type"><select value={p.industryType} onChange={(e: any) => p.setIndustryType(e.target.value)} className="ob-select">{INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}</select></Field>
			<Field label="Subscription Plan"><select value={p.subscriptionPlan} onChange={(e: any) => p.setSubscriptionPlan(e.target.value)} className="ob-select">{SUBSCRIPTION_PLAN_OPTIONS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}</select></Field>
		</div>
		<div className="ob-tags-group">
			<span className="ob-tags-label" style={{ fontSize: '15px', color: '#111827', marginBottom: '12px', display: 'block', fontWeight: 600 }}>Governance Hierarchy</span>
			
			<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
				{/* Global Layer Card */}
				<div className="ob-layer-card" style={{ padding: '16px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<Tag text="Global Layer" active disabled forceOn />
							<span style={{ fontSize: '12px', color: '#6b7280' }}>Foundational HSE standards</span>
						</div>
					</div>
					<div style={{ width: '100%', maxWidth: '400px' }}>
						{p.globalLayerOptions?.length > 0 ? (
							<DropdownMultiSelect 
								label="Select Global Checklists" 
								options={p.globalLayerOptions.map((o: any) => ({ label: o.label, value: o.id }))} 
								selected={p.globalChecklistTypes} 
								onToggle={p.canEditFullConfig ? (val) => p.toggle(p.globalChecklistTypes, val, p.setGlobalChecklistTypes) : () => {}} 
								disabled={!p.canEditFullConfig} 
							/>
						) : (
							<small style={{ color: '#9CA3AF' }}>No global layer files found.</small>
						)}
					</div>
				</div>

				{/* Country Layer Card */}
				<div className="ob-layer-card" style={{ padding: '16px', background: p.useCountryLayer ? '#ffffff' : '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: p.useCountryLayer ? '0 2px 4px rgba(0,0,0,0.02)' : 'none', transition: 'all 0.2s' }}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: p.useCountryLayer ? '12px' : '0' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<Tag text={`Country Layer (${p.countryCode})`} active={p.useCountryLayer} onClick={p.canEditFullConfig ? () => p.setUseCountryLayer((v: boolean) => !v) : undefined} disabled={!p.canEditFullConfig} />
							<span style={{ fontSize: '12px', color: '#6b7280' }}>Region-specific compliance</span>
						</div>
					</div>
					{p.useCountryLayer && (
						<div style={{ width: '100%', maxWidth: '400px' }}>
							{p.countryLayerOptions?.length > 0 ? (
								<DropdownMultiSelect 
									label="Select Country Checklists" 
									options={p.countryLayerOptions.map((o: any) => ({ label: o.label, value: o.id }))} 
									selected={p.countryChecklistTypes} 
									onToggle={p.canEditFullConfig ? (val) => p.toggle(p.countryChecklistTypes, val, p.setCountryChecklistTypes) : () => {}} 
									disabled={!p.canEditFullConfig} 
								/>
							) : (
								<small style={{ color: '#9CA3AF' }}>No country files found.</small>
							)}
						</div>
					)}
				</div>

				{/* Organization Layer Card */}
				<div className="ob-layer-card" style={{ padding: '16px', background: p.useOrgLayer ? '#ffffff' : '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: p.useOrgLayer ? '0 2px 4px rgba(0,0,0,0.02)' : 'none', transition: 'all 0.2s' }}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: p.useOrgLayer ? '12px' : '0' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<Tag text="Organization Layer" active={p.useOrgLayer} onClick={p.canEditFullConfig ? () => p.setUseOrgLayer((v: boolean) => !v) : undefined} disabled={!p.canEditFullConfig} />
							<span style={{ fontSize: '12px', color: '#6b7280' }}>Company-specific knowledge</span>
						</div>
					</div>
					{p.useOrgLayer && (
						<div style={{ width: '100%', maxWidth: '400px' }}>
							<Field label="Knowledgebase Data Upload">
								<input 
									type="file" 
									multiple 
									disabled={!p.canEditFullConfig}
									onChange={(e) => {
										if (e.target.files) {
											p.setKbFiles?.(Array.from(e.target.files));
										}
									}}
									className="ob-input" 
									style={{ padding: '8px' }} 
									title="Upload data files for Knowledgebase"
								/>
								<small style={{ color: '#9CA3AF', display: 'block', marginTop: '4px' }}>Upload PDFs, Docs, or text files.</small>
							</Field>
						</div>
					)}
				</div>
			</div>
		</div>

		<div className="ob-tags-group" style={{ marginTop: '24px' }}>
			<span className="ob-tags-label" style={{ fontSize: '15px', color: '#111827', marginBottom: '12px', display: 'block', fontWeight: 600 }}>Certification Alignment</span>
			<div className="ob-layer-card" style={{ padding: '16px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<Tag text="Certifications & Compliance" active disabled forceOn />
						<span style={{ fontSize: '12px', color: '#6b7280' }}>Select applicable standards</span>
					</div>
				</div>
				<div style={{ width: '100%', maxWidth: '400px' }}>
					<DropdownMultiSelect 
						label="Select Certifications" 
						options={p.certificationOptions || []} 
						selected={p.selectedCertifications} 
						onToggle={p.canEditFullConfig ? (val) => p.toggle(p.selectedCertifications, val, p.setSelectedCertifications) : () => {}} 
						disabled={!p.canEditFullConfig} 
					/>
				</div>
			</div>
		</div>

		{p.layerOptionsError && (
			<div className="ob-error">{p.layerOptionsError}</div>
		)}
	</>);
}

function Step1(p: any) {
	const clamp = (value: number, min: number, max?: number) => {
		if (!Number.isFinite(value)) return min;
		const lowerBound = Math.max(value, min);
		return typeof max === 'number' ? Math.min(lowerBound, max) : lowerBound;
	};

	const handleRoleChange = (role: string, val: number) => {
		const newRoles = { ...p.roleBreakdown, [role]: val };
		p.setRoleBreakdown(newRoles);
		const newTotal = Object.values(newRoles).reduce((a:any, b:any) => a + b, 0) as number;
		p.setActiveWorkers(clamp(newTotal, 1, p.planLimits?.activeWorkers));
	};

	const recalculateRolesFromTotal = (newTotal: number) => {
		const clampedTotal = clamp(newTotal, 1, p.planLimits?.activeWorkers);
		p.setActiveWorkers(clampedTotal);
		const totalOld = (Object.values(p.roleBreakdown).reduce((a:any, b:any) => a + b, 0) as number) || 1;
		const admin = Math.max(1, Math.round((p.roleBreakdown.admin / totalOld) * clampedTotal));
		const engineer = Math.max(1, Math.round((p.roleBreakdown.engineer / totalOld) * clampedTotal));
		const inspector = Math.max(1, Math.round((p.roleBreakdown.inspector / totalOld) * clampedTotal));
		const contractor = Math.max(1, Math.round((p.roleBreakdown.contractor / totalOld) * clampedTotal));
		p.setRoleBreakdown({
			admin,
			engineer,
			inspector,
			contractor,
			worker: Math.max(1, clampedTotal - admin - engineer - inspector - contractor)
		});
	};

	return (<>
		<div className="ob-section-header"><h2><ClipboardCheck size={20} /> Modules & Scale</h2><p>Activate modules and define your workforce size</p></div>
		<div className="ob-tags-group">
			<span className="ob-tags-label" style={{ fontSize: '15px', color: '#111827', marginBottom: '12px', display: 'block', fontWeight: 600 }}>Active Modules</span>
			<div className="ob-tags-wrap">{MODULE_OPTIONS.map((m) => <Tag key={m} text={m} active={p.selectedModules.includes(m)} onClick={p.canEditModules ? () => p.toggle(p.selectedModules, m, p.setSelectedModules) : undefined} disabled={!p.canEditModules} />)}</div>
		</div>
		{p.planLimits && (
			<div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
				<strong>Plan limits</strong> → Sites: {p.planLimits.sites} | Zones: {p.planLimits.zones} | Active Users: {p.planLimits.activeWorkers}
			</div>
		)}
		<div className="ob-fields-2">
			<Field label="Sites"><input type="number" min={1} max={p.planLimits?.sites} value={p.siteCount} onChange={(e: any) => p.setSiteCount(clamp(Number(e.target.value) || 1, 1, p.planLimits?.sites))} className="ob-input" disabled={!p.canEditFullConfig} /></Field>
			<Field label="Zones"><input type="number" min={1} max={p.planLimits?.zones} value={p.zoneCount} onChange={(e: any) => p.setZoneCount(clamp(Number(e.target.value) || 1, 1, p.planLimits?.zones))} className="ob-input" disabled={!p.canEditFullConfig} /></Field>
		</div>

		{/* Active Workers Drill-down inside a Card */}
		<div className="ob-layer-card" style={{ padding: '20px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginTop: '16px' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (p.showRoleDrilldown || !p.canEditModules) ? '16px' : '0' }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', maxWidth: '300px' }}>
					<Field label="Total Active Workers">
						<input type="number" min={1} max={p.planLimits?.activeWorkers} value={p.activeWorkers} onChange={(e: any) => recalculateRolesFromTotal(Number(e.target.value) || 1)} className="ob-input" disabled={!p.canEditModules} style={{ height: '42px' }} />
					</Field>
				</div>
				{p.canEditModules && (
					<button 
						type="button" 
						onClick={() => p.setShowRoleDrilldown(!p.showRoleDrilldown)} 
						className="ob-btn-secondary" 
						style={{ height: '42px', marginTop: '22px' }}
					>
						{p.showRoleDrilldown ? 'Hide Roles' : 'Edit Roles Breakdown'}
					</button>
				)}
			</div>

			{(p.showRoleDrilldown || !p.canEditModules) && (
				<div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
					<div className="ob-fields-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
						<Field label="Admin">
							<input type="number" min={1} value={p.roleBreakdown?.admin || 1} onChange={(e: any) => handleRoleChange('admin', Number(e.target.value) || 1)} className="ob-input" style={{ height: '38px', fontSize: '13px' }} disabled={!p.canEditModules} />
						</Field>
						<Field label="Site Engineers">
							<input type="number" min={1} value={p.roleBreakdown?.engineer || 1} onChange={(e: any) => handleRoleChange('engineer', Number(e.target.value) || 1)} className="ob-input" style={{ height: '38px', fontSize: '13px' }} disabled={!p.canEditModules} />
						</Field>
						<Field label="Site Inspectors">
							<input type="number" min={1} value={p.roleBreakdown?.inspector || 1} onChange={(e: any) => handleRoleChange('inspector', Number(e.target.value) || 1)} className="ob-input" style={{ height: '38px', fontSize: '13px' }} disabled={!p.canEditModules} />
						</Field>
						<Field label="Workers">
							<input type="number" min={1} value={p.roleBreakdown?.worker || 1} onChange={(e: any) => handleRoleChange('worker', Number(e.target.value) || 1)} className="ob-input" style={{ height: '38px', fontSize: '13px' }} disabled={!p.canEditModules} />
						</Field>
						<Field label="Contractors">
							<input type="number" min={1} value={p.roleBreakdown?.contractor || 1} onChange={(e: any) => handleRoleChange('contractor', Number(e.target.value) || 1)} className="ob-input" style={{ height: '38px', fontSize: '13px' }} disabled={!p.canEditModules} />
						</Field>
					</div>
					<div style={{ marginTop: '12px', fontSize: '12px', color: '#6b7280', textAlign: 'right' }}>
						Total sums to: <strong>{(p.roleBreakdown?.admin || 0) + (p.roleBreakdown?.engineer || 0) + (p.roleBreakdown?.inspector || 0) + (p.roleBreakdown?.worker || 0) + (p.roleBreakdown?.contractor || 0)}</strong>
					</div>
				</div>
			)}
		</div>

		<div className="ob-fields-3" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column' }}>
			<Field label="Shift Pattern"><input value={p.shiftPattern} onChange={(e: any) => p.setShiftPattern(e.target.value)} placeholder="e.g. 2 shifts" className="ob-input" disabled={!p.canEditFullConfig} /></Field>
		</div>
	</>);
}

function Step2(p: any) {
	return (<>
		<div className="ob-section-header"><h2><Shield size={20} /> Knowledge & Compliance</h2><p>Capture knowledge inputs on risk profile and safety controls for {p.industryType} to power AI-driven HSE insights.</p></div>
		<div className="ob-tags-group">
			<span className="ob-tags-label">High-Risk Work Categories</span>
			<div className="ob-tags-wrap">{(p.riskOptions || []).map((r: string) => <Tag key={r} text={r} active={p.selectedRisks.includes(r)} onClick={p.canEditFullConfig ? () => p.toggle(p.selectedRisks, r, p.setSelectedRisks) : undefined} disabled={!p.canEditFullConfig} />)}</div>
		</div>
		<div className="ob-fields-3">
			<SelBool value={p.ptwInUse} onChange={p.setPtwInUse} label="Permit to Work" disabled={!p.canEditFullConfig} />
			<SelBool value={p.dailyToolboxTalk} onChange={p.setDailyToolboxTalk} label="Daily Toolbox Talk" disabled={!p.canEditFullConfig} />
			<SelBool value={p.onsiteClinicAvailable} onChange={p.setOnsiteClinicAvailable} label="Onsite Clinic" disabled={!p.canEditFullConfig} />
		</div>
		<div className="ob-fields-3">
				<Field label="Incident Frequency Rate (TRIR)"><input value={p.incidentRate} onChange={(e: any) => p.setIncidentRate(e.target.value)} className="ob-input" disabled={!p.canEditIncidentRate} /></Field>
			<Field label="Last Audit Date"><input type="date" value={p.lastAuditDate} onChange={(e: any) => p.setLastAuditDate(e.target.value)} className="ob-input" disabled={!p.canEditLastAudit} /></Field>
			<Field label="Evacuation Drill Cadence"><input value={p.fireEvacuationDrillCadence} onChange={(e: any) => p.setFireEvacuationDrillCadence(e.target.value)} className="ob-input" disabled={!p.canEditFullConfig} /></Field>
		</div>
	</>);
}

function Step3(p: any) {
	return (<>
		<div className="ob-section-header"><h2><Users size={20} /> Contact Info</h2><p>Capture emergency contacts, admin ownership, and rollout inputs in one step</p></div>
		<div className="ob-tags-group">
			<div className="flex items-center justify-between mb-2">
				<span className="ob-tags-label">Emergency Contacts</span>
				<button type="button" onClick={p.addEmergencyContact} className="ob-btn-secondary">+ Add Contact</button>
			</div>
			<div style={{ display: 'grid', gap: 8 }}>
				{p.emergencyContacts.map((contact: { name: string; phone: string }, index: number) => (
					<div key={`emergency-contact-${index}`} className="ob-fields-2" style={{ marginBottom: 0 }}>
						<Field label={`Emergency Contact Name ${index + 1}`}>
							<input value={contact.name} onChange={(e: any) => p.setEmergencyContactField(index, 'name', e.target.value)} placeholder="Name" className="ob-input" />
						</Field>
						<div>
							<Field label={`Emergency Contact Phone ${index + 1}`}>
								<input value={contact.phone} onChange={(e: any) => p.setEmergencyContactField(index, 'phone', e.target.value)} placeholder="+919876543210" className="ob-input" />
							</Field>
							<div style={{ marginTop: 6 }}>
								<button type="button" onClick={() => p.removeEmergencyContact(index)} className="ob-btn-secondary" disabled={p.emergencyContacts.length <= 1}>Remove</button>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
		<div className="ob-fields-2">
			<Field label="Primary Admin Name"><input value={p.adminName} onChange={(e: any) => p.setAdminName(e.target.value)} placeholder="Full name" className="ob-input" /></Field>
			<Field label="Admin Email"><input type="email" value={p.adminEmail} onChange={(e: any) => p.setAdminEmail(e.target.value)} placeholder="email@company.com" className="ob-input" /></Field>
			<Field label="Admin Phone"><input value={p.adminPhone} onChange={(e: any) => p.setAdminPhone(e.target.value)} placeholder="+919876543210" className="ob-input" /></Field>
			<Field label="Admin Designation"><input value={p.adminDesignation} onChange={(e: any) => p.setAdminDesignation(e.target.value)} className="ob-input" /></Field>
			<Field label="Target Go-Live Date"><input type="date" value={p.goLiveTargetDate} onChange={(e: any) => p.setGoLiveTargetDate(e.target.value)} className="ob-input" /></Field>
			<Field label="Integration Needs"><input value={p.integrationNeeds} onChange={(e: any) => p.setIntegrationNeeds(e.target.value)} placeholder="ERP, Access Control, etc." className="ob-input" /></Field>
		</div>
		<Field label="Training Plan"><textarea value={p.trainingPlan} onChange={(e: any) => p.setTrainingPlan(e.target.value)} placeholder="Describe the training plan" className="ob-textarea" /></Field>
		<Field label="Additional Notes"><textarea value={p.requirementsNotes} onChange={(e: any) => p.setRequirementsNotes(e.target.value)} placeholder="Any additional rollout notes or requirements…" className="ob-textarea" /></Field>
	</>);
}

function Step4(p: any) {
	const toggleKpiWithPlanLimit = (kpi: string) => {
		if (!p.canEditKpi) return;
		const alreadySelected = p.selectedKpis.includes(kpi);
		if (!alreadySelected && p.selectedKpis.length >= p.kpiSelectionLimit) return;
		p.toggle(p.selectedKpis, kpi, p.setSelectedKpis);
	};

	return (<>
		<div className="ob-section-header"><h2><Activity size={20} /> SLA / KPI Setup</h2><p>Select KPIs for {p.industryType} operations and define SLA targets</p></div>
		{!p.canEditKpi && (
			<div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
				Free plan: KPI/SLA is limited to default values.
			</div>
		)}
		{p.canEditKpi && !p.isEnterprisePlan && (
			<div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
				Plan KPI limit: {p.kpiSelectionLimit} category KPIs.
			</div>
		)}
		<div className="ob-tags-group">
			<span className="ob-tags-label">KPI Selection</span>
			<div className="ob-tags-wrap">
				{(p.kpiOptions || []).map((kpi: string) => (
					<Tag key={kpi} text={kpi} active={p.selectedKpis.includes(kpi)} onClick={p.canEditKpi ? () => toggleKpiWithPlanLimit(kpi) : undefined} disabled={!p.canEditKpi || (!p.selectedKpis.includes(kpi) && p.selectedKpis.length >= p.kpiSelectionLimit)} />
				))}
			</div>
		</div>
		<div className="ob-tags-group">
			<span className="ob-tags-label">Custom KPI</span>
			<div style={{ display: 'grid', gap: 8 }}>
				{p.customKpiInputs.map((value: string, index: number) => (
					<div key={`custom-kpi-${index}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<input
							type="text"
							value={value}
							onChange={(e: any) => p.setCustomKpiValue(index, e.target.value)}
							placeholder="Enter custom KPI"
							className="ob-input"
							disabled={!p.canEditCustomKpi}
						/>
						<button type="button" onClick={() => p.removeCustomKpiInput(index)} className="ob-btn-secondary" style={{ height: 40 }} disabled={!p.canEditCustomKpi}>Remove</button>
					</div>
				))}
				<div>
					<button type="button" onClick={p.addCustomKpiInput} className="ob-btn-secondary" disabled={!p.canEditCustomKpi}>+ Add KPI</button>
				</div>
			</div>
		</div>
		<div className="ob-fields-3">
			<Field label="Critical Action Closure SLA (hours)"><input type="number" min={1} value={p.criticalClosureSlaHours} onChange={(e: any) => p.setCriticalClosureSlaHours(Number(e.target.value) || 1)} className="ob-input" disabled={!p.canEditKpi} /></Field>
			<Field label="Standard Action Closure SLA (hours)"><input type="number" min={1} value={p.standardClosureSlaHours} onChange={(e: any) => p.setStandardClosureSlaHours(Number(e.target.value) || 1)} className="ob-input" disabled={!p.canEditKpi} /></Field>
			<Field label="KPI Reporting Cadence"><select value={p.kpiReportingCadence} onChange={(e: any) => p.setKpiReportingCadence(e.target.value)} className="ob-select" disabled={!p.canEditKpi}><option>Daily</option><option>Weekly</option><option>Monthly</option></select></Field>
		</div>
		<div className="ob-declarations">
			<label className="ob-checkbox-label">
				<input type="checkbox" checked={p.acceptDataPolicy} onChange={(e: any) => p.setAcceptDataPolicy(e.target.checked)} />
				<span><Lock size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />I confirm data shared here can be used for HSE onboarding configuration.</span>
			</label>
			<label className="ob-checkbox-label">
				<input type="checkbox" checked={p.confirmLeadershipCommitment} onChange={(e: any) => p.setConfirmLeadershipCommitment(e.target.checked)} />
				<span><Heart size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Leadership has approved this HSE digital rollout and governance model.</span>
			</label>
		</div>
	</>);
}

function Step5({ subscriptionPlan }: { subscriptionPlan: 'Free' | 'Pro' | 'Enterprise' }) {
	const tiers = [
		{
			name: 'Free',
			summary: 'Starter access with visible controls, locked edits, and trial usage window.',
			features: [
				'More labels visible in onboarding for guided setup',
				'No core config edits, fixed site/zone/user limits',
				'Trial period with category-based starter KPIs',
			],
		},
		{
			name: 'Pro',
			summary: 'Operational tier with all labels active and controlled limits.',
			features: [
				'Everything in Free',
				'All module labels active; last audit remains locked',
				'Expanded category KPI selection with user limits',
			],
		},
		{
			name: 'Enterprise',
			summary: 'Full governance, modules, and complete configurability.',
			features: [
				'Everything in Pro',
				'Full onboarding configuration control',
				'Advanced governance and customization',
			],
		},
	] as const;

	return (
		<>
			<div className="ob-section-header"><h2><Sparkles size={20} /> Plan Benefits</h2><p>Review what you get in each tier and your selected subscription</p></div>
			<div className="ob-fields-3" style={{ alignItems: 'stretch' }}>
				{tiers.map((tier) => {
					const isSelected = subscriptionPlan === tier.name;
					return (
						<div key={tier.name} style={{ border: isSelected ? '2px solid #2E7D32' : '1px solid #E5E7EB', borderRadius: 10, padding: 14, background: isSelected ? '#F6FBF6' : '#fff' }}>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
								<h3 style={{ margin: 0, fontSize: 16 }}>{tier.name}</h3>
								{isSelected && <span className="ob-chip" style={{ margin: 0 }}>Selected</span>}
							</div>
							<p style={{ margin: '0 0 10px 0', fontSize: 13, color: '#4B5563' }}>{tier.summary}</p>
							<ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#1F2937', display: 'grid', gap: 6 }}>
								{tier.features.map((f) => <li key={f}>{f}</li>)}
							</ul>
						</div>
					);
				})}
			</div>
		</>
	);
}

function RequestTracker() {
	const navigate = useNavigate();
	const [email, setEmail] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [statusData, setStatusData] = useState<RequestStatusResponse | null>(null);

	const openHseApp = () => {
		navigate('/auth/login', { replace: true });
	};

	const checkStatus = async () => {
		const normalized = email.trim().toLowerCase();
		if (!EMAIL_REGEX.test(normalized)) {
			setError('Please enter a valid email.');
			return;
		}
		setLoading(true);
		setError('');
		try {
			const response = await fetchRequestStatusByEmail(normalized);
			setStatusData(response);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch request status.');
			setStatusData(null);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div style={{ padding: 24, maxWidth: 980, width: '100%', margin: '0 auto' }}>
			<div className="ob-section-header" style={{ marginBottom: 16 }}>
				<h2><Users size={20} /> Customer Login / Request Tracker</h2>
				<p>Check your onboarding request status. After approval, login to HSE app and finish setup in Users module.</p>
			</div>

			<div className="ob-fields-2" style={{ marginBottom: 12 }}>
				<Field label="Admin Email">
					<input className="ob-input" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="admin@company.com" />
				</Field>
				<div style={{ display: 'flex', alignItems: 'end' }}>
					<button type="button" className="ob-btn-primary" onClick={checkStatus} disabled={loading}>
						{loading ? 'Checking...' : 'Check Status'}
					</button>
				</div>
			</div>

			{error && <div className="ob-error" style={{ marginBottom: 12 }}>{error}</div>}

			{statusData?.found && (
				<div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'grid', gap: 12 }}>
					<div style={{ display: 'grid', gap: 4 }}>
						<div><b>Organization:</b> {statusData.company_name}</div>
						<div><b>Request ID:</b> {statusData.onboarding_uuid}</div>
						<div><b>Status:</b> <span className={`ob-badge ob-badge-${(statusData.status || 'submitted').toLowerCase()}`}>{statusData.status}</span></div>
						<div><b>Modules:</b> {(statusData.selected_modules || []).join(', ') || 'N/A'}</div>
						<div><b>Checklists:</b> {(statusData.selected_checklist_types || []).join(', ') || 'N/A'}</div>
					</div>

					{statusData.status !== 'approved' && (
						<div style={{ fontSize: 13, color: 'var(--text-secondary)', background: '#f8faf8', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
							Your request is still under review. You’ll receive an approval email once your environment is ready.
						</div>
					)}

					{statusData.status === 'approved' && (
						<div style={{ display: 'grid', gap: 12 }}>
							<div style={{ fontSize: 13, color: 'var(--text-secondary)', background: '#f8faf8', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
								Your request is approved ✅<br />
								Now login to HSE web app using your admin email to:
								<ul style={{ marginTop: 8, paddingLeft: 18 }}>
									<li>add users and assign roles</li>
									<li>approve user access</li>
									<li>upload org/worker data from Users module</li>
								</ul>
								<div style={{ marginTop: 10 }}>
									<button
										type="button"
										onClick={openHseApp}
										className="ob-btn-primary"
									>
										Open HSE Dashboard
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{statusData && !statusData.found && (
				<div className="ob-error" style={{ background: '#fff8e1', borderColor: '#ffe0b2', color: '#8a6d3b' }}>
					{statusData.message || 'No request found with this email.'}
				</div>
			)}
		</div>
	);
}

/* ═══════ Shared Components ═══════ */
function Field({ label, children }: { label: string; children: any }) {
	return <div className="ob-field"><span className="ob-field-label">{label}</span>{children}</div>;
}
function Tag({ text, active, onClick, disabled, forceOn }: { text: string; active: boolean; onClick?: () => void; disabled?: boolean; forceOn?: boolean }) {
	return <button type="button" onClick={onClick} disabled={disabled} className={`ob-tag ${active ? 'active' : ''} ${forceOn ? 'force-on' : ''}`}>{text}</button>;
}
function SelBool({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
	return <div className="ob-select-bool"><span className="ob-field-label">{label}</span><select value={value ? 'yes' : 'no'} onChange={(e) => onChange(e.target.value === 'yes')} className="ob-select" disabled={disabled}><option value="yes">Yes</option><option value="no">No</option></select></div>;
}

/* ═══════ Admin View Component ═══════ */
function AdminView() {
	const [requests, setRequests] = useState<any[]>([]);
	const [processingQueue, setProcessingQueue] = useState<OnboardingProcessingQueueItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedReq, setSelectedReq] = useState<any | null>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [processingActionUuid, setProcessingActionUuid] = useState<string | null>(null);
	const [approvalInfo, setApprovalInfo] = useState('');
	const [processInfo, setProcessInfo] = useState('');
	const [adminError, setAdminError] = useState('');

	const toAdminMessage = (err: unknown, fallback: string) => {
		const msg = err instanceof Error ? err.message : '';
		const normalized = msg.toLowerCase();
		if (normalized.includes('forbidden') || normalized.includes('403')) {
			return 'Access denied. Only authorized Admin/Super Admin can manage onboarding requests.';
		}
		if (normalized.includes('unauthorized') || normalized.includes('401')) {
			return 'Session expired or unauthorized. Please sign in again with your admin account.';
		}
		return msg || fallback;
	};

	const loadAdminData = async () => {
		try {
			setAdminError('');
			const [requestData, queueData] = await Promise.all([
				fetchOnboardingRequests(),
				fetchOnboardingProcessingQueue(),
			]);
			const list = Array.isArray(requestData) ? requestData : (requestData.requests || []);
			setRequests(list);
			setProcessingQueue(Array.isArray(queueData?.requests) ? queueData.requests : []);
		} catch (err) {
			console.error('API failed:', err);
			setAdminError(toAdminMessage(err, 'Failed to load admin onboarding data.'));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadAdminData();
	}, []);

	const handleDelete = async (uuid: string) => {
		if (!window.confirm('Are you sure you want to delete this onboarding request?')) return;
		setActionLoading(uuid);
		try {
			setAdminError('');
			await deleteOnboardingRequest(uuid);
			await loadAdminData();
		} catch (err) {
			setAdminError(toAdminMessage(err, 'Failed to delete request.'));
		} finally {
			setActionLoading(null);
		}
	};

	const handleProceed = async (uuid: string) => {
		if (!window.confirm('Do you want to proceed and approve this organization?')) return;
		setActionLoading(uuid);
		setApprovalInfo('');
		setProcessInfo('');
		setAdminError('');
		try {
			const result = await updateOnboardingStatus(uuid, 'approved');
			const delivery = result?.email_delivery;
			if (delivery?.attempted) {
				setApprovalInfo(delivery.sent ? 'Approved and approval email sent.' : `Approved, but email failed: ${delivery.detail}`);
			}
			await loadAdminData();
			setSelectedReq(null);
		} catch (err) {
			setAdminError(toAdminMessage(err, 'Failed to approve request.'));
		} finally {
			setActionLoading(null);
		}
	};

	const handleStartProcessing = async (item: OnboardingProcessingQueueItem) => {
		if (!window.confirm(`Start environment setup + data processing for ${item.company_name}?`)) return;
		setProcessingActionUuid(item.onboarding_uuid);
		setProcessInfo('');
		setAdminError('');
		try {
			const result = await startOnboardingProcessing(item.onboarding_uuid);
			setProcessInfo(
				result.status === 'completed'
					? `Processing complete for ${item.company_name}. Data is ready for AI insights/KPI/checklist flows.`
					: `Processing finished with status: ${result.status}`,
			);
			await loadAdminData();
		} catch (err) {
			setAdminError(toAdminMessage(err, 'Failed to start processing.'));
		} finally {
			setProcessingActionUuid(null);
		}
	};

	const filtered = requests.filter((r) =>
		r.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
		r.admin_name?.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	const filteredQueue = processingQueue.filter((r) =>
		r.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
		r.admin_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
		r.org_code?.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	const readyToProcessCount = processingQueue.filter((item) => item.status === 'approved' && item.setup_ready).length;
	const completedProcessingCount = processingQueue.filter((item) => (item.processing?.status || '').toLowerCase() === 'completed').length;

	if (loading) return <div className="ob-admin-empty"><Activity className="animate-spin" /> Loading requests...</div>;

	return (
		<div className="ob-admin-view">
			<div className="ob-admin-container">
				<div className="ob-admin-hero">
					<div className="ob-admin-hero-copy">
						<span className="ob-admin-hero-kicker">Enterprise Control Center</span>
						<h2>Product Admin Panel</h2>
						<p>Manage onboarding lifecycle, approval governance, and tenant environment processing from a single operations console.</p>
					</div>
					<div className="ob-admin-hero-actions">
						<button type="button" className="ob-action-btn" onClick={() => loadAdminData()}>
							<RefreshCcw size={13} /> Refresh Data
						</button>
					</div>
				</div>

				<div className="ob-admin-header">
					<div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
						<h1><Users size={24} /> Onboarding Requests</h1>
						<div className="ob-chip" style={{ background: 'rgba(165,214,165,0.1)', borderColor: 'rgba(165,214,165,0.2)', color: '#2E7D32' }}>
							<Activity size={12} /> Live Real-Time Data (Sqlite)
						</div>
					</div>
					<div className="ob-search-box">
						<Search size={16} />
						<input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search organizations or admins..." />
					</div>
				</div>

				<div className="ob-admin-stats">
					<div className="ob-stat-card">
						<span className="ob-stat-label">Total Applications</span>
						<span className="ob-stat-value">{requests.length}</span>
					</div>
					<div className="ob-stat-card">
						<span className="ob-stat-label">Verified Orgs</span>
						<span className="ob-stat-value">{requests.filter((r: any) => (r.status || '').toLowerCase().includes('approv')).length}</span>
					</div>
					<div className="ob-stat-card">
						<span className="ob-stat-label">Total Submissions</span>
						<span className="ob-stat-value">{requests.filter((r: any) => (r.status || '').toLowerCase().includes('submit')).length}</span>
					</div>
					<div className="ob-stat-card">
						<span className="ob-stat-label">Ready for Processing</span>
						<span className="ob-stat-value">{readyToProcessCount}</span>
					</div>
					<div className="ob-stat-card">
						<span className="ob-stat-label">Processed Environments</span>
						<span className="ob-stat-value">{completedProcessingCount}</span>
					</div>
				</div>

				{approvalInfo && (
					<div style={{ marginBottom: 14, fontSize: 13, background: '#f0f7f0', border: '1px solid #c8e6c9', borderRadius: 8, padding: '10px 12px', color: '#1b5e20' }}>
						{approvalInfo}
					</div>
				)}

				{processInfo && (
					<div style={{ marginBottom: 14, fontSize: 13, background: '#eef6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', color: '#1d4ed8' }}>
						{processInfo}
					</div>
				)}

				{adminError && (
					<div className="ob-error" style={{ marginBottom: 14 }}>
						{adminError}
					</div>
				)}

				<div className="ob-admin-section-card" style={{ marginBottom: 18 }}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
						<h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0A0A0A', display: 'flex', alignItems: 'center', gap: 8 }}>
							<ServerCog size={16} /> Data Processing Queue
						</h3>
						<button type="button" className="ob-action-btn" onClick={() => loadAdminData()}>
							<RefreshCcw size={13} /> Refresh
						</button>
					</div>

					{filteredQueue.length === 0 ? (
						<div style={{ padding: 10, color: '#6B7280', fontSize: 13 }}>
							No organizations found in processing queue.
						</div>
					) : (
						<div style={{ display: 'grid', gap: 10 }}>
							{filteredQueue.map((item) => {
								const processingState = (item.processing?.status || 'pending').toLowerCase();
								const canStart = item.status === 'approved' && item.setup_ready;
								return (
									<div key={item.onboarding_uuid} style={{ border: '1px solid #EEF2EE', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
										<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
											<div>
												<div style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A' }}>{item.company_name}</div>
												<div style={{ fontSize: 12, color: '#6B7280' }}>{item.org_code} • {item.admin_email || 'No admin email'}</div>
											</div>
											<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
												<span className={`ob-badge ob-badge-${(item.status || 'submitted').toLowerCase()}`}>{item.status}</span>
												<span className="ob-badge" style={{ background: processingState === 'completed' ? '#E8F5E9' : processingState === 'failed' ? '#FEF2F2' : processingState === 'processing' ? '#EEF6FF' : '#FFF8E1', color: processingState === 'completed' ? '#1B5E20' : processingState === 'failed' ? '#B91C1C' : processingState === 'processing' ? '#1D4ED8' : '#8A6D3B' }}>
													{processingState}
												</span>
											</div>
										</div>

										<div style={{ fontSize: 12, color: '#4A5568', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
											<span><b>Org files:</b> {item.uploaded_files_count}</span>
											<span><b>Worker files:</b> {item.worker_files_count}</span>
											<span><b>Workers:</b> {item.workers_count}</span>
											<span><b>Indexed:</b> {item.processing?.indexed_docs ?? 0}</span>
										</div>

										{item.org_data_summary && (
											<div style={{ fontSize: 12, color: '#374151', background: '#F9FBF9', border: '1px solid #EEF2EE', borderRadius: 8, padding: '8px 10px' }}>
												{item.org_data_summary}
											</div>
										)}

										<div style={{ display: 'flex', gap: 8 }}>
											<button
												type="button"
												onClick={() => setSelectedReq(requests.find((r) => r.onboarding_uuid === item.onboarding_uuid) || null)}
												className="ob-action-btn"
											>
												<Eye size={14} /> View Data
											</button>
											<button
												type="button"
												onClick={() => handleStartProcessing(item)}
												// disabled={!canStart || !!processingActionUuid}
												className="ob-action-btn proceed"
												title={!canStart ? 'Await approval and post-approval uploads first.' : 'Start processing'}
											>
												<PlayCircle size={14} />
												{processingActionUuid === item.onboarding_uuid ? 'Processing...' : (processingState === 'completed' ? 'Reprocess' : 'Start Processing')}
											</button>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				<div className="ob-requests-table-container">
					<div className="ob-table-section-title">
						<ClipboardCheck size={15} /> Application Intake Queue
					</div>
					{filtered.length > 0 ? (
						<table className="ob-requests-table">
							<thead>
								<tr>
									<th>Organization Name</th>
									<th>Org Code</th>
									<th>Primary Admin</th>
									<th>Apply Date</th>
									<th>Status</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{filtered.map((req: any) => (
									<tr key={req.id || req.onboarding_uuid}>
										<td style={{ fontWeight: 600 }}>{req.company_name}</td>
										<td style={{ opacity: 0.6, fontSize: 12 }}>{req.org_code}</td>
										<td>
											<div style={{ display: 'flex', flexDirection: 'column' }}>
												<span>{req.admin_name}</span>
												<span style={{ fontSize: 11, opacity: 0.6 }}>{req.admin_email}</span>
											</div>
										</td>
										<td>{req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A'}</td>
										<td>
											<span className={`ob-badge ob-badge-${(req.status || 'submitted').toLowerCase()}`}>
												{req.status || 'submitted'}
											</span>
										</td>
										<td>
											<div style={{ display: 'flex', gap: 8 }}>
												<button type="button" onClick={() => setSelectedReq(req)} className="ob-action-btn">
													<Eye size={14} />
												</button>
												{req.status !== 'approved' && (
													<button type="button" onClick={() => handleProceed(req.onboarding_uuid)} disabled={!!actionLoading} className="ob-action-btn proceed">
														<Zap size={14} />
													</button>
												)}
												<button type="button" onClick={() => handleDelete(req.onboarding_uuid)} disabled={!!actionLoading} className="ob-action-btn delete">
													<Trash2 size={14} />
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					) : (
						<div className="ob-admin-empty">
							<ClipboardCheck size={48} style={{ opacity: 0.3 }} />
							<p>{searchTerm ? 'No results for your search.' : 'No onboarding applications found yet.'}</p>
						</div>
					)}
				</div>
			</div>

			{selectedReq && (
				<DetailsModal
					req={selectedReq}
					onClose={() => setSelectedReq(null)}
					onDelete={handleDelete}
					onProceed={handleProceed}
					loading={!!actionLoading}
				/>
			)}
		</div>
	);
}

function DetailsModal({ req, onClose, onDelete, onProceed, loading }: { req: any; onClose: () => void; onDelete: (u: string) => void; onProceed: (u: string) => void; loading: boolean }) {
	let notes: any = {};
	try {
		notes = JSON.parse(req.requirements_notes || '{}');
	} catch (e) {
		try {
			notes = typeof req.requirements_notes === 'string' ? JSON.parse(req.requirements_notes) : req.requirements_notes;
		} catch (e2) {
			console.error('Failed to parse notes:', e);
		}
	}

	const checklistTypes = JSON.parse(req.selected_checklist_types_json || '[]');
	const modules = JSON.parse(req.selected_modules_json || '[]');
	const postApprovalSetup = (notes?.post_approval_setup && typeof notes.post_approval_setup === 'object') ? notes.post_approval_setup : {};
	const processing = (postApprovalSetup?.processing && typeof postApprovalSetup.processing === 'object') ? postApprovalSetup.processing : {};
	const uploadedFiles = Array.isArray(postApprovalSetup?.uploaded_files) ? postApprovalSetup.uploaded_files : [];
	const workerUploadedFiles = Array.isArray(postApprovalSetup?.worker_uploaded_files) ? postApprovalSetup.worker_uploaded_files : [];
	const provisionedWorkers = Array.isArray(postApprovalSetup?.workers) ? postApprovalSetup.workers : [];

	return (
		<div className="ob-modal-overlay" onClick={onClose}>
			<div className="ob-modal-content" onClick={(e) => e.stopPropagation()}>
				<div className="ob-modal-header">
					<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
						<Building2 size={24} color="var(--primary)" />
						<h2 style={{ margin: 0 }}>Organization Detail: <span style={{ color: 'var(--primary)' }}>{req.company_name}</span></h2>
					</div>
					<button onClick={onClose} className="ob-modal-close"><X size={20} /></button>
				</div>
				<div className="ob-modal-body">
					<div className="ob-detail-grid">
						<DetailSection title="Basic Profile" icon={<Factory size={16} />}>
							<DetailLine label="Org Code" value={req.org_code} />
							<DetailLine label="Country" value={req.country_name} />
							<DetailLine label="Industry" value={notes.profile?.industry_type} />
							<DetailLine label="Subscription Plan" value={notes.profile?.subscription_plan || notes.profile?.hse_maturity} />
							<DetailLine label="Active Workers" value={req.active_workers} />
						</DetailSection>

						<DetailSection title="Admin Ownership" icon={<Users size={16} />}>
							<DetailLine label="Name" value={req.admin_name} />
							<DetailLine label="Designation" value={req.admin_designation || notes.profile?.admin_designation} />
							<DetailLine label="Email" value={req.admin_email} />
							<DetailLine label="Phone" value={req.admin_phone} />
						</DetailSection>

						<DetailSection title="Modules & Config" icon={<ClipboardCheck size={16} />}>
							<DetailLine label="Selected Modules" value={modules.join(', ')} />
							<DetailLine label="Checklist Templates" value={checklistTypes.join(', ')} />
							<DetailLine label="Sites / Zones" value={`${req.site_count} Sites / ${req.zone_count} Zones`} />
						</DetailSection>

						<DetailSection title="Compliance & High Risk" icon={<Shield size={16} />}>
							<DetailLine label="High Risk Activities" value={notes.risk_and_compliance?.high_risk_activities?.join(', ')} />
							<DetailLine label="Certifications" value={notes.risk_and_compliance?.certifications?.join(', ')} />
							<DetailLine label="PTW In Use" value={notes.risk_and_compliance?.permit_to_work_in_use ? 'Yes' : 'No'} />
						</DetailSection>

						<DetailSection title="Emergency & Launch" icon={<Activity size={16} />}>
							<DetailLine label="Go Live Target" value={notes.implementation?.target_go_live_date} />
							<DetailLine label="Emergency Focal" value={notes.emergency_readiness?.emergency_focal_point} />
							<DetailLine label="Integrations" value={notes.implementation?.integration_needs} />
						</DetailSection>

						<DetailSection title="SLA / KPI" icon={<Activity size={16} />}>
							<DetailLine label="Selected KPIs" value={notes.kpi_sla?.selected_kpis?.join(', ')} />
							<DetailLine label="Critical SLA (hrs)" value={notes.kpi_sla?.sla_targets?.critical_action_closure_hours} />
							<DetailLine label="Standard SLA (hrs)" value={notes.kpi_sla?.sla_targets?.standard_action_closure_hours} />
							<DetailLine label="Reporting Cadence" value={notes.kpi_sla?.reporting_cadence} />
						</DetailSection>

						<DetailSection title="Post-Approval Data & Processing" icon={<ServerCog size={16} />}>
							<DetailLine label="Org Data Summary" value={postApprovalSetup?.org_data_summary ? 'Provided' : 'Not provided'} />
							<DetailLine label="Org Files" value={uploadedFiles.length} />
							<DetailLine label="Worker Files" value={workerUploadedFiles.length} />
							<DetailLine label="Provisioned Users" value={provisionedWorkers.length} />
							<DetailLine label="Processing Status" value={processing?.status || 'pending'} />
							<DetailLine label="Last Run UUID" value={processing?.last_run_uuid} />
							<DetailLine label="Indexed Docs" value={processing?.indexed_docs} />
							<DetailLine label="Last Error" value={processing?.last_error} />
						</DetailSection>

						<DetailSection title="Additional Notes" full icon={<FileText size={16} />}>
							<div style={{ fontSize: 13, color: 'var(--text-secondary)', background: '#f8faf8', padding: 16, borderRadius: 8, border: '1px solid var(--border)', minHeight: 80, whiteSpace: 'pre-wrap' }}>
								{notes.custom_notes || 'No custom notes provided.'}
							</div>
						</DetailSection>
					</div>
				</div>
				<div className="ob-modal-footer">
					<button type="button" onClick={() => onDelete(req.onboarding_uuid)} disabled={loading} className="ob-btn-modal-delete">
						<Trash2 size={16} /> Delete Request
					</button>
					<div style={{ display: 'flex', gap: 12 }}>
						<button type="button" onClick={onClose} className="ob-btn-modal-close">Close</button>
						{req.status !== 'approved' && (
							<button type="button" onClick={() => onProceed(req.onboarding_uuid)} disabled={loading} className="ob-btn-modal-proceed">
								<Zap size={16} /> Proceed / Approve
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function DetailSection({ title, icon, children, full }: { title: string; icon?: any; children: any; full?: boolean }) {
	return (
		<div className={`ob-detail-section ${full ? 'full' : ''}`}>
			<h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#333', borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 12 }}>
				{icon} {title}
			</h3>
			<div className="ob-detail-content">{children}</div>
		</div>
	);
}

function DetailLine({ label, value }: { label: string; value: any }) {
	return (
		<div className="ob-detail-line" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #f0f0f0' }}>
			<span className="ob-detail-label" style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>{label}</span>
			<span className="ob-detail-value" style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>{value || 'N/A'}</span>
		</div>
	);
}
