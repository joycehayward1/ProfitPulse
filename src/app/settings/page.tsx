"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button as _Button } from "@/components/ui/Button";
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

function BillingHistory({ userId }: { userId?: string }) {
  const [records, setRecords] = useState<Array<{
    id: string;
    amount: string;
    status: string;
    billing_interval: string;
    created_at: string;
    description?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      if (!userId) return;
      try {
        const { getInsForgeClient } = await import("@/lib/insforge");
        const client = getInsForgeClient();
        const { data } = await client.database
          .from("payment_records")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);
        setRecords(data || []);
      } catch (e) {
        console.error("Failed to load billing history:", e);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [userId]);

  return (
    <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
      <h3 className="text-[16px] font-semibold text-[#111111] mb-1">Billing History</h3>
      <p className="text-[13px] text-[#8B8B8B] mb-4">Your past invoices and payments</p>

      {loading ? (
        <div className="h-20 bg-[#F4F4F5] rounded-lg animate-pulse" />
      ) : records.length === 0 ? (
        <div className="text-center py-10">
          <Icon icon="ph:receipt-duotone" className="w-12 h-12 text-[#E4E4E7] mx-auto mb-3" />
          <p className="text-[13px] text-[#8B8B8B]">
            No billing history yet. Your first invoice will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#F0F0F2]">
                <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-2.5">Date</th>
                <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-2.5">Description</th>
                <th className="text-right text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-2.5">Amount</th>
                <th className="text-right text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-[#F0F0F2] last:border-b-0">
                  <td className="py-3 text-[#4B4B4B]">
                    {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="py-3 text-[#4B4B4B]">
                    ProfitPulse Pro — {r.billing_interval}
                  </td>
                  <td className="py-3 text-right font-semibold text-[#111111]">
                    ${parseFloat(r.amount).toFixed(2)}
                  </td>
                  <td className="py-3 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      r.status === "success" ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#FEF2F2] text-[#DC2626]"
                    }`}>
                      {r.status === "success" ? "Paid" : r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettingsContent() {
  const { user, refreshUser } = useRequireAuth();
  const { subscription, refreshUser: refreshAuth, signOut } = useAuth();
  const { showToast } = useToast();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [switchingPlan, setSwitchingPlan] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordStep, setPasswordStep] = useState<"idle" | "code" | "newpass" | "done">("idle");
  const [resetCode, setResetCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
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
  const router = useRouter();
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

      // Check if email changed
      const emailChanged = profileData.email !== user?.email && profileData.email.trim() !== "";
      if (emailChanged) {
        const res = await fetch("/api/auth/change-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user?.id, newEmail: profileData.email.trim() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update email");
        }
      }

      // Update profile in InsForge
      const { error } = await client.database
        .from("profiles")
        .update({
          name: profileData.name,
          avatar_url: profileData.avatar_url,
        })
        .eq("user_id", user?.id);

      if (error) throw error;

      if (emailChanged) {
        showToast("success", "Email updated! Please log in again with your new email.");
        await signOut();
        router.push("/login");
        return;
      }

      await refreshUser();
      showToast("success", "Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      showToast("error", error instanceof Error ? error.message : "Failed to update profile");
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
      <div className="max-w-4xl mx-auto space-y-8 px-4 py-8">
        {/* Header */}
        <div>
          <h1 className="text-[28px] font-bold text-[#111111] tracking-tight">
            Settings
          </h1>
          <p className="text-[14px] text-[#8B8B8B] mt-1">
            Manage your profile, business, and account preferences
          </p>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-[#E4E4E7] overflow-x-auto">
          <nav className="flex gap-0 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-[#E65100] text-[#111111]"
                    : "border-transparent text-[#8B8B8B] hover:text-[#4B4B4B]"
                }`}
              >
                <Icon icon={tab.icon} className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
                {/* Avatar Section */}
                <div className="flex items-start gap-6 mb-6">
                  <div className="flex-shrink-0">
                    {profileData.avatar_url ? (
                      <img
                        src={profileData.avatar_url}
                        alt={profileData.name}
                        className="w-20 h-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl border-2 border-dashed border-[#E4E4E7] bg-[#F4F4F5] flex items-center justify-center hover:border-[#E65100] hover:bg-[#FFF7F2] transition-colors">
                        <Icon icon="ph:user-bold" className="w-8 h-8 text-[#8B8B8B]" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[16px] font-semibold text-[#111111] mb-1">Profile Photo</h3>
                    <p className="text-[13px] text-[#8B8B8B] mb-3">
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
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E4E4E7] text-[13px] font-medium text-[#4B4B4B] hover:border-[#E65100] hover:text-[#E65100] transition-colors disabled:opacity-50"
                    >
                      <Icon icon="ph:upload-simple-bold" className="w-4 h-4" />
                      {uploadingPhoto ? "Uploading..." : "Upload Photo"}
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-[#F0F0F2] pt-6 mt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[13px] font-medium text-[#111111] mb-1.5 block">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-[#E4E4E7] bg-white text-[14px] text-[#111111] focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 focus:outline-none transition-colors"
                        placeholder="Your name"
                      />
                    </div>

                    <div>
                      <label className="text-[13px] font-medium text-[#111111] mb-1.5 block">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-[#E4E4E7] bg-white text-[14px] text-[#111111] focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 focus:outline-none transition-colors"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="bg-[#E65100] text-white rounded-lg px-6 py-2.5 text-[14px] font-medium hover:bg-[#D84900] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Business Tab */}
          {activeTab === "business" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
                <h3 className="text-[16px] font-semibold text-[#111111] mb-1">Business Information</h3>
                <p className="text-[13px] text-[#8B8B8B] mb-4">
                  Update your business details to personalize your dashboard
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[13px] font-medium text-[#111111] mb-1.5 block">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={businessData.business_name}
                      onChange={(e) => setBusinessData({ ...businessData, business_name: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E4E4E7] bg-white text-[14px] text-[#111111] focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 focus:outline-none transition-colors"
                      placeholder="Acme Corporation"
                    />
                  </div>

                  <div>
                    <label className="text-[13px] font-medium text-[#111111] mb-1.5 block">
                      Industry
                    </label>
                    <select
                      value={businessData.industry}
                      onChange={(e) => setBusinessData({ ...businessData, industry: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E4E4E7] bg-white text-[14px] text-[#111111] focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 focus:outline-none transition-colors"
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
                </div>

                <div className="mt-6">
                  <button
                    onClick={handleSaveBusiness}
                    disabled={isSaving}
                    className="bg-[#E65100] text-white rounded-lg px-6 py-2.5 text-[14px] font-medium hover:bg-[#D84900] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Integrations Tab */}
          {activeTab === "integrations" && (
            <div className="space-y-6">
              {/* QuickBooks Integration - Coming Soon */}
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6 opacity-70">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-[#F4F4F5] flex items-center justify-center flex-shrink-0">
                      <img
                        src="/quickbooks.png"
                        alt="QuickBooks"
                        className="w-7 h-7 object-contain grayscale"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-[16px] font-semibold text-[#111111]">QuickBooks</h3>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#E65100]/10 rounded-full text-[12px] font-semibold text-[#E65100]">
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-[13px] text-[#8B8B8B]">
                        Connect your QuickBooks account to automatically sync financial data
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Integration Requests */}
              <div className="bg-[#F8F8F8] rounded-xl border border-dashed border-[#E4E4E7] p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Icon icon="ph:chat-circle-dots-duotone" className="w-5 h-5 text-[#E65100]" />
                  <h3 className="text-[16px] font-semibold text-[#111111]">Want to see more integrations?</h3>
                </div>
                <p className="text-[13px] text-[#8B8B8B] mb-4">
                  Tell us which platforms and business tools you&apos;d like to connect with ProfitPulse.
                </p>
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E4E4E7] text-[13px] font-medium text-[#4B4B4B] hover:border-[#E65100] hover:text-[#E65100] transition-colors">
                  <Icon icon="ph:paper-plane-tilt-bold" className="w-4 h-4" />
                  Request an Integration
                </button>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
              <h3 className="text-[16px] font-semibold text-[#111111] mb-1">Email Notifications</h3>
              <p className="text-[13px] text-[#8B8B8B] mb-4">
                Choose which emails you want to receive
              </p>

              <div className="space-y-0">
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
                ].map((notification, idx) => (
                  <div
                    key={notification.id}
                    className={`flex items-start justify-between gap-4 py-4 ${
                      idx > 0 ? "border-t border-[#F0F0F2]" : ""
                    }`}
                  >
                    <div className="flex-1">
                      <h4 className="text-[14px] font-medium text-[#111111] mb-0.5">
                        {notification.title}
                      </h4>
                      <p className="text-[13px] text-[#8B8B8B]">{notification.description}</p>
                    </div>
                    <button
                      onClick={() =>
                        setEmailNotifications({
                          ...emailNotifications,
                          [notification.id]: !emailNotifications[notification.id as keyof typeof emailNotifications],
                        })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                        emailNotifications[notification.id as keyof typeof emailNotifications]
                          ? "bg-[#E65100]"
                          : "bg-[#E4E4E7]"
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

                <div className="border-t border-[#F0F0F2] pt-6 mt-2">
                  <button
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
                    className="bg-[#E65100] text-white rounded-lg px-6 py-2.5 text-[14px] font-medium hover:bg-[#D84900] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingNotifications ? "Saving..." : "Save Preferences"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === "billing" && (
            <div id="billing" className="space-y-6">
              {/* Current Plan */}
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
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
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-[16px] font-semibold text-[#111111] mb-1">
                            Current Plan
                          </h3>
                          <p className="text-[13px] text-[#8B8B8B]">
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
                            <div className="text-[28px] font-bold text-[#111111]">
                              {priceLabel}
                            </div>
                            <div className="text-[13px] text-[#8B8B8B]">{priceSub}</div>
                          </div>
                        )}
                      </div>

                      {status === "active" && periodEnd && (
                        <p className="text-[13px] text-[#8B8B8B] mb-4">
                          Next billing date: <strong className="text-[#111111]">{periodEnd}</strong>
                        </p>
                      )}

                      <div className="flex flex-wrap gap-3">
                        {status === "active" && interval === "monthly" && (
                          <button
                            onClick={async () => {
                              if (!user || switchingPlan) return;
                              setSwitchingPlan(true);
                              try {
                                const res = await fetch("/api/payments/switch-plan", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ userId: user.id, target: "annual" }),
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || "Switch failed");
                                showToast("success", "Switched to annual plan — you're saving $120/year!");
                                window.location.reload();
                              } catch (err) {
                                showToast("error", err instanceof Error ? err.message : "Failed to switch plan");
                              } finally {
                                setSwitchingPlan(false);
                              }
                            }}
                            disabled={switchingPlan}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E65100] text-white text-[13px] font-medium hover:bg-[#D84900] disabled:opacity-50 transition-colors"
                          >
                            <Icon icon="ph:arrows-clockwise-bold" className="w-4 h-4" />
                            {switchingPlan ? "Switching..." : "Switch to Annual (Save $120/yr)"}
                          </button>
                        )}
                        {status === "active" && interval === "annual" && (
                          <button
                            onClick={async () => {
                              if (!user || switchingPlan) return;
                              setSwitchingPlan(true);
                              try {
                                const res = await fetch("/api/payments/switch-plan", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ userId: user.id, target: "monthly" }),
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || "Switch failed");
                                showToast("success", "Switched to monthly billing");
                                window.location.reload();
                              } catch (err) {
                                showToast("error", err instanceof Error ? err.message : "Failed to switch plan");
                              } finally {
                                setSwitchingPlan(false);
                              }
                            }}
                            disabled={switchingPlan}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E4E4E7] text-[13px] font-medium text-[#4B4B4B] hover:border-[#111111] disabled:opacity-50 transition-colors"
                          >
                            <Icon icon="ph:arrows-clockwise-bold" className="w-4 h-4" />
                            {switchingPlan ? "Switching..." : "Switch to Monthly"}
                          </button>
                        )}
                        {status === "active" && (
                          <button
                            onClick={() => setShowCancelModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E4E4E7] text-[13px] font-medium text-[#4B4B4B] hover:border-[#DC2626] hover:text-[#DC2626] transition-colors"
                          >
                            <Icon icon="ph:x-circle-bold" className="w-4 h-4" />
                            Cancel Subscription
                          </button>
                        )}
                        {(status === "trial" ||
                          status === "canceled" ||
                          status === "terminated" ||
                          status === "expired" ||
                          status === "none") && (
                          <button
                            onClick={() => router.push("/pricing")}
                            className="bg-[#E65100] text-white rounded-lg px-6 py-2.5 text-[14px] font-medium hover:bg-[#D84900] transition-colors inline-flex items-center gap-2"
                          >
                            <Icon icon="ph:arrow-up-right-bold" className="w-4 h-4" />
                            {status === "canceled" || status === "terminated" || status === "expired"
                              ? "Resubscribe"
                              : "Upgrade to Pro"}
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Billing History */}
              <BillingHistory userId={user?.id} />
            </div>
          )}

          {/* Cancel confirmation modal */}
          {showCancelModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
              <div className="max-w-md w-full bg-white rounded-xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.2)] border border-[#F0F0F2] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#DC2626]/10 flex items-center justify-center">
                    <Icon icon="lucide:alert-triangle" className="text-[#DC2626]" width={20} height={20} />
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#111111]">Cancel subscription?</h3>
                </div>
                <p className="text-[14px] text-[#4B4B4B] mb-6">
                  You&apos;ll keep Pro access until{" "}
                  <strong className="text-[#111111]">
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
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    disabled={cancelling}
                    className="px-4 py-2.5 rounded-lg border border-[#E4E4E7] text-[14px] font-medium text-[#4B4B4B] hover:bg-[#F4F4F5] transition-colors disabled:opacity-50"
                  >
                    Keep subscription
                  </button>
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
                    className="px-4 py-2.5 rounded-lg bg-[#DC2626] text-white text-[14px] font-medium hover:bg-[#B91C1C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelling ? "Canceling..." : "Yes, cancel"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === "account" && (
            <div className="space-y-6">
              {/* Security */}
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
                <h3 className="text-[16px] font-semibold text-[#111111] mb-1">Security</h3>
                <p className="text-[13px] text-[#8B8B8B] mb-4">Manage your account security settings</p>

                <div className="space-y-0">
                  {passwordStep === "idle" && (
                    <div className="flex items-center justify-between py-4 border-b border-[#F0F0F2]">
                      <div>
                        <h4 className="text-[14px] font-medium text-[#111111] mb-0.5">Password</h4>
                        <p className="text-[13px] text-[#8B8B8B]">Change your account password</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!user?.email || savingPassword) return;
                          setSavingPassword(true);
                          setPasswordError("");
                          try {
                            const res = await fetch("/api/auth/change-password", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ email: user.email }),
                            });
                            if (!res.ok) throw new Error("Failed");
                            setPasswordStep("code");
                            showToast("success", "Check your email for a 6-digit code");
                          } catch {
                            showToast("error", "Failed to send reset code. Try again.");
                          } finally {
                            setSavingPassword(false);
                          }
                        }}
                        disabled={savingPassword}
                        className="px-4 py-2 rounded-lg border border-[#E4E4E7] text-[13px] font-medium text-[#4B4B4B] hover:border-[#E65100] hover:text-[#E65100] disabled:opacity-50 transition-colors"
                      >
                        {savingPassword ? "Sending..." : "Change Password"}
                      </button>
                    </div>
                  )}

                  {passwordStep === "code" && (
                    <div className="py-4 border-b border-[#F0F0F2] space-y-4">
                      <h4 className="text-[14px] font-medium text-[#111111]">Enter the 6-digit code from your email</h4>
                      <input
                        type="text"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        className="w-48 h-12 px-4 rounded-lg border border-[#E4E4E7] bg-white text-[20px] text-center tracking-[0.3em] text-[#111111] placeholder:text-[#E4E4E7] focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 focus:outline-none transition-colors"
                      />
                      {passwordError && <p className="text-[13px] text-[#DC2626]">{passwordError}</p>}
                      <div className="flex gap-3">
                        <button
                          onClick={async () => {
                            if (resetCode.length !== 6 || !user?.email) return;
                            setSavingPassword(true);
                            setPasswordError("");
                            try {
                              const { getInsForgeClient } = await import("@/lib/insforge");
                              const client = getInsForgeClient();
                              const { data, error } = await client.auth.exchangeResetPasswordToken({
                                email: user.email,
                                code: resetCode,
                              });
                              if (error || !data?.token) throw new Error(error?.message || "Invalid code");
                              setResetToken(data.token);
                              setPasswordStep("newpass");
                            } catch (err) {
                              setPasswordError(err instanceof Error ? err.message : "Invalid code. Try again.");
                            } finally {
                              setSavingPassword(false);
                            }
                          }}
                          disabled={savingPassword || resetCode.length !== 6}
                          className="bg-[#E65100] text-white rounded-lg px-5 py-2 text-[13px] font-medium hover:bg-[#D84900] disabled:opacity-50 transition-colors"
                        >
                          {savingPassword ? "Verifying..." : "Verify Code"}
                        </button>
                        <button
                          onClick={() => { setPasswordStep("idle"); setResetCode(""); setPasswordError(""); }}
                          className="px-5 py-2 rounded-lg border border-[#E4E4E7] text-[13px] font-medium text-[#4B4B4B] hover:border-[#111111] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {passwordStep === "newpass" && (
                    <div className="py-4 border-b border-[#F0F0F2] space-y-4">
                      <h4 className="text-[14px] font-medium text-[#111111]">Set your new password</h4>
                      <div>
                        <label className="text-[13px] font-medium text-[#111111] mb-1.5 block">New Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          className="w-full sm:w-80 h-10 px-3 rounded-lg border border-[#E4E4E7] bg-white text-[14px] text-[#111111] placeholder:text-[#8B8B8B] focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[13px] font-medium text-[#111111] mb-1.5 block">Confirm Password</label>
                        <input
                          type="password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="Type it again"
                          className="w-full sm:w-80 h-10 px-3 rounded-lg border border-[#E4E4E7] bg-white text-[14px] text-[#111111] placeholder:text-[#8B8B8B] focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 focus:outline-none transition-colors"
                        />
                      </div>
                      {passwordError && <p className="text-[13px] text-[#DC2626]">{passwordError}</p>}
                      <div className="flex gap-3">
                        <button
                          onClick={async () => {
                            setPasswordError("");
                            if (newPassword.length < 8) { setPasswordError("At least 8 characters"); return; }
                            if (newPassword !== confirmNewPassword) { setPasswordError("Passwords don't match"); return; }
                            setSavingPassword(true);
                            try {
                              const { getInsForgeClient } = await import("@/lib/insforge");
                              const client = getInsForgeClient();
                              const { error } = await client.auth.resetPassword({
                                newPassword,
                                otp: resetToken,
                              });
                              if (error) throw new Error(error.message || "Failed to reset password");
                              showToast("success", "Password changed successfully");
                              setPasswordStep("done");
                              setNewPassword("");
                              setConfirmNewPassword("");
                              setResetCode("");
                              setResetToken("");
                            } catch (err) {
                              setPasswordError(err instanceof Error ? err.message : "Failed to change password");
                            } finally {
                              setSavingPassword(false);
                            }
                          }}
                          disabled={savingPassword}
                          className="bg-[#E65100] text-white rounded-lg px-5 py-2 text-[13px] font-medium hover:bg-[#D84900] disabled:opacity-50 transition-colors"
                        >
                          {savingPassword ? "Saving..." : "Update Password"}
                        </button>
                        <button
                          onClick={() => { setPasswordStep("idle"); setNewPassword(""); setConfirmNewPassword(""); setPasswordError(""); }}
                          className="px-5 py-2 rounded-lg border border-[#E4E4E7] text-[13px] font-medium text-[#4B4B4B] hover:border-[#111111] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {passwordStep === "done" && (
                    <div className="flex items-center justify-between py-4 border-b border-[#F0F0F2]">
                      <div>
                        <h4 className="text-[14px] font-medium text-[#111111] mb-0.5">Password</h4>
                        <p className="text-[13px] text-[#16A34A]">Password updated successfully</p>
                      </div>
                      <button
                        onClick={() => setPasswordStep("idle")}
                        className="px-4 py-2 rounded-lg border border-[#16A34A] text-[13px] font-medium text-[#16A34A]"
                      >
                        Done ✓
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-[#FEF2F2] rounded-xl border border-[#DC2626]/20 p-6">
                <h3 className="text-[16px] font-semibold text-[#DC2626] mb-1">Danger Zone</h3>
                <p className="text-[13px] text-[#8B8B8B] mb-4">Irreversible and destructive actions</p>

                <div>
                  <h4 className="text-[14px] font-medium text-[#111111] mb-0.5">
                    Delete Account
                  </h4>
                  <p className="text-[13px] text-[#8B8B8B] mb-4">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#DC2626] text-[14px] font-medium text-[#DC2626] hover:bg-[#DC2626] hover:text-white transition-colors"
                  >
                    <Icon icon="ph:warning-bold" className="w-4 h-4" />
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Account Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
              <div className="max-w-md w-full bg-white rounded-xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.2)] border border-[#F0F0F2] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#DC2626]/10 flex items-center justify-center">
                    <Icon icon="ph:warning-bold" className="text-[#DC2626]" width={20} height={20} />
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#111111]">Delete your account?</h3>
                </div>
                <p className="text-[14px] text-[#4B4B4B] mb-4">
                  This will permanently delete your account, all financial data, assessments, and settings. This cannot be undone.
                </p>
                <p className="text-[13px] text-[#8B8B8B] mb-2">
                  Type <strong className="text-[#DC2626]">DELETE</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full h-10 px-3 rounded-lg border border-[#E4E4E7] bg-white text-[14px] text-[#111111] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 focus:outline-none transition-colors mb-6"
                />
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(""); }}
                    disabled={deleting}
                    className="px-4 py-2.5 rounded-lg border border-[#E4E4E7] text-[14px] font-medium text-[#4B4B4B] hover:bg-[#F4F4F5] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={deleteConfirmText !== "DELETE" || deleting}
                    onClick={async () => {
                      if (!user?.id) return;
                      setDeleting(true);
                      try {
                        const authHeaders = await getAuthHeaders();
                        if (!authHeaders) {
                          throw new Error("Session expired — please sign in again");
                        }
                        const res = await fetch("/api/auth/delete-account", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...authHeaders },
                          body: JSON.stringify({ userId: user.id }),
                        });
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          throw new Error(data.error || "Failed to delete account");
                        }
                        await signOut();
                        router.push("/");
                      } catch (err) {
                        showToast("error", err instanceof Error ? err.message : "Failed to delete account");
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    className="px-4 py-2.5 rounded-lg bg-[#DC2626] text-white text-[14px] font-medium hover:bg-[#B91C1C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? "Deleting..." : "Delete Account"}
                  </button>
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
