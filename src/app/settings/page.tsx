"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/contexts/AuthContext";
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

interface QbTestResult {
  success: boolean;
  realmId?: string;
  error?: string;
  report?: {
    header?: {
      ReportName?: string;
      StartPeriod?: string;
      EndPeriod?: string;
    };
    rowCount?: number;
  };
}

function SettingsContent() {
  const { user, refreshUser } = useRequireAuth();
  const { subscription, refreshUser: refreshAuth } = useAuth();
  const { showToast } = useToast();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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

  // QuickBooks connection state — disabled (coming soon)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qbConnected, setQbConnected] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qbConnectedAt, setQbConnectedAt] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qbLastSync, setQbLastSync] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qbLoading, setQbLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qbDisconnecting, setQbDisconnecting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qbTestResult, setQbTestResult] = useState<QbTestResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Profile photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function ensureProfileRow() {
    if (!user?.id) return;
    const { getInsForgeClient } = await import("@/lib/insforge");
    const client = getInsForgeClient();
    const { data } = await client.database
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) {
      await client.database
        .from("profiles")
        .insert({ user_id: user.id });
    }
  }

  async function handlePhotoUpload(file: File) {
    if (!user?.id) return;
    if (!file.type.startsWith("image/")) {
      showToast("error", "Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast("error", "Image must be under 2 MB");
      return;
    }

    setUploadingPhoto(true);
    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}.${ext}`;

      // Upload to InsForge storage
      const { data: uploadData, error: uploadError } = await client.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError || !uploadData) throw uploadError || new Error("Upload failed");

      // Set locally — saved to DB when user clicks "Save Changes"
      const avatarUrl = uploadData.url + `?t=${Date.now()}`;
      setProfileData((prev) => ({ ...prev, avatar_url: avatarUrl }));
      showToast("success", "Photo uploaded — click Save Changes to apply");
    } catch (error) {
      console.error("Photo upload error:", error);
      showToast("error", "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState({
    weekly_summary: true,
    product_updates: true,
  });
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Load saved notification preferences
  useEffect(() => {
    async function loadPrefs() {
      const headers = await getAuthHeaders();
      if (!headers) return;
      try {
        const res = await fetch("/api/notifications/preferences", { headers });
        if (res.ok) {
          const data = await res.json();
          setEmailNotifications({
            weekly_summary: data.weekly_summary ?? true,
            product_updates: data.product_updates ?? true,
          });
        }
      } catch {
        // Use defaults
      }
    }
    loadPrefs();
  }, [getAuthHeaders]);

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    } catch (_err) {
      showToast("error", "Failed to test QuickBooks connection");
    } finally {
      setQbTesting(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

      await ensureProfileRow();

      // Update profile in InsForge
      const { error } = await client.database
        .from("profiles")
        .update({
          name: profileData.name,
          avatar_url: profileData.avatar_url,
        })
        .eq("user_id", user?.id);

      if (error) throw error;

      await refreshUser();
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

      await ensureProfileRow();

      const { error } = await client.database
        .from("profiles")
        .update({
          business_name: businessData.business_name,
          industry: businessData.industry,
        })
        .eq("user_id", user?.id);

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
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handlePhotoUpload(file);
                      }}
                      className="hidden"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                    >
                      <Icon icon="ph:upload-simple-bold" className="w-4 h-4 mr-2" />
                      {uploadingPhoto ? "Uploading..." : "Upload Photo"}
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
              {/* QuickBooks Integration - Coming Soon */}
              <div className="bg-surface rounded-xl p-xl border border-background shadow-sm opacity-70">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-md flex-1">
                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <img
                        src="/quickbooks.png"
                        alt="QuickBooks"
                        className="w-8 h-8 object-contain grayscale"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-xs">
                        <h3 className="font-display text-h3 text-text-primary">QuickBooks</h3>
                        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-orange/10 rounded-full text-xs font-semibold text-orange">
                          Coming Soon
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Integration Requests */}
              <div className="bg-surface/50 rounded-xl p-xl border border-dashed border-background">
                <div className="flex items-center gap-md mb-md">
                  <Icon icon="ph:chat-circle-dots-duotone" className="w-6 h-6 text-orange" />
                  <h3 className="font-display text-h3 text-text-primary">Want to see more integrations?</h3>
                </div>
                <p className="text-small text-text-secondary mb-lg">
                  Tell us which platforms and business tools you&apos;d like to connect with ProfitPulse.
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
                  <Button
                    variant="primary"
                    disabled={savingNotifications}
                    onClick={async () => {
                      setSavingNotifications(true);
                      try {
                        const headers = await getAuthHeaders();
                        if (!headers) {
                          showToast("error", "Please log in to save preferences");
                          return;
                        }
                        const res = await fetch("/api/notifications/preferences", {
                          method: "POST",
                          headers: { ...headers, "Content-Type": "application/json" },
                          body: JSON.stringify(emailNotifications),
                        });
                        if (!res.ok) throw new Error("Failed to save");
                        showToast("success", "Notification preferences saved!");
                      } catch {
                        showToast("error", "Failed to save preferences");
                      } finally {
                        setSavingNotifications(false);
                      }
                    }}
                  >
                    {savingNotifications ? "Saving..." : "Save Preferences"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === "billing" && (
            <div id="billing" className="space-y-md">
              {/* Current Plan */}
              <div className="bg-gradient-to-br from-orange/5 via-surface to-surface rounded-xl p-xl border border-orange/20 shadow-sm">
                {(() => {
                  const status = subscription?.subscription_status ?? "none";
                  const interval = subscription?.billing_interval;
                  const periodEnd = subscription?.current_period_end
                    ? new Date(subscription.current_period_end).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : null;

                  const priceLabel =
                    interval === "annual" ? "$49.99" : "$59.99";
                  const priceSub = interval === "annual" ? "/month (annual)" : "/month";

                  return (
                    <>
                      <div className="flex items-start justify-between mb-lg">
                        <div>
                          <h3 className="font-display text-h3 text-text-primary mb-xs">
                            Current Plan
                          </h3>
                          <p className="text-small text-text-secondary">
                            {status === "trial" && "Free Trial"}
                            {status === "active" && `ProfitPulse Pro — ${interval ?? ""}`}
                            {status === "canceled" && `Canceled — access until ${periodEnd}`}
                            {status === "past_due" && "Payment past due"}
                            {(status === "terminated" || status === "expired") &&
                              "Subscription ended"}
                            {status === "none" && "No active plan"}
                          </p>
                        </div>
                        {status === "active" && (
                          <div className="text-right">
                            <div className="font-display text-[32px] text-text-primary">
                              {priceLabel}
                            </div>
                            <div className="text-small text-text-secondary">{priceSub}</div>
                          </div>
                        )}
                      </div>

                      {status === "active" && periodEnd && (
                        <p className="text-small text-text-secondary mb-md">
                          Next billing date: <strong>{periodEnd}</strong>
                        </p>
                      )}

                      <div className="flex flex-wrap gap-md">
                        {status === "active" && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setShowCancelModal(true)}
                            >
                              <Icon icon="ph:x-circle-bold" className="w-4 h-4 mr-2" />
                              Cancel Subscription
                            </Button>
                          </>
                        )}
                        {(status === "trial" ||
                          status === "canceled" ||
                          status === "terminated" ||
                          status === "expired" ||
                          status === "none") && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => (window.location.href = "/pricing")}
                          >
                            <Icon icon="ph:arrow-up-right-bold" className="w-4 h-4 mr-2" />
                            {status === "canceled" || status === "terminated" || status === "expired"
                              ? "Resubscribe"
                              : "Upgrade to Pro"}
                          </Button>
                        )}
                      </div>
                    </>
                  );
                })()}
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

          {/* Cancel confirmation modal */}
          {showCancelModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-md">
              <div className="max-w-md w-full bg-surface rounded-xl shadow-elevated border border-[#E5E0DA] p-xl">
                <div className="flex items-center gap-sm mb-md">
                  <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                    <Icon icon="lucide:alert-triangle" className="text-error" width={20} height={20} />
                  </div>
                  <h3 className="font-display text-h3 text-text-primary">Cancel subscription?</h3>
                </div>
                <p className="text-body text-text-secondary mb-lg">
                  You&apos;ll keep Pro access until{" "}
                  <strong className="text-text-primary">
                    {subscription?.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "the end of your current billing period"}
                  </strong>
                  , then your plan will end. You can resubscribe at any time.
                </p>
                <div className="flex gap-sm justify-end">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setShowCancelModal(false)}
                    disabled={cancelling}
                  >
                    Keep subscription
                  </Button>
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={async () => {
                      if (!user?.id) return;
                      setCancelling(true);
                      try {
                        const res = await fetch("/api/payments/cancel", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userId: user.id }),
                        });
                        const json = await res.json();
                        if (!res.ok || json.error) {
                          showToast("error", json.error ?? "Failed to cancel subscription");
                          setCancelling(false);
                          return;
                        }
                        showToast("success", "Subscription canceled");
                        await refreshAuth();
                        setShowCancelModal(false);
                      } catch {
                        showToast("error", "Failed to cancel subscription");
                      } finally {
                        setCancelling(false);
                      }
                    }}
                    className="px-6 py-3 rounded-md bg-error text-white text-body font-medium hover:bg-[#B91C1C] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {cancelling ? "Canceling..." : "Yes, cancel"}
                  </button>
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

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
