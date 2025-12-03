"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { Campaign, MarketingChannel, CHANNELS, getChannelLabel } from "./types";

export default function CampaignMasterListTab({
  projectId,
  campaigns,
  onRefresh,
}: {
  projectId: string;
  campaigns: Campaign[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    channel: "google_ads" as MarketingChannel,
    utm_campaign: "",
    utm_source: "",
    utm_medium: "",
    description: "",
    start_date: "",
    end_date: "",
    budget: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!form.name) return;
    setSaving(true);
    const { data: { user } } = await supabaseClient.auth.getUser();
    await supabaseClient.from("marketing_campaigns").insert({
      project_id: projectId,
      name: form.name,
      channel: form.channel,
      utm_campaign: form.utm_campaign || null,
      utm_source: form.utm_source || null,
      utm_medium: form.utm_medium || null,
      description: form.description || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: form.budget ? parseFloat(form.budget) : null,
      created_by_user_id: user?.id,
    });
    setForm({ name: "", channel: "google_ads", utm_campaign: "", utm_source: "", utm_medium: "", description: "", start_date: "", end_date: "", budget: "" });
    setSaving(false);
    setShowModal(false);
    onRefresh();
  }

  async function toggleActive(campaign: Campaign) {
    await supabaseClient.from("marketing_campaigns").update({ is_active: !campaign.is_active }).eq("id", campaign.id);
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this campaign?")) return;
    await supabaseClient.from("marketing_campaigns").delete().eq("id", id);
    onRefresh();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Campaign Master List</h2>
          <p className="text-sm text-slate-500">Define valid campaign names for UTM matching and expense attribution</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Add Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <div className="text-4xl mb-2">📋</div>
          <p>No campaigns defined. Create campaign names to enable UTM matching.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className={`rounded-xl border p-4 transition-all ${campaign.is_active ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/50 opacity-60"}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{campaign.name}</h3>
                  <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 mt-1">{getChannelLabel(campaign.channel)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleActive(campaign)} className={`p-1.5 rounded-lg transition-colors ${campaign.is_active ? "text-emerald-600 hover:bg-emerald-100" : "text-slate-400 hover:bg-slate-100"}`} title={campaign.is_active ? "Deactivate" : "Activate"}>{campaign.is_active ? "✓" : "○"}</button>
                  <button onClick={() => handleDelete(campaign.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg></button>
                </div>
              </div>
              {campaign.utm_campaign && <div className="text-xs text-slate-500 mb-2"><span className="font-medium">UTM:</span> <code className="bg-white px-1 py-0.5 rounded">{campaign.utm_campaign}</code></div>}
              {campaign.description && <p className="text-xs text-slate-600 line-clamp-2">{campaign.description}</p>}
              {(campaign.start_date || campaign.budget) && (
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  {campaign.start_date && <span>📅 {new Date(campaign.start_date).toLocaleDateString()}{campaign.end_date && ` - ${new Date(campaign.end_date).toLocaleDateString()}`}</span>}
                  {campaign.budget && <span>💰 AED {campaign.budget.toLocaleString()}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Add Campaign</h2>
            <div className="space-y-4">
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Campaign Name *</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Summer Sale 2024" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Channel *</label><select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as MarketingChannel })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm">{CHANNELS.map((ch) => (<option key={ch.value} value={ch.value}>{ch.label}</option>))}</select></div>
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-semibold text-slate-600 mb-3">UTM Parameters (for auto-matching)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="mb-1 block text-xs text-slate-500">utm_campaign</label><input type="text" value={form.utm_campaign} onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })} placeholder="summer_sale" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" /></div>
                  <div><label className="mb-1 block text-xs text-slate-500">utm_source</label><input type="text" value={form.utm_source} onChange={(e) => setForm({ ...form, utm_source: e.target.value })} placeholder="google" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" /></div>
                  <div><label className="mb-1 block text-xs text-slate-500">utm_medium</label><input type="text" value={form.utm_medium} onChange={(e) => setForm({ ...form, utm_medium: e.target.value })} placeholder="cpc" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" /></div>
                </div>
              </div>
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Campaign description..." rows={2} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm resize-none" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Start Date</label><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">End Date</label><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
              </div>
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Budget (AED)</label><input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="0.00" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleSubmit} disabled={saving || !form.name} className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-white shadow-lg disabled:opacity-50">{saving ? "Saving..." : "Save Campaign"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
