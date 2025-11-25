"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { useTasksNotifications } from "@/components/TasksNotificationsContext";

type NotificationPatient = {
  id: string;
  first_name: string;
  last_name: string;
};

type NotificationProject = {
  id: string;
  name: string;
};

type NotificationTask = {
  id: string;
  patient_id: string | null;
  project_id: string | null;
  name: string;
  content: string | null;
  status: "not_started" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  type: "todo" | "call" | "email" | "other";
  activity_date: string | null;
  created_at: string;
  assigned_read_at: string | null;
  created_by_name: string | null;
  source: "operations" | "admin" | null;
};

type TaskNotificationRow = {
  id: string;
  task: NotificationTask | null;
  patient: NotificationPatient | null;
  project: NotificationProject | null;
};

type FilterStatus = "all" | "unread" | "read";
type FilterState = "all" | "open" | "completed";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const [rows, setRows] = useState<TaskNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatingTaskIds, setUpdatingTaskIds] = useState<string[]>([]);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterState, setFilterState] = useState<FilterState>("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { refreshOpenTasksCount, setOpenTasksCountOptimistic } = useTasksNotifications();

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      try {
        setLoading(true);
        setError(null);

        const { data: authData } = await supabaseClient.auth.getUser();
        const user = authData?.user;

        if (!user) {
          if (!isMounted) return;
          setError("You must be logged in to view notifications.");
          setRows([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabaseClient
          .from("tasks")
          .select(
            "id, patient_id, project_id, name, content, status, priority, type, activity_date, assigned_read_at, created_at, created_by_name, source, patient:patients(id, first_name, last_name), project:projects(id, name)"
          )
          .eq("assigned_user_id", user.id)
          .order("created_at", { ascending: false });

        if (!isMounted) return;

        if (error || !data) {
          setError(error?.message ?? "Failed to load notifications.");
          setRows([]);
          setLoading(false);
          return;
        }

        const mapped: TaskNotificationRow[] = (data as any[]).map((row) => ({
          id: row.id as string,
          task: {
            id: row.id as string,
            patient_id: row.patient_id ?? null,
            project_id: row.project_id ?? null,
            name: row.name ?? "Untitled task",
            content: row.content ?? null,
            status: row.status as NotificationTask["status"],
            priority: row.priority as NotificationTask["priority"],
            type: row.type as NotificationTask["type"],
            activity_date: row.activity_date ?? null,
            created_at: row.created_at as string,
            assigned_read_at: row.assigned_read_at ?? null,
            created_by_name: row.created_by_name ?? null,
            source: row.source ?? null,
          },
          patient: row.patient ? {
            id: row.patient.id,
            first_name: row.patient.first_name ?? "",
            last_name: row.patient.last_name ?? "",
          } : null,
          project: row.project ? {
            id: row.project.id,
            name: row.project.name ?? "",
          } : null,
        }));

        setRows(mapped);
        setLoading(false);
      } catch {
        if (!isMounted) return;
        setError("Failed to load notifications.");
        setRows([]);
        setLoading(false);
      }
    }

    void loadNotifications();

    return () => { isMounted = false; };
  }, [refreshKey]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const task = row.task;
      if (!task) return false;
      
      const isRead = !!task.assigned_read_at;
      if (filterStatus === "unread" && isRead) return false;
      if (filterStatus === "read" && !isRead) return false;
      
      const isCompleted = task.status === "completed";
      if (filterState === "open" && isCompleted) return false;
      if (filterState === "completed" && !isCompleted) return false;
      
      return true;
    });
  }, [rows, filterStatus, filterState]);

  const unreadCount = rows.filter((r) => r.task && !r.task.assigned_read_at).length;
  const openCount = rows.filter((r) => r.task && r.task.status !== "completed").length;

  async function handleMarkNotificationRead(row: TaskNotificationRow) {
    const task = row.task;
    if (!task || task.assigned_read_at) return;

    const nowIso = new Date().toISOString();
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id && r.task && !r.task.assigned_read_at
          ? { ...r, task: { ...r.task, assigned_read_at: nowIso } }
          : r
      )
    );
    setOpenTasksCountOptimistic((prev) => Math.max(0, prev - 1));

    try {
      await supabaseClient.from("tasks").update({ assigned_read_at: nowIso }).eq("id", task.id);
    } catch {}
  }

  async function handleMarkAllRead() {
    const unreadTaskIds = rows
      .filter((row) => row.task && !row.task.assigned_read_at)
      .map((row) => row.task!.id);

    if (unreadTaskIds.length === 0) return;

    try {
      setMarkingAllRead(true);
      const nowIso = new Date().toISOString();

      const { error } = await supabaseClient
        .from("tasks")
        .update({ assigned_read_at: nowIso })
        .in("id", unreadTaskIds);

      if (error) {
        setMarkingAllRead(false);
        return;
      }

      setRows((prev) =>
        prev.map((row) =>
          row.task && !row.task.assigned_read_at && unreadTaskIds.includes(row.task.id)
            ? { ...row, task: { ...row.task, assigned_read_at: nowIso } }
            : row
        )
      );
      setOpenTasksCountOptimistic(() => 0);
      setToastMessage("All notifications marked as read.");
    } catch {} finally {
      setMarkingAllRead(false);
    }
  }

  async function handleMarkTaskCompleted(row: TaskNotificationRow, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    const task = row.task;
    if (!task || task.status === "completed") return;

    try {
      setUpdatingTaskIds((prev) => [...prev, task.id]);
      const nowIso = new Date().toISOString();

      const { data, error } = await supabaseClient
        .from("tasks")
        .update({
          status: "completed",
          updated_at: nowIso,
          assigned_read_at: task.assigned_read_at ?? nowIso,
        })
        .eq("id", task.id)
        .select("id, status, assigned_read_at")
        .single();

      if (error || !data) {
        setUpdatingTaskIds((prev) => prev.filter((id) => id !== task.id));
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id && r.task
            ? { ...r, task: { ...r.task, status: "completed" as const, assigned_read_at: data.assigned_read_at ?? nowIso } }
            : r
        )
      );

      if (!task.assigned_read_at) {
        setOpenTasksCountOptimistic((prev) => Math.max(0, prev - 1));
      }
      setToastMessage("Task marked as complete!");
    } catch {} finally {
      setUpdatingTaskIds((prev) => prev.filter((id) => id !== task.id));
    }
  }

  useEffect(() => {
    if (!toastMessage) return;
    const id = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(id);
  }, [toastMessage]);

  function getTaskHref(row: TaskNotificationRow): string {
    const mode = row.task?.source || "operations";
    if (row.project) {
      const tab = mode === "admin" ? "cockpit" : "tasks";
      return `/projects/${row.project.id}?mode=${mode}&tab=${tab}`;
    }
    if (row.patient) return `/patients/${row.patient.id}?mode=crm&tab=tasks`;
    return "#";
  }

  const hasActiveFilters = filterStatus !== "all" || filterState !== "all";

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-6 text-white shadow-2xl">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Notifications</h1>
              <p className="text-sm text-white/80">
                {unreadCount > 0 ? (
                  <span className="font-semibold">{unreadCount} unread • {openCount} open task{openCount !== 1 ? "s" : ""}</span>
                ) : (
                  "All tasks reviewed! 🎉"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRefreshKey((prev) => prev + 1);
                refreshOpenTasksCount().catch(() => {});
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2.5 text-[12px] font-semibold backdrop-blur-sm transition-all hover:bg-white/30 disabled:opacity-60"
            >
              <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                disabled={markingAllRead}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[12px] font-semibold text-orange-700 shadow-lg transition-all hover:bg-white/90 disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                Mark all read
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(["all", "unread", "read"] as FilterStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  filterStatus === s ? "bg-orange-500 text-white shadow-sm" : "text-slate-600 hover:bg-white"
                }`}
              >
                {s === "all" ? "All" : s === "unread" ? "Unread" : "Read"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">State</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(["all", "open", "completed"] as FilterState[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterState(s)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  filterState === s ? "bg-orange-500 text-white shadow-sm" : "text-slate-600 hover:bg-white"
                }`}
              >
                {s === "all" ? "All" : s === "open" ? "Open" : "Done"}
              </button>
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => { setFilterStatus("all"); setFilterState("all"); }}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-100"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}

        <div className="ml-auto text-[11px] font-medium text-slate-400">
          {filteredRows.length} task{filteredRows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Tasks List */}
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
            <p className="mt-4 text-sm font-medium text-slate-500">Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6M9 9l6 6" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 text-orange-400">
              <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </div>
            <p className="mt-4 text-base font-semibold text-slate-700">
              {hasActiveFilters ? "No tasks match your filters" : "No task notifications"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {hasActiveFilters ? "Try adjusting your filters" : "Tasks assigned to you will appear here"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRows.map((row) => {
              const task = row.task!;
              const isUnread = !task.assigned_read_at;
              const isCompleted = task.status === "completed";
              const isUpdating = updatingTaskIds.includes(task.id);
              const contextName = row.project?.name || (row.patient ? `${row.patient.first_name} ${row.patient.last_name}` : "Unknown");
              const isProject = !!row.project;

              return (
                <Link
                  key={row.id}
                  href={getTaskHref(row)}
                  onClick={() => handleMarkNotificationRead(row)}
                  className={`group flex items-start gap-4 p-5 transition-all hover:bg-slate-50 ${isUnread ? "bg-orange-50/60" : ""}`}
                >
                  {/* Icon */}
                  <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg ${
                    isCompleted
                      ? "bg-emerald-100 text-emerald-600"
                      : isUnread
                        ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                        : "bg-slate-100 text-slate-500"
                  }`}>
                    {isCompleted ? (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    )}
                    {isUnread && !isCompleted && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                        <span className="relative inline-flex h-4 w-4 rounded-full bg-orange-500 border-2 border-white" />
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        task.priority === "high" ? "bg-red-100 text-red-700" :
                        task.priority === "medium" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {task.priority}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatRelativeTime(task.activity_date || task.created_at)}
                      </span>
                    </div>
                    
                    <p className={`text-[13px] font-semibold ${isUnread ? "text-slate-900" : "text-slate-700"}`}>
                      {task.name}
                    </p>
                    
                    {task.content && (
                      <p className="mt-1 text-[12px] text-slate-500 line-clamp-1">
                        {task.content}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                        isProject ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700"
                      }`}>
                        {isProject ? (
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                        ) : (
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        )}
                        {contextName}
                      </span>
                      {task.created_by_name && (
                        <span className="text-[10px] text-slate-400">
                          from {task.created_by_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    {!isCompleted ? (
                      <button
                        type="button"
                        onClick={(e) => handleMarkTaskCompleted(row, e)}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 transition-all hover:bg-emerald-100 disabled:opacity-60"
                      >
                        {isUpdating ? (
                          <>
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
                            Updating
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Done
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-2 text-[11px] font-semibold text-emerald-700">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Completed
                      </span>
                    )}
                    <div className="text-slate-300 transition-transform group-hover:translate-x-1">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-800/50 bg-slate-900 px-5 py-4 text-sm font-medium text-white shadow-2xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}
