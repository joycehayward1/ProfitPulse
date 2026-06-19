"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input } from "@/components/ui";
import { Suspense } from "react";

interface FormErrors {
  password?: string;
  confirmPassword?: string;
  general?: string;
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  // Extract the reset token from URL query params or hash
  useEffect(() => {
    // Try query param first (e.g., /reset-password?token=abc)
    const queryToken = searchParams.get("token");
    if (queryToken) {
      setToken(queryToken);
      setChecked(true);
      return;
    }

    // Try hash fragment (e.g., /reset-password#access_token=abc)
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const hashToken = params.get("access_token") || params.get("token");
      if (hashToken) {
        setToken(hashToken);
        setChecked(true);
        return;
      }
    }

    // No token found
    setChecked(true);
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const validationErrors: FormErrors = {};

    if (!password) {
      validationErrors.password = "Password is required";
    } else if (password.length < 8) {
      validationErrors.password = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      validationErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      validationErrors.confirmPassword = "Passwords don't match";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();
      const { error } = await client.auth.resetPassword({
        newPassword: password,
        otp: token || "",
      });

      if (error) {
        setErrors({ general: error.message });
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setErrors({
        general: "Something went wrong. Please try again.",
      });
      setLoading(false);
    }
  }

  // Loading state while checking for token
  if (!checked) {
    return null;
  }

  // Success state
  if (success) {
    return (
      <AuthLayout
        heading="Password updated!"
        subheading="Your password has been reset successfully. You can now log in with your new password."
        footerText="Need help?"
        footerLinkText="Contact support"
        footerLinkHref="/"
      >
        <div className="text-center space-y-md">
          {/* Checkmark icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#43A047"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <Button
            onClick={() => router.push("/login")}
            fullWidth
            size="lg"
          >
            Go to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // No token — send user back to request a new reset code
  if (!token) {
    return (
      <AuthLayout
        heading="Reset session expired"
        subheading="Start again from the forgot password page and enter the 6-digit code from your email."
        footerText="Remember your password?"
        footerLinkText="Log in"
        footerLinkHref="/login"
      >
        <div className="text-center space-y-md">
          {/* Warning icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F9A825"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <Button
            onClick={() => router.push("/forgot-password")}
            fullWidth
            size="lg"
          >
            Request New Code
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Reset password form
  return (
    <AuthLayout
      heading="Set your new password"
      subheading="Choose a strong password that you haven't used before."
      footerText="Remember your password?"
      footerLinkText="Log in"
      footerLinkHref="/login"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-sm">
        {errors.general && (
          <div className="p-sm rounded-md bg-error/5 border border-error/20">
            <p className="text-body text-error">{errors.general}</p>
          </div>
        )}

        <Input
          label="New password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          error={errors.password}
          required
          autoComplete="new-password"
        />

        <Input
          label="Confirm new password"
          type="password"
          placeholder="Type your password again"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (errors.confirmPassword)
              setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          error={errors.confirmPassword}
          required
          autoComplete="new-password"
        />

        <div className="pt-xs">
          <Button
            type="submit"
            fullWidth
            loading={loading}
            size="lg"
          >
            Reset Password
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
