"use client";

import { useState, FormEvent, Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const email = searchParams.get("email") || "";
  const shouldAutoResend = searchParams.get("resend") === "1";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const autoResendStarted = useRef(false);

  useEffect(() => {
    if (!email || !shouldAutoResend || autoResendStarted.current) return;
    autoResendStarted.current = true;

    async function sendCode() {
      setResending(true);
      setError("");
      try {
        const { getInsForgeClient } = await import("@/lib/insforge");
        const client = getInsForgeClient();
        const { error: resendError } = await client.auth.resendVerificationEmail({
          email,
        });

        if (resendError) {
          setError("Could not send a verification code. Use Resend code below.");
        } else {
          setInfo("We sent a new 6-digit code to your email.");
        }
      } catch {
        setError("Could not send a verification code. Use Resend code below.");
      } finally {
        setResending(false);
      }
    }

    void sendCode();
  }, [email, shouldAutoResend]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!code.trim()) {
      setError("Please enter the verification code");
      return;
    }

    if (code.length !== 6) {
      setError("Code must be 6 digits");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      const { data: _data, error: verifyError } = await client.auth.verifyEmail({
        email,
        otp: code,
      });

      if (verifyError) {
        setError("Invalid or expired code. Please try again.");
        setLoading(false);
        return;
      }

      // Refresh user state
      await refreshUser();

      // Redirect to dashboard
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) {
      setError("Email address not found. Please sign up again.");
      return;
    }

    setResending(true);
    setError("");

    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      const { error: resendError } = await client.auth.resendVerificationEmail({
        email,
      });

      if (resendError) {
        setError("Failed to resend code. Please try again.");
      } else {
        setError("");
        setInfo("A new verification code has been sent to your email.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout
      heading="Verify your email"
      subheading={`We sent a 6-digit code to ${email || "your email"}. Enter it below to continue.`}
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
        {error && (
          <div className="p-sm rounded-md bg-error/5 border border-error/20">
            <p className="text-body text-error">{error}</p>
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
            setError("");
          }}
          error={error}
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
            disabled={resending}
            className="text-small text-orange hover:underline disabled:opacity-50"
          >
            {resending ? "Sending..." : "Resend code"}
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
