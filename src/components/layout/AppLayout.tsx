"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useAuth } from "@/contexts/AuthContext";
import { PulseAssistant } from "@/components/PulseAssistant";
import { TrialBanner } from "@/components/TrialBanner";
import { DunningBanner } from "@/components/DunningBanner";
import { PaywallScreen } from "@/components/PaywallScreen";
import { BearOnboarding, hasCompletedOnboarding } from "@/components/BearOnboarding";
import { getUserAccessLevel } from "@/lib/feature-gate";

interface AppLayoutProps {
  children: ReactNode;
  pulseMessage?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "ph:gauge-bold" },
      { label: "Scenarios", href: "/scenarios", icon: "ph:calculator-bold" },
    ],
  },
  {
    title: "FINANCIALS",
    items: [
      { label: "P&L", href: "/reports/pl", icon: "ph:chart-line-up-bold" },
      { label: "Cash Flow", href: "/reports/cashflow", icon: "ph:currency-circle-dollar-bold" },
      { label: "Balance Sheet", href: "/reports/balance-sheet", icon: "ph:scales-bold" },
    ],
  },
  {
    title: "MANAGE",
    items: [
      { label: "Data", href: "/data", icon: "ph:database-bold" },
      { label: "Settings", href: "/settings", icon: "ph:gear-six-bold" },
    ],
  },
  {
    title: "HELP",
    items: [
      { label: "Glossary", href: "/glossary", icon: "ph:book-open-bold" },
    ],
  },
];

const adminNavSection: NavSection = {
  title: "ADMIN",
  items: [{ label: "Admin Panel", href: "/admin", icon: "ph:shield-check-bold" }],
};

const PULSE_MESSAGES: Record<string, string> = {
  "/reports/pl": "Honestly, this is my favorite page. It shows you exactly where your money went and what you kept. Let's take a look.",
  "/reports/cashflow": "This is all about the flow — money coming in, money going out. Don't worry, I'll help you make sense of it.",
  "/reports/balance-sheet": "Think of this as your financial selfie — what you own, what you owe, and what's actually yours. Let's see where you stand.",
  "/scenarios": "This is where it gets fun. Let's play some what-ifs so you can plan your next move without guessing.",
  "/data": "This is home base for your numbers. The more you give me here, the better I can help you everywhere else.",
};

const DEFAULT_PULSE_MESSAGE = "Hey, it's me. I'm keeping an eye on your numbers so you don't have to. Let me know if anything looks off.";

function getPulseMessage(pathname: string): string {
  for (const [path, msg] of Object.entries(PULSE_MESSAGES)) {
    if (pathname.startsWith(path)) return msg;
  }
  return DEFAULT_PULSE_MESSAGE;
}

export function AppLayout({ children, pulseMessage }: AppLayoutProps) {
  const pathname = usePathname();
  const _router = useRouter();
  const { user, subscription, loading: authLoading, signOut } = useAuth();
  const accessLevel = getUserAccessLevel(subscription);

  const [onboardingDone, setOnboardingDone] = useState(false);
  useEffect(() => {
    if (user?.id) setOnboardingDone(hasCompletedOnboarding(user.id));
  }, [user?.id]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Show the Admin section only for ADMIN_EMAILS users. Verified server-side
  // via the session token; cached per-session to avoid refetching on every page.
  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(false);
      return;
    }

    const cacheKey = `pp_is_admin_${user.id}`;
    const cached = typeof window !== "undefined" ? sessionStorage.getItem(cacheKey) : null;
    if (cached !== null) {
      setIsAdmin(cached === "true");
      return;
    }

    let cancelled = false;
    async function checkAdmin() {
      try {
        const { getInsForgeClient } = await import("@/lib/insforge");
        const client = getInsForgeClient();
        const { data } = await client.auth.getCurrentSession();
        if (!data?.session?.accessToken) return;

        const res = await fetch("/api/admin/check", {
          headers: { Authorization: `Bearer ${data.session.accessToken}` },
        });
        const result = await res.json();
        if (!cancelled) {
          const admin = result.isAdmin === true;
          setIsAdmin(admin);
          sessionStorage.setItem(cacheKey, String(admin));
        }
      } catch {
        // Non-admins simply don't see the link; no error surface needed
      }
    }
    checkAdmin();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const visibleNavSections = isAdmin ? [...navSections, adminNavSection] : navSections;

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "U";

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (userMenuOpen && !target.closest(".user-menu-container")) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  async function handleLogout() {
    await signOut();
  }

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={[
          "group flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-all duration-150 rounded-lg mx-2",
          active
            ? "bg-orange text-white shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-inset",
        ].join(" ")}
      >
        <Icon
          icon={item.icon}
          className={[
            "w-[18px] h-[18px] flex-shrink-0 transition-transform duration-150",
            active ? "text-white" : "text-text-muted group-hover:text-text-secondary"
          ].join(" ")}
        />
        <span>{item.label}</span>
      </Link>
    );
  };

  const renderNavSection = (section: NavSection) => (
    <div key={section.title} className="mb-5">
      <h3 className="px-5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {section.title}
      </h3>
      <nav className="flex flex-col gap-0.5">
        {section.items.map(renderNavItem)}
      </nav>
    </div>
  );

  const UserProfile = ({ onMobile = false }: { onMobile?: boolean }) => (
    <div className="relative user-menu-container">
      <button
        onClick={() => setUserMenuOpen(!userMenuOpen)}
        className="w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all duration-150 hover:bg-surface-inset group"
        aria-label="User menu"
        aria-expanded={userMenuOpen}
      >
        {user?.profile?.avatar_url ? (
          <Image
            src={user.profile.avatar_url}
            alt={user.name || "User"}
            width={36}
            height={36}
            className="w-9 h-9 rounded-lg object-cover ring-1 ring-border group-hover:ring-orange/30 transition-all"
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-orange flex items-center justify-center">
            <span className="text-[13px] font-semibold text-white">
              {userInitials}
            </span>
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          <p className="text-[13px] font-medium text-text-primary truncate leading-tight">
            {user?.name || "User"}
          </p>
          <p className="text-[11px] text-text-muted truncate leading-tight">{user?.email}</p>
        </div>
        <Icon
          icon="ph:caret-up-down"
          className="w-3.5 h-3.5 text-text-muted flex-shrink-0"
        />
      </button>

      {userMenuOpen && (
        <div
          className="absolute bottom-full left-0 right-0 mb-1.5 bg-white rounded-lg shadow-elevated border border-border overflow-hidden z-50"
          style={{ animation: "dropdownFadeUp 0.15s ease-out" }}
        >
          <div className="py-1">
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-secondary hover:text-text-primary hover:bg-surface-inset transition-colors"
              onClick={() => {
                setUserMenuOpen(false);
                if (onMobile) setMobileMenuOpen(false);
              }}
            >
              <Icon icon="ph:user-bold" className="w-4 h-4" />
              Profile
            </Link>
            <Link
              href="/billing"
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-secondary hover:text-text-primary hover:bg-surface-inset transition-colors"
              onClick={() => {
                setUserMenuOpen(false);
                if (onMobile) setMobileMenuOpen(false);
              }}
            >
              <Icon icon="ph:credit-card-bold" className="w-4 h-4" />
              Billing
            </Link>
          </div>

          <div className="border-t border-border-light py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-error hover:bg-error-subtle transition-colors"
            >
              <Icon icon="ph:sign-out-bold" className="w-4 h-4" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-[232px] bg-[#FCFBFE] border-r border-border z-40">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-border-light">
          <Link href="/dashboard" className="flex items-center group">
            <Image
              src="/logoupdated-transparent61926.png"
              alt="MyProfitPulse"
              width={900}
              height={200}
              className="w-[160px] h-auto transition-opacity duration-150 group-hover:opacity-80"
            />
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto pt-5 pb-2">
          {visibleNavSections.map(renderNavSection)}
        </div>

        {/* User Profile */}
        <div className="px-2.5 py-3 border-t border-border-light">
          <UserProfile />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="md:ml-[232px] min-h-screen flex flex-col">
        {/* Top Bar - Mobile only */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-border md:hidden">
          <div className="flex items-center justify-between h-14 px-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 -ml-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-inset transition-colors"
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                <Icon
                  icon={mobileMenuOpen ? "ph:x-bold" : "ph:list-bold"}
                  className="w-5 h-5"
                />
              </button>
              <Link href="/dashboard" className="flex items-center">
                <Image
                  src="/logoupdated-transparent61926.png"
                  alt="MyProfitPulse"
                  width={900}
                  height={200}
                  className="h-8 w-auto"
                />
              </Link>
            </div>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1"
            >
              {user?.profile?.avatar_url ? (
                <Image
                  src={user.profile.avatar_url}
                  alt={user.name || "User"}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-orange flex items-center justify-center">
                  <span className="text-xs font-semibold text-white">
                    {userInitials}
                  </span>
                </div>
              )}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Overlay */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm md:hidden z-40"
              style={{ animation: "fadeIn 0.15s ease-out" }}
              onClick={() => setMobileMenuOpen(false)}
            />

            <aside
              className="fixed top-0 left-0 bottom-0 w-[272px] bg-white shadow-overlay md:hidden z-50 overflow-y-auto flex flex-col"
              style={{ animation: "slideInLeft 0.2s ease-out" }}
            >
              <div className="flex items-center justify-between h-14 px-4 border-b border-border-light">
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Image
                    src="/logoupdated-transparent61926.png"
                    alt="MyProfitPulse"
                    width={900}
                    height={200}
                    className="h-8 w-auto"
                  />
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 -mr-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-inset transition-colors"
                >
                  <Icon icon="ph:x-bold" className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 pt-5 pb-2">
                {visibleNavSections.map((section) => (
                  <div key={section.title} className="mb-5">
                    <h3 className="px-5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                      {section.title}
                    </h3>
                    <nav className="flex flex-col gap-0.5">
                      {section.items.map((item) => {
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={[
                              "group flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-all duration-150 rounded-lg mx-2",
                              active
                                ? "bg-orange text-white shadow-sm"
                                : "text-text-secondary hover:text-text-primary hover:bg-surface-inset",
                            ].join(" ")}
                          >
                            <Icon icon={item.icon} className={`w-[18px] h-[18px] flex-shrink-0 ${active ? "text-white" : "text-text-muted"}`} />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </nav>
                  </div>
                ))}
              </div>

              <div className="px-2.5 py-3 border-t border-border-light">
                <UserProfile onMobile={true} />
              </div>
            </aside>
          </>
        )}

        {/* Banners */}
        <TrialBanner subscription={subscription} />
        <DunningBanner subscription={subscription} />

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          <div className="max-w-content mx-auto">
            {!authLoading && accessLevel === "locked" && user ? (
              <PaywallScreen />
            ) : (
              children
            )}
          </div>
        </main>
      </div>

      {/* Pulse Assistant */}
      {onboardingDone && (
        <PulseAssistant
          message={pulseMessage || getPulseMessage(pathname || "")}
          page={pathname || ""}
        />
      )}

      {/* Onboarding */}
      {user?.id && (
        <BearOnboarding
          userId={user.id}
          onComplete={() => setOnboardingDone(true)}
        />
      )}

      {/* Animations */}
      <style jsx>{`
        @keyframes dropdownFadeUp {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
