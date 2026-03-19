"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: ReactNode;
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
    title: "SETTINGS",
    items: [
      { label: "Data", href: "/data", icon: "ph:database-bold" },
      { label: "Settings", href: "/settings", icon: "ph:gear-six-bold" },
    ],
  },
];

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
          "group flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium transition-all duration-200 rounded-xl mx-2",
          active
            ? "bg-gradient-to-r from-orange to-orange-light text-white shadow-glow-orange"
            : "text-text-secondary hover:text-text-primary hover:bg-black/[0.04]",
        ].join(" ")}
      >
        <Icon
          icon={item.icon}
          className={[
            "w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200",
            active ? "" : "group-hover:scale-110"
          ].join(" ")}
        />
        <span>{item.label}</span>
      </Link>
    );
  };

  const renderNavSection = (section: NavSection) => (
    <div key={section.title} className="mb-6">
      <h3 className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted/70">
        {section.title}
      </h3>
      <nav className="flex flex-col gap-1">
        {section.items.map(renderNavItem)}
      </nav>
    </div>
  );

  const UserProfile = ({ onMobile = false }: { onMobile?: boolean }) => (
    <div className="relative user-menu-container">
      <button
        onClick={() => setUserMenuOpen(!userMenuOpen)}
        className="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-black/[0.04] group"
        aria-label="User menu"
        aria-expanded={userMenuOpen}
      >
        {user?.profile?.avatar_url ? (
          <Image
            src={user.profile.avatar_url}
            alt={user.name || "User"}
            width={40}
            height={40}
            className="w-10 h-10 rounded-xl object-cover ring-2 ring-border-light group-hover:ring-orange/30 transition-all"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange to-orange-light flex items-center justify-center shadow-soft">
            <span className="text-sm font-semibold text-white">
              {userInitials}
            </span>
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          <p className="text-[13px] font-medium text-text-primary truncate">
            {user?.name || "User"}
          </p>
          <p className="text-[11px] text-text-muted truncate">{user?.email}</p>
        </div>
        <Icon
          icon="ph:caret-up-down-bold"
          className="w-4 h-4 text-text-muted flex-shrink-0"
        />
      </button>

      {userMenuOpen && (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-elevated border border-border-light overflow-hidden"
          style={{ animation: "dropdownFadeUp 0.2s ease-out" }}
        >
          <div className="py-1.5">
            <Link
              href="/settings"
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-text-secondary hover:text-text-primary hover:bg-black/[0.04] transition-colors"
              onClick={() => {
                setUserMenuOpen(false);
                if (onMobile) setMobileMenuOpen(false);
              }}
            >
              <Icon icon="ph:user-bold" className="w-[18px] h-[18px]" />
              Profile
            </Link>
            <Link
              href="/settings#billing"
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-text-secondary hover:text-text-primary hover:bg-black/[0.04] transition-colors"
              onClick={() => {
                setUserMenuOpen(false);
                if (onMobile) setMobileMenuOpen(false);
              }}
            >
              <Icon icon="ph:credit-card-bold" className="w-[18px] h-[18px]" />
              Billing
            </Link>
          </div>

          <div className="border-t border-border-light py-1.5">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-error hover:bg-error/5 transition-colors"
            >
              <Icon icon="ph:sign-out-bold" className="w-[18px] h-[18px]" />
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
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-[240px] bg-white border-r border-border z-40">
        {/* Logo */}
        <div className="mt-5 h-20 overflow-hidden flex items-center justify-center">
          <Link href="/dashboard" className="flex items-center group">
            <Image
              src="/full-logo.png"
              alt="ProfitPulse"
              width={900}
              height={200}
              className="w-[200px] scale-[1.05] transition-all duration-300 group-hover:scale-[1.07]"
            />
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          {navSections.map(renderNavSection)}
        </div>

        {/* User Profile - Bottom of Sidebar */}
        <div className="p-3 border-t border-border">
          <UserProfile />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="md:ml-[240px] min-h-screen flex flex-col">
        {/* Top Bar - Mobile only */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-border md:hidden">
          <div className="flex items-center justify-between h-14 px-4">
            {/* Mobile Logo & Hamburger */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 -ml-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-black/[0.04] transition-colors"
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
                  src="/full-logo.png"
                  alt="ProfitPulse"
                  width={900}
                  height={200}
                  className="h-10 w-auto"
                />
              </Link>
            </div>

            {/* Mobile User Avatar */}
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
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange to-orange-light flex items-center justify-center">
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
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm md:hidden z-40"
              style={{ animation: "fadeIn 0.2s ease-out" }}
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Slide-out Sidebar */}
            <aside
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-white shadow-elevated md:hidden z-50 overflow-y-auto flex flex-col"
              style={{ animation: "slideInLeft 0.25s ease-out" }}
            >
              {/* Logo */}
              <div className="flex items-center justify-between h-14 px-4 border-b border-border">
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Image
                    src="/full-logo.png"
                    alt="ProfitPulse"
                    width={900}
                    height={200}
                    className="h-10 w-auto"
                  />
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 -mr-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-black/[0.04] transition-colors"
                >
                  <Icon icon="ph:x-bold" className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation */}
              <div className="flex-1 py-4">
                {navSections.map((section) => (
                  <div key={section.title} className="mb-6">
                    <h3 className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted/70">
                      {section.title}
                    </h3>
                    <nav className="flex flex-col gap-1">
                      {section.items.map((item) => {
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={[
                              "group flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium transition-all duration-200 rounded-xl mx-2",
                              active
                                ? "bg-gradient-to-r from-orange to-orange-light text-white shadow-glow-orange"
                                : "text-text-secondary hover:text-text-primary hover:bg-black/[0.04]",
                            ].join(" ")}
                          >
                            <Icon icon={item.icon} className="w-[18px] h-[18px] flex-shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </nav>
                  </div>
                ))}
              </div>

              {/* User Profile - Bottom */}
              <div className="p-3 border-t border-border">
                <UserProfile onMobile={true} />
              </div>
            </aside>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes dropdownFadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
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
