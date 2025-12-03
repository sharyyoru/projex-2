"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";

interface ServerPreview {
  id: string;
  name: string;
  icon_url: string | null;
  member_count: number;
  description: string | null;
}

export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [server, setServer] = useState<ServerPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const fetchInvite = async () => {
      setLoading(true);
      
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user) {
        setCurrentUser({ id: session.user.id });
      }

      // Try to find by invite code first
      let { data: invite } = await supabaseClient
        .from("dischat_invites")
        .select("*, server:dischat_servers(id, name, icon_url, member_count, description)")
        .eq("code", code)
        .single();

      // If not found, try the server's permanent invite code
      if (!invite) {
        const { data: serverData } = await supabaseClient
          .from("dischat_servers")
          .select("id, name, icon_url, member_count, description")
          .eq("invite_code", code)
          .single();

        if (serverData) {
          setServer(serverData);
          
          // Check if already a member
          if (session?.user) {
            const { data: membership } = await supabaseClient
              .from("dischat_members")
              .select("id")
              .eq("server_id", serverData.id)
              .eq("user_id", session.user.id)
              .single();
            
            if (membership) {
              setAlreadyMember(true);
            }
          }
        } else {
          setError("Invalid or expired invite link");
        }
      } else {
        // Check if invite expired
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
          setError("This invite has expired");
        } else if (invite.max_uses && invite.uses >= invite.max_uses) {
          setError("This invite has reached its maximum uses");
        } else {
          setServer(invite.server);
          
          // Check if already a member
          if (session?.user) {
            const { data: membership } = await supabaseClient
              .from("dischat_members")
              .select("id")
              .eq("server_id", invite.server_id)
              .eq("user_id", session.user.id)
              .single();
            
            if (membership) {
              setAlreadyMember(true);
            }
          }
        }
      }

      setLoading(false);
    };

    fetchInvite();
  }, [code]);

  const joinServer = async () => {
    if (!server || !currentUser) {
      router.push("/login");
      return;
    }

    setJoining(true);

    try {
      // Check if already a member (double check)
      const { data: existingMembership } = await supabaseClient
        .from("dischat_members")
        .select("id")
        .eq("server_id", server.id)
        .eq("user_id", currentUser.id)
        .single();

      if (existingMembership) {
        router.push("/dischat");
        return;
      }

      // Join the server
      const { error: joinError } = await supabaseClient
        .from("dischat_members")
        .insert({
          server_id: server.id,
          user_id: currentUser.id,
          status: "online",
        });

      if (joinError) {
        setError("Failed to join server. Please try again.");
        setJoining(false);
        return;
      }

      // Update invite uses if this was a custom invite
      const { data: invite } = await supabaseClient
        .from("dischat_invites")
        .select("id, uses")
        .eq("code", code)
        .single();

      if (invite) {
        await supabaseClient
          .from("dischat_invites")
          .update({ uses: invite.uses + 1 })
          .eq("id", invite.id);
      }

      router.push("/dischat");
    } catch {
      setError("An error occurred. Please try again.");
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center rounded-2xl bg-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-slate-400">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center rounded-2xl bg-slate-800 p-8">
        <div className="max-w-md text-center">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
            <svg className="h-10 w-10 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invite Invalid</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Link
            href="/dischat"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-6 py-3 font-medium text-white hover:bg-indigo-600"
          >
            Back to Dischat
          </Link>
        </div>
      </div>
    );
  }

  if (!server) {
    return null;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] items-center justify-center rounded-2xl bg-slate-800 p-8">
      <div className="max-w-md w-full">
        <div className="bg-slate-900/50 rounded-2xl p-8 text-center">
          {/* Server Icon */}
          <div className="mb-6 flex justify-center">
            {server.icon_url ? (
              <img
                src={server.icon_url}
                alt={server.name}
                className="h-24 w-24 rounded-full"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-indigo-500 flex items-center justify-center text-4xl font-bold text-white">
                {server.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {/* Server Info */}
          <p className="text-sm text-slate-400 mb-1">You&apos;ve been invited to join</p>
          <h1 className="text-2xl font-bold text-white mb-2">{server.name}</h1>
          
          {server.description && (
            <p className="text-slate-400 text-sm mb-4">{server.description}</p>
          )}

          <div className="flex items-center justify-center gap-4 mb-6 text-sm text-slate-400">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>Online</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>{server.member_count} Members</span>
            </div>
          </div>

          {/* Action Button */}
          {!currentUser ? (
            <div className="space-y-3">
              <Link
                href="/login"
                className="block w-full rounded-lg bg-indigo-500 px-6 py-3 font-medium text-white hover:bg-indigo-600"
              >
                Login to Join
              </Link>
              <p className="text-xs text-slate-500">
                You need to be logged in to join servers
              </p>
            </div>
          ) : alreadyMember ? (
            <div className="space-y-3">
              <Link
                href="/dischat"
                className="block w-full rounded-lg bg-green-500 px-6 py-3 font-medium text-white hover:bg-green-600"
              >
                Go to Server
              </Link>
              <p className="text-xs text-slate-500">
                You&apos;re already a member of this server
              </p>
            </div>
          ) : (
            <button
              onClick={joinServer}
              disabled={joining}
              className="w-full rounded-lg bg-indigo-500 px-6 py-3 font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Joining...
                </span>
              ) : (
                "Accept Invite"
              )}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          By joining, you agree to the server&apos;s rules and guidelines
        </p>
      </div>
    </div>
  );
}
