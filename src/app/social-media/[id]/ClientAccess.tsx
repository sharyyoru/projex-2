"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type PublicLink = {
  id: string;
  token: string;
  link_type: "content_review" | "report";
  expires_at: string | null;
  created_at: string;
};

type Props = {
  projectId: string;
  projectName: string;
};

export default function ClientAccess({ projectId, projectName }: Props) {
  const [links, setLinks] = useState<PublicLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadLinks();
  }, [projectId]);

  async function loadLinks() {
    setLoading(true);
    const { data } = await supabaseClient
      .from("social_public_links")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (data) setLinks(data as PublicLink[]);
    setLoading(false);
  }

  async function generateLink(type: "content_review" | "report", expiryDays: number) {
    setGenerating(true);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const { data, error } = await supabaseClient
      .from("social_public_links")
      .insert({
        project_id: projectId,
        link_type: type,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (!error && data) {
      setLinks((prev) => [data as PublicLink, ...prev]);
    }
    setGenerating(false);
  }

  async function deleteLink(id: string) {
    if (!confirm("Delete this link? Clients with this link will no longer have access.")) return;
    await supabaseClient.from("social_public_links").delete().eq("id", id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  const copyLink = (link: PublicLink) => {
    const url = `${window.location.origin}/social-media/view/${link.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Client Access</h2>
        <p className="text-sm text-slate-500">Generate secure magic links for client content review</p>
      </div>

      {/* Generate Link Section */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Generate New Link</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 to-fuchsia-100 text-pink-600">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-slate-900">Content Review</h4>
                <p className="text-xs text-slate-500">View and approve scheduled content</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => generateLink("content_review", 7)} disabled={generating}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">7 days</button>
              <button onClick={() => generateLink("content_review", 14)} disabled={generating}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">14 days</button>
              <button onClick={() => generateLink("content_review", 30)} disabled={generating}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">30 days</button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v18h18" />
                  <path d="M18 17V9" />
                  <path d="M13 17V5" />
                  <path d="M8 17v-3" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-slate-900">Monthly Report</h4>
                <p className="text-xs text-slate-500">View analytics and KPIs</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => generateLink("report", 7)} disabled={generating}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">7 days</button>
              <button onClick={() => generateLink("report", 14)} disabled={generating}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">14 days</button>
              <button onClick={() => generateLink("report", 30)} disabled={generating}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">30 days</button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Links */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Active Links</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" />
          </div>
        ) : links.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">No active links. Generate one above to share with clients.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {links.map((link) => {
              const expired = isExpired(link.expires_at);
              return (
                <div key={link.id} className={`flex items-center gap-4 px-6 py-4 ${expired ? "opacity-50" : ""}`}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${link.link_type === "content_review" ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600"}`}>
                    {link.link_type === "content_review" ? (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 capitalize">{link.link_type.replace("_", " ")}</span>
                      {expired && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600">Expired</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>Created {new Date(link.created_at).toLocaleDateString()}</span>
                      {link.expires_at && <span>Expires {new Date(link.expires_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyLink(link)} disabled={expired}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                      {copiedId === link.id ? (
                        <><svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
                      ) : (
                        <><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy Link</>
                      )}
                    </button>
                    <button onClick={() => deleteLink(link.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <svg className="h-5 w-5 flex-shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-amber-800">How Magic Links Work</p>
            <ul className="mt-1 space-y-1 text-amber-700">
              <li>• Links provide read-only access without requiring login</li>
              <li>• Clients can approve/reject content and leave comments</li>
              <li>• Links automatically expire after the selected duration</li>
              <li>• You can revoke access anytime by deleting the link</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
