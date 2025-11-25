"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabaseClient } from "@/lib/supabaseClient";

interface CurrentUserInfo {
  fullName: string;
  displayName: string;
  initials: string;
  role: string;
  avatarUrl: string | null;
}

export default function HeaderUser() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<CurrentUserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const { data } = await supabaseClient.auth.getUser();
      if (!isMounted) return;

      const user = data.user;
      if (!user) {
        setUserInfo(null);
        setLoading(false);
        return;
      }

      const meta = (user.user_metadata || {}) as Record<string, unknown>;
      const firstName = (meta["first_name"] as string) || "";
      const lastName = (meta["last_name"] as string) || "";
      const role = ((meta["role"] as string) || "Staff").toString();
      const avatarUrl = (meta["avatar_url"] as string) || null;

      const fullName =
        [firstName, lastName].filter(Boolean).join(" ") ||
        (user.email ?? "User");

      const displayName =
        firstName ||
        (fullName.split(" ")[0] || fullName);

      const initialsSource = fullName || user.email || "?";
      const parts = initialsSource.split(" ");
      const initials = (parts[0]?.[0] ?? "").toUpperCase() +
        (parts[1]?.[0] ?? "").toUpperCase();

      setUserInfo({
        fullName,
        displayName,
        initials: initials || "U",
        role,
        avatarUrl,
      });
      setLoading(false);
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  async function confirmLogout() {
    await supabaseClient.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading || !userInfo) {
    return (
      <div className="ml-1 flex items-center gap-2 rounded-full bg-white/80 px-2.5 py-1 text-[11px] text-slate-400 shadow-sm">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium text-slate-600">
          --
        </div>
        <div className="hidden flex-col sm:flex">
          <span className="font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={() => router.push("/profile")}
        className="group ml-0.5 sm:ml-1 inline-flex h-9 sm:h-10 items-center gap-1.5 sm:gap-2.5 rounded-xl bg-gradient-to-br from-white via-white to-slate-50 px-2 sm:px-3 shadow-sm ring-1 ring-slate-200/50 transition-all hover:shadow-md hover:ring-violet-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70 active:scale-95"
      >
        <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 text-[10px] sm:text-[11px] font-bold text-white shadow-sm shadow-violet-500/30 transition-transform group-hover:scale-105">
          {userInfo.avatarUrl ? (
            <Image
              src={userInfo.avatarUrl}
              alt={userInfo.fullName || "Avatar"}
              width={28}
              height={28}
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{userInfo.initials}</span>
          )}
        </div>
        <div className="hidden text-[12px] font-semibold text-slate-700 md:block">
          <span className="truncate max-w-[140px]">
            {userInfo.displayName}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="group inline-flex h-9 sm:h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 px-2.5 sm:px-3 text-[12px] font-medium text-slate-600 shadow-sm transition-all hover:from-red-500 hover:to-rose-500 hover:text-white hover:shadow-lg hover:shadow-red-500/25 active:scale-95"
      >
        <svg className="h-4 w-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
        <span className="hidden sm:inline">Logout</span>
      </button>

      {confirmOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-white/70 bg-white/95 p-4 text-xs shadow-[0_18px_40px_rgba(15,23,42,0.25)]">
            <h2 className="text-sm font-semibold text-slate-900">Sign out</h2>
            <p className="mt-1 text-xs text-slate-500">
              Are you sure you want to log out?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="inline-flex items-center rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmOpen(false);
                  await confirmLogout();
                }}
                className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-[0_8px_20px_rgba(15,23,42,0.25)] hover:bg-sky-700"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
