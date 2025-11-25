"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function HeaderSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const externalQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(externalQuery);

  useEffect(() => {
    setValue(externalQuery);
  }, [externalQuery]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;

    const params = new URLSearchParams();
    params.set("q", query);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full group">
      <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-sky-400/40 via-emerald-400/40 to-violet-400/40 opacity-0 blur-sm transition duration-300 group-hover:opacity-100" />
      <div className="relative flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-[11px] text-slate-600 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/90 text-[10px] text-white shadow-sm">
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="6" />
            <path d="m16 16 4 4" />
          </svg>
        </div>
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search patients, deals, tasks, services..."
          className="w-full border-0 bg-transparent text-[11px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          className="hidden sm:inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          Search
        </button>
      </div>
    </form>
  );
}

