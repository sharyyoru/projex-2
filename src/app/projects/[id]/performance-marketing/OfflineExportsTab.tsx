"use client";

import { useState } from "react";
import { MarketingLead } from "./types";

export default function OfflineExportsTab({
  projectId,
  leads,
}: {
  projectId: string;
  leads: MarketingLead[];
}) {
  const [exportingGclid, setExportingGclid] = useState(false);
  const [exportingFbclid, setExportingFbclid] = useState(false);
  const [exportingAudience, setExportingAudience] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  // Filter leads with GCLID (won deals in last 30 days)
  const gclidLeads = leads.filter(l => 
    l.gclid && 
    l.deal_status === "won" &&
    l.converted_at &&
    l.converted_at >= dateRange.start
  );

  // Filter leads with FBCLID
  const fbclidLeads = leads.filter(l => 
    l.fbclid && 
    l.deal_status === "won" &&
    l.converted_at &&
    l.converted_at >= dateRange.start
  );

  // All leads with emails for audience export
  const emailLeads = leads.filter(l => l.email);

  // SHA-256 hash function (async)
  async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // Export GCLID for Google Ads Offline Conversions
  async function exportGclidConversions() {
    setExportingGclid(true);
    
    // Google Ads offline conversion format
    // Headers: Google Click ID, Conversion Name, Conversion Time, Conversion Value, Conversion Currency
    const headers = ["Google Click ID", "Conversion Name", "Conversion Time", "Conversion Value", "Conversion Currency"];
    const rows = gclidLeads.map(lead => {
      // Format time in Google's required format: yyyy-MM-dd HH:mm:ss+TZ
      const conversionTime = lead.converted_at 
        ? new Date(lead.converted_at).toISOString().replace("T", " ").replace("Z", "+0000").slice(0, 22) + "+0400"
        : "";
      return [
        lead.gclid,
        "Lead Conversion",
        conversionTime,
        lead.deal_value?.toString() || "0",
        "AED"
      ];
    });
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    downloadFile(csv, `google_offline_conversions_${dateRange.start}_${dateRange.end}.csv`, "text/csv");
    setExportingGclid(false);
  }

  // Export FBCLID for Meta Conversions API (offline events)
  async function exportFbclidConversions() {
    setExportingFbclid(true);
    
    // Meta offline conversions format
    const headers = ["fbc", "event_name", "event_time", "value", "currency", "email"];
    const rows = await Promise.all(fbclidLeads.map(async lead => {
      const eventTime = lead.converted_at 
        ? Math.floor(new Date(lead.converted_at).getTime() / 1000).toString()
        : "";
      const hashedEmail = lead.email ? await sha256(lead.email) : "";
      return [
        lead.fbclid,
        "Purchase",
        eventTime,
        lead.deal_value?.toString() || "0",
        "AED",
        hashedEmail
      ];
    }));
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    downloadFile(csv, `meta_offline_conversions_${dateRange.start}_${dateRange.end}.csv`, "text/csv");
    setExportingFbclid(false);
  }

  // Export hashed customer list for Facebook Custom Audiences
  async function exportHashedAudience() {
    setExportingAudience(true);
    
    // Facebook Custom Audience format - just hashed emails
    const headers = ["email"];
    const rows = await Promise.all(emailLeads.map(async lead => {
      const hashedEmail = lead.email ? await sha256(lead.email) : "";
      return [hashedEmail];
    }));
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    downloadFile(csv, `hashed_customer_audience_${new Date().toISOString().split("T")[0]}.csv`, "text/csv");
    setExportingAudience(false);
  }

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Offline Conversion Exports</h2>
          <p className="text-sm text-slate-500">Generate files for uploading to ad networks</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="text-sm text-slate-700 border-none focus:outline-none"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="text-sm text-slate-700 border-none focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Google Offline Conversions */}
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Google Ads</h3>
              <p className="text-xs text-slate-500">Offline Conversion Import</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Export closed-won deals with GCLID for uploading to Google Ads as offline conversions.
          </p>
          <div className="text-xs text-slate-500 mb-3">
            <span className="font-medium">{gclidLeads.length}</span> conversions available
          </div>
          <button
            onClick={exportGclidConversions}
            disabled={exportingGclid || gclidLeads.length === 0}
            className="w-full rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {exportingGclid ? "Exporting..." : "Export GCLID CSV"}
          </button>
        </div>

        {/* Meta Offline Conversions */}
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Meta (Facebook)</h3>
              <p className="text-xs text-slate-500">Offline Events</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Export closed-won deals with FBCLID for uploading to Meta Events Manager.
          </p>
          <div className="text-xs text-slate-500 mb-3">
            <span className="font-medium">{fbclidLeads.length}</span> conversions available
          </div>
          <button
            onClick={exportFbclidConversions}
            disabled={exportingFbclid || fbclidLeads.length === 0}
            className="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {exportingFbclid ? "Exporting..." : "Export FBCLID CSV"}
          </button>
        </div>

        {/* Hashed Customer Audience */}
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Custom Audience</h3>
              <p className="text-xs text-slate-500">Hashed Email Export</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Export SHA-256 hashed emails for Facebook Custom Audiences or Google Customer Match.
          </p>
          <div className="text-xs text-slate-500 mb-3">
            <span className="font-medium">{emailLeads.length}</span> contacts available
          </div>
          <button
            onClick={exportHashedAudience}
            disabled={exportingAudience || emailLeads.length === 0}
            className="w-full rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-50"
          >
            {exportingAudience ? "Hashing & Exporting..." : "Export Hashed Audience"}
          </button>
        </div>
      </div>

      {/* Export Guide */}
      <div className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">📖 Export Guide</h3>
        <div className="text-xs text-slate-600 space-y-2">
          <p><strong>Google Ads:</strong> Go to Tools &amp; Settings → Conversions → Upload → Select the exported CSV file.</p>
          <p><strong>Meta Events Manager:</strong> Go to Events Manager → Offline Events → Upload Offline Events → Select the exported CSV.</p>
          <p><strong>Custom Audiences:</strong> Go to Audiences → Create Audience → Custom Audience → Customer List → Upload the hashed CSV.</p>
        </div>
      </div>
    </div>
  );
}
