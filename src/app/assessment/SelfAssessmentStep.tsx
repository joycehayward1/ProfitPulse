"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";
import {
  ACCOUNTING_SYSTEMS,
  MAX_PAIN_POINTS,
  PAIN_POINTS,
  RATING_QUESTIONS,
  RATING_SCALE,
  calculateHabitsScore,
  type PainPointId,
  type Ratings,
  type SelfAssessmentInsert,
} from "@/lib/self-assessment";

interface SelfAssessmentStepProps {
  userId: string;
  isSaving: boolean;
  onSubmit: (assessment: SelfAssessmentInsert) => void;
}

export function SelfAssessmentStep({ userId, isSaving, onSubmit }: SelfAssessmentStepProps) {
  const [ratings, setRatings] = useState<Partial<Ratings>>({});
  const [painPoints, setPainPoints] = useState<PainPointId[]>([]);
  const [painPointOther, setPainPointOther] = useState("");
  const [vision, setVision] = useState("");
  const [accountingSystem, setAccountingSystem] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const unanswered = RATING_QUESTIONS.filter((q) => !ratings[q.id]);
  const otherMissing = painPoints.includes("other") && !painPointOther.trim();
  const isComplete =
    unanswered.length === 0 && painPoints.length > 0 && !otherMissing && Boolean(accountingSystem);

  function togglePainPoint(id: PainPointId) {
    setPainPoints((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_PAIN_POINTS) return prev;
      return [...prev, id];
    });
  }

  function handleSubmit() {
    if (!isComplete) {
      setShowErrors(true);
      return;
    }
    const complete = ratings as Ratings;
    onSubmit({
      user_id: userId,
      ratings: complete,
      pain_points: painPoints,
      pain_point_other: painPoints.includes("other") ? painPointOther.trim() : null,
      vision: vision.trim() || null,
      accounting_system: accountingSystem,
      habits_score: calculateHabitsScore(complete),
    });
  }

  return (
    <div className="animate-fade-in space-y-8">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-display text-text-primary mb-3">
          A quick financial check-in
        </h1>
        <p className="text-text-secondary font-body max-w-xl mx-auto">
          Answer honestly. There are no wrong answers, only insights. We&apos;ll use
          this to tailor your dashboard.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-text-muted font-body">
          <Icon icon="ph:lock-simple-bold" className="w-4 h-4" />
          About 2 minutes · Your answers are private to you
        </p>
      </div>

      {/* Part 1: Ratings */}
      <section className="bg-surface rounded-xl p-6 border border-border-light shadow-card">
        <h2 className="text-xl font-display text-text-primary mb-1">How do you rate yourself?</h2>
        <p className="text-sm text-text-muted font-body mb-6">
          1 = Strongly Disagree · 5 = Strongly Agree
        </p>

        <div className="space-y-6">
          {RATING_QUESTIONS.map((q, index) => {
            const missing = showErrors && !ratings[q.id];
            return (
              <fieldset key={q.id}>
                <legend
                  className={`text-body font-body mb-3 ${missing ? "text-error" : "text-text-primary"}`}
                >
                  <span className="text-text-muted mr-1">{index + 1}.</span> {q.text}
                </legend>
                <div className="grid grid-cols-5 gap-2">
                  {RATING_SCALE.map((option) => {
                    const selected = ratings[q.id] === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRatings((prev) => ({ ...prev, [q.id]: option.value }))}
                        aria-pressed={selected}
                        title={option.label}
                        className={`py-2.5 rounded-md border font-body text-sm transition-colors ${
                          selected
                            ? "bg-orange text-white border-orange"
                            : "bg-surface text-text-secondary border-text-muted/30 hover:border-orange hover:text-orange"
                        }`}
                      >
                        {option.value}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      {/* Part 2: Pain points */}
      <section className="bg-surface rounded-xl p-6 border border-border-light shadow-card">
        <h2 className="text-xl font-display text-text-primary mb-1">Where does it hurt?</h2>
        <p
          className={`text-sm font-body mb-5 ${
            showErrors && painPoints.length === 0 ? "text-error" : "text-text-muted"
          }`}
        >
          Choose up to {MAX_PAIN_POINTS} of your biggest financial pain points.
        </p>

        <div className="grid sm:grid-cols-2 gap-2">
          {PAIN_POINTS.map((p) => {
            const selected = painPoints.includes(p.id);
            const disabled = !selected && painPoints.length >= MAX_PAIN_POINTS;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePainPoint(p.id)}
                disabled={disabled}
                aria-pressed={selected}
                className={`flex items-center gap-2 text-left px-4 py-3 rounded-md border font-body text-sm transition-colors ${
                  selected
                    ? "border-orange bg-orange/5 text-text-primary"
                    : disabled
                    ? "border-text-muted/20 text-text-muted cursor-not-allowed"
                    : "border-text-muted/30 text-text-secondary hover:border-orange"
                }`}
              >
                <Icon
                  icon={selected ? "ph:check-square-fill" : "ph:square"}
                  className={`w-5 h-5 flex-shrink-0 ${selected ? "text-orange" : "text-text-muted"}`}
                />
                {p.label}
              </button>
            );
          })}
        </div>

        {painPoints.includes("other") && (
          <input
            type="text"
            value={painPointOther}
            onChange={(e) => setPainPointOther(e.target.value)}
            placeholder="Tell us what's on your mind"
            maxLength={200}
            className={`mt-3 w-full px-4 py-3 rounded-md border bg-surface text-text-primary font-body focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent ${
              showErrors && otherMissing ? "border-error" : "border-text-muted/30"
            }`}
          />
        )}
      </section>

      {/* Part 3: Systems + vision */}
      <section className="bg-surface rounded-xl p-6 border border-border-light shadow-card space-y-6">
        <div>
          <h2 className="text-xl font-display text-text-primary mb-1">Your books &amp; your vision</h2>
          <label
            htmlFor="accounting-system"
            className={`block text-sm font-body font-medium mt-4 mb-2 ${
              showErrors && !accountingSystem ? "text-error" : "text-text-secondary"
            }`}
          >
            What do you use to keep your books?
          </label>
          <select
            id="accounting-system"
            value={accountingSystem}
            onChange={(e) => setAccountingSystem(e.target.value)}
            className="w-full px-4 py-3 rounded-md border border-text-muted/30 bg-surface text-text-primary font-body focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent"
          >
            <option value="">Select one…</option>
            {ACCOUNTING_SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="vision" className="block text-sm font-body font-medium text-text-secondary mb-2">
            In 1–2 sentences, what does financial success look like for your business in the next 12
            months? <span className="text-text-muted font-normal">(Optional)</span>
          </label>
          <textarea
            id="vision"
            value={vision}
            onChange={(e) => setVision(e.target.value)}
            placeholder="E.g., Pay myself $5,000 a month and keep 3 months of expenses in the bank."
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3 rounded-md border border-text-muted/30 bg-surface text-text-primary font-body focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent resize-none"
          />
        </div>
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
        {showErrors && !isComplete && (
          <p className="text-sm text-error font-body">
            {unanswered.length > 0
              ? `Please rate all ${RATING_QUESTIONS.length} statements.`
              : painPoints.length === 0
              ? "Please choose at least one pain point."
              : otherMissing
              ? "Please describe your “Other” pain point."
              : "Please tell us what you use to keep your books."}
          </p>
        )}
        <Button variant="primary" onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? "Saving..." : "Continue to your numbers"}
        </Button>
      </div>
    </div>
  );
}
