"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/components/ui/Toast";

type SettingsTab = "profile" | "business" | "integrations" | "notifications" | "billing" | "account";

interface ProfileData {
  name: string;
  email: string;
  avatar_url?: string;
}

interface BusinessData {
  business_name: string;
  industry: string;
}

export default function SettingsPage() {
  const { user } = useRequireAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [isSaving, setIsSaving] = useState(false);

  // Profile form state
  const [profileData, setProfileData] = useState<ProfileData>({
    name: "",
    email: "",
    avatar_url: undefined,
  });

  // Business form state
  const [businessData, setBusinessData] = useState<BusinessData>({
    business_name: "",
    industry: "",
  });

  // QuickBooks connection state
  const [qbConnected, setQbConnected] = useState(false);
  const [qbConnectedAt, setQbConnectedAt] = useState<string | null>(null);
  const [qbLastSync, setQbLastSync] = useState<string | null>(null);
  const [qbLoading, setQbLoading] = useState(false);
  const [qbDisconnecting, setQbDisconnecting] = useState(false);
  const [qbTestResult, setQbTestResult] = useState<any>(null);
  const [qbTesting, setQbTesting] = useState(false);
  const searchParams = useSearchParams();
  const handledQbResultRef = useRef<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const { getInsForgeClient } = await import("@/lib/insforge");
    const client = getInsForgeClient();
    const { data, error } = await client.auth.getCurrentSession();

    if (error || !data?.session?.accessToken) {
      return null;
    }

    return {
      Authorization: `Bearer ${data.session.accessToken}`,
    };
  }, []);

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState({
    weekly_summary: true,
    health_alerts: true,
    scenario_results: false,
    product_updates: true,
  });

  // Handle QB OAuth callback results from URL params
  useEffect(() => {
    const qbResult = searchParams.get("qb");
    const tab = searchParams.get("tab");

    if (tab === "integrations") {
      setActiveTab("integrations");
    }

    if (!qbResult || handledQbResultRef.current === qbResult) {
      return;
    }

    handledQbResultRef.current = qbResult;

    if (qbResult === "success") {
      showToast("success", "QuickBooks connected successfully!");
      // Clean up URL
      window.history.replaceState({}, "", "/settings?tab=integrations");
    } else if (qbResult === "error") {
      showToast("error", "Failed to connect QuickBooks. Please try again.");
      window.history.replaceState({}, "", "/settings?tab=integrations");
    } else if (qbResult === "auth_required") {
      showToast("error", "Please log in before connecting QuickBooks.");
      window.history.replaceState({}, "", "/settings?tab=integrations");
    }
  }, [searchParams, showToast]);

  // Check QuickBooks connection status
  useEffect(() => {
    async function checkQbStatus() {
      if (!user) return;
      try {
        const authHeaders = await getAuthHeaders();
        if (!authHeaders) return;

        const res = await fetch("/api/quickbooks/status", {
          headers: authHeaders,
        });
        if (!res.ok) return;

        const data = await res.json();
        setQbConnected(Boolean(data.connected));
        setQbConnectedAt(data.connectedAt || null);
        setQbLastSync(data.lastSyncAt || null);
      } catch (err) {
        console.error("Error checking QB status:", err);
      }
    }
    checkQbStatus();
  }, [user, getAuthHeaders]);

  async function handleConnectQuickBooks() {
    if (!user?.id) {
      showToast("error", "Please log in before connecting QuickBooks.");
      return;
    }

    setQbLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      if (!authHeaders) {
        showToast("error", "Your session expired. Please log in again.");
        return;
      }

      const res = await fetch("/api/connect/quickbooks", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnTo: "/settings?tab=integrations",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.authUrl) {
        showToast("error", data?.error || "Failed to start QuickBooks connection.");
        return;
      }

      window.location.href = data.authUrl;
    } catch (err) {
      console.error("Error initiating QB OAuth:", err);
      showToast("error", "Failed to start QuickBooks connection.");
    } finally {
      setQbLoading(false);
    }
  }

  async function handleTestQuickBooks() {
    if (!user) return;
    setQbTesting(true);
    setQbTestResult(null);
    try {
      const authHeaders = await getAuthHeaders();
      if (!authHeaders) {
        showToast("error", "Your session expired. Please log in again.");
        return;
      }

      const res = await fetch("/api/quickbooks/test", {
        headers: authHeaders,
      });
      const data = await res.json();
      setQbTestResult(data);
      if (data.success) {
        showToast("success", "QuickBooks P&L report retrieved successfully!");
      } else {
        showToast("error", data.error || "Test failed");
      }
    } catch (err) {
      showToast("error", "Failed to test QuickBooks connection");
    } finally {
      setQbTesting(false);
    }
  }

  async function handleDisconnectQuickBooks() {
    if (!user) return;

    const confirmed = window.confirm(
      "Disconnect QuickBooks for this account? Manual and spreadsheet entry will be enabled again."
    );
    if (!confirmed) return;

    setQbDisconnecting(true);
    try {
      const authHeaders = await getAuthHeaders();
      if (!authHeaders) {
        showToast("error", "Your session expired. Please log in again.");
        return;
      }

      const res = await fetch("/api/quickbooks/disconnect", {
        method: "DELETE",
        headers: authHeaders,
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        showToast("error", data?.error || "Failed to disconnect QuickBooks.");
        return;
      }

      setQbConnected(false);
      setQbConnectedAt(null);
      setQbLastSync(null);
      setQbTestResult(null);
      showToast("success", "QuickBooks disconnected.");
    } catch (err) {
      console.error("Error disconnecting QuickBooks:", err);
      showToast("error", "Failed to disconnect QuickBooks.");
    } finally {
      setQbDisconnecting(false);
    }
  }

  // Load user data
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
        avatar_url: user.profile?.avatar_url,
      });

      // Load business data if available
      if (user.profile?.business_name) {
        setBusinessData({
          business_name: user.profile.business_name,
          industry: user.profile.industry || "",
        });
      }
    }
  }, [user]);

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: "ph:user-circle-bold" },
    { id: "business" as const, label: "Business", icon: "ph:briefcase-bold" },
    { id: "integrations" as const, label: "Integrations", icon: "ph:plug-bold" },
    { id: "notifications" as const, label: "Notifications", icon: "ph:bell-bold" },
    { id: "billing" as const, label: "Billing", icon: "ph:credit-card-bold" },
    { id: "account" as const, label: "Account", icon: "ph:gear-bold" },
  ];

  async function handleSaveProfile() {
    setIsSaving(true);
    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      // Update profile in InsForge
      const { error } = await client.database
        .from("profiles")
        .update({
          name: profileData.name,
          avatar_url: profileData.avatar_url,
        })
        .eq("id", user?.id);

      if (error) throw error;

      showToast("success", "Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      showToast("error", "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveBusiness() {
    setIsSaving(true);
    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      const { error } = await client.database
        .from("profiles")
        .update({
          business_name: businessData.business_name,
          industry: businessData.industry,
        })
        .eq("id", user?.id);

      if (error) throw error;

      showToast("success", "Business settings updated");
    } catch (error) {
      console.error("Error updating business:", error);
      showToast("error", "Failed to update business settings");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-xl">
        {/* Header */}
        <div className="animate-fadeIn">
          <h1 className="font-display text-[42px] md:text-[48px] text-text-primary mb-xs tracking-tight">
            Settings
          </h1>
          <p className="text-body text-text-secondary">
            Manage your profile, business, and account preferences
          </p>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-background overflow-x-auto animate-fadeIn" style={{ animationDelay: "100ms" }}>
          <nav className="flex gap-1 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-lg py-md font-body text-body font-medium transition-all duration-200 border-b-2 ${
                  activeTab === tab.id
                    ? "text-orange border-orange"
                    : "text-text-secondary border-transparent hover:text-text-primary hover:border-text-muted"
                }`}
              >
                <Icon icon={tab.icon} className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="animate-fadeIn" style={{ animationDelay: "200ms" }}>
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-xl">
              <div className="bg-surface rounded-xl p-xl border border-background shadow-sm">
                <div className="flex items-start gap-xl mb-xl">
                  <div className="flex-shrink-0">
                    {profileData.avatar_url ? (
                      <img
                        src={profileData.avatar_url}
                        alt={profileData.name}
                        className="w-24 h-24 rounded-full object-cover shadow-md"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-orange/10 flex items-center justify-center shadow-md">
                        <Icon icon="ph:user-bold" className="w-12 h-12 text-orange" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-h3 text-text-primary mb-xs">Profile Photo</h3>
                    <p className="text-small text-text-secondary mb-md">
                      Upload a profile picture to personalize your account
                    </p>
                    <Button variant="secondary" size="sm">
                      <Icon icon="ph:upload-simple-bold" className="w-4 h-4 mr-2" />
                      Upload Photo
                    </Button>
                  </div>
                </div>

                <div className="space-y-md">
                  <div>
                    <label className="block text-small font-body font-medium text-text-primary mb-xs">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full px-md py-sm border border-background rounded-lg focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition-colors font-body text-body"
                      placeholder="Your name"
                    />
                  </div>

                  <div>
                    <label className="block text-small font-body font-medium text-text-primary mb-xs">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      disabled
                      className="w-full px-md py-sm border border-background rounded-lg bg-background/50 font-body text-body text-text-muted cursor-not-allowed"
                    />
                    <p className="text-small text-text-muted mt-xs">
                      Email cannot be changed for security reasons
                    </p>
                  </div>

                  <div className="pt-md">
                    <Button
                      variant="primary"
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Business Tab */}
          {activeTab === "business" && (
            <div className="space-y-xl">
              <div className="bg-surface rounded-xl p-xl border border-background shadow-sm">
                <h3 className="font-display text-h3 text-text-primary mb-lg">Business Information</h3>

                <div className="space-y-md">
                  <div>
                    <label className="block text-small font-body font-medium text-text-primary mb-xs">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={businessData.business_name}
                      onChange={(e) => setBusinessData({ ...businessData, business_name: e.target.value })}
                      className="w-full px-md py-sm border border-background rounded-lg focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition-colors font-body text-body"
                      placeholder="Acme Corporation"
                    />
                  </div>

                  <div>
                    <label className="block text-small font-body font-medium text-text-primary mb-xs">
                      Industry
                    </label>
                    <select
                      value={businessData.industry}
                      onChange={(e) => setBusinessData({ ...businessData, industry: e.target.value })}
                      className="w-full px-md py-sm border border-background rounded-lg focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition-colors font-body text-body"
                    >
                      <option value="">Select industry</option>
                      <option value="consulting">Consulting</option>
                      <option value="creative">Creative Services</option>
                      <option value="education">Education & Training</option>
                      <option value="health">Health & Wellness</option>
                      <option value="legal">Legal Services</option>
                      <option value="marketing">Marketing & Advertising</option>
                      <option value="real-estate">Real Estate</option>
                      <option value="technology">Technology</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="pt-md">
                    <Button
                      variant="primary"
                      onClick={handleSaveBusiness}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Integrations Tab */}
          {activeTab === "integrations" && (
            <div className="space-y-md">
              {/* QuickBooks Integration */}
              <div className="bg-surface rounded-xl p-xl border border-background shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-md flex-1">
                    <div className="w-14 h-14 rounded-lg bg-[#2CA01C]/10 flex items-center justify-center flex-shrink-0">
                      <img
                        src="/quickbooks.png"
                        alt="QuickBooks"
                        className="w-8 h-8 object-contain"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display text-h3 text-text-primary mb-xs">QuickBooks</h3>
                      <p className="text-small text-text-secondary mb-md">
                        Automatically sync your financial data from QuickBooks to ProfitPulse
                      </p>
                      {qbConnected ? (
                        <div className="space-y-2">
                          <div className="inline-flex items-center gap-2 px-md py-xs bg-success/10 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-success" />
                            <span className="text-small font-body text-success">Connected</span>
                          </div>
                          {qbConnectedAt && (
                            <p className="text-xs text-text-muted font-body">
                              Connected {new Date(qbConnectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          )}
                          {qbLastSync && (
                            <p className="text-xs text-text-muted font-body">
                              Last synced {new Date(qbLastSync).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-md py-xs bg-background rounded-full">
                          <div className="w-2 h-2 rounded-full bg-text-muted" />
                          <span className="text-small font-body text-text-muted">Not Connected</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {qbConnected ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleTestQuickBooks}
                          disabled={qbTesting}
                        >
                          <Icon icon="ph:play-bold" className="w-4 h-4 mr-2" />
                          {qbTesting ? "Testing..." : "Test Connection"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleConnectQuickBooks}
                          disabled={qbLoading || qbDisconnecting}
                        >
                          <Icon icon="ph:arrows-clockwise-bold" className="w-4 h-4 mr-2" />
                          Reconnect
                        </Button>
                        <Button
                          variant="cancel"
                          size="sm"
                          onClick={handleDisconnectQuickBooks}
                          disabled={qbDisconnecting || qbLoading || qbTesting}
                        >
                          <Icon icon="ph:link-break-bold" className="w-4 h-4 mr-2" />
                          {qbDisconnecting ? "Disconnecting..." : "Disconnect"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleConnectQuickBooks}
                        disabled={qbLoading}
                      >
                        <Icon icon="ph:link-bold" className="w-4 h-4 mr-2" />
                        {qbLoading ? "Connecting..." : "Connect"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Test Result Display */}
                {qbTestResult && (
                  <div className={`mt-md p-md rounded-lg border ${qbTestResult.success ? "bg-success/5 border-success/20" : "bg-critical/5 border-critical/20"}`}>
                    <h4 className="text-sm font-display font-semibold mb-2 text-text-primary">
                      {qbTestResult.success ? "Connection Test Passed" : "Connection Test Failed"}
                    </h4>
                    {qbTestResult.success ? (
                      <div className="text-xs font-body text-text-secondary space-y-1">
                        <p>Realm ID: {qbTestResult.realmId}</p>
                        <p>Report: {qbTestResult.report?.header?.ReportName || "Profit and Loss"}</p>
                        <p>Period: {qbTestResult.report?.header?.StartPeriod} to {qbTestResult.report?.header?.EndPeriod}</p>
                        <p>Rows: {qbTestResult.report?.rowCount}</p>
                      </div>
                    ) : (
                      <p className="text-xs font-body text-critical">{qbTestResult.error}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Integration Requests */}
              <div className="bg-surface/50 rounded-xl p-xl border border-dashed border-background">
                <div className="flex items-center gap-md mb-md">
                  <Icon icon="ph:chat-circle-dots-duotone" className="w-6 h-6 text-orange" />
                  <h3 className="font-display text-h3 text-text-primary">Want to see more integrations?</h3>
                </div>
                <p className="text-small text-text-secondary mb-lg">
                  Tell us which platforms and business tools you'd like to connect with ProfitPulse.
                </p>
                <Button variant="secondary" size="sm">
                  <Icon icon="ph:paper-plane-tilt-bold" className="w-4 h-4 mr-2" />
                  Request an Integration
                </Button>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="bg-surface rounded-xl p-xl border border-background shadow-sm">
              <h3 className="font-display text-h3 text-text-primary mb-lg">Email Notifications</h3>

              <div className="space-y-lg">
                {[
                  {
                    id: "weekly_summary",
                    title: "Weekly Summary",
                    description: "Get a weekly recap of your business health and key metrics",
                  },
                  {
                    id: "health_alerts",
                    title: "Health Alerts",
                    description: "Receive alerts when your health score drops or needs attention",
                  },
                  {
                    id: "scenario_results",
                    title: "Scenario Results",
                    description: "Get notified when your saved scenarios are processed",
                  },
                  {
                    id: "product_updates",
                    title: "Product Updates",
                    description: "Stay informed about new features and improvements",
                  },
                ].map((notification) => (
                  <div
                    key={notification.id}
                    className="flex items-start justify-between gap-md py-md border-b border-background last:border-0"
                  >
                    <div className="flex-1">
                      <h4 className="font-body text-body font-medium text-text-primary mb-xs">
                        {notification.title}
                      </h4>
                      <p className="text-small text-text-secondary">{notification.description}</p>
                    </div>
                    <button
                      onClick={() =>
                        setEmailNotifications({
                          ...emailNotifications,
                          [notification.id]: !emailNotifications[notification.id as keyof typeof emailNotifications],
                        })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        emailNotifications[notification.id as keyof typeof emailNotifications]
                          ? "bg-orange"
                          : "bg-text-muted/30"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          emailNotifications[notification.id as keyof typeof emailNotifications]
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}

                <div className="pt-md">
                  <Button variant="primary">Save Preferences</Button>
                </div>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === "billing" && (
            <div className="space-y-md">
              {/* Current Plan */}
              <div className="bg-gradient-to-br from-orange/5 via-surface to-surface rounded-xl p-xl border border-orange/20 shadow-sm">
                <div className="flex items-start justify-between mb-lg">
                  <div>
                    <h3 className="font-display text-h3 text-text-primary mb-xs">Current Plan</h3>
                    <p className="text-small text-text-secondary">Professional Plan</p>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-[32px] text-text-primary">$97</div>
                    <div className="text-small text-text-secondary">per month</div>
                  </div>
                </div>

                <div className="space-y-sm mb-lg">
                  {[
                    "Unlimited financial data entries",
                    "AI-powered insights & analysis",
                    "What-if scenario planning",
                    "QuickBooks integration",
                    "Priority email support",
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Icon icon="ph:check-circle-fill" className="w-5 h-5 text-success flex-shrink-0" />
                      <span className="text-small text-text-primary">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-md">
                  <Button variant="secondary" size="sm">
                    <Icon icon="ph:credit-card-bold" className="w-4 h-4 mr-2" />
                    Update Payment Method
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Icon icon="ph:download-simple-bold" className="w-4 h-4 mr-2" />
                    Download Invoices
                  </Button>
                </div>
              </div>

              {/* Billing History */}
              <div className="bg-surface rounded-xl p-xl border border-background shadow-sm">
                <h3 className="font-display text-h3 text-text-primary mb-lg">Billing History</h3>
                <div className="text-center py-xl">
                  <Icon icon="ph:receipt-duotone" className="w-16 h-16 text-text-muted mx-auto mb-md" />
                  <p className="text-small text-text-secondary">
                    No billing history yet. Your first invoice will appear here.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === "account" && (
            <div className="space-y-md">
              {/* Security */}
              <div className="bg-surface rounded-xl p-xl border border-background shadow-sm">
                <h3 className="font-display text-h3 text-text-primary mb-lg">Security</h3>
                <div className="space-y-md">
                  <div className="flex items-center justify-between py-md border-b border-background">
                    <div>
                      <h4 className="font-body text-body font-medium text-text-primary mb-xs">Password</h4>
                      <p className="text-small text-text-secondary">Last changed 30 days ago</p>
                    </div>
                    <Button variant="secondary" size="sm">Change Password</Button>
                  </div>
                  <div className="flex items-center justify-between py-md">
                    <div>
                      <h4 className="font-body text-body font-medium text-text-primary mb-xs">
                        Two-Factor Authentication
                      </h4>
                      <p className="text-small text-text-secondary">Add an extra layer of security</p>
                    </div>
                    <Button variant="secondary" size="sm">Enable</Button>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-error/5 rounded-xl p-xl border border-error/20 shadow-sm">
                <h3 className="font-display text-h3 text-error mb-lg">Danger Zone</h3>
                <div className="space-y-lg">
                  <div>
                    <h4 className="font-body text-body font-medium text-text-primary mb-xs">
                      Delete Account
                    </h4>
                    <p className="text-small text-text-secondary mb-md">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <Button variant="secondary" size="sm" className="text-error border-error hover:bg-error/10">
                      <Icon icon="ph:warning-bold" className="w-4 h-4 mr-2" />
                      Delete Account
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
