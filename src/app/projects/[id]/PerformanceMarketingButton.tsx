"use client";

import Link from "next/link";

export default function PerformanceMarketingButton({
  projectId,
}: {
  projectId: string;
}) {
  return (
    <Link
      href={`/projects/${projectId}/performance-marketing`}
      className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-green-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700 shadow-sm hover:from-emerald-100 hover:to-green-100 transition-all"
    >
      <svg
        className="h-3.5 w-3.5 text-emerald-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3v18h18" />
        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
        <circle cx="18.7" cy="8" r="2" fill="currentColor" stroke="none" />
      </svg>
      <span>Performance Marketing</span>
    </Link>
  );
}
