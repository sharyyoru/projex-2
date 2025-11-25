"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

interface TaskStats {
  finishedToday: number;
  pending: number;
  inProgress: number;
  overdue: number;
}

export default function DashboardOverview() {
  const [userId, setUserId] = useState<string | null>(null);
  const [quote, setQuote] = useState<string>("");
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [taskStats, setTaskStats] = useState<TaskStats>({
    finishedToday: 0,
    pending: 0,
    inProgress: 0,
    overdue: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");

  // Get user info
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        setUserId(user.id);
        const meta = (user.user_metadata || {}) as Record<string, unknown>;
        const firstName = (meta["first_name"] as string) || "";
        const lastName = (meta["last_name"] as string) || "";
        setUserName([firstName, lastName].filter(Boolean).join(" ") || user.email || "");
      }
    }
    loadUser();
  }, []);

  // Fetch daily quote
  useEffect(() => {
    if (!userId) return;

    async function fetchQuote() {
      try {
        const response = await fetch(`/api/ai/daily-quote?userId=${userId}`);
        const data = await response.json();
        setQuote(data.quote || "Every day is a new opportunity to grow and excel!");
      } catch (error) {
        setQuote("Every day is a new opportunity to grow and excel!");
      } finally {
        setQuoteLoading(false);
      }
    }

    fetchQuote();
  }, [userId]);

  // Fetch task stats
  useEffect(() => {
    if (!userId) return;

    async function fetchStats() {
      try {
        const response = await fetch(`/api/tasks/stats?userId=${userId}`);
        const data = await response.json();
        if (data.stats) {
          setTaskStats(data.stats);
        }
      } catch (error) {
        console.error("Error fetching task stats:", error);
      } finally {
        setStatsLoading(false);
      }
    }

    fetchStats();
  }, [userId]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6">
      {/* Greeting Card */}
      <div className="rounded-2xl border border-white/50 bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 p-6 text-white shadow-xl shadow-violet-500/20">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {getGreeting()}, {userName.split(" ")[0] || "there"}!
            </h2>
            <p className="text-sm text-white/80">
              {new Date().toLocaleDateString("en-AE", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* AI Daily Quote */}
      <div className="rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-5 shadow-lg shadow-amber-500/5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-lg shadow-amber-400/30">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900">Daily Motivation</h3>
            {quoteLoading ? (
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-amber-200/50" />
            ) : (
              <p className="mt-1 text-sm italic text-amber-800">&ldquo;{quote}&rdquo;</p>
            )}
          </div>
        </div>
      </div>

      {/* Task Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Finished Today */}
        <div className="rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-green-50 p-5 shadow-lg shadow-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg shadow-emerald-400/30">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600">Finished Today</p>
              {statsLoading ? (
                <div className="mt-1 h-8 w-10 animate-pulse rounded bg-emerald-200/50" />
              ) : (
                <p className="text-2xl font-bold text-emerald-700">{taskStats.finishedToday}</p>
              )}
            </div>
          </div>
        </div>

        {/* Pending */}
        <div className="rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-lg shadow-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-lg shadow-amber-400/30">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-amber-600">Pending</p>
              {statsLoading ? (
                <div className="mt-1 h-8 w-10 animate-pulse rounded bg-amber-200/50" />
              ) : (
                <p className="text-2xl font-bold text-amber-700">{taskStats.pending}</p>
              )}
            </div>
          </div>
        </div>

        {/* In Progress */}
        <div className="rounded-2xl border border-sky-200/50 bg-gradient-to-br from-sky-50 to-blue-50 p-5 shadow-lg shadow-sky-500/5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg shadow-sky-400/30">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4" />
                <path d="m16.2 7.8 2.9-2.9" />
                <path d="M18 12h4" />
                <path d="m16.2 16.2 2.9 2.9" />
                <path d="M12 18v4" />
                <path d="m4.9 19.1 2.9-2.9" />
                <path d="M2 12h4" />
                <path d="m4.9 4.9 2.9 2.9" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-sky-600">In Progress</p>
              {statsLoading ? (
                <div className="mt-1 h-8 w-10 animate-pulse rounded bg-sky-200/50" />
              ) : (
                <p className="text-2xl font-bold text-sky-700">{taskStats.inProgress}</p>
              )}
            </div>
          </div>
        </div>

        {/* Overdue */}
        <div className="rounded-2xl border border-red-200/50 bg-gradient-to-br from-red-50 to-rose-50 p-5 shadow-lg shadow-red-500/5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-400 to-rose-500 text-white shadow-lg shadow-red-400/30">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-red-600">Overdue</p>
              {statsLoading ? (
                <div className="mt-1 h-8 w-10 animate-pulse rounded bg-red-200/50" />
              ) : (
                <p className="text-2xl font-bold text-red-700">{taskStats.overdue}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-lg backdrop-blur">
        <h3 className="text-sm font-semibold text-slate-900">Quick Actions</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <a
            href="/tasks"
            className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:border-violet-200 hover:bg-violet-50 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600 transition-colors group-hover:bg-violet-500 group-hover:text-white">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">View Tasks</p>
              <p className="text-xs text-slate-500">Manage your assigned work</p>
            </div>
          </a>

          <a
            href="/appointments"
            className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:border-sky-200 hover:bg-sky-50 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600 transition-colors group-hover:bg-sky-500 group-hover:text-white">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Calendar</p>
              <p className="text-xs text-slate-500">Check your schedule</p>
            </div>
          </a>

          <a
            href="/chat"
            className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">AI Assistant</p>
              <p className="text-xs text-slate-500">Chat with Colton</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
