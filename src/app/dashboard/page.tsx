import { AppLayout } from "@/components/layout/AppLayout";

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="space-y-lg">
        {/* Page Header */}
        <div>
          <h1 className="font-display text-h1 text-text-primary mb-xs">
            Good afternoon, Jessica
          </h1>
          <p className="text-body text-text-secondary">
            Monday, February 19, 2026
          </p>
        </div>

        {/* Placeholder for future dashboard content */}
        <div className="grid gap-md md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-surface rounded-lg p-lg border border-[#F0EDE8] shadow-sm"
            >
              <div className="h-32 bg-background/50 rounded-md animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
