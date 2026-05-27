"use client";

import { FormEvent, useState } from "react";
import { useAcceptJs } from "react-acceptjs";
import { Icon } from "@iconify/react";
import type { BillingInterval } from "./PricingCards";
import { getAnetEnvironment } from "@/lib/anet-env";

interface PaymentFormProps {
  billingInterval: BillingInterval;
  /** Current authenticated user id — required for /api/payments/subscribe. */
  userId: string;
  /** User's email, used for receipts + AVS. */
  userEmail?: string;
  /** Callback after a successful subscription. */
  onSuccess?: (result: {
    transactionId: string;
    subscriptionId: string;
    currentPeriodEnd: string;
  }) => void;
  /** Optional "Back" button handler. */
  onBack?: () => void;
}

const AMOUNTS: Record<BillingInterval, string> = {
  monthly: "$59.99",
  annual: "$599.88",
};

/**
 * Credit card form backed by Accept.js.
 *
 * Card data never touches the ProfitPulse server — it's sent directly to
 * Authorize.net via `dispatchData`, which returns an opaque nonce.
 *
 * For now this component just console.logs the nonce. A future phase will
 * POST it to `/api/payments/subscribe` along with the selected billing
 * interval.
 */
export function PaymentForm({
  billingInterval,
  userId,
  userEmail,
  onSuccess,
  onBack,
}: PaymentFormProps) {
  const { dispatchData, loading: scriptLoading, error: scriptError } = useAcceptJs({
    environment: getAnetEnvironment(),
    authData: {
      apiLoginID: process.env.NEXT_PUBLIC_ANET_API_LOGIN_ID ?? "",
      clientKey: process.env.NEXT_PUBLIC_ANET_CLIENT_KEY ?? "",
    },
  });

  const [fullName, setFullName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cardCode, setCardCode] = useState("");
  const [zip, setZip] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!cardNumber || !expMonth || !expYear || !cardCode) {
      setErrorMsg("Please fill out all card fields.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await dispatchData({
        cardData: {
          cardNumber: cardNumber.replace(/\s+/g, ""),
          month: expMonth.padStart(2, "0"),
          year: expYear.length === 2 ? `20${expYear}` : expYear,
          cardCode,
          zip: zip || undefined,
          fullName: fullName || undefined,
        },
      });

      if (response.messages.resultCode !== "Ok") {
        const msg = response.messages.message?.[0]?.text ?? "Tokenization failed.";
        setErrorMsg(msg);
        return;
      }

      // Split "Jane Smith" into first + last for billTo
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || undefined;
      const lastName = nameParts.slice(1).join(" ") || undefined;

      const subRes = await fetch("/api/payments/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          billingInterval,
          nonce: response.opaqueData,
          customer: {
            email: userEmail,
            firstName,
            lastName,
            zip: zip || undefined,
          },
        }),
      });

      const subJson = await subRes.json();

      if (!subRes.ok || subJson.error) {
        setErrorMsg(subJson.error ?? "Subscription failed. Please try again.");
        return;
      }

      if (subJson.warning) {
        setErrorMsg(subJson.warning);
        return;
      }

      onSuccess?.({
        transactionId: subJson.transactionId,
        subscriptionId: subJson.subscriptionId,
        currentPeriodEnd: subJson.currentPeriodEnd,
      });
    } catch (err: unknown) {
      const msg =
        (err as { messages?: { message?: { text?: string }[] } })?.messages?.message?.[0]
          ?.text ?? "Something went wrong. Please try again.";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = [
    "w-full px-4 py-3",
    "text-body font-body text-text-primary",
    "bg-surface",
    "border border-[#D1D5DB]",
    "rounded-md",
    "transition-colors duration-200",
    "focus:border-orange focus:ring-2 focus:ring-orange/20 focus:outline-none",
  ].join(" ");

  const labelClass = "text-body font-body font-medium text-text-secondary mb-[6px] block";

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto bg-surface rounded-xl border border-[#E5E0DA] shadow-sm p-lg space-y-md"
    >
      <div className="flex items-center gap-2 text-small text-text-muted">
        <Icon icon="lucide:lock" width={14} height={14} />
        <span>Secured by Authorize.net — card data never touches our server.</span>
      </div>

      {scriptError && (
        <div className="p-sm rounded-md bg-error/5 border border-error/20">
          <p className="text-small text-error">
            Failed to load Accept.js. Please refresh and try again.
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="p-sm rounded-md bg-error/5 border border-error/20">
          <p className="text-small text-error">{errorMsg}</p>
        </div>
      )}

      <div>
        <label htmlFor="fullName" className={labelClass}>
          Cardholder name
        </label>
        <input
          id="fullName"
          type="text"
          autoComplete="cc-name"
          placeholder="Jane Smith"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="cardNumber" className={labelClass}>
          Card number
        </label>
        <input
          id="cardNumber"
          type="text"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          className={inputClass}
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-sm">
        <div>
          <label htmlFor="expMonth" className={labelClass}>
            Month
          </label>
          <input
            id="expMonth"
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp-month"
            placeholder="MM"
            maxLength={2}
            value={expMonth}
            onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, ""))}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="expYear" className={labelClass}>
            Year
          </label>
          <input
            id="expYear"
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp-year"
            placeholder="YYYY"
            maxLength={4}
            value={expYear}
            onChange={(e) => setExpYear(e.target.value.replace(/\D/g, ""))}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="cardCode" className={labelClass}>
            CVV
          </label>
          <input
            id="cardCode"
            type="text"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
            maxLength={4}
            value={cardCode}
            onChange={(e) => setCardCode(e.target.value.replace(/\D/g, ""))}
            className={inputClass}
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="zip" className={labelClass}>
          Billing ZIP
        </label>
        <input
          id="zip"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="12345"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="pt-xs space-y-sm">
        <button
          type="submit"
          disabled={scriptLoading || submitting}
          className={[
            "w-full px-6 py-4 rounded-md",
            "bg-orange text-white text-body font-medium",
            "hover:bg-[#BF4400] active:bg-[#A33B00] transition-colors",
            "shadow-[0_2px_8px_rgba(230,81,0,0.25)]",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          {submitting
            ? "Processing..."
            : scriptLoading
              ? "Loading..."
              : `Pay ${AMOUNTS[billingInterval]}`}
        </button>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-full py-2 text-small text-text-secondary hover:text-text-primary transition-colors"
          >
            ← Change plan
          </button>
        )}
      </div>
    </form>
  );
}
