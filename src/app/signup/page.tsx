"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input } from "@/components/ui";
import { INDUSTRIES } from "@/lib/industries";

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  businessName?: string;
  industry?: string;
  general?: string;
}

function validateForm(fields: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  industry: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!fields.fullName.trim()) {
    errors.fullName = "Your name is required";
  }

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
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, _setVerificationEmail] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const validationErrors = validateForm({
      fullName,
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
      const { data, error } = await client.auth.signUp({
        email,
        password,
        name: fullName, // Use full name instead of business name
      });

      if (error) {
        setErrors({ general: error.message });
        setLoading(false);
        return;
      }

      // After signup, persist business info on the profile row.
      // profiles has UNIQUE(user_id) and the row may not exist yet, so upsert.
      if (data?.user) {
        await client.database.from("profiles").upsert(
          {
            user_id: data.user.id,
            business_name: businessName,
            industry: industry,
          },
          { onConflict: "user_id" },
        );

        // Start the user's 7-day trial (creates subscriptions row)
        try {
          await fetch("/api/auth/start-trial", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: data.user.id }),
          });
        } catch (trialError) {
          console.error("Failed to start trial:", trialError);
          // Non-blocking — user can still proceed to dashboard
        }
      }

      // Check if email verification is required
      if (data?.requireEmailVerification) {
        // Redirect to verification page
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        // User is signed in, go to dashboard
        router.push("/dashboard");
      }
    } catch {
      setErrors({
        general: "Something went wrong. Please try again.",
      });
      setLoading(false);
    }
  }

  // Email verification state
  if (showVerification) {
    return (
      <AuthLayout
        heading="Check your email"
        subheading={`We sent a verification link to ${verificationEmail}. Please verify your email to continue.`}
        footerText="Already verified?"
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
            Didn&apos;t get the email? Check your spam folder or click below to continue.
          </p>
          <div className="space-y-2">
            <Button
              onClick={() => router.push("/checkout")}
              fullWidth
              size="lg"
            >
              Continue to Checkout
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowVerification(false);
                setLoading(false);
              }}
              fullWidth
            >
              Go back
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading="Let's get you some clarity"
      subheading="Create your account and start understanding your numbers in minutes."
      footerText="Already have an account?"
      footerLinkText="Log in"
      footerLinkHref="/login"
      backHref="/"
      backLabel="Back to home"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-sm">
        {errors.general && (
          <div className="p-sm rounded-md bg-error/5 border border-error/20">
            <p className="text-body text-error">{errors.general}</p>
          </div>
        )}

        <Input
          label="Full name"
          type="text"
          placeholder="Jane Smith"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
          }}
          error={errors.fullName}
          required
          autoComplete="name"
        />

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
          By signing up, you agree to our <a href="/terms" className="text-orange hover:underline">Terms of Service</a> and <a href="/privacy" className="text-orange hover:underline">Privacy Policy</a>.
        </p>
      </form>
    </AuthLayout>
  );
}
