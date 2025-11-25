"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import InvoiceCreateModal from "./InvoiceCreateModal";
import InvoiceSettingsModal from "./InvoiceSettingsModal";
import InvoicePdfModal from "./InvoicePdfModal";

export type InvoiceStatus = "draft" | "sent" | "paid" | "unpaid" | "overdue" | "cancelled" | "accepted" | "rejected";
export type InvoiceType = "quote" | "invoice";

export type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  issue_date: string;
  due_date: string | null;
  paid_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  currency: string;
  notes: string | null;
  company_name: string | null;
  company_logo_url: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  created_at: string;
  items?: InvoiceItem[];
};

export type InvoiceSettings = {
  company_name: string | null;
  company_logo_url: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  invoice_prefix: string;
  quote_prefix: string;
  currency: string;
  tax_rate: number;
};

type FinancialSummary = { quoted: number; invoiced: number; paid: number; overdue: number };

function formatMoney(amount: number, currency = "AED"): string {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const statusColors: Record<InvoiceStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  unpaid: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default function InvoiceManagement({ projectId, projectName, clientName }: { projectId: string; projectName: string; clientName?: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [createType, setCreateType] = useState<InvoiceType>("invoice");
  const [summary, setSummary] = useState<FinancialSummary>({ quoted: 0, invoiced: 0, paid: 0, overdue: 0 });

  useEffect(() => { loadInvoices(); loadSettings(); }, [projectId]);

  async function loadInvoices() {
    try {
      setLoading(true);
      const { data } = await supabaseClient.from("invoices").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      setInvoices((data as Invoice[]) || []);
      const newSummary: FinancialSummary = { quoted: 0, invoiced: 0, paid: 0, overdue: 0 };
      for (const inv of (data || []) as Invoice[]) {
        if (inv.invoice_type === "quote" && inv.status !== "cancelled") newSummary.quoted += inv.total;
        if (inv.invoice_type === "invoice" && inv.status !== "cancelled") {
          newSummary.invoiced += inv.total;
          if (inv.status === "paid") newSummary.paid += inv.total;
          if (inv.status === "overdue") newSummary.overdue += inv.total;
        }
      }
      setSummary(newSummary);
    } finally { setLoading(false); }
  }

  async function loadSettings() {
    const { data: authData } = await supabaseClient.auth.getUser();
    if (!authData?.user) return;
    const { data } = await supabaseClient.from("invoice_settings").select("*").eq("user_id", authData.user.id).single();
    if (data) setSettings(data as InvoiceSettings);
  }

  async function handleViewPdf(invoice: Invoice) {
    const { data } = await supabaseClient.from("invoice_items").select("*").eq("invoice_id", invoice.id).order("sort_order");
    setSelectedInvoice({ ...invoice, items: (data as InvoiceItem[]) || [] });
    setShowPdfModal(true);
  }

  async function handleUpdateStatus(invoice: Invoice, newStatus: InvoiceStatus) {
    const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "paid") updates.paid_date = new Date().toISOString().split("T")[0];
    await supabaseClient.from("invoices").update(updates).eq("id", invoice.id);
    loadInvoices();
  }

  async function handleCreateInvoiceFromQuote(quote: Invoice) {
    try {
      const { data: authData } = await supabaseClient.auth.getUser();
      if (!authData?.user) return;

      // Get quote items
      const { data: items } = await supabaseClient.from("invoice_items").select("*").eq("invoice_id", quote.id).order("sort_order");

      // Generate new invoice number
      const prefix = settings?.invoice_prefix || "INV";
      const invoiceNumber = `${prefix}-${Date.now().toString().slice(-6)}`;

      // Create invoice from quote
      const { data: invoice, error } = await supabaseClient.from("invoices").insert({
        project_id: projectId,
        invoice_number: invoiceNumber,
        invoice_type: "invoice",
        status: "unpaid",
        client_name: quote.client_name,
        client_email: quote.client_email,
        client_phone: quote.client_phone,
        client_address: quote.client_address,
        issue_date: new Date().toISOString().split("T")[0],
        subtotal: quote.subtotal,
        tax_rate: quote.tax_rate,
        tax_amount: quote.tax_amount,
        discount_amount: quote.discount_amount,
        total: quote.total,
        currency: quote.currency,
        notes: quote.notes,
        company_name: quote.company_name,
        company_logo_url: quote.company_logo_url,
        company_address: quote.company_address,
        company_phone: quote.company_phone,
        company_email: quote.company_email,
        bank_name: quote.bank_name,
        bank_account_number: quote.bank_account_number,
        bank_iban: quote.bank_iban,
        created_by: authData.user.id,
      }).select().single();

      if (error || !invoice) return;

      // Copy items to new invoice
      if (items && items.length > 0) {
        const newItems = items.map((item: InvoiceItem) => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          sort_order: item.sort_order,
        }));
        await supabaseClient.from("invoice_items").insert(newItems);
      }

      // Mark quote as accepted
      await supabaseClient.from("invoices").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", quote.id);

      loadInvoices();
    } catch (err) {
      console.error("Failed to create invoice from quote:", err);
    }
  }

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Quoted</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(summary.quoted)}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Invoiced</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(summary.invoiced)}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Paid</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(summary.paid)}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 p-4 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Overdue</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(summary.overdue)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { setCreateType("quote"); setShowCreateModal(true); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[12px] font-semibold text-white shadow-lg hover:bg-blue-700">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m-7-7h14" /></svg>
            New Quote
          </button>
          <button type="button" onClick={() => { setCreateType("invoice"); setShowCreateModal(true); }} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[12px] font-semibold text-white shadow-lg hover:bg-violet-700">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m-7-7h14" /></svg>
            New Invoice
          </button>
        </div>
        <button type="button" onClick={() => setShowSettingsModal(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
          Settings
        </button>
      </div>

      {/* Invoice List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" /></div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-700">No invoices yet</p>
            <p className="mt-1 text-xs text-slate-400">Create a quote or invoice to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-5 hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${inv.invoice_type === "quote" ? "bg-blue-100 text-blue-600" : "bg-violet-100 text-violet-600"}`}>
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-slate-900">{inv.invoice_number}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColors[inv.status]}`}>{inv.status}</span>
                    </div>
                    <p className="text-[12px] text-slate-500">{inv.client_name}</p>
                    <p className="text-[11px] text-slate-400">{formatDate(inv.issue_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[15px] font-bold text-slate-900">{formatMoney(inv.total, inv.currency)}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{inv.invoice_type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleViewPdf(inv)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="View PDF">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                    {/* Draft actions */}
                    {inv.status === "draft" && <button type="button" onClick={() => handleUpdateStatus(inv, "sent")} className="h-9 rounded-lg bg-blue-50 px-3 text-[11px] font-semibold text-blue-700 hover:bg-blue-100">Send</button>}
                    
                    {/* Quote actions */}
                    {inv.invoice_type === "quote" && inv.status === "sent" && (
                      <>
                        <button type="button" onClick={() => handleUpdateStatus(inv, "accepted")} className="h-9 rounded-lg bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">Accept</button>
                        <button type="button" onClick={() => handleUpdateStatus(inv, "rejected")} className="h-9 rounded-lg bg-red-50 px-3 text-[11px] font-semibold text-red-700 hover:bg-red-100">Reject</button>
                      </>
                    )}
                    {inv.invoice_type === "quote" && inv.status === "accepted" && (
                      <button type="button" onClick={() => handleCreateInvoiceFromQuote(inv)} className="h-9 rounded-lg bg-violet-50 px-3 text-[11px] font-semibold text-violet-700 hover:bg-violet-100">Create Invoice</button>
                    )}
                    
                    {/* Invoice actions */}
                    {inv.invoice_type === "invoice" && (inv.status === "sent" || inv.status === "unpaid") && (
                      <button type="button" onClick={() => handleUpdateStatus(inv, "paid")} className="h-9 rounded-lg bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">Mark Paid</button>
                    )}
                    {inv.invoice_type === "invoice" && inv.status === "paid" && (
                      <button type="button" onClick={() => handleUpdateStatus(inv, "unpaid")} className="h-9 rounded-lg bg-amber-50 px-3 text-[11px] font-semibold text-amber-700 hover:bg-amber-100">Mark Unpaid</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && <InvoiceCreateModal projectId={projectId} projectName={projectName} clientName={clientName} type={createType} settings={settings} onClose={() => setShowCreateModal(false)} onCreated={loadInvoices} />}
      {showSettingsModal && <InvoiceSettingsModal settings={settings} onClose={() => setShowSettingsModal(false)} onSaved={loadSettings} />}
      {showPdfModal && selectedInvoice && <InvoicePdfModal invoice={selectedInvoice} onClose={() => setShowPdfModal(false)} />}
    </div>
  );
}
