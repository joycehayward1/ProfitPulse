import { AppLayout } from "@/components/layout/AppLayout";

export default function ScenariosPage() {
  return (
    <AppLayout>
      <div className="space-y-lg">
        <div>
          <h1 className="font-display text-h1 text-text-primary">What-If Calculator</h1>
          <p className="text-body text-text-secondary mt-xs">
            Explore different financial scenarios for your business.
          </p>
        </div>

        <div className="bg-surface rounded-lg p-xl border border-[#F0EDE8] shadow-sm text-center">
          <p className="text-body text-text-muted">Scenario calculator coming soon...</p>
        </div>
      </div>
    </AppLayout>
  );
}
