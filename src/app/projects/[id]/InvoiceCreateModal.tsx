"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import type { InvoiceType, InvoiceSettings } from "./InvoiceManagement";

type Props = {
  projectId: string;
  projectName: string;
  clientName?: string;
  type: InvoiceType;
  settings: InvoiceSettings | null;
  onClose: () => void;
  onCreated: () => void;
};

export default function InvoiceCreateModal({ projectId, projectName, clientName, type, settings, onClose, onCreated }: Props) {
  const [formClientName, setFormClientName] = useState(clientName || "");
  const [formClientEmail, setFormClientEmail] = useState("");
  const [formClientPhone, setFormClientPhone] = useState("");
  const [formClientAddress, setFormClientAddress] = useState("");
  const [formIssueDate, setFormIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [formDueDate, setFormDueDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<{ description: string; quantity: number; unit_price: number }[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [formTaxRate, setFormTaxRate] = useState(settings?.tax_rate || 5);
  const [formDiscount, setFormDiscount] = useState(0);
  const [saving, setSaving] = useState(false);

  const subtotal = formItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = (subtotal - formDiscount) * (formTaxRate / 100);
  const total = subtotal - formDiscount + taxAmount;

  function addItem() {
    setFormItems([...formItems, { description: "", quantity: 1, unit_price: 0 }]);
  }

  function removeItem(index: number) {
    setFormItems(formItems.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: string, value: string | number) {
    const updated = [...formItems];
    updated[index] = { ...updated[index], [field]: value };
    setFormItems(updated);
  }

  async function handleSubmit() {
    if (!formClientName.trim()) return;
    try {
      setSaving(true);
      const { data: authData } = await supabaseClient.auth.getUser();
      if (!authData?.user) return;

      const prefix = type === "quote" ? (settings?.quote_prefix || "QUO") : (settings?.invoice_prefix || "INV");
      const invoiceNumber = `${prefix}-${Date.now().toString().slice(-6)}`;

      const { data: invoice, error } = await supabaseClient.from("invoices").insert({
        project_id: projectId,
        invoice_number: invoiceNumber,
        invoice_type: type,
        status: "draft",
        client_name: formClientName,
        client_email: formClientEmail || null,
        client_phone: formClientPhone || null,
        client_address: formClientAddress || null,
        issue_date: formIssueDate,
        due_date: formDueDate || null,
        subtotal,
        tax_rate: formTaxRate,
        tax_amount: taxAmount,
        discount_amount: formDiscount,
        total,
        currency: settings?.currency || "AED",
        notes: formNotes || null,
        company_name: settings?.company_name,
        company_logo_url: settings?.company_logo_url,
        company_address: settings?.company_address,
        company_phone: settings?.company_phone,
        company_email: settings?.company_email,
        bank_name: settings?.bank_name,
        bank_account_number: settings?.bank_account_number,
        bank_iban: settings?.bank_iban,
        created_by: authData.user.id,
      }).select().single();

      if (error) throw error;

      const itemsToInsert = formItems.filter(item => item.description.trim()).map((item, index) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
        sort_order: index,
      }));

      if (itemsToInsert.length > 0) {
        await supabaseClient.from("invoice_items").insert(itemsToInsert);
      }

      onCreated();
      onClose();
    } catch (err) {
      console.error("Failed to create invoice:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button type="button" className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Create {type === "quote" ? "Quote" : "Invoice"}</h3>
            <p className="text-xs text-slate-500">Project: {projectName}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">×</button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Client Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client Name *</label>
                <input type="text" value={formClientName} onChange={(e) => setFormClientName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-violet-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email</label>
                <input type="email" value={formClientEmail} onChange={(e) => setFormClientEmail(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-violet-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone</label>
                <input type="text" value={formClientPhone} onChange={(e) => setFormClientPhone(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-violet-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Address</label>
                <input type="text" value={formClientAddress} onChange={(e) => setFormClientAddress(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-violet-400 focus:outline-none" />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Dates</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Issue Date</label>
                <input type="date" value={formIssueDate} onChange={(e) => setFormIssueDate(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-violet-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Due Date</label>
                <input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-violet-400 focus:outline-none" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Line Items</h4>
              <button type="button" onClick={addItem} className="text-[11px] font-semibold text-violet-600 hover:text-violet-700">+ Add Item</button>
            </div>
            <div className="space-y-3">
              {formItems.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input type="text" placeholder="Description" value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-violet-400 focus:outline-none" />
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)} className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-violet-400 focus:outline-none" />
                  <input type="number" placeholder="Price" value={item.unit_price} onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)} className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-violet-400 focus:outline-none" />
                  <span className="w-24 text-right text-[13px] font-semibold text-slate-700">{(item.quantity * item.unit_price).toFixed(2)}</span>
                  {formItems.length > 1 && <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-600">×</button>}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tax Rate (%)</label>
              <input type="number" value={formTaxRate} onChange={(e) => setFormTaxRate(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-violet-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Discount</label>
              <input type="number" value={formDiscount} onChange={(e) => setFormDiscount(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-violet-400 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Notes</label>
            <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-violet-400 focus:outline-none" />
          </div>

          <div className="rounded-xl bg-slate-50 p-4 space-y-2">
            <div className="flex justify-between text-[13px]"><span className="text-slate-600">Subtotal</span><span className="font-semibold">{subtotal.toFixed(2)}</span></div>
            {formDiscount > 0 && <div className="flex justify-between text-[13px]"><span className="text-slate-600">Discount</span><span className="font-semibold text-red-600">-{formDiscount.toFixed(2)}</span></div>}
            <div className="flex justify-between text-[13px]"><span className="text-slate-600">Tax ({formTaxRate}%)</span><span className="font-semibold">{taxAmount.toFixed(2)}</span></div>
            <div className="flex justify-between text-[15px] font-bold border-t border-slate-200 pt-2"><span>Total</span><span>{total.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saving || !formClientName.trim()} className="rounded-xl bg-violet-600 px-4 py-2.5 text-[12px] font-semibold text-white shadow-lg hover:bg-violet-700 disabled:opacity-50">
            {saving ? "Creating..." : `Create ${type === "quote" ? "Quote" : "Invoice"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
