"use client";

import { useRouter } from "next/navigation";
import { useTasksNotifications } from "@/components/TasksNotificationsContext";

export default function HeaderNotificationsButton() {
  const router = useRouter();
  const { openTasksCount } = useTasksNotifications();

  const count = openTasksCount ?? 0;
  const displayCount = count > 9 ? "9+" : count;
  const hasOpen = count > 0;

  return (
    <button
      type="button"
      onClick={() => router.push("/notifications")}
      className="group relative inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600 shadow-sm transition-all hover:from-amber-500 hover:to-orange-500 hover:text-white hover:shadow-lg hover:shadow-amber-500/25 active:scale-95"
    >
      <span className="sr-only">Task notifications</span>
      <svg
        className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:scale-110"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {hasOpen ? (
        <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 inline-flex min-h-[16px] min-w-[16px] sm:min-h-[18px] sm:min-w-[18px] items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1 text-[9px] sm:text-[10px] font-bold text-white shadow-lg shadow-rose-500/30 ring-2 ring-white">
          {displayCount}
        </span>
      ) : null}
    </button>
  );
}
