"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { LaunchPricingCards } from "@/components/payments/LaunchPricingCards";
import type { BillingInterval } from "@/components/payments/PricingCards";
import { PaymentForm } from "@/components/payments/PaymentForm";
import { useAuth } from "@/contexts/AuthContext";

function LaunchPageContent() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [selected, setSelected] = useState<BillingInterval | null>(null);
  const [step, setStep] = useState<"select" | "pay">("select");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-[#E5E0DA] bg-surface">
        <div className="max-w-6xl mx-auto px-md py-md flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-body text-text-secondary hover:text-text-primary transition-colors"
          >
            <Icon icon="lucide:arrow-left" width={18} height={18} />
            Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-md py-xl">
        {step === "select" && (
          <>
            <div className="text-center mb-xl max-w-2xl mx-auto">
              <span className="inline-block mb-sm px-3 py-1 rounded-full bg-orange/10 text-orange text-small font-semibold">
                Launch offer
              </span>
              <h1 className="font-display text-h1 text-text-primary mb-sm">
                Lock in launch pricing forever
              </h1>
              <p className="text-body text-text-secondary">
                20% off monthly or 30% off annual — your rate stays the same for as long
                as you subscribe. Choose a plan below, then complete checkout.
              </p>
            </div>

            <LaunchPricingCards selected={selected} onSelect={setSelected} />

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
                Complete your launch purchase
              </h1>
              <p className="text-body text-text-secondary">
                You selected{" "}
                <span className="font-medium text-text-primary">
                  {selected === "monthly" ? "Launch Monthly" : "Launch Annual"}
                </span>
                . Your discounted rate is locked in on every renewal.
              </p>
            </div>

            {user ? (
              <PaymentForm
                billingInterval={selected}
                promo="launch"
                userId={user.id}
                userEmail={user.email}
                onSuccess={async () => {
                  await refreshUser();
                  router.push("/dashboard");
                }}
                onBack={() => setStep("select")}
              />
            ) : (
              <div className="max-w-md mx-auto text-center space-y-md bg-surface rounded-xl border border-[#E5E0DA] p-lg">
                <p className="text-body text-text-secondary">
                  Create a free account or log in to complete your purchase.
                </p>
                <div className="flex flex-col sm:flex-row gap-sm justify-center">
                  <Link
                    href={`/signup?next=${encodeURIComponent("/launch")}`}
                    className="px-6 py-3 rounded-md bg-orange text-white font-medium hover:bg-[#BF4400] transition-colors"
                  >
                    Create account
                  </Link>
                  <Link
                    href={`/login?next=${encodeURIComponent("/launch")}`}
                    className="px-6 py-3 rounded-md border border-[#E5E0DA] text-text-primary font-medium hover:border-orange transition-colors"
                  >
                    Log in
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function LaunchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LaunchPageContent />
    </Suspense>
  );
}
