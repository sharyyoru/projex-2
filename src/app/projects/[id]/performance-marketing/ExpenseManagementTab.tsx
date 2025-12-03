"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { ExpenseLog, Campaign, MarketingChannel, CHANNELS, COMMON_COUNTRIES, UAE_EMIRATES, formatMoney, getChannelLabel } from "./types";

export default function ExpenseManagementTab({
  projectId,
  expenses,
  campaigns,
  onRefresh,
}: {
  projectId: string;
  expenses: ExpenseLog[];
  campaigns: Campaign[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [form, setForm] = useState({
    campaign_objective: "" as "brand_awareness" | "sales" | "",
    date_start: new Date().toISOString().split("T")[0],
    date_end: new Date().toISOString().split("T")[0],
    channel: "google_ads" as MarketingChannel,
    campaign_name: "",
    spend_amount: "",
    currency: "AED",
    manual_clicks: "",
    manual_impressions: "",
    manual_reach: "",
    notes: "",
    country: "United Arab Emirates",
    region: "",
    city: "",
  });
  const [saving, setSaving] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);

  async function handleSubmit() {
    if (!form.campaign_objective || !form.campaign_name || !form.spend_amount) return;
    setSaving(true);
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { error } = await supabaseClient.from("marketing_expense_logs").insert({
      project_id: projectId,
      campaign_objective: form.campaign_objective,
      date_start: form.date_start,
      date_end: form.date_end,
      channel: form.channel,
      campaign_name: form.campaign_name,
      spend_amount: parseFloat(form.spend_amount),
      currency: form.currency,
      manual_clicks: form.campaign_objective === "sales" && form.manual_clicks ? parseInt(form.manual_clicks) : null,
      manual_impressions: form.manual_impressions ? parseInt(form.manual_impressions) : null,
      manual_reach: form.campaign_objective === "brand_awareness" && form.manual_reach ? parseInt(form.manual_reach) : null,
      notes: form.notes || null,
      import_source: "manual",
      created_by_user_id: user?.id,
      country: form.country || null,
      region: form.region || null,
      city: form.city || null,
    });
    if (error) {
      console.error("Error saving expense:", error);
      alert("Error saving: " + error.message);
      setSaving(false);
      return;
    }
    setForm({ campaign_objective: "", date_start: new Date().toISOString().split("T")[0], date_end: new Date().toISOString().split("T")[0], channel: "google_ads", campaign_name: "", spend_amount: "", currency: "AED", manual_clicks: "", manual_impressions: "", manual_reach: "", notes: "", country: "United Arab Emirates", region: "", city: "" });
    setSaving(false);
    setShowModal(false);
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense entry?")) return;
    await supabaseClient.from("marketing_expense_logs").delete().eq("id", id);
    onRefresh();
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split("\n").map(row => row.split(",").map(cell => cell.trim().replace(/^"|"$/g, "")));
      setCsvPreview(rows.slice(0, 10));
      const headers = rows[0];
      const autoMap: Record<string, string> = {};
      headers.forEach((header, i) => {
        const h = header.toLowerCase();
        if (h.includes("date") || h.includes("day")) autoMap[`col_${i}`] = "date_start";
        else if (h.includes("cost") || h.includes("spend") || h.includes("amount")) autoMap[`col_${i}`] = "spend_amount";
        else if (h.includes("campaign")) autoMap[`col_${i}`] = "campaign_name";
        else if (h.includes("click")) autoMap[`col_${i}`] = "manual_clicks";
        else if (h.includes("impr")) autoMap[`col_${i}`] = "manual_impressions";
      });
      setCsvMapping(autoMap);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvFile || csvPreview.length < 2) return;
    setImporting(true);
    const { data: { user } } = await supabaseClient.auth.getUser();
    const fieldMap: Record<string, number> = {};
    Object.entries(csvMapping).forEach(([col, field]) => {
      const colIndex = parseInt(col.replace("col_", ""));
      if (field) fieldMap[field] = colIndex;
    });
    const importHash = btoa(csvFile.name + csvFile.size + csvFile.lastModified);
    const { data: existing } = await supabaseClient.from("marketing_expense_logs").select("id").eq("project_id", projectId).eq("import_hash", importHash);
    if (existing && existing.length > 0) {
      alert("This file has already been imported.");
      setImporting(false);
      return;
    }
    const entries = csvPreview.slice(1).filter(row => row.length > 1 && row.some(cell => cell)).map(row => ({
      project_id: projectId,
      date_start: row[fieldMap.date_start] || new Date().toISOString().split("T")[0],
      date_end: row[fieldMap.date_end] || row[fieldMap.date_start] || new Date().toISOString().split("T")[0],
      channel: "google_ads" as MarketingChannel,
      campaign_name: row[fieldMap.campaign_name] || "Unknown Campaign",
      spend_amount: parseFloat(row[fieldMap.spend_amount]?.replace(/[^0-9.-]/g, "") || "0"),
      currency: "AED",
      manual_clicks: fieldMap.manual_clicks !== undefined ? parseInt(row[fieldMap.manual_clicks] || "0") : null,
      manual_impressions: fieldMap.manual_impressions !== undefined ? parseInt(row[fieldMap.manual_impressions] || "0") : null,
      import_source: "csv",
      import_filename: csvFile.name,
      import_hash: importHash,
      created_by_user_id: user?.id,
    }));
    if (entries.length > 0) await supabaseClient.from("marketing_expense_logs").insert(entries);
    setCsvFile(null);
    setCsvPreview([]);
    setCsvMapping({});
    setImporting(false);
    setShowImportModal(false);
    onRefresh();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Manual Expense Entries</h2>
          <p className="text-sm text-slate-500">Log advertising spend data manually or import from CSV</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImportModal(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            Import CSV
          </button>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            Add Expense
          </button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <div className="text-4xl mb-2">💰</div>
          <p>No expense entries yet. Add your first spend data to start tracking.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Date Range</th>
                <th className="px-4 py-3">Objective</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3 text-right">Spend</th>
                <th className="px-4 py-3 text-right">Clicks</th>
                <th className="px-4 py-3 text-right">Impressions</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-700">{new Date(expense.date_start).toLocaleDateString()} - {new Date(expense.date_end).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${(expense as any).campaign_objective === "brand_awareness" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{(expense as any).campaign_objective === "brand_awareness" ? "Awareness" : "Sales"}</span></td>
                  <td className="px-4 py-3"><span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{getChannelLabel(expense.channel)}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-medium">{expense.campaign_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{formatMoney(expense.spend_amount)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-right">{expense.manual_clicks?.toLocaleString() || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-right">{expense.manual_impressions?.toLocaleString() || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{[expense.city, expense.region, expense.country].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${expense.import_source === "csv" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{expense.import_source === "csv" ? "CSV Import" : "Manual"}</span></td>
                  <td className="px-4 py-3"><button onClick={() => handleDelete(expense.id)} className="text-slate-400 hover:text-red-500"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Add Expense Entry</h2>
            <div className="space-y-4">
              {/* Campaign Objective Selection */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-700">Campaign Objective *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setForm({ ...form, campaign_objective: "brand_awareness" })} className={`p-4 rounded-xl border-2 text-left transition-all ${form.campaign_objective === "brand_awareness" ? "border-purple-500 bg-purple-50" : "border-slate-200 hover:border-slate-300"}`}>
                    <div className="flex items-center gap-2 mb-1"><span className="text-lg">📢</span><span className="font-semibold text-slate-900">Brand Awareness</span></div>
                    <p className="text-xs text-slate-500">Focus on reach & impressions. No direct conversions tracked.</p>
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, campaign_objective: "sales" })} className={`p-4 rounded-xl border-2 text-left transition-all ${form.campaign_objective === "sales" ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}>
                    <div className="flex items-center gap-2 mb-1"><span className="text-lg">💰</span><span className="font-semibold text-slate-900">Sales / Conversions</span></div>
                    <p className="text-xs text-slate-500">Focus on leads, clicks & revenue. Track ROI directly.</p>
                  </button>
                </div>
              </div>
              {form.campaign_objective && (
              <>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Start Date *</label><input type="date" value={form.date_start} onChange={(e) => setForm({ ...form, date_start: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900" /></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">End Date *</label><input type="date" value={form.date_end} onChange={(e) => setForm({ ...form, date_end: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900" /></div>
              </div>
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Channel *</label><select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as MarketingChannel })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900">{CHANNELS.map((ch) => (<option key={ch.value} value={ch.value}>{ch.label}</option>))}</select></div>
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Campaign Name *</label><input type="text" value={form.campaign_name} onChange={(e) => setForm({ ...form, campaign_name: e.target.value })} placeholder="e.g., Summer Sale 2024" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900" list="campaign-suggestions" /><datalist id="campaign-suggestions">{campaigns.map((c) => (<option key={c.id} value={c.name} />))}</datalist></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Amount Spent *</label><input type="number" value={form.spend_amount} onChange={(e) => setForm({ ...form, spend_amount: e.target.value })} placeholder="0.00" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900" /></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Currency</label><select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900"><option value="AED">AED</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div>
              </div>
              {form.campaign_objective === "brand_awareness" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Total Impressions</label><input type="number" value={form.manual_impressions} onChange={(e) => setForm({ ...form, manual_impressions: e.target.value })} placeholder="0" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900" /></div>
                  <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Total Reach</label><input type="number" value={form.manual_reach} onChange={(e) => setForm({ ...form, manual_reach: e.target.value })} placeholder="0" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900" /></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Total Clicks</label><input type="number" value={form.manual_clicks} onChange={(e) => setForm({ ...form, manual_clicks: e.target.value })} placeholder="0" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900" /></div>
                  <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Total Impressions</label><input type="number" value={form.manual_impressions} onChange={(e) => setForm({ ...form, manual_impressions: e.target.value })} placeholder="0" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900" /></div>
                </div>
              )}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-semibold text-slate-600 mb-3">Geographic Location</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="mb-1 block text-xs text-slate-500">Country</label><select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value, region: e.target.value === "United Arab Emirates" ? form.region : "" })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900">{COMMON_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className="mb-1 block text-xs text-slate-500">Region/Emirate</label>{form.country === "United Arab Emirates" ? <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"><option value="">All Emirates</option>{UAE_EMIRATES.map(e => <option key={e} value={e}>{e}</option>)}</select> : <input type="text" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Region/State" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900" />}</div>
                  <div><label className="mb-1 block text-xs text-slate-500">City</label><input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900" /></div>
                </div>
              </div>
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." rows={2} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 resize-none" /></div>
              </>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleSubmit} disabled={saving || !form.campaign_objective || !form.campaign_name || !form.spend_amount} className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-white shadow-lg disabled:opacity-50">{saving ? "Saving..." : "Save Entry"}</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Import CSV</h2>
            {!csvFile ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                <input type="file" accept=".csv,.xlsx" onChange={handleFileUpload} className="hidden" id="csv-upload" />
                <label htmlFor="csv-upload" className="cursor-pointer"><div className="text-4xl mb-2">📄</div><p className="text-slate-600 mb-2">Drop your CSV file here, or click to browse</p></label>
              </div>
            ) : (
              <>
                <div className="mb-4 p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">📄 {csvFile.name}</span>
                  <button onClick={() => { setCsvFile(null); setCsvPreview([]); setCsvMapping({}); }} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Column Mapping</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {csvPreview[0]?.map((header, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 truncate w-24">{header}</span>
                        <span className="text-slate-300">→</span>
                        <select value={csvMapping[`col_${i}`] || ""} onChange={(e) => setCsvMapping({ ...csvMapping, [`col_${i}`]: e.target.value })} className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                          <option value="">Skip</option>
                          <option value="date_start">Date</option>
                          <option value="campaign_name">Campaign Name</option>
                          <option value="spend_amount">Spend Amount</option>
                          <option value="manual_clicks">Clicks</option>
                          <option value="manual_impressions">Impressions</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mb-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50">{csvPreview[0]?.map((header, i) => (<th key={i} className="px-2 py-1.5 text-left font-medium text-slate-600">{header}</th>))}</tr></thead>
                    <tbody>{csvPreview.slice(1, 6).map((row, i) => (<tr key={i} className="border-t border-slate-100">{row.map((cell, j) => (<td key={j} className="px-2 py-1.5 text-slate-700">{cell}</td>))}</tr>))}</tbody>
                  </table>
                </div>
              </>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowImportModal(false); setCsvFile(null); setCsvPreview([]); }} className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleImport} disabled={importing || !csvFile || csvPreview.length < 2} className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-white shadow-lg disabled:opacity-50">{importing ? "Importing..." : `Import ${csvPreview.length - 1} Rows`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
