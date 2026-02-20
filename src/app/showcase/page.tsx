"use client";

import { useState } from "react";
import {
  Button, Input, Card,
  HealthScoreGauge, TrafficLightDot, StatusBadge, ProgressBar,
} from "@/components/ui";

export default function ShowcasePage() {
  const [inputValue, setInputValue] = useState("");

  return (
    <main className="min-h-screen bg-background p-xl">
      <div className="max-w-3xl mx-auto space-y-xl">
        <h1 className="font-display text-h1 text-text-primary">
          Component Showcase
        </h1>

        {/* Buttons */}
        <section className="space-y-md">
          <h2 className="font-display text-h2 text-text-primary">Buttons</h2>
          <div className="flex flex-wrap gap-sm">
            <Button variant="primary">Get Started</Button>
            <Button variant="secondary">Learn More</Button>
            <Button variant="cancel">Cancel</Button>
          </div>
          <div className="flex flex-wrap gap-sm">
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary" size="md">Medium</Button>
            <Button variant="primary" size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap gap-sm">
            <Button variant="primary" loading>Saving</Button>
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="secondary" disabled>Disabled</Button>
          </div>
          <Button variant="primary" fullWidth>Full Width Button</Button>
        </section>

        {/* Inputs */}
        <section className="space-y-md">
          <h2 className="font-display text-h2 text-text-primary">Inputs</h2>
          <Input
            label="Business Name"
            placeholder="Enter your business name"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            required
            helperText="We'll never share your email"
          />
          <Input
            label="Revenue"
            placeholder="$0.00"
            error="Revenue is required"
          />
          <Input
            label="Disabled Field"
            placeholder="Cannot edit"
            disabled
          />
        </section>

        {/* Cards */}
        <section className="space-y-md">
          <h2 className="font-display text-h2 text-text-primary">Cards</h2>
          <Card variant="standard">
            <h3 className="font-display text-h3 text-text-primary mb-xs">Standard Card</h3>
            <p className="text-text-secondary text-body">Clean white card for general content and dashboard sections.</p>
          </Card>
          <Card variant="featured">
            <h3 className="font-display text-h3 text-text-primary mb-xs">Featured Card</h3>
            <p className="text-text-secondary text-body">Orange left border draws attention. Used for health score and key metrics.</p>
          </Card>
          <Card variant="highlight">
            <h3 className="font-display text-h3 text-text-primary mb-xs">Highlight Card</h3>
            <p className="text-text-secondary text-body">Warm cream background for supplemental info and tips.</p>
          </Card>
          <Card variant="standard" onClick={() => alert("Clicked!")}>
            <h3 className="font-display text-h3 text-text-primary mb-xs">Clickable Card</h3>
            <p className="text-text-secondary text-body">Click me — I have a hover lift effect and focus ring.</p>
          </Card>
        </section>
        {/* Health Score Gauges */}
        <section className="space-y-md">
          <h2 className="font-display text-h2 text-text-primary">Health Score Gauge</h2>
          <div className="flex flex-wrap items-center gap-lg">
            <div className="relative">
              <HealthScoreGauge score={92} size="sm" />
            </div>
            <div className="relative">
              <HealthScoreGauge score={67} size="md" />
            </div>
            <div className="relative">
              <HealthScoreGauge score={35} size="lg" />
            </div>
          </div>
        </section>

        {/* Traffic Light Dots */}
        <section className="space-y-md">
          <h2 className="font-display text-h2 text-text-primary">Traffic Light Dots</h2>
          <div className="flex flex-wrap gap-lg">
            <TrafficLightDot status="healthy" label="Profit Margin" />
            <TrafficLightDot status="attention" label="Cash Flow" />
            <TrafficLightDot status="critical" label="Runway" />
          </div>
        </section>

        {/* Status Badges */}
        <section className="space-y-md">
          <h2 className="font-display text-h2 text-text-primary">Status Badges</h2>
          <div className="flex flex-wrap gap-sm">
            <StatusBadge status="healthy" />
            <StatusBadge status="attention" />
            <StatusBadge status="critical" />
          </div>
        </section>

        {/* Progress Bars */}
        <section className="space-y-md">
          <h2 className="font-display text-h2 text-text-primary">Progress Bars</h2>
          <ProgressBar value={75} max={100} label="Revenue Goal" showPercentage />
          <ProgressBar value={3} max={10} label="Months of Runway" showPercentage />
          <ProgressBar value={100} max={100} label="Data Complete" showPercentage />
        </section>
      </div>
    </main>
  );
}
