"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const validationErrors: FormErrors = {};
    if (!email.trim()) {
      validationErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationErrors.email = "Please enter a valid email address";
    }
    if (!password) {
      validationErrors.password = "Password is required";
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
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      console.log("Login response:", { data, error });

      if (error) {
        console.error("Login error:", error);

        // Check if it's an email verification error
        if (error.message?.toLowerCase().includes("verify") || error.message?.toLowerCase().includes("unverified")) {
          setErrors({ general: "Please verify your email address first." });
          setLoading(false);
          // Redirect to verification page
          setTimeout(() => router.push(`/verify-email?email=${encodeURIComponent(email)}`), 2000);
          return;
        }

        setErrors({ general: error.message || "Invalid email or password. Please try again." });
        setLoading(false);
        return;
      }

      if (!data?.accessToken) {
        console.error("No access token received");
        setErrors({ general: "Login failed. Please try again." });
        setLoading(false);
        return;
      }

      console.log("Login successful, refreshing user...");
      // Refresh user state before redirecting
      await refreshUser();
      router.push(nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard");
    } catch (err) {
      console.error("Login exception:", err);
      setErrors({
        general: "Something went wrong. Please try again.",
      });
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      heading="Welcome back"
      subheading="Log in to see how your business is doing."
      footerText="Don't have an account?"
      footerLinkText="Sign up"
      footerLinkHref="/signup"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-sm">
        {errors.general && (
          <div className="p-sm rounded-md bg-error/5 border border-error/20">
            <p className="text-body text-error">{errors.general}</p>
          </div>
        )}

        <Input
          label="Email address"
          type="email"
          placeholder="you@business.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          error={errors.email}
          required
          autoComplete="email"
        />

        <div>
          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
            required
            autoComplete="current-password"
          />
          <div className="mt-xs text-right">
            <Link
              href="/forgot-password"
              className="text-small text-orange hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <div className="pt-xs">
          <Button
            type="submit"
            fullWidth
            loading={loading}
            size="lg"
          >
            Log In
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
