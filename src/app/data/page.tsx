import { AppLayout } from "@/components/layout/AppLayout";

export default function DataPage() {
  return (
    <AppLayout>
      <div className="space-y-lg">
        <div>
          <h1 className="font-display text-h1 text-text-primary">Data Entry</h1>
          <p className="text-body text-text-secondary mt-xs">
            Enter your financial data manually or upload a spreadsheet.
          </p>
        </div>

        <div className="bg-surface rounded-lg p-xl border border-[#F0EDE8] shadow-sm text-center">
          <p className="text-body text-text-muted">Data entry forms coming soon...</p>
        </div>
      </div>
    </AppLayout>
  );
}
