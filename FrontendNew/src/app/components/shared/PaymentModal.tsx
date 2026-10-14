import { useState, useEffect } from "react";
import { CreditCard, X, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    planName: string;
    price: string;
}

export function PaymentModal({ isOpen, onClose, onSuccess, planName, price }: PaymentModalProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [cardNumber, setCardNumber] = useState("");
    const [expiry, setExpiry] = useState("");
    const [cvc, setCvc] = useState("");
    const [name, setName] = useState("");

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setIsProcessing(false);
            setIsSuccess(false);
            setCardNumber("4242 4242 4242 4242"); // Pre-fill with test card
            setExpiry("12/26");
            setCvc("123");
            setName("John Doe");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handlePayment = (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);

        // Simulate API delay for payment gateway
        setTimeout(() => {
            setIsProcessing(false);
            setIsSuccess(true);

            // Keep success state visible for a moment before closing/redirecting
            setTimeout(() => {
                onSuccess();
            }, 1500);
        }, 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative"
                style={{ animation: 'slideUp 0.3s ease-out' }}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Complete Payment</h3>
                        <p className="text-sm text-gray-500">Upgrade to {planName} Plan</p>
                    </div>
                    {!isProcessing && !isSuccess && (
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="p-6">
                    {/* Amount Display */}
                    <div className="mb-6 pb-6 border-b border-gray-100">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-gray-500 text-sm">Amount due</span>
                            <span className="text-2xl font-bold text-gray-900">{price}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 w-fit px-2.5 py-1 rounded-full mt-2">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Secure 256-bit encrypted checkout
                        </div>
                    </div>

                    {isSuccess ? (
                        <div className="py-8 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Successful!</h3>
                            <p className="text-gray-500 text-sm">Your account has been upgraded.</p>
                        </div>
                    ) : (
                        <form onSubmit={handlePayment} className="space-y-4">
                            {/* Name Input */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Name on Card</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8] transition-all"
                                    placeholder="John Doe"
                                    disabled={isProcessing}
                                />
                            </div>

                            {/* Card Number Input */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Card Information</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        value={cardNumber}
                                        onChange={(e) => setCardNumber(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8] transition-all font-mono"
                                        placeholder="0000 0000 0000 0000"
                                        disabled={isProcessing}
                                    />
                                </div>
                            </div>

                            {/* Expiry & CVC */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <input
                                        type="text"
                                        required
                                        value={expiry}
                                        onChange={(e) => setExpiry(e.target.value)}
                                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8] transition-all font-mono"
                                        placeholder="MM/YY"
                                        disabled={isProcessing}
                                    />
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        required
                                        value={cvc}
                                        onChange={(e) => setCvc(e.target.value)}
                                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8] transition-all font-mono"
                                        placeholder="CVC"
                                        disabled={isProcessing}
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isProcessing}
                                className="w-full mt-6 py-3 rounded-lg text-white text-sm font-semibold transition-all relative overflow-hidden flex items-center justify-center disable:opacity-80"
                                style={{ background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)', boxShadow: '0 4px 12px rgba(11, 61, 145, 0.25)' }}
                            >
                                {isProcessing ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processing...
                                    </div>
                                ) : (
                                    `Pay ${price}`
                                )}
                            </button>
                        </form>
                    )}

                    {/* Dummy Test Mode Notice */}
                    {!isSuccess && (
                        <p className="text-center text-[10px] text-gray-400 mt-4 px-4">
                            This is a secure mock payment gateway for testing mode. No real charges will be made.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
