"use client";

import { useState, useEffect, useRef } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import type { InvoiceType, InvoiceSettings } from "./InvoiceManagement";

type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  street_address: string | null;
  town: string | null;
  country: string | null;
};

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
};

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
  // Company search
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const companyRef = useRef<HTMLDivElement>(null);

  // Form state
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
  const [aiContext, setAiContext] = useState("");
  const [generatingAi, setGeneratingAi] = useState<number | null>(null);

  // Load companies
  useEffect(() => {
    async function loadCompanies() {
      const { data } = await supabaseClient
        .from("companies")
        .select("id, name, email, phone, street_address, town, country")
        .order("name");
      if (data) setCompanies(data as Company[]);
    }
    loadCompanies();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setShowCompanyDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Select company and auto-fill
  async function handleSelectCompany(company: Company) {
    setSelectedCompany(company);
    setFormClientName(company.name);
    setCompanySearch(company.name);
    setShowCompanyDropdown(false);

    // Build address
    const addressParts = [company.street_address, company.town, company.country].filter(Boolean);
    setFormClientAddress(addressParts.join(", "));

    // Company email/phone as fallback
    let email = company.email || "";
    let phone = company.phone || "";

    // Load primary contact
    const { data: contacts } = await supabaseClient
      .from("contacts")
      .select("first_name, last_name, email, phone, is_primary")
      .eq("company_id", company.id)
      .order("is_primary", { ascending: false })
      .limit(1);

    if (contacts && contacts.length > 0) {
      const contact = contacts[0] as Contact;
      if (contact.email) email = contact.email;
      if (contact.phone) phone = contact.phone;
    }

    setFormClientEmail(email);
    setFormClientPhone(phone);
  }

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  // AI generation for line item description
  async function handleGenerateDescription(index: number) {
    if (!aiContext.trim()) return;
    setGeneratingAi(index);
    try {
      const response = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: aiContext, projectName, type }),
      });
      if (response.ok) {
        const { description } = await response.json();
        if (description) {
          updateItem(index, "description", description);
        }
      }
    } catch (err) {
      console.error("AI generation failed:", err);
    } finally {
      setGeneratingAi(null);
    }
  }

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
            <div className="space-y-4">
              {/* Company Search Dropdown */}
              <div ref={companyRef} className="relative">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Select Company *</label>
                <input
                  type="text"
                  value={companySearch}
                  onChange={(e) => { setCompanySearch(e.target.value); setShowCompanyDropdown(true); }}
                  onFocus={() => setShowCompanyDropdown(true)}
                  placeholder="Search companies..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none"
                />
                {showCompanyDropdown && filteredCompanies.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                    {filteredCompanies.map((company) => (
                      <button
                        key={company.id}
                        type="button"
                        onClick={() => handleSelectCompany(company)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-violet-50 transition-colors"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 text-[11px] font-bold">
                          {company.name[0]}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-slate-900">{company.name}</p>
                          {company.email && <p className="text-[11px] text-slate-500">{company.email}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client Name</label>
                  <input type="text" value={formClientName} onChange={(e) => setFormClientName(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email</label>
                  <input type="email" value={formClientEmail} onChange={(e) => setFormClientEmail(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone</label>
                  <input type="text" value={formClientPhone} onChange={(e) => setFormClientPhone(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Address</label>
                  <input type="text" value={formClientAddress} onChange={(e) => setFormClientAddress(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Dates</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Issue Date</label>
                <input type="date" value={formIssueDate} onChange={(e) => setFormIssueDate(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Due Date</label>
                <input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Line Items</h4>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m-7-7h14" /></svg>
                Add Item
              </button>
            </div>

            {/* AI Context Input */}
            <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="h-4 w-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
                </svg>
                <span className="text-[11px] font-semibold text-violet-700">AI Description Generator</span>
              </div>
              <textarea
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                placeholder="Describe what this quote/invoice is for (e.g., 'Website redesign with 5 pages, SEO optimization, and mobile responsiveness')"
                rows={2}
                className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-[12px] text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none"
              />
            </div>

            <div className="space-y-4">
              {formItems.map((item, index) => (
                <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Description</label>
                      <textarea
                        placeholder="Item description..."
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none resize-none"
                      />
                      {aiContext.trim() && (
                        <button
                          type="button"
                          onClick={() => handleGenerateDescription(index)}
                          disabled={generatingAi === index}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-100 px-3 py-1.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-200 disabled:opacity-50"
                        >
                          {generatingAi === index ? (
                            <>
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
                              </svg>
                              Generate with AI
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="w-20">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Qty</label>
                        <input type="number" value={item.quantity} onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 text-center focus:border-violet-400 focus:outline-none" />
                      </div>
                      <div className="w-28">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Price</label>
                        <input type="number" value={item.unit_price} onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 text-right focus:border-violet-400 focus:outline-none" />
                      </div>
                      <div className="w-24 text-right">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Amount</label>
                        <p className="py-2 text-[14px] font-bold text-slate-900">{(item.quantity * item.unit_price).toFixed(2)}</p>
                      </div>
                      {formItems.length > 1 && (
                        <button type="button" onClick={() => removeItem(index)} className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100">×</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tax Rate (%)</label>
              <input type="number" value={formTaxRate} onChange={(e) => setFormTaxRate(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Discount</label>
              <input type="number" value={formDiscount} onChange={(e) => setFormDiscount(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Notes</label>
            <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none" />
          </div>

          <div className="rounded-xl bg-slate-50 p-4 space-y-2">
            <div className="flex justify-between text-[13px]"><span className="text-slate-700">Subtotal</span><span className="font-semibold text-slate-900">{subtotal.toFixed(2)}</span></div>
            {formDiscount > 0 && <div className="flex justify-between text-[13px]"><span className="text-slate-700">Discount</span><span className="font-semibold text-red-600">-{formDiscount.toFixed(2)}</span></div>}
            <div className="flex justify-between text-[13px]"><span className="text-slate-700">Tax ({formTaxRate}%)</span><span className="font-semibold text-slate-900">{taxAmount.toFixed(2)}</span></div>
            <div className="flex justify-between text-[15px] font-bold border-t border-slate-200 pt-2"><span className="text-slate-900">Total</span><span className="text-slate-900">{total.toFixed(2)}</span></div>
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
