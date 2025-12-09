"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { useMessagesUnread } from "@/components/MessagesUnreadContext";
import DubaiInfoPill from "@/components/DubaiInfoPill";
import TaskDetailModal from "@/components/TaskDetailModal";

type ProjectType = "website" | "mobile_app" | "crm" | "marketing" | "other" | string;
type TaskStatus = "not_started" | "in_progress" | "completed";

interface ProjectStats {
  type: ProjectType;
  count: number;
}

interface WorkflowStats {
  total: number;
  avgCompletion: number;
  completed: number;
}

interface UserTaskStats {
  userId: string;
  userName: string;
  assignedCount: number;
  completedCount: number;
  completedThisWeek: number;
}

const PROJECT_TYPE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  website: { bg: "bg-blue-500", text: "text-blue-600", ring: "ring-blue-200" },
  mobile_app: { bg: "bg-purple-500", text: "text-purple-600", ring: "ring-purple-200" },
  crm: { bg: "bg-emerald-500", text: "text-emerald-600", ring: "ring-emerald-200" },
  marketing: { bg: "bg-amber-500", text: "text-amber-600", ring: "ring-amber-200" },
  other: { bg: "bg-slate-400", text: "text-slate-600", ring: "ring-slate-200" },
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
  website: "Website",
  mobile_app: "Mobile App",
  crm: "CRM",
  marketing: "Marketing",
  other: "Other",
};

export default function Home() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([]);
  const [workflowStats, setWorkflowStats] = useState<WorkflowStats>({ total: 0, avgCompletion: 0, completed: 0 });
  const [userTaskStats, setUserTaskStats] = useState<UserTaskStats[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  const { unreadCount } = useMessagesUnread();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Load tasks function - extracted for reuse
  const loadTasks = useCallback(async (userId: string) => {
    const { data: tasksData } = await supabaseClient
      .from("tasks")
      .select("id, name, content, activity_date, created_at, patient:patients(id, first_name, last_name)")
      .eq("assigned_user_id", userId)
      .neq("status", "completed")
      .order("activity_date", { ascending: true })
      .limit(5);
    return tasksData || [];
  }, []);

  // Load user task stats
  const loadUserStats = useCallback(async () => {
    // Get all tasks with user info
    const { data: allTasks } = await supabaseClient
      .from("tasks")
      .select("id, status, assigned_user_id, assigned_user_name, created_at, activity_date");
    
    if (!allTasks) return;
    
    // Calculate week boundaries
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    // Group by user
    const userMap = new Map<string, UserTaskStats>();
    allTasks.forEach(task => {
      if (!task.assigned_user_id) return;
      const userId = task.assigned_user_id;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          userName: task.assigned_user_name || "Unknown",
          assignedCount: 0,
          completedCount: 0,
          completedThisWeek: 0,
        });
      }
      const stats = userMap.get(userId)!;
      stats.assignedCount++;
      if (task.status === "completed") {
        stats.completedCount++;
        // Check if completed this week
        const taskDate = task.activity_date ? new Date(task.activity_date) : new Date(task.created_at);
        if (taskDate >= weekStart) {
          stats.completedThisWeek++;
        }
      }
    });
    
    setUserTaskStats(Array.from(userMap.values()));
  }, []);

  // Handle task status change - refresh tasks list
  const handleTaskStatusChange = useCallback(async (taskId: string, status: TaskStatus) => {
    if (status === "completed" && currentUserId) {
      // Remove completed task from list and refresh
      setTasks(prev => prev.filter(t => t.id !== taskId));
      // Reload tasks to get fresh data
      const freshTasks = await loadTasks(currentUserId);
      setTasks(freshTasks);
      // Also refresh user stats
      loadUserStats();
    }
  }, [currentUserId, loadTasks, loadUserStats]);

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
            setCurrentUserId(user.id);
          } else {
            setCurrentUserName(null);
            setCurrentUserId(null);
          }
        }

        const today = new Date();
        const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
        const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

        const appointmentsPromise = supabaseClient
          .from("appointments")
          .select("id, start_time, status, reason, patient:patients(id, first_name, last_name)")
          .neq("status", "cancelled")
          .gte("start_time", dayStart)
          .lte("start_time", dayEnd)
          .order("start_time", { ascending: true })
          .limit(3);

        const tasksPromise = user
          ? loadTasks(user.id)
          : Promise.resolve([]);

        const [appointmentsResult, tasksResult] = await Promise.all([appointmentsPromise, tasksPromise]);

        if (cancelled) return;

        setAppointments(!appointmentsResult.error && appointmentsResult.data ? (appointmentsResult.data as any[]) : []);
        setTasks(tasksResult);
      } catch {
        if (cancelled) return;
        setAppointments([]);
        setTasks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadCharts() {
      try {
        setChartsLoading(true);
        
        // Load project stats by type (open projects only)
        const { data: projects } = await supabaseClient
          .from("projects")
          .select("id, project_type, status")
          .neq("status", "completed")
          .neq("status", "cancelled");
        
        if (projects) {
          const typeMap = new Map<string, number>();
          projects.forEach(p => {
            const type = p.project_type || "other";
            typeMap.set(type, (typeMap.get(type) || 0) + 1);
          });
          const stats: ProjectStats[] = Array.from(typeMap.entries()).map(([type, count]) => ({ type, count }));
          setProjectStats(stats);
        }
        
        // Load workflow stats
        const { data: workflows } = await supabaseClient
          .from("project_workflows")
          .select("project_id, workflow_data");
        
        if (workflows) {
          let totalSteps = 0;
          let completedSteps = 0;
          let fullyCompleted = 0;
          
          workflows.forEach(w => {
            const data = w.workflow_data as any;
            if (data?.steps) {
              const steps = data.steps as any[];
              totalSteps += steps.length;
              const done = steps.filter(s => s.status === "completed").length;
              completedSteps += done;
              if (done === steps.length) fullyCompleted++;
            }
          });
          
          setWorkflowStats({
            total: workflows.length,
            avgCompletion: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
            completed: fullyCompleted,
          });
        }
        
        // Load user task stats
        await loadUserStats();
        
      } catch {
        console.error("Failed to load chart data");
      } finally {
        setChartsLoading(false);
      }
    }

    void load();
    void loadCharts();

    return () => { cancelled = true; };
  }, [loadTasks, loadUserStats]);

  // Computed leaderboards
  const taskAssignedLeaderboard = useMemo(() => 
    [...userTaskStats].sort((a, b) => b.assignedCount - a.assignedCount).slice(0, 5),
  [userTaskStats]);

  const mvpLeaderboard = useMemo(() => 
    [...userTaskStats].sort((a, b) => b.completedThisWeek - a.completedThisWeek).slice(0, 5),
  [userTaskStats]);

  const totalProjects = useMemo(() => projectStats.reduce((sum, s) => sum + s.count, 0), [projectStats]);

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

      {/* Analytics Dashboard */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Projects by Type */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white via-white to-blue-50/30 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-blue-400/10 to-blue-600/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25">
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="8" rx="1"/><rect x="14" y="6" width="3" height="12" rx="1"/></svg>
              </span>
              <h3 className="text-sm font-semibold text-slate-700">Open Projects</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900">{totalProjects}</p>
            <p className="text-[11px] text-slate-500 mt-1">By project type</p>
            {chartsLoading ? (
              <div className="mt-3 h-20 flex items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              </div>
            ) : projectStats.length > 0 ? (
              <div className="mt-3 space-y-2">
                {projectStats.map(stat => {
                  const colors = PROJECT_TYPE_COLORS[stat.type] || PROJECT_TYPE_COLORS.other;
                  const pct = totalProjects > 0 ? (stat.count / totalProjects) * 100 : 0;
                  return (
                    <div key={stat.type} className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${colors.bg}`} />
                      <span className="text-[11px] text-slate-600 flex-1">{PROJECT_TYPE_LABELS[stat.type] || stat.type}</span>
                      <span className="text-[11px] font-semibold text-slate-800">{stat.count}</span>
                      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${colors.bg} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 mt-3">No open projects</p>
            )}
          </div>
        </div>

        {/* Workflow Completion */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white via-white to-emerald-50/30 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400/10 to-emerald-600/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25">
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </span>
              <h3 className="text-sm font-semibold text-slate-700">Workflows</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900">{workflowStats.avgCompletion}%</p>
            <p className="text-[11px] text-slate-500 mt-1">Overall completion rate</p>
            {chartsLoading ? (
              <div className="mt-3 h-20 flex items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
              </div>
            ) : (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-500">Progress</span>
                  <span className="font-medium text-emerald-600">{workflowStats.completed}/{workflowStats.total} complete</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${workflowStats.avgCompletion}%` }} />
                </div>
                <div className="mt-2 flex gap-4">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-slate-500">Complete</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-slate-200" />
                    <span className="text-[10px] text-slate-500">In Progress</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Task Leaderboard - Most Assigned */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white via-white to-amber-50/30 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-amber-400/10 to-amber-600/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </span>
              <h3 className="text-sm font-semibold text-slate-700">Task Warriors</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Most tasks assigned</p>
            {chartsLoading ? (
              <div className="h-24 flex items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
              </div>
            ) : taskAssignedLeaderboard.length > 0 ? (
              <div className="space-y-2">
                {taskAssignedLeaderboard.map((user, idx) => (
                  <div key={user.userId} className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${idx === 0 ? "bg-amber-500 text-white" : idx === 1 ? "bg-slate-300 text-slate-700" : idx === 2 ? "bg-amber-700 text-white" : "bg-slate-100 text-slate-500"}`}>
                      {idx + 1}
                    </span>
                    <span className="text-[12px] text-slate-700 flex-1 truncate">{user.userName}</span>
                    <span className="text-[11px] font-bold text-amber-600">{user.assignedCount}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">No data yet</p>
            )}
          </div>
        </div>

        {/* MVP of the Week */}
        <div className="relative overflow-hidden rounded-2xl border border-purple-200/60 bg-gradient-to-br from-purple-50 via-white to-pink-50/30 p-5 shadow-[0_20px_50px_rgba(139,92,246,0.12)]">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/10" />
          <div className="absolute right-3 top-3">
            <span className="text-2xl">👑</span>
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/25">
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </span>
              <h3 className="text-sm font-semibold text-purple-800">MVP of the Week</h3>
            </div>
            {chartsLoading ? (
              <div className="h-28 flex items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
              </div>
            ) : mvpLeaderboard.length > 0 && mvpLeaderboard[0].completedThisWeek > 0 ? (
              <>
                <div className="text-center mb-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-lg font-bold text-white shadow-lg shadow-purple-500/30 ring-4 ring-purple-100">
                    {mvpLeaderboard[0].userName.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-sm font-bold text-purple-900 mt-2">{mvpLeaderboard[0].userName}</p>
                  <p className="text-[20px] font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {mvpLeaderboard[0].completedThisWeek} tasks
                  </p>
                  <p className="text-[10px] text-purple-500">completed this week</p>
                </div>
                {mvpLeaderboard.length > 1 && (
                  <div className="border-t border-purple-100 pt-2 space-y-1">
                    {mvpLeaderboard.slice(1).map((user, idx) => (
                      <div key={user.userId} className="flex items-center gap-2 text-[11px]">
                        <span className="text-purple-400">{idx + 2}.</span>
                        <span className="text-purple-700 flex-1 truncate">{user.userName}</span>
                        <span className="font-semibold text-purple-600">{user.completedThisWeek}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-[11px] text-purple-400">No tasks completed this week yet</p>
                <p className="text-[10px] text-purple-300 mt-1">Be the first to claim the crown!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tasks and Meetings Section */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Today's Meetings */}
        <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Today&apos;s meetings</h2>
              <p className="text-xs text-slate-500">Quick view of your upcoming meetings and calls.</p>
            </div>
            <Link href="/appointments" className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
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
          onStatusChange={handleTaskStatusChange}
        />
      )}
    </div>
  );
}
