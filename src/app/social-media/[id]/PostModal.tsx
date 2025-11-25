"use client";

import { useState, useRef } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { PLATFORM_ICONS, EMOJI_LIST } from "./socialMediaUtils";

type Post = {
  id: string;
  platforms: string[];
  caption: string | null;
  media_urls: { url: string; type: "image" | "video" }[];
  scheduled_date: string | null;
  status: "draft" | "pending" | "approved" | "published";
  hashtags: string[];
};

type Props = {
  post: Post | null;
  projectId: string;
  availablePlatforms: string[];
  onClose: () => void;
  onSaved: () => void;
};

export default function PostModal({ post, projectId, availablePlatforms, onClose, onSaved }: Props) {
  const [platforms, setPlatforms] = useState<string[]>(post?.platforms || []);
  const [caption, setCaption] = useState(post?.caption || "");
  const [scheduledDate, setScheduledDate] = useState(post?.scheduled_date ? post.scheduled_date.slice(0, 16) : "");
  const [status, setStatus] = useState<Post["status"]>(post?.status || "draft");
  const [hashtags, setHashtags] = useState(post?.hashtags?.join(" ") || "");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  const hashtagCount = (caption.match(/#\w+/g) || []).length + (hashtags.match(/#?\w+/g) || []).length;

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const insertEmoji = (emoji: string) => {
    setCaption((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  async function handleSubmit() {
    setSaving(true);
    const postData = {
      project_id: projectId,
      platforms,
      caption,
      scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : null,
      status,
      hashtags: hashtags.split(/\s+/).filter(Boolean).map((h) => h.replace(/^#/, "")),
    };

    if (post) {
      await supabaseClient.from("social_posts").update(postData).eq("id", post.id);
    } else {
      await supabaseClient.from("social_posts").insert(postData);
    }
    setSaving(false);
    onSaved();
  }

  async function handleDelete() {
    if (!post || !confirm("Delete this post?")) return;
    await supabaseClient.from("social_posts").delete().eq("id", post.id);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{post ? "Edit Post" : "Create Post"}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Platforms */}
          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium text-slate-700">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {availablePlatforms.map((p) => (
                <button key={p} type="button" onClick={() => togglePlatform(p)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${platforms.includes(p) ? "border-pink-300 bg-pink-50 text-pink-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  {PLATFORM_ICONS[p.toLowerCase()]}
                  <span className="capitalize">{p}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Caption */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Caption</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{caption.length} chars</span>
                <span className="text-xs text-slate-500">#{hashtagCount} hashtags</span>
              </div>
            </div>
            <div className="relative">
              <textarea ref={captionRef} value={caption} onChange={(e) => setCaption(e.target.value)} rows={6}
                placeholder="Write your caption here..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 resize-none" />
              <div className="absolute bottom-3 right-3 flex items-center gap-1">
                <div className="relative">
                  <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">😀</button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                      <div className="grid grid-cols-8 gap-1">
                        {EMOJI_LIST.map((emoji) => (
                          <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100">{emoji}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Hashtags */}
          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium text-slate-700">Additional Hashtags</label>
            <input type="text" value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#marketing #socialmedia"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20" />
          </div>

          {/* Schedule */}
          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium text-slate-700">Schedule Date & Time</label>
            <input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20" />
          </div>

          {/* Status */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
            <div className="flex flex-wrap gap-2">
              {(["draft", "pending", "approved", "published"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all capitalize ${status === s ? "border-pink-300 bg-pink-50 text-pink-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{s}</button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            {post && (
              <button type="button" onClick={handleDelete} className="text-sm text-red-600 hover:text-red-700">Delete Post</button>
            )}
            <div className="ml-auto flex items-center gap-3">
              <button type="button" onClick={() => setShowPreview(!showPreview)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                {showPreview ? "Hide Preview" : "Preview"}
              </button>
              <button type="button" onClick={handleSubmit} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-pink-500/25 hover:shadow-xl disabled:opacity-50">
                {saving ? "Saving..." : post ? "Update Post" : "Create Post"}
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="w-80 border-l border-slate-200 bg-slate-50 p-6">
            <h3 className="mb-4 text-sm font-medium text-slate-700">Mobile Preview</h3>
            <div className="mx-auto w-[240px] rounded-[2rem] border-4 border-slate-800 bg-white p-2 shadow-xl">
              <div className="h-[420px] overflow-hidden rounded-[1.5rem] bg-white">
                <div className="border-b border-slate-100 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600" />
                    <span className="text-xs font-medium">your_brand</span>
                  </div>
                </div>
                <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                  <svg className="h-12 w-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <div className="p-3">
                  <p className="text-xs text-slate-900 line-clamp-4">{caption || "Your caption will appear here..."}</p>
                  {hashtags && <p className="mt-1 text-xs text-blue-600">{hashtags}</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
