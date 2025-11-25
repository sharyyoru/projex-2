"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabaseClient } from "@/lib/supabaseClient";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  pipeline: string | null;
  value: number | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string | null;
  is_archived: boolean;
  company: {
    id: string;
    name: string | null;
    logo_url: string | null;
  } | null;
};

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

const STATUS_COLORS: Record<string, string> = {
  "New Lead": "from-sky-500 to-cyan-500",
  "Processed": "from-violet-500 to-purple-500",
  "Discovery": "from-amber-500 to-orange-500",
  "Proposal": "from-pink-500 to-rose-500",
  "Quotation": "from-indigo-500 to-blue-500",
  "Invoice": "from-emerald-500 to-teal-500",
  "Project Started": "from-lime-500 to-green-500",
  "Project Delivered": "from-green-500 to-emerald-500",
  "Closed": "from-slate-500 to-gray-500",
  "Abandoned": "from-red-500 to-rose-500",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    async function loadProjects() {
      try {
        setLoading(true);
        setError(null);

        let query = supabaseClient
          .from("projects")
          .select(`
            id, name, description, status, pipeline, value, start_date, due_date, created_at, is_archived,
            company:companies(id, name, logo_url)
          `)
          .order("created_at", { ascending: false });

        const { data, error: fetchError } = await query;

        if (!isMounted) return;

        if (fetchError) {
          setError(fetchError.message);
          setProjects([]);
        } else {
          // Transform data to handle company as single object
          const transformed = (data || []).map((row: any) => ({
            ...row,
            company: Array.isArray(row.company) ? row.company[0] || null : row.company,
          }));
          setProjects(transformed as Project[]);
        }
      } catch {
        if (!isMounted) return;
        setError("Failed to load projects.");
        setProjects([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredProjects = projects.filter((project) => {
    // Archive filter
    if (showArchived) {
      if (!project.is_archived) return false;
    } else {
      if (project.is_archived) return false;
    }

    // Status filter
    if (statusFilter && project.status !== statusFilter) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = project.name.toLowerCase().includes(query);
      const matchesCompany = project.company?.name?.toLowerCase().includes(query);
      const matchesDescription = project.description?.toLowerCase().includes(query);
      if (!matchesName && !matchesCompany && !matchesDescription) return false;
    }

    return true;
  });

  const activeCount = projects.filter((p) => !p.is_archived).length;
  const archivedCount = projects.filter((p) => p.is_archived).length;
  const totalValue = filteredProjects.reduce((sum, p) => sum + (p.value || 0), 0);

  const uniqueStatuses = [...new Set(projects.map((p) => p.status).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="pointer-events-none absolute -top-10 right-0 h-[300px] w-[400px] overflow-hidden opacity-50">
          <div className="absolute top-0 right-0 h-[250px] w-[350px] rounded-full bg-gradient-to-br from-emerald-200/60 to-teal-200/40 blur-3xl" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  <path d="M12 11v6" />
                  <path d="M9 14h6" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
                <p className="text-[13px] text-slate-500">
                  {showArchived ? `${archivedCount} archived projects` : `${activeCount} active projects`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className={`group inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium shadow-sm transition-all ${
                showArchived
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/25"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.65 5H8.35a2 2 0 0 0-1.85 1.3L5 10l-2-2" />
                <path d="M3.5 14h6.5" />
                <path d="M3.5 18h6.5" />
                <path d="m21 14-7-1.5V22" />
              </svg>
              {showArchived ? "View Active" : "View Archived"}
              {archivedCount > 0 && !showArchived && (
                <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  {archivedCount}
                </span>
              )}
            </button>
            <Link
              href="/companies"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-[13px] font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              New Project
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-sm">
          <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wide">Total Projects</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{filteredProjects.length}</p>
        </div>
        <div className="rounded-xl border border-sky-200/50 bg-gradient-to-br from-sky-50 to-cyan-50 p-4 shadow-sm">
          <p className="text-[11px] font-medium text-sky-600 uppercase tracking-wide">Total Value</p>
          <p className="mt-1 text-2xl font-bold text-sky-700">{formatMoney(totalValue)}</p>
        </div>
        <div className="rounded-xl border border-violet-200/50 bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow-sm">
          <p className="text-[11px] font-medium text-violet-600 uppercase tracking-wide">In Progress</p>
          <p className="mt-1 text-2xl font-bold text-violet-700">
            {filteredProjects.filter((p) => p.status === "Project Started").length}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
          <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wide">Delivered</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">
            {filteredProjects.filter((p) => p.status === "Project Delivered").length}
          </p>
        </div>
      </div>

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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects, companies..."
            className="h-9 w-56 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-slate-500">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map((status) => (
              <option key={status} value={status!}>
                {status}
              </option>
            ))}
          </select>
        </div>
        {(searchQuery || statusFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("");
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
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-[13px] text-slate-500">Loading projects...</div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {error}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-white/60 p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200">
            <svg className="h-8 w-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="mt-4 text-[15px] font-medium text-slate-700">
            {showArchived ? "No archived projects" : "No projects yet"}
          </p>
          <p className="mt-1 text-[13px] text-slate-500">
            {showArchived
              ? "Archived projects will appear here."
              : "Create your first project from a company page."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-lg hover:shadow-slate-200/50"
            >
              {/* Status gradient bar */}
              <div
                className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${
                  STATUS_COLORS[project.status || ""] || "from-slate-300 to-slate-400"
                }`}
              />
              
              <div className="flex items-start gap-3">
                {/* Company logo */}
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                  {project.company?.logo_url ? (
                    <Image
                      src={project.company.logo_url}
                      alt={project.company.name || "Company"}
                      fill
                      className="object-contain p-1.5"
                    />
                  ) : (
                    <svg className="h-6 w-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 21h18" />
                      <path d="M5 21V7l8-4v18" />
                      <path d="M19 21V11l-6-4" />
                    </svg>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate group-hover:text-emerald-600 transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-[12px] text-slate-500 truncate">
                    {project.company?.name || "No company"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {project.status && (
                  <span
                    className={`inline-flex rounded-full bg-gradient-to-r px-2 py-0.5 text-[10px] font-semibold text-white ${
                      STATUS_COLORS[project.status] || "from-slate-400 to-slate-500"
                    }`}
                  >
                    {project.status}
                  </span>
                )}
                {project.is_archived && (
                  <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Archived
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <span className="text-slate-400">Value</span>
                  <p className="font-semibold text-slate-700">{formatMoney(project.value)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <span className="text-slate-400">Due</span>
                  <p className="font-semibold text-slate-700">{formatDate(project.due_date)}</p>
                </div>
              </div>

              {project.description && (
                <p className="mt-3 text-[12px] text-slate-500 line-clamp-2">
                  {project.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
