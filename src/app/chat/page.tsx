"use client";

import React, { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/components/ui/Toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const { user } = useRequireAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hi! I'm your ProfitPulse AI assistant. Ask me anything about your financial data, business metrics, or what scenarios you should run. For example:\n\n• \"What's my current cash runway?\"\n• \"Should I hire someone right now?\"\n• \"How can I improve my profit margin?\"\n• \"What scenarios should I run this week?\"",
    timestamp: new Date(),
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      // Fetch user's latest financial data for context
      const { data: assessment } = await client.database
        .from('health_assessments')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { data: financialData } = await client.database
        .from('financial_data')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Build context for AI
      let context = "User's Financial Data:\n";
      if (assessment) {
        context += `- Cash on hand: $${assessment.cash_on_hand.toLocaleString()}\n`;
        context += `- Monthly revenue: $${assessment.monthly_revenue.toLocaleString()}\n`;
        context += `- Monthly expenses: $${assessment.monthly_expenses.toLocaleString()}\n`;
        context += `- Accounts receivable: $${assessment.accounts_receivable.toLocaleString()}\n`;
        context += `- Health score: ${assessment.health_score}/100\n`;

        const profit = assessment.monthly_revenue - assessment.monthly_expenses;
        const runway = assessment.monthly_expenses > 0
          ? (assessment.cash_on_hand / assessment.monthly_expenses).toFixed(1)
          : "N/A";
        context += `- Monthly profit: $${profit.toLocaleString()}\n`;
        context += `- Cash runway: ${runway} months\n`;
      } else if (financialData) {
        context += `- Cash balance: $${financialData.cash_balance?.toLocaleString() || 0}\n`;
        context += `- Revenue: $${financialData.revenue?.toLocaleString() || 0}\n`;
        context += `- Expenses: $${financialData.expenses?.toLocaleString() || 0}\n`;
      } else {
        context = "No financial data available yet. User should complete the health assessment first.";
      }

      // Generate AI response using Claude Sonnet 4.5
      const response = await client.ai.chat.completions.create({
        model: "anthropic/claude-sonnet-4.5",
        messages: [
          {
            role: "system",
            content: `You are a helpful financial advisor assistant for ProfitPulse.

${context}

IMPORTANT Guidelines:
- Answer questions about their financial data using the context above
- Recommend specific ProfitPulse features/calculators when relevant:
  * Break-Even Calculator
  * Cash Runway Calculator
  * Shortfall Recovery
  * Hiring Readiness
  * Goal Planning
  * Scenario Planning
- Be conversational, warm, and encouraging
- Keep responses concise (2-3 paragraphs max)
- If you don't have data to answer, politely say so and suggest they add it
- Focus on actionable advice they can implement this week`,
          },
          {
            role: "user",
            content: userMessage.content,
          },
        ],
        temperature: 0.7,
        maxTokens: 400,
      });

      const aiContent = response.choices[0]?.message?.content || "I'm having trouble responding right now. Please try again.";

      const assistantMessage: Message = {
        role: "assistant",
        content: aiContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      showToast('error', 'Failed to get response. Please try again.');

      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again or contact support if the problem persists.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto h-[calc(100vh-80px)] flex flex-col">
        {/* Header */}
        <div className="py-6 border-b border-gray-200 bg-surface">
          <h1 className="text-2xl font-display text-text-primary">AI Financial Assistant</h1>
          <p className="text-text-secondary font-body mt-1">
            Ask questions about your data or get recommendations
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-orange text-white'
                    : 'bg-surface border border-gray-200'
                }`}
              >
                <p className="text-body font-body whitespace-pre-wrap">
                  {message.content}
                </p>
                <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-white/70' : 'text-text-muted'}`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-surface">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances... (Shift+Enter for new line)"
              rows={1}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:border-orange focus:ring-2 focus:ring-orange/20 focus:outline-none resize-none font-body text-body disabled:bg-gray-100 disabled:cursor-not-allowed"
              style={{ minHeight: '50px', maxHeight: '120px' }}
            />
            <Button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-6 self-end"
            >
              Send
            </Button>
          </div>
          <p className="text-xs text-text-muted mt-2 text-center">
            Press Enter to send • Shift+Enter for new line
          </p>
        </form>
      </div>
    </AppLayout>
  );
}
