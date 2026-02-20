"use client";

import { useState } from "react";
import Image from "next/image";
import { Button, Card } from "@/components/ui";

const benefits = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="14" stroke="#E65100" strokeWidth="2.5" fill="#FFF8F5" />
        <path d="M16 8v8l5.5 3" stroke="#E65100" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    title: "Health Score",
    description:
      "See your financial health at a glance with our simple 0\u2013100 score. No spreadsheets, no guesswork.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="3" y="6" width="26" height="20" rx="3" stroke="#E65100" strokeWidth="2.5" fill="#FFF8F5" />
        <path d="M9 14h14M9 18h8" stroke="#E65100" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Plain-English Insights",
    description:
      "No jargon. Just clear explanations of what your numbers mean and what to do about them.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M6 26V14l6-8 6 12 8-12v20" stroke="#E65100" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    title: "What-If Calculator",
    description:
      "Test scenarios before making big decisions\u2014like hiring or expanding\u2014without the risk.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 4v6M16 22v6M4 16h6M22 16h6" stroke="#E65100" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="16" cy="16" r="5" stroke="#E65100" strokeWidth="2.5" fill="#FFF8F5" />
      </svg>
    ),
    title: "Smart Alerts",
    description:
      "Get notified when something needs your attention\u2014before it becomes a problem.",
  },
];

const tiers = [
  {
    name: "Starter",
    price: 49,
    popular: false,
    features: [
      "Dashboard & health score",
      "Manual data entry",
      "CSV spreadsheet upload",
      "Break-even calculator",
      "Weekly email summary",
    ],
  },
  {
    name: "Growth",
    price: 99,
    popular: true,
    features: [
      "Everything in Starter",
      "All scenario calculators",
      "AI-powered insights",
      "Email alerts",
      "QuickBooks sync",
    ],
  },
  {
    name: "Scale",
    price: 199,
    popular: false,
    features: [
      "Everything in Growth",
      "Priority support",
      "Custom reports (coming soon)",
      "Dedicated account setup",
      "Early access to new features",
    ],
  },
];

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      className="flex-shrink-0 mt-[2px]"
      aria-hidden="true"
    >
      <path
        d="M4 9.5l3.5 3.5L14 5"
        stroke="#E65100"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="#2D2A26" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="#2D2A26" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-[#F0EDE8]">
        <nav className="max-w-6xl mx-auto px-sm md:px-lg flex items-center justify-between h-[64px]">
          <Image
            src="/full-logo.png"
            alt="ProfitPulse"
            width={160}
            height={36}
            className="h-[36px] w-auto"
            priority
          />

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-lg">
            <a
              href="#features"
              className="font-body text-body text-text-secondary hover:text-text-primary transition-colors"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="font-body text-body text-text-secondary hover:text-text-primary transition-colors"
            >
              Pricing
            </a>
            <Button size="sm">Get Started</Button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-xs"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </nav>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-surface border-t border-[#F0EDE8] px-sm py-md space-y-sm">
            <a
              href="#features"
              className="block font-body text-body text-text-secondary py-xs"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </a>
            <a
              href="#pricing"
              className="block font-body text-body text-text-secondary py-xs"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </a>
            <Button fullWidth size="sm">
              Get Started
            </Button>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Subtle warm gradient orb */}
        <div
          className="absolute top-[-120px] right-[-80px] w-[500px] h-[500px] rounded-full opacity-[0.08] pointer-events-none"
          style={{
            background: "radial-gradient(circle, #E65100 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />

        <div className="max-w-6xl mx-auto px-sm md:px-lg pt-2xl pb-xl md:pt-[96px] md:pb-2xl">
          <div className="max-w-2xl">
            <h1 className="font-display text-[28px] md:text-[42px] leading-[1.15] text-text-primary mb-md">
              Finally understand your numbers&mdash;without the accounting
              degree
            </h1>
            <p className="font-body text-[16px] md:text-[18px] leading-[1.6] text-text-secondary mb-lg max-w-xl">
              ProfitPulse gives service-based business owners a clear,
              plain-English picture of their financial health&mdash;so you can
              make confident decisions and grow with peace of mind.
            </p>
            <div className="flex flex-col sm:flex-row gap-sm">
              <Button size="lg">Get Started</Button>
              <Button variant="secondary" size="lg">
                See How It Works
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section id="features" className="py-xl md:py-[96px] scroll-mt-[80px]">
        <div className="max-w-6xl mx-auto px-sm md:px-lg">
          <div className="text-center mb-xl">
            <h2 className="font-display text-h2 md:text-[32px] text-text-primary mb-xs">
              Everything you need to understand your business
            </h2>
            <p className="font-body text-body md:text-[16px] text-text-secondary max-w-lg mx-auto">
              Built for people who run businesses, not accounting firms.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="flex gap-md items-start">
                <div className="flex-shrink-0 w-[48px] h-[48px] bg-background rounded-md flex items-center justify-center">
                  {benefit.icon}
                </div>
                <div>
                  <h3 className="font-display text-h3 text-text-primary mb-xs">
                    {benefit.title}
                  </h3>
                  <p className="font-body text-body text-text-secondary leading-[1.6]">
                    {benefit.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section
        id="pricing"
        className="py-xl md:py-[96px] bg-surface scroll-mt-[80px]"
      >
        <div className="max-w-6xl mx-auto px-sm md:px-lg">
          <div className="text-center mb-xl">
            <h2 className="font-display text-h2 md:text-[32px] text-text-primary mb-xs">
              Simple, transparent pricing
            </h2>
            <p className="font-body text-body md:text-[16px] text-text-secondary">
              No hidden fees. No surprises. Cancel anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-md max-w-4xl mx-auto">
            {tiers.map((tier) => (
              <Card
                key={tier.name}
                variant={tier.popular ? "featured" : "standard"}
                className={`flex flex-col ${tier.popular ? "md:-mt-2 md:mb-[-8px] relative" : ""}`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange text-white font-body text-small font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}

                <div className="mb-md">
                  <h3 className="font-display text-h3 text-text-primary">
                    {tier.name}
                  </h3>
                  <div className="mt-xs flex items-baseline gap-1">
                    <span className="font-display text-[36px] text-text-primary">
                      ${tier.price}
                    </span>
                    <span className="font-body text-body text-text-muted">
                      /mo
                    </span>
                  </div>
                </div>

                <ul className="space-y-[10px] mb-lg flex-1">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-[8px] font-body text-body text-text-secondary"
                    >
                      <CheckIcon />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  variant={tier.popular ? "primary" : "secondary"}
                  fullWidth
                >
                  Get Started
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-background border-t border-[#F0EDE8] py-xl">
        <div className="max-w-6xl mx-auto px-sm md:px-lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-md">
            <div className="flex items-center gap-sm">
              <Image
                src="/symbol-logo.png"
                alt="ProfitPulse"
                width={32}
                height={32}
                className="h-[32px] w-auto"
              />
              <span className="font-body text-small text-text-muted">
                &copy; 2026 ProfitPulse by Fusion 4 Business
              </span>
            </div>

            <div className="flex items-center gap-md">
              <a
                href="#features"
                className="font-body text-small text-text-muted hover:text-text-secondary transition-colors"
              >
                Features
              </a>
              <a
                href="#pricing"
                className="font-body text-small text-text-muted hover:text-text-secondary transition-colors"
              >
                Pricing
              </a>
              <a
                href="#"
                className="font-body text-small text-text-muted hover:text-text-secondary transition-colors"
              >
                Privacy
              </a>
              <a
                href="#"
                className="font-body text-small text-text-muted hover:text-text-secondary transition-colors"
              >
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
