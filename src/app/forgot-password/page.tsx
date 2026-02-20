"use client";

import { useState, FormEvent } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
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
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout
        heading="Check your email"
        subheading={`We sent a password reset link to ${email}. It may take a minute to arrive.`}
        footerText="Remember your password?"
        footerLinkText="Log in"
        footerLinkHref="/login"
      >
        <div className="text-center space-y-md">
          {/* Mail icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-orange/10 flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#E65100"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <p className="text-body text-text-secondary">
            Didn&apos;t get the email? Check your spam folder or try again.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setSent(false);
              setLoading(false);
            }}
          >
            Try again
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading="Reset your password"
      subheading="Enter your email and we'll send you a link to get back in."
      footerText="Remember your password?"
      footerLinkText="Log in"
      footerLinkHref="/login"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-sm">
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
          <Button
            type="submit"
            fullWidth
            loading={loading}
            size="lg"
          >
            Send Reset Link
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
