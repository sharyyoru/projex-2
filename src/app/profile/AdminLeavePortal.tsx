"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabaseClient } from "@/lib/supabaseClient";

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: "annual" | "sick" | "unpaid";
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  user?: { id: string; full_name: string; email: string; avatar_url: string | null };
}

export default function AdminLeavePortal() {
  const [userId, setUserId] = useState<string | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) setUserId(user.id);
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchLeaves();
  }, [userId, filter]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const statusParam = filter === "all" ? "" : `&status=${filter}`;
      const response = await fetch(`/api/leaves?all=true${statusParam}`);
      const data = await response.json();
      if (data.leaves) setLeaves(data.leaves);
    } catch (err) {
      console.error("Error fetching leaves:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (leaveId: string, action: "approved" | "rejected") => {
    if (!userId) return;
    setProcessing(leaveId);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveId, status: action, reviewedBy: userId }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Failed to process request"); return; }
      setSuccess(`Leave request ${action}!`);
      fetchLeaves();
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return "bg-emerald-100 text-emerald-700";
      case "rejected": return "bg-red-100 text-red-700";
      default: return "bg-amber-100 text-amber-700";
    }
  };

  const getLeaveTypeBadge = (type: string) => {
    switch (type) {
      case "annual": return "bg-sky-100 text-sky-700";
      case "sick": return "bg-rose-100 text-rose-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50 via-purple-50 to-violet-50 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-400/30">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Admin Leave Portal</h2>
            <p className="text-sm text-slate-500">Review and manage employee leave requests</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${filter === f ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      {success && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600">{success}</div>}

      {/* Leave Requests Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 shadow-lg backdrop-blur overflow-hidden">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-500">Loading requests...</div>
        ) : leaves.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-500">No {filter === "all" ? "" : filter} leave requests found.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {leaves.map((leave) => (
              <div key={leave.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-100 to-purple-100 text-sm font-bold text-violet-600">
                      {leave.user?.avatar_url ? (
                        <Image src={leave.user.avatar_url} alt={leave.user.full_name || "User"} width={40} height={40} className="h-full w-full object-cover" />
                      ) : (
                        <span>{(leave.user?.full_name || "U").charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{leave.user?.full_name || leave.user?.email || "Unknown User"}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getLeaveTypeBadge(leave.leave_type)}`}>
                          {leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1)}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getStatusBadge(leave.status)}`}>
                          {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(leave.start_date).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })} — {new Date(leave.end_date).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}
                        <span className="mx-2">•</span>
                        <span className="font-medium">{leave.days_count} day(s)</span>
                      </p>
                      {leave.reason && <p className="mt-1 text-xs text-slate-600 italic">&ldquo;{leave.reason}&rdquo;</p>}
                      <p className="mt-1 text-[10px] text-slate-400">Submitted: {new Date(leave.created_at).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                  {leave.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => handleAction(leave.id, "approved")} disabled={processing === leave.id} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:from-emerald-600 hover:to-green-600 disabled:opacity-50">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        Approve
                      </button>
                      <button onClick={() => handleAction(leave.id, "rejected")} disabled={processing === leave.id} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-red-500 to-rose-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:from-red-600 hover:to-rose-600 disabled:opacity-50">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Calendar Summary */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-lg backdrop-blur">
        <h3 className="text-sm font-semibold text-slate-900">Team Availability Overview</h3>
        <p className="mt-1 text-xs text-slate-500">Quick view of approved leaves for this month</p>
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
          <svg className="mx-auto h-8 w-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          <p className="mt-2">Team calendar integration coming soon</p>
        </div>
      </div>
    </div>
  );
}
