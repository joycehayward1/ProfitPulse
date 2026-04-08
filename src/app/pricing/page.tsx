"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { PricingCards, type BillingInterval } from "@/components/payments/PricingCards";
import { PaymentForm } from "@/components/payments/PaymentForm";
import { useAuth } from "@/contexts/AuthContext";

export default function PricingPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [selected, setSelected] = useState<BillingInterval | null>(null);
  const [step, setStep] = useState<"select" | "pay">("select");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-[#E5E0DA] bg-surface">
        <div className="max-w-6xl mx-auto px-md py-md flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-body text-text-secondary hover:text-text-primary transition-colors"
          >
            <Icon icon="lucide:arrow-left" width={18} height={18} />
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-md py-xl">
        {step === "select" && (
          <>
            <div className="text-center mb-xl">
              <h1 className="font-display text-h1 text-text-primary mb-sm">
                Choose your plan
              </h1>
              <p className="text-body text-text-secondary">
                Pick the billing cycle that works best for your business. Cancel anytime.
              </p>
            </div>

            <PricingCards selected={selected} onSelect={setSelected} />

            <div className="flex justify-center mt-xl">
              <button
                type="button"
                disabled={!selected}
                onClick={() => selected && setStep("pay")}
                className={[
                  "px-8 py-4 rounded-md",
                  "bg-orange text-white text-body font-medium",
                  "hover:bg-[#BF4400] transition-colors",
                  "shadow-[0_2px_8px_rgba(230,81,0,0.25)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                Continue to payment
              </button>
            </div>
          </>
        )}

        {step === "pay" && selected && (
          <>
            <div className="text-center mb-xl">
              <h1 className="font-display text-h1 text-text-primary mb-sm">
                Payment details
              </h1>
              <p className="text-body text-text-secondary">
                You selected the{" "}
                <span className="font-medium text-text-primary">
                  {selected === "monthly" ? "Monthly" : "Annual"}
                </span>{" "}
                plan.
              </p>
            </div>

            {user ? (
              <PaymentForm
                billingInterval={selected}
                userId={user.id}
                userEmail={user.email}
                onSuccess={async () => {
                  await refreshUser();
                  router.push("/dashboard");
                }}
                onBack={() => setStep("select")}
              />
            ) : (
              <p className="text-center text-body text-text-secondary">
                Please{" "}
                <Link href="/login" className="text-orange underline">
                  log in
                </Link>{" "}
                to continue.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
