"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import Link from "next/link";
import { useParams } from "next/navigation";
import DanoteCanvas from "./DanoteCanvas";

type Board = {
  id: string;
  name: string;
  description: string | null;
};

export default function BoardPage() {
  const params = useParams();
  const boardId = params.boardId as string;
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBoard() {
      const { data } = await supabaseClient
        .from("danote_boards")
        .select("*")
        .eq("id", boardId)
        .single();
      if (data) setBoard(data as Board);
      setLoading(false);
    }
    loadBoard();
  }, [boardId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <p className="text-slate-500">Board not found</p>
        <Link href="/danote" className="mt-4 text-cyan-600 hover:underline">
          Back to boards
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 top-[60px] flex flex-col bg-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/danote"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <h1 className="font-semibold text-slate-900">{board.name}</h1>
            {board.description && (
              <p className="text-xs text-slate-500">{board.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <DanoteCanvas boardId={boardId} />
    </div>
  );
}
