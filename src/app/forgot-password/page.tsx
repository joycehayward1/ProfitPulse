"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input, useToast } from "@/components/ui";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSendEmail(e: FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();
      const { error: authError } = await client.auth.sendResetPasswordEmail({
        email,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      setSent(true);
      setLoading(false);
      showToast("success", "Reset code sent! Check your email.");
    } catch {
      setError("Something went wrong. Please try again.");
      showToast("error", "Failed to send reset code. Please try again.");
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setResending(true);
    setError("");

    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();
      const { error: authError } = await client.auth.sendResetPasswordEmail({
        email,
      });

      if (authError) {
        setError("Failed to resend code. Please try again.");
      } else {
        showToast("success", "A new reset code has been sent.");
      }
    } catch {
      setError("Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();

    if (!code.trim()) {
      setError("Please enter the reset code");
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
      const { data, error: exchangeError } =
        await client.auth.exchangeResetPasswordToken({
          email,
          code,
        });

      if (exchangeError || !data?.token) {
        setError("Invalid or expired code. Please try again.");
        setLoading(false);
        return;
      }

      router.push(`/reset-password?token=${encodeURIComponent(data.token)}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout
        heading="Enter your reset code"
        subheading={`We sent a 6-digit code to ${email}. Enter it below to choose a new password.`}
        footerText="Remember your password?"
        footerLinkText="Log in"
        footerLinkHref="/login"
      >
        <form onSubmit={handleVerifyCode} noValidate className="space-y-sm">
          {error && (
            <div className="p-sm rounded-md bg-error/5 border border-error/20">
              <p className="text-body text-error">{error}</p>
            </div>
          )}

          <Input
            label="Reset code"
            type="text"
            placeholder="000000"
            value={code}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(value);
              if (error) setError("");
            }}
            required
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
          />

          <div className="pt-xs">
            <Button type="submit" fullWidth loading={loading} size="lg">
              Continue
            </Button>
          </div>

          <div className="flex flex-col items-center gap-sm text-center">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resending}
              className="text-small text-orange hover:underline disabled:opacity-50"
            >
              {resending ? "Sending..." : "Resend code"}
            </button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                setSent(false);
                setCode("");
                setError("");
              }}
            >
              Use a different email
            </Button>
          </div>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading="Reset your password"
      subheading="Enter your email and we'll send you a 6-digit code to get back in."
      footerText="Remember your password?"
      footerLinkText="Log in"
      footerLinkHref="/login"
    >
      <form onSubmit={handleSendEmail} noValidate className="space-y-sm">
        {error && (
          <div className="p-sm rounded-md bg-error/5 border border-error/20">
            <p className="text-body text-error">{error}</p>
          </div>
        )}

        <Input
          label="Email address"
          type="email"
          placeholder="you@business.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          error={error && !email.trim() ? error : undefined}
          required
          autoComplete="email"
        />

        <div className="pt-xs">
          <Button type="submit" fullWidth loading={loading} size="lg">
            Send Reset Code
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
