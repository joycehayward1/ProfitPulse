"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input } from "@/components/ui";

const INDUSTRIES = [
  "Engineering",
  "Medical Services",
  "Dental",
  "Construction",
  "Churches",
  "Schools",
  "Other",
] as const;

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  businessName?: string;
  industry?: string;
  general?: string;
}

function validateForm(fields: {
  email: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  industry: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!fields.email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = "Please enter a valid email address";
  }

  if (!fields.password) {
    errors.password = "Password is required";
  } else if (fields.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }

  if (!fields.confirmPassword) {
    errors.confirmPassword = "Please confirm your password";
  } else if (fields.password !== fields.confirmPassword) {
    errors.confirmPassword = "Passwords don't match";
  }

  if (!fields.businessName.trim()) {
    errors.businessName = "Business name is required";
  }

  if (!fields.industry) {
    errors.industry = "Please select your industry";
  }

  return errors;
}

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const validationErrors = validateForm({
      email,
      password,
      confirmPassword,
      businessName,
      industry,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();
      const { error } = await client.auth.signUp({
        email,
        password,
        name: businessName,
      });

      if (error) {
        setErrors({ general: error.message });
        setLoading(false);
        return;
      }

      // Create profile row after signup
      // Profile creation will be handled by the onboarding flow
      // For now, redirect to checkout (payment before access)
      router.push("/checkout");
    } catch {
      setErrors({
        general: "Something went wrong. Please try again.",
      });
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      heading="Let's get you some clarity"
      subheading="Create your account and start understanding your numbers in minutes."
      footerText="Already have an account?"
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

        <Input
          label="Business name"
          type="text"
          placeholder="Your company name"
          value={businessName}
          onChange={(e) => {
            setBusinessName(e.target.value);
            if (errors.businessName) setErrors((prev) => ({ ...prev, businessName: undefined }));
          }}
          error={errors.businessName}
          required
        />

        {/* Custom select for industry — styled to match Input component */}
        <div className="flex flex-col gap-[6px]">
          <label
            htmlFor="industry"
            className="text-body font-body font-medium text-text-secondary"
          >
            Industry
            <span className="text-error ml-1" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="industry"
            value={industry}
            onChange={(e) => {
              setIndustry(e.target.value);
              if (errors.industry) setErrors((prev) => ({ ...prev, industry: undefined }));
            }}
            aria-invalid={errors.industry ? "true" : undefined}
            className={[
              "w-full px-4 py-3",
              "font-body text-body",
              industry ? "text-text-primary" : "text-text-muted",
              "bg-surface",
              "rounded-md",
              "border",
              "transition-all duration-200 ease-out",
              "appearance-none",
              "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239A948E%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_16px_center] bg-no-repeat",
              errors.industry
                ? "border-error focus:border-error focus:ring-2 focus:ring-error/20"
                : "border-[#D1D5DB] focus:border-orange focus:ring-2 focus:ring-orange/20",
              "focus:outline-none",
            ].join(" ")}
          >
            <option value="">Select your industry</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
          {errors.industry && (
            <p className="text-small font-body text-error" role="alert">
              {errors.industry}
            </p>
          )}
        </div>

        <Input
          label="Password"
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
          label="Confirm password"
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
            Get Started
          </Button>
        </div>

        <p className="text-small text-text-muted text-center">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </form>
    </AuthLayout>
  );
}
