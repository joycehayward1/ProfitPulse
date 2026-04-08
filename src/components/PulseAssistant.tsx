"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface PulseAssistantProps {
  message: string;
  page?: string;
}

export function PulseAssistant({ message }: PulseAssistantProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Delay mount animation slightly so it feels natural
    const timer = setTimeout(() => setMounted(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-open the bubble on first load after mount animation
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(timer);
  }, [mounted]);

  function handleDismiss() {
    setDismissed(true);
    setOpen(false);
  }

  function handleToggle() {
    if (dismissed) {
      setDismissed(false);
      setOpen(true);
    } else {
      setOpen(!open);
    }
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9990] flex flex-col items-end gap-3 transition-all duration-500 ${
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {/* Speech Bubble */}
      {open && !dismissed && (
        <div
          className="relative max-w-[280px] px-4 py-3.5 rounded-2xl shadow-xl border border-orange/10"
          style={{
            background: "linear-gradient(135deg, #FFFBF7, #FFF8F2)",
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
          <p className="text-[13px] leading-relaxed text-text-primary font-body pr-4">
            {message}
          </p>

          {/* Triangle pointer */}
          <div
            className="absolute -bottom-[7px] right-8 w-3.5 h-3.5 rotate-45 border-r border-b border-orange/10"
            style={{ background: "#FFF8F2" }}
          />
        </div>
      )}

      {/* Bear Avatar */}
      <button
        onClick={handleToggle}
        className="relative group"
        aria-label="Toggle Pulse assistant"
      >
        {/* Pulse dot — only when bubble is closed */}
        {!open && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-orange animate-ping" style={{ animationDuration: "2s" }} />
        )}

        {/* Warm glow ring */}
        <div className="w-[80px] h-[100px] drop-shadow-lg group-hover:drop-shadow-xl transition-all duration-300 group-hover:scale-105">
          <Image
            src="/pulse-bear-2.png"
            alt="Pulse — your financial buddy"
            width={160}
            height={200}
            className="w-full h-full object-contain"
            priority
          />
        </div>
      </button>

      {/* Animations */}
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
