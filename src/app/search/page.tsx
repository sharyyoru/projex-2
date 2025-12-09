"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useUserRole } from "@/app/profile/hooks/useUserRole";

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

type InvoiceHit = {
  id: string;
  invoice_number: string | null;
  invoice_type: string | null;
  client_name: string | null;
  status: string | null;
  project_id: string | null;
  total: number | null;
};

export default function GlobalSearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawQuery = searchParams.get("q") ?? "";
  const trimmedQuery = rawQuery.trim();
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "hr";

  const [companies, setCompanies] = useState<CompanyHit[]>([]);
  const [contacts, setContacts] = useState<ContactHit[]>([]);
  const [projects, setProjects] = useState<ProjectHit[]>([]);
  const [invoices, setInvoices] = useState<InvoiceHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Handle quote/invoice click - check admin access
  const handleFinancialClick = (e: React.MouseEvent, projectId: string | null) => {
    e.preventDefault();
    if (!isAdmin) {
      setAccessDenied(true);
      setTimeout(() => setAccessDenied(false), 3000);
      return;
    }
    if (projectId) {
      router.push(`/projects/${projectId}?mode=admin&tab=invoice`);
    } else {
      router.push("/financials");
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      if (!trimmedQuery) {
        setCompanies([]);
        setContacts([]);
        setProjects([]);
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

        const [companiesResult, contactsResult, projectsResult, invoicesResult] =
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
              .from("invoices")
              .select("id, invoice_number, invoice_type, client_name, status, project_id, total")
              .or(`invoice_number.ilike.${pattern},client_name.ilike.${pattern}`)
              .limit(10),
          ]);

        if (cancelled) return;

        const hasError = companiesResult.error || contactsResult.error || 
          projectsResult.error || invoicesResult.error;

        if (hasError) {
          const message =
            companiesResult.error?.message ??
            contactsResult.error?.message ??
            projectsResult.error?.message ??
            invoicesResult.error?.message ??
            "Failed to run search.";
          setError(message);
          setCompanies([]);
          setContacts([]);
          setProjects([]);
          setInvoices([]);
          setLoading(false);
          return;
        }

        setCompanies((companiesResult.data ?? []) as CompanyHit[]);
        setContacts((contactsResult.data ?? []) as ContactHit[]);
        setProjects((projectsResult.data ?? []) as ProjectHit[]);
        setInvoices((invoicesResult.data ?? []) as InvoiceHit[]);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError("Failed to run search.");
        setCompanies([]);
        setContacts([]);
        setProjects([]);
        setInvoices([]);
        setLoading(false);
      }
    }

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [trimmedQuery]);

  // Separate quotations and invoices from the combined results
  const quotations = invoices.filter(inv => inv.invoice_type === "quote");
  const actualInvoices = invoices.filter(inv => inv.invoice_type !== "quote");

  const totalResults = useMemo(
    () => companies.length + contacts.length + projects.length + invoices.length,
    [companies.length, contacts.length, projects.length, invoices.length],
  );

  return (
    <div className="space-y-6">
      {/* Access Denied Toast */}
      {accessDenied && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-lg animate-in slide-in-from-top-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
            <svg className="h-4 w-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800">Access Denied</p>
            <p className="text-[11px] text-red-600">You don&apos;t have permission to access Quotes & Invoices</p>
          </div>
        </div>
      )}

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

          {quotations.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Quotations</h2>
                <span className="text-[11px] text-slate-400">
                  {quotations.length} match{quotations.length === 1 ? "" : "es"}
                </span>
              </div>
              <ul className="space-y-1.5">
                {quotations.map((quote) => (
                  <li key={quote.id}>
                    <button
                      type="button"
                      onClick={(e) => handleFinancialClick(e, quote.project_id)}
                      className="flex w-full items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-left text-slate-800 hover:bg-slate-100 transition-colors"
                    >
                      <div>
                        <p className="text-[11px] font-semibold text-amber-700">
                          {quote.invoice_number || "Untitled quotation"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {quote.client_name || "Unknown"} • {quote.status || "draft"}
                        </p>
                      </div>
                      <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actualInvoices.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Invoices</h2>
                <span className="text-[11px] text-slate-400">
                  {actualInvoices.length} match{actualInvoices.length === 1 ? "" : "es"}
                </span>
              </div>
              <ul className="space-y-1.5">
                {actualInvoices.map((invoice) => (
                  <li key={invoice.id}>
                    <button
                      type="button"
                      onClick={(e) => handleFinancialClick(e, invoice.project_id)}
                      className="flex w-full items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-left text-slate-800 hover:bg-slate-100 transition-colors"
                    >
                      <div>
                        <p className="text-[11px] font-semibold text-rose-700">
                          {invoice.invoice_number || "Untitled invoice"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {invoice.client_name || "Unknown"} • {invoice.status || "draft"} {invoice.total ? `• AED ${invoice.total.toLocaleString()}` : ""}
                        </p>
                      </div>
                      <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
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
