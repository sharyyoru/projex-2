"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type SearchResult = {
  id: string;
  type: "company" | "contact" | "project" | "quotation" | "invoice";
  title: string;
  subtitle: string;
  href: string;
};

export default function HeaderSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live search with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = value.trim();
    if (!query || query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const pattern = `%${query.toLowerCase()}%`;

      try {
        const [companiesRes, contactsRes, projectsRes, invoicesRes] = await Promise.all([
          supabaseClient
            .from("companies")
            .select("id, name, email")
            .ilike("name", pattern)
            .limit(3),
          supabaseClient
            .from("contacts")
            .select("id, first_name, last_name, email, company_id")
            .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
            .limit(3),
          supabaseClient
            .from("projects")
            .select("id, name, status")
            .ilike("name", pattern)
            .limit(3),
          supabaseClient
            .from("invoices")
            .select("id, invoice_number, invoice_type, client_name, status, project_id")
            .or(`invoice_number.ilike.${pattern},client_name.ilike.${pattern}`)
            .limit(4),
        ]);

        const allResults: SearchResult[] = [];

        // Companies
        (companiesRes.data ?? []).forEach((c: any) => {
          allResults.push({
            id: c.id,
            type: "company",
            title: c.name,
            subtitle: c.email || "Company",
            href: `/companies/${c.id}`,
          });
        });

        // Contacts
        (contactsRes.data ?? []).forEach((c: any) => {
          allResults.push({
            id: c.id,
            type: "contact",
            title: `${c.first_name} ${c.last_name}`.trim(),
            subtitle: c.email || "Contact",
            href: c.company_id ? `/companies/${c.company_id}` : "/companies",
          });
        });

        // Projects
        (projectsRes.data ?? []).forEach((p: any) => {
          allResults.push({
            id: p.id,
            type: "project",
            title: p.name,
            subtitle: p.status || "Project",
            href: `/projects/${p.id}`,
          });
        });

        // Invoices & Quotations
        (invoicesRes.data ?? []).forEach((inv: any) => {
          const isQuote = inv.invoice_type === "quote";
          allResults.push({
            id: inv.id,
            type: isQuote ? "quotation" : "invoice",
            title: inv.invoice_number || (isQuote ? "Quotation" : "Invoice"),
            subtitle: `${inv.client_name || "Unknown"} • ${inv.status || "draft"}`,
            href: inv.project_id ? `/projects/${inv.project_id}` : "/financials",
          });
        });

        setResults(allResults);
        setShowDropdown(allResults.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;
    setShowDropdown(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function getTypeIcon(type: SearchResult["type"]) {
    switch (type) {
      case "company":
        return <span className="text-sky-600">🏢</span>;
      case "contact":
        return <span className="text-emerald-600">👤</span>;
      case "project":
        return <span className="text-violet-600">📁</span>;
      case "quotation":
        return <span className="text-amber-600">📋</span>;
      case "invoice":
        return <span className="text-rose-600">📄</span>;
    }
  }

  function getTypeBadge(type: SearchResult["type"]) {
    const colors = {
      company: "bg-sky-100 text-sky-700",
      contact: "bg-emerald-100 text-emerald-700",
      project: "bg-violet-100 text-violet-700",
      quotation: "bg-amber-100 text-amber-700",
      invoice: "bg-rose-100 text-rose-700",
    };
    return colors[type];
  }

  return (
    <div ref={containerRef} className="relative w-full z-[100]">
      <form onSubmit={handleSubmit} className="relative w-full group">
        <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-sky-400/40 via-emerald-400/40 to-violet-400/40 opacity-0 blur-sm transition duration-300 group-hover:opacity-100" />
        <div className="relative flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-[11px] text-slate-600 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/90 text-[10px] text-white shadow-sm">
            {loading ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="6" />
                <path d="m16 16 4 4" />
              </svg>
            )}
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            placeholder="Search companies, contacts, projects..."
            className="w-full border-0 bg-transparent text-[11px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            className="hidden sm:inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Search
          </button>
        </div>
      </form>

      {/* Live search dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-[9999] mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
          {results.map((result) => (
            <Link
              key={`${result.type}-${result.id}`}
              href={result.href}
              onClick={() => {
                setShowDropdown(false);
                setValue("");
              }}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
            >
              <span className="text-base">{getTypeIcon(result.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">{result.title}</p>
                <p className="text-[10px] text-slate-500 truncate">{result.subtitle}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium capitalize ${getTypeBadge(result.type)}`}>
                {result.type}
              </span>
            </Link>
          ))}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={handleSubmit}
              className="text-[10px] text-sky-600 hover:text-sky-700 font-medium"
            >
              View all results for "{value}" →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

