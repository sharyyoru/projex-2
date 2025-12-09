"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";

type Contact = {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  is_primary: boolean;
  created_at: string | null;
  company?: { id: string; name: string } | null;
};

function formatFullName(first: string | null, last: string | null): string {
  return [first ?? "", last ?? ""].join(" ").trim();
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPrimary, setFilterPrimary] = useState<"all" | "primary" | "secondary">("all");
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    setLoading(true);
    const { data, error } = await supabaseClient
      .from("contacts")
      .select("id, company_id, first_name, last_name, email, phone, mobile, job_title, is_primary, created_at, company:companies(id, name)")
      .order("first_name");
    
    if (!error && data) {
      // Flatten the company relation from array to single object
      const normalized = data.map((c: any) => ({
        ...c,
        company: Array.isArray(c.company) ? c.company[0] : c.company
      }));
      setContacts(normalized as Contact[]);
    }
    setLoading(false);
  }

  async function handleSaveContact() {
    if (!editingContact) return;
    setSaving(true);
    
    const { error } = await supabaseClient
      .from("contacts")
      .update({
        first_name: editingContact.first_name,
        last_name: editingContact.last_name,
        email: editingContact.email,
        phone: editingContact.phone,
        mobile: editingContact.mobile,
        job_title: editingContact.job_title,
        is_primary: editingContact.is_primary,
      })
      .eq("id", editingContact.id);
    
    if (!error) {
      setContacts(prev => prev.map(c => c.id === editingContact.id ? editingContact : c));
      setEditingContact(null);
    }
    setSaving(false);
  }

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      // Search filter
      const searchLower = search.toLowerCase();
      const matchSearch = !search || 
        c.first_name?.toLowerCase().includes(searchLower) ||
        c.last_name?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower) ||
        c.job_title?.toLowerCase().includes(searchLower) ||
        c.company?.name?.toLowerCase().includes(searchLower);
      
      // Primary filter
      const matchPrimary = filterPrimary === "all" || 
        (filterPrimary === "primary" && c.is_primary) ||
        (filterPrimary === "secondary" && !c.is_primary);
      
      return matchSearch && matchPrimary;
    });
  }, [contacts, search, filterPrimary]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 p-8 text-white shadow-2xl">
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold">Contacts</h1>
                <p className="text-white/70 text-sm">{contacts.length} total contacts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[250px]">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, company, job title..."
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-black placeholder-slate-400 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {[
              { id: "all", label: "All" },
              { id: "primary", label: "Primary" },
              { id: "secondary", label: "Secondary" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterPrimary(f.id as typeof filterPrimary)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterPrimary === f.id
                    ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-slate-500">
          Showing {filteredContacts.length} of {contacts.length} contacts
        </p>

        {/* Contacts Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-500 border-t-transparent" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-pink-100">
              <svg className="h-8 w-8 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <p className="mt-4 text-[14px] font-medium text-slate-700">No contacts found</p>
            <p className="mt-1 text-[12px] text-slate-500">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredContacts.map((contact) => {
              const name = formatFullName(contact.first_name, contact.last_name) || "Unnamed";
              const initials = `${(contact.first_name || "?").charAt(0)}${(contact.last_name || "").charAt(0)}`.toUpperCase();
              
              return (
                <div
                  key={contact.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white p-5 shadow-lg shadow-slate-200/30 transition-all hover:shadow-xl hover:shadow-rose-200/30"
                >
                  {/* Primary badge */}
                  {contact.is_primary && (
                    <div className="absolute right-3 top-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                        <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        Primary
                      </span>
                    </div>
                  )}
                  
                  {/* Edit button */}
                  <button
                    type="button"
                    onClick={() => setEditingContact(contact)}
                    className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                    style={{ top: contact.is_primary ? "2.5rem" : "0.75rem" }}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  
                  {/* Avatar */}
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 text-lg font-bold text-white shadow-lg shadow-rose-500/25">
                    {initials}
                  </div>
                  
                  {/* Info */}
                  <div className="mt-4">
                    <h3 className="text-[14px] font-semibold text-slate-900">{name}</h3>
                    {contact.job_title && (
                      <p className="mt-0.5 text-[12px] text-slate-500">{contact.job_title}</p>
                    )}
                    {contact.company && (
                      <Link href={`/companies/${contact.company.id}`} className="mt-1 inline-flex items-center gap-1 text-[11px] text-rose-600 hover:underline">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
                        </svg>
                        {contact.company.name}
                      </Link>
                    )}
                  </div>
                  
                  {/* Contact details */}
                  <div className="mt-4 space-y-2">
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-[12px] text-slate-600 hover:text-rose-600 transition-colors">
                        <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                        <span className="truncate">{contact.email}</span>
                      </a>
                    )}
                    {contact.mobile && (
                      <a href={`tel:${contact.mobile}`} className="flex items-center gap-2 text-[12px] text-slate-600 hover:text-rose-600 transition-colors">
                        <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="5" y="2" width="14" height="20" rx="2" />
                          <path d="M12 18h.01" />
                        </svg>
                        {contact.mobile}
                      </a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-[12px] text-slate-600 hover:text-rose-600 transition-colors">
                        <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        {contact.phone}
                      </a>
                    )}
                  </div>
                  
                  {/* Date footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400">Added {formatDate(contact.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Contact Modal */}
      {editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Edit Contact</h2>
              <button type="button" onClick={() => setEditingContact(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <svg className="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={editingContact.first_name}
                    onChange={(e) => setEditingContact({ ...editingContact, first_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black focus:border-rose-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editingContact.last_name}
                    onChange={(e) => setEditingContact({ ...editingContact, last_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black focus:border-rose-400 focus:outline-none"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                <input
                  type="text"
                  value={editingContact.job_title || ""}
                  onChange={(e) => setEditingContact({ ...editingContact, job_title: e.target.value || null })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black focus:border-rose-400 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editingContact.email || ""}
                  onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value || null })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black focus:border-rose-400 focus:outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
                  <input
                    type="tel"
                    value={editingContact.mobile || ""}
                    onChange={(e) => setEditingContact({ ...editingContact, mobile: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black focus:border-rose-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editingContact.phone || ""}
                    onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black focus:border-rose-400 focus:outline-none"
                  />
                </div>
              </div>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingContact.is_primary}
                  onChange={(e) => setEditingContact({ ...editingContact, is_primary: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-sm text-slate-700">Primary Contact</span>
              </label>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveContact}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-rose-500 to-pink-500 rounded-lg hover:shadow-lg disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
