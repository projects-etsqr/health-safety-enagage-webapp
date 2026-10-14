import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  ChevronLeft, RefreshCw, Loader2, Save, AlertCircle, CheckCheck,
  X, Database, Shield, Mail, Globe, Eye, EyeOff,
  CheckCircle2, XCircle, SlidersHorizontal, AlertTriangle, Zap,
} from "lucide-react";
import axiosInstance from "@/api/axiosInstance";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformSection {
  app_name: string; app_env: string; app_version: string;
  app_debug: boolean; frontend_url: string; log_level: string;
}
interface DatabaseSection {
  db_host: string; db_port: number; db_name: string; db_user: string;
  db_pool_size: number; db_max_overflow: number; db_pool_timeout: number;
}
interface AuthSection {
  jwt_algorithm: string; jwt_access_token_expire_minutes: number; jwt_secret_configured: boolean;
}
interface EmailSection {
  email_backend: string; effective_backend: string;
  sendgrid_from_email: string; sendgrid_from_name: string;
  smtp_from_email: string; smtp_from_name: string;
  sendgrid_configured: boolean; sendgrid_api_key_masked: string;
  smtp_host: string; smtp_port: number; smtp_user: string;
  smtp_password_set: boolean; smtp_password_masked: string;
  smtp_use_tls: boolean; smtp_use_ssl: boolean;
}
interface SecuritySection {
  allowed_origins: string[]; secret_key_configured: boolean;
}
interface SystemSettings {
  platform: PlatformSection; database: DatabaseSection;
  auth: AuthSection; email: EmailSection; security: SecuritySection;
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, sub, iconColor, children }: {
  icon: typeof Mail; title: string; sub: string; iconColor: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E9F6" }}>
      <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: "#F3F4F6", background: "#FAFBFF" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconColor + "18" }}>
          <Icon className="w-[18px] h-[18px]" style={{ color: iconColor }} />
        </div>
        <div>
          <div className="font-bold text-sm" style={{ color: "#111827" }}>{title}</div>
          <div className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{sub}</div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2 sm:gap-4 items-start py-3.5 border-b last:border-0" style={{ borderColor: "#F3F4F6" }}>
      <div className="pt-0.5">
        <div className="text-xs font-semibold" style={{ color: "#374151" }}>{label}</div>
        {hint && <div className="text-[10px] mt-0.5" style={{ color: "#9CA3AF" }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ReadOnlyBadge({ value, color = "#6B7280", bg = "#F3F4F6" }: { value: string; color?: string; bg?: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: bg, color }}>
      {value}
    </span>
  );
}

function TextInput({ value, onChange, placeholder, disabled = false, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ borderColor: "#E3E9F6" }} />
  );
}

function NumberInput({ value, onChange, min, max, style }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; style?: React.CSSProperties;
}) {
  return (
    <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} min={min} max={max}
      className="px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
      style={{ borderColor: "#E3E9F6", maxWidth: 160, ...style }} />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none"
      style={{ background: checked ? "#4A57B9" : "#D1D5DB" }}>
      <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }} />
    </button>
  );
}

function SaveButton({ onClick, isLoading, label = "Save Changes" }: { onClick: () => void; isLoading: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={isLoading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-opacity"
      style={{ background: "linear-gradient(135deg,#4A57B9,#6F80E8)", opacity: isLoading ? 0.7 : 1 }}>
      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
      {isLoading ? "Saving…" : label}
    </button>
  );
}

function ConfigBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "#D1FAE5", color: "#065F46" }}>
      <CheckCircle2 className="w-3 h-3" /> Configured
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "#FEF3C7", color: "#92400E" }}>
      <XCircle className="w-3 h-3" /> Not set
    </span>
  );
}

function Toast({ msg, type, onDismiss }: { msg: string; type: "success" | "error"; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold min-w-[260px]"
      style={{ background: type === "success" ? "#065F46" : "#991B1B", color: "#fff" }}>
      {type === "success" ? <CheckCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      <span className="flex-1">{msg}</span>
      <button onClick={onDismiss}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
    </div>
  );
}

// ── Backend badge ─────────────────────────────────────────────────────────────

const BACKEND_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  sendgrid: { label: "SendGrid",   color: "#065F46", bg: "#D1FAE5", border: "#6EE7B7" },
  smtp:     { label: "SMTP",       color: "#1D4ED8", bg: "#DBEAFE", border: "#93C5FD" },
  none:     { label: "Not set",    color: "#92400E", bg: "#FEF3C7", border: "#FDE68A" },
};

function BackendBadge({ backend }: { backend: string }) {
  const cfg = BACKEND_CFG[backend] ?? BACKEND_CFG.none;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      <Zap className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function SystemSettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [restartRequired, setRestartRequired] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  // Local editable state
  const [platform, setPlatform] = useState({ app_name: "", app_debug: false, frontend_url: "", log_level: "DEBUG" });
  const [auth, setAuth] = useState({ jwt_access_token_expire_minutes: 1440 });
  const [email, setEmail] = useState({
    email_backend: "auto",
    sendgrid_from_email: "", sendgrid_from_name: "",
    sendgrid_api_key: "",
    smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
    smtp_from_email: "", smtp_from_name: "",
    smtp_use_tls: true, smtp_use_ssl: false,
  });
  const [security, setSecurity] = useState({ allowed_origins: "" });

  const [showSgKey, setShowSgKey] = useState(false);
  const [showSmtpPw, setShowSmtpPw] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get<SystemSettings>("/superadmin/settings");
      const d = res.data;
      setSettings(d);
      setPlatform({ app_name: d.platform.app_name, app_debug: d.platform.app_debug, frontend_url: d.platform.frontend_url, log_level: d.platform.log_level });
      setAuth({ jwt_access_token_expire_minutes: d.auth.jwt_access_token_expire_minutes });
      setEmail({
        email_backend: d.email.email_backend,
        sendgrid_from_email: d.email.sendgrid_from_email,
        sendgrid_from_name:  d.email.sendgrid_from_name,
        sendgrid_api_key: "",
        smtp_host: d.email.smtp_host,
        smtp_port: d.email.smtp_port,
        smtp_user: d.email.smtp_user,
        smtp_password: "",
        smtp_from_email: d.email.smtp_from_email,
        smtp_from_name:  d.email.smtp_from_name,
        smtp_use_tls: d.email.smtp_use_tls,
        smtp_use_ssl: d.email.smtp_use_ssl,
      });
      setSecurity({ allowed_origins: d.security.allowed_origins.join(", ") });
    } catch {
      showToast("Failed to load settings", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (section: string, payload: Record<string, unknown>) => {
    setSavingSection(section);
    try {
      await axiosInstance.patch("/superadmin/settings", payload);
      setRestartRequired(true);
      showToast("Settings saved — restart the server to apply changes");
      void load();
    } catch {
      showToast("Failed to save settings", "error");
    } finally {
      setSavingSection(null);
    }
  };

  const savePlatform = () => save("platform", {
    app_name: platform.app_name,
    debug: platform.app_debug,              // env: DEBUG
    frontend_base_url: platform.frontend_url, // env: FRONTEND_BASE_URL
    log_level: platform.log_level,
  });

  const saveAuth = () => save("auth", {
    access_token_expire_minutes: auth.jwt_access_token_expire_minutes, // env: ACCESS_TOKEN_EXPIRE_MINUTES
  });

  const saveEmail = () => {
    const payload: Record<string, unknown> = {
      email_backend: email.email_backend,
      sendgrid_from_email: email.sendgrid_from_email,
      sendgrid_from_name:  email.sendgrid_from_name,
      smtp_host:           email.smtp_host,
      smtp_port:           email.smtp_port,
      smtp_user:           email.smtp_user,  // env: SMTP_USER
      smtp_from_email:     email.smtp_from_email,
      smtp_from_name:      email.smtp_from_name,
      smtp_use_tls:        email.smtp_use_tls,
      smtp_use_ssl:        email.smtp_use_ssl,
    };
    if (email.sendgrid_api_key.trim()) payload.sendgrid_api_key = email.sendgrid_api_key.trim();
    if (email.smtp_password.trim())    payload.smtp_password    = email.smtp_password.trim();
    return save("email", payload);
  };

  const saveSecurity = () => save("security", { allowed_origins: security.allowed_origins });

  const ENV_COLORS: Record<string, { color: string; bg: string }> = {
    development: { color: "#D97706", bg: "#FEF3C7" },
    staging:     { color: "#0891B2", bg: "#CFFAFE" },
    production:  { color: "#059669", bg: "#D1FAE5" },
  };
  const envCfg = ENV_COLORS[settings?.platform.app_env ?? ""] ?? { color: "#6B7280", bg: "#F3F4F6" };
  const LOG_LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];

  // Show SMTP fields when backend is smtp, or auto with no sendgrid key set
  const showSmtp = email.email_backend === "smtp" || email.email_backend === "auto";
  const showSendGrid = email.email_backend === "sendgrid" || email.email_backend === "auto";

  return (
    <div className="p-5 sm:p-7 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/superadmin")}
            className="w-9 h-9 rounded-xl border flex items-center justify-center hover:bg-gray-50 transition-colors"
            style={{ borderColor: "#E3E9F6" }}>
            <ChevronLeft className="w-4 h-4" style={{ color: "#6B7280" }} />
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#111827" }}>System Settings</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>Platform configuration and global settings</p>
          </div>
        </div>
        <button onClick={() => void load()}
          className="w-9 h-9 rounded-xl border flex items-center justify-center hover:bg-gray-50 transition-colors"
          style={{ borderColor: "#E3E9F6" }} title="Refresh">
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} style={{ color: "#6B7280" }} />
        </button>
      </div>

      {/* Restart banner */}
      {restartRequired && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm"
          style={{ background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">Server restart required</span>
          <span className="text-xs opacity-75 ml-1">— saved changes will take effect after restarting the backend process.</span>
          <button onClick={() => setRestartRequired(false)} className="ml-auto opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#4A57B9" }} />
        </div>
      ) : !settings ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <AlertCircle className="w-10 h-10" style={{ color: "#EF4444" }} />
          <p className="text-sm" style={{ color: "#6B7280" }}>Could not load settings. Check the backend connection.</p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* ── Platform ──────────────────────────────────────────────── */}
          <SectionCard icon={SlidersHorizontal} title="Platform Configuration" sub="Core application identity and runtime behaviour" iconColor="#4A57B9">
            <FieldRow label="App Name" hint="Used in emails and system references">
              <TextInput value={platform.app_name} onChange={(v) => setPlatform((p) => ({ ...p, app_name: v }))} placeholder="EHSERA Intelligence" />
            </FieldRow>
            <FieldRow label="Environment">
              <ReadOnlyBadge value={settings.platform.app_env.toUpperCase()} color={envCfg.color} bg={envCfg.bg} />
            </FieldRow>
            <FieldRow label="Version">
              <ReadOnlyBadge value={`v${settings.platform.app_version}`} color="#4A57B9" bg="#EEF2FF" />
            </FieldRow>
            <FieldRow label="Debug Mode" hint="Disable in production">
              <div className="flex items-center gap-2.5">
                <Toggle checked={platform.app_debug} onChange={(v) => setPlatform((p) => ({ ...p, app_debug: v }))} />
                <span className="text-xs font-medium" style={{ color: platform.app_debug ? "#D97706" : "#6B7280" }}>
                  {platform.app_debug ? "Enabled — not recommended in production" : "Disabled"}
                </span>
              </div>
            </FieldRow>
            <FieldRow label="Frontend URL" hint="Used when building email links">
              <TextInput value={platform.frontend_url} onChange={(v) => setPlatform((p) => ({ ...p, frontend_url: v }))} placeholder="https://app.hse-intelligence.com" />
            </FieldRow>
            <FieldRow label="Log Level" hint="Minimum severity written to log files">
              <select value={platform.log_level} onChange={(e) => setPlatform((p) => ({ ...p, log_level: e.target.value }))}
                className="px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
                style={{ borderColor: "#E3E9F6", minWidth: 140 }}>
                {LOG_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </FieldRow>
            <div className="flex justify-end pt-2">
              <SaveButton onClick={savePlatform} isLoading={savingSection === "platform"} />
            </div>
          </SectionCard>

          {/* ── Database ──────────────────────────────────────────────── */}
          <SectionCard icon={Database} title="Database" sub="Connection pool configuration — set via environment variables, read-only here" iconColor="#0891B2">
            <FieldRow label="Host"><ReadOnlyBadge value={settings.database.db_host} /></FieldRow>
            <FieldRow label="Port"><ReadOnlyBadge value={String(settings.database.db_port)} /></FieldRow>
            <FieldRow label="Database Name"><ReadOnlyBadge value={settings.database.db_name} color="#0891B2" bg="#CFFAFE" /></FieldRow>
            <FieldRow label="User"><ReadOnlyBadge value={settings.database.db_user} /></FieldRow>
            <FieldRow label="Pool Size"><ReadOnlyBadge value={String(settings.database.db_pool_size)} /></FieldRow>
            <FieldRow label="Max Overflow"><ReadOnlyBadge value={String(settings.database.db_max_overflow)} /></FieldRow>
            <FieldRow label="Pool Timeout"><ReadOnlyBadge value={`${settings.database.db_pool_timeout}s`} /></FieldRow>
          </SectionCard>

          {/* ── Authentication ────────────────────────────────────────── */}
          <SectionCard icon={Shield} title="Authentication & JWT" sub="Token lifetime and signing configuration" iconColor="#7C3AED">
            <FieldRow label="Algorithm">
              <ReadOnlyBadge value={settings.auth.jwt_algorithm} color="#7C3AED" bg="#EDE9FE" />
            </FieldRow>
            <FieldRow label="Token Expiry" hint="How long access tokens stay valid (minutes)">
              <div className="flex items-center gap-3">
                <NumberInput value={auth.jwt_access_token_expire_minutes} onChange={(v) => setAuth({ jwt_access_token_expire_minutes: v })} min={5} max={43200} />
                <span className="text-xs" style={{ color: "#9CA3AF" }}>
                  ≈ {auth.jwt_access_token_expire_minutes >= 1440
                    ? `${(auth.jwt_access_token_expire_minutes / 1440).toFixed(1)} day(s)`
                    : `${auth.jwt_access_token_expire_minutes} min`}
                </span>
              </div>
            </FieldRow>
            <FieldRow label="Secret Key">
              <ConfigBadge configured={settings.auth.jwt_secret_configured} />
              {!settings.auth.jwt_secret_configured && (
                <p className="text-[11px] mt-1" style={{ color: "#D97706" }}>Using default key — set JWT_SECRET in .env before production.</p>
              )}
            </FieldRow>
            <div className="flex justify-end pt-2">
              <SaveButton onClick={saveAuth} isLoading={savingSection === "auth"} />
            </div>
          </SectionCard>

          {/* ── Email ─────────────────────────────────────────────────── */}
          <SectionCard icon={Mail} title="Email & Notifications" sub="Configure the delivery backend used for invitations and platform notifications" iconColor="#DB2777">

            {/* Active backend status */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4"
              style={{ background: "#F9FAFB", border: "1px solid #E3E9F6" }}>
              <span className="text-xs font-semibold" style={{ color: "#374151" }}>Active backend:</span>
              <BackendBadge backend={settings.email.effective_backend} />
              {settings.email.effective_backend === "none" && (
                <span className="text-xs" style={{ color: "#D97706" }}>
                  — configure SendGrid or SMTP below to enable email sending.
                </span>
              )}
            </div>

            {/* Backend selector */}
            <FieldRow label="Email Backend" hint="Which delivery method to use">
              <div className="flex flex-wrap gap-2">
                {(["auto", "sendgrid", "smtp"] as const).map((b) => (
                  <button key={b} type="button"
                    onClick={() => setEmail((e) => ({ ...e, email_backend: b }))}
                    className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all"
                    style={email.email_backend === b
                      ? { background: "#4A57B9", color: "#fff", borderColor: "#4A57B9" }
                      : { background: "#fff", color: "#374151", borderColor: "#E3E9F6" }}>
                    {b === "auto" ? "Auto-detect" : b === "sendgrid" ? "SendGrid" : "SMTP"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: "#9CA3AF" }}>
                {email.email_backend === "auto"
                  ? "Uses SendGrid if API key is set, otherwise falls back to SMTP."
                  : email.email_backend === "sendgrid"
                  ? "Always uses SendGrid — SENDGRID_API_KEY must be configured."
                  : "Always uses SMTP — SMTP_HOST must be configured."}
              </p>
            </FieldRow>

            {/* ── SendGrid ── */}
            {showSendGrid && (
              <>
                <div className="mt-4 mb-1 flex items-center gap-2">
                  <div className="h-px flex-1" style={{ background: "#E3E9F6" }} />
                  <span className="text-[11px] font-bold uppercase tracking-widest px-2" style={{ color: "#9CA3AF" }}>SendGrid</span>
                  <div className="h-px flex-1" style={{ background: "#E3E9F6" }} />
                </div>
                <FieldRow label="From Address" hint="Sender address for SendGrid emails">
                  <TextInput value={email.sendgrid_from_email} onChange={(v) => setEmail((e) => ({ ...e, sendgrid_from_email: v }))} placeholder="noreply@hse-platform.com" />
                </FieldRow>
                <FieldRow label="From Name" hint="Sender display name for SendGrid">
                  <TextInput value={email.sendgrid_from_name} onChange={(v) => setEmail((e) => ({ ...e, sendgrid_from_name: v }))} placeholder="HSE Platform" />
                </FieldRow>
                <FieldRow label="API Key Status">
                  <div className="flex items-center gap-2">
                    <ConfigBadge configured={settings.email.sendgrid_configured} />
                    {settings.email.sendgrid_configured && (
                      <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>{settings.email.sendgrid_api_key_masked}</span>
                    )}
                  </div>
                </FieldRow>
                <FieldRow label="Update API Key" hint="Leave blank to keep the existing key">
                  <div className="relative max-w-sm">
                    <input type={showSgKey ? "text" : "password"} value={email.sendgrid_api_key}
                      onChange={(e) => setEmail((prev) => ({ ...prev, sendgrid_api_key: e.target.value }))}
                      placeholder="SG.xxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 pr-10 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
                      style={{ borderColor: "#E3E9F6" }} />
                    <button type="button" onClick={() => setShowSgKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-80">
                      {showSgKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FieldRow>
              </>
            )}

            {/* ── SMTP ── */}
            {showSmtp && (
              <>
                <div className="mt-4 mb-1 flex items-center gap-2">
                  <div className="h-px flex-1" style={{ background: "#E3E9F6" }} />
                  <span className="text-[11px] font-bold uppercase tracking-widest px-2" style={{ color: "#9CA3AF" }}>SMTP</span>
                  <div className="h-px flex-1" style={{ background: "#E3E9F6" }} />
                </div>
                <FieldRow label="From Address" hint="Sender address for SMTP emails (e.g. your Gmail)">
                  <TextInput value={email.smtp_from_email} onChange={(v) => setEmail((e) => ({ ...e, smtp_from_email: v }))} placeholder="you@gmail.com" />
                </FieldRow>
                <FieldRow label="From Name" hint="Sender display name for SMTP">
                  <TextInput value={email.smtp_from_name} onChange={(v) => setEmail((e) => ({ ...e, smtp_from_name: v }))} placeholder="HSE Platform" />
                </FieldRow>
                <FieldRow label="SMTP Host" hint="e.g. smtp.gmail.com or smtp.office365.com">
                  <TextInput value={email.smtp_host} onChange={(v) => setEmail((e) => ({ ...e, smtp_host: v }))} placeholder="smtp.gmail.com" />
                </FieldRow>
                <FieldRow label="SMTP Port" hint="587 for TLS · 465 for SSL · 25 for plain">
                  <NumberInput value={email.smtp_port} onChange={(v) => setEmail((e) => ({ ...e, smtp_port: v }))} min={1} max={65535} />
                </FieldRow>
                <FieldRow label="Username" hint="Usually your full email address">
                  <TextInput value={email.smtp_user} onChange={(v) => setEmail((e) => ({ ...e, smtp_user: v }))} placeholder="you@gmail.com" />
                </FieldRow>
                <FieldRow label="Password / App Token" hint="Leave blank to keep the existing password">
                  <div className="relative max-w-sm">
                    <input type={showSmtpPw ? "text" : "password"} value={email.smtp_password}
                      onChange={(e) => setEmail((prev) => ({ ...prev, smtp_password: e.target.value }))}
                      placeholder={settings.email.smtp_password_set ? settings.email.smtp_password_masked : "Enter password…"}
                      className="w-full px-3 py-2 pr-10 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100"
                      style={{ borderColor: "#E3E9F6" }} />
                    <button type="button" onClick={() => setShowSmtpPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-80">
                      {showSmtpPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FieldRow>
                <FieldRow label="Use TLS (STARTTLS)" hint="Recommended for port 587">
                  <Toggle checked={email.smtp_use_tls} onChange={(v) => setEmail((e) => ({ ...e, smtp_use_tls: v, smtp_use_ssl: v ? false : e.smtp_use_ssl }))} />
                </FieldRow>
                <FieldRow label="Use SSL" hint="For port 465 — mutually exclusive with TLS">
                  <Toggle checked={email.smtp_use_ssl} onChange={(v) => setEmail((e) => ({ ...e, smtp_use_ssl: v, smtp_use_tls: v ? false : e.smtp_use_tls }))} />
                </FieldRow>

                {/* Common presets */}
                <div className="mt-3 p-3 rounded-xl" style={{ background: "#F9FAFB", border: "1px solid #E3E9F6" }}>
                  <p className="text-[11px] font-semibold mb-2" style={{ color: "#374151" }}>Quick presets:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Gmail", host: "smtp.gmail.com", port: 587, tls: true, ssl: false },
                      { label: "Outlook / Office 365", host: "smtp.office365.com", port: 587, tls: true, ssl: false },
                      { label: "Yahoo", host: "smtp.mail.yahoo.com", port: 465, tls: false, ssl: true },
                      { label: "SendGrid SMTP", host: "smtp.sendgrid.net", port: 587, tls: true, ssl: false },
                    ].map((p) => (
                      <button key={p.label} type="button"
                        onClick={() => setEmail((e) => ({ ...e, smtp_host: p.host, smtp_port: p.port, smtp_use_tls: p.tls, smtp_use_ssl: p.ssl }))}
                        className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold hover:bg-white transition-colors"
                        style={{ borderColor: "#D1D5DB", color: "#374151" }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end pt-3">
              <SaveButton onClick={saveEmail} isLoading={savingSection === "email"} label="Save Email Settings" />
            </div>
          </SectionCard>

          {/* ── Security ──────────────────────────────────────────────── */}
          <SectionCard icon={Globe} title="Security & CORS" sub="Allowed frontend origins and secret key status" iconColor="#059669">
            <FieldRow label="Allowed Origins" hint="Comma-separated list of permitted frontend URLs">
              <textarea value={security.allowed_origins} onChange={(e) => setSecurity({ allowed_origins: e.target.value })}
                rows={3} placeholder="http://localhost:5173, https://app.hse-intelligence.com"
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-100 resize-none font-mono"
                style={{ borderColor: "#E3E9F6" }} />
              <p className="text-[11px] mt-1" style={{ color: "#9CA3AF" }}>Separate multiple origins with a comma.</p>
            </FieldRow>
            <FieldRow label="JWT Secret Key">
              <ConfigBadge configured={settings.security.secret_key_configured} />
              {!settings.security.secret_key_configured && (
                <p className="text-[11px] mt-1" style={{ color: "#D97706" }}>Using default secret — set JWT_SECRET in .env before production.</p>
              )}
            </FieldRow>
            <div className="flex justify-end pt-2">
              <SaveButton onClick={saveSecurity} isLoading={savingSection === "security"} label="Save Origins" />
            </div>
          </SectionCard>

        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
