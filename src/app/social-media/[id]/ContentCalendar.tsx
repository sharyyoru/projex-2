"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import PostModal from "./PostModal";
import { PLATFORM_ICONS, STATUS_STYLES } from "./socialMediaUtils";

type Post = {
  id: string;
  platforms: string[];
  caption: string | null;
  media_urls: { url: string; type: "image" | "video" }[];
  scheduled_date: string | null;
  status: "draft" | "pending" | "approved" | "published";
  hashtags: string[];
  published_urls: Record<string, string>;
  created_at: string;
};

type Props = {
  projectId: string;
  platforms: string[];
  brandColor: string | null;
};

export default function ContentCalendar({ projectId, platforms, brandColor }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showPostModal, setShowPostModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [draggedPost, setDraggedPost] = useState<Post | null>(null);

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

  const getPostsForDay = (day: number) =>
    posts.filter((post) => {
      if (!post.scheduled_date) return false;
      const d = new Date(post.scheduled_date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                        {dayPosts.slice(0, 3).map((post) => (
                          <div key={post.id} draggable onDragStart={() => setDraggedPost(post)} onClick={() => { setEditingPost(post); setShowPostModal(true); }}
                            className={`cursor-pointer rounded-lg px-2 py-1 text-xs ${STATUS_STYLES[post.status].bg} ${STATUS_STYLES[post.status].text} transition-all hover:scale-105 hover:shadow-md`}>
                            <div className="flex items-center gap-1 mb-0.5">{(post.platforms || []).slice(0, 2).map((p) => <span key={p} className="opacity-70">{PLATFORM_ICONS[p.toLowerCase()]}</span>)}</div>
                            <div className="line-clamp-1">{post.caption || "No caption"}</div>
                          </div>
                        ))}
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
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-slate-500">No posts yet. Create your first post!</p></div>
          ) : posts.map((post) => (
            <div key={post.id} onClick={() => { setEditingPost(post); setShowPostModal(true); }}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-pink-200 hover:shadow-lg hover:shadow-pink-500/10">
              <div className="flex items-center gap-2 mb-2">
                {(post.platforms || []).map((p) => <span key={p} className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600">{PLATFORM_ICONS[p.toLowerCase()]}</span>)}
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[post.status].bg} ${STATUS_STYLES[post.status].text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[post.status].dot}`} />{post.status}
                </span>
              </div>
              <p className="mb-1 line-clamp-2 text-sm text-slate-900">{post.caption || "No caption"}</p>
              <div className="text-xs text-slate-500">{post.scheduled_date ? new Date(post.scheduled_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not scheduled"}</div>
            </div>
          ))}
        </div>
      )}

      {showPostModal && (
        <PostModal post={editingPost} projectId={projectId} availablePlatforms={platforms} onClose={() => { setShowPostModal(false); setEditingPost(null); }} onSaved={() => { setShowPostModal(false); setEditingPost(null); loadPosts(); }} />
      )}
    </div>
  );
}
