"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

interface LeaveBalance {
  annualLeaveUsed: number;
  annualLeaveTotal: number;
  annualLeaveRemaining: number;
  sickLeaveUsed: number;
  sickLeaveTotal: number;
  sickLeaveRemaining: number;
}

interface LeaveRequest {
  id: string;
  leave_type: "annual" | "sick" | "unpaid";
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

interface AIRecommendation {
  recommendation: string;
  workloadLevel: "low" | "medium" | "high";
  pendingTaskCount: number;
  annualLeaveRemaining: number;
}

export default function LeaveManagement() {
  const [userId, setUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    leaveType: "annual" as "annual" | "sick" | "unpaid",
    startDate: "",
    endDate: "",
    reason: "",
  });

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) setUserId(user.id);
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    async function fetchData() {
      try {
        setLoading(true);
        const [balanceRes, leavesRes, recRes] = await Promise.all([
          fetch(`/api/leaves/balance?userId=${userId}`),
          fetch(`/api/leaves?userId=${userId}`),
          fetch(`/api/ai/leave-recommendation?userId=${userId}`),
        ]);
        const [balanceData, leavesData, recData] = await Promise.all([
          balanceRes.json(),
          leavesRes.json(),
          recRes.json(),
        ]);
        if (balanceData.balance) setBalance(balanceData.balance);
        if (leavesData.leaves) setLeaves(leavesData.leaves);
        setRecommendation(recData);
      } catch (err) {
        console.error("Error fetching leave data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (start < today) { setError("Start date cannot be in the past"); setSubmitting(false); return; }
      if (end < start) { setError("End date must be after start date"); setSubmitting(false); return; }
      const response = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, leaveType: formData.leaveType, startDate: formData.startDate, endDate: formData.endDate, reason: formData.reason }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Failed to submit leave request"); return; }
      setSuccess("Leave request submitted successfully!");
      setShowForm(false);
      setFormData({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
      const leavesRes = await fetch(`/api/leaves?userId=${userId}`);
      const leavesData = await leavesRes.json();
      if (leavesData.leaves) setLeaves(leavesData.leaves);
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return "bg-emerald-100 text-emerald-700";
      case "rejected": return "bg-red-100 text-red-700";
      default: return "bg-amber-100 text-amber-700";
    }
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><div className="text-sm text-slate-500">Loading leave data...</div></div>;

  return (
    <div className="space-y-6">
      {/* Leave Balances */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-sky-200/50 bg-gradient-to-br from-sky-50 to-blue-50 p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></svg>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-sky-600">Annual Leave (UAE)</p>
              <p className="text-xl font-bold text-sky-900">{balance?.annualLeaveRemaining ?? 30} <span className="text-sm font-normal text-sky-600">days left</span></p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-sky-600"><span>Used: {balance?.annualLeaveUsed ?? 0}</span><span>Total: {balance?.annualLeaveTotal ?? 30}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-200/50">
              <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500" style={{ width: `${((balance?.annualLeaveUsed ?? 0) / (balance?.annualLeaveTotal ?? 30)) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-rose-200/50 bg-gradient-to-br from-rose-50 to-pink-50 p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-red-500 text-white shadow-lg">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-rose-600">Sick Leave (UAE)</p>
              <p className="text-xl font-bold text-rose-900">{balance?.sickLeaveRemaining ?? 90} <span className="text-sm font-normal text-rose-600">days left</span></p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-rose-600"><span>Used: {balance?.sickLeaveUsed ?? 0}</span><span>Total: {balance?.sickLeaveTotal ?? 90}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-rose-200/50">
              <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-500" style={{ width: `${((balance?.sickLeaveUsed ?? 0) / (balance?.sickLeaveTotal ?? 90)) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* AI Recommendation */}
      {recommendation && (
        <div className={`rounded-2xl border p-5 shadow-lg ${recommendation.workloadLevel === "low" ? "border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-green-50" : recommendation.workloadLevel === "high" ? "border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50" : "border-slate-200/50 bg-gradient-to-br from-slate-50 to-gray-50"}`}>
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${recommendation.workloadLevel === "low" ? "bg-gradient-to-br from-emerald-400 to-green-500" : recommendation.workloadLevel === "high" ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-slate-400 to-gray-500"}`}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10H12V2Z" /><path d="M12 2a10 10 0 0 1 10 10" /><path d="M12 12 2.1 9.3" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">AI Leave Recommendation</h3>
              <p className="mt-1 text-sm text-slate-600">{recommendation.recommendation}</p>
              <div className="mt-2 flex gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${recommendation.workloadLevel === "low" ? "bg-emerald-100 text-emerald-700" : recommendation.workloadLevel === "high" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                  Workload: {recommendation.workloadLevel}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">{recommendation.pendingTaskCount} pending tasks</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Leave Button & Form */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Request Leave</h3>
          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/25 hover:from-violet-600 hover:to-purple-600">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            {showForm ? "Cancel" : "New Request"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm text-emerald-600">{success}</p>}
        {showForm && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">Leave Type</label>
                <select value={formData.leaveType} onChange={(e) => setFormData({ ...formData, leaveType: e.target.value as "annual" | "sick" | "unpaid" })} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500">
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>
              <div />
              <div>
                <label className="block text-xs font-medium text-slate-700">Start Date</label>
                <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} required className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">End Date</label>
                <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} required className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Reason / Notes</label>
              <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} rows={3} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500" placeholder="Optional: Provide any additional details..." />
            </div>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-green-600 disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        )}
      </div>

      {/* Leave History */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-lg backdrop-blur">
        <h3 className="text-sm font-semibold text-slate-900">Leave History</h3>
        {leaves.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No leave requests yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {leaves.map((leave) => (
              <div key={leave.id} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg px-2 py-1 text-xs font-medium ${leave.leave_type === "annual" ? "bg-sky-100 text-sky-700" : leave.leave_type === "sick" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
                    {leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}</p>
                    <p className="text-xs text-slate-500">{leave.days_count} day(s) {leave.reason ? `• ${leave.reason}` : ""}</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(leave.status)}`}>{leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
