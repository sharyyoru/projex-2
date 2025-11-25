"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

type DanoteBoard = {
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

export default function ProjectDanoteButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [board, setBoard] = useState<DanoteBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadBoard();
  }, [projectId]);

  async function loadBoard() {
    setLoading(true);
    const { data } = await supabaseClient
      .from("danote_boards")
      .select("id, name")
      .eq("project_id", projectId)
      .maybeSingle();
    if (data) setBoard(data as DanoteBoard);
    setLoading(false);
  }

  async function createBoard() {
    if (!boardName.trim()) return;
    setCreating(true);

    const { data: { user } } = await supabaseClient.auth.getUser();
    const randomColor = BOARD_COLORS[Math.floor(Math.random() * BOARD_COLORS.length)];

    const { data, error } = await supabaseClient
      .from("danote_boards")
      .insert({
        name: boardName.trim(),
        description: `Board for project: ${projectName}`,
        user_id: user?.id,
        project_id: projectId,
        thumbnail_color: randomColor,
      })
      .select("id, name")
      .single();

    if (!error && data) {
      setBoard(data as DanoteBoard);
      setShowModal(false);
      setBoardName("");
      router.push(`/danote/${data.id}`);
    }
    setCreating(false);
  }

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-400 shadow-sm">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
        <span>Danote</span>
      </div>
    );
  }

  if (board) {
    return (
      <Link
        href={`/danote/${board.id}`}
        className="inline-flex items-center gap-1 rounded-full border border-cyan-200/80 bg-gradient-to-r from-cyan-50 to-teal-50 px-3 py-1.5 text-[11px] font-medium text-cyan-700 shadow-sm hover:from-cyan-100 hover:to-teal-100 transition-all"
      >
        <svg
          className="h-3.5 w-3.5 text-cyan-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <span>View Board</span>
      </Link>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          setBoardName(`${projectName} Board`);
          setShowModal(true);
        }}
        className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
      >
        <svg
          className="h-3.5 w-3.5 text-slate-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 17h7M17.5 14v7" />
        </svg>
        <span>Create Board</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Create Danote Board</h2>
                <p className="text-xs text-slate-500">for {projectName}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Board Name *
                </label>
                <input
                  type="text"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  placeholder="e.g., Project Moodboard"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={createBoard}
                disabled={creating || !boardName.trim()}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create & Open"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
