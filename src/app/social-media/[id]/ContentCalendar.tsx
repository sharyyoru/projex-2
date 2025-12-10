"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import PostModal from "./PostModal";
import { PLATFORM_ICONS } from "./socialMediaUtils";

type WorkflowStatus = "new" | "creatives_approval" | "captions" | "client_approval" | "approved" | "posted";

type Post = {
  id: string;
  platforms: string[];
  caption: string | null;
  media_urls: { url: string; type: "image" | "video" }[];
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: "draft" | "pending" | "approved" | "published";
  workflow_status: WorkflowStatus;
  hashtags: string[];
  post_type: "organic" | "boosted";
  content_type: string | null;
  image_asset_url: string | null;
  video_url: string | null;
  first_comment: string | null;
  shoot_status: "pending" | "scheduled" | "completed" | "cancelled";
  shoot_date: string | null;
  shoot_time: string | null;
  shoot_count: number;
  shoot_notes: string | null;
  creative_notes: string | null;
  danote_board_id: string | null;
  platform_budgets: Record<string, number>;
  published_urls: Record<string, string>;
  created_at: string;
};

type Props = {
  projectId: string;
  platforms: string[];
  brandColor: string | null;
};

const WORKFLOW_COLORS: Record<WorkflowStatus, { bg: string; text: string; border: string; dot: string }> = {
  new: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300", dot: "bg-slate-500" },
  creatives_approval: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300", dot: "bg-amber-500" },
  captions: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", dot: "bg-blue-500" },
  client_approval: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", dot: "bg-purple-500" },
  approved: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300", dot: "bg-green-500" },
  posted: { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-300", dot: "bg-pink-500" },
};

const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  new: "New",
  creatives_approval: "Creatives",
  captions: "Captions",
  client_approval: "Client",
  approved: "Approved",
  posted: "Posted",
};

export default function ContentCalendar({ projectId, platforms, brandColor }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showPostModal, setShowPostModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [draggedPost, setDraggedPost] = useState<Post | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | "all">("all");

  useEffect(() => {
    loadPosts();
  }, [projectId]);

  async function loadPosts() {
    setLoading(true);
    const { data } = await supabaseClient
      .from("social_posts")
      .select("*")
      .eq("project_id", projectId)
      .order("scheduled_date", { ascending: true });
    if (data) setPosts(data as Post[]);
    setLoading(false);
  }

  async function updatePostDate(postId: string, newDate: Date) {
    await supabaseClient
      .from("social_posts")
      .update({ scheduled_date: newDate.toISOString() })
      .eq("id", postId);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, scheduled_date: newDate.toISOString() } : p))
    );
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  // Filter posts by status
  const filteredPosts = statusFilter === "all" 
    ? posts 
    : posts.filter(p => p.workflow_status === statusFilter);

  const getPostsForDay = (day: number) =>
    filteredPosts.filter((post) => {
      if (!post.scheduled_date) return false;
      const d = new Date(post.scheduled_date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const getWorkflowStyle = (status: WorkflowStatus | undefined) => {
    return WORKFLOW_COLORS[status || "new"];
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h2 className="min-w-[180px] text-center text-lg font-semibold text-slate-900">{monthNames[month]} {year}</h2>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Today</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button onClick={() => setViewMode("calendar")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${viewMode === "calendar" ? "bg-pink-500 text-white shadow" : "text-slate-600 hover:text-slate-900"}`}>Calendar</button>
            <button onClick={() => setViewMode("list")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${viewMode === "list" ? "bg-pink-500 text-white shadow" : "text-slate-600 hover:text-slate-900"}`}>List</button>
          </div>
          <button onClick={() => { setEditingPost(null); setShowPostModal(true); }} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-pink-500/25 hover:shadow-xl">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            New Post
          </button>
        </div>
      </div>

      {/* Workflow Status Filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            statusFilter === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All ({posts.length})
        </button>
        {(Object.keys(WORKFLOW_COLORS) as WorkflowStatus[]).map((status) => {
          const count = posts.filter(p => p.workflow_status === status).length;
          const colors = WORKFLOW_COLORS[status];
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                statusFilter === status 
                  ? `${colors.bg} ${colors.text} ring-2 ring-offset-1 ring-current` 
                  : `${colors.bg} ${colors.text} opacity-70 hover:opacity-100`
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
              {WORKFLOW_LABELS[status]} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" /></div>
      ) : viewMode === "calendar" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="px-2 py-3 text-center text-xs font-medium text-slate-500">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayPosts = day ? getPostsForDay(day) : [];
              const isToday = day && new Date().getFullYear() === year && new Date().getMonth() === month && new Date().getDate() === day;
              return (
                <div key={idx} className={`min-h-[120px] border-b border-r border-slate-100 p-2 transition-colors ${day ? "hover:bg-slate-50" : "bg-slate-50/50"}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (day && draggedPost) { updatePostDate(draggedPost.id, new Date(year, month, day, 10, 0, 0)); setDraggedPost(null); } }}>
                  {day && (
                    <>
                      <div className={`mb-1 text-sm ${isToday ? "flex h-6 w-6 items-center justify-center rounded-full bg-pink-500 font-semibold text-white" : "font-medium text-slate-700"}`}>{day}</div>
                      <div className="space-y-1">
                        {dayPosts.slice(0, 3).map((post) => {
                          const style = getWorkflowStyle(post.workflow_status);
                          return (
                            <div key={post.id} draggable onDragStart={() => setDraggedPost(post)} onClick={() => { setEditingPost(post); setShowPostModal(true); }}
                              className={`cursor-pointer rounded-lg overflow-hidden border ${style.border} ${style.bg} transition-all hover:scale-105 hover:shadow-md`}>
                              {/* Image Preview */}
                              {post.image_asset_url && (
                                <div className="h-12 w-full overflow-hidden">
                                  <img src={post.image_asset_url} alt="" className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div className="px-2 py-1">
                                <div className="flex items-center gap-1 mb-0.5">
                                  {(post.platforms || []).slice(0, 2).map((p) => <span key={p} className="opacity-70 text-[10px]">{PLATFORM_ICONS[p.toLowerCase()]}</span>)}
                                  <span className={`ml-auto w-1.5 h-1.5 rounded-full ${style.dot}`} title={WORKFLOW_LABELS[post.workflow_status || "new"]} />
                                </div>
                                <div className={`line-clamp-1 text-[10px] ${style.text}`}>{post.caption || "No caption"}</div>
                              </div>
                            </div>
                          );
                        })}
                        {dayPosts.length > 3 && <div className="text-xs text-slate-500">+{dayPosts.length - 3} more</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-slate-500">No posts found. {statusFilter !== "all" && "Try changing the filter or create a new post!"}</p></div>
          ) : filteredPosts.map((post) => {
            const style = getWorkflowStyle(post.workflow_status);
            return (
              <div key={post.id} onClick={() => { setEditingPost(post); setShowPostModal(true); }}
                className={`cursor-pointer rounded-2xl border ${style.border} bg-white overflow-hidden transition-all hover:shadow-lg`}>
                <div className="flex">
                  {/* Image Preview */}
                  {post.image_asset_url && (
                    <div className="w-24 h-24 flex-shrink-0 overflow-hidden">
                      <img src={post.image_asset_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {(post.platforms || []).map((p) => <span key={p} className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600">{PLATFORM_ICONS[p.toLowerCase()]}</span>)}
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {WORKFLOW_LABELS[post.workflow_status || "new"]}
                      </span>
                      {post.post_type === "boosted" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          💰 Boosted
                        </span>
                      )}
                    </div>
                    <p className="mb-1 line-clamp-2 text-sm text-slate-900">{post.caption || "No caption"}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{post.scheduled_date ? new Date(post.scheduled_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "Not scheduled"}</span>
                      {post.content_type && <span className="text-slate-400">• {post.content_type}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPostModal && (
        <PostModal post={editingPost} projectId={projectId} availablePlatforms={platforms} onClose={() => { setShowPostModal(false); setEditingPost(null); }} onSaved={() => { setShowPostModal(false); setEditingPost(null); loadPosts(); }} />
      )}
    </div>
  );
}
