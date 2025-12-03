"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { Campaign, ExpenseLog, MarketingLead, Project, Tab, formatMoney, formatNumber } from "./types";
import ExpenseManagementTab from "./ExpenseManagementTab";
import CampaignMasterListTab from "./CampaignMasterListTab";
import LeadsAttributionTab from "./LeadsAttributionTab";
import ReportsAnalyticsTab from "./ReportsAnalyticsTab";
import OfflineExportsTab from "./OfflineExportsTab";

export default function PerformanceMarketingPage() {
  const params = useParams();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("expenses");
  const [loading, setLoading] = useState(true);
  
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLog[]>([]);
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  
  const [reportDateRange, setReportDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    loadProject();
    loadData();
  }, [projectId]);

  async function loadProject() {
    const { data } = await supabaseClient.from("projects").select("id, name").eq("id", projectId).single();
    if (data) setProject(data);
  }

  async function loadData() {
    setLoading(true);
    await Promise.all([loadCampaigns(), loadExpenses(), loadLeads()]);
    setLoading(false);
  }

  async function loadCampaigns() {
    const { data } = await supabaseClient.from("marketing_campaigns").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    if (data) setCampaigns(data);
  }

  async function loadExpenses() {
    const { data } = await supabaseClient.from("marketing_expense_logs").select("*").eq("project_id", projectId).order("date_start", { ascending: false });
    if (data) setExpenses(data);
  }

  async function loadLeads() {
    const { data } = await supabaseClient.from("marketing_leads").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    if (data) setLeads(data);
  }

  const metrics = useCallback(() => {
    const filteredExpenses = expenses.filter(e => e.date_start >= reportDateRange.start && e.date_end <= reportDateRange.end);
    const filteredLeads = leads.filter(l => l.created_at >= reportDateRange.start && l.created_at <= reportDateRange.end + "T23:59:59");
    const totalSpend = filteredExpenses.reduce((sum, e) => sum + Number(e.spend_amount), 0);
    const totalLeads = filteredLeads.length;
    const totalClicks = filteredExpenses.reduce((sum, e) => sum + (e.manual_clicks || 0), 0);
    const totalImpressions = filteredExpenses.reduce((sum, e) => sum + (e.manual_impressions || 0), 0);
    const wonDeals = filteredLeads.filter(l => l.deal_status === "won");
    const totalRevenue = wonDeals.reduce((sum, l) => sum + (l.deal_value || 0), 0);
    return {
      totalSpend,
      totalLeads,
      totalClicks,
      totalImpressions,
      totalRevenue,
      cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      conversionRate: totalLeads > 0 ? (wonDeals.length / totalLeads) * 100 : 0,
    };
  }, [expenses, leads, reportDateRange]);

  const channelBreakdown = useCallback(() => {
    const breakdown: Record<string, { spend: number; leads: number; revenue: number }> = {};
    expenses.filter(e => e.date_start >= reportDateRange.start && e.date_end <= reportDateRange.end).forEach(e => {
      if (!breakdown[e.channel]) breakdown[e.channel] = { spend: 0, leads: 0, revenue: 0 };
      breakdown[e.channel].spend += Number(e.spend_amount);
    });
    leads.filter(l => l.created_at >= reportDateRange.start && l.created_at <= reportDateRange.end + "T23:59:59" && l.channel).forEach(l => {
      if (!breakdown[l.channel!]) breakdown[l.channel!] = { spend: 0, leads: 0, revenue: 0 };
      breakdown[l.channel!].leads += 1;
      if (l.deal_status === "won") breakdown[l.channel!].revenue += l.deal_value || 0;
    });
    return Object.entries(breakdown).map(([channel, data]) => ({
      channel,
      ...data,
      cpl: data.leads > 0 ? data.spend / data.leads : 0,
      roas: data.spend > 0 ? data.revenue / data.spend : 0,
    }));
  }, [expenses, leads, reportDateRange]);

  const geoBreakdown = useCallback(() => {
    const breakdown: Record<string, { spend: number; leads: number; revenue: number }> = {};
    // Add spend by location
    expenses.filter(e => e.date_start >= reportDateRange.start && e.date_end <= reportDateRange.end && e.country).forEach(e => {
      const location = e.region ? `${e.region}, ${e.country}` : e.country!;
      if (!breakdown[location]) breakdown[location] = { spend: 0, leads: 0, revenue: 0 };
      breakdown[location].spend += Number(e.spend_amount);
    });
    // Add leads by location
    leads.filter(l => l.created_at >= reportDateRange.start && l.created_at <= reportDateRange.end + "T23:59:59" && l.country).forEach(l => {
      const location = l.region ? `${l.region}, ${l.country}` : l.country!;
      if (!breakdown[location]) breakdown[location] = { spend: 0, leads: 0, revenue: 0 };
      breakdown[location].leads += 1;
      if (l.deal_status === "won") breakdown[location].revenue += l.deal_value || 0;
    });
    return Object.entries(breakdown)
      .map(([location, data]) => ({
        location,
        ...data,
        cpl: data.leads > 0 ? data.spend / data.leads : 0,
        roas: data.spend > 0 ? data.revenue / data.spend : 0,
      }))
      .sort((a, b) => b.spend - a.spend);
  }, [expenses, leads, reportDateRange]);

  if (loading || !project) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const m = metrics();
  const channels = channelBreakdown();
  const geoData = geoBreakdown();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href={`/projects/${projectId}`} className="hover:text-slate-700">← Back to Project</Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Performance Marketing</h1>
          <p className="text-sm text-slate-500">{project.name}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
          <input type="date" value={reportDateRange.start} onChange={(e) => setReportDateRange(prev => ({ ...prev, start: e.target.value }))} className="text-sm text-slate-700 border-none focus:outline-none" />
          <span className="text-slate-400">to</span>
          <input type="date" value={reportDateRange.end} onChange={(e) => setReportDateRange(prev => ({ ...prev, end: e.target.value }))} className="text-sm text-slate-700 border-none focus:outline-none" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Spend</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(m.totalSpend)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Leads</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(m.totalLeads)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cost Per Lead</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(m.cpl)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Revenue</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{formatMoney(m.totalRevenue)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Blended ROAS</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{m.roas.toFixed(2)}x</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {[
            { id: "expenses", label: "Expense Management", icon: "💰" },
            { id: "campaigns", label: "Campaign Master List", icon: "📋" },
            { id: "leads", label: "Leads & Attribution", icon: "👥" },
            { id: "reports", label: "Reports & Analytics", icon: "📊" },
            { id: "exports", label: "Offline Exports", icon: "📤" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
                activeTab === tab.id ? "bg-emerald-500 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {activeTab === "expenses" && <ExpenseManagementTab projectId={projectId} expenses={expenses} campaigns={campaigns} onRefresh={loadExpenses} />}
        {activeTab === "campaigns" && <CampaignMasterListTab projectId={projectId} campaigns={campaigns} onRefresh={loadCampaigns} />}
        {activeTab === "leads" && <LeadsAttributionTab projectId={projectId} leads={leads} campaigns={campaigns} onRefresh={loadLeads} />}
        {activeTab === "reports" && <ReportsAnalyticsTab projectId={projectId} metrics={m} channels={channels} geoData={geoData} dateRange={reportDateRange} />}
        {activeTab === "exports" && <OfflineExportsTab projectId={projectId} leads={leads} />}
      </div>
    </div>
  );
}
