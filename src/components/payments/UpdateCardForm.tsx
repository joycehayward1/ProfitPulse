"use client";

import { FormEvent, useState } from "react";
import { useAcceptJs } from "react-acceptjs";
import { Icon } from "@iconify/react";
import { getAnetEnvironment } from "@/lib/anet-env";

interface UpdateCardFormProps {
  userId: string;
  userEmail?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Accept.js-backed form for updating the payment method on an existing
 * subscription. Tokenizes the new card via react-acceptjs then POSTs to
 * /api/payments/update-card which creates a new payment profile under the
 * user's existing Customer Profile and updates their ARB to use it.
 */
export function UpdateCardForm({
  userId,
  userEmail: _userEmail,
  onSuccess,
  onCancel,
}: UpdateCardFormProps) {
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
        setErrorMsg(response.messages.message?.[0]?.text ?? "Tokenization failed.");
        return;
      }

      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || undefined;
      const lastName = nameParts.slice(1).join(" ") || undefined;

      const res = await fetch("/api/payments/update-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          nonce: response.opaqueData,
          customer: {
            firstName,
            lastName,
            zip: zip || undefined,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMsg(json.error ?? "Card update failed.");
        return;
      }

      onSuccess();
    } catch (err: unknown) {
      const msg =
        (err as { messages?: { message?: { text?: string }[] } })?.messages
          ?.message?.[0]?.text ?? "Something went wrong. Please try again.";
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
    <form onSubmit={handleSubmit} className="space-y-md">
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
        <label htmlFor="uc-fullName" className={labelClass}>
          Cardholder name
        </label>
        <input
          id="uc-fullName"
          type="text"
          autoComplete="cc-name"
          placeholder="Jane Smith"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="uc-cardNumber" className={labelClass}>
          Card number
        </label>
        <input
          id="uc-cardNumber"
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
          <label htmlFor="uc-month" className={labelClass}>
            Month
          </label>
          <input
            id="uc-month"
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
          <label htmlFor="uc-year" className={labelClass}>
            Year
          </label>
          <input
            id="uc-year"
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
          <label htmlFor="uc-cvv" className={labelClass}>
            CVV
          </label>
          <input
            id="uc-cvv"
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
        <label htmlFor="uc-zip" className={labelClass}>
          Billing ZIP
        </label>
        <input
          id="uc-zip"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="12345"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex gap-sm justify-end pt-xs">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-6 py-3 rounded-md border-2 border-orange text-orange font-medium hover:bg-[#FFF0E6] transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={scriptLoading || submitting}
          className="px-6 py-3 rounded-md bg-orange text-white text-body font-medium hover:bg-[#BF4400] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting
            ? "Updating..."
            : scriptLoading
              ? "Loading..."
              : "Update Card"}
        </button>
      </div>
    </form>
  );
}
