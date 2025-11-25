"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { useMessagesUnread } from "@/components/MessagesUnreadContext";
import DubaiInfoPill from "@/components/DubaiInfoPill";
import TaskDetailModal from "@/components/TaskDetailModal";


export default function Home() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  const { unreadCount } = useMessagesUnread();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const { data: authData } = await supabaseClient.auth.getUser();
        const user = authData?.user ?? null;

        if (!cancelled) {
          if (user) {
            const meta = (user.user_metadata || {}) as Record<string, unknown>;
            const first = (meta["first_name"] as string) || "";
            const full = first || user.email?.split("@")[0] || null;
            setCurrentUserName(full);
          } else {
            setCurrentUserName(null);
          }
        }

        const today = new Date();
        const dayStart = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          0,
          0,
          0,
          0,
        ).toISOString();
        const dayEnd = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59,
          999,
        ).toISOString();

        const appointmentsPromise = supabaseClient
          .from("appointments")
          .select(
            "id, start_time, status, reason, patient:patients(id, first_name, last_name)",
          )
          .neq("status", "cancelled")
          .gte("start_time", dayStart)
          .lte("start_time", dayEnd)
          .order("start_time", { ascending: true })
          .limit(3);

        const tasksPromise = user
          ? supabaseClient
              .from("tasks")
              .select(
                "id, name, content, activity_date, created_at, patient:patients(id, first_name, last_name)",
              )
              .eq("assigned_user_id", user.id)
              .neq("status", "completed")
              .order("activity_date", { ascending: true })
              .limit(3)
          : Promise.resolve({ data: [], error: null } as any);

        const [appointmentsResult, tasksResult] =
          await Promise.all([appointmentsPromise, tasksPromise]);

        if (cancelled) return;

        setAppointments(
          !appointmentsResult.error && appointmentsResult.data
            ? (appointmentsResult.data as any[])
            : [],
        );

        setTasks(
          !tasksResult.error && tasksResult.data ? (tasksResult.data as any[]) : [],
        );
      } catch {
        if (cancelled) return;
        setAppointments([]);
        setTasks([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <DubaiInfoPill />
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 truncate">
            {currentUserName ? `Hi ${currentUserName}` : "Hi there"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Let&apos;s get you on a productive routine today!
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs sm:text-sm shrink-0">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-sky-200/70 bg-white/70 px-3 sm:px-4 py-2 sm:py-1.5 font-medium text-sky-700 shadow-[0_10px_25px_rgba(15,23,42,0.16)] backdrop-blur hover:bg-white hover:text-sky-800 btn-pill-primary"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[12px] font-semibold text-white shadow-sm">
              +
            </span>
            <span>New Project</span>
          </Link>
          <Link
            href="/appointments"
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200/80 bg-white/60 px-3 sm:px-4 py-2 sm:py-1.5 font-medium text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.10)] backdrop-blur hover:bg-white hover:text-slate-900 btn-pill-secondary"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/80 text-[11px] text-white shadow-sm">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4M8 3v4M3 11h18" />
              </svg>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="font-extrabold text-[13px] leading-none">+</span>
              <span>Meeting</span>
            </span>
          </Link>
        </div>
      </header>

      <section className="space-y-4">
        <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Today&apos;s meetings
              </h2>
              <p className="text-xs text-slate-500">
                Quick view of your upcoming meetings and calls.
              </p>
            </div>
            <Link
              href="/appointments"
              className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              View all
            </Link>
          </div>
          {loading ? (
            <p className="text-xs text-slate-500">
              Loading today&apos;s meetings...
            </p>
          ) : appointments.length === 0 ? (
            <p className="text-xs text-slate-500">
              No meetings scheduled for today.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 text-sm">
              {appointments.map((appt) => {
                const start = appt.start_time ? new Date(appt.start_time as string) : null;
                const timeLabel =
                  start && !Number.isNaN(start.getTime())
                    ? start.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
                const patientName = appt.patient
                  ? `${appt.patient.first_name ?? ""} ${
                      appt.patient.last_name ?? ""
                    }`
                      .trim()
                      .replace(/\s+/g, " ")
                  : "Unknown patient";
                const rawService = (appt.reason as string | null) ?? null;
                const service = rawService
                  ? (rawService.split("[")[0] || "Appointment").trim()
                  : "Appointment";

                let badgeLabel = "Scheduled";
                let badgeClasses =
                  "rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700";
                if (appt.status === "confirmed") {
                  badgeLabel = "Confirmed";
                  badgeClasses =
                    "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700";
                } else if (appt.status === "completed") {
                  badgeLabel = "Completed";
                  badgeClasses =
                    "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700";
                }

                return (
                  <div
                    key={appt.id as string}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <p className="font-medium text-slate-800">
                        {timeLabel} · {service || "Appointment"}
                      </p>
                      <p className="text-xs text-slate-500">{patientName}</p>
                    </div>
                    <span className={badgeClasses}>{badgeLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Tasks</h2>
              <p className="text-xs text-slate-500">
                Your most important follow-ups and admin items.
              </p>
            </div>
            <Link
              href="/tasks"
              className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              View all tasks
            </Link>
          </div>
          {loading ? (
            <p className="text-xs text-slate-500">Loading your tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="text-xs text-slate-500">
              No open tasks assigned to you.
            </p>
          ) : (
            <div className="space-y-2 text-sm">
              {tasks.map((task) => {
                const patient = task.patient;
                const patientName = patient
                  ? `${patient.first_name ?? ""} ${patient.last_name ?? ""}`
                      .trim()
                      .replace(/\s+/g, " ")
                  : null;

                const rawDate =
                  (task.activity_date as string | null) ?? (task.created_at as string);
                let badgeLabel = "Pending";
                let badgeClasses =
                  "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700";
                if (rawDate) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const d = new Date(rawDate);
                  if (!Number.isNaN(d.getTime())) {
                    const taskDate = new Date(
                      d.getFullYear(),
                      d.getMonth(),
                      d.getDate(),
                    );
                    const diffMs = taskDate.getTime() - today.getTime();
                    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                    if (diffDays === 0) {
                      badgeLabel = "Today";
                      badgeClasses =
                        "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700";
                    } else if (diffDays < 0) {
                      badgeLabel = "Overdue";
                      badgeClasses =
                        "rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700";
                    } else if (diffDays <= 7) {
                      badgeLabel = "This week";
                      badgeClasses =
                        "rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700";
                    }
                  }
                }

                return (
                  <button
                    key={task.id as string}
                    type="button"
                    onClick={() => setSelectedTaskId(task.id as string)}
                    className="flex w-full items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-left hover:bg-slate-100"
                  >
                    <div>
                      <p className="font-medium text-slate-800">
                        {task.name as string}
                      </p>
                      <p className="text-xs text-slate-500">
                        {task.content
                          ? (task.content as string)
                          : patientName || "Task"}
                      </p>
                    </div>
                    <span className={badgeClasses}>{badgeLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </section>

      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
