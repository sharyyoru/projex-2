"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";

type WorkflowStatus = "new" | "creatives_approval" | "captions" | "client_approval" | "approved" | "posted";

type Post = {
  id: string;
  project_id: string;
  platforms: string[];
  caption: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: "draft" | "pending" | "approved" | "published";
  workflow_status: WorkflowStatus;
  content_type: string | null;
  image_asset_url: string | null;
  shoot_status: "pending" | "scheduled" | "completed" | "cancelled";
  shoot_date: string | null;
  created_at: string;
  project?: {
    id: string;
    name: string;
    brand_color: string | null;
    company: {
      id: string;
      name: string;
      logo_url: string | null;
    } | null;
  };
};

type Project = {
  id: string;
  name: string;
  brand_color: string | null;
  company: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
};

const CONTENT_TYPES = [
  "Reel",
  "Moving Carousel",
  "Static Carousel",
  "Moving & Static Carousel",
  "Story",
  "Post",
  "Video",
  "Live",
];

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

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸",
  facebook: "👤",
  tiktok: "🎵",
  linkedin: "💼",
  x: "𝕏",
  youtube: "▶️",
};

export default function ContentCalendar2026() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Filters
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | "all">("all");
  const [shootFilter, setShootFilter] = useState<"all" | "pending" | "scheduled" | "completed">("all");
  
  // Drag and drop
  const [draggedPost, setDraggedPost] = useState<Post | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // UI
  const [showFilters, setShowFilters] = useState(true);
  const [hoveredPost, setHoveredPost] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    
    // Load all projects with company info
    const { data: projectsData } = await supabaseClient
      .from("social_projects")
      .select(`
        id, name, brand_color,
        company:companies(id, name, logo_url)
      `)
      .eq("status", "active")
      .order("name");
    
    if (projectsData) {
      const transformed = projectsData.map((p: any) => ({
        ...p,
        company: Array.isArray(p.company) ? p.company[0] || null : p.company,
      }));
      setProjects(transformed);
    }

    // Load all posts with project info
    const { data: postsData } = await supabaseClient
      .from("social_posts")
      .select(`
        id, project_id, platforms, caption, scheduled_date, scheduled_time,
        status, workflow_status, content_type, image_asset_url,
        shoot_status, shoot_date, created_at,
        project:social_projects(id, name, brand_color, company:companies(id, name, logo_url))
      `)
      .order("scheduled_date", { ascending: true });

    if (postsData) {
      const transformed = postsData.map((post: any) => ({
        ...post,
        project: post.project ? {
          ...post.project,
          company: Array.isArray(post.project.company) ? post.project.company[0] || null : post.project.company,
        } : null,
      }));
      setPosts(transformed);
    }
    
    setLoading(false);
  }

  async function updatePostDate(postId: string, newDate: Date) {
    const dateStr = newDate.toISOString();
    await supabaseClient
      .from("social_posts")
      .update({ scheduled_date: dateStr })
      .eq("id", postId);
    
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, scheduled_date: dateStr } : p))
    );
  }

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  // Build calendar grid with previous/next month days for complete weeks
  const calendarDays: { day: number; isCurrentMonth: boolean; date: Date }[] = [];
  
  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({
      day: prevMonthDays - i,
      isCurrentMonth: false,
      date: new Date(year, month - 1, prevMonthDays - i),
    });
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({
      day: i,
      isCurrentMonth: true,
      date: new Date(year, month, i),
    });
  }
  
  // Next month days to complete the grid (6 rows)
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({
      day: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i),
    });
  }

  // Filter posts
  const filteredPosts = posts.filter((post) => {
    // Brand filter
    if (selectedBrands.length > 0 && !selectedBrands.includes(post.project_id)) {
      return false;
    }
    // Content type filter
    if (selectedContentTypes.length > 0 && !selectedContentTypes.includes(post.content_type || "")) {
      return false;
    }
    // Workflow status filter
    if (statusFilter !== "all" && post.workflow_status !== statusFilter) {
      return false;
    }
    // Shoot filter
    if (shootFilter !== "all" && post.shoot_status !== shootFilter) {
      return false;
    }
    return true;
  });

  const getPostsForDate = (date: Date) => {
    return filteredPosts.filter((post) => {
      if (!post.scheduled_date) return false;
      const postDate = new Date(post.scheduled_date);
      return (
        postDate.getFullYear() === date.getFullYear() &&
        postDate.getMonth() === date.getMonth() &&
        postDate.getDate() === date.getDate()
      );
    });
  };

  const getWorkflowStyle = (status: WorkflowStatus | undefined) => {
    return WORKFLOW_COLORS[status || "new"];
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handleDragStart = (e: React.DragEvent, post: Post) => {
    setDraggedPost(post);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", post.id);
  };

  const handleDragEnd = () => {
    setDraggedPost(null);
    setDragOverDate(null);
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(dateKey);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    if (draggedPost) {
      updatePostDate(draggedPost.id, new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0, 0));
    }
    setDraggedPost(null);
    setDragOverDate(null);
    setIsDragging(false);
  };

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // Stats
  const totalPosts = filteredPosts.length;
  const postsWithShootPending = filteredPosts.filter(p => p.shoot_status === "pending").length;
  const contentTypeCounts = CONTENT_TYPES.reduce((acc, type) => {
    acc[type] = filteredPosts.filter(p => p.content_type === type).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/social-media"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span className="bg-gradient-to-r from-pink-500 to-fuchsia-600 bg-clip-text text-transparent">
                    Content Calendar 2026
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">
                    {totalPosts} posts
                  </span>
                </h1>
                <p className="text-sm text-slate-500">Drag & drop content across dates • Filter by brand or format</p>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <h2 className="min-w-[160px] text-center text-lg font-semibold text-slate-900">
                {monthNames[month]} {year}
              </h2>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`ml-2 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  showFilters
                    ? "border-pink-300 bg-pink-50 text-pink-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                </svg>
                Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Filters Sidebar */}
        {showFilters && (
          <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-80px)] sticky top-20">
            {/* Brand Filter */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                Brands
              </h3>
              <div className="space-y-1.5">
                <button
                  onClick={() => setSelectedBrands([])}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedBrands.length === 0
                      ? "bg-pink-100 text-pink-700 font-medium"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  All Brands ({projects.length})
                </button>
                {projects.map((project) => {
                  const postCount = posts.filter(p => p.project_id === project.id).length;
                  const isSelected = selectedBrands.includes(project.id);
                  return (
                    <button
                      key={project.id}
                      onClick={() => {
                        setSelectedBrands((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== project.id)
                            : [...prev, project.id]
                        );
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        isSelected
                          ? "bg-pink-100 text-pink-700 font-medium"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: project.brand_color || "#ec4899" }}
                      />
                      <span className="truncate flex-1">{project.company?.name || project.name}</span>
                      <span className="text-xs text-slate-400">({postCount})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Type Filter */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                  <line x1="7" y1="2" x2="7" y2="22" />
                  <line x1="17" y1="2" x2="17" y2="22" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <line x1="2" y1="7" x2="7" y2="7" />
                  <line x1="2" y1="17" x2="7" y2="17" />
                  <line x1="17" y1="17" x2="22" y2="17" />
                  <line x1="17" y1="7" x2="22" y2="7" />
                </svg>
                Content Format
              </h3>
              <div className="space-y-1.5">
                <button
                  onClick={() => setSelectedContentTypes([])}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedContentTypes.length === 0
                      ? "bg-purple-100 text-purple-700 font-medium"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  All Formats
                </button>
                {CONTENT_TYPES.map((type) => {
                  const count = contentTypeCounts[type] || 0;
                  const isSelected = selectedContentTypes.includes(type);
                  const icon = type === "Reel" ? "🎬" 
                    : type.includes("Carousel") ? "📱" 
                    : type === "Story" ? "⏱️"
                    : type === "Video" ? "🎥"
                    : type === "Live" ? "🔴"
                    : "📝";
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        setSelectedContentTypes((prev) =>
                          isSelected
                            ? prev.filter((t) => t !== type)
                            : [...prev, type]
                        );
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        isSelected
                          ? "bg-purple-100 text-purple-700 font-medium"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span>{icon}</span>
                      <span className="flex-1">{type}</span>
                      <span className="text-xs text-slate-400">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Workflow Status Filter */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                Workflow Status
              </h3>
              <div className="space-y-1.5">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    statusFilter === "all"
                      ? "bg-slate-800 text-white font-medium"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  All Status
                </button>
                {(Object.keys(WORKFLOW_COLORS) as WorkflowStatus[]).map((status) => {
                  const colors = WORKFLOW_COLORS[status];
                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        statusFilter === status
                          ? `${colors.bg} ${colors.text} font-medium`
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      {WORKFLOW_LABELS[status]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Shoot Status Filter */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Shoot Status
                {postsWithShootPending > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {postsWithShootPending} pending
                  </span>
                )}
              </h3>
              <div className="space-y-1.5">
                {["all", "pending", "scheduled", "completed"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setShootFilter(status as any)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors capitalize ${
                      shootFilter === status
                        ? "bg-amber-100 text-amber-700 font-medium"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {status === "all" ? "All Shoots" : status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        <div className="flex-1 p-4 sm:p-6 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm min-w-[800px]">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="px-2 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((dayInfo, idx) => {
                  const dateKey = formatDateKey(dayInfo.date);
                  const dayPosts = getPostsForDate(dayInfo.date);
                  const isDragOver = dragOverDate === dateKey;
                  const isTodayDate = isToday(dayInfo.date);

                  return (
                    <div
                      key={idx}
                      className={`min-h-[140px] border-b border-r border-slate-100 p-2 transition-all ${
                        dayInfo.isCurrentMonth ? "bg-white" : "bg-slate-50/50"
                      } ${isDragOver ? "bg-pink-50 ring-2 ring-inset ring-pink-400" : ""} ${
                        isDragging ? "cursor-copy" : ""
                      }`}
                      onDragOver={(e) => handleDragOver(e, dateKey)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, dayInfo.date)}
                    >
                      {/* Day Number */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-sm font-medium ${
                            isTodayDate
                              ? "flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white shadow-lg shadow-pink-500/30"
                              : dayInfo.isCurrentMonth
                              ? "text-slate-700"
                              : "text-slate-400"
                          }`}
                        >
                          {dayInfo.day}
                        </span>
                        {dayPosts.length > 0 && (
                          <span className="text-[10px] font-medium text-slate-400">
                            {dayPosts.length} post{dayPosts.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Posts */}
                      <div className="space-y-1">
                        {dayPosts.slice(0, 4).map((post) => {
                          const style = getWorkflowStyle(post.workflow_status);
                          const brandColor = post.project?.brand_color || "#ec4899";
                          const isHovered = hoveredPost === post.id;

                          return (
                            <div
                              key={post.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, post)}
                              onDragEnd={handleDragEnd}
                              onMouseEnter={() => setHoveredPost(post.id)}
                              onMouseLeave={() => setHoveredPost(null)}
                              className={`group cursor-grab active:cursor-grabbing rounded-lg overflow-hidden border transition-all ${
                                isHovered ? "scale-105 shadow-lg z-10 relative" : ""
                              } ${style.border} ${style.bg}`}
                              style={{
                                borderLeftWidth: "3px",
                                borderLeftColor: brandColor,
                              }}
                            >
                              {/* Mini Image Preview */}
                              {post.image_asset_url && (
                                <div className="h-8 w-full overflow-hidden">
                                  <img
                                    src={post.image_asset_url}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    draggable={false}
                                  />
                                </div>
                              )}
                              <div className="px-1.5 py-1">
                                <div className="flex items-center gap-1 mb-0.5">
                                  {/* Brand indicator */}
                                  <span
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: brandColor }}
                                    title={post.project?.company?.name || post.project?.name}
                                  />
                                  {/* Platforms */}
                                  {(post.platforms || []).slice(0, 2).map((p) => (
                                    <span key={p} className="text-[9px] opacity-70">
                                      {PLATFORM_ICONS[p.toLowerCase()] || "📱"}
                                    </span>
                                  ))}
                                  {/* Content type */}
                                  {post.content_type && (
                                    <span className="ml-auto text-[9px] text-slate-400 truncate max-w-[40px]">
                                      {post.content_type === "Reel" ? "🎬" : 
                                       post.content_type.includes("Carousel") ? "📱" : ""}
                                    </span>
                                  )}
                                  {/* Status dot */}
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${style.dot}`}
                                    title={WORKFLOW_LABELS[post.workflow_status || "new"]}
                                  />
                                </div>
                                <div className={`line-clamp-1 text-[10px] ${style.text}`}>
                                  {post.caption || "No caption"}
                                </div>
                              </div>

                              {/* Hover tooltip */}
                              {isHovered && (
                                <div className="absolute left-full top-0 ml-2 w-48 p-2 bg-white rounded-lg shadow-xl border border-slate-200 z-50 pointer-events-none">
                                  <p className="text-xs font-medium text-slate-900 mb-1">
                                    {post.project?.company?.name || post.project?.name}
                                  </p>
                                  <p className="text-[10px] text-slate-600 line-clamp-3 mb-1">
                                    {post.caption || "No caption"}
                                  </p>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    {post.content_type && <span>{post.content_type}</span>}
                                    <span>•</span>
                                    <span>{WORKFLOW_LABELS[post.workflow_status || "new"]}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {dayPosts.length > 4 && (
                          <div className="text-[10px] font-medium text-slate-500 pl-1">
                            +{dayPosts.length - 4} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Drag hint */}
          {isDragging && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-medium shadow-xl z-50 animate-bounce">
              Drop on a date to reschedule
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
