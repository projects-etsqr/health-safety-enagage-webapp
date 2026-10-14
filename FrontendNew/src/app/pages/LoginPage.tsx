import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Shield, Eye, EyeOff, Sparkles, ShieldCheck, Building2, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import loginBg from "../../assets/login-bg.jpg";

const PRODUCT_ADMIN_EMAILS = new Set(
  String(import.meta.env.VITE_PRODUCT_ADMIN_EMAILS ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean),
);

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, user, logout } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");

  const forceLoginView = searchParams.get("force") === "1";

  useEffect(() => {
    if (!forceLoginView || !isAuthenticated) return;
    logout();
  }, [forceLoginView, isAuthenticated, logout]);

  useEffect(() => {
    if (!isAuthenticated || forceLoginView) return;
    if (user?.isSuperAdmin) { navigate("/superadmin", { replace: true }); return; }
    if (user?.role === "Auditor") { navigate("/auditor", { replace: true }); return; }
    const normalizedEmail = user?.email?.trim().toLowerCase() || "";
    const isProductAdmin = PRODUCT_ADMIN_EMAILS.has(normalizedEmail);
    navigate(isProductAdmin ? "/auth/onboarding/admin" : "/", { replace: true });
  }, [isAuthenticated, user?.email, user?.isSuperAdmin, navigate, forceLoginView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const result = await login(email.trim(), password);

      if (result === "org_setup_required") {
        navigate("/org-setup-wizard", { replace: true });
      } else if (result === "success") {
        // Do NOT navigate here — React state (setUser/setIsAuthenticated) is
        // batched and not applied yet. The useEffect below handles the redirect
        // once the state has settled, so SuperAdminLayout sees the correct user.
      } else if (result === "pending_approval") {
        setInfoMessage("Your account is pending admin approval. You will be notified once access is granted.");
      } else if (result === "user_not_found") {
        setError("No account found for this email. Contact your administrator.");
      } else if (result === "network_error") {
        setError("Network error. Check your connection and try again.");
      } else if (result === "access_denied") {
        setError("Access denied. Contact your administrator if you believe this is an error.");
      } else if (result === "mobile_only") {
        setError("This account is set up for the mobile app. Please sign in from the EHSERA Intelligence mobile app instead.");
      } else if (result === "invalid_credentials") {
        setError("Invalid email or password. Please try again.");
      } else {
        setError("Unable to sign in. Please verify your credentials and try again.");
      }
    } catch {
      setError("Unable to sign in. Please verify your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen overflow-hidden">
      {/* Left Panel */}
      <div className="hidden lg:flex w-[55%] relative items-center justify-center overflow-hidden">
        <img
          src={loginBg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(10,22,48,0.94) 0%, rgba(11,61,145,0.86) 50%, rgba(29,78,216,0.82) 100%)" }}
        />
        <div className="absolute inset-0 opacity-[0.06]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 text-center max-w-lg px-12">
          <div
            className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-8 bg-white/90 p-2"
            style={{ backdropFilter: "blur(10px)" }}
          >
            <img src="/logo.png" alt="HSE logo" className="h-full w-full object-cover rounded-xl" />
          </div>
          <h1
            className="text-white mb-4"
            style={{ fontSize: "42px", fontFamily: "DM Sans, sans-serif", fontWeight: 700, letterSpacing: "-0.5px" }}
          >
            EHSERA Intelligence
          </h1>
          <p className="text-white/80 mb-16" style={{ fontSize: "18px", fontFamily: "DM Sans, sans-serif" }}>
            Intelligent Safety. Proactive Protection.
          </p>

          <div className="space-y-6 text-left">
            {[
              { icon: Sparkles, title: "Real-time Monitoring", desc: "AI-powered violation tracking across all sites" },
              { icon: ShieldCheck, title: "Smart Compliance", desc: "Automated audit trails and regulatory reporting" },
              { icon: Building2, title: "Multi-site Management", desc: "Centralized control for enterprise-wide safety" },
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}
                >
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-white text-[15px] block" style={{ fontWeight: 600 }}>{feature.title}</span>
                  <span className="text-white/60 text-[13px]">{feature.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-20 text-white/40 text-[12px]">
            © 2026 EHSERA Intelligence Platform. Enterprise Edition.
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="w-full lg:w-[45%] bg-white flex flex-col items-center justify-center px-6 sm:px-12 py-10">
        <div className="w-full max-w-[400px]">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-10">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white">
              <img src="/logo.png" alt="HSE logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-[14px]" style={{ color: "#0B3D91", fontFamily: "DM Sans, sans-serif", fontWeight: 700 }}>
              EHSERA Intelligence
            </span>
          </div>

          <h1
            className="mb-2"
            style={{ fontSize: "28px", fontFamily: "DM Sans, sans-serif", fontWeight: 700, color: "#0A0A0A" }}
          >
            Welcome back
          </h1>
          <p className="mb-8 text-[14px]" style={{ color: "#4A5568" }}>
            Sign in to access your safety workspace
          </p>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 px-4 py-3 rounded-lg mb-6 text-[13px]"
              style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Info */}
          {infoMessage && (
            <div
              className="flex items-start gap-2 px-4 py-3 rounded-lg mb-6 text-[13px]"
              style={{ background: "#EFF6FF", color: "#0B3D91", border: "1px solid #BFDBFE" }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                className="block mb-1.5 text-[13px]"
                style={{ color: "#374151", fontWeight: 500 }}
              >
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="name@company.com"
                autoComplete="email"
                className="w-full h-11 px-4 rounded-lg border text-[14px] transition-all focus:outline-none"
                style={{ borderColor: "#E2E8E2", color: "#0A0A0A", background: "#fff" }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#1D4ED8";
                  e.target.style.boxShadow = "0 0 0 3px rgba(29,78,216,0.16)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#E2E8E2";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                className="block mb-1.5 text-[13px]"
                style={{ color: "#374151", fontWeight: 500 }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-11 px-4 pr-12 rounded-lg border text-[14px] transition-all focus:outline-none"
                  style={{ borderColor: "#E2E8E2", color: "#0A0A0A", background: "#fff" }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#1D4ED8";
                    e.target.style.boxShadow = "0 0 0 3px rgba(29,78,216,0.16)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#E2E8E2";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword
                    ? <EyeOff className="w-4 h-4" style={{ color: "#9CA3AF" }} />
                    : <Eye className="w-4 h-4" style={{ color: "#9CA3AF" }} />
                  }
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg text-white text-[14px] transition-all flex items-center justify-center gap-2 hover:shadow-lg disabled:opacity-70"
              style={{ background: "linear-gradient(135deg, #0B3D91, #1D4ED8)", fontWeight: 600 }}
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : "Sign in"
              }
            </button>
          </form>

          <p className="text-center mt-8 text-[11px]" style={{ color: "#C4C4C4" }}>
            Protected by enterprise-grade security
          </p>
        </div>
      </div>
    </div>
  );
}
