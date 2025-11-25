"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type Report = {
  id: string;
  report_month: string;
  kpi_data: {
    reach?: { actual: number; goal: number };
    impressions?: { actual: number; goal: number };
    engagement_rate?: { actual: number; goal: number };
    follower_growth?: { actual: number; goal: number };
    website_clicks?: { actual: number; goal: number };
  };
  platform_metrics: Record<string, any>;
  mom_comparison: Record<string, number>;
  is_published: boolean;
  notes: string | null;
  created_at: string;
};

const KPI_LABELS: Record<string, { label: string; format: (v: number) => string; icon: React.ReactNode }> = {
  reach: {
    label: "Total Reach",
    format: (v) => v.toLocaleString(),
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  },
  impressions: {
    label: "Impressions",
    format: (v) => v.toLocaleString(),
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20M12 2v20"/></svg>,
  },
  engagement_rate: {
    label: "Engagement Rate",
    format: (v) => `${v.toFixed(2)}%`,
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  },
  follower_growth: {
    label: "Net Follower Growth",
    format: (v) => (v >= 0 ? "+" : "") + v.toLocaleString(),
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  website_clicks: {
    label: "Website Clicks",
    format: (v) => v.toLocaleString(),
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  },
};

export default function AnalyticsKPIs({ projectId }: { projectId: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    loadReports();
  }, [projectId]);

  async function loadReports() {
    setLoading(true);
    const { data } = await supabaseClient
      .from("social_reports")
      .select("*")
      .eq("project_id", projectId)
      .order("report_month", { ascending: false });
    if (data) setReports(data as Report[]);
    setLoading(false);
  }

  const currentReport = reports.find((r) => r.report_month.startsWith(selectedMonth));
  const previousReport = reports.find((r) => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return r.report_month.startsWith(`${prevYear}-${String(prevMonth).padStart(2, "0")}`);
  });

  const calculateMoM = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Analytics & KPIs</h2>
          <p className="text-sm text-slate-500">Track monthly performance against goals</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20" />
          <button onClick={() => { setEditingReport(currentReport || null); setShowModal(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-pink-500/25 hover:shadow-xl">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            {currentReport ? "Edit Report" : "Add Report"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" /></div>
      ) : !currentReport ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-fuchsia-100 text-pink-500">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-slate-900">No data for {selectedMonth}</h3>
          <p className="text-sm text-slate-500">Add metrics for this month to track performance</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(KPI_LABELS).map(([key, { label, format, icon }]) => {
              const kpiData = currentReport.kpi_data[key as keyof typeof currentReport.kpi_data];
              const prevData = previousReport?.kpi_data[key as keyof typeof currentReport.kpi_data];
              const actual = kpiData?.actual || 0;
              const goal = kpiData?.goal || 0;
              const progress = goal > 0 ? Math.min((actual / goal) * 100, 100) : 0;
              const mom = prevData ? calculateMoM(actual, prevData.actual) : null;

              return (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-600">{icon}<span className="text-sm font-medium">{label}</span></div>
                    {mom !== null && (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${mom >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {mom >= 0 ? "▲" : "▼"} {Math.abs(mom).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="mb-3">
                    <span className="text-2xl font-bold text-slate-900">{format(actual)}</span>
                    <span className="ml-2 text-sm text-slate-500">/ {format(goal)} goal</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full transition-all ${progress >= 100 ? "bg-emerald-500" : progress >= 75 ? "bg-blue-500" : progress >= 50 ? "bg-amber-500" : "bg-slate-300"}`}
                      style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-1 text-right text-xs text-slate-500">{progress.toFixed(0)}% of goal</div>
                </div>
              );
            })}
          </div>

          {/* Notes */}
          {currentReport.notes && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Notes</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{currentReport.notes}</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <ReportModal report={editingReport} projectId={projectId} selectedMonth={selectedMonth}
          onClose={() => { setShowModal(false); setEditingReport(null); }}
          onSaved={() => { setShowModal(false); setEditingReport(null); loadReports(); }} />
      )}
    </div>
  );
}

function ReportModal({ report, projectId, selectedMonth, onClose, onSaved }: { report: Report | null; projectId: string; selectedMonth: string; onClose: () => void; onSaved: () => void }) {
  const [kpiData, setKpiData] = useState<Report["kpi_data"]>(report?.kpi_data || {});
  const [notes, setNotes] = useState(report?.notes || "");
  const [saving, setSaving] = useState(false);

  const updateKpi = (key: string, field: "actual" | "goal", value: number) => {
    setKpiData((prev) => ({
      ...prev,
      [key]: { ...prev[key as keyof typeof prev], [field]: value },
    }));
  };

  async function handleSubmit() {
    setSaving(true);
    const data = {
      project_id: projectId,
      report_month: `${selectedMonth}-01`,
      kpi_data: kpiData,
      notes: notes || null,
    };

    if (report) {
      await supabaseClient.from("social_reports").update(data).eq("id", report.id);
    } else {
      await supabaseClient.from("social_reports").insert(data);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">{report ? "Edit Report" : "Add Report"} - {selectedMonth}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {Object.entries(KPI_LABELS).map(([key, { label }]) => (
            <div key={key} className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">{label} (Actual)</label>
                <input type="number" value={kpiData[key as keyof typeof kpiData]?.actual || ""} onChange={(e) => updateKpi(key, "actual", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">{label} (Goal)</label>
                <input type="number" value={kpiData[key as keyof typeof kpiData]?.goal || ""} onChange={(e) => updateKpi(key, "goal", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20" />
              </div>
            </div>
          ))}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 resize-none"
              placeholder="Monthly performance notes..." />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-pink-500/25 hover:shadow-xl disabled:opacity-50">
              {saving ? "Saving..." : "Save Report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
