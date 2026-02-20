"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Scenarios", href: "/scenarios" },
  { label: "Data", href: "/data" },
  { label: "Settings", href: "/settings" },
];

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Get user initials for placeholder avatar
  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "U";

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close menus on outside click
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
    // signOut already redirects to /login
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-[#F0EDE8] shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center group">
              <Image
                src="/full-logo.png"
                alt="ProfitPulse"
                width={900}
                height={200}
                className="h-[150px] md:h-[190px] w-auto transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "relative px-4 py-2 font-body text-body font-medium transition-colors duration-200",
                      isActive
                        ? "text-orange"
                        : "text-text-secondary hover:text-text-primary",
                    ].join(" ")}
                  >
                    {item.label}
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange rounded-t-full"
                        style={{ animation: "slideIn 0.3s ease-out" }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* User Menu & Mobile Menu Button */}
            <div className="flex items-center gap-3">
              {/* User Avatar Dropdown */}
              <div className="relative user-menu-container">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-3 p-1.5 rounded-lg transition-all duration-200 hover:bg-background group"
                  aria-label="User menu"
                  aria-expanded={userMenuOpen}
                >
                  {user?.profile?.avatar_url ? (
                    <Image
                      src={user.profile.avatar_url}
                      alt={user.name || "User"}
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-full object-cover shadow-md group-hover:shadow-lg transition-shadow"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-orange/10 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                      <span className="text-sm font-semibold text-orange">
                        {userInitials}
                      </span>
                    </div>
                  )}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={[
                      "hidden sm:block text-text-muted transition-transform duration-200",
                      userMenuOpen ? "rotate-180" : "",
                    ].join(" ")}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {/* User Dropdown */}
                {userMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-64 bg-surface rounded-lg shadow-xl border border-[#F0EDE8] overflow-hidden"
                    style={{ animation: "dropdownFadeIn 0.2s ease-out" }}
                  >
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-[#F0EDE8] bg-background/30">
                      <p className="text-body font-medium text-text-primary truncate">
                        {user?.name || "User"}
                      </p>
                      <p className="text-small text-text-muted truncate">{user?.email}</p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Link
                        href="/settings"
                        className="flex items-center gap-3 px-4 py-2.5 text-body text-text-secondary hover:text-text-primary hover:bg-background/50 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        Profile
                      </Link>
                      <Link
                        href="/settings#billing"
                        className="flex items-center gap-3 px-4 py-2.5 text-body text-text-secondary hover:text-text-primary hover:bg-background/50 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="20" height="14" x="2" y="5" rx="2" />
                          <path d="M2 10h20" />
                        </svg>
                        Billing
                      </Link>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-[#F0EDE8] py-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-body text-error hover:bg-error/5 transition-colors"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" x2="9" y1="12" y2="12" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {mobileMenuOpen ? (
                    <>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </>
                  ) : (
                    <>
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="4" y1="18" x2="20" y2="18" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Slide-out */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-[#2D2A26]/40 backdrop-blur-sm md:hidden"
              style={{ animation: "fadeIn 0.2s ease-out" }}
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Slide-out Menu */}
            <div
              className="fixed top-16 right-0 bottom-0 w-72 bg-surface shadow-2xl md:hidden overflow-y-auto"
              style={{ animation: "slideInRight 0.3s ease-out" }}
            >
              <div className="py-4">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "flex items-center justify-between px-6 py-3.5 font-body text-body font-medium transition-colors",
                        isActive
                          ? "text-orange bg-orange/5 border-l-4 border-orange"
                          : "text-text-secondary hover:text-text-primary hover:bg-background/50",
                      ].join(" ")}
                    >
                      {item.label}
                      {isActive && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* Animations */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: scaleX(0);
            opacity: 0;
          }
          to {
            transform: scaleX(1);
            opacity: 1;
          }
        }

        @keyframes dropdownFadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
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

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
