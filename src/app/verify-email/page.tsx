"use client";

import { useState, FormEvent, Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import {
  getResendVerificationErrorMessage,
  isRateLimitError,
} from "@/lib/auth-errors";

const RESEND_COOLDOWN_SECONDS = 60;

function resendSessionKey(email: string) {
  return `verify-email-resend:${email.toLowerCase()}`;
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const email = searchParams.get("email") || "";
  const shouldAutoResend = searchParams.get("resend") === "1";

  const [code, setCode] = useState("");
  const [bannerError, setBannerError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const autoResendStarted = useRef(false);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  async function sendVerificationCode(source: "auto" | "manual") {
    if (!email) {
      setBannerError("Email address not found. Please sign up again.");
      return;
    }

    if (cooldownSeconds > 0) {
      return;
    }

    setResending(true);
    setBannerError("");
    setInfo("");

    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();
      const { error: resendError } = await client.auth.resendVerificationEmail({
        email,
      });

      if (resendError) {
        const message = getResendVerificationErrorMessage(
          resendError,
          source === "auto"
            ? "Could not send a verification code. Use Resend code below."
            : "Failed to resend code. Please try again."
        );
        setBannerError(message);
        if (isRateLimitError(resendError)) {
          setCooldownSeconds(RESEND_COOLDOWN_SECONDS * 5);
        } else {
          setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
        }
        return;
      }

      sessionStorage.setItem(resendSessionKey(email), String(Date.now()));
      setInfo("We sent a new 6-digit code to your email.");
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } catch {
      setBannerError(
        source === "auto"
          ? "Could not send a verification code. Use Resend code below."
          : "Something went wrong. Please try again."
      );
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } finally {
      setResending(false);
    }
  }

  useEffect(() => {
    if (!email || !shouldAutoResend || autoResendStarted.current) return;

    const lastSentAt = Number(sessionStorage.getItem(resendSessionKey(email)) || 0);
    const recentlySent = Date.now() - lastSentAt < RESEND_COOLDOWN_SECONDS * 1000;
    if (recentlySent) {
      const remaining = Math.ceil(
        (RESEND_COOLDOWN_SECONDS * 1000 - (Date.now() - lastSentAt)) / 1000
      );
      setCooldownSeconds(Math.max(0, remaining));
      setInfo("Check your inbox for the verification code we already sent.");
      return;
    }

    autoResendStarted.current = true;

    async function autoSend() {
      await sendVerificationCode("auto");
    }

    void autoSend();
    // sendVerificationCode intentionally omitted — one-shot auto resend on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, shouldAutoResend]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!code.trim()) {
      setCodeError("Please enter the verification code");
      return;
    }

    if (code.length !== 6) {
      setCodeError("Code must be 6 digits");
      return;
    }

    setCodeError("");
    setBannerError("");
    setLoading(true);

    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      const { data: _data, error: verifyError } = await client.auth.verifyEmail({
        email,
        otp: code,
      });

      if (verifyError) {
        setBannerError("Invalid or expired code. Please try again.");
        setLoading(false);
        return;
      }

      await refreshUser();
      router.push("/dashboard");
    } catch {
      setBannerError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleResend() {
    await sendVerificationCode("manual");
  }

  const resendDisabled = resending || cooldownSeconds > 0;
  const resendLabel = resending
    ? "Sending..."
    : cooldownSeconds > 0
      ? `Resend code in ${cooldownSeconds}s`
      : "Resend code";

  return (
    <AuthLayout
      heading="Verify your email"
      subheading={`Enter the 6-digit code sent to ${email || "your email"}. If you don't see it, check spam or resend below.`}
      footerText="Wrong email?"
      footerLinkText="Go back"
      footerLinkHref="/signup"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-sm">
        {info && (
          <div className="p-sm rounded-md bg-success/5 border border-success/20">
            <p className="text-body text-success">{info}</p>
          </div>
        )}
        {bannerError && (
          <div className="p-sm rounded-md bg-error/5 border border-error/20">
            <p className="text-body text-error">{bannerError}</p>
          </div>
        )}

        <Input
          label="Verification Code"
          type="text"
          placeholder="000000"
          value={code}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(value);
            if (codeError) setCodeError("");
          }}
          error={codeError}
          required
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
        />

        <div className="pt-xs">
          <Button type="submit" fullWidth loading={loading} size="lg">
            Verify Email
          </Button>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendDisabled}
            className="text-small text-orange hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {resendLabel}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
