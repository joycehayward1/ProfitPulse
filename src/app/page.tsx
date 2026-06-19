"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button, Card } from "@/components/ui";
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_TERMS,
  type GlossaryCategory,
} from "@/lib/glossary";

/* ══════════════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════════════ */

const benefits = [
  {
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <circle cx="18" cy="18" r="15" stroke="#E65100" strokeWidth="2.5" fill="#FFF8F5" />
        <path d="M18 9v9l6 3.5" stroke="#E65100" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    title: "One number. Total clarity.",
    description:
      "Your Health Score tells you exactly where your business stands\u2014on a simple 0 to 100 scale. Green means thriving. Amber means caution. Red means act now.",
  },
  {
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <rect x="4" y="7" width="28" height="22" rx="3" stroke="#E65100" strokeWidth="2.5" fill="#FFF8F5" />
        <path d="M10 16h16M10 21h10" stroke="#E65100" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Your numbers, translated.",
    description:
      "AI reads your financials and tells you what they actually mean\u2014in plain English. No jargon. No charts you don\u2019t understand. Just answers.",
  },
  {
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path d="M7 29V16l7-9 7 13 8-13v22" stroke="#E65100" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    title: "Test the big decisions first.",
    description:
      "\u201CCan I hire a $55K employee?\u201D \u201CWhat happens if revenue drops 20%?\u201D Run the scenario. See the math. Decide with confidence\u2014not anxiety.",
  },
  {
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path d="M18 5v7M18 24v7M5 18h7M24 18h7" stroke="#E65100" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="18" cy="18" r="5.5" stroke="#E65100" strokeWidth="2.5" fill="#FFF8F5" />
      </svg>
    ),
    title: "Problems caught early.",
    description:
      "Cash dropping below $10K? Expenses up 30% this month? You\u2019ll know before it hurts\u2014not after the damage is done.",
  },
];

const steps = [
  {
    num: "01",
    title: "Upload Your Data",
    description:
      "Upload a spreadsheet in one click. It takes 5 minutes.",
  },
  {
    num: "02",
    title: "Get Your Health Score",
    description:
      "AI analyzes your revenue, expenses, and cash flow\u2014then scores your financial health from 0 to 100.",
  },
  {
    num: "03",
    title: "Make Better Decisions",
    description:
      "Run scenarios, see recommendations, and act with confidence. No more guessing. No more sleepless nights.",
  },
];

const scenarios = [
  {
    title: "Can I Afford This Hire?",
    description: "Enter a salary and see if your numbers support it\u2014before you sign the offer letter.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="10" r="5" stroke="#E65100" strokeWidth="2" />
        <path d="M8 26c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#E65100" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    mini: (
      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-white/40">Salary</span>
          <span className="text-white/70">$65,000</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-[72%] bg-gradient-to-r from-[#43A047] to-[#FB8C00] rounded-full" />
        </div>
        <div className="text-[10px] text-white/30">Runway impact: -2.1 months</div>
      </div>
    ),
  },
  {
    title: "What\u2019s My Break-Even?",
    description: "Find the exact number where you stop losing money and start keeping it.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M6 24L14 14L20 18L26 8" stroke="#E65100" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 28h20" stroke="#E65100" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    mini: (
      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-white/40">Break-even</span>
          <span className="text-[#43A047]">$38,200/mo</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-[85%] bg-[#43A047] rounded-full" />
        </div>
        <div className="text-[10px] text-white/30">Current: $41,500/mo (above target)</div>
      </div>
    ),
  },
  {
    title: "How Long Will My Cash Last?",
    description: "See how many months of cash you have left at your current burn rate.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="6" y="6" width="20" height="20" rx="3" stroke="#E65100" strokeWidth="2" />
        <path d="M12 16h8M16 12v8" stroke="#E65100" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    mini: (
      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-white/40">Months left</span>
          <span className="text-[#FB8C00]">5.4 months</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-[45%] bg-[#FB8C00] rounded-full" />
        </div>
        <div className="text-[10px] text-white/30">Burn rate: $8,700/mo</div>
      </div>
    ),
  },
  {
    title: "Will I Hit My Revenue Goal?",
    description: "Track progress toward your target and see exactly what\u2019s needed to close the gap.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="10" stroke="#E65100" strokeWidth="2" />
        <circle cx="16" cy="16" r="5" stroke="#E65100" strokeWidth="2" />
        <circle cx="16" cy="16" r="1.5" fill="#E65100" />
      </svg>
    ),
    mini: (
      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-white/40">Goal</span>
          <span className="text-white/70">$500K annual</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-[63%] bg-gradient-to-r from-[#E65100] to-[#FF7A00] rounded-full" />
        </div>
        <div className="text-[10px] text-white/30">63% on track ($315K YTD)</div>
      </div>
    ),
  },
];

const planFeatures = [
  "Your financial health score",
  "Dashboard you actually understand",
  "All 4 scenario calculators",
  "Enter data manually or upload CSV",
  "Weekly scorecard in your inbox",
  "Email support",
];

const faqs = [
  {
    q: "Do I need accounting experience?",
    a: "Not at all. MyProfitPulse translates everything into plain English. If you can read a text message, you can understand your financial health.",
  },
  {
    q: "How does the Health Score work?",
    a: "It\u2019s a 0\u2013100 composite score based on three things: cash runway (35% weight), profit margin (30% weight), and receivables health (35% weight). Green means thriving. Amber means caution. Red means act now.",
  },
  {
    q: "What\u2019s a scenario calculator?",
    a: "It\u2019s a what-if tool. Ask \u201CCan I afford this hire?\u201D or \u201CWhat if revenue drops 20%?\u201D and see the financial math instantly\u2014before you commit real money.",
  },
  {
    q: "Is my data secure?",
    a: "Absolutely. Bank-grade encryption in transit and at rest. We never store your login credentials. Read-only access to your books\u2014we can\u2019t change a thing.",
  },
  {
    q: "Can I upload a spreadsheet instead?",
    a: "Yes. CSV and Excel files are fully supported. Smart column detection maps your data automatically\u2014no reformatting needed.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no setup fees, no cancellation fees. Cancel in two clicks from your settings page. Your data stays yours.",
  },
];

/* ══════════════════════════════════════════════════════════════════
   UTILITY ICONS
   ══════════════════════════════════════════════════════════════════ */

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
      <path d="M4 7h16M4 12h16M4 17h16" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={`flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M5 8l5 5 5-5" stroke="#6B6560" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BOUNCING MASCOT (DVD-style)
   ══════════════════════════════════════════════════════════════════ */

function BouncingMascot({ onOpenGlossary, paused }: { onOpenGlossary: () => void; paused: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(false);
  const pausedRef = useRef(paused);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const size = 160;
    let x = Math.random() * (window.innerWidth - size);
    let y = Math.max(140, Math.random() * (window.innerHeight - size));
    let vx = 1.6 * (Math.random() > 0.5 ? 1 : -1);
    let vy = 1.3 * (Math.random() > 0.5 ? 1 : -1);
    let raf = 0;

    const tick = () => {
      if (!hoverRef.current && !pausedRef.current) {
        const w = window.innerWidth - size;
        const h = window.innerHeight - size;
        x += vx;
        y += vy;
        if (x <= 0) { x = 0; vx = -vx; }
        if (x >= w) { x = w; vx = -vx; }
        if (y <= 0) { y = 0; vy = -vy; }
        if (y >= h) { y = h; vy = -vy; }
      }
      const scale = hoverRef.current ? 1.08 : 1;
      el.style.transform = `translate(${x}px, ${y}px) scale(${scale}) scaleX(${vx < 0 ? -1 : 1})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 z-40 cursor-pointer group"
      style={{ willChange: "transform", transition: "filter 0.2s" }}
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
      onClick={() => { setShowHint(false); onOpenGlossary(); }}
      role="button"
      aria-label="Open glossary"
    >
      <Image
        src="/profit-pulse-mascot2 copy.png"
        alt=""
        width={160}
        height={160}
        className="drop-shadow-2xl select-none group-hover:drop-shadow-[0_0_28px_rgba(230,81,0,0.55)] transition-all"
        priority
      />
      {showHint && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-9 bg-[#2D2A26] text-white text-[12px] font-body px-3 py-1.5 rounded-full whitespace-nowrap shadow-lg pointer-events-none"
          style={{ animation: "mascotHintBob 1.4s ease-in-out infinite" }}
        >
          Click me!
          <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-[#2D2A26] rotate-45" />
        </div>
      )}
      <style jsx>{`
        @keyframes mascotHintBob {
          0%, 100% { transform: translate(-50%, 0); }
          50% { transform: translate(-50%, -4px); }
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   GLOSSARY MODAL
   ══════════════════════════════════════════════════════════════════ */

type FilterCategory = GlossaryCategory | "All";

function GlossaryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("All");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return GLOSSARY_TERMS.filter((t) => {
      const matchesCategory = activeCategory === "All" || t.category === activeCategory;
      const matchesSearch =
        !q ||
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        t.example.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [search, activeCategory]);

  const grouped = useMemo(() => {
    const groups: { category: (typeof GLOSSARY_CATEGORIES)[number]; terms: typeof GLOSSARY_TERMS }[] = [];
    for (const cat of GLOSSARY_CATEGORIES) {
      const terms = filtered.filter((t) => t.category === cat.id);
      if (terms.length > 0) groups.push({ category: cat, terms });
    }
    return groups;
  }, [filtered]);

  const pills: { id: FilterCategory; label: string }[] = [
    { id: "All", label: "All" },
    ...GLOSSARY_CATEGORIES.map((c) => ({ id: c.id as FilterCategory, label: c.label })),
  ];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Glossary"
    >
      <div
        className="absolute inset-0 bg-[#2D2A26]/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-3xl max-h-[88vh] bg-surface rounded-2xl shadow-elevated border border-[#F0EDE8] overflow-hidden flex flex-col"
        style={{ animation: "glossaryPop 0.25s ease-out" }}
      >
        {/* Header */}
        <div className="relative px-md md:px-lg pt-md pb-sm border-b border-[#F0EDE8] bg-gradient-to-br from-[#FFF8F5] to-surface">
          <div className="flex items-start gap-md">
            <div className="hidden sm:block flex-shrink-0 -mt-1">
              <Image
                src="/profit-pulse-mascot2 copy.png"
                alt=""
                width={64}
                height={64}
                className="drop-shadow"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-small uppercase tracking-[0.2em] text-[#E65100] mb-1">
                Plain-English Glossary
              </p>
              <h2 className="font-display text-[24px] md:text-[28px] text-text-primary leading-tight">
                Every number, explained.
              </h2>
              <p className="font-body text-small text-text-secondary mt-1">
                Definitions for every metric you&rsquo;ll see in MyProfitPulse.
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-9 h-9 rounded-full hover:bg-[#F0EDE8] flex items-center justify-center transition-colors"
              aria-label="Close glossary"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="#2D2A26" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="mt-md relative">
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a term, definition, or example..."
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-[#E8E4DF] bg-white text-body text-text-primary placeholder:text-text-muted focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 focus:outline-none transition-colors"
            />
          </div>

          {/* Pills */}
          <div className="mt-sm flex flex-wrap gap-2">
            {pills.map((p) => {
              const active = activeCategory === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveCategory(p.id)}
                  className={`px-3 py-1 rounded-full text-small font-body font-medium transition-colors ${
                    active
                      ? "bg-[#E65100] text-white"
                      : "bg-white text-text-secondary border border-[#E8E4DF] hover:border-[#E65100]/40"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-md md:px-lg py-md space-y-md flex-1">
          {grouped.length === 0 && (
            <p className="text-center font-body text-body text-text-muted py-lg">
              No terms match that search.
            </p>
          )}
          {grouped.map(({ category, terms }) => (
            <div key={category.id}>
              <div className="mb-sm">
                <h3 className="font-display text-h3 text-text-primary">{category.label}</h3>
                <p className="font-body text-small text-text-muted">{category.description}</p>
              </div>
              <div className="space-y-2">
                {terms.map((t) => (
                  <details
                    key={t.slug}
                    className="group rounded-lg border border-[#F0EDE8] bg-white open:border-[#E65100]/30 open:shadow-soft transition-colors"
                  >
                    <summary className="flex items-center justify-between gap-3 px-md py-3 cursor-pointer list-none">
                      <span className="font-body font-semibold text-text-primary">{t.term}</span>
                      <svg
                        width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"
                        className="flex-shrink-0 text-text-muted transition-transform group-open:rotate-180"
                      >
                        <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </summary>
                    <div className="px-md pb-md pt-1 space-y-2 font-body text-body text-text-secondary leading-relaxed">
                      <p>{t.definition}</p>
                      <p className="text-small text-text-muted">
                        <span className="font-semibold text-text-primary">Example:</span> {t.example}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <style jsx>{`
          @keyframes glossaryPop {
            from { opacity: 0; transform: translateY(8px) scale(0.98); }
            to   { opacity: 1; transform: translateY(0)    scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DASHBOARD PREVIEW (Hero Visual)
   ══════════════════════════════════════════════════════════════════ */

function DashboardPreview() {
  return (
    <div className="relative">
      {/* Radial orange glow behind card */}
      <div
        className="absolute -inset-6 rounded-[28px] opacity-25 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #E65100 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative bg-surface rounded-xl shadow-elevated border border-[#F0EDE8] p-6 md:p-8">
        {/* Greeting */}
        <p className="font-body text-small text-text-muted mb-1">Good morning, Jessica</p>
        <p className="font-body text-small text-text-muted mb-5">Monday, February 19, 2026</p>

        {/* Health Score */}
        <div className="flex items-center gap-6 mb-6">
          <div className="relative w-[100px] h-[100px] flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="#1a1a2e" />
              <circle
                cx="50"
                cy="50"
                r="42"
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

/* ══════════════════════════════════════════════════════════════════
   SCROLL-REVEAL HOOK & WRAPPER
   ══════════════════════════════════════════════════════════════════ */

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function RevealSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const router = useRouter();

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Scenarios", href: "#scenarios" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <BouncingMascot onOpenGlossary={() => setGlossaryOpen(true)} paused={glossaryOpen} />
      <GlossaryModal open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
      {/* ================================================================
          1. HEADER (sticky)
          ================================================================ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-[#2D2A26]/80 via-[#2D2A26]/40 to-transparent backdrop-blur-[2px]">
        <nav className="max-w-6xl mx-auto px-sm md:px-lg flex items-center justify-between h-[110px]">
          <Image
            src="/logoupdated-transparent61926.png"
            alt="MyProfitPulse"
            width={900}
            height={200}
            className="h-[150px] md:h-[190px] w-auto"
            priority
          />

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-lg">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-body text-body text-white/80 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
            <Button size="sm" onClick={() => router.push("/signup")}>
              Get Started
            </Button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-xs"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </nav>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#2D2A26]/95 backdrop-blur-sm border-t border-white/10 px-sm py-md space-y-sm">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block font-body text-body text-white/70 hover:text-white py-xs"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Button
              fullWidth
              size="sm"
              onClick={() => {
                setMobileMenuOpen(false);
                router.push("/signup");
              }}
            >
              Get Started
            </Button>
          </div>
        )}
      </header>

      {/* ================================================================
          2. HERO -- Video Background
          ================================================================ */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#2D2A26]/90 via-[#2D2A26]/70 to-[#2D2A26]/40"
          aria-hidden="true"
        />

        {/* Subtle bottom gradient for blending */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-6xl mx-auto px-sm md:px-lg pt-[130px] pb-xl md:pt-[140px] md:pb-2xl w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl lg:gap-2xl items-center">
            {/* Left: Copy */}
            <div>
              <p className="font-body text-[14px] md:text-[16px] uppercase tracking-[0.2em] text-[#E65100] mb-md font-bold">
                CEO Dashboard for Service Businesses
              </p>

              <h1 className="font-display text-[32px] md:text-[48px] leading-[1.1] text-white mb-md">
                You didn&rsquo;t start a business to stare at spreadsheets.
              </h1>

              <p className="font-body text-[16px] md:text-[18px] leading-[1.7] text-white/80 mb-sm">
                You&rsquo;re good at what you do. Engineering. Dentistry. Construction. Consulting.
              </p>
              <p className="font-body text-[16px] md:text-[18px] leading-[1.7] text-white/80 mb-sm">
                But every month, the same knot in your stomach:{" "}
                <em className="text-white/90">
                  &ldquo;Am I actually making money? Can I afford that hire? How long until cash runs out?&rdquo;
                </em>
              </p>
              <p className="font-body text-[16px] md:text-[18px] leading-[1.7] text-white font-medium mb-lg">
                MyProfitPulse gives you a single health score and plain-English answers&mdash;so you stop guessing and start deciding.
              </p>

              <div className="flex flex-col sm:flex-row gap-sm">
                <Button size="lg" onClick={() => router.push("/signup")}>
                  See Your Health Score
                </Button>
                <Button size="lg" variant="secondary" onClick={() => {
                  document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                }}>
                  <span className="text-white border-white">See How It Works</span>
                </Button>
              </div>

              <p className="font-body text-small text-white/40 mt-md">
                No credit card required to start.
              </p>
            </div>

            {/* Right: Dashboard Preview */}
            <div className="hidden lg:block lg:scale-[1.15] lg:origin-center lg:translate-x-6">
              <DashboardPreview />
            </div>
          </div>
        </div>
      </section>

      {/* Mobile dashboard preview -- below hero on small screens */}
      <section className="lg:hidden px-sm py-lg bg-background">
        <DashboardPreview />
      </section>

      {/* ================================================================
          4. FEATURES / BENEFITS
          ================================================================ */}
      <section id="features" className="py-xl md:py-[112px] scroll-mt-[120px]">
        <div className="max-w-6xl mx-auto px-sm md:px-lg">
          <RevealSection>
            <div className="text-center mb-xl md:mb-[72px]">
              <p className="font-body text-small uppercase tracking-[0.2em] text-[#E65100] mb-sm">
                Built for Business Owners
              </p>
              <h2 className="font-display text-h2 md:text-[36px] text-text-primary mb-sm">
                What MyProfitPulse Does For You
              </h2>
              <p className="font-body text-body md:text-[16px] text-text-secondary max-w-lg mx-auto">
                Not another accounting tool. A dashboard built for the person who <em>runs</em> the business.
              </p>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            {benefits.map((benefit, i) => (
              <RevealSection key={benefit.title} delay={i * 100}>
                <Card className="flex gap-md items-start h-full hover:shadow-medium hover:-translate-y-1 transition-all duration-300">
                  <div className="flex-shrink-0 w-[56px] h-[56px] bg-[#FFF8F5] rounded-lg flex items-center justify-center border border-[#E65100]/10">
                    {benefit.icon}
                  </div>
                  <div>
                    <h3 className="font-display text-h3 text-text-primary mb-xs">
                      {benefit.title}
                    </h3>
                    <p className="font-body text-body text-text-secondary leading-[1.7]">
                      {benefit.description}
                    </p>
                  </div>
                </Card>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          5. HOW IT WORKS
          ================================================================ */}
      <section id="how-it-works" className="py-xl md:py-[112px] bg-surface scroll-mt-[120px]">
        <div className="max-w-6xl mx-auto px-sm md:px-lg">
          <RevealSection>
            <div className="text-center mb-xl md:mb-[72px]">
              <p className="font-body text-small uppercase tracking-[0.2em] text-[#E65100] mb-sm">
                Simple Setup
              </p>
              <h2 className="font-display text-h2 md:text-[36px] text-text-primary mb-sm">
                Three Steps to Clarity
              </h2>
              <p className="font-body text-body md:text-[16px] text-text-secondary max-w-lg mx-auto">
                From confusion to confidence in under 5 minutes.
              </p>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg md:gap-md relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-[40px] left-[16.67%] right-[16.67%] h-[2px] bg-[#F0EDE8]" aria-hidden="true">
              <div className="absolute inset-0 bg-gradient-to-r from-[#E65100]/30 via-[#E65100]/50 to-[#E65100]/30" />
            </div>

            {steps.map((step, i) => (
              <RevealSection key={step.num} delay={i * 150}>
                <div className="text-center relative">
                  <div className="inline-flex items-center justify-center w-[80px] h-[80px] rounded-full bg-[#FFF8F5] border-2 border-[#E65100]/20 mb-md relative z-10">
                    <span className="font-display text-[28px] text-[#E65100]">{step.num}</span>
                  </div>
                  <h3 className="font-display text-h3 text-text-primary mb-xs">
                    {step.title}
                  </h3>
                  <p className="font-body text-body text-text-secondary leading-[1.7] max-w-[300px] mx-auto">
                    {step.description}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          6. SCENARIO CALCULATORS (dark section)
          ================================================================ */}
      <section id="scenarios" className="py-xl md:py-[112px] bg-[#2D2A26] scroll-mt-[120px]">
        <div className="max-w-6xl mx-auto px-sm md:px-lg">
          <RevealSection>
            <div className="text-center mb-xl md:mb-[72px]">
              <p className="font-body text-small uppercase tracking-[0.2em] text-[#E65100] mb-sm">
                What-If Calculators
              </p>
              <h2 className="font-display text-h2 md:text-[36px] text-white mb-sm">
                Test Every Decision Before You Make It
              </h2>
              <p className="font-body text-body md:text-[16px] text-white/60 max-w-lg mx-auto">
                Stop losing sleep over &ldquo;what ifs.&rdquo; Run the numbers in seconds.
              </p>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            {scenarios.map((s, i) => (
              <RevealSection key={s.title} delay={i * 100}>
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-md border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300 h-full group">
                  <div className="w-[48px] h-[48px] bg-[#E65100]/10 rounded-lg flex items-center justify-center mb-md group-hover:bg-[#E65100]/15 transition-colors duration-300">
                    {s.icon}
                  </div>
                  <h3 className="font-display text-h3 text-white mb-xs">
                    {s.title}
                  </h3>
                  <p className="font-body text-body text-white/60 leading-[1.7]">
                    {s.description}
                  </p>
                  {/* Mini chart / visualization */}
                  {s.mini}
                </div>
              </RevealSection>
            ))}
          </div>

          <RevealSection delay={400}>
            <div className="text-center mt-xl">
              <Button size="lg" onClick={() => router.push("/signup")}>
                Try a Scenario Free
              </Button>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ================================================================
          7. AI INSIGHTS -- "Like Having a CFO On Speed Dial"
          ================================================================ */}
      <section className="py-xl md:py-[112px]">
        <div className="max-w-6xl mx-auto px-sm md:px-lg">
          <RevealSection>
            <div className="text-center mb-xl md:mb-[72px]">
              <p className="font-body text-small uppercase tracking-[0.2em] text-[#E65100] mb-sm">
                AI-Powered Insights
              </p>
              <h2 className="font-display text-h2 md:text-[36px] text-text-primary mb-sm">
                Like Having a CFO On Speed Dial
              </h2>
              <p className="font-body text-body md:text-[16px] text-text-secondary max-w-lg mx-auto">
                No jargon. No charts you don&rsquo;t understand. Just answers.
              </p>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg max-w-4xl mx-auto items-stretch">
            {/* Before card */}
            <RevealSection delay={0}>
              <div className="h-full">
                <p className="font-body text-small font-semibold text-text-muted uppercase tracking-wider mb-sm">
                  Before MyProfitPulse
                </p>
                <div className="bg-[#F5F3F0] rounded-lg p-md border border-[#E8E4DF] h-[calc(100%-28px)]">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-error/20" />
                      <p className="font-body text-body text-text-secondary">
                        2,847 transactions across 14 categories...
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-error/20" />
                      <p className="font-body text-body text-text-secondary">
                        Revenue: $184,293.47 (QoQ delta -3.2%)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-error/20" />
                      <p className="font-body text-body text-text-secondary">
                        OPEX ratio 0.73, AR aging 45+ days...
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-error/20" />
                      <p className="font-body text-body text-text-secondary">
                        Accrual-basis adj. EBITDA margin...
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-error/20" />
                      <p className="font-body text-body text-text-secondary">
                        Depreciation schedule vs. capex forecast...
                      </p>
                    </div>
                    <div className="mt-md pt-md border-t border-[#E0DCD7]">
                      <p className="font-body text-small text-text-muted italic">
                        &ldquo;What does any of this mean? Am I okay or not?&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </RevealSection>

            {/* After card */}
            <RevealSection delay={200}>
              <div className="h-full">
                <p className="font-body text-small font-semibold text-[#E65100] uppercase tracking-wider mb-sm">
                  With MyProfitPulse
                </p>
                <div className="bg-surface rounded-lg p-md border-2 border-[#E65100]/20 shadow-soft h-[calc(100%-28px)]">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#43A047]" />
                      <p className="font-body text-body text-text-primary font-medium">
                        You can hire. Your numbers support it.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#43A047]" />
                      <p className="font-body text-body text-text-primary font-medium">
                        Positive Cash Availability stays above 6 months after the hire.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#43A047]" />
                      <p className="font-body text-body text-text-primary font-medium">
                        Risk level: Low.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#FB8C00]" />
                      <p className="font-body text-body text-text-primary font-medium">
                        Watch: Receivables are aging. Follow up on 3 invoices.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#43A047]" />
                      <p className="font-body text-body text-text-primary font-medium">
                        Profit margin is healthy at 18.4%.
                      </p>
                    </div>
                    <div className="mt-md pt-md border-t border-[#F0EDE8]">
                      <p className="font-body text-small text-[#E65100] font-medium">
                        Clear answers. Confident decisions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ================================================================
          9. INTERACTIVE DEMO -- "What If You Hired a Senior Developer?"
          ================================================================ */}
      <section className="py-xl md:py-[112px] bg-[#2D2A26]">
        <div className="max-w-6xl mx-auto px-sm md:px-lg">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl items-center">
            <RevealSection>
              <div>
                <p className="font-body text-small uppercase tracking-[0.2em] text-[#E65100] mb-sm">
                  Live Preview
                </p>
                <h2 className="font-display text-h2 md:text-[36px] text-white mb-md leading-[1.15]">
                  What If You Hired a Senior Developer?
                </h2>
                <p className="font-body text-[16px] md:text-[18px] leading-[1.7] text-white/70 mb-sm">
                  Before you commit to a $95K salary, see exactly how it impacts your cash flow, runway, and risk level.
                </p>
                <p className="font-body text-[16px] md:text-[18px] leading-[1.7] text-white/70 mb-lg">
                  MyProfitPulse runs the numbers in seconds&mdash;so you decide with data, not hope.
                </p>
                <Button size="lg" onClick={() => router.push("/signup")}>
                  Run Your Own Scenario
                </Button>
              </div>
            </RevealSection>

            <RevealSection delay={200}>
              <div className="relative">
                {/* Glow */}
                <div
                  className="absolute -inset-4 rounded-[24px] opacity-15 blur-2xl pointer-events-none"
                  style={{ background: "radial-gradient(circle, #E65100 0%, transparent 70%)" }}
                  aria-hidden="true"
                />

                {/* Glass card */}
                <div className="relative bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-md md:p-lg overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-md pb-md border-b border-white/10">
                    <div>
                      <p className="font-body text-small text-white/40 uppercase tracking-wider mb-1">
                        Scenario
                      </p>
                      <p className="font-display text-h3 text-white">New Hire Analysis</p>
                    </div>
                    <span className="inline-block px-3 py-1 rounded-full text-small font-semibold bg-[#FB8C00]/15 text-[#FB8C00]">
                      HIGH RISK
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="font-body text-body text-white/60">Position</span>
                      <span className="font-body text-body text-white font-medium">Senior Developer</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-body text-body text-white/60">Annual Salary</span>
                      <span className="font-body text-body text-white font-medium">$95,000/yr</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-body text-body text-white/60">Monthly Cost</span>
                      <span className="font-body text-body text-white font-medium">$7,917/mo</span>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-body text-body text-white/60">Revenue Needed</span>
                        <span className="font-body text-body text-[#E65100] font-medium">+$11,500/mo</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-body text-body text-white/60">Current Runway</span>
                        <div className="flex items-center gap-2">
                          <span className="font-body text-body text-white/40 line-through">7.2 mo</span>
                          <span className="font-body text-body text-white">&#8594;</span>
                          <span className="font-body text-body text-[#FB8C00] font-medium">4.8 mo</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Runway visual bar */}
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/40">Runway After Hire</span>
                      <span className="text-[#FB8C00]">4.8 months</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full w-[40%] bg-gradient-to-r from-[#FB8C00] to-[#E53935] rounded-full" />
                    </div>
                  </div>

                  {/* AI recommendation */}
                  <div className="mt-md bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="flex items-start gap-2">
                      <span className="text-[14px] mt-[1px]" aria-hidden="true">
                        &#9888;&#65039;
                      </span>
                      <p className="font-body text-[12px] text-white/70 leading-[1.6]">
                        This hire would reduce runway below 6 months. Consider waiting until monthly revenue exceeds $45K or exploring a contract-to-hire arrangement.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ================================================================
          10. PRICING
          ================================================================ */}
      <section id="pricing" className="py-xl md:py-[112px] scroll-mt-[120px]">
        <div className="max-w-6xl mx-auto px-sm md:px-lg">
          <RevealSection>
            <div className="text-center mb-xl md:mb-[72px]">
              <p className="font-body text-small uppercase tracking-[0.2em] text-[#E65100] mb-sm">
                Simple Pricing
              </p>
              <h2 className="font-display text-h2 md:text-[36px] text-text-primary mb-sm">
                Less than your morning coffee habit costs you
              </h2>
              <p className="font-body text-body md:text-[16px] text-text-secondary">
                No contracts. No setup fees. Cancel in two clicks.
              </p>
            </div>
          </RevealSection>

          <RevealSection delay={150}>
            <div className="max-w-4xl mx-auto">
              {/* Billing Toggle */}
              <div className="flex items-center justify-center gap-3 mb-lg">
                <span className={`font-body text-body ${!isAnnual ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>
                  Monthly
                </span>
                <button
                  onClick={() => setIsAnnual(!isAnnual)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    isAnnual ? 'bg-orange' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                      isAnnual ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className={`font-body text-body ${isAnnual ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>
                  Annual
                </span>
                {isAnnual && (
                  <span className="bg-[#E8F5E9] text-[#2E7D32] font-body text-small font-semibold px-2 py-0.5 rounded-full">
                    Save 17%
                  </span>
                )}
              </div>

              <Card
                variant="featured"
                className="max-w-md mx-auto flex flex-col relative shadow-medium border-l-[3px] border-l-orange ring-1 ring-[#E65100]/10"
              >
                <div className="mb-md text-center">
                  <h3 className="font-display text-h3 text-text-primary">MyProfitPulse</h3>
                  <div className="mt-xs flex items-baseline justify-center gap-1">
                    <span className="font-display text-[48px] text-text-primary">
                      ${isAnnual ? 49 : 59}
                    </span>
                    <span className="font-body text-body text-text-muted">/mo</span>
                  </div>
                  <p className="font-body text-small text-text-muted mt-1">
                    {isAnnual ? 'Billed annually' : 'Billed monthly'}
                  </p>
                  <p className="font-body text-small text-orange font-semibold mt-2">
                    7-day free trial included
                  </p>
                </div>

                <ul className="space-y-[12px] mb-lg flex-1">
                  {planFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-[8px] font-body text-body text-text-secondary">
                      <CheckIcon />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={() => router.push("/signup")}
                >
                  Start Your Free Trial
                </Button>
              </Card>
            </div>
          </RevealSection>

          <RevealSection delay={300}>
            <p className="text-center font-body text-small text-text-muted mt-lg">
              7-day free trial. No credit card required to start. Cancel anytime.
            </p>
          </RevealSection>
        </div>
      </section>

      {/* ================================================================
          11. FAQ
          ================================================================ */}
      <section id="faq" className="py-xl md:py-[112px] bg-surface scroll-mt-[120px]">
        <div className="max-w-3xl mx-auto px-sm md:px-lg">
          <RevealSection>
            <div className="text-center mb-xl md:mb-[72px]">
              <p className="font-body text-small uppercase tracking-[0.2em] text-[#E65100] mb-sm">
                FAQ
              </p>
              <h2 className="font-display text-h2 md:text-[36px] text-text-primary mb-sm">
                Common Questions
              </h2>
              <p className="font-body text-body md:text-[16px] text-text-secondary">
                Everything you need to know before getting started.
              </p>
            </div>
          </RevealSection>

          <div className="space-y-0">
            {faqs.map((faq, i) => (
              <RevealSection key={i} delay={i * 50}>
                <div className="border-b border-[#F0EDE8]">
                  <button
                    className="w-full flex items-center justify-between py-md text-left group"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                  >
                    <span className="font-body text-[16px] text-text-primary font-medium pr-md group-hover:text-[#E65100] transition-colors">
                      {faq.q}
                    </span>
                    <ChevronIcon open={openFaq === i} />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${
                      openFaq === i ? "max-h-[300px] opacity-100 pb-md" : "max-h-0 opacity-0"
                    }`}
                  >
                    <p className="font-body text-body text-text-secondary leading-[1.7]">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          12. FINAL CTA
          ================================================================ */}
      <section className="relative py-xl md:py-[120px] bg-[#2D2A26] overflow-hidden">
        {/* Radial glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(230,81,0,0.15) 0%, transparent 70%)" }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl mx-auto px-sm md:px-lg text-center">
          <RevealSection>
            <p className="font-body text-small uppercase tracking-[0.2em] text-[#E65100] mb-md">
              Ready?
            </p>
            <h2 className="font-display text-h2 md:text-[44px] text-white leading-[1.12] mb-md">
              Stop Guessing.
              <br />
              Start Deciding.
            </h2>
            <p className="font-body text-[16px] md:text-[18px] text-white/60 leading-[1.7] mb-sm max-w-2xl mx-auto">
              Join hundreds of service-based business owners who finally understand their numbers&mdash;and make better decisions because of it.
            </p>
            <p className="font-body text-[14px] text-white/40 mb-lg">
              Setup takes under 5 minutes. No credit card required.
            </p>
            <Button size="lg" onClick={() => router.push("/signup")}>
              Get Started Free
            </Button>
          </RevealSection>
        </div>
      </section>

      {/* ================================================================
          13. FOOTER
          ================================================================ */}
      <footer className="bg-[#1E1C19] py-xl md:py-2xl">
        <div className="max-w-6xl mx-auto px-sm md:px-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg md:gap-xl mb-xl">
            {/* Tagline */}
            <div className="md:col-span-1">
              <p className="font-body text-small text-white/40 leading-[1.6]">
                Finally understand your numbers&mdash;without the accounting degree.
              </p>
            </div>

            {/* Product links */}
            <div>
              <p className="font-body text-small font-semibold text-white/60 uppercase tracking-wider mb-md">
                Product
              </p>
              <ul className="space-y-sm">
                <li>
                  <a href="#features" className="font-body text-body text-white/40 hover:text-white/70 transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="font-body text-body text-white/40 hover:text-white/70 transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#scenarios" className="font-body text-body text-white/40 hover:text-white/70 transition-colors">
                    Scenarios
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="font-body text-body text-white/40 hover:text-white/70 transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#faq" className="font-body text-body text-white/40 hover:text-white/70 transition-colors">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal links */}
            <div>
              <p className="font-body text-small font-semibold text-white/60 uppercase tracking-wider mb-md">
                Legal
              </p>
              <ul className="space-y-sm">
                <li>
                  <a href="/privacy" className="font-body text-body font-bold text-white underline underline-offset-4 decoration-2 hover:text-white/80 transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/terms" className="font-body text-body font-bold text-white underline underline-offset-4 decoration-2 hover:text-white/80 transition-colors">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/10 pt-lg flex flex-col md:flex-row items-center justify-between gap-md">
            <div className="flex items-center gap-sm">
              <Image
                src="/logoupdated-transparent61926.png"
                alt="MyProfitPulse"
                width={280}
                height={77}
                className="h-[56px] w-auto opacity-40"
              />
              <span className="font-body text-body text-white/30">
                &copy; 2026 MyProfitPulse. All rights reserved.
              </span>
            </div>
            <p className="font-body text-body text-white/30">
              Built for service-based business owners who want clarity, not complexity.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
