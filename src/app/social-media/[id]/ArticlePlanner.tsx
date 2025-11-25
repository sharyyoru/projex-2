"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { STATUS_STYLES, CONTENT_PILLARS } from "./socialMediaUtils";

type Article = {
  id: string;
  title: string;
  slug: string | null;
  body_html: string | null;
  body_markdown: string | null;
  featured_image_url: string | null;
  status: "draft" | "pending" | "approved" | "published";
  target_keyword: string | null;
  meta_title: string | null;
  meta_description: string | null;
  content_pillar: string | null;
  internal_links: { url: string; text: string }[];
  external_links: { url: string; text: string }[];
  scheduled_date: string | null;
  published_url: string | null;
  created_at: string;
};

export default function ArticlePlanner({ projectId }: { projectId: string }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);

  useEffect(() => {
    loadArticles();
  }, [projectId]);

  async function loadArticles() {
    setLoading(true);
    const { data } = await supabaseClient
      .from("social_articles")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (data) setArticles(data as Article[]);
    setLoading(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Blog & Articles</h2>
          <p className="text-sm text-slate-500">Manage SEO-optimized long-form content</p>
        </div>
        <button onClick={() => { setEditingArticle(null); setShowModal(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-pink-500/25 hover:shadow-xl">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          New Article
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" /></div>
      ) : articles.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-fuchsia-100 text-pink-500">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14,2 14,8 20,8" /></svg>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-slate-900">No articles yet</h3>
          <p className="text-sm text-slate-500">Create your first SEO-optimized blog article</p>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
            <div key={article.id} onClick={() => { setEditingArticle(article); setShowModal(true); }}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-pink-200 hover:shadow-lg hover:shadow-pink-500/10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[article.status].bg} ${STATUS_STYLES[article.status].text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[article.status].dot}`} />{article.status}
                    </span>
                    {article.content_pillar && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                        {CONTENT_PILLARS.find(p => p.value === article.content_pillar)?.label || article.content_pillar}
                      </span>
                    )}
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-slate-900">{article.title}</h3>
                  {article.target_keyword && (
                    <div className="mb-2 flex items-center gap-1 text-xs text-slate-500">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                      Target: {article.target_keyword}
                    </div>
                  )}
                  {article.meta_description && (
                    <p className="line-clamp-2 text-sm text-slate-600">{article.meta_description}</p>
                  )}
                </div>
                <div className="text-right text-xs text-slate-500">
                  {article.scheduled_date ? new Date(article.scheduled_date).toLocaleDateString() : "Not scheduled"}
                </div>
              </div>
              {/* SEO Score indicator */}
              <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Meta Title:</span>
                  <span className={`text-xs font-medium ${article.meta_title ? (article.meta_title.length <= 60 ? "text-emerald-600" : "text-amber-600") : "text-slate-400"}`}>
                    {article.meta_title ? `${article.meta_title.length}/60` : "Missing"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Meta Desc:</span>
                  <span className={`text-xs font-medium ${article.meta_description ? (article.meta_description.length <= 160 ? "text-emerald-600" : "text-amber-600") : "text-slate-400"}`}>
                    {article.meta_description ? `${article.meta_description.length}/160` : "Missing"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ArticleModal article={editingArticle} projectId={projectId}
          onClose={() => { setShowModal(false); setEditingArticle(null); }}
          onSaved={() => { setShowModal(false); setEditingArticle(null); loadArticles(); }} />
      )}
    </div>
  );
}

function ArticleModal({ article, projectId, onClose, onSaved }: { article: Article | null; projectId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(article?.title || "");
  const [slug, setSlug] = useState(article?.slug || "");
  const [bodyMarkdown, setBodyMarkdown] = useState(article?.body_markdown || "");
  const [status, setStatus] = useState<Article["status"]>(article?.status || "draft");
  const [targetKeyword, setTargetKeyword] = useState(article?.target_keyword || "");
  const [metaTitle, setMetaTitle] = useState(article?.meta_title || "");
  const [metaDescription, setMetaDescription] = useState(article?.meta_description || "");
  const [contentPillar, setContentPillar] = useState(article?.content_pillar || "");
  const [scheduledDate, setScheduledDate] = useState(article?.scheduled_date ? article.scheduled_date.slice(0, 16) : "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    const data = {
      project_id: projectId,
      title,
      slug: slug || title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      body_markdown: bodyMarkdown,
      status,
      target_keyword: targetKeyword || null,
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
      content_pillar: contentPillar || null,
      scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : null,
    };

    if (article) {
      await supabaseClient.from("social_articles").update(data).eq("id", article.id);
    } else {
      await supabaseClient.from("social_articles").insert(data);
    }
    setSaving(false);
    onSaved();
  }

  async function handleDelete() {
    if (!article || !confirm("Delete this article?")) return;
    await supabaseClient.from("social_articles").delete().eq("id", article.id);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">{article ? "Edit Article" : "New Article"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20" placeholder="Article title" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Content (Markdown)</label>
                <textarea value={bodyMarkdown} onChange={(e) => setBodyMarkdown(e.target.value)} rows={16}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 resize-none"
                  placeholder="# Introduction&#10;&#10;Write your article content here using Markdown..." />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as Article["status"])}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20">
                  <option value="draft">Draft</option>
                  <option value="pending">Pending Review</option>
                  <option value="approved">Approved</option>
                  <option value="published">Published</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Content Pillar</label>
                <select value={contentPillar} onChange={(e) => setContentPillar(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20">
                  <option value="">Select a pillar</option>
                  {CONTENT_PILLARS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Schedule Date</label>
                <input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20" />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-900">SEO Settings</h4>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Target Keyword</label>
                    <input type="text" value={targetKeyword} onChange={(e) => setTargetKeyword(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-pink-300 focus:outline-none" placeholder="main keyword" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-600">Meta Title</label>
                      <span className={`text-xs ${metaTitle.length > 60 ? "text-amber-600" : "text-slate-400"}`}>{metaTitle.length}/60</span>
                    </div>
                    <input type="text" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-pink-300 focus:outline-none" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-600">Meta Description</label>
                      <span className={`text-xs ${metaDescription.length > 160 ? "text-amber-600" : "text-slate-400"}`}>{metaDescription.length}/160</span>
                    </div>
                    <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={3}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-pink-300 focus:outline-none resize-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">URL Slug</label>
                    <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-pink-300 focus:outline-none" placeholder="article-url-slug" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
            {article && <button type="button" onClick={handleDelete} className="text-sm text-red-600 hover:text-red-700">Delete</button>}
            <div className="ml-auto flex items-center gap-3">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={handleSubmit} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-pink-500/25 hover:shadow-xl disabled:opacity-50">
                {saving ? "Saving..." : article ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
