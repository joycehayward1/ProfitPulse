import { AppLayout } from "@/components/layout/AppLayout";

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="space-y-lg">
        <div>
          <h1 className="font-display text-h1 text-text-primary">Settings</h1>
          <p className="text-body text-text-secondary mt-xs">
            Manage your profile, connections, and account settings.
          </p>
        </div>

        <div className="bg-surface rounded-lg p-xl border border-[#F0EDE8] shadow-sm text-center">
          <p className="text-body text-text-muted">Settings page coming soon...</p>
        </div>
      </div>
    </AppLayout>
  );
}
