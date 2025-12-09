"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { useMessagesUnread } from "@/components/MessagesUnreadContext";
import { NoteBodyWithMentions } from "@/components/MentionTextarea";

type MentionItem = {
  id: string;
  type: "note" | "task_comment" | "workflow";
  created_at: string;
  read_at: string | null;
  project_id: string | null;
  task_id?: string | null;
  step_id?: string | null;
  source: "operations" | "admin" | null;
  body: string | null;
  author_name: string | null;
  project_name: string | null;
  task_name?: string | null;
  step_title?: string | null;
};

type FilterStatus = "all" | "unread" | "read";
type FilterType = "all" | "note" | "task_comment" | "workflow";

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

export default function MessagesPage() {
  const [mentions, setMentions] = useState<MentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { setUnreadCountOptimistic, refreshUnread } = useMessagesUnread();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadMentions() {
      try {
        setLoading(true);
        setError(null);

        const { data: authData } = await supabaseClient.auth.getUser();
        const user = authData?.user;

        if (!user) {
          if (!isMounted) return;
          setError("You must be logged in to view messages.");
          setMentions([]);
          setLoading(false);
          return;
        }

        // Fetch note mentions
        const { data: noteMentions } = await supabaseClient
          .from("project_note_mentions")
          .select(
            "id, created_at, read_at, project_id, source, note:project_notes(id, body, author_name), project:projects(id, name)"
          )
          .eq("mentioned_user_id", user.id)
          .order("created_at", { ascending: false });

        // Fetch task comment mentions
        const { data: taskMentions } = await supabaseClient
          .from("task_comment_mentions")
          .select(
            "id, created_at, read_at, project_id, task_id, source, comment:task_comments(id, body, author_name), project:projects(id, name), task:tasks(id, name)"
          )
          .eq("mentioned_user_id", user.id)
          .order("created_at", { ascending: false });

        // Fetch workflow step mentions
        const { data: workflowMentions } = await supabaseClient
          .from("workflow_step_mentions")
          .select("id, created_at, read_at, project_id, step_id, comment_body, author_name, project:projects(id, name)")
          .eq("mentioned_user_id", user.id)
          .order("created_at", { ascending: false });

        if (!isMounted) return;

        // Combine and normalize
        const combined: MentionItem[] = [];

        if (noteMentions) {
          for (const m of noteMentions as any[]) {
            combined.push({
              id: m.id,
              type: "note",
              created_at: m.created_at,
              read_at: m.read_at,
              project_id: m.project_id,
              source: m.source,
              body: m.note?.body || null,
              author_name: m.note?.author_name || null,
              project_name: m.project?.name || null,
            });
          }
        }

        if (taskMentions) {
          for (const m of taskMentions as any[]) {
            combined.push({
              id: m.id,
              type: "task_comment",
              created_at: m.created_at,
              read_at: m.read_at,
              project_id: m.project_id,
              task_id: m.task_id,
              source: m.source,
              body: m.comment?.body || null,
              author_name: m.comment?.author_name || null,
              project_name: m.project?.name || null,
              task_name: m.task?.name || null,
            });
          }
        }

        if (workflowMentions) {
          for (const m of workflowMentions as any[]) {
            combined.push({
              id: m.id,
              type: "workflow",
              created_at: m.created_at,
              read_at: m.read_at,
              project_id: m.project_id,
              step_id: m.step_id,
              source: "admin",
              body: m.comment_body || "mentioned you in a workflow step comment",
              author_name: m.author_name || null,
              project_name: m.project?.name || null,
              step_title: m.step_id?.replace(/_/g, " ") || null,
            });
          }
        }

        // Sort by date descending
        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setMentions(combined);
        setLoading(false);
      } catch {
        if (!isMounted) return;
        setError("Failed to load messages.");
        setMentions([]);
        setLoading(false);
      }
    }

    loadMentions();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const filteredMentions = useMemo(() => {
    return mentions.filter((mention) => {
      if (filterStatus === "unread" && mention.read_at) return false;
      if (filterStatus === "read" && !mention.read_at) return false;
      if (filterType !== "all" && mention.type !== filterType) return false;

      if (filterFromDate || filterToDate) {
        const mentionDate = mention.created_at?.slice(0, 10);
        if (filterFromDate && mentionDate < filterFromDate) return false;
        if (filterToDate && mentionDate > filterToDate) return false;
      }

      return true;
    });
  }, [mentions, filterStatus, filterType, filterFromDate, filterToDate]);

  const unreadCount = mentions.filter((m) => !m.read_at).length;

  async function handleMarkAllRead() {
    const unreadNotes = mentions.filter((m) => !m.read_at && m.type === "note").map((m) => m.id);
    const unreadTasks = mentions.filter((m) => !m.read_at && m.type === "task_comment").map((m) => m.id);
    const unreadWorkflows = mentions.filter((m) => !m.read_at && m.type === "workflow").map((m) => m.id);

    if (unreadNotes.length === 0 && unreadTasks.length === 0 && unreadWorkflows.length === 0) return;

    try {
      setMarkingRead(true);
      const nowIso = new Date().toISOString();

      if (unreadNotes.length > 0) {
        await supabaseClient
          .from("project_note_mentions")
          .update({ read_at: nowIso })
          .in("id", unreadNotes);
      }

      if (unreadTasks.length > 0) {
        await supabaseClient
          .from("task_comment_mentions")
          .update({ read_at: nowIso })
          .in("id", unreadTasks);
      }

      if (unreadWorkflows.length > 0) {
        await supabaseClient
          .from("workflow_step_mentions")
          .update({ read_at: nowIso })
          .in("id", unreadWorkflows);
      }

      setMentions((prev) =>
        prev.map((m) => (m.read_at ? m : { ...m, read_at: nowIso }))
      );
      setUnreadCountOptimistic(() => 0);
      setToastMessage("All messages marked as read.");
      setMarkingRead(false);
    } catch {
      setMarkingRead(false);
    }
  }

  async function handleMarkAsRead(mention: MentionItem) {
    if (mention.read_at) return;

    const nowIso = new Date().toISOString();

    setMentions((prev) =>
      prev.map((m) => (m.id === mention.id ? { ...m, read_at: nowIso } : m))
    );
    setUnreadCountOptimistic((prev) => Math.max(0, prev - 1));

    try {
      const table = mention.type === "note" ? "project_note_mentions" : mention.type === "task_comment" ? "task_comment_mentions" : "workflow_step_mentions";
      await supabaseClient
        .from(table)
        .update({ read_at: nowIso })
        .eq("id", mention.id);
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    if (!toastMessage) return;
    const id = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(id);
  }, [toastMessage]);

  function clearFilters() {
    setFilterStatus("all");
    setFilterType("all");
    setFilterFromDate("");
    setFilterToDate("");
  }

  const hasActiveFilters = filterStatus !== "all" || filterType !== "all" || filterFromDate || filterToDate;

  function getMentionHref(mention: MentionItem): string {
    if (!mention.project_id) return "#";
    const mode = mention.source || "operations";
    if (mention.type === "workflow") {
      return `/projects/${mention.project_id}?mode=admin&tab=workflows`;
    }
    if (mention.type === "task_comment") {
      return `/projects/${mention.project_id}?mode=${mode}&tab=${mode === "admin" ? "cockpit" : "tasks"}`;
    }
    const tab = mode === "admin" ? "cockpit" : "notes";
    return `/projects/${mention.project_id}?mode=${mode}&tab=${tab}`;
  }

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white shadow-2xl">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Messages</h1>
              <p className="text-sm text-white/80">
                {unreadCount > 0 ? (
                  <span className="font-semibold">{unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}</span>
                ) : (
                  "You're all caught up! 🎉"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRefreshKey((prev) => prev + 1);
                refreshUnread().catch(() => {});
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
                onClick={handleMarkAllRead}
                disabled={markingRead}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[12px] font-semibold text-violet-700 shadow-lg transition-all hover:bg-white/90 disabled:opacity-60"
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
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(["all", "unread", "read"] as FilterStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  filterStatus === status
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                {status === "all" ? "All" : status === "unread" ? "Unread" : "Read"}
              </button>
            ))}
          </div>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Type</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {([{ id: "all", label: "All" }, { id: "note", label: "Notes" }, { id: "task_comment", label: "Tasks" }, { id: "workflow", label: "Workflows" }] as { id: FilterType; label: string }[]).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterType(t.id)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  filterType === t.id
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</span>
          <input
            type="date"
            value={filterFromDate}
            onChange={(e) => setFilterFromDate(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 focus:border-violet-400 focus:outline-none"
          />
          <span className="text-[10px] text-slate-400">→</span>
          <input
            type="date"
            value={filterToDate}
            onChange={(e) => setFilterToDate(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 focus:border-violet-400 focus:outline-none"
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-100"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}

        <div className="ml-auto text-[11px] font-medium text-slate-400">
          {filteredMentions.length} message{filteredMentions.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Messages List */}
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            <p className="mt-4 text-sm font-medium text-slate-500">Loading messages...</p>
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
        ) : filteredMentions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 text-violet-400">
              <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <p className="mt-4 text-base font-semibold text-slate-700">
              {hasActiveFilters ? "No messages match your filters" : "No messages yet"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {hasActiveFilters ? "Try adjusting your filters" : "You'll see mentions here when someone @mentions you"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMentions.map((mention) => {
              const isUnread = !mention.read_at;
              const isTask = mention.type === "task_comment";
              const isWorkflow = mention.type === "workflow";

              return (
                <Link
                  key={`${mention.type}-${mention.id}`}
                  href={getMentionHref(mention)}
                  onClick={() => handleMarkAsRead(mention)}
                  className={`group flex items-start gap-4 p-5 transition-all hover:bg-slate-50 ${isUnread ? "bg-violet-50/60" : ""}`}
                >
                  {/* Avatar */}
                  <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg ${
                    isUnread 
                      ? isWorkflow
                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                        : isTask 
                          ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white" 
                          : "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {isWorkflow ? (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    ) : isTask ? (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    )}
                    {isUnread && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                        <span className="relative inline-flex h-4 w-4 rounded-full bg-violet-500 border-2 border-white" />
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        isWorkflow
                          ? "bg-blue-100 text-blue-700"
                          : isTask 
                            ? "bg-emerald-100 text-emerald-700" 
                            : "bg-violet-100 text-violet-700"
                      }`}>
                        {isWorkflow ? "Workflow" : isTask ? "Task Comment" : "Note"}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatRelativeTime(mention.created_at)}
                      </span>
                    </div>
                    
                    <p className={`text-[13px] font-semibold ${isUnread ? "text-slate-900" : "text-slate-700"}`}>
                      {mention.author_name || "Someone"} mentioned you
                    </p>
                    
                    <div className="mt-1 text-[12px] text-slate-600 line-clamp-2">
                      {mention.body ? (
                        <NoteBodyWithMentions body={mention.body} />
                      ) : (
                        <span className="italic text-slate-400">(Content unavailable)</span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                        {mention.project_name || "Unknown project"}
                      </span>
                      {isTask && mention.task_name && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 11l3 3L22 4" />
                          </svg>
                          {mention.task_name}
                        </span>
                      )}
                      {isWorkflow && mention.step_title && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-700 capitalize">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                          </svg>
                          {mention.step_title}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-1">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
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
