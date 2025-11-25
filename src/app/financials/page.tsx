"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";

type Invoice = {
  id: string;
  project_id: string | null;
  invoice_number: string;
  invoice_type: "quote" | "invoice";
  status: string;
  client_name: string;
  issue_date: string;
  due_date: string | null;
  paid_date: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  currency: string;
  created_at: string;
  project?: { id: string; name: string; company_id: string } | null;
};

type Project = {
  id: string;
  company_id: string;
  name: string;
  value: number | null;
  status: string | null;
  company?: { id: string; name: string } | null;
};

type Company = {
  id: string;
  name: string;
};

function formatMoney(amount: number, currency = "AED"): string {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  unpaid: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default function FinancialsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "quote" | "invoice">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [invoicesRes, projectsRes, companiesRes] = await Promise.all([
          supabaseClient.from("invoices").select("*, project:projects(id, name, company_id)").order("created_at", { ascending: false }),
          supabaseClient.from("projects").select("id, company_id, name, value, status, company:companies(id, name)").eq("is_archived", false),
          supabaseClient.from("companies").select("id, name").order("name"),
        ]);

        if (!isMounted) return;

        if (invoicesRes.error) {
          setError(invoicesRes.error.message);
          setLoading(false);
          return;
        }

        setInvoices((invoicesRes.data as unknown as Invoice[]) || []);
        setProjects((projectsRes.data as unknown as Project[]) || []);
        setCompanies((companiesRes.data as Company[]) || []);
        setLoading(false);
      } catch {
        if (!isMounted) return;
        setError("Failed to load financial data.");
        setLoading(false);
      }
    }
    void load();
    return () => { isMounted = false; };
  }, []);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (typeFilter !== "all" && inv.invoice_type !== typeFilter) return false;
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (projectFilter !== "all" && inv.project_id !== projectFilter) return false;
      if (companyFilter !== "all") {
        const proj = projects.find((p) => p.id === inv.project_id);
        if (!proj || proj.company_id !== companyFilter) return false;
      }
      if (dateFromFilter || dateToFilter) {
        const ymd = inv.issue_date?.slice(0, 10);
        if (dateFromFilter && ymd && ymd < dateFromFilter) return false;
        if (dateToFilter && ymd && ymd > dateToFilter) return false;
      }
      return true;
    });
  }, [invoices, typeFilter, statusFilter, projectFilter, companyFilter, dateFromFilter, dateToFilter, projects]);

  const summary = useMemo(() => {
    let totalQuoted = 0, totalInvoiced = 0, totalPaid = 0, totalOverdue = 0;
    for (const inv of filteredInvoices) {
      if (inv.invoice_type === "quote" && inv.status !== "cancelled") totalQuoted += inv.total;
      if (inv.invoice_type === "invoice" && inv.status !== "cancelled") {
        totalInvoiced += inv.total;
        if (inv.status === "paid") totalPaid += inv.total;
        if (inv.status === "overdue") totalOverdue += inv.total;
      }
    }
    return { totalQuoted, totalInvoiced, totalPaid, totalOverdue };
  }, [filteredInvoices]);

  const projectSummary = useMemo(() => {
    let totalValue = 0;
    for (const proj of projects) { if (proj.value) totalValue += proj.value; }
    return { totalValue, totalCount: projects.length };
  }, [projects]);

  function clearFilters() {
    setDateFromFilter(""); setDateToFilter(""); setTypeFilter("all"); setStatusFilter("all"); setCompanyFilter("all"); setProjectFilter("all");
  }

  const hasActiveFilters = dateFromFilter || dateToFilter || typeFilter !== "all" || statusFilter !== "all" || companyFilter !== "all" || projectFilter !== "all";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Financial Summary</h1>
          <p className="mt-0.5 text-sm text-slate-500">Overview of all projects, companies, quotes, and invoices</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white shadow-xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Total Quoted</p>
          <p className="mt-2 text-2xl font-bold">{formatMoney(summary.totalQuoted)}</p>
          <p className="mt-1 text-[11px] text-white/60">{filteredInvoices.filter(i => i.invoice_type === "quote").length} quotes</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-5 text-white shadow-xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Total Invoiced</p>
          <p className="mt-2 text-2xl font-bold">{formatMoney(summary.totalInvoiced)}</p>
          <p className="mt-1 text-[11px] text-white/60">{filteredInvoices.filter(i => i.invoice_type === "invoice").length} invoices</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Paid</p>
          <p className="mt-2 text-2xl font-bold">{formatMoney(summary.totalPaid)}</p>
          <p className="mt-1 text-[11px] text-white/60">{filteredInvoices.filter(i => i.status === "paid").length} paid</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 p-5 text-white shadow-xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Overdue</p>
          <p className="mt-2 text-2xl font-bold">{formatMoney(summary.totalOverdue)}</p>
          <p className="mt-1 text-[11px] text-white/60">{filteredInvoices.filter(i => i.status === "overdue").length} overdue</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div><p className="text-[11px] font-medium text-slate-500">Projects</p><p className="text-lg font-bold text-slate-900">{projectSummary.totalCount}</p></div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Total value: {formatMoney(projectSummary.totalValue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-blue-100 text-sky-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4z"/></svg>
            </div>
            <div><p className="text-[11px] font-medium text-slate-500">Companies</p><p className="text-lg font-bold text-slate-900">{companies.length}</p></div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div><p className="text-[11px] font-medium text-slate-500">Collection Rate</p><p className="text-lg font-bold text-slate-900">{summary.totalInvoiced > 0 ? Math.round((summary.totalPaid / summary.totalInvoiced) * 100) : 0}%</p></div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/60 bg-gradient-to-r from-slate-50/80 to-white/80 p-4 shadow-sm">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700 shadow-sm">
          <option value="all">All Types</option><option value="quote">Quotes</option><option value="invoice">Invoices</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700 shadow-sm">
          <option value="all">All Status</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="overdue">Overdue</option>
        </select>
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="h-8 min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700 shadow-sm">
          <option value="all">All Companies</option>{companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="h-8 min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700 shadow-sm">
          <option value="all">All Projects</option>{projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
        <input type="date" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] shadow-sm" />
        <span className="text-[10px] text-slate-400">to</span>
        <input type="date" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] shadow-sm" />
        {hasActiveFilters && <button type="button" onClick={clearFilters} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-100">Clear</button>}
        <div className="ml-auto text-[11px] text-slate-400">{filteredInvoices.length} records</div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" /></div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-violet-50/30 py-16">
          <p className="text-sm font-semibold text-slate-700">No records found</p>
          <p className="mt-1 text-xs text-slate-400">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-4 hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${inv.invoice_type === "quote" ? "bg-blue-100 text-blue-600" : "bg-violet-100 text-violet-600"}`}>
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-slate-900">{inv.invoice_number}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColors[inv.status] || "bg-slate-100 text-slate-600"}`}>{inv.status}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 capitalize">{inv.invoice_type}</span>
                    </div>
                    <p className="text-[12px] text-slate-500">{inv.client_name}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-[10px] text-slate-400">
                      <span>{formatDate(inv.issue_date)}</span>
                      {inv.project && <Link href={`/projects/${inv.project.id}`} className="text-indigo-600 hover:underline">{inv.project.name}</Link>}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-bold text-slate-900">{formatMoney(inv.total, inv.currency)}</p>
                  {inv.project && <Link href={`/projects/${inv.project.id}`} className="text-[10px] text-indigo-600 hover:underline">View Project</Link>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
