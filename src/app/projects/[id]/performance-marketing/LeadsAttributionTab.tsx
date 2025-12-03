"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { MarketingLead, Campaign, MarketingChannel, CHANNELS, LEAD_SOURCES, formatMoney, getChannelLabel } from "./types";

export default function LeadsAttributionTab({
  projectId,
  leads,
  campaigns,
  onRefresh,
}: {
  projectId: string;
  leads: MarketingLead[];
  campaigns: Campaign[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    channel: "" as MarketingChannel | "",
    lead_source: "",
    utm_campaign: "",
    gclid: "",
    fbclid: "",
    deal_value: "",
    deal_status: "open",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!form.email && !form.phone) return;
    setSaving(true);
    
    // Fuzzy match campaign by utm_campaign
    let matchedCampaignId: string | null = null;
    if (form.utm_campaign) {
      const normalizedUtm = form.utm_campaign.toLowerCase().replace(/[_-]/g, " ");
      const match = campaigns.find(c => {
        const normalizedCampaign = c.utm_campaign?.toLowerCase().replace(/[_-]/g, " ");
        const normalizedName = c.name.toLowerCase().replace(/[_-]/g, " ");
        return normalizedCampaign === normalizedUtm || normalizedName.includes(normalizedUtm) || normalizedUtm.includes(normalizedName);
      });
      if (match) matchedCampaignId = match.id;
    }
    
    await supabaseClient.from("marketing_leads").insert({
      project_id: projectId,
      campaign_id: matchedCampaignId,
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      email: form.email || null,
      phone: form.phone || null,
      company_name: form.company_name || null,
      channel: form.channel || null,
      lead_source: form.lead_source || null,
      utm_campaign: form.utm_campaign || null,
      gclid: form.gclid || null,
      fbclid: form.fbclid || null,
      deal_value: form.deal_value ? parseFloat(form.deal_value) : null,
      deal_status: form.deal_status as "open" | "won" | "lost",
    });
    
    setForm({ first_name: "", last_name: "", email: "", phone: "", company_name: "", channel: "", lead_source: "", utm_campaign: "", gclid: "", fbclid: "", deal_value: "", deal_status: "open" });
    setSaving(false);
    setShowModal(false);
    onRefresh();
  }

  async function updateDealStatus(lead: MarketingLead, status: string) {
    await supabaseClient.from("marketing_leads").update({ 
      deal_status: status, 
      converted_at: status === "won" ? new Date().toISOString() : null 
    }).eq("id", lead.id);
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lead?")) return;
    await supabaseClient.from("marketing_leads").delete().eq("id", id);
    onRefresh();
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "won": return "bg-emerald-100 text-emerald-700";
      case "lost": return "bg-red-100 text-red-700";
      default: return "bg-amber-100 text-amber-700";
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Leads & Attribution</h2>
          <p className="text-sm text-slate-500">Track leads with UTM parameters, click IDs, and conversion data</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Add Lead
        </button>
      </div>

      {leads.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <div className="text-4xl mb-2">👥</div>
          <p>No leads tracked yet. Add leads with attribution data to measure campaign performance.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Source / Channel</th>
                <th className="px-4 py-3">UTM Campaign</th>
                <th className="px-4 py-3">Click IDs</th>
                <th className="px-4 py-3 text-right">Deal Value</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-900">{[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown"}</div>
                    <div className="text-xs text-slate-500">{lead.email || lead.phone}</div>
                    {lead.company_name && <div className="text-xs text-slate-400">{lead.company_name}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {lead.lead_source && <div className="text-xs text-slate-700">{lead.lead_source}</div>}
                    {lead.channel && <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{getChannelLabel(lead.channel)}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{lead.utm_campaign ? <code className="bg-slate-100 px-1 py-0.5 rounded">{lead.utm_campaign}</code> : "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {lead.gclid && <div className="text-blue-600" title={lead.gclid}>GCLID ✓</div>}
                    {lead.fbclid && <div className="text-indigo-600" title={lead.fbclid}>FBCLID ✓</div>}
                    {!lead.gclid && !lead.fbclid && <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{lead.deal_value ? formatMoney(lead.deal_value) : "—"}</td>
                  <td className="px-4 py-3">
                    <select value={lead.deal_status || "open"} onChange={(e) => updateDealStatus(lead, e.target.value)} className={`rounded-full px-2 py-1 text-xs font-medium border-0 ${getStatusColor(lead.deal_status)}`}>
                      <option value="open">Open</option>
                      <option value="won">Won</option>
                      <option value="lost">Lost</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><button onClick={() => handleDelete(lead.id)} className="text-slate-400 hover:text-red-500"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Add Lead</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">First Name</label><input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Last Name</label><input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Email *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Phone</label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
              </div>
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Company</label><input type="text" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-semibold text-slate-600 mb-3">Attribution</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Lead Source *</label><select value={form.lead_source} onChange={(e) => setForm({ ...form, lead_source: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"><option value="">Select source...</option>{LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Channel</label><select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as MarketingChannel })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"><option value="">Select channel...</option>{CHANNELS.map(ch => <option key={ch.value} value={ch.value}>{ch.label}</option>)}</select></div>
                </div>
              </div>
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">UTM Campaign</label><input type="text" value={form.utm_campaign} onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })} placeholder="summer_sale_2024" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">GCLID</label><input type="text" value={form.gclid} onChange={(e) => setForm({ ...form, gclid: e.target.value })} placeholder="Google Click ID" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">FBCLID</label><input type="text" value={form.fbclid} onChange={(e) => setForm({ ...form, fbclid: e.target.value })} placeholder="Facebook Click ID" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-semibold text-slate-600 mb-3">Deal Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Deal Value (AED)</label><input type="number" value={form.deal_value} onChange={(e) => setForm({ ...form, deal_value: e.target.value })} placeholder="0.00" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div>
                  <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Status</label><select value={form.deal_status} onChange={(e) => setForm({ ...form, deal_status: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"><option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option></select></div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleSubmit} disabled={saving || (!form.email && !form.phone)} className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-white shadow-lg disabled:opacity-50">{saving ? "Saving..." : "Save Lead"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
