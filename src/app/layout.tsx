import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import RequireAuth from "@/components/RequireAuth";
import { ShellSidebar, ShellHeader, ShellFrame } from "@/components/ShellVisibility";
import HeaderUser from "@/components/HeaderUser";
import HeaderMessagesButton from "@/components/HeaderMessagesButton";
import HeaderNotificationsButton from "@/components/HeaderNotificationsButton";
import HeaderSearch from "@/components/HeaderSearch";
import { MessagesUnreadProvider } from "@/components/MessagesUnreadContext";
import { TasksNotificationsProvider } from "@/components/TasksNotificationsContext";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clinic CRM",
  description: "Medical CRM and ERP for clinics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${manrope.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef2ff,_#ffedd5_40%,_#fdf2ff_80%)] py-6">
          <MessagesUnreadProvider>
          <TasksNotificationsProvider>
          <ShellFrame>
          <div className="flex min-h-[80vh] flex-1 overflow-hidden">
            <input
              id="sidebar-toggle"
              type="checkbox"
              className="peer sr-only"
            />
            <ShellSidebar>
              <aside className="hidden w-60 bg-gradient-to-b from-white/95 via-slate-50/90 to-slate-100/80 px-3 py-4 transition-all duration-200 ease-out sm:flex sm:flex-col peer-checked:sm:w-0 peer-checked:sm:px-0 peer-checked:sm:opacity-0 peer-checked:sm:pointer-events-none app-shell-sidebar relative overflow-hidden">
              {/* Decorative gradient orb */}
              <div className="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full bg-gradient-to-br from-violet-200/40 to-sky-200/30 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br from-amber-200/30 to-orange-200/20 blur-2xl" />
              
              <div className="relative mb-5 flex justify-center px-2">
                <Image
                  src="/logos/projex-2.avif"
                  alt="Aliice logo"
                  width={120}
                  height={28}
                  className="h-8 w-auto"
                />
              </div>
              <nav className="relative mt-1 flex-1 space-y-1 text-sm">
                {/* Dashboard */}
                <Link
                  href="/"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-gradient-to-r hover:from-violet-50 hover:to-purple-50 hover:text-slate-900 hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 text-violet-600 shadow-sm transition-all group-hover:from-violet-500 group-hover:to-purple-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-violet-500/25">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 11.5 12 4l8 7.5" />
                      <path d="M5 10.5V20h4v-5h6v5h4v-9.5" />
                    </svg>
                  </span>
                  <span>Dashboard</span>
                </Link>

                {/* Companies */}
                <Link
                  href="/companies"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-gradient-to-r hover:from-sky-50 hover:to-cyan-50 hover:text-slate-900 hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-cyan-100 text-sky-600 shadow-sm transition-all group-hover:from-sky-500 group-hover:to-cyan-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-sky-500/25">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21h18" />
                      <path d="M5 21V7l8-4v18" />
                      <path d="M19 21V11l-6-4" />
                      <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
                    </svg>
                  </span>
                  <span>Companies</span>
                </Link>

                {/* Projects - NEW */}
                <Link
                  href="/projects"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 hover:text-slate-900 hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600 shadow-sm transition-all group-hover:from-emerald-500 group-hover:to-teal-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-emerald-500/25">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      <path d="M12 11v6" />
                      <path d="M9 14h6" />
                    </svg>
                  </span>
                  <span>Projects</span>
                </Link>

                {/* Calendar */}
                <Link
                  href="/appointments"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 hover:text-slate-900 hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600 shadow-sm transition-all group-hover:from-amber-500 group-hover:to-orange-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-amber-500/25">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M16 3v4M8 3v4M3 11h18" />
                    </svg>
                  </span>
                  <span>Calendar</span>
                </Link>

                {/* Deals & Pipeline */}
                <Link
                  href="/deals"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-gradient-to-r hover:from-rose-50 hover:to-pink-50 hover:text-slate-900 hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-pink-100 text-rose-600 shadow-sm transition-all group-hover:from-rose-500 group-hover:to-pink-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-rose-500/25">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h4v12H3zM10 10h4v8h-4zM17 8h4v10h-4z" />
                    </svg>
                  </span>
                  <span>Deals &amp; Pipeline</span>
                </Link>
                {/* Financials */}
                <Link
                  href="/financials"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 hover:text-slate-900 hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-600 shadow-sm transition-all group-hover:from-indigo-500 group-hover:to-blue-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-500/25">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="6" width="18" height="12" rx="2" />
                      <path d="M7 10h4M7 14h2" />
                    </svg>
                  </span>
                  <span>Financials</span>
                </Link>

                {/* Services */}
                <Link
                  href="/services"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-gradient-to-r hover:from-fuchsia-50 hover:to-pink-50 hover:text-slate-900 hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-100 to-pink-100 text-fuchsia-600 shadow-sm transition-all group-hover:from-fuchsia-500 group-hover:to-pink-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-fuchsia-500/25">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path d="M7 9h10M7 13h6M7 17h3" />
                    </svg>
                  </span>
                  <span>Services</span>
                </Link>

                {/* Tasks */}
                <Link
                  href="/tasks"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-gradient-to-r hover:from-lime-50 hover:to-green-50 hover:text-slate-900 hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-lime-100 to-green-100 text-lime-600 shadow-sm transition-all group-hover:from-lime-500 group-hover:to-green-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-lime-500/25">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </span>
                  <span>Tasks</span>
                </Link>

                {/* User Management */}
                <Link
                  href="/users"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-gradient-to-r hover:from-slate-100 hover:to-gray-100 hover:text-slate-900 hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-slate-200 to-gray-200 text-slate-600 shadow-sm transition-all group-hover:from-slate-600 group-hover:to-gray-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-slate-500/25">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </span>
                  <span>User Management</span>
                </Link>

                {/* Workflows */}
                <Link
                  href="/workflows"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-gradient-to-r hover:from-cyan-50 hover:to-teal-50 hover:text-slate-900 hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-teal-100 text-cyan-600 shadow-sm transition-all group-hover:from-cyan-500 group-hover:to-teal-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-cyan-500/25">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </span>
                  <span>Workflows</span>
                </Link>

                {/* Chat with Colton */}
                <Link
                  href="/chat"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-gradient-to-r hover:from-violet-50 hover:to-indigo-50 hover:text-slate-900 hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-600 shadow-sm transition-all group-hover:from-violet-500 group-hover:to-indigo-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-violet-500/25">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      <path d="M8 10h.01" />
                      <path d="M12 10h.01" />
                      <path d="M16 10h.01" />
                    </svg>
                  </span>
                  <span>Chat with Colton</span>
                </Link>
              </nav>
            </aside>
            </ShellSidebar>
            <main className="flex-1 min-w-0 bg-slate-50/40">
              <RequireAuth>
                <div className="flex h-full flex-col">
                  <ShellHeader>
                    <header className="flex items-center justify-between gap-4 bg-gradient-to-b from-slate-50/90 to-slate-50/40 px-4 py-3 sm:px-6 lg:px-8 app-shell-header">
                      <div className="flex items-center gap-4 shrink-0">
                        <label
                          htmlFor="sidebar-toggle"
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-500 shadow-sm hover:bg-slate-50 sm:h-9 sm:w-9"
                        >
                          <span className="sr-only">Toggle sidebar</span>
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M4 6h16M4 12h10M4 18h16" />
                          </svg>
                        </label>
                        <div className="flex items-center gap-3">
                          <Link
                            href="/"
                            aria-label="Go to dashboard"
                            className="inline-flex items-center"
                          >
                            <Image
                              src="/logos/mutant-logo.avif"
                              alt="Maison Tōa logo"
                              width={76}
                              height={28}
                              className="h-7 w-auto"
                            />
                          </Link>
                        </div>
                      </div>
                      <div className="hidden flex-1 justify-center md:flex">
                        <div className="w-full max-w-xl">
                          <HeaderSearch />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 shrink-0">
                        <HeaderNotificationsButton />
                        <HeaderMessagesButton />
                        <HeaderUser />
                      </div>
                    </header>
                  </ShellHeader>
                  <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8">{children}</div>
                </div>
              </RequireAuth>
            </main>
          </div>
          </ShellFrame>
          </TasksNotificationsProvider>
          </MessagesUnreadProvider>
        </div>
      </body>
    </html>
  );
}
