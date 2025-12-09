"use client";

import { FormEvent, useEffect, useMemo, useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type Company = {
  id: string;
  name: string;
  legal_name: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  size: string | null;
  street_address: string | null;
  postal_code: string | null;
  town: string | null;
  country: string | null;
  notes: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_twitter: string | null;
  social_linkedin: string | null;
  social_youtube: string | null;
  social_tiktok: string | null;
  logo_url: string | null;
  brand_color_1: string | null;
  brand_color_2: string | null;
};

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
};

type Project = {
  id: string;
  company_id: string;
  primary_contact_id: string | null;
  name: string;
  description: string | null;
  status: string | null;
  processed_outcome: string | null;
  pipeline: string | null;
  value: number | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string | null;
};

const COMPANY_SELECT =
  "id, name, legal_name, website, email, phone, industry, size, street_address, postal_code, town, country, notes, social_facebook, social_instagram, social_twitter, social_linkedin, social_youtube, social_tiktok, logo_url, brand_color_1, brand_color_2";

// Default brand colors (gradient from violet to purple)
const DEFAULT_BRAND_COLOR_1 = "#8b5cf6";
const DEFAULT_BRAND_COLOR_2 = "#a855f7";

// Industry colors for badges
const INDUSTRY_COLORS: Record<string, string> = {
  Healthcare: "from-pink-500 to-rose-500",
  Finance: "from-emerald-500 to-teal-500",
  Technology: "from-violet-500 to-purple-500",
  Hospitality: "from-amber-500 to-orange-500",
  Retail: "from-sky-500 to-cyan-500",
  Education: "from-indigo-500 to-blue-500",
  Manufacturing: "from-slate-500 to-gray-500",
  "Real Estate": "from-lime-500 to-green-500",
};

function formatFullName(first: string | null, last: string | null): string {
  return [first ?? "", last ?? ""]
    .join(" ")
    .trim();
}

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const companyId = params?.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"contacts" | "projects">("contacts");
  const [editingDetails, setEditingDetails] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [editingSocial, setEditingSocial] = useState(false);
  const [savingSocial, setSavingSocial] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [savingContact, setSavingContact] = useState(false);

  async function handleSaveContact() {
    if (!editingContact) return;
    setSavingContact(true);
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
    setSavingContact(false);
  }

  useEffect(() => {
    if (!companyId) return;
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [companyResult, contactsResult, projectsResult] = await Promise.all([
          supabaseClient
            .from("companies")
            .select(COMPANY_SELECT)
            .eq("id", companyId)
            .maybeSingle(),
          supabaseClient
            .from("contacts")
            .select(
              "id, company_id, first_name, last_name, email, phone, mobile, job_title, is_primary, created_at",
            )
            .eq("company_id", companyId)
            .order("is_primary", { ascending: false })
            .order("created_at", { ascending: true }),
          supabaseClient
            .from("projects")
            .select(
              "id, company_id, primary_contact_id, name, description, status, processed_outcome, pipeline, value, start_date, due_date, created_at",
            )
            .eq("company_id", companyId)
            .order("created_at", { ascending: false }),
        ]);

        if (!isMounted) return;

        if (companyResult.error || !companyResult.data) {
          setError(companyResult.error?.message ?? "Company not found.");
          setCompany(null);
          setContacts([]);
          setProjects([]);
          setLoading(false);
          return;
        }

        setCompany(companyResult.data as Company);

        const { data: contactsData, error: contactsError } = contactsResult;
        if (!contactsError && contactsData) {
          setContacts(contactsData as Contact[]);
        } else {
          setContacts([]);
        }

        const { data: projectsData, error: projectsError } = projectsResult;
        if (!projectsError && projectsData) {
          setProjects(projectsData as Project[]);
        } else {
          setProjects([]);
        }

        setLoading(false);
      } catch {
        if (!isMounted) return;
        setError("Failed to load company.");
        setCompany(null);
        setContacts([]);
        setProjects([]);
        setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [companyId]);

  const contactsById = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach((c) => map.set(c.id, c));
    return map;
  }, [contacts]);

  function handleContactCreated(contact: Contact) {
    setContacts((prev) => {
      const next = [...prev];
      if (contact.is_primary) {
        // Move primary contacts to top
        return [contact, ...next.filter((c) => c.id !== contact.id)];
      }
      return [contact, ...next];
    });
  }

  function handleProjectCreated(project: Project) {
    setProjects((prev) => [project, ...prev]);
  }

  async function handleDetailsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company) return;

    const formData = new FormData(event.currentTarget);

    const website = (formData.get("website") as string | null)?.trim() || null;
    const email = (formData.get("email") as string | null)?.trim() || null;
    const phone = (formData.get("phone") as string | null)?.trim() || null;
    const industry = (formData.get("industry") as string | null)?.trim() || null;
    const size = (formData.get("size") as string | null)?.trim() || null;
    const streetAddress =
      (formData.get("street_address") as string | null)?.trim() || null;
    const postalCode =
      (formData.get("postal_code") as string | null)?.trim() || null;
    const town = (formData.get("town") as string | null)?.trim() || null;
    const country =
      (formData.get("country") as string | null)?.trim() || null;
    const notes = (formData.get("notes") as string | null)?.trim() || null;

    setSavingDetails(true);
    setDetailsError(null);

    try {
      const { data, error: updateError } = await supabaseClient
        .from("companies")
        .update({
          website,
          email,
          phone,
          industry,
          size,
          street_address: streetAddress,
          postal_code: postalCode,
          town,
          country,
          notes,
        })
        .eq("id", company.id)
        .select(COMPANY_SELECT)
        .single();

      if (updateError || !data) {
        setDetailsError(updateError?.message ?? "Failed to update company.");
        setSavingDetails(false);
        return;
      }

      setCompany(data as Company);
      setEditingDetails(false);
      setSavingDetails(false);
    } catch {
      setDetailsError("Failed to update company.");
      setSavingDetails(false);
    }
  }

  async function handleSocialSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company) return;

    const formData = new FormData(event.currentTarget);

    const social_facebook =
      (formData.get("social_facebook") as string | null)?.trim() || null;
    const social_instagram =
      (formData.get("social_instagram") as string | null)?.trim() || null;
    const social_twitter =
      (formData.get("social_twitter") as string | null)?.trim() || null;
    const social_linkedin =
      (formData.get("social_linkedin") as string | null)?.trim() || null;
    const social_youtube =
      (formData.get("social_youtube") as string | null)?.trim() || null;
    const social_tiktok =
      (formData.get("social_tiktok") as string | null)?.trim() || null;

    setSavingSocial(true);
    setSocialError(null);

    try {
      const { data, error: updateError } = await supabaseClient
        .from("companies")
        .update({
          social_facebook,
          social_instagram,
          social_twitter,
          social_linkedin,
          social_youtube,
          social_tiktok,
        })
        .eq("id", company.id)
        .select(COMPANY_SELECT)
        .single();

      if (updateError || !data) {
        setSocialError(
          updateError?.message ?? "Failed to update social links.",
        );
        setSavingSocial(false);
        return;
      }

      setCompany(data as Company);
      setEditingSocial(false);
      setSavingSocial(false);
    } catch {
      setSocialError("Failed to update social links.");
      setSavingSocial(false);
    }
  }

  if (!companyId) {
    return (
      <div className="text-sm text-slate-500">Missing company id in URL.</div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading company...
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-slate-900">Company</h1>
        <p className="text-sm text-red-600">{error ?? "Company not found."}</p>
      </div>
    );
  }

  const location = [company.town, company.country].filter(Boolean).join(", ");

  // Brand colors for gradient (from company or defaults)
  const brandColor1 = company.brand_color_1 || DEFAULT_BRAND_COLOR_1;
  const brandColor2 = company.brand_color_2 || DEFAULT_BRAND_COLOR_2;
  const industryColor = INDUSTRY_COLORS[company.industry || ""] || "from-violet-500 to-purple-500";

  // Calculate stats
  const totalProjectsValue = projects.reduce((sum, p) => sum + (p.value || 0), 0);
  const activeProjects = projects.filter(p => !["Closed", "Abandoned"].includes(p.status || "")).length;

  return (
    <div className="space-y-6">
      {/* Decorative gradient background */}
      <div className="pointer-events-none fixed top-[120px] right-0 h-[500px] w-[600px] overflow-hidden opacity-60">
        <div
          className="absolute top-0 -right-20 h-[350px] w-[450px] rounded-full blur-3xl"
          style={{
            background: `linear-gradient(160deg, ${brandColor1}30 0%, ${brandColor2}20 50%, transparent 100%)`,
          }}
        />
        <div
          className="absolute top-[100px] right-10 h-[250px] w-[350px] rounded-full blur-3xl"
          style={{
            background: `linear-gradient(145deg, ${brandColor2}25 0%, ${brandColor1}15 60%, transparent 100%)`,
          }}
        />
      </div>

      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white shadow-xl shadow-slate-200/50">
        {/* Gradient bar */}
        <div className={`h-2 w-full bg-gradient-to-r ${industryColor}`} />
        
        <div className="relative p-6">
          {/* Decorative elements */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-violet-100/40 to-purple-100/30 blur-2xl" />
          
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            {/* Company info */}
            <div className="flex items-start gap-4">
              {/* Logo/Avatar */}
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white bg-gradient-to-br from-violet-100 to-purple-100 shadow-lg shadow-violet-500/20">
                {company.logo_url ? (
                  <Image
                    src={company.logo_url}
                    alt={company.name}
                    fill
                    className="object-contain p-2"
                  />
                ) : (
                  <span className="text-3xl font-bold text-violet-600">
                    {company.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              
              <div className="space-y-2">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
                  {company.legal_name && (
                    <p className="text-sm text-slate-500">{company.legal_name}</p>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {company.industry && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r px-3 py-1 text-[11px] font-semibold text-white shadow-sm ${industryColor}`}>
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
                      </svg>
                      {company.industry}
                    </span>
                  )}
                  {location && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {location}
                    </span>
                  )}
                  {company.size && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      {company.size}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/companies"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                All Companies
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="group relative overflow-hidden rounded-xl border border-violet-200/50 bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-violet-200/30 blur-2xl transition-all group-hover:bg-violet-300/40" />
          <p className="text-[11px] font-medium text-violet-600 uppercase tracking-wide">Contacts</p>
          <p className="mt-1 text-2xl font-bold text-violet-700">{contacts.length}</p>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-emerald-200/30 blur-2xl transition-all group-hover:bg-emerald-300/40" />
          <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wide">Projects</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{projects.length}</p>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-sky-200/50 bg-gradient-to-br from-sky-50 to-cyan-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-sky-200/30 blur-2xl transition-all group-hover:bg-sky-300/40" />
          <p className="text-[11px] font-medium text-sky-600 uppercase tracking-wide">Active</p>
          <p className="mt-1 text-2xl font-bold text-sky-700">{activeProjects}</p>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-amber-200/30 blur-2xl transition-all group-hover:bg-amber-300/40" />
          <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wide">Total Value</p>
          <p className="mt-1 text-xl font-bold text-amber-700">{formatMoney(totalProjectsValue)}</p>
        </div>
      </div>

      {/* Contacts & Projects Section */}
      <section className="space-y-6">
        {/* Section Header with Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-sm backdrop-blur">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-[12px] font-medium transition-all ${
                activeTab === "contacts"
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              onClick={() => setActiveTab("contacts")}
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                Contacts ({contacts.length})
              </span>
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-[12px] font-medium transition-all ${
                activeTab === "projects"
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              onClick={() => setActiveTab("projects")}
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Projects ({projects.length})
              </span>
            </button>
          </div>
          
          <button
            type="button"
            onClick={() => activeTab === "contacts" ? setShowContactModal(true) : setShowProjectModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-2 text-[12px] font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add {activeTab === "contacts" ? "Contact" : "Project"}
          </button>
        </div>

        {/* Content Area */}
        {activeTab === "contacts" ? (
          <ContactsDisplay contacts={contacts} onEdit={setEditingContact} />
        ) : (
          <ProjectsDisplay projects={projects} contactsById={contactsById} />
        )}
      </section>

      {/* Company Details Section */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white via-white to-blue-50/30 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-blue-400/10 to-indigo-400/5" />
            <form onSubmit={handleDetailsSubmit} className="relative space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                    <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m-4 0h4"/></svg>
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Company Details</h2>
                    <p className="text-[11px] text-slate-500">Business information & contact</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingDetails ? (
                    <>
                      <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors" onClick={() => { setEditingDetails(false); setDetailsError(null); }} disabled={savingDetails}>Cancel</button>
                      <button type="submit" className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-60" disabled={savingDetails}>{savingDetails ? "Saving..." : "Save Changes"}</button>
                    </>
                  ) : (
                    <button type="button" className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors" onClick={() => { setEditingDetails(true); setDetailsError(null); }}>
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {!editingDetails ? (
                <>
                  <div className="grid gap-2 md:grid-cols-2">
                    <DetailField label="Website" value={company.website} isLink icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>} />
                    <DetailField label="Email" value={company.email} icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>} />
                    <DetailField label="Phone" value={company.phone} icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>} />
                    <DetailField label="Industry" value={company.industry} icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>} />
                    <DetailField label="Company Size" value={company.size} icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Address</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <DetailField label="Street" value={company.street_address} icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>} />
                      <DetailField label="City / Postal" value={[company.postal_code, company.town].filter(Boolean).join(" ") || null} icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} />
                      <DetailField label="Country" value={company.country} icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>} />
                    </div>
                  </div>
                  {company.notes && (
                    <div className="border-t border-slate-100 pt-3">
                      <DetailField label="Notes" value={company.notes} multiline icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label
                        htmlFor="website"
                        className="block text-[11px] font-medium text-slate-700"
                      >
                        Website
                      </label>
                      <input
                        id="website"
                        name="website"
                        type="url"
                        defaultValue={company.website ?? ""}
                        className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="email"
                        className="block text-[11px] font-medium text-slate-700"
                      >
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue={company.email ?? ""}
                        className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="phone"
                        className="block text-[11px] font-medium text-slate-700"
                      >
                        Phone
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        defaultValue={company.phone ?? ""}
                        className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="industry"
                        className="block text-[11px] font-medium text-slate-700"
                      >
                        Industry
                      </label>
                      <input
                        id="industry"
                        name="industry"
                        type="text"
                        defaultValue={company.industry ?? ""}
                        className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="size"
                        className="block text-[11px] font-medium text-slate-700"
                      >
                        Size
                      </label>
                      <input
                        id="size"
                        name="size"
                        type="text"
                        defaultValue={company.size ?? ""}
                        className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label
                        htmlFor="street_address"
                        className="block text-[11px] font-medium text-slate-700"
                      >
                        Street address
                      </label>
                      <input
                        id="street_address"
                        name="street_address"
                        type="text"
                        defaultValue={company.street_address ?? ""}
                        className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="postal_code"
                        className="block text-[11px] font-medium text-slate-700"
                      >
                        Postal code
                      </label>
                      <input
                        id="postal_code"
                        name="postal_code"
                        type="text"
                        defaultValue={company.postal_code ?? ""}
                        className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="town"
                        className="block text-[11px] font-medium text-slate-700"
                      >
                        City
                      </label>
                      <input
                        id="town"
                        name="town"
                        type="text"
                        defaultValue={company.town ?? ""}
                        className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="country"
                        className="block text-[11px] font-medium text-slate-700"
                      >
                        Country
                      </label>
                      <input
                        id="country"
                        name="country"
                        type="text"
                        defaultValue={company.country ?? ""}
                        className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="notes"
                      className="block text-[11px] font-medium text-slate-700"
                    >
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      rows={3}
                      defaultValue={company.notes ?? ""}
                      className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </>
              )}

              {detailsError ? (
                <p className="text-[11px] text-red-600">{detailsError}</p>
              ) : null}
            </form>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-purple-200/60 bg-gradient-to-br from-white via-white to-purple-50/30 p-5 shadow-[0_20px_50px_rgba(139,92,246,0.08)]">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-purple-400/10 to-pink-400/5" />
            <form onSubmit={handleSocialSubmit} className="relative space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/25">
                    <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Social Media</h2>
                    <p className="text-[11px] text-slate-500">Company social profiles</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingSocial ? (
                    <>
                      <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors" onClick={() => { setEditingSocial(false); setSocialError(null); }} disabled={savingSocial}>Cancel</button>
                      <button type="submit" className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-1.5 text-[11px] font-semibold text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all disabled:opacity-60" disabled={savingSocial}>{savingSocial ? "Saving..." : "Save Changes"}</button>
                    </>
                  ) : (
                    <button type="button" className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1.5 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 transition-colors" onClick={() => { setEditingSocial(true); setSocialError(null); }}>
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {!editingSocial ? (
                <div className="grid gap-2 md:grid-cols-2">
                  <SocialField label="Facebook" value={company.social_facebook} icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>} color="blue" />
                  <SocialField label="Instagram" value={company.social_instagram} icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>} color="pink" />
                  <SocialField label="Twitter / X" value={company.social_twitter} icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>} color="slate" />
                  <SocialField label="LinkedIn" value={company.social_linkedin} icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>} color="blue" />
                  <SocialField label="YouTube" value={company.social_youtube} icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>} color="red" />
                  <SocialField label="TikTok" value={company.social_tiktok} icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>} color="slate" />
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="social_facebook"
                      className="block text-[11px] font-medium text-slate-700"
                    >
                      Facebook URL
                    </label>
                    <input
                      id="social_facebook"
                      name="social_facebook"
                      type="url"
                      placeholder="https://facebook.com/..."
                      defaultValue={company.social_facebook ?? ""}
                      className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="social_instagram"
                      className="block text-[11px] font-medium text-slate-700"
                    >
                      Instagram URL
                    </label>
                    <input
                      id="social_instagram"
                      name="social_instagram"
                      type="url"
                      placeholder="https://instagram.com/..."
                      defaultValue={company.social_instagram ?? ""}
                      className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="social_twitter"
                      className="block text-[11px] font-medium text-slate-700"
                    >
                      Twitter / X URL
                    </label>
                    <input
                      id="social_twitter"
                      name="social_twitter"
                      type="url"
                      placeholder="https://twitter.com/..."
                      defaultValue={company.social_twitter ?? ""}
                      className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="social_linkedin"
                      className="block text-[11px] font-medium text-slate-700"
                    >
                      LinkedIn URL
                    </label>
                    <input
                      id="social_linkedin"
                      name="social_linkedin"
                      type="url"
                      placeholder="https://linkedin.com/..."
                      defaultValue={company.social_linkedin ?? ""}
                      className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="social_youtube"
                      className="block text-[11px] font-medium text-slate-700"
                    >
                      YouTube URL
                    </label>
                    <input
                      id="social_youtube"
                      name="social_youtube"
                      type="url"
                      placeholder="https://youtube.com/..."
                      defaultValue={company.social_youtube ?? ""}
                      className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="social_tiktok"
                      className="block text-[11px] font-medium text-slate-700"
                    >
                      TikTok URL
                    </label>
                    <input
                      id="social_tiktok"
                      name="social_tiktok"
                      type="url"
                      placeholder="https://tiktok.com/..."
                      defaultValue={company.social_tiktok ?? ""}
                      className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>
              )}

              {socialError ? (
                <p className="text-[11px] text-red-600">{socialError}</p>
              ) : null}
            </form>
          </div>
        </div>

        <div className="space-y-4">
          {/* Company Logo Card */}
          <LogoUploadCard
            companyId={company.id}
            logoUrl={company.logo_url}
            companyName={company.name}
            onLogoUpdated={(url) => setCompany((prev) => prev ? { ...prev, logo_url: url } : prev)}
          />
        </div>
      </section>

      {/* Add Contact Modal */}
      {showContactModal && (
        <AddContactModal
          companyId={company.id}
          onClose={() => setShowContactModal(false)}
          onCreated={(contact) => {
            handleContactCreated(contact);
            setShowContactModal(false);
          }}
        />
      )}

      {/* Add Project Modal */}
      {showProjectModal && (
        <AddProjectModal
          companyId={company.id}
          contacts={contacts}
          onClose={() => setShowProjectModal(false)}
          onCreated={(project) => {
            handleProjectCreated(project);
            setShowProjectModal(false);
          }}
        />
      )}

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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black focus:border-violet-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editingContact.last_name}
                    onChange={(e) => setEditingContact({ ...editingContact, last_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black focus:border-violet-400 focus:outline-none"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                <input
                  type="text"
                  value={editingContact.job_title || ""}
                  onChange={(e) => setEditingContact({ ...editingContact, job_title: e.target.value || null })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black focus:border-violet-400 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editingContact.email || ""}
                  onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value || null })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black focus:border-violet-400 focus:outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
                  <input
                    type="tel"
                    value={editingContact.mobile || ""}
                    onChange={(e) => setEditingContact({ ...editingContact, mobile: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black focus:border-violet-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editingContact.phone || ""}
                    onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black focus:border-violet-400 focus:outline-none"
                  />
                </div>
              </div>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingContact.is_primary}
                  onChange={(e) => setEditingContact({ ...editingContact, is_primary: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
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
                disabled={savingContact}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-purple-500 rounded-lg hover:shadow-lg disabled:opacity-50"
              >
                {savingContact ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({
  label,
  value,
  isLink,
  multiline,
  icon,
}: {
  label: string;
  value: string | null;
  isLink?: boolean;
  multiline?: boolean;
  icon?: React.ReactNode;
}) {
  const display = value && value.trim().length > 0 ? value : "—";
  const isEmpty = !value || value.trim().length === 0;

  return (
    <div className="group flex items-start gap-3 rounded-xl bg-slate-50/50 p-3 transition-all hover:bg-slate-100/50">
      {icon && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm border border-slate-100 text-slate-400 group-hover:text-slate-600 transition-colors">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        {isLink && value ? (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            {display}
          </a>
        ) : (
          <p className={`text-sm font-medium ${isEmpty ? "text-slate-300" : "text-slate-800"} ${multiline ? "whitespace-pre-wrap" : "truncate"}`}>
            {display}
          </p>
        )}
      </div>
    </div>
  );
}

// Social Media Field Component
function SocialField({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | null;
  icon: React.ReactNode;
  color: "blue" | "pink" | "red" | "slate";
}) {
  const isEmpty = !value || value.trim().length === 0;
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    pink: "bg-pink-50 text-pink-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className={`group flex items-center gap-3 rounded-xl p-3 transition-all ${isEmpty ? "bg-slate-50/30" : "bg-white shadow-sm border border-slate-100 hover:shadow-md"}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isEmpty ? "bg-slate-100 text-slate-300" : colorClasses[color]}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        {value ? (
          <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium text-slate-300">Not set</p>
        )}
      </div>
      {value && (
        <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="h-4 w-4 text-slate-400 hover:text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
        </a>
      )}
    </div>
  );
}

// Beautiful Contacts Display Component
function ContactsDisplay({ contacts, onEdit }: { contacts: Contact[]; onEdit: (contact: Contact) => void }) {
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100">
          <svg className="h-8 w-8 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <p className="mt-4 text-[14px] font-medium text-slate-700">No contacts yet</p>
        <p className="mt-1 text-[12px] text-slate-500">Add your first contact to get started</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {contacts.map((contact) => {
        const name = formatFullName(contact.first_name, contact.last_name) || "Unnamed";
        const initials = `${(contact.first_name || "?").charAt(0)}${(contact.last_name || "").charAt(0)}`.toUpperCase();
        
        return (
          <div
            key={contact.id}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white p-5 shadow-lg shadow-slate-200/30 transition-all hover:shadow-xl hover:shadow-violet-200/30"
          >
            {/* Primary badge */}
            {contact.is_primary && (
              <div className="absolute right-3 top-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
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
              onClick={() => onEdit(contact)}
              className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
              style={{ top: contact.is_primary ? "2.5rem" : "0.75rem" }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            
            {/* Avatar */}
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-lg font-bold text-white shadow-lg shadow-violet-500/25">
              {initials}
            </div>
            
            {/* Info */}
            <div className="mt-4">
              <h3 className="text-[14px] font-semibold text-slate-900">{name}</h3>
              {contact.job_title && (
                <p className="mt-0.5 text-[12px] text-slate-500">{contact.job_title}</p>
              )}
            </div>
            
            {/* Contact details */}
            <div className="mt-4 space-y-2">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-[12px] text-slate-600 hover:text-violet-600 transition-colors">
                  <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span className="truncate">{contact.email}</span>
                </a>
              )}
              {contact.mobile && (
                <a href={`tel:${contact.mobile}`} className="flex items-center gap-2 text-[12px] text-slate-600 hover:text-violet-600 transition-colors">
                  <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <path d="M12 18h.01" />
                  </svg>
                  {contact.mobile}
                </a>
              )}
              {contact.phone && !contact.mobile && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-[12px] text-slate-600 hover:text-violet-600 transition-colors">
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
  );
}

// Status colors for project badges
const STATUS_COLORS: Record<string, string> = {
  "New Lead": "from-sky-500 to-cyan-500",
  "Processed": "from-slate-500 to-gray-500",
  "Discovery": "from-indigo-500 to-blue-500",
  "Proposal": "from-violet-500 to-purple-500",
  "Quotation": "from-amber-500 to-orange-500",
  "Invoice": "from-emerald-500 to-teal-500",
  "Project Started": "from-lime-500 to-green-500",
  "Project Delivered": "from-emerald-500 to-green-500",
  "Closed": "from-slate-600 to-gray-600",
  "Abandoned": "from-red-500 to-rose-500",
};

// Beautiful Projects Display Component
function ProjectsDisplay({ projects, contactsById }: { projects: Project[]; contactsById: Map<string, Contact> }) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100">
          <svg className="h-8 w-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <path d="M12 11v6M9 14h6" />
          </svg>
        </div>
        <p className="mt-4 text-[14px] font-medium text-slate-700">No projects yet</p>
        <p className="mt-1 text-[12px] text-slate-500">Add your first project to get started</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => {
        const primaryContact = project.primary_contact_id
          ? contactsById.get(project.primary_contact_id) || null
          : null;
        const statusColor = STATUS_COLORS[project.status || ""] || "from-slate-500 to-gray-500";
        
        return (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white shadow-lg shadow-slate-200/30 transition-all hover:shadow-xl hover:shadow-emerald-200/30"
          >
            {/* Gradient bar */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${statusColor}`} />
            
            <div className="p-5">
              {/* Status badge */}
              {project.status && (
                <span className={`inline-flex rounded-full bg-gradient-to-r px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm ${statusColor}`}>
                  {project.status}
                </span>
              )}
              
              {/* Project name */}
              <h3 className="mt-3 text-[15px] font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                {project.name}
              </h3>
              
              {/* Description preview */}
              {project.description && (
                <p className="mt-1.5 text-[12px] text-slate-500 line-clamp-2">{project.description}</p>
              )}
              
              {/* Value */}
              {project.value != null && project.value > 0 && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-[18px] font-bold text-emerald-600">{formatMoney(project.value)}</span>
                </div>
              )}
              
              {/* Meta info */}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                {primaryContact && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {formatFullName(primaryContact.first_name, primaryContact.last_name)}
                  </span>
                )}
                {project.due_date && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    Due {formatDate(project.due_date)}
                  </span>
                )}
              </div>
              
              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[10px] text-slate-400">Created {formatDate(project.created_at)}</p>
                <svg className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function LogoUploadCard({
  companyId,
  logoUrl,
  companyName,
  onLogoUpdated,
}: {
  companyId: string;
  logoUrl: string | null;
  companyName: string;
  onLogoUpdated: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file.");
        return;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError("Image must be smaller than 2MB.");
        return;
      }

      setUploading(true);
      setError(null);

      try {
        // Upload to Supabase storage
        const fileExt = file.name.split(".").pop();
        const fileName = `${companyId}-${Date.now()}.${fileExt}`;
        const filePath = `company-logos/${fileName}`;

        const { error: uploadError } = await supabaseClient.storage
          .from("uploads")
          .upload(filePath, file, { upsert: true });

        if (uploadError) {
          setError(uploadError.message);
          setUploading(false);
          return;
        }

        // Get public URL
        const { data: urlData } = supabaseClient.storage
          .from("uploads")
          .getPublicUrl(filePath);

        const publicUrl = urlData?.publicUrl || null;

        // Update company record
        const { error: updateError } = await supabaseClient
          .from("companies")
          .update({ logo_url: publicUrl })
          .eq("id", companyId);

        if (updateError) {
          setError(updateError.message);
          setUploading(false);
          return;
        }

        onLogoUpdated(publicUrl);
        setUploading(false);
      } catch {
        setError("Failed to upload logo.");
        setUploading(false);
      }
    },
    [companyId, onLogoUpdated]
  );

  const handleRemoveLogo = useCallback(async () => {
    setUploading(true);
    setError(null);

    try {
      const { error: updateError } = await supabaseClient
        .from("companies")
        .update({ logo_url: null })
        .eq("id", companyId);

      if (updateError) {
        setError(updateError.message);
        setUploading(false);
        return;
      }

      onLogoUpdated(null);
      setUploading(false);
    } catch {
      setError("Failed to remove logo.");
      setUploading(false);
    }
  }, [companyId, onLogoUpdated]);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Company Logo</h2>
          <p className="text-[11px] text-slate-500">
            Upload a logo for this company.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Logo preview */}
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`${companyName} logo`}
              fill
              className="object-contain p-2"
            />
          ) : (
            <svg
              className="h-8 w-8 text-slate-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          )}
        </div>

        {/* Upload controls */}
        <div className="flex-1 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? "Uploading..." : logoUrl ? "Change Logo" : "Upload Logo"}
            </button>
            {logoUrl && !uploading ? (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-medium text-red-700 shadow-sm hover:bg-red-100"
              >
                Remove
              </button>
            ) : null}
          </div>
          <p className="text-[10px] text-slate-400">
            PNG, JPG, or SVG. Max 2MB.
          </p>
          {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

// Add Contact Modal Component
function AddContactModal({
  companyId,
  onClose,
  onCreated,
}: {
  companyId: string;
  onClose: () => void;
  onCreated: (contact: Contact) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const firstName = (formData.get("first_name") as string | null)?.trim();
    const lastName = (formData.get("last_name") as string | null)?.trim();
    const email = (formData.get("email") as string | null)?.trim();
    const phone = (formData.get("phone") as string | null)?.trim();
    const mobile = (formData.get("mobile") as string | null)?.trim();
    const jobTitle = (formData.get("job_title") as string | null)?.trim();
    const isPrimary = (formData.get("is_primary") as string | null) === "on";

    if (!firstName || !lastName) {
      setError("First and last name are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabaseClient
        .from("contacts")
        .insert({
          company_id: companyId,
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: phone || null,
          mobile: mobile || null,
          job_title: jobTitle || null,
          is_primary: isPrimary,
        })
        .select(
          "id, company_id, first_name, last_name, email, phone, mobile, job_title, is_primary, created_at",
        )
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? "Failed to create contact.");
        setLoading(false);
        return;
      }

      onCreated(data as Contact);
    } catch {
      setError("Failed to create contact.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 to-purple-500" />
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M20 8v6M23 11h-6" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Add Contact</h2>
              <p className="text-[12px] text-slate-500">Add a new contact to this company</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="first_name" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                First Name *
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                required
                placeholder="John"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="last_name" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                Last Name *
              </label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                required
                placeholder="Doe"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="john@company.com"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mobile" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                Mobile
              </label>
              <input
                id="mobile"
                name="mobile"
                type="tel"
                placeholder="+971 50 123 4567"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 items-end">
            <div className="space-y-1.5">
              <label htmlFor="job_title" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                Job Title
              </label>
              <input
                id="job_title"
                name="job_title"
                type="text"
                placeholder="e.g. Tech Director"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 cursor-pointer hover:bg-violet-50 transition-colors">
              <input
                type="checkbox"
                name="is_primary"
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm text-slate-700">Primary Contact</span>
            </label>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              {error}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-6 py-2.5 text-[13px] font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Adding...
                </>
              ) : (
                "Add Contact"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Project Modal Component  
function AddProjectModal({
  companyId,
  contacts,
  onClose,
  onCreated,
}: {
  companyId: string;
  contacts: Contact[];
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const name = (formData.get("name") as string | null)?.trim();
    const description = (formData.get("description") as string | null)?.trim();
    const status = (formData.get("status") as string | null)?.trim();
    const pipeline = (formData.get("pipeline") as string | null)?.trim();
    const projectType = (formData.get("project_type") as string | null)?.trim();
    const processedOutcome = (formData.get("processed_outcome") as string | null)?.trim();
    const valueRaw = (formData.get("value") as string | null)?.trim();
    const startDate = (formData.get("start_date") as string | null)?.trim();
    const dueDate = (formData.get("due_date") as string | null)?.trim();
    const primaryContactId = (formData.get("primary_contact_id") as string | null)?.trim() || null;

    if (!name) {
      setError("Project name is required.");
      return;
    }

    if (!projectType) {
      setError("Project type is required.");
      return;
    }

    let value: number | null = null;
    if (valueRaw) {
      const parsed = Number(valueRaw.replace(/,/g, ""));
      if (!Number.isNaN(parsed) && parsed >= 0) {
        value = parsed;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabaseClient
        .from("projects")
        .insert({
          company_id: companyId,
          primary_contact_id: primaryContactId,
          name,
          description: description || null,
          status: status || null,
          processed_outcome: status === "Processed" ? processedOutcome || null : null,
          pipeline: pipeline || null,
          project_type: projectType,
          value,
          start_date: startDate || null,
          due_date: dueDate || null,
        })
        .select(
          "id, company_id, primary_contact_id, name, description, status, processed_outcome, pipeline, value, start_date, due_date, created_at",
        )
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? "Failed to create project.");
        setLoading(false);
        return;
      }

      onCreated(data as Project);
    } catch {
      setError("Failed to create project.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
        {/* Gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500 shrink-0" />
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <path d="M12 11v6M9 14h6" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Add Project</h2>
              <p className="text-[12px] text-slate-500">Create a new project for this company</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
              Project Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. Website Redesign"
              className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Project Type Selection */}
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
              Project Type *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "social_media", label: "Social Media", color: "from-pink-500 to-fuchsia-500", icon: "📱" },
                { value: "website", label: "Website", color: "from-blue-500 to-cyan-500", icon: "🌐" },
                { value: "branding", label: "Branding", color: "from-purple-500 to-violet-500", icon: "🎨" },
              ].map((type) => (
                <label
                  key={type.value}
                  className="relative cursor-pointer"
                >
                  <input
                    type="radio"
                    name="project_type"
                    value={type.value}
                    className="peer sr-only"
                    required
                  />
                  <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-slate-200 bg-white p-3 transition-all peer-checked:border-emerald-500 peer-checked:bg-emerald-50/50 peer-checked:shadow-lg peer-checked:shadow-emerald-500/10 hover:border-slate-300 hover:bg-slate-50">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${type.color} text-white text-base shadow-lg`}>
                      {type.icon}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700">{type.label}</span>
                  </div>
                  <div className="absolute -top-1 -right-1 hidden h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white peer-checked:flex">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                </label>
              ))}
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label htmlFor="description" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Brief description of the project..."
              className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="status" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Select status</option>
                <option value="New Lead">New Lead</option>
                <option value="Processed">Processed</option>
                <option value="Discovery">Discovery</option>
                <option value="Proposal">Proposal</option>
                <option value="Quotation">Quotation</option>
                <option value="Invoice">Invoice</option>
                <option value="Project Started">Project Started</option>
                <option value="Project Delivered">Project Delivered</option>
                <option value="Closed">Closed</option>
                <option value="Abandoned">Abandoned</option>
              </select>
            </div>
            
            {statusValue === "Processed" && (
              <div className="space-y-1.5">
                <label htmlFor="processed_outcome" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                  Processed Outcome
                </label>
                <select
                  id="processed_outcome"
                  name="processed_outcome"
                  className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">Select outcome</option>
                  <option value="Valid">Valid</option>
                  <option value="Invalid">Invalid</option>
                </select>
              </div>
            )}
            
            <div className="space-y-1.5">
              <label htmlFor="value" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                Value (AED)
              </label>
              <input
                id="value"
                name="value"
                type="number"
                min={0}
                step={100}
                placeholder="0"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="start_date" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                Start Date
              </label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="due_date" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                Due Date
              </label>
              <input
                id="due_date"
                name="due_date"
                type="date"
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label htmlFor="primary_contact_id" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
              Primary Contact
            </label>
            <select
              id="primary_contact_id"
              name="primary_contact_id"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              defaultValue=""
            >
              <option value="">None</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {formatFullName(contact.first_name, contact.last_name) || "Contact"}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              {error}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-[13px] font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
