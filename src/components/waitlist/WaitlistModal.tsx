"use client";

import { FormEvent, useState, useEffect } from "react";
import { Icon } from "@iconify/react";

interface WaitlistModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Email + name capture modal for the waitlist. On submit, POSTs to
 * /api/waitlist/join with the form data plus any UTM params captured from
 * the current URL. Shows a success state after submission.
 */
export function WaitlistModal({ open, onClose }: WaitlistModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<"new" | "existing" | null>(null);

  // Reset form each time the modal opens
  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setBusinessName("");
      setErrorMsg(null);
      setSuccess(null);
      setSubmitting(false);
    }
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg("Please enter a valid email address");
      return;
    }

    setSubmitting(true);

    // Pull UTM params from the current URL
    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();

    const utm = {
      source: params.get("utm_source") || undefined,
      medium: params.get("utm_medium") || undefined,
      campaign: params.get("utm_campaign") || undefined,
      term: params.get("utm_term") || undefined,
      content: params.get("utm_content") || undefined,
    };

    try {
      const res = await fetch("/api/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          businessName: businessName.trim() || undefined,
          utm,
          referrer:
            typeof document !== "undefined" ? document.referrer || null : null,
          landingUrl:
            typeof window !== "undefined" ? window.location.href : null,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMsg(json.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      setSuccess(json.alreadyOnList ? "existing" : "new");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-md py-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-title"
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E5E0DA] p-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-md right-md w-8 h-8 flex items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-[#F5F0E8] transition-colors"
          aria-label="Close"
        >
          <Icon icon="lucide:x" width={18} height={18} />
        </button>

        {success ? (
          <div className="text-center py-md">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-md">
              <Icon icon="lucide:check" className="text-success" width={32} height={32} />
            </div>
            <h2
              id="waitlist-title"
              className="font-display text-h2 text-text-primary mb-sm"
            >
              {success === "existing" ? "You're already in!" : "You're in!"}
            </h2>
            <p className="text-body text-text-secondary mb-lg">
              {success === "existing"
                ? "Looks like you already signed up. We'll email you the moment ProfitPulse goes live."
                : "Thanks for joining the ProfitPulse waitlist. Check your email for a welcome note — we'll be in touch when we launch."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-3 rounded-md bg-orange text-white text-body font-medium hover:bg-[#BF4400] transition-colors"
            >
              Got it
            </button>
          </div>
        ) : (
          <>
            <h2
              id="waitlist-title"
              className="font-display text-h2 text-text-primary mb-xs"
            >
              Join the waitlist
            </h2>
            <p className="text-body text-text-secondary mb-lg">
              Be the first to know when ProfitPulse goes live. Early access, early pricing.
            </p>

            <form onSubmit={handleSubmit} className="space-y-md">
              {errorMsg && (
                <div className="p-sm rounded-md bg-error/5 border border-error/20">
                  <p className="text-small text-error">{errorMsg}</p>
                </div>
              )}

              <div>
                <label
                  htmlFor="wl-name"
                  className="block text-body font-body font-medium text-text-secondary mb-[6px]"
                >
                  Your name
                </label>
                <input
                  id="wl-name"
                  type="text"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="w-full px-4 py-3 text-body font-body text-text-primary bg-surface border border-[#D1D5DB] rounded-md focus:border-orange focus:ring-2 focus:ring-orange/20 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="wl-email"
                  className="block text-body font-body font-medium text-text-secondary mb-[6px]"
                >
                  Email address <span className="text-error">*</span>
                </label>
                <input
                  id="wl-email"
                  type="email"
                  placeholder="you@business.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 text-body font-body text-text-primary bg-surface border border-[#D1D5DB] rounded-md focus:border-orange focus:ring-2 focus:ring-orange/20 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="wl-business"
                  className="block text-body font-body font-medium text-text-secondary mb-[6px]"
                >
                  Business name <span className="text-text-muted font-normal">(optional)</span>
                </label>
                <input
                  id="wl-business"
                  type="text"
                  placeholder="Your company"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  autoComplete="organization"
                  className="w-full px-4 py-3 text-body font-body text-text-primary bg-surface border border-[#D1D5DB] rounded-md focus:border-orange focus:ring-2 focus:ring-orange/20 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-8 py-4 rounded-md bg-orange text-white text-body font-medium hover:bg-[#BF4400] active:bg-[#A33B00] transition-colors shadow-[0_2px_8px_rgba(230,81,0,0.25)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Joining..." : "Join Waitlist"}
              </button>

              <p className="text-small text-text-muted text-center">
                No spam. We'll only email you when ProfitPulse goes live.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
