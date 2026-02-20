"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useToast } from "@/components/ui/Toast";

interface AssessmentData {
  cashOnHand: string;
  monthlyRevenue: string;
  monthlyExpenses: string;
  accountsReceivable: string;
  employeeCount: string;
  biggestWorry: string;
}

const questions = [
  {
    id: 'cashOnHand',
    type: 'currency' as const,
    question: "How much cash do you have in the bank right now?",
    subtext: "Just your available cash—the money you can access today.",
    placeholder: "0.00",
  },
  {
    id: 'monthlyRevenue',
    type: 'currency' as const,
    question: "What were your total sales last month?",
    subtext: "All the money that came in from customers or clients.",
    placeholder: "0.00",
  },
  {
    id: 'monthlyExpenses',
    type: 'currency' as const,
    question: "What were your total expenses last month?",
    subtext: "Everything you spent—payroll, rent, supplies, all of it.",
    placeholder: "0.00",
  },
  {
    id: 'accountsReceivable',
    type: 'currency' as const,
    question: "How much money are clients or customers currently owing you?",
    subtext: "Money you've earned but haven't collected yet.",
    placeholder: "0.00",
  },
  {
    id: 'employeeCount',
    type: 'number' as const,
    question: "How many employees do you have?",
    subtext: "Full-time, part-time, contractors—everyone on your team.",
    placeholder: "0",
  },
  {
    id: 'biggestWorry',
    type: 'textarea' as const,
    question: "What's your biggest financial worry right now?",
    subtext: "Be honest—we're here to help you find clarity.",
    placeholder: "Take your time... there are no wrong answers.",
    required: false,
  },
];

export default function AssessmentPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<AssessmentData>({
    cashOnHand: '',
    monthlyRevenue: '',
    monthlyExpenses: '',
    accountsReceivable: '',
    employeeCount: '',
    biggestWorry: '',
  });
  const [errors, setErrors] = useState<Partial<AssessmentData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const currentQuestion = questions[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === questions.length - 1;
  const progress = ((currentStep + 1) / questions.length) * 100;

  const validateStep = (): boolean => {
    const currentValue = data[currentQuestion.id as keyof AssessmentData];

    // Skip validation if field is not required
    if (currentQuestion.required === false) {
      setErrors({});
      return true;
    }

    if (!currentValue || currentValue.trim() === '') {
      setErrors({ [currentQuestion.id]: 'This field is required' });
      return false;
    }

    setErrors({});
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;

    if (isLastStep) {
      handleSubmit();
    } else {
      setDirection('forward');
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setDirection('backward');
      setCurrentStep(prev => prev - 1);
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Dynamic import to avoid SSR issues
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      // TODO: Replace with actual auth check once InsForge credentials are available
      // For now, use placeholder user ID for development
      const userId = "placeholder-user-id";

      // Save assessment data
      const { error: insertError } = await client.database
        .from('health_assessments')
        .insert({
          user_id: userId,
          cash_on_hand: parseFloat(data.cashOnHand) || 0,
          monthly_revenue: parseFloat(data.monthlyRevenue) || 0,
          monthly_expenses: parseFloat(data.monthlyExpenses) || 0,
          accounts_receivable: parseFloat(data.accountsReceivable) || 0,
          health_score: 0, // Will be calculated on results page
          ai_summary: null,
          recommendations: null,
        });

      if (insertError) {
        throw insertError;
      }

      showToast('success', 'Assessment complete! Calculating your health score...');

      // Redirect to results page
      router.push('/assessment/results');
    } catch (error) {
      console.error('Error saving assessment:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to save assessment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (value: string) => {
    setData(prev => ({
      ...prev,
      [currentQuestion.id]: value,
    }));

    // Clear error when user starts typing
    if (errors[currentQuestion.id as keyof AssessmentData]) {
      setErrors({});
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSubmitting) {
      e.preventDefault();
      handleNext();
    }
  };

  const renderInput = () => {
    const value = data[currentQuestion.id as keyof AssessmentData];
    const error = errors[currentQuestion.id as keyof AssessmentData];

    switch (currentQuestion.type) {
      case 'currency':
        return (
          <CurrencyInput
            value={value}
            onChange={handleInputChange}
            placeholder={currentQuestion.placeholder}
            error={error}
            required={currentQuestion.required !== false}
            disabled={isSubmitting}
            autoFocus
            onKeyDown={handleKeyDown}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={currentQuestion.placeholder}
            error={error}
            required={currentQuestion.required !== false}
            disabled={isSubmitting}
            min="0"
            step="1"
            autoFocus
            onKeyDown={handleKeyDown}
          />
        );

      case 'textarea':
        return (
          <div className="w-full">
            <textarea
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={currentQuestion.placeholder}
              rows={4}
              disabled={isSubmitting}
              autoFocus
              onKeyDown={(e) => {
                // Allow Enter for new lines in textarea, but Cmd/Ctrl+Enter to submit
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isSubmitting) {
                  e.preventDefault();
                  handleNext();
                }
              }}
              className={`
                w-full px-4 py-3 rounded-md
                bg-white border-2
                font-body text-lg text-text-primary
                placeholder:text-text-muted
                transition-all duration-200
                focus:outline-none focus:ring-0
                resize-none
                ${error
                  ? 'border-error focus:border-error'
                  : 'border-gray-300 focus:border-orange hover:border-gray-400'
                }
                disabled:bg-gray-50 disabled:text-text-muted disabled:cursor-not-allowed
              `}
            />
            {error && (
              <p className="mt-2 text-sm text-error font-body">{error}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Welcome Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-display text-text-primary mb-3">
            Let&apos;s get you some clarity on your business.
          </h1>
          <p className="text-lg text-text-secondary font-body">
            Just a few simple questions—this should only take a minute or two.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-body text-text-secondary">
              Step {currentStep + 1} of {questions.length}
            </span>
            <span className="text-sm font-body text-text-secondary">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-2 bg-white rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-orange rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div
          key={currentStep}
          className={`
            bg-white rounded-lg shadow-lg p-8 md:p-12 mb-8
            animate-fade-in
            ${direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'}
          `}
        >
          {/* Question */}
          <h2 className="text-2xl md:text-3xl font-display text-text-primary mb-3">
            {currentQuestion.question}
          </h2>

          {/* Subtext */}
          <p className="text-base text-text-secondary font-body mb-8">
            {currentQuestion.subtext}
          </p>

          {/* Input */}
          {renderInput()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="cancel"
            onClick={handleBack}
            disabled={isFirstStep || isSubmitting}
            className="min-w-[120px]"
          >
            Back
          </Button>

          <Button
            variant="primary"
            onClick={handleNext}
            disabled={isSubmitting}
            loading={isSubmitting}
            className="min-w-[120px]"
          >
            {isLastStep ? 'Finish' : 'Next'}
          </Button>
        </div>

        {/* Encouragement */}
        {!isLastStep && (
          <p className="text-center text-sm text-text-muted font-body mt-6">
            Press Enter to continue
          </p>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.4s ease-out;
        }

        .animate-slide-in-left {
          animation: slide-in-left 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
