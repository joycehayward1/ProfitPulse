"use client";

import Image from "next/image";
import Link from "next/link";

interface AuthLayoutProps {
  children: React.ReactNode;
  heading: string;
  subheading: string;
  footerText: string;
  footerLinkText: string;
  footerLinkHref: string;
}

export function AuthLayout({
  children,
  heading,
  subheading,
  footerText,
  footerLinkText,
  footerLinkHref,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel — desktop only */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] relative overflow-hidden bg-[#F5F0EB] flex-col justify-between p-xl">
        {/* Warm abstract background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-orange/10 blur-[100px] -translate-y-1/4 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-orange/8 blur-[80px] translate-y-1/4 -translate-x-1/4" />
          <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full bg-[#7B1FA2]/5 blur-[60px] -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <Image
            src="/full-logo.png"
            alt="ProfitPulse"
            width={900}
            height={200}
            className="h-[150px] md:h-[190px] w-auto drop-shadow-lg"
          />
        </div>

        <div className="relative z-10 space-y-6">
          <blockquote className="font-display text-h2 leading-snug text-text-primary">
            &ldquo;I finally understand where my money goes — and I didn&apos;t need an
            accounting degree to figure it out.&rdquo;
          </blockquote>
          <div className="flex items-center gap-4">
            <Image
              src="/avatar-jessica.jpg"
              alt="Jessica M."
              width={200}
              height={200}
              className="w-16 h-16 rounded-full object-cover shadow-md"
            />
            <div>
              <p className="text-body font-medium text-text-primary">Jessica M.</p>
              <p className="text-small text-text-muted">Dental Practice Owner</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-small text-text-muted">
            &copy; {new Date().getFullYear()} ProfitPulse
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col min-h-screen bg-background">
        {/* Mobile header */}
        <div className="lg:hidden px-md py-sm border-b border-[#F0EDE8]">
          <Link href="/">
            <Image
              src="/full-logo.png"
              alt="ProfitPulse"
              width={900}
              height={200}
              className="h-[150px] md:h-[190px] w-auto"
            />
          </Link>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-md py-xl">
          <div className="w-full max-w-[420px]">
            {/* Heading */}
            <div className="mb-lg">
              <h1 className="font-display text-h1 text-text-primary leading-tight">
                {heading}
              </h1>
              <p className="mt-xs text-body text-text-secondary">
                {subheading}
              </p>
            </div>

            {/* Form content */}
            {children}

            {/* Footer link */}
            <p className="mt-lg text-center text-body text-text-muted">
              {footerText}{" "}
              <Link
                href={footerLinkHref}
                className="text-orange font-medium hover:underline"
              >
                {footerLinkText}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
