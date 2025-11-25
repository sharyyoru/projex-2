"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";

type TaskStatus = "not_started" | "in_progress" | "completed";
type TaskPriority = "low" | "medium" | "high";

type Task = {
  id: string;
  project_id: string | null;
  name: string;
  content: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  activity_date: string | null;
  created_by_name: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  created_at: string;
  source: string | null;
  project?: { id: string; name: string } | null;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function taskStatusPillClasses(status: TaskStatus): string {
  if (status === "not_started") return "border border-red-200 bg-red-50 text-red-700";
  if (status === "in_progress") return "border border-amber-200 bg-amber-50 text-amber-700";
  if (status === "completed") return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border border-slate-200 bg-slate-50 text-slate-600";
}

function formatTaskStatusLabel(status: TaskStatus): string {
  if (status === "not_started") return "Not started";
  if (status === "in_progress") return "In progress";
  return "Completed";
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "completed">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "operations" | "admin">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadTasks() {
      try {
        setLoading(true);
        setError(null);
        const { data: authData } = await supabaseClient.auth.getUser();
        const user = authData?.user;
        if (!user) {
          if (!isMounted) return;
          setError("You must be logged in to view tasks.");
          setTasks([]);
          setLoading(false);
          return;
        }
        const { data, error: fetchError } = await supabaseClient
          .from("tasks")
          .select("id, project_id, name, content, status, priority, activity_date, created_by_name, assigned_user_id, assigned_user_name, created_at, source, project:projects(id, name)")
          .eq("assigned_user_id", user.id)
          .order("activity_date", { ascending: false });
        if (!isMounted) return;
        if (fetchError || !data) {
          setError(fetchError?.message ?? "Failed to load tasks.");
          setTasks([]);
          setLoading(false);
          return;
        }
        setTasks(data as unknown as Task[]);
        setLoading(false);
      } catch {
        if (!isMounted) return;
        setError("Failed to load tasks.");
        setTasks([]);
        setLoading(false);
      }
    }
    void loadTasks();
    return () => { isMounted = false; };
  }, []);

  const projectOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    tasks.forEach((t) => {
      if (t.project && !map.has(t.project.id)) {
        map.set(t.project.id, { id: t.project.id, name: t.project.name });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter === "open" && task.status === "completed") return false;
      if (statusFilter === "completed" && task.status !== "completed") return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (sourceFilter !== "all") {
        const taskSource = task.source || "operations";
        if (taskSource !== sourceFilter) return false;
      }
      if (projectFilter !== "all" && task.project?.id !== projectFilter) return false;
      if (dateFromFilter || dateToFilter) {
        const taskDate = task.activity_date || task.created_at;
        if (taskDate) {
          const ymd = taskDate.slice(0, 10);
          if (dateFromFilter && ymd < dateFromFilter) return false;
          if (dateToFilter && ymd > dateToFilter) return false;
        }
      }
      if (term) {
        const searchFields = [task.name, task.content, task.created_by_name, task.assigned_user_name, task.project?.name].filter(Boolean).join(" ").toLowerCase();
        if (!searchFields.includes(term)) return false;
      }
      return true;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, sourceFilter, projectFilter, dateFromFilter, dateToFilter]);

  const tasksByStatus = {
    not_started: filteredTasks.filter((t) => t.status === "not_started"),
    in_progress: filteredTasks.filter((t) => t.status === "in_progress"),
    completed: filteredTasks.filter((t) => t.status === "completed"),
  };

  async function handleUpdateTaskStatus(taskId: string, newStatus: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    setDraggedTaskId(null);
    setStatusDropdownOpen(null);
    try {
      await supabaseClient.from("tasks").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", taskId);
    } catch (e) {
      console.error("Error updating task status:", e);
    }
  }

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setSourceFilter("all");
    setProjectFilter("all");
    setDateFromFilter("");
    setDateToFilter("");
  }

  const hasActiveFilters = searchQuery || statusFilter !== "all" || priorityFilter !== "all" || sourceFilter !== "all" || projectFilter !== "all" || dateFromFilter || dateToFilter;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Tasks</h1>
          <p className="mt-0.5 text-sm text-slate-500">All tasks assigned to you from operations and admin</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-slate-50/80 p-1">
            <button type="button" onClick={() => setViewMode("list")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              List
            </button>
            <button type="button" onClick={() => setViewMode("kanban")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${viewMode === "kanban" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="8" rx="1"/></svg>
              Board
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/60 bg-gradient-to-r from-slate-50/80 to-white/80 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-500">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tasks..." className="h-8 w-48 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none">
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="completed">Completed</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none">
          <option value="all">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none">
          <option value="all">All Sources</option>
          <option value="operations">Operations</option>
          <option value="admin">Admin</option>
        </select>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="h-8 min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none">
          <option value="all">All Projects</option>
          {projectOptions.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none" />
          <span className="text-[10px] text-slate-400">to</span>
          <input type="date" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none" />
        </div>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 transition-all hover:bg-red-100">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            Clear
          </button>
        )}
        <div className="ml-auto text-[11px] text-slate-400">{filteredTasks.length} tasks</div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500" />
            <p className="text-sm font-medium text-slate-500">Loading tasks…</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-400">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-700">No tasks found</p>
          <p className="mt-1 text-xs text-slate-400">Try adjusting your filters or check back later</p>
        </div>
      ) : viewMode === "kanban" ? (
        /* Kanban Board View */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(["not_started", "in_progress", "completed"] as const).map((status) => {
            const columnTasks = tasksByStatus[status];
            const config = {
              not_started: { label: "Not Started", bg: "from-red-50 to-rose-50", border: "border-red-200", header: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
              in_progress: { label: "In Progress", bg: "from-amber-50 to-orange-50", border: "border-amber-200", header: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500 animate-pulse" },
              completed: { label: "Completed", bg: "from-emerald-50 to-teal-50", border: "border-emerald-200", header: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
            }[status];
            return (
              <div key={status} className={`flex flex-col rounded-2xl border ${config.border} bg-gradient-to-b ${config.bg} min-h-[400px]`}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-emerald-400"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-emerald-400"); }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("ring-2", "ring-emerald-400"); if (draggedTaskId) handleUpdateTaskStatus(draggedTaskId, status); }}>
                <div className={`flex items-center justify-between rounded-t-2xl ${config.header} px-4 py-3`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${config.dot}`} />
                    <span className={`text-[12px] font-bold ${config.text}`}>{config.label}</span>
                  </div>
                  <span className={`rounded-full ${config.header} px-2.5 py-0.5 text-[11px] font-bold ${config.text}`}>{columnTasks.length}</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {columnTasks.map((task) => (
                    <div key={task.id} draggable onDragStart={() => setDraggedTaskId(task.id)} onDragEnd={() => setDraggedTaskId(null)}
                      className={`group cursor-grab rounded-xl border border-white/80 bg-white p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing ${draggedTaskId === task.id ? "opacity-50 scale-95" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-[12px] font-semibold text-slate-900 line-clamp-2">{task.name}</h4>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${task.priority === "high" ? "bg-red-100 text-red-700" : task.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{task.priority}</span>
                      </div>
                      {task.content && <p className="mt-1.5 text-[11px] text-slate-500 line-clamp-2">{task.content}</p>}
                      {task.project && (
                        <Link href={`/projects/${task.project.id}`} className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-200">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                          {task.project.name}
                        </Link>
                      )}
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${task.source === "admin" ? "bg-slate-500" : "bg-emerald-500"}`} />
                          {task.source === "admin" ? "Admin" : "Operations"}
                        </span>
                        {task.activity_date && <span>{formatDate(task.activity_date)}</span>}
                      </div>
                    </div>
                  ))}
                  {columnTasks.length === 0 && <div className="flex flex-col items-center justify-center py-8 text-center"><p className="text-[11px] text-slate-400">Drop tasks here</p></div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredTasks.map((task) => (
              <div key={task.id} className="group flex items-center justify-between p-4 hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${task.status === "completed" ? "bg-gradient-to-br from-emerald-400 to-teal-500" : task.status === "in_progress" ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-red-400 to-rose-500"} text-white shadow-lg`}>
                    {task.status === "completed" ? (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>)
                    : task.status === "in_progress" ? (<svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>)
                    : (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/></svg>)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-[13px] font-semibold text-slate-900 truncate">{task.name}</h4>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${task.priority === "high" ? "bg-red-100 text-red-700" : task.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{task.priority}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${task.source === "admin" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{task.source === "admin" ? "Admin" : "Operations"}</span>
                    </div>
                    {task.content && <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">{task.content}</p>}
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
                      {task.project && (<Link href={`/projects/${task.project.id}`} className="flex items-center gap-1 text-emerald-600 hover:underline"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>{task.project.name}</Link>)}
                      <span className="flex items-center gap-1"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>{formatDate(task.activity_date || task.created_at)}</span>
                      <span>Created by {task.created_by_name || "Unknown"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="relative">
                    <button type="button" onClick={() => setStatusDropdownOpen(statusDropdownOpen === task.id ? null : task.id)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all hover:scale-105 ${taskStatusPillClasses(task.status)}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${task.status === "completed" ? "bg-emerald-500" : task.status === "in_progress" ? "bg-amber-500 animate-pulse" : "bg-red-400"}`} />
                      {formatTaskStatusLabel(task.status)}
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {statusDropdownOpen === task.id && (
                      <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-[11px] shadow-xl">
                        <button type="button" onClick={() => handleUpdateTaskStatus(task.id, "not_started")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-red-50"><span className="h-2 w-2 rounded-full bg-red-400"/>Not started</button>
                        <button type="button" onClick={() => handleUpdateTaskStatus(task.id, "in_progress")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-amber-50"><span className="h-2 w-2 rounded-full bg-amber-500"/>In progress</button>
                        <button type="button" onClick={() => handleUpdateTaskStatus(task.id, "completed")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-emerald-50"><span className="h-2 w-2 rounded-full bg-emerald-500"/>Completed</button>
                      </div>
                    )}
                  </div>
                  {task.project && (<Link href={`/projects/${task.project.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open</Link>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
