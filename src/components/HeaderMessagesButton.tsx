"use client";

import { useRouter } from "next/navigation";
import { useMessagesUnread } from "@/components/MessagesUnreadContext";

export default function HeaderMessagesButton() {
  const router = useRouter();
  const { unreadCount } = useMessagesUnread();

  const displayCount = unreadCount && unreadCount > 9 ? "9+" : unreadCount ?? 0;
  const hasUnread = (unreadCount ?? 0) > 0;

  return (
    <button
      type="button"
      onClick={() => router.push("/messages")}
      className="group relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-cyan-100 text-sky-600 shadow-sm transition-all hover:from-sky-500 hover:to-cyan-500 hover:text-white hover:shadow-lg hover:shadow-sky-500/25"
    >
      <span className="sr-only">Messages</span>
      <svg
        className="h-5 w-5 transition-transform group-hover:scale-110"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 10h.01" />
        <path d="M12 10h.01" />
        <path d="M16 10h.01" />
      </svg>
      {hasUnread ? (
        <span className="absolute -top-1 -right-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-blue-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-sky-500/30 ring-2 ring-white">
          {displayCount}
        </span>
      ) : null}
    </button>
  );
}
