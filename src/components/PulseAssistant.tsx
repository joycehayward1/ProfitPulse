"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

interface PulseAssistantProps {
  message: string;
  page?: string;
}

/** Persisted so Pulse stays out of the way across pages and visits. */
const MINIMIZED_STORAGE_KEY = "pp-pulse-minimized";

export function PulseAssistant({ message }: PulseAssistantProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(MINIMIZED_STORAGE_KEY) === "1") {
        setMinimized(true);
      }
    } catch {
      // Storage unavailable — Pulse just starts expanded.
    }
    const timer = setTimeout(() => setMounted(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted || minimized) return;
    const timer = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(timer);
  }, [mounted, minimized]);

  function handleDismiss() {
    setDismissed(true);
    setOpen(false);
  }

  function handleMinimize() {
    setMinimized(true);
    setOpen(false);
    try {
      window.localStorage.setItem(MINIMIZED_STORAGE_KEY, "1");
    } catch {
      // Best-effort persistence only.
    }
  }

  function handleRestore() {
    setMinimized(false);
    // Don't pop the speech bubble right back open — she was just in the way.
    setDismissed(true);
    try {
      window.localStorage.removeItem(MINIMIZED_STORAGE_KEY);
    } catch {
      // Best-effort persistence only.
    }
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9990] flex flex-col items-end gap-3 transition-all duration-500 ${
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {minimized ? (
        /* Minimized chip — click to bring Pulse back */
        <button
          onClick={handleRestore}
          aria-label="Show Pulse"
          title="Show Pulse"
          className="w-12 h-12 rounded-full bg-white shadow-elevated border border-border-light overflow-hidden transition-transform hover:scale-110"
        >
          <Image
            src="/profit-pulse-mascot2.png"
            alt="Pulse — your financial assistant"
            width={96}
            height={96}
            className="w-full h-full object-contain p-1"
          />
        </button>
      ) : (
        <>
          {/* Speech Bubble */}
          {open && !dismissed && (
            <div
              className="relative max-w-[280px] px-4 py-3.5 rounded-2xl shadow-elevated border border-border-light bg-white"
              style={{
                animation: "bubbleIn 300ms ease-out forwards",
              }}
            >
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-black/5 transition-colors"
                aria-label="Dismiss"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Message */}
              <p className="text-[13px] leading-relaxed text-text-primary pr-4">
                {message}
              </p>

              {/* Triangle pointer */}
              <div
                className="absolute -bottom-[6px] right-10 w-3 h-3 rotate-45 border-r border-b border-border-light bg-white"
              />
            </div>
          )}

          <div className="relative">
            {/* Minimize button */}
            <button
              onClick={handleMinimize}
              aria-label="Minimize Pulse"
              title="Minimize Pulse"
              className="absolute top-1 right-1 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-md border border-border-light text-text-muted hover:text-text-primary hover:bg-black/5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" d="M5 12h14" />
              </svg>
            </button>

            {/* Mascot Avatar — clicking Pulse opens the glossary */}
            <Link
              href="/glossary"
              className="relative block group"
              aria-label="Open the glossary"
            >
              {/* Pulse dot — only when bubble is closed */}
              {!open && (
                <span className="absolute top-1 left-1 w-3 h-3 rounded-full bg-orange animate-ping" style={{ animationDuration: "2s" }} />
              )}

              <div className="w-44 h-44 transition-all duration-200 group-hover:scale-105 drop-shadow-lg group-hover:drop-shadow-xl">
                <Image
                  src="/profit-pulse-mascot2.png"
                  alt="Pulse — your financial assistant"
                  width={352}
                  height={352}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
            </Link>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes bubbleIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
