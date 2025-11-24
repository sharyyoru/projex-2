"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Mode = "operations" | "admin";

export default function ProjectModeToggle({
  projectId,
  mode,
}: {
  projectId: string;
  mode: Mode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleModeChange(nextMode: Mode) {
    if (nextMode === mode) return;

    const params = new URLSearchParams(searchParams?.toString());

    if (nextMode === "operations") {
      params.delete("mode");
    } else {
      params.set("mode", nextMode);
    }

    const query = params.toString();
    const href = query ? `/projects/${projectId}?${query}` : `/projects/${projectId}`;

    router.replace(href);
    router.refresh();
  }

  return (
    <div className="inline-flex rounded-full border border-slate-300/70 bg-gradient-to-r from-slate-200/80 via-slate-300/80 to-slate-400/80 p-0.5 text-[11px] shadow-[0_4px_12px_rgba(15,23,42,0.18)] backdrop-blur">
      <button
        type="button"
        onClick={() => handleModeChange("operations")}
        className={
          "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors transition-shadow duration-200 " +
          (mode === "operations"
            ? "bg-emerald-500/90 text-white shadow-[0_3px_8px_rgba(16,185,129,0.45)] border border-emerald-200/80"
            : "bg-transparent text-slate-800/80 hover:bg-white/20 border border-transparent")
        }
      >
        Operations
      </button>
      <button
        type="button"
        onClick={() => handleModeChange("admin")}
        className={
          "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors transition-shadow duration-200 " +
          (mode === "admin"
            ? "bg-sky-500/90 text-white shadow-[0_3px_8px_rgba(56,189,248,0.45)] border border-sky-200/80"
            : "bg-transparent text-slate-800/80 hover:bg-white/20 border border-transparent")
        }
      >
        Admin
      </button>
    </div>
  );
}
