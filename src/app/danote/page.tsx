"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import Link from "next/link";

type Board = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  thumbnail_color: string;
  project_id: string | null;
  project?: { id: string; name: string } | null;
};

type Project = {
  id: string;
  name: string;
};

const BOARD_COLORS = [
  "from-violet-500 to-purple-500",
  "from-cyan-500 to-teal-500",
  "from-pink-500 to-rose-500",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-green-500",
  "from-blue-500 to-indigo-500",
];

export default function DanotePage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDesc, setNewBoardDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    loadBoards();
  }, []);

  async function loadBoards() {
    setLoading(true);
    const { data } = await supabaseClient
      .from("danote_boards")
      .select("*, projects:project_id(id, name)")
      .order("updated_at", { ascending: false });
    if (data) {
      const mapped = data.map((b: any) => ({
        ...b,
        project: b.projects || null,
      }));
      setBoards(mapped as Board[]);
    }
    setLoading(false);
  }

  async function loadProjects() {
    const { data } = await supabaseClient
      .from("projects")
      .select("id, name")
      .order("name");
    if (data) setProjects(data as Project[]);
  }

  async function openLinkModal(boardId: string) {
    const board = boards.find((b) => b.id === boardId);
    setSelectedProjectId(board?.project_id || null);
    setShowLinkModal(boardId);
    if (projects.length === 0) await loadProjects();
  }

  async function linkBoardToProject() {
    if (!showLinkModal) return;
    setLinking(true);
    await supabaseClient
      .from("danote_boards")
      .update({ project_id: selectedProjectId })
      .eq("id", showLinkModal);
    setBoards((prev) =>
      prev.map((b) =>
        b.id === showLinkModal
          ? { ...b, project_id: selectedProjectId, project: projects.find((p) => p.id === selectedProjectId) || null }
          : b
      )
    );
    setShowLinkModal(null);
    setLinking(false);
  }

  async function createBoard() {
    if (!newBoardName.trim()) return;
    setCreating(true);
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    const randomColor = BOARD_COLORS[Math.floor(Math.random() * BOARD_COLORS.length)];
    
    const { data, error } = await supabaseClient
      .from("danote_boards")
      .insert({
        name: newBoardName.trim(),
        description: newBoardDesc.trim() || null,
        user_id: user?.id,
        thumbnail_color: randomColor,
      })
      .select()
      .single();

    if (!error && data) {
      setBoards((prev) => [data as Board, ...prev]);
      setNewBoardName("");
      setNewBoardDesc("");
      setShowNewModal(false);
    }
    setCreating(false);
  }

  async function deleteBoard(boardId: string) {
    if (!confirm("Are you sure you want to delete this board?")) return;
    await supabaseClient.from("danote_boards").delete().eq("id", boardId);
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Danote</h1>
          <p className="text-sm text-slate-500">Visual collaboration boards for creative work</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Board
        </button>
      </div>

      {/* Boards Grid */}
      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-teal-100 text-cyan-600">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-slate-900">No boards yet</h3>
          <p className="mb-4 text-sm text-slate-500">Create your first visual collaboration board</p>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-500/25"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create Board
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boards.map((board) => (
            <div
              key={board.id}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white shadow-lg shadow-slate-200/30 transition-all hover:shadow-xl hover:shadow-slate-200/40"
            >
              <Link href={`/danote/${board.id}`}>
                <div className={`h-32 bg-gradient-to-br ${board.thumbnail_color || 'from-cyan-500 to-teal-500'} relative overflow-hidden`}>
                  {/* Decorative elements */}
                  <div className="absolute top-4 left-4 h-8 w-12 rounded bg-white/20" />
                  <div className="absolute top-4 right-4 h-8 w-8 rounded bg-white/20" />
                  <div className="absolute bottom-4 left-4 h-16 w-20 rounded bg-white/20" />
                  <div className="absolute bottom-4 right-8 h-10 w-10 rounded bg-white/20" />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 truncate">{board.name}</h3>
                  {board.description && (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{board.description}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    Updated {new Date(board.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </Link>
              {board.project && (
                <div className="absolute top-2 left-2 rounded-lg bg-emerald-500/90 px-2 py-1 text-[10px] font-medium text-white shadow-sm">
                  {board.project.name}
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-all group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openLinkModal(board.id);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-400 shadow-sm transition-all hover:text-cyan-500"
                  title="Link to project"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteBoard(board.id);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-400 shadow-sm transition-all hover:text-red-500"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Board Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Create New Board</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Board Name *
                </label>
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="e.g., Q1 Campaign Moodboard"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Description
                </label>
                <textarea
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 resize-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowNewModal(false)}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={createBoard}
                disabled={creating || !newBoardName.trim()}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Board"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link to Project Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Link Board to Project</h2>
            <p className="mb-4 text-sm text-slate-500">Connect this board to a project for better organization.</p>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">
                Select Project
              </label>
              <select
                value={selectedProjectId || ""}
                onChange={(e) => setSelectedProjectId(e.target.value || null)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                <option value="">No project (standalone board)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowLinkModal(null)}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={linkBoardToProject}
                disabled={linking}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 disabled:opacity-50"
              >
                {linking ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
