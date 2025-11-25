"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type CompanyHit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  industry: string | null;
};

type ContactHit = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company_id: string | null;
};

type ProjectHit = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  company_id: string;
};

type QuoteHit = {
  id: string;
  quote_number: string | null;
  title: string | null;
  status: string | null;
  project_id: string | null;
};

type InvoiceHit = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  project_id: string | null;
  total: number | null;
};

export default function GlobalSearchPage() {
  const searchParams = useSearchParams();
  const rawQuery = searchParams.get("q") ?? "";
  const trimmedQuery = rawQuery.trim();

  const [companies, setCompanies] = useState<CompanyHit[]>([]);
  const [contacts, setContacts] = useState<ContactHit[]>([]);
  const [projects, setProjects] = useState<ProjectHit[]>([]);
  const [quotes, setQuotes] = useState<QuoteHit[]>([]);
  const [invoices, setInvoices] = useState<InvoiceHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      if (!trimmedQuery) {
        setCompanies([]);
        setContacts([]);
        setProjects([]);
        setQuotes([]);
        setInvoices([]);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const normalized = trimmedQuery.toLowerCase();
        const escaped = normalized.replace(/[%]/g, "");
        const pattern = `%${escaped}%`;

        const [companiesResult, contactsResult, projectsResult, quotesResult, invoicesResult] =
          await Promise.all([
            supabaseClient
              .from("companies")
              .select("id, name, email, phone, industry")
              .or(`name.ilike.${pattern},email.ilike.${pattern},industry.ilike.${pattern}`)
              .limit(8),
            supabaseClient
              .from("contacts")
              .select("id, first_name, last_name, email, phone, company_id")
              .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
              .limit(8),
            supabaseClient
              .from("projects")
              .select("id, name, description, status, company_id")
              .or(`name.ilike.${pattern},description.ilike.${pattern}`)
              .limit(8),
            supabaseClient
              .from("quotes")
              .select("id, quote_number, title, status, project_id")
              .or(`quote_number.ilike.${pattern},title.ilike.${pattern}`)
              .limit(8),
            supabaseClient
              .from("invoices")
              .select("id, invoice_number, status, project_id, total")
              .or(`invoice_number.ilike.${pattern}`)
              .limit(8),
          ]);

        if (cancelled) return;

        const hasError = companiesResult.error || contactsResult.error || 
          projectsResult.error || quotesResult.error || invoicesResult.error;

        if (hasError) {
          const message =
            companiesResult.error?.message ??
            contactsResult.error?.message ??
            projectsResult.error?.message ??
            quotesResult.error?.message ??
            invoicesResult.error?.message ??
            "Failed to run search.";
          setError(message);
          setCompanies([]);
          setContacts([]);
          setProjects([]);
          setQuotes([]);
          setInvoices([]);
          setLoading(false);
          return;
        }

        setCompanies((companiesResult.data ?? []) as CompanyHit[]);
        setContacts((contactsResult.data ?? []) as ContactHit[]);
        setProjects((projectsResult.data ?? []) as ProjectHit[]);
        setQuotes((quotesResult.data ?? []) as QuoteHit[]);
        setInvoices((invoicesResult.data ?? []) as InvoiceHit[]);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError("Failed to run search.");
        setCompanies([]);
        setContacts([]);
        setProjects([]);
        setQuotes([]);
        setInvoices([]);
        setLoading(false);
      }
    }

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [trimmedQuery]);

  const totalResults = useMemo(
    () => companies.length + contacts.length + projects.length + quotes.length + invoices.length,
    [companies.length, contacts.length, projects.length, quotes.length, invoices.length],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-slate-900">Search</h1>
        <p className="text-xs text-slate-500">
          Search across companies, contacts, projects, quotes, and invoices.
        </p>
      </header>

      {!trimmedQuery ? (
        <p className="text-xs text-slate-500">
          Use the search bar in the header to find any content.
        </p>
      ) : loading ? (
        <p className="text-xs text-slate-500">Searching for "{trimmedQuery}"...</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : totalResults === 0 ? (
        <p className="text-xs text-slate-500">
          No results found for "{trimmedQuery}".
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {companies.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Companies</h2>
                <span className="text-[11px] text-slate-400">
                  {companies.length} match{companies.length === 1 ? "" : "es"}
                </span>
              </div>
              <ul className="space-y-1.5">
                {companies.map((company) => (
                  <li key={company.id}>
                    <Link
                      href={`/companies/${company.id}`}
                      className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-slate-800 hover:bg-slate-100"
                    >
                      <div>
                        <p className="text-[11px] font-semibold text-sky-700">
                          {company.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {company.email || company.phone || company.industry || "No details"}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {contacts.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Contacts</h2>
                <span className="text-[11px] text-slate-400">
                  {contacts.length} match{contacts.length === 1 ? "" : "es"}
                </span>
              </div>
              <ul className="space-y-1.5">
                {contacts.map((contact) => {
                  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
                  return (
                    <li key={contact.id}>
                      <Link
                        href={contact.company_id ? `/companies/${contact.company_id}` : "/companies"}
                        className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-slate-800 hover:bg-slate-100"
                      >
                        <div>
                          <p className="text-[11px] font-semibold text-emerald-700">
                            {fullName || "Unnamed contact"}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {contact.email || contact.phone || "No contact details"}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {projects.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Projects</h2>
                <span className="text-[11px] text-slate-400">
                  {projects.length} match{projects.length === 1 ? "" : "es"}
                </span>
              </div>
              <ul className="space-y-1.5">
                {projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/projects/${project.id}`}
                      className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-slate-800 hover:bg-slate-100"
                    >
                      <div>
                        <p className="text-[11px] font-semibold text-violet-700">
                          {project.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {project.status || project.description || "No description"}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {quotes.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Quotes</h2>
                <span className="text-[11px] text-slate-400">
                  {quotes.length} match{quotes.length === 1 ? "" : "es"}
                </span>
              </div>
              <ul className="space-y-1.5">
                {quotes.map((quote) => (
                  <li key={quote.id}>
                    <Link
                      href={quote.project_id ? `/projects/${quote.project_id}` : "/projects"}
                      className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-slate-800 hover:bg-slate-100"
                    >
                      <div>
                        <p className="text-[11px] font-semibold text-amber-700">
                          {quote.quote_number || quote.title || "Untitled quote"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {quote.status || "No status"}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {invoices.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Invoices</h2>
                <span className="text-[11px] text-slate-400">
                  {invoices.length} match{invoices.length === 1 ? "" : "es"}
                </span>
              </div>
              <ul className="space-y-1.5">
                {invoices.map((invoice) => (
                  <li key={invoice.id}>
                    <Link
                      href={invoice.project_id ? `/projects/${invoice.project_id}` : "/financials"}
                      className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-slate-800 hover:bg-slate-100"
                    >
                      <div>
                        <p className="text-[11px] font-semibold text-rose-700">
                          {invoice.invoice_number || "Untitled invoice"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {invoice.status || "No status"} {invoice.total ? `• $${invoice.total.toLocaleString()}` : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
