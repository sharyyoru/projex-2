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

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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
    const term = search.trim().toLowerCase();
    if (!term) return companies;

    return companies.filter((company) => {
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
  }, [companies, search]);

  function handleCreated(company: CompanyRow) {
    setCompanies((prev) => [company, ...prev]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Companies</h1>
          <p className="text-sm text-slate-500">
            Manage your company accounts. Create new organizations and quickly access
            their contacts and projects.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <NewCompanyForm onCreated={handleCreated} />

        <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-800">Company list</h2>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, domain, industry, location..."
              className="w-56 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {loading ? (
            <p className="text-xs text-slate-500">Loading companies...</p>
          ) : error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : filteredCompanies.length === 0 ? (
            <p className="text-xs text-slate-500">No companies found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs sm:text-sm">
                <thead className="border-b text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Company</th>
                    <th className="py-2 pr-4 font-medium hidden lg:table-cell">
                      Industry
                    </th>
                    <th className="py-2 pr-4 font-medium hidden md:table-cell">
                      Website / Email
                    </th>
                    <th className="py-2 pr-4 font-medium hidden md:table-cell">
                      Location
                    </th>
                    <th className="py-2 pr-2 font-medium text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCompanies.map((company) => {
                    const location = [company.town, company.country]
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <tr key={company.id} className="hover:bg-slate-50/70">
                        <td className="py-2 pr-4 align-top">
                          <div className="flex flex-col gap-0.5">
                            <Link
                              href={`/companies/${company.id}`}
                              className="font-medium text-slate-900 hover:text-sky-700 hover:underline"
                            >
                              {company.name}
                            </Link>
                            {company.legal_name ? (
                              <p className="text-[11px] text-slate-500">
                                {company.legal_name}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2 pr-4 align-top hidden lg:table-cell text-slate-700">
                          {company.industry || "—"}
                        </td>
                        <td className="py-2 pr-4 align-top hidden md:table-cell text-slate-700">
                          <div className="space-y-0.5">
                            {company.website ? (
                              <a
                                href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                                target="_blank"
                                rel="noreferrer"
                                className="block truncate text-[11px] text-sky-700 hover:text-sky-800 hover:underline"
                              >
                                {company.website}
                              </a>
                            ) : null}
                            <p className="truncate text-[11px] text-slate-600">
                              {company.email || ""}
                            </p>
                          </div>
                        </td>
                        <td className="py-2 pr-4 align-top hidden md:table-cell text-slate-700">
                          {location || "—"}
                        </td>
                        <td className="py-2 pr-2 align-top text-right text-[11px] text-slate-500">
                          {formatShortDate(company.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewCompanyForm({
  onCreated,
}: {
  onCreated: (company: CompanyRow) => void;
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
      className="space-y-4 rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur"
    >
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-slate-800">New company</h2>
        <p className="text-xs text-slate-500">
          Capture key details about the organization. You can add contacts and
          projects from the company page later.
        </p>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="name"
          className="block text-xs font-medium text-slate-700"
        >
          Company name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="legal_name"
          className="block text-xs font-medium text-slate-700"
        >
          Legal name (optional)
        </label>
        <input
          id="legal_name"
          name="legal_name"
          type="text"
          className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="website"
            className="block text-xs font-medium text-slate-700"
          >
            Website
          </label>
          <input
            id="website"
            name="website"
            type="url"
            placeholder="https://example.com"
            className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-xs font-medium text-slate-700"
          >
            Main email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="phone"
            className="block text-xs font-medium text-slate-700"
          >
            Main phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="industry"
            className="block text-xs font-medium text-slate-700"
          >
            Industry
          </label>
          <input
            id="industry"
            name="industry"
            type="text"
            placeholder="e.g. Healthcare, Finance, Hospitality"
            className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="size"
            className="block text-xs font-medium text-slate-700"
          >
            Company size
          </label>
          <input
            id="size"
            name="size"
            type="text"
            placeholder="e.g. 11-50 employees"
            className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="town"
            className="block text-xs font-medium text-slate-700"
          >
            City
          </label>
          <input
            id="town"
            name="town"
            type="text"
            className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="country"
            className="block text-xs font-medium text-slate-700"
          >
            Country
          </label>
          <input
            id="country"
            name="country"
            type="text"
            className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="postal_code"
            className="block text-xs font-medium text-slate-700"
          >
            Postal code
          </label>
          <input
            id="postal_code"
            name="postal_code"
            type="text"
            className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="street_address"
          className="block text-xs font-medium text-slate-700"
        >
          Street address
        </label>
        <input
          id="street_address"
          name="street_address"
          type="text"
          className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="notes"
          className="block text-xs font-medium text-slate-700"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-4 py-1.5 text-xs font-medium text-white shadow-[0_10px_25px_rgba(15,23,42,0.22)] backdrop-blur hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Saving..." : "Create company"}
      </button>
    </form>
  );
}
