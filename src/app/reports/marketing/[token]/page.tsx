"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type ReportData = {
  metrics: { totalSpend: number; totalLeads: number; totalClicks: number; totalImpressions: number; totalRevenue: number; cpl: number; cpc: number; ctr: number; roas: number; conversionRate: number; };
  channels: { channel: string; spend: number; leads: number; revenue: number; cpl: number; roas: number; }[];
  dateRange: { start: string; end: string };
  generatedAt: string;
};

type Report = { id: string; title: string; date_start: string; date_end: string; report_data: ReportData; created_at: string; project?: { name: string } | null; };

const CHANNELS: Record<string, string> = { google_ads: "Google Ads", meta_ads: "Meta (Facebook/Instagram)", linkedin_ads: "LinkedIn Ads", tiktok_ads: "TikTok Ads", twitter_ads: "Twitter/X Ads", microsoft_ads: "Microsoft Ads", organic_search: "Organic Search", organic_social: "Organic Social", referral: "Referral", direct: "Direct", email: "Email", other: "Other" };

export default function PublicMarketingReportPage() {
  const params = useParams();
  const token = params.token as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadReport(); }, [token]);

  async function loadReport() {
    setLoading(true);
    const { data, error } = await supabaseClient.from("marketing_reports").select("*, projects:project_id(name)").eq("public_token", token).eq("is_published", true).single();
    if (error || !data) { setError("Report not found or has expired."); }
    else {
      if (data.public_expires_at && new Date(data.public_expires_at) < new Date()) { setError("This report link has expired."); }
      else { setReport({ ...data, project: data.projects || null }); }
    }
    setLoading(false);
  }

  const formatMoney = (value: number) => new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(value);
  const getChannelLabel = (channel: string) => CHANNELS[channel] || channel;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" /></div>;
  if (error || !report) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-center"><div className="text-4xl mb-4">📊</div><h1 className="text-xl font-semibold text-slate-900 mb-2">Report Not Available</h1><p className="text-slate-500">{error || "Unable to load the report."}</p></div></div>;

  const { metrics, channels, dateRange } = report.report_data;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{report.title}</h1>
              <p className="text-sm text-slate-500 mt-1">{report.project?.name && <span className="font-medium">{report.project.name}</span>}{report.project?.name && " • "}{new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}</p>
            </div>
            <div className="text-right text-xs text-slate-400"><div>Generated {new Date(report.report_data.generatedAt).toLocaleDateString()}</div></div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Spend</div><div className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(metrics.totalSpend)}</div></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Leads</div><div className="mt-1 text-2xl font-bold text-slate-900">{metrics.totalLeads.toLocaleString()}</div></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cost Per Lead</div><div className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(metrics.cpl)}</div></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Revenue</div><div className="mt-1 text-2xl font-bold text-emerald-600">{formatMoney(metrics.totalRevenue)}</div></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Blended ROAS</div><div className="mt-1 text-2xl font-bold text-emerald-600">{metrics.roas.toFixed(2)}x</div></div>
        </div>

        <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white">
          <div className="flex items-center justify-between">
            <div><h3 className="text-sm font-medium opacity-90">Blended Return on Ad Spend</h3><div className="text-4xl font-bold mt-1">{metrics.roas.toFixed(2)}x</div><p className="text-sm opacity-75 mt-2">Revenue ({formatMoney(metrics.totalRevenue)}) / Ad Spend ({formatMoney(metrics.totalSpend)})</p></div>
            <div className="text-right"><div className="text-sm opacity-90">Conversion Rate</div><div className="text-3xl font-bold">{metrics.conversionRate.toFixed(1)}%</div></div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm mb-8">
          <div className="p-4 border-b border-slate-200"><h2 className="text-lg font-semibold text-slate-900">Performance Summary</h2></div>
          <div className="p-4">
            <table className="w-full">
              <tbody>
                <tr className="border-b border-slate-100"><td className="py-3 text-sm font-medium text-slate-700">Total Ad Spend</td><td className="py-3 text-sm text-slate-900 font-semibold text-right">{formatMoney(metrics.totalSpend)}</td></tr>
                <tr className="border-b border-slate-100"><td className="py-3 text-sm font-medium text-slate-700">Total Leads</td><td className="py-3 text-sm text-slate-900 font-semibold text-right">{metrics.totalLeads.toLocaleString()}</td></tr>
                <tr className="border-b border-slate-100"><td className="py-3 text-sm font-medium text-slate-700">Cost Per Lead</td><td className="py-3 text-sm text-slate-900 font-semibold text-right">{formatMoney(metrics.cpl)}</td></tr>
                <tr className="border-b border-slate-100"><td className="py-3 text-sm font-medium text-slate-700">Total Clicks</td><td className="py-3 text-sm text-slate-900 font-semibold text-right">{metrics.totalClicks.toLocaleString()}</td></tr>
                <tr className="border-b border-slate-100"><td className="py-3 text-sm font-medium text-slate-700">Click-Through Rate</td><td className="py-3 text-sm text-slate-900 font-semibold text-right">{metrics.ctr.toFixed(2)}%</td></tr>
                <tr className="bg-emerald-50"><td className="py-3 text-sm font-medium text-emerald-800">Total Revenue</td><td className="py-3 text-sm text-emerald-700 font-bold text-right">{formatMoney(metrics.totalRevenue)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {channels.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 border-b border-slate-200"><h2 className="text-lg font-semibold text-slate-900">Channel Performance</h2></div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Channel</th><th className="px-4 py-3 text-right">Spend</th><th className="px-4 py-3 text-right">Leads</th><th className="px-4 py-3 text-right">CPL</th><th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">ROAS</th></tr></thead>
                <tbody>
                  {channels.map((ch) => (
                    <tr key={ch.channel} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3"><span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{getChannelLabel(ch.channel)}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{formatMoney(ch.spend)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">{ch.leads.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatMoney(ch.cpl)}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600 font-semibold text-right">{formatMoney(ch.revenue)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-right"><span className={ch.roas >= 1 ? "text-emerald-600" : "text-red-600"}>{ch.roas.toFixed(2)}x</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-slate-400">
          <p>This report was automatically generated. For questions, please contact your account manager.</p>
        </div>
      </div>
    </div>
  );
}
