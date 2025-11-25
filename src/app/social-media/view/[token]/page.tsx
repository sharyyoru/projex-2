"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import { supabaseClient } from "@/lib/supabaseClient";

type PublicLink = {
  id: string;
  project_id: string;
  link_type: "content_review" | "report";
  expires_at: string | null;
};

type SocialProject = {
  id: string;
  name: string;
  brand_color: string | null;
  logo_url: string | null;
  company: { name: string; logo_url: string | null } | null;
};

type Post = {
  id: string;
  platforms: string[];
  caption: string | null;
  media_urls: { url: string; type: "image" | "video" }[];
  scheduled_date: string | null;
  status: string;
};

type Feedback = {
  id: string;
  post_id: string | null;
  action: "approved" | "changes_requested";
  client_name: string;
  comment: string | null;
  created_at: string;
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/></svg>,
  linkedin: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/></svg>,
  tiktok: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>,
  x: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  facebook: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
};

export default function PublicViewPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const [link, setLink] = useState<PublicLink | null>(null);
  const [project, setProject] = useState<SocialProject | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [resolvedParams.token]);

  async function loadData() {
    setLoading(true);
    
    // Get link
    const { data: linkData, error: linkError } = await supabaseClient
      .from("social_public_links")
      .select("*")
      .eq("token", resolvedParams.token)
      .single();

    if (linkError || !linkData) {
      setError("Invalid or expired link");
      setLoading(false);
      return;
    }

    // Check expiry
    if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
      setError("This link has expired");
      setLoading(false);
      return;
    }

    setLink(linkData as PublicLink);

    // Get project
    const { data: projectData } = await supabaseClient
      .from("social_projects")
      .select("id, name, brand_color, logo_url, company:companies(name, logo_url)")
      .eq("id", linkData.project_id)
      .single();

    if (projectData) {
      setProject({
        ...projectData,
        company: Array.isArray(projectData.company) ? projectData.company[0] : projectData.company,
      } as SocialProject);
    }

    // Get content for review
    if (linkData.link_type === "content_review") {
      const { data: postsData } = await supabaseClient
        .from("social_posts")
        .select("*")
        .eq("project_id", linkData.project_id)
        .in("status", ["pending", "approved"])
        .order("scheduled_date", { ascending: true });

      if (postsData) setPosts(postsData as Post[]);

      // Get existing feedback
      const postIds = (postsData || []).map((p: any) => p.id);
      if (postIds.length > 0) {
        const { data: feedbackData } = await supabaseClient
          .from("social_content_feedback")
          .select("*")
          .in("post_id", postIds)
          .order("created_at", { ascending: false });

        if (feedbackData) setFeedback(feedbackData as Feedback[]);
      }
    }

    // Check for stored client name
    const storedName = localStorage.getItem(`client_name_${resolvedParams.token}`);
    if (storedName) {
      setClientName(storedName);
    }

    setLoading(false);
  }

  async function submitFeedback(postId: string, action: "approved" | "changes_requested") {
    if (!clientName) {
      setShowNamePrompt(true);
      return;
    }

    setSubmitting(true);
    
    const { data, error } = await supabaseClient
      .from("social_content_feedback")
      .insert({
        post_id: postId,
        action,
        client_name: clientName,
        comment: comment || null,
      })
      .select()
      .single();

    if (!error && data) {
      setFeedback((prev) => [data as Feedback, ...prev]);
      setSelectedPost(null);
      setComment("");
    }
    
    setSubmitting(false);
  }

  function saveClientName() {
    localStorage.setItem(`client_name_${resolvedParams.token}`, clientName);
    setShowNamePrompt(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-500">
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-900">{error}</h1>
        <p className="text-sm text-slate-500">Please contact your account manager for a new link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            {project?.company?.logo_url ? (
              <Image src={project.company.logo_url} alt="" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white font-bold">
                {project?.name?.charAt(0) || "?"}
              </div>
            )}
            <div>
              <h1 className="font-semibold text-slate-900">{project?.name}</h1>
              <p className="text-xs text-slate-500">{project?.company?.name}</p>
            </div>
          </div>
          {clientName && (
            <div className="text-sm text-slate-500">
              Reviewing as <span className="font-medium text-slate-700">{clientName}</span>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        {link?.link_type === "content_review" && (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Content for Review</h2>
              <p className="text-sm text-slate-500">Review scheduled posts and provide feedback</p>
            </div>

            {posts.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                <p className="text-slate-500">No content pending review at this time.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => {
                  const postFeedback = feedback.filter((f) => f.post_id === post.id);
                  const latestFeedback = postFeedback[0];

                  return (
                    <div key={post.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      {/* Media */}
                      <div className="aspect-square bg-slate-100 relative">
                        {post.media_urls?.[0] ? (
                          post.media_urls[0].type === "video" ? (
                            <video src={post.media_urls[0].url} className="h-full w-full object-cover" controls />
                          ) : (
                            <Image src={post.media_urls[0].url} alt="" fill className="object-cover" />
                          )
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-300">
                            <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                          </div>
                        )}
                        {/* Status badge */}
                        {latestFeedback && (
                          <div className={`absolute top-2 right-2 rounded-full px-2 py-1 text-xs font-medium ${latestFeedback.action === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {latestFeedback.action === "approved" ? "Approved" : "Changes Requested"}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <div className="mb-2 flex items-center gap-1.5">
                          {(post.platforms || []).map((p) => (
                            <span key={p} className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                              {PLATFORM_ICONS[p.toLowerCase()]}
                            </span>
                          ))}
                        </div>
                        <p className="mb-2 line-clamp-3 text-sm text-slate-700">{post.caption || "No caption"}</p>
                        <div className="text-xs text-slate-500">
                          Scheduled: {post.scheduled_date ? new Date(post.scheduled_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "TBD"}
                        </div>

                        {/* Actions */}
                        <div className="mt-4 flex gap-2">
                          <button onClick={() => submitFeedback(post.id, "approved")}
                            className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600">
                            Approve
                          </button>
                          <button onClick={() => setSelectedPost(post)}
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                            Request Changes
                          </button>
                        </div>

                        {/* Previous feedback */}
                        {postFeedback.length > 0 && (
                          <div className="mt-3 border-t border-slate-100 pt-3">
                            <p className="text-xs font-medium text-slate-500 mb-2">Feedback History</p>
                            {postFeedback.slice(0, 2).map((f) => (
                              <div key={f.id} className="text-xs text-slate-600 mb-1">
                                <span className="font-medium">{f.client_name}</span>: {f.action === "approved" ? "Approved" : f.comment || "Changes requested"}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Name Prompt Modal */}
      {showNamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Enter Your Name</h3>
            <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Your name"
              className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-pink-300 focus:outline-none" />
            <button onClick={saveClientName} disabled={!clientName.trim()}
              className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Request Changes</h3>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4}
              placeholder="Describe the changes you'd like..."
              className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-pink-300 focus:outline-none resize-none" />
            <div className="flex gap-3">
              <button onClick={() => { setSelectedPost(null); setComment(""); }}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => submitFeedback(selectedPost.id, "changes_requested")} disabled={submitting}
                className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
