"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    title: "One number. Total clarity.",
    description:
      "Your Health Score tells you exactly where your business stands\u2014on a simple 0 to 100 scale. No decoding spreadsheets at midnight.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="3" y="6" width="26" height="20" rx="3" stroke="#E65100" strokeWidth="2.5" fill="#FFF8F5" />
        <path d="M9 14h14M9 18h8" stroke="#E65100" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Your numbers, translated.",
    description:
      "AI reads your financials and tells you what they actually mean. Like having a CFO on speed dial, without the $200K salary.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M6 26V14l6-8 6 12 8-12v20" stroke="#E65100" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    title: "Test the big decisions first.",
    description:
      "\u201CCan I hire a $55K employee?\u201D \u201CWhat happens if revenue drops 20%?\u201D Run the scenario. See the math. Decide with confidence\u2014not anxiety.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 4v6M16 22v6M4 16h6M22 16h6" stroke="#E65100" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="16" cy="16" r="5" stroke="#E65100" strokeWidth="2.5" fill="#FFF8F5" />
      </svg>
    ),
    title: "Problems caught early.",
    description:
      "Cash dropping below $10K? Expenses up 30% this month? You\u2019ll know before it hurts\u2014not after.",
  },
];

const tiers = [
  {
    name: "Starter",
    price: 49,
    popular: false,
    cta: "Start with Clarity",
    features: [
      "Your financial health score",
      "Enter data manually or upload CSV",
      "Break-even calculator",
      "Weekly scorecard in your inbox",
      "Dashboard you actually understand",
    ],
  },
  {
    name: "Growth",
    price: 99,
    popular: true,
    cta: "Get the Full Picture",
    features: [
      "Everything in Starter",
      "All 4 scenario calculators",
      "AI insights in plain English",
      "Alerts before problems hit",
      "QuickBooks auto-sync",
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

/* ── Dashboard Preview (Hero Visual) ── */
function DashboardPreview() {
  return (
    <div className="relative">
      {/* Glow behind card */}
      <div
        className="absolute -inset-4 rounded-[24px] opacity-20 blur-2xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #E65100 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative bg-surface rounded-xl shadow-xl border border-[#F0EDE8] p-6 md:p-8">
        {/* Greeting */}
        <p className="font-body text-small text-text-muted mb-1">Good morning, Jessica</p>
        <p className="font-body text-small text-text-muted mb-5">Monday, February 19, 2026</p>

        {/* Health Score */}
        <div className="flex items-center gap-6 mb-6">
          <div className="relative w-[100px] h-[100px] flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="#1a1a2e" />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="#43A047"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${0.82 * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-[28px] text-white">
              82
            </span>
          </div>
          <div>
            <span className="inline-block px-3 py-1 rounded-full text-small font-semibold bg-[#43A047]/10 text-[#43A047] mb-2">
              Healthy
            </span>
            <p className="font-body text-small text-text-muted">+5 from last month</p>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-background rounded-lg p-3">
            <p className="font-body text-[11px] text-text-muted mb-1">Profit</p>
            <p className="font-display text-[18px] text-text-primary">$12,400</p>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-2 h-2 rounded-full bg-[#43A047]" />
              <span className="font-body text-[11px] text-text-muted">Strong</span>
            </div>
          </div>
          <div className="bg-background rounded-lg p-3">
            <p className="font-body text-[11px] text-text-muted mb-1">Cash Flow</p>
            <p className="font-display text-[18px] text-text-primary">$8,200</p>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-2 h-2 rounded-full bg-[#43A047]" />
              <span className="font-body text-[11px] text-text-muted">Positive</span>
            </div>
          </div>
          <div className="bg-background rounded-lg p-3">
            <p className="font-body text-[11px] text-text-muted mb-1">Runway</p>
            <p className="font-display text-[18px] text-text-primary">7.2 mo</p>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-2 h-2 rounded-full bg-[#43A047]" />
              <span className="font-body text-[11px] text-text-muted">Safe</span>
            </div>
          </div>
        </div>

        {/* AI Insight */}
        <div className="mt-4 bg-background rounded-lg p-3 border border-[#F0EDE8]">
          <div className="flex items-start gap-2">
            <span className="text-[16px] mt-[1px]" aria-hidden="true">&#128161;</span>
            <p className="font-body text-[12px] text-text-secondary leading-[1.5]">
              Your cash position is strong at $47,300. At current spending, you can operate for 7+ months without new revenue.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-[#F0EDE8]">
        <nav className="max-w-6xl mx-auto px-sm md:px-lg flex items-center justify-between h-[110px]">
          <Image
            src="/full-logo.png"
            alt="ProfitPulse"
            width={900}
            height={200}
            className="h-[150px] md:h-[190px] w-auto"
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
            <Button size="sm" onClick={() => router.push('/signup')}>Get Started</Button>
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
            <Button fullWidth size="sm" onClick={() => { setMobileMenuOpen(false); router.push('/signup'); }}>
              Get Started
            </Button>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-sm md:px-lg pt-xl pb-lg md:pt-[72px] md:pb-[72px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl lg:gap-2xl items-center">
            {/* Left: Copy */}
            <div>
              <h1 className="font-display text-[28px] md:text-[42px] leading-[1.15] text-text-primary mb-md">
                You didn&rsquo;t start a business to stare at spreadsheets.
              </h1>

              <p className="font-body text-[16px] md:text-[18px] leading-[1.7] text-text-secondary mb-sm">
                You&rsquo;re good at what you do. Engineering. Dentistry. Construction. Ministry.
              </p>
              <p className="font-body text-[16px] md:text-[18px] leading-[1.7] text-text-secondary mb-sm">
                But every month, the same knot in your stomach: <em>&ldquo;Am I actually making money? Can I afford that hire? How long until cash runs out?&rdquo;</em>
              </p>
              <p className="font-body text-[16px] md:text-[18px] leading-[1.7] text-text-primary font-medium mb-lg">
                ProfitPulse gives you a single health score and plain-English answers&mdash;so you stop guessing and start deciding.
              </p>

              <div className="flex flex-col sm:flex-row gap-sm">
                <Button size="lg" onClick={() => router.push('/signup')}>See Your Health Score</Button>
              </div>
            </div>

            {/* Right: Dashboard Preview */}
            <div className="hidden lg:block">
              <DashboardPreview />
            </div>
          </div>
        </div>
      </section>

      {/* Mobile dashboard preview — below hero on small screens */}
      <section className="lg:hidden px-sm pb-lg -mt-2">
        <DashboardPreview />
      </section>

      {/* ── Benefits ── */}
      <section id="features" className="py-xl md:py-[80px] scroll-mt-[80px]">
        <div className="max-w-6xl mx-auto px-sm md:px-lg">
          <div className="text-center mb-xl">
            <h2 className="font-display text-h2 md:text-[32px] text-text-primary mb-xs">
              Financial clarity in 5 minutes a month
            </h2>
            <p className="font-body text-body md:text-[16px] text-text-secondary max-w-lg mx-auto">
              Not another accounting tool. A dashboard built for the person who <em>runs</em> the business.
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
        className="py-xl md:py-[80px] bg-surface scroll-mt-[80px]"
      >
        <div className="max-w-6xl mx-auto px-sm md:px-lg">
          <div className="text-center mb-xl">
            <h2 className="font-display text-h2 md:text-[32px] text-text-primary mb-xs">
              Less than your last QuickBooks headache cost you
            </h2>
            <p className="font-body text-body md:text-[16px] text-text-secondary">
              No contracts. No setup fees. Cancel in two clicks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-md max-w-3xl mx-auto">
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
                  onClick={() => router.push('/signup')}
                >
                  {tier.cta}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-background border-t border-[#F0EDE8] py-md">
        <div className="max-w-6xl mx-auto px-sm md:px-lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-md">
            <div className="flex items-center gap-sm">
              <Image
                src="/symbol-logo.png"
                alt="ProfitPulse"
                width={80}
                height={80}
                className="h-[60px] md:h-[80px] w-auto"
              />
              <span className="font-body text-small text-text-muted">
                &copy; 2026 ProfitPulse
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
