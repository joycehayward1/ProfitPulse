"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input } from "@/components/ui";

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginPage() {
  const router = useRouter();
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
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrors({ general: "Invalid email or password. Please try again." });
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
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
