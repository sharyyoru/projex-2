"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import type { InvoiceSettings } from "./InvoiceManagement";

type Props = {
  settings: InvoiceSettings | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function InvoiceSettingsModal({ settings, onClose, onSaved }: Props) {
  const [companyName, setCompanyName] = useState(settings?.company_name || "");
  const [companyLogoUrl, setCompanyLogoUrl] = useState(settings?.company_logo_url || "");
  const [companyAddress, setCompanyAddress] = useState(settings?.company_address || "");
  const [companyPhone, setCompanyPhone] = useState(settings?.company_phone || "");
  const [companyEmail, setCompanyEmail] = useState(settings?.company_email || "");
  const [bankName, setBankName] = useState(settings?.bank_name || "");
  const [bankAccountNumber, setBankAccountNumber] = useState(settings?.bank_account_number || "");
  const [bankIban, setBankIban] = useState(settings?.bank_iban || "");
  const [invoicePrefix, setInvoicePrefix] = useState(settings?.invoice_prefix || "INV");
  const [quotePrefix, setQuotePrefix] = useState(settings?.quote_prefix || "QUO");
  const [currency, setCurrency] = useState(settings?.currency || "AED");
  const [taxRate, setTaxRate] = useState(settings?.tax_rate || 5);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    try {
      setSaving(true);
      const { data: authData } = await supabaseClient.auth.getUser();
      if (!authData?.user) return;

      const settingsData = {
        user_id: authData.user.id,
        company_name: companyName || null,
        company_logo_url: companyLogoUrl || null,
        company_address: companyAddress || null,
        company_phone: companyPhone || null,
        company_email: companyEmail || null,
        bank_name: bankName || null,
        bank_account_number: bankAccountNumber || null,
        bank_iban: bankIban || null,
        invoice_prefix: invoicePrefix,
        quote_prefix: quotePrefix,
        currency,
        tax_rate: taxRate,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from("invoice_settings")
        .upsert(settingsData, { onConflict: "user_id" });

      if (error) throw error;
      onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button type="button" className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">Invoice Settings</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">×</button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Company Details</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Company Name</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Logo URL</label>
                <input type="text" value={companyLogoUrl} onChange={(e) => setCompanyLogoUrl(e.target.value)} placeholder="https://..." className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Address</label>
                <textarea value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone</label>
                  <input type="text" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email</label>
                  <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Bank Details</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bank Name</label>
                <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Account Number</label>
                  <input type="text" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">IBAN</label>
                  <input type="text" value={bankIban} onChange={(e) => setBankIban(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Defaults</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Invoice Prefix</label>
                <input type="text" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Quote Prefix</label>
                <input type="text" value={quotePrefix} onChange={(e) => setQuotePrefix(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none">
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tax Rate (%)</label>
                <input type="number" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="rounded-xl bg-violet-600 px-4 py-2.5 text-[12px] font-semibold text-white shadow-lg hover:bg-violet-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
