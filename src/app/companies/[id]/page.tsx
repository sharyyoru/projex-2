"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  "id, name, legal_name, website, email, phone, industry, size, street_address, postal_code, town, country, notes, social_facebook, social_instagram, social_twitter, social_linkedin, social_youtube, social_tiktok";

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

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{company.name}</h1>
            {company.legal_name ? (
              <p className="text-xs text-slate-500">{company.legal_name}</p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              {company.industry || "Industry not set"}
              {location ? ` • ${location}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-1 py-0.5 text-[11px] text-slate-600 shadow-sm">
              <button
                type="button"
                className={
                  "rounded-full px-2 py-0.5 " +
                  (activeTab === "contacts"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900")
                }
                onClick={() => setActiveTab("contacts")}
              >
                Contacts
              </button>
              <button
                type="button"
                className={
                  "rounded-full px-2 py-0.5 " +
                  (activeTab === "projects"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900")
                }
                onClick={() => setActiveTab("projects")}
              >
                Projects
              </button>
            </div>
            <Link
              href="/companies"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                <svg
                  className="h-3.5 w-3.5 text-slate-600"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h4v12H3zM10 10h4v8h-4zM17 8h4v10h-4z" />
                </svg>
              </span>
              <span>All companies</span>
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -top-6 right-0 h-40 w-40 overflow-hidden">
          <div className="crm-glow h-full w-full" />
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
            <form onSubmit={handleDetailsSubmit} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Company details</h2>
                <div className="flex items-center gap-2">
                  {editingDetails ? (
                    <>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                        onClick={() => {
                          setEditingDetails(false);
                          setDetailsError(null);
                        }}
                        disabled={savingDetails}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-full border border-sky-200/80 bg-sky-600 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={savingDetails}
                      >
                        {savingDetails ? "Saving..." : "Save"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                      onClick={() => {
                        setEditingDetails(true);
                        setDetailsError(null);
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {!editingDetails ? (
                <>
                  <div className="mt-1 grid gap-3 md:grid-cols-2">
                    <DetailField label="Website" value={company.website} isLink />
                    <DetailField label="Email" value={company.email} />
                    <DetailField label="Phone" value={company.phone} />
                    <DetailField label="Industry" value={company.industry} />
                    <DetailField label="Size" value={company.size} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <DetailField label="Street address" value={company.street_address} />
                    <DetailField
                      label="City / Postal code"
                      value={
                        [company.postal_code, company.town]
                          .filter(Boolean)
                          .join(" ") || null
                      }
                    />
                    <DetailField label="Country" value={company.country} />
                  </div>
                  <div className="mt-4">
                    <DetailField label="Notes" value={company.notes} multiline />
                  </div>
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

          <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
            <form onSubmit={handleSocialSubmit} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Social media</h2>
                  <p className="text-[11px] text-slate-500">
                    Links to this company's profiles.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {editingSocial ? (
                    <>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                        onClick={() => {
                          setEditingSocial(false);
                          setSocialError(null);
                        }}
                        disabled={savingSocial}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-full border border-sky-200/80 bg-sky-600 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={savingSocial}
                      >
                        {savingSocial ? "Saving..." : "Save"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                      onClick={() => {
                        setEditingSocial(true);
                        setSocialError(null);
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {!editingSocial ? (
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <DetailField label="Facebook" value={company.social_facebook} isLink />
                  <DetailField label="Instagram" value={company.social_instagram} isLink />
                  <DetailField label="Twitter / X" value={company.social_twitter} isLink />
                  <DetailField label="LinkedIn" value={company.social_linkedin} isLink />
                  <DetailField label="YouTube" value={company.social_youtube} isLink />
                  <DetailField label="TikTok" value={company.social_tiktok} isLink />
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
          {activeTab === "contacts" ? (
            <ContactsPanel
              companyId={company.id}
              contacts={contacts}
              onCreated={handleContactCreated}
            />
          ) : (
            <ProjectsPanel
              companyId={company.id}
              projects={projects}
              contactsById={contactsById}
              onCreated={handleProjectCreated}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function DetailField({
  label,
  value,
  isLink,
  multiline,
}: {
  label: string;
  value: string | null;
  isLink?: boolean;
  multiline?: boolean;
}) {
  const display = value && value.trim().length > 0 ? value : "—";

  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      {isLink && value ? (
        <a
          href={value.startsWith("http") ? value : `https://${value}`}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-xs text-sky-700 hover:text-sky-800 hover:underline"
        >
          {display}
        </a>
      ) : (
        <p
          className={
            "text-xs text-slate-800 " + (multiline ? "whitespace-pre-wrap" : "truncate")
          }
        >
          {display}
        </p>
      )}
    </div>
  );
}

function ContactsPanel({
  companyId,
  contacts,
  onCreated,
}: {
  companyId: string;
  contacts: Contact[];
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
      form.reset();
      setLoading(false);
    } catch {
      setError("Failed to create contact.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Contacts</h2>
            <p className="text-[11px] text-slate-500">
              People associated with this company.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="first_name"
              className="block text-[11px] font-medium text-slate-700"
            >
              First name
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              required
              className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="last_name"
              className="block text-[11px] font-medium text-slate-700"
            >
              Last name
            </label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              required
              className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
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
              className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="mobile"
              className="block text-[11px] font-medium text-slate-700"
            >
              Mobile
            </label>
            <input
              id="mobile"
              name="mobile"
              type="tel"
              className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-center">
          <div className="space-y-1">
            <label
              htmlFor="job_title"
              className="block text-[11px] font-medium text-slate-700"
            >
              Job title
            </label>
            <input
              id="job_title"
              name="job_title"
              type="text"
              placeholder="e.g. Practice Manager"
              className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <label className="flex items-center gap-2 text-[11px] text-slate-700">
            <input
              type="checkbox"
              name="is_primary"
              className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            Primary contact
          </label>
        </div>

        {error ? <p className="text-[11px] text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Saving..." : "Add contact"}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">All contacts</h3>
        {contacts.length === 0 ? (
          <p className="text-[11px] text-slate-500">No contacts yet.</p>
        ) : (
          <div className="space-y-1.5">
            {contacts.map((contact) => {
              const name = formatFullName(contact.first_name, contact.last_name) ||
                "Unnamed contact";

              return (
                <div
                  key={contact.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-medium text-slate-900">
                      {name}
                      {contact.is_primary ? (
                        <span className="ml-2 inline-flex rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                          Primary
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {[contact.job_title, contact.email]
                        .filter(Boolean)
                        .join(" • ") || "—"}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {formatDate(contact.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectsPanel({
  companyId,
  projects,
  contactsById,
  onCreated,
}: {
  companyId: string;
  projects: Project[];
  contactsById: Map<string, Contact>;
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
    const processedOutcome =
      (formData.get("processed_outcome") as string | null)?.trim();
    const valueRaw = (formData.get("value") as string | null)?.trim();
    const startDate = (formData.get("start_date") as string | null)?.trim();
    const dueDate = (formData.get("due_date") as string | null)?.trim();
    const primaryContactId = (formData.get("primary_contact_id") as string | null)?.trim() || null;

    if (!name) {
      setError("Project name is required.");
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
          processed_outcome:
            status === "Processed" ? processedOutcome || null : null,
          pipeline: pipeline || null,
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
      form.reset();
      setStatusValue("");
      setLoading(false);
    } catch {
      setError("Failed to create project.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Projects</h2>
            <p className="text-[11px] text-slate-500">
              Track engagements, deals, or initiatives with this company.
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="name"
            className="block text-[11px] font-medium text-slate-700"
          >
            Project name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="description"
            className="block text-[11px] font-medium text-slate-700"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="status"
              className="block text-[11px] font-medium text-slate-700"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              value={statusValue}
              onChange={(event) => setStatusValue(event.target.value)}
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
            {statusValue === "Processed" ? (
              <div className="mt-2 space-y-1">
                <label
                  htmlFor="processed_outcome"
                  className="block text-[11px] font-medium text-slate-700"
                >
                  Processed outcome
                </label>
                <select
                  id="processed_outcome"
                  name="processed_outcome"
                  className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  defaultValue=""
                >
                  <option value="">Select outcome</option>
                  <option value="Valid">Valid</option>
                  <option value="Invalid">Invalid</option>
                </select>
              </div>
            ) : null}
          </div>
          <div className="space-y-1">
            <label
              htmlFor="pipeline"
              className="block text-[11px] font-medium text-slate-700"
            >
              Pipeline
            </label>
            <input
              id="pipeline"
              name="pipeline"
              type="text"
              placeholder="e.g. Geneva, Dubai"
              className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label
              htmlFor="value"
              className="block text-[11px] font-medium text-slate-700"
            >
              Value (approx.)
            </label>
            <input
              id="value"
              name="value"
              type="number"
              min={0}
              step={100}
              className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="start_date"
              className="block text-[11px] font-medium text-slate-700"
            >
              Start date
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="due_date"
              className="block text-[11px] font-medium text-slate-700"
            >
              Target date
            </label>
            <input
              id="due_date"
              name="due_date"
              type="date"
              className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="primary_contact_id"
            className="block text-[11px] font-medium text-slate-700"
          >
            Primary contact
          </label>
          <select
            id="primary_contact_id"
            name="primary_contact_id"
            className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            defaultValue=""
          >
            <option value="">None</option>
            {Array.from(contactsById.values()).map((contact) => (
              <option key={contact.id} value={contact.id}>
                {formatFullName(contact.first_name, contact.last_name) || "Contact"}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="text-[11px] text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Saving..." : "Add project"}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">All projects</h3>
        {projects.length === 0 ? (
          <p className="text-[11px] text-slate-500">No projects yet.</p>
        ) : (
          <div className="space-y-1.5">
            {projects.map((project) => {
              const primaryContact = project.primary_contact_id
                ? contactsById.get(project.primary_contact_id) || null
                : null;

              return (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-slate-900">
                      <Link
                        href={`/projects/${project.id}`}
                        className="hover:underline"
                      >
                        {project.name}
                      </Link>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {[project.status, primaryContact && formatFullName(primaryContact.first_name, primaryContact.last_name)]
                        .filter(Boolean)
                        .join(" • ") || "—" }
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <p>{formatMoney(project.value)}</p>
                    <p>{formatDate(project.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
