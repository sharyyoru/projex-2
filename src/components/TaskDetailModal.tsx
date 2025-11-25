"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type TaskStatus = "not_started" | "in_progress" | "completed";
type TaskPriority = "low" | "medium" | "high";

interface TaskChecklistItem {
  id: string;
  task_id: string;
  label: string;
  is_completed: boolean;
  sort_order: number;
}

interface TaskComment {
  id: string;
  task_id: string;
  body: string;
  author_name: string | null;
  created_at: string;
}

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" });
}

function taskStatusPillClasses(status: TaskStatus): string {
  if (status === "completed") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "in_progress") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function formatTaskStatusLabel(status: TaskStatus | null): string {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

export default function TaskDetailModal({ taskId, onClose, onStatusChange }: TaskDetailModalProps) {
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  useEffect(() => {
    async function loadTask() {
      try {
        setLoading(true);
        const [taskRes, checklistRes, commentsRes] = await Promise.all([
          supabaseClient
            .from("tasks")
            .select("id, project_id, patient_id, name, content, status, priority, type, activity_date, created_at, created_by_name, assigned_user_name, patient:patients(id, first_name, last_name, email, phone), project:projects(id, name)")
            .eq("id", taskId)
            .single(),
          supabaseClient
            .from("task_checklist_items")
            .select("id, task_id, label, is_completed, sort_order")
            .eq("task_id", taskId)
            .order("sort_order", { ascending: true }),
          supabaseClient
            .from("task_comments")
            .select("id, task_id, body, author_name, created_at")
            .eq("task_id", taskId)
            .order("created_at", { ascending: true }),
        ]);

        if (!taskRes.error && taskRes.data) {
          setTask(taskRes.data);
        }
        if (!checklistRes.error && checklistRes.data) {
          setChecklist(checklistRes.data as TaskChecklistItem[]);
        }
        if (!commentsRes.error && commentsRes.data) {
          setComments(commentsRes.data as TaskComment[]);
        }
      } catch (err) {
        console.error("Error loading task:", err);
      } finally {
        setLoading(false);
        setCommentsLoading(false);
      }
    }

    loadTask();
  }, [taskId]);

  async function handleToggleChecklistItem(item: TaskChecklistItem) {
    const nextCompleted = !item.is_completed;
    try {
      await supabaseClient
        .from("task_checklist_items")
        .update({ is_completed: nextCompleted })
        .eq("id", item.id);

      setChecklist((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, is_completed: nextCompleted } : row))
      );
    } catch {}
  }

  async function handleChangeStatus(status: TaskStatus) {
    setStatusDropdownOpen(false);
    if (!task || task.status === status) return;

    try {
      const { error } = await supabaseClient
        .from("tasks")
        .update({ status })
        .eq("id", taskId);

      if (!error) {
        setTask((prev: any) => ({ ...prev, status }));
        onStatusChange?.(taskId, status);
      }
    } catch {}
  }

  async function handleSubmitComment() {
    if (!newComment.trim()) return;

    try {
      setCommentSaving(true);
      const { data: authData } = await supabaseClient.auth.getUser();
      const authUser = authData?.user;
      if (!authUser) return;

      const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
      const first = (meta["first_name"] as string) || "";
      const last = (meta["last_name"] as string) || "";
      const fullName = [first, last].filter(Boolean).join(" ") || authUser.email || null;

      const { data, error } = await supabaseClient
        .from("task_comments")
        .insert({
          task_id: taskId,
          author_user_id: authUser.id,
          author_name: fullName,
          body: newComment.trim(),
        })
        .select("id, task_id, body, author_name, created_at")
        .single();

      if (!error && data) {
        setComments((prev) => [...prev, data as TaskComment]);
        setNewComment("");
      }
    } catch {} finally {
      setCommentSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-2xl">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
          <span className="text-sm text-slate-600">Loading task...</span>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
        <div className="rounded-2xl bg-white p-6 shadow-2xl">
          <p className="text-sm text-slate-600">Task not found</p>
          <button onClick={onClose} className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            Close
          </button>
        </div>
      </div>
    );
  }

  const patient = task.patient as { first_name?: string; last_name?: string; email?: string; phone?: string } | null;
  const patientName = patient ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() : null;
  const project = task.project as { id: string; name: string } | null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button type="button" className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200/50 bg-white shadow-2xl">
        {/* Header with gradient */}
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-6 py-5">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-white/10 blur-xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white line-clamp-1">{task.name}</h3>
                <p className="text-[11px] text-white/80">
                  Created by {task.created_by_name || "Unknown"}
                  {project && <span> • {project.name}</span>}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white backdrop-blur-sm transition-all hover:bg-white/30">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          {/* Description */}
          {task.content && (
            <div className="mb-4 rounded-xl bg-slate-50 p-4">
              <p className="text-[12px] text-slate-700 leading-relaxed">{task.content}</p>
            </div>
          )}

          {/* Info Cards */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Due Date</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-800">{formatDate(task.activity_date ?? task.created_at)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Priority</p>
              <p className={`mt-1 text-[13px] font-semibold ${task.priority === "high" ? "text-red-600" : task.priority === "medium" ? "text-amber-600" : "text-slate-600"}`}>
                {(task.priority as string).charAt(0).toUpperCase() + (task.priority as string).slice(1)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Assigned To</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-800">{task.assigned_user_name || "Unassigned"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Status</p>
              <div className="relative mt-1">
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold shadow-sm transition-all hover:scale-105 ${taskStatusPillClasses(task.status)}`}
                >
                  {formatTaskStatusLabel(task.status)}
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {statusDropdownOpen && (
                  <div className="absolute left-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    {(["not_started", "in_progress", "completed"] as TaskStatus[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleChangeStatus(s)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[11px] font-medium text-slate-700 transition-all hover:bg-slate-50"
                      >
                        <span className={`h-2 w-2 rounded-full ${s === "completed" ? "bg-emerald-500" : s === "in_progress" ? "bg-amber-500" : "bg-red-400"}`} />
                        {formatTaskStatusLabel(s)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Patient Info if exists */}
          {patientName && (
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Patient</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-800">
                {patientName}
                {(patient?.email || patient?.phone) && (
                  <span className="ml-2 text-[11px] font-normal text-slate-500">{patient.email || patient.phone}</span>
                )}
              </p>
            </div>
          )}

          {/* Checklist */}
          <div className="mb-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </div>
              <span className="text-[12px] font-bold text-slate-800">Checklist</span>
              {checklist.length > 0 && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                  {checklist.filter((i) => i.is_completed).length}/{checklist.length}
                </span>
              )}
            </div>
            {checklist.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                {checklist.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggleChecklistItem(item)}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-all hover:bg-white"
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${item.is_completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"}`}>
                      {item.is_completed && (
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-[12px] ${item.is_completed ? "text-slate-400 line-through" : "text-slate-700"}`}>{item.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-[11px] text-slate-400">No checklist items for this task</p>
            )}
          </div>

          {/* Comments Section */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span className="text-[12px] font-bold text-slate-800">Comments</span>
              {comments.length > 0 && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">{comments.length}</span>
              )}
            </div>

            {commentsLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
              </div>
            ) : comments.length === 0 ? (
              <p className="mb-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-[11px] text-slate-400">No comments yet. Be the first to comment!</p>
            ) : (
              <div className="mb-4 max-h-48 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-white p-3 shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-[10px] font-bold text-white shadow-sm">
                        {(comment.author_name || "U")[0].toUpperCase()}
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-slate-800">{comment.author_name || "Unknown"}</span>
                        <span className="ml-2 text-[10px] text-slate-400">{formatDate(comment.created_at)}</span>
                      </div>
                    </div>
                    <p className="pl-9 text-[11px] text-slate-600 leading-relaxed">{comment.body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add Comment */}
            <div className="space-y-3">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[12px] text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={handleSubmitComment}
                disabled={commentSaving || !newComment.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-[11px] font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:shadow-xl hover:shadow-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {commentSaving ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Posting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 2L11 13" />
                      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                    Post Comment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
