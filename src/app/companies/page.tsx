"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";

type CompanyRow = {
  id: string;
  name: string;
  legal_name: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  size: string | null;
  town: string | null;
  country: string | null;
  created_at: string | null;
};

function formatShortDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

// Industry badge colors
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

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [industryFilter, setIndustryFilter] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: loadError } = await supabaseClient
          .from("companies")
          .select(
            "id, name, legal_name, website, email, phone, industry, size, town, country, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(100);

        if (!isMounted) return;

        if (loadError || !data) {
          setError(loadError?.message ?? "Failed to load companies.");
          setCompanies([]);
        } else {
          setCompanies(data as CompanyRow[]);
        }
      } catch {
        if (!isMounted) return;
        setError("Failed to load companies.");
        setCompanies([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCompanies = useMemo(() => {
    let result = companies;
    
    // Industry filter
    if (industryFilter) {
      result = result.filter((c) => c.industry === industryFilter);
    }
    
    // Search filter
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter((company) => {
        const hay = [
          company.name,
          company.legal_name,
          company.email,
          company.website,
          company.industry,
          company.town,
          company.country,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return hay.includes(term);
      });
    }
    
    return result;
  }, [companies, search, industryFilter]);

  const uniqueIndustries = [...new Set(companies.map((c) => c.industry).filter(Boolean))];

  function handleCreated(company: CompanyRow) {
    setCompanies((prev) => [company, ...prev]);
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      {/* Header with gradient accent */}
      <div className="relative">
        <div className="pointer-events-none absolute -top-10 right-0 h-[300px] w-[400px] overflow-hidden opacity-50">
          <div className="absolute top-0 right-0 h-[250px] w-[350px] rounded-full bg-gradient-to-br from-violet-200/60 to-purple-200/40 blur-3xl" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/30">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18" />
                  <path d="M5 21V7l8-4v18" />
                  <path d="M19 21V11l-6-4" />
                  <path d="M9 9v.01" />
                  <path d="M9 12v.01" />
                  <path d="M9 15v.01" />
                  <path d="M9 18v.01" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Companies</h1>
                <p className="text-[13px] text-slate-500">
                  {companies.length} organizations in your network
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium shadow-lg transition-all ${
              showForm
                ? "bg-slate-100 text-slate-700 shadow-slate-200/50 hover:bg-slate-200"
                : "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30"
            }`}
          >
            {showForm ? (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                New Company
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="group relative overflow-hidden rounded-xl border border-violet-200/50 bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-violet-200/30 blur-2xl transition-all group-hover:bg-violet-300/40" />
          <p className="text-[11px] font-medium text-violet-600 uppercase tracking-wide">Total Companies</p>
          <p className="mt-1 text-2xl font-bold text-violet-700">{companies.length}</p>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-sky-200/50 bg-gradient-to-br from-sky-50 to-cyan-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-sky-200/30 blur-2xl transition-all group-hover:bg-sky-300/40" />
          <p className="text-[11px] font-medium text-sky-600 uppercase tracking-wide">Industries</p>
          <p className="mt-1 text-2xl font-bold text-sky-700">{uniqueIndustries.length}</p>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-emerald-200/30 blur-2xl transition-all group-hover:bg-emerald-300/40" />
          <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wide">This Month</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {companies.filter((c) => {
              if (!c.created_at) return false;
              const created = new Date(c.created_at);
              const now = new Date();
              return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
            }).length}
          </p>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-amber-200/30 blur-2xl transition-all group-hover:bg-amber-300/40" />
          <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wide">Locations</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">
            {new Set(companies.map((c) => c.country).filter(Boolean)).size}
          </p>
        </div>
      </div>

      {/* New Company Form (Collapsible) */}
      {showForm && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          <NewCompanyForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies, industries, locations..."
            className="h-9 w-64 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-black placeholder:text-slate-400 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-slate-500">Industry</span>
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-black shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          >
            <option value="">All Industries</option>
            {uniqueIndustries.map((industry) => (
              <option key={industry} value={industry!}>
                {industry}
              </option>
            ))}
          </select>
        </div>
        {(search || industryFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setIndustryFilter("");
            }}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
            Clear
          </button>
        )}
        <div className="ml-auto text-[12px] text-slate-500">
          Showing {filteredCompanies.length} of {companies.length}
        </div>
      </div>

      {/* Companies Grid */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-500" />
            <p className="text-[13px] text-slate-500">Loading companies...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {error}
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-white/60 p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100">
            <svg className="h-8 w-8 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" />
              <path d="M5 21V7l8-4v18" />
              <path d="M19 21V11l-6-4" />
            </svg>
          </div>
          <p className="mt-4 text-[15px] font-medium text-slate-700">No companies found</p>
          <p className="mt-1 text-[13px] text-slate-500">
            {search || industryFilter ? "Try adjusting your filters" : "Create your first company to get started"}
          </p>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-2 text-[13px] font-medium text-white shadow-lg shadow-violet-500/25"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              Add Company
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCompanies.map((company) => {
            const location = [company.town, company.country].filter(Boolean).join(", ");
            const industryColor = INDUSTRY_COLORS[company.industry || ""] || "from-slate-400 to-slate-500";

            return (
              <Link
                key={company.id}
                href={`/companies/${company.id}`}
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-lg hover:shadow-violet-100/50 hover:border-violet-200"
              >
                {/* Industry gradient bar */}
                <div className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${industryColor}`} />
                
                <div className="flex items-start gap-3">
                  {/* Company avatar */}
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 text-violet-600 font-bold text-lg">
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate group-hover:text-violet-600 transition-colors">
                      {company.name}
                    </h3>
                    {company.legal_name && (
                      <p className="text-[11px] text-slate-400 truncate">{company.legal_name}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {company.industry && (
                    <span className={`inline-flex rounded-full bg-gradient-to-r px-2 py-0.5 text-[10px] font-semibold text-white ${industryColor}`}>
                      {company.industry}
                    </span>
                  )}
                  {location && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {location}
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <span className="text-slate-400">Email</span>
                    <p className="font-medium text-slate-700 truncate">{company.email || "—"}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <span className="text-slate-400">Phone</span>
                    <p className="font-medium text-slate-700 truncate">{company.phone || "—"}</p>
                  </div>
                </div>

                {company.website && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-violet-600">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M2 12h20" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    <span className="truncate">{company.website.replace(/^https?:\/\//, "")}</span>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="text-[10px] text-slate-400">Added {formatShortDate(company.created_at)}</span>
                  <span className="text-[10px] font-medium text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    View details →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewCompanyForm({
  onCreated,
  onCancel,
}: {
  onCreated: (company: CompanyRow) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const name = (formData.get("name") as string | null)?.trim();
    const legalName = (formData.get("legal_name") as string | null)?.trim();
    const website = (formData.get("website") as string | null)?.trim();
    const email = (formData.get("email") as string | null)?.trim();
    const phone = (formData.get("phone") as string | null)?.trim();
    const industry = (formData.get("industry") as string | null)?.trim();
    const size = (formData.get("size") as string | null)?.trim();
    const town = (formData.get("town") as string | null)?.trim();
    const country = (formData.get("country") as string | null)?.trim();
    const streetAddress = (formData.get("street_address") as string | null)?.trim();
    const postalCode = (formData.get("postal_code") as string | null)?.trim();
    const notes = (formData.get("notes") as string | null)?.trim();

    if (!name) {
      setError("Company name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: authData } = await supabaseClient.auth.getUser();
      const user = authData?.user ?? null;

      let createdByUserId: string | null = null;
      let createdBy: string | null = null;

      if (user) {
        const meta = (user.user_metadata || {}) as Record<string, unknown>;
        const first = (meta["first_name"] as string) || "";
        const last = (meta["last_name"] as string) || "";
        const full = [first, last].filter(Boolean).join(" ").trim();
        createdByUserId = user.id;
        createdBy = full || user.email || null;
      }

      const { data, error: insertError } = await supabaseClient
        .from("companies")
        .insert({
          name,
          legal_name: legalName || null,
          website: website || null,
          email: email || null,
          phone: phone || null,
          industry: industry || null,
          size: size || null,
          town: town || null,
          country: country || null,
          street_address: streetAddress || null,
          postal_code: postalCode || null,
          notes: notes || null,
          created_by_user_id: createdByUserId,
          created_by: createdBy,
        })
        .select(
          "id, name, legal_name, website, email, phone, industry, size, town, country, created_at",
        )
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? "Failed to create company.");
        setLoading(false);
        return;
      }

      onCreated(data as CompanyRow);
      form.reset();
      setLoading(false);
    } catch {
      setError("Failed to create company.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative overflow-hidden rounded-2xl border border-violet-200/50 bg-white p-6 shadow-xl shadow-violet-500/10"
    >
      {/* Decorative gradient */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-violet-200/40 to-purple-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-gradient-to-br from-pink-200/30 to-rose-200/20 blur-2xl" />
      
      <div className="relative space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/30">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" />
              <path d="M5 21V7l8-4v18" />
              <path d="M19 21V11l-6-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add New Company</h2>
            <p className="text-[13px] text-slate-500">
              Create a new organization in your network
            </p>
          </div>
        </div>

        {/* Form Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <label htmlFor="name" className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Company Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Enter company name"
              className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="legal_name" className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Legal Name
            </label>
            <input
              id="legal_name"
              name="legal_name"
              type="text"
              placeholder="Official registered name"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="industry" className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Industry
            </label>
            <select
              id="industry"
              name="industry"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="">Select industry</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Finance">Finance</option>
              <option value="Technology">Technology</option>
              <option value="Hospitality">Hospitality</option>
              <option value="Retail">Retail</option>
              <option value="Education">Education</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Real Estate">Real Estate</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="website" className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Website
            </label>
            <input
              id="website"
              name="website"
              type="url"
              placeholder="https://example.com"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="contact@company.com"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="phone" className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+971 4 123 4567"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="size" className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Company Size
            </label>
            <select
              id="size"
              name="size"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="">Select size</option>
              <option value="1-10">1-10 employees</option>
              <option value="11-50">11-50 employees</option>
              <option value="51-200">51-200 employees</option>
              <option value="201-500">201-500 employees</option>
              <option value="500+">500+ employees</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="town" className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              City
            </label>
            <input
              id="town"
              name="town"
              type="text"
              placeholder="Dubai"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="country" className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Country
            </label>
            <input
              id="country"
              name="country"
              type="text"
              placeholder="UAE"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="postal_code" className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Postal Code
            </label>
            <input
              id="postal_code"
              name="postal_code"
              type="text"
              placeholder="00000"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="street_address" className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Street Address
            </label>
            <input
              id="street_address"
              name="street_address"
              type="text"
              placeholder="123 Business Bay"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <label htmlFor="notes" className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Additional information about this company..."
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-6 py-2.5 text-[13px] font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                Create Company
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
