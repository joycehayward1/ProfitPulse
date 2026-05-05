"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";

const MESSAGES = [
  {
    title: "Hey there!",
    body: "I'm **Pulse** — your financial assistant. I'll be hanging out in your dashboard, keeping an eye on your numbers so you don't have to stress.",
  },
  {
    title: "I've got your back",
    body: "I'll watch your cash, your runway, and your margins, and let you know when something needs your attention — whether that's a risk or an opportunity to save.",
  },
  {
    title: "We'll grow together",
    body: "The more data you give me, the sharper my insights get. Insert your numbers or upload a spreadsheet and I'll start making sense of it all.",
  },
  {
    title: "Let's get started",
    body: "Take a look around. I'll pop in now and then with helpful nudges to keep you on track.",
  },
];

export function getOnboardingStorageKey(userId: string): string {
  return `profitpulse_onboarded_${userId}`;
}

export function hasCompletedOnboarding(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(getOnboardingStorageKey(userId)) !== null;
}

interface BearOnboardingProps {
  userId: string;
  onComplete?: () => void;
}

export function BearOnboarding({ userId, onComplete }: BearOnboardingProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = window.localStorage.getItem(getOnboardingStorageKey(userId));
    if (!done) {
      setVisible(true);
      const t = setTimeout(() => setEntering(false), 50);
      return () => clearTimeout(t);
    }
  }, [userId]);

  if (!visible) return null;

  const isLast = step === MESSAGES.length - 1;
  const current = MESSAGES[step];

  function advance() {
    if (isLast) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }

  function finish() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        getOnboardingStorageKey(userId),
        new Date().toISOString()
      );
    }
    setVisible(false);
    onComplete?.();
  }

  const bodyParts = current.body.split(/(\*\*[^*]+\*\*)/g);

  return (
    <div
      className={[
        "fixed inset-0 z-[100]",
        "flex items-end md:items-center justify-center",
        "bg-black/50 backdrop-blur-sm",
        "transition-opacity duration-300",
        entering ? "opacity-0" : "opacity-100",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bear-onboarding-title"
    >
      <div
        className={[
          "relative w-full md:max-w-2xl",
          "mx-md mb-md md:mb-0",
          "flex flex-col md:flex-row items-center md:items-end gap-lg",
          "transition-all duration-500",
          entering ? "translate-y-8 opacity-0" : "translate-y-0 opacity-100",
        ].join(" ")}
      >
        {/* Mascot */}
        <div className="relative flex-shrink-0">
          <div
            className={[
              "w-[320px] h-[420px] md:w-[420px] md:h-[540px]",
              "transition-transform duration-500",
              "drop-shadow-2xl",
            ].join(" ")}
            style={{
              animation: entering ? undefined : "mascotBounceIn 0.6s ease-out",
            }}
          >
            <Image
              src="/profit-pulse-mascot2.png"
              alt="Pulse — your financial assistant"
              width={840}
              height={1080}
              className="w-full h-full object-contain"
              priority
            />
          </div>
        </div>

        {/* Speech bubble */}
        <div
          className={[
            "relative flex-1 w-full",
            "bg-white rounded-2xl shadow-elevated",
            "border border-border-light",
            "p-lg md:p-xl",
            "max-w-md md:max-w-none",
          ].join(" ")}
        >
          {/* Speech bubble tail */}
          <div
            className="hidden md:block absolute top-1/2 -left-3 w-6 h-6 bg-white border-l border-b border-border-light rotate-45 -translate-y-1/2"
            aria-hidden="true"
          />

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-sm">
            {MESSAGES.map((_, i) => (
              <span
                key={i}
                className={[
                  "h-1.5 rounded-full transition-all duration-300",
                  i === step ? "w-8 bg-orange" : "w-1.5 bg-border",
                ].join(" ")}
              />
            ))}
          </div>

          <h3
            id="bear-onboarding-title"
            className="text-heading font-semibold text-text-primary mb-xs"
          >
            {current.title}
          </h3>
          <p className="text-body text-text-secondary mb-lg leading-relaxed">
            {bodyParts.map((part, i) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return (
                  <strong key={i} className="text-text-primary font-semibold">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={i}>{part}</span>;
            })}
          </p>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={finish}
              className="text-body-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              Skip intro
            </button>
            <button
              type="button"
              onClick={advance}
              className={[
                "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg",
                "bg-orange text-white text-body font-medium",
                "hover:bg-[#BF4400] active:bg-[#A33B00] transition-colors",
                "shadow-sm",
              ].join(" ")}
            >
              {isLast ? "Let's go!" : "Next"}
              <Icon
                icon={isLast ? "lucide:check" : "lucide:arrow-right"}
                width={16}
                height={16}
              />
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes mascotBounceIn {
          0% {
            transform: translateY(40px) scale(0.8);
            opacity: 0;
          }
          60% {
            transform: translateY(-10px) scale(1.05);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
