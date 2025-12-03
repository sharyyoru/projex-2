"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatMoney, getChannelLabel } from "./types";

type Metrics = {
  totalSpend: number;
  totalLeads: number;
  totalClicks: number;
  totalImpressions: number;
  totalRevenue: number;
  cpl: number;
  cpc: number;
  ctr: number;
  roas: number;
  conversionRate: number;
};

type ChannelData = {
  channel: string;
  spend: number;
  leads: number;
  revenue: number;
  cpl: number;
  roas: number;
};

type GeoData = {
  location: string;
  spend: number;
  leads: number;
  revenue: number;
  cpl: number;
  roas: number;
};

export default function ReportsAnalyticsTab({
  projectId,
  metrics,
  channels,
  geoData,
  dateRange,
}: {
  projectId: string;
  metrics: Metrics;
  channels: ChannelData[];
  geoData: GeoData[];
  dateRange: { start: string; end: string };
}) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function generatePublicReport() {
    if (!reportTitle) return;
    setGenerating(true);
    
    const reportData = {
      metrics,
      channels,
      geoData,
      dateRange,
      generatedAt: new Date().toISOString(),
    };
    
    const { data, error } = await supabaseClient.from("marketing_reports").insert({
      project_id: projectId,
      title: reportTitle,
      date_start: dateRange.start,
      date_end: dateRange.end,
      report_data: reportData,
      is_published: true,
    }).select("public_token").single();
    
    if (data) {
      setPublicToken(data.public_token);
    }
    setGenerating(false);
  }

  const publicUrl = publicToken ? `${window.location.origin}/reports/marketing/${publicToken}` : null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Reports & Analytics</h2>
          <p className="text-sm text-slate-500">Performance dashboard for {dateRange.start} to {dateRange.end}</p>
        </div>
        <button onClick={() => setShowShareModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
          Generate Client Report
        </button>
      </div>

      {/* Blended ROAS Calculator */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium opacity-90">Blended ROAS</h3>
            <div className="text-3xl font-bold mt-1">{metrics.roas.toFixed(2)}x</div>
            <p className="text-xs opacity-75 mt-1">Revenue ({formatMoney(metrics.totalRevenue)}) ÷ Ad Spend ({formatMoney(metrics.totalSpend)})</p>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-90">Conversion Rate</div>
            <div className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Actuals Dashboard */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Actuals vs. Manual Dashboard</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Metric</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">Total Ad Spend</td>
                <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{formatMoney(metrics.totalSpend)}</td>
                <td className="px-4 py-3 text-xs text-slate-500">Sum of all manual expense entries</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">Leads Created</td>
                <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{metrics.totalLeads.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-slate-500">Count of tracked leads</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">Cost Per Lead (CPL)</td>
                <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{formatMoney(metrics.cpl)}</td>
                <td className="px-4 py-3 text-xs text-slate-500">Spend ÷ Leads</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">Total Clicks</td>
                <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{metrics.totalClicks.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-slate-500">Sum of manual click entries</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">Cost Per Click (CPC)</td>
                <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{formatMoney(metrics.cpc)}</td>
                <td className="px-4 py-3 text-xs text-slate-500">Spend ÷ Clicks</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">CTR</td>
                <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{metrics.ctr.toFixed(2)}%</td>
                <td className="px-4 py-3 text-xs text-slate-500">Clicks ÷ Impressions × 100</td>
              </tr>
              <tr className="border-b border-slate-100 bg-emerald-50">
                <td className="px-4 py-3 text-sm font-medium text-emerald-900">Total Revenue</td>
                <td className="px-4 py-3 text-sm text-emerald-700 font-bold text-right">{formatMoney(metrics.totalRevenue)}</td>
                <td className="px-4 py-3 text-xs text-emerald-600">Sum of won deals</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Geographic Performance */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">🌍 Geographic Performance</h3>
        {geoData.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl">
            <p>No geographic data available. Add location data to expenses and leads.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-right">Spend</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">CPL</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {geoData.map((geo) => (
                  <tr key={geo.location} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900">
                        <span className="text-base">📍</span> {geo.location}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{formatMoney(geo.spend)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{geo.leads.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatMoney(geo.cpl)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600 font-semibold text-right">{formatMoney(geo.revenue)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-right">
                      <span className={geo.roas >= 1 ? "text-emerald-600" : "text-red-600"}>{geo.roas.toFixed(2)}x</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Channel Performance Grid */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">📊 Channel Performance Grid</h3>
        {channels.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No channel data available for the selected date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3 text-right">Spend</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">CPL</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((ch) => (
                  <tr key={ch.channel} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{getChannelLabel(ch.channel)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{formatMoney(ch.spend)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{ch.leads.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatMoney(ch.cpl)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600 font-semibold text-right">{formatMoney(ch.revenue)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-right">
                      <span className={ch.roas >= 1 ? "text-emerald-600" : "text-red-600"}>{ch.roas.toFixed(2)}x</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate Report Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Generate Client Report</h2>
            {!publicToken ? (
              <>
                <p className="text-sm text-slate-500 mb-4">Create a shareable report link that clients can view without logging in.</p>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Report Title *</label><input type="text" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} placeholder="Q4 2024 Performance Report" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => setShowShareModal(false)} className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                  <button onClick={generatePublicReport} disabled={generating || !reportTitle} className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-white shadow-lg disabled:opacity-50">{generating ? "Generating..." : "Generate Link"}</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500 mb-4">Your report is ready! Share this link with your client:</p>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <input type="text" value={publicUrl || ""} readOnly className="w-full bg-transparent text-sm text-slate-700 border-none focus:outline-none" onClick={(e) => (e.target as HTMLInputElement).select()} />
                </div>
                <button onClick={() => { navigator.clipboard.writeText(publicUrl || ""); }} className="mt-3 w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Copy to Clipboard</button>
                <div className="mt-6 flex justify-end">
                  <button onClick={() => { setShowShareModal(false); setPublicToken(null); setReportTitle(""); }} className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
