import { Check, Zap, Building2, Shield, Loader2 } from "lucide-react";
import { useAuth, SubscriptionPlan } from "../context/AuthContext";
import { useState } from "react";
import { useNavigate } from "react-router";
import { PaymentModal } from "../components/shared/PaymentModal";

const features = {
    Free: [
        "View basic Dashboard KPIs",
        "List of safety violations",
        "Basic actions and SLA tracking",
        "Max 50 workers & 1 camera",
        "Email-only support"
    ],
    Pro: [
        "Everything in Free, plus:",
        "AI Agent & Chat Interface",
        "Predictive Risk Analytics",
        "What-If Scenario modeling",
        "Up to 500 workers & 25 cameras",
        "Priority 24/7 Support"
    ],
    Enterprise: [
        "Everything in Pro, plus:",
        "Unlimited workers & cameras",
        "Custom integrations & Webhooks",
        "White-label branding options",
        "Dedicated Account Manager",
        "On-premise deployment option"
    ]
};

export function SubscriptionPage() {
    const { subscriptionPlan, setSubscriptionPlan } = useAuth();
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const navigate = useNavigate();

    const handleSelectPlan = (plan: SubscriptionPlan) => {
        if (plan !== subscriptionPlan) {
            navigate(`/auth/onboarding/form?upgrade=1&target_plan=${encodeURIComponent(plan)}`);
            return;
        }
        if (plan === "Enterprise") {
            window.open("https://theta-ai-website.vercel.app/contact", "_blank");
            // Optionally still allow them to test Enterprise mode locally:
            setSubscriptionPlan(plan);
        } else if (plan === "Pro" && subscriptionPlan !== "Pro") {
            // Open mock payment gateway instead of instant upgrade
            setIsPaymentModalOpen(true);
        } else {
            setSubscriptionPlan(plan);
        }
    };

    const handlePaymentSuccess = () => {
        setIsPaymentModalOpen(false);
        setSubscriptionPlan("Pro");
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 relative">
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onSuccess={handlePaymentSuccess}
                planName="Pro"
                price="$499.00"
            />

            <div className="text-center max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold tracking-tight mb-3">Subscription Plans</h1>
                <p className="text-gray-500 text-[15px]">
                    Choose the right plan for your safety management needs. Currently, you can switch between plans for testing purposes to see how the application behaves.
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 pt-4">
                {/* Free Plan */}
                <div className={`bg-white rounded-2xl border-2 p-6 flex flex-col ${subscriptionPlan === "Free" ? "border-[#2E7D32]" : "border-gray-100"}`}>
                    <div className="mb-4">
                        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
                            <Shield className="w-6 h-6 text-gray-500" />
                        </div>
                        <h3 className="text-xl font-bold mb-1">Free</h3>
                        <p className="text-sm text-gray-500">Essential tools for small teams</p>
                    </div>
                    <div className="text-3xl font-bold mb-6">$0<span className="text-sm font-normal text-gray-500">/mo</span></div>

                    <button
                        onClick={() => handleSelectPlan("Free")}
                        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors mb-6 ${subscriptionPlan === "Free"
                            ? "bg-gray-100 text-gray-800 cursor-default"
                            : "bg-white border text-gray-700 hover:bg-gray-50"
                            }`}
                    >
                        {subscriptionPlan === "Free" ? "Current Plan" : "Select Free"}
                    </button>

                    <div className="flex-1 space-y-3">
                        {features.Free.map((f, i) => (
                            <div key={i} className="flex gap-3 text-sm text-gray-600">
                                <Check className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                <span>{f}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pro Plan */}
                <div className={`bg-white rounded-2xl border-2 p-6 flex flex-col relative ${subscriptionPlan === "Pro" ? "border-[#2E7D32]" : "border-green-100"}`}>
                    <div className="absolute top-0 right-6 -translate-y-1/2">
                        <span className="bg-[#2E7D32] text-white text-[11px] uppercase font-bold px-3 py-1 rounded-full">Recommended</span>
                    </div>
                    <div className="mb-4">
                        <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-4">
                            <Zap className="w-6 h-6 text-[#2E7D32]" />
                        </div>
                        <h3 className="text-xl font-bold mb-1">Pro</h3>
                        <p className="text-sm text-gray-500">AI-powered insights for growing sites</p>
                    </div>
                    <div className="text-3xl font-bold mb-6">$499<span className="text-sm font-normal text-gray-500">/mo</span></div>

                    <button
                        onClick={() => handleSelectPlan("Pro")}
                        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors mb-6 ${subscriptionPlan === "Pro"
                            ? "bg-[#1B5E20] text-white cursor-default shadow-md"
                            : "bg-[#2E7D32] text-white hover:bg-[#1B5E20]"
                            }`}
                    >
                        {subscriptionPlan === "Pro" ? "Current Plan" : "Upgrade to Pro"}
                    </button>

                    <div className="flex-1 space-y-3">
                        {features.Pro.map((f, i) => (
                            <div key={i} className="flex gap-3 text-sm text-gray-600">
                                <Check className="w-4 h-4 text-[#2E7D32] shrink-0 mt-0.5" />
                                <span className={i === 0 ? "font-medium text-gray-900" : ""}>{f}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Enterprise Plan */}
                <div className={`bg-white rounded-2xl border-2 p-6 flex flex-col ${subscriptionPlan === "Enterprise" ? "border-[#2E7D32]" : "border-gray-100"}`}>
                    <div className="mb-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                            <Building2 className="w-6 h-6 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-1">Enterprise</h3>
                        <p className="text-sm text-gray-500">Custom solutions for large organizations</p>
                    </div>
                    <div className="text-3xl font-bold mb-6">Custom</div>

                    <button
                        onClick={() => handleSelectPlan("Enterprise")}
                        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors mb-6 ${subscriptionPlan === "Enterprise"
                            ? "bg-blue-50 text-blue-700 border border-blue-200 cursor-default"
                            : "bg-white border text-gray-700 hover:bg-gray-50"
                            }`}
                    >
                        {subscriptionPlan === "Enterprise" ? "Current Plan" : "Contact Sales"}
                    </button>

                    <div className="flex-1 space-y-3">
                        {features.Enterprise.map((f, i) => (
                            <div key={i} className="flex gap-3 text-sm text-gray-600">
                                <Check className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                <span className={i === 0 ? "font-medium text-gray-900" : ""}>{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
