"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";

type AccountClient = {
  id: string;
  client_name: string;
  industry: string | null;
  avatar_url: string | null;
  client_type: string | null;
  client_category: string | null;
  client_since: string | null;
  end_date: string | null;
  services_signed: string[];
  contract_type: string | null;
  invoice_due_day: string | null;
  retainer_fee: number;
  service_based_fee: number;
  adhoc_fee: number;
  currency: string;
  created_at: string | null;
};

const CLIENT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  high_maintenance: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  mid_maintenance: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  low_maintenance: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  standard: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
};

const CONTRACT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  service_based: { bg: "bg-gradient-to-r from-violet-500 to-purple-500", text: "text-white" },
  "3_month": { bg: "bg-gradient-to-r from-sky-500 to-cyan-500", text: "text-white" },
  "6_month": { bg: "bg-gradient-to-r from-emerald-500 to-teal-500", text: "text-white" },
  "12_month": { bg: "bg-gradient-to-r from-amber-500 to-orange-500", text: "text-white" },
  project_based: { bg: "bg-gradient-to-r from-slate-500 to-gray-500", text: "text-white" },
};

const INDUSTRY_COLORS: Record<string, string> = {
  Medical: "from-pink-500 to-rose-500",
  "F&B": "from-amber-500 to-orange-500",
  Healthcare: "from-pink-500 to-rose-500",
  Finance: "from-emerald-500 to-teal-500",
  Technology: "from-violet-500 to-purple-500",
  Hospitality: "from-amber-500 to-orange-500",
  Retail: "from-sky-500 to-cyan-500",
  Education: "from-indigo-500 to-blue-500",
  "Real Estate": "from-lime-500 to-green-500",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(amount: number, currency: string = "AED"): string {
  return new Intl.NumberFormat("en-AE", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + " " + currency;
}

function formatClientType(type: string | null): string {
  if (!type) return "—";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatContractType(type: string | null): string {
  if (!type) return "—";
  const map: Record<string, string> = {
    service_based: "Service-Based",
    "3_month": "3-Month Contract",
    "6_month": "6-Month Contract",
    "12_month": "12-Month Contract",
    project_based: "Project-Based",
  };
  return map[type] || type;
}

export default function AccountsPage() {
  const [clients, setClients] = useState<AccountClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: loadError } = await supabaseClient
        .from("account_clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (loadError) {
        setError(loadError.message);
        setClients([]);
      } else {
        setClients((data || []).map((c) => ({
          ...c,
          services_signed: Array.isArray(c.services_signed) ? c.services_signed : [],
          retainer_fee: Number(c.retainer_fee) || 0,
          service_based_fee: Number(c.service_based_fee) || 0,
          adhoc_fee: Number(c.adhoc_fee) || 0,
        })));
      }
    } catch {
      setError("Failed to load clients.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  const { filteredClients, retainerClients, projectClients, totalFees } = useMemo(() => {
    let result = clients;

    if (categoryFilter) {
      result = result.filter((c) => c.client_category === categoryFilter);
    }

    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter((c) => {
        const hay = [c.client_name, c.industry, c.client_type, c.contract_type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(term);
      });
    }

    const retainer = result.filter((c) => c.client_category === "active_retainer");
    const project = result.filter((c) => c.client_category === "project_based");

    const total = result.reduce((sum, c) => sum + c.retainer_fee + c.service_based_fee + c.adhoc_fee, 0);

    return {
      filteredClients: result,
      retainerClients: retainer,
      projectClients: project,
      totalFees: total,
    };
  }, [clients, search, categoryFilter]);

  function handleClientCreated(client: AccountClient) {
    setClients((prev) => [client, ...prev]);
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="pointer-events-none absolute -top-10 right-0 h-[300px] w-[400px] overflow-hidden opacity-50">
          <div className="absolute top-0 right-0 h-[250px] w-[350px] rounded-full bg-gradient-to-br from-teal-200/60 to-emerald-200/40 blur-3xl" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/30">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Client Directory</h1>
                <p className="text-[13px] text-slate-500">
                  {clients.length} clients in your portfolio
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex rounded-lg border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all ${
                  viewMode === "table"
                    ? "bg-teal-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3h18v18H3z" />
                  <path d="M3 9h18" />
                  <path d="M3 15h18" />
                  <path d="M9 3v18" />
                </svg>
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("card")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all ${
                  viewMode === "card"
                    ? "bg-teal-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                Card
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium shadow-lg transition-all ${
                showForm
                  ? "bg-slate-100 text-slate-700 shadow-slate-200/50 hover:bg-slate-200"
                  : "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30"
              }`}
            >
              {showForm ? (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  New Client
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="group relative overflow-hidden rounded-xl border border-teal-200/50 bg-gradient-to-br from-teal-50 to-emerald-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-teal-200/30 blur-2xl transition-all group-hover:bg-teal-300/40" />
          <p className="text-[11px] font-medium text-teal-600 uppercase tracking-wide">Total Clients</p>
          <p className="mt-1 text-2xl font-bold text-teal-700">{clients.length}</p>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-violet-200/50 bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-violet-200/30 blur-2xl transition-all group-hover:bg-violet-300/40" />
          <p className="text-[11px] font-medium text-violet-600 uppercase tracking-wide">Active Retainers</p>
          <p className="mt-1 text-2xl font-bold text-violet-700">
            {clients.filter((c) => c.client_category === "active_retainer").length}
          </p>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-amber-200/30 blur-2xl transition-all group-hover:bg-amber-300/40" />
          <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wide">Project Based</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">
            {clients.filter((c) => c.client_category === "project_based").length}
          </p>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-green-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-emerald-200/30 blur-2xl transition-all group-hover:bg-emerald-300/40" />
          <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wide">Total Fees</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {formatCurrency(clients.reduce((sum, c) => sum + c.retainer_fee + c.service_based_fee, 0))}
          </p>
        </div>
      </div>

      {/* New Client Form */}
      {showForm && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          <NewClientForm onCreated={handleClientCreated} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients, industries..."
            className="h-9 w-64 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-black placeholder:text-slate-400 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-slate-500">Category</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-black shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="">All Categories</option>
            <option value="active_retainer">Active Retainers</option>
            <option value="project_based">Project Based</option>
          </select>
        </div>
        {(search || categoryFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategoryFilter("");
            }}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
            Clear
          </button>
        )}
        <div className="ml-auto text-[12px] text-slate-500">
          Showing {filteredClients.length} of {clients.length}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500" />
            <p className="text-[13px] text-slate-500">Loading clients...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {error}
        </div>
      ) : filteredClients.length === 0 ? (
        <EmptyState showForm={showForm} onShowForm={() => setShowForm(true)} />
      ) : viewMode === "table" ? (
        <TableView
          retainerClients={retainerClients}
          projectClients={projectClients}
          totalFees={totalFees}
        />
      ) : (
        <CardView clients={filteredClients} />
      )}
    </div>
  );
}

function EmptyState({ showForm, onShowForm }: { showForm: boolean; onShowForm: () => void }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-white/60 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100">
        <svg className="h-8 w-8 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <p className="mt-4 text-[15px] font-medium text-slate-700">No clients found</p>
      <p className="mt-1 text-[13px] text-slate-500">
        Add your first client to get started
      </p>
      {!showForm && (
        <button
          type="button"
          onClick={onShowForm}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-[13px] font-medium text-white shadow-lg shadow-teal-500/25"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Add Client
        </button>
      )}
    </div>
  );
}

function TableView({
  retainerClients,
  projectClients,
  totalFees,
}: {
  retainerClients: AccountClient[];
  projectClients: AccountClient[];
  totalFees: number;
}) {
  return (
    <div className="space-y-6">
      {/* Active Retainer Clients */}
      {retainerClients.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-violet-500" />
            <h2 className="text-[14px] font-semibold text-slate-700">Active Retainer Clients</h2>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
              {retainerClients.length}
            </span>
          </div>
          <ClientTable clients={retainerClients} />
        </div>
      )}

      {/* Project Based Clients */}
      {projectClients.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <h2 className="text-[14px] font-semibold text-slate-700">Project Based Clients</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              {projectClients.length}
            </span>
          </div>
          <ClientTable clients={projectClients} />
        </div>
      )}

      {/* Aggregate Footer */}
      <div className="flex items-center justify-end rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium text-emerald-700">Total Fees Sum:</span>
          <span className="text-xl font-bold text-emerald-700">{formatCurrency(totalFees)}</span>
        </div>
      </div>
    </div>
  );
}

function ClientTable({ clients }: { clients: AccountClient[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Client Name</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Industry</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Client Type</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Client Since</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Services Signed</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Contract Type</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">End Date</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Invoice Due</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Fees</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((client) => {
              const industryColor = INDUSTRY_COLORS[client.industry || ""] || "from-slate-400 to-slate-500";
              const clientTypeStyle = CLIENT_TYPE_COLORS[client.client_type || "standard"] || CLIENT_TYPE_COLORS.standard;
              const contractStyle = CONTRACT_TYPE_COLORS[client.contract_type || ""] || { bg: "bg-slate-100", text: "text-slate-700" };
              const totalFee = client.retainer_fee + client.service_based_fee + client.adhoc_fee;

              return (
                <tr key={client.id} className="group transition-colors hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/accounts/${client.id}`} className="flex items-center gap-3">
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-teal-100 to-emerald-100 text-teal-600 font-bold text-sm">
                        {client.avatar_url ? (
                          <img src={client.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          client.client_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="font-medium text-slate-900 group-hover:text-teal-600 transition-colors">
                        {client.client_name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {client.industry ? (
                      <span className={`inline-flex rounded-full bg-gradient-to-r px-2 py-0.5 text-[10px] font-semibold text-white ${industryColor}`}>
                        {client.industry}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {client.client_type ? (
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${clientTypeStyle.bg} ${clientTypeStyle.text} ${clientTypeStyle.border}`}>
                        {formatClientType(client.client_type)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(client.client_since)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {client.services_signed.length > 0 ? (
                        <>
                          {client.services_signed.slice(0, 2).map((service, i) => (
                            <span key={i} className="inline-flex rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 border border-sky-200">
                              {service}
                            </span>
                          ))}
                          {client.services_signed.length > 2 && (
                            <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                              +{client.services_signed.length - 2}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {client.contract_type ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${contractStyle.bg} ${contractStyle.text}`}>
                        {formatContractType(client.contract_type)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(client.end_date)}</td>
                  <td className="px-4 py-3 text-slate-600">{client.invoice_due_day || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(totalFee, client.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardView({ clients }: { clients: AccountClient[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clients.map((client) => {
        const industryColor = INDUSTRY_COLORS[client.industry || ""] || "from-slate-400 to-slate-500";
        const clientTypeStyle = CLIENT_TYPE_COLORS[client.client_type || "standard"] || CLIENT_TYPE_COLORS.standard;
        const contractStyle = CONTRACT_TYPE_COLORS[client.contract_type || ""] || { bg: "bg-slate-100", text: "text-slate-700" };
        const totalFee = client.retainer_fee + client.service_based_fee + client.adhoc_fee;

        return (
          <Link
            key={client.id}
            href={`/accounts/${client.id}`}
            className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-lg hover:shadow-teal-100/50 hover:border-teal-200"
          >
            {/* Top gradient bar */}
            <div className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${industryColor}`} />

            <div className="flex items-start gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-teal-100 to-emerald-100 text-teal-600 font-bold text-lg">
                {client.avatar_url ? (
                  <img src={client.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  client.client_name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 truncate group-hover:text-teal-600 transition-colors">
                  {client.client_name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {client.industry && (
                    <span className={`inline-flex rounded-full bg-gradient-to-r px-2 py-0.5 text-[10px] font-semibold text-white ${industryColor}`}>
                      {client.industry}
                    </span>
                  )}
                  {client.client_type && (
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${clientTypeStyle.bg} ${clientTypeStyle.text} ${clientTypeStyle.border}`}>
                      {formatClientType(client.client_type)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Client Since</span>
                <span className="font-medium text-slate-700">{formatDate(client.client_since)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Contract</span>
                {client.contract_type ? (
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${contractStyle.bg} ${contractStyle.text}`}>
                    {formatContractType(client.contract_type)}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Invoice Due</span>
                <span className="font-medium text-slate-700">{client.invoice_due_day || "—"}</span>
              </div>
            </div>

            {/* Services */}
            {client.services_signed.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {client.services_signed.slice(0, 3).map((service, i) => (
                  <span key={i} className="inline-flex rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 border border-sky-200">
                    {service}
                  </span>
                ))}
                {client.services_signed.length > 3 && (
                  <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    +{client.services_signed.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Footer with fees */}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-[11px] text-slate-400">Monthly Fees</span>
              <span className="text-[14px] font-bold text-emerald-600">{formatCurrency(totalFee, client.currency)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function NewClientForm({
  onCreated,
  onCancel,
}: {
  onCreated: (client: AccountClient) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState("");

  const serviceOptions = [
    "CRM Development",
    "Hubspot Management",
    "Website Maintenance",
    "Social Media Management",
    "SEO Services",
    "CDN Services",
    "Email Marketing",
    "Content Creation",
    "Branding",
    "UI/UX Design",
  ];

  function addService(service: string) {
    if (service && !services.includes(service)) {
      setServices([...services, service]);
    }
    setServiceInput("");
  }

  function removeService(service: string) {
    setServices(services.filter((s) => s !== service));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const clientName = (formData.get("client_name") as string)?.trim();
    if (!clientName) {
      setError("Client name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        client_name: clientName,
        industry: (formData.get("industry") as string)?.trim() || null,
        client_type: (formData.get("client_type") as string) || null,
        client_category: (formData.get("client_category") as string) || "active_retainer",
        client_since: (formData.get("client_since") as string) || null,
        end_date: (formData.get("end_date") as string) || null,
        services_signed: services,
        contract_type: (formData.get("contract_type") as string) || null,
        invoice_due_day: (formData.get("invoice_due_day") as string)?.trim() || null,
        retainer_fee: parseFloat((formData.get("retainer_fee") as string) || "0") || 0,
        service_based_fee: parseFloat((formData.get("service_based_fee") as string) || "0") || 0,
        adhoc_fee: 0,
        currency: "AED",
      };

      const { data, error: insertError } = await supabaseClient
        .from("account_clients")
        .insert(payload)
        .select("*")
        .single();

      if (insertError || !data) {
        setError(insertError?.message || "Failed to create client.");
        setLoading(false);
        return;
      }

      onCreated({
        ...data,
        services_signed: Array.isArray(data.services_signed) ? data.services_signed : [],
        retainer_fee: Number(data.retainer_fee) || 0,
        service_based_fee: Number(data.service_based_fee) || 0,
        adhoc_fee: Number(data.adhoc_fee) || 0,
      });
    } catch {
      setError("Failed to create client.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative overflow-hidden rounded-2xl border border-teal-200/50 bg-white p-6 shadow-xl shadow-teal-500/10"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-teal-200/40 to-emerald-200/30 blur-3xl" />

      <div className="relative space-y-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/30">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add New Client</h2>
            <p className="text-[13px] text-slate-500">Add a new client to your portfolio</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Client Name *
            </label>
            <input
              name="client_name"
              type="text"
              required
              placeholder="Enter client name"
              className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Industry
            </label>
            <select
              name="industry"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">Select industry</option>
              <option value="Medical">Medical</option>
              <option value="F&B">F&B</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Finance">Finance</option>
              <option value="Technology">Technology</option>
              <option value="Hospitality">Hospitality</option>
              <option value="Retail">Retail</option>
              <option value="Education">Education</option>
              <option value="Real Estate">Real Estate</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Client Type
            </label>
            <select
              name="client_type"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">Select type</option>
              <option value="high_maintenance">High Maintenance</option>
              <option value="mid_maintenance">Mid Maintenance</option>
              <option value="low_maintenance">Low Maintenance</option>
              <option value="standard">Standard</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Client Category
            </label>
            <select
              name="client_category"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="active_retainer">Active Retainer</option>
              <option value="project_based">Project Based</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Client Since
            </label>
            <input
              name="client_since"
              type="date"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              End Date
            </label>
            <input
              name="end_date"
              type="date"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Contract Type
            </label>
            <select
              name="contract_type"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">Select contract</option>
              <option value="service_based">Service-Based</option>
              <option value="3_month">3-Month Contract</option>
              <option value="6_month">6-Month Contract</option>
              <option value="12_month">12-Month Contract</option>
              <option value="project_based">Project-Based</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Invoice Due Every
            </label>
            <input
              name="invoice_due_day"
              type="text"
              placeholder="e.g., 1st, 15th, 30th"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Retainer Fee (AED)
            </label>
            <input
              name="retainer_fee"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Service-Based Fee (AED)
            </label>
            <input
              name="service_based_fee"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {/* Services Multi-select */}
          <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide">
              Services Signed
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {services.map((service) => (
                <span
                  key={service}
                  className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-[12px] font-medium text-teal-700 border border-teal-200"
                >
                  {service}
                  <button
                    type="button"
                    onClick={() => removeService(service)}
                    className="ml-1 text-teal-500 hover:text-teal-700"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <select
                value={serviceInput}
                onChange={(e) => setServiceInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="">Select a service...</option>
                {serviceOptions
                  .filter((s) => !services.includes(s))
                  .map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => addService(serviceInput)}
                disabled={!serviceInput}
                className="inline-flex items-center gap-1 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                Add
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}

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
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-2.5 text-[13px] font-medium text-white shadow-lg shadow-teal-500/25 transition-all hover:shadow-xl hover:shadow-teal-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                Create Client
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
