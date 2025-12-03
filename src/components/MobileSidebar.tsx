"use client";

import { useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M5 10.5V20h4v-5h6v5h4v-9.5" />
      </svg>
    ),
    gradient: "from-violet-100 to-purple-100",
    iconColor: "text-violet-600",
    hoverGradient: "hover:from-violet-50 hover:to-purple-50",
    activeGradient: "from-violet-500 to-purple-500",
  },
  {
    href: "/companies",
    label: "Companies",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
        <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
      </svg>
    ),
    gradient: "from-sky-100 to-cyan-100",
    iconColor: "text-sky-600",
    hoverGradient: "hover:from-sky-50 hover:to-cyan-50",
    activeGradient: "from-sky-500 to-cyan-500",
  },
  {
    href: "/projects",
    label: "Projects",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <path d="M12 11v6" />
        <path d="M9 14h6" />
      </svg>
    ),
    gradient: "from-emerald-100 to-teal-100",
    iconColor: "text-emerald-600",
    hoverGradient: "hover:from-emerald-50 hover:to-teal-50",
    activeGradient: "from-emerald-500 to-teal-500",
  },
  {
    href: "/social-media",
    label: "Social Media",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
    gradient: "from-pink-100 to-fuchsia-100",
    iconColor: "text-pink-600",
    hoverGradient: "hover:from-pink-50 hover:to-fuchsia-50",
    activeGradient: "from-pink-500 to-fuchsia-500",
  },
  {
    href: "/appointments",
    label: "Calendar",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </svg>
    ),
    gradient: "from-amber-100 to-orange-100",
    iconColor: "text-amber-600",
    hoverGradient: "hover:from-amber-50 hover:to-orange-50",
    activeGradient: "from-amber-500 to-orange-500",
  },
  {
    href: "/financials",
    label: "Financials",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M7 10h4M7 14h2" />
      </svg>
    ),
    gradient: "from-indigo-100 to-blue-100",
    iconColor: "text-indigo-600",
    hoverGradient: "hover:from-indigo-50 hover:to-blue-50",
    activeGradient: "from-indigo-500 to-blue-500",
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    gradient: "from-lime-100 to-green-100",
    iconColor: "text-lime-600",
    hoverGradient: "hover:from-lime-50 hover:to-green-50",
    activeGradient: "from-lime-500 to-green-500",
  },
  {
    href: "/users",
    label: "User Management",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    gradient: "from-slate-200 to-gray-200",
    iconColor: "text-slate-600",
    hoverGradient: "hover:from-slate-100 hover:to-gray-100",
    activeGradient: "from-slate-600 to-gray-600",
  },
  {
    href: "/chat",
    label: "Chat with Colton",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 10h.01" />
        <path d="M12 10h.01" />
        <path d="M16 10h.01" />
      </svg>
    ),
    gradient: "from-violet-100 to-indigo-100",
    iconColor: "text-violet-600",
    hoverGradient: "hover:from-violet-50 hover:to-indigo-50",
    activeGradient: "from-violet-500 to-indigo-500",
  },
  {
    href: "/danote",
    label: "Danote",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    gradient: "from-cyan-100 to-teal-100",
    iconColor: "text-cyan-600",
    hoverGradient: "hover:from-cyan-50 hover:to-teal-50",
    activeGradient: "from-cyan-500 to-teal-500",
  },
  {
    href: "/dischat",
    label: "Dischat",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        <path d="M8 12h.01" />
        <path d="M12 12h.01" />
        <path d="M16 12h.01" />
      </svg>
    ),
    gradient: "from-indigo-100 to-violet-100",
    iconColor: "text-indigo-600",
    hoverGradient: "hover:from-indigo-50 hover:to-violet-50",
    activeGradient: "from-indigo-500 to-violet-500",
  },
];

export default function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const pathname = usePathname();

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when sidebar is open
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Close sidebar on route change
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] sm:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <div
        className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-gradient-to-b from-white/98 via-slate-50/95 to-slate-100/90 shadow-2xl animate-slide-in-left safe-area-inset-left"
        style={{
          paddingLeft: "env(safe-area-inset-left)",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Decorative gradient orbs */}
        <div className="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full bg-gradient-to-br from-violet-200/40 to-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br from-amber-200/30 to-orange-200/20 blur-2xl" />

        {/* Header with logo and close button */}
        <div className="relative flex items-center justify-between px-4 py-4 border-b border-slate-200/50">
          <Image
            src="/logos/projex-2.avif"
            alt="Projex logo"
            width={100}
            height={24}
            className="h-7 w-auto"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 active:scale-95"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium transition-all active:scale-[0.98] ${
                  isActive
                    ? "bg-gradient-to-r from-slate-100 to-slate-50 text-slate-900 shadow-sm"
                    : `text-slate-600 ${item.hoverGradient} hover:text-slate-900`
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-all ${
                    isActive
                      ? `bg-gradient-to-br ${item.activeGradient} text-white shadow-lg`
                      : `bg-gradient-to-br ${item.gradient} ${item.iconColor}`
                  }`}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
