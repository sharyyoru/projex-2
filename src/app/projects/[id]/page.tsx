import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import CollapseSidebarOnMount from "@/components/CollapseSidebarOnMount";
import ProjectModeToggle from "./ProjectModeToggle";
import ProjectNotesTasksCard from "./ProjectNotesTasksCard";
import ProjectContextCard from "./ProjectContextCard";
import ProjectDetailsCard from "./ProjectDetailsCard";
import InvoiceManagement from "./InvoiceManagement";
import ProjectWorkflows from "./ProjectWorkflows";
import ProjectDanoteButton from "./ProjectDanoteButton";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

type Mode = "operations" | "admin";

type AdminTab = "cockpit" | "invoice" | "workflows";

type ProjectRow = {
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
  is_archived: boolean;
};

type CompanySummary = {
  id: string;
  name: string | null;
  logo_url: string | null;
};

type ContactSummary = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
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

function formatFullName(first: string | null, last: string | null): string {
  return [first ?? "", last ?? ""].join(" ").trim();
}

async function getProjectWithRelations(id: string): Promise<{
  project: ProjectRow | null;
  company: CompanySummary | null;
  primaryContact: ContactSummary | null;
}> {
  try {
    const { data: project, error } = await supabaseClient
      .from("projects")
      .select(
        "id, company_id, primary_contact_id, name, description, status, processed_outcome, pipeline, value, start_date, due_date, created_at, is_archived",
      )
      .eq("id", id)
      .single();

    if (error || !project) {
      return { project: null, company: null, primaryContact: null };
    }

    const projectAny = project as any;

    let company: CompanySummary | null = null;
    const companyId = projectAny.company_id as string | null | undefined;
    if (companyId) {
      const { data: companyData } = await supabaseClient
        .from("companies")
        .select("id, name, logo_url")
        .eq("id", companyId)
        .maybeSingle();

      if (companyData) {
        company = companyData as CompanySummary;
      }
    }

    let primaryContact: ContactSummary | null = null;
    const primaryContactId = projectAny.primary_contact_id as string | null | undefined;
    if (primaryContactId) {
      const { data: contactData } = await supabaseClient
        .from("contacts")
        .select("id, first_name, last_name, email, phone, job_title")
        .eq("id", primaryContactId)
        .maybeSingle();

      if (contactData) {
        primaryContact = contactData as ContactSummary;
      }
    }

    return {
      project: project as ProjectRow,
      company,
      primaryContact,
    };
  } catch {
    return { project: null, company: null, primaryContact: null };
  }
}

export default async function ProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const { project, company, primaryContact } = await getProjectWithRelations(id);

  if (!project) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 shadow-sm">
        Project not found.
      </div>
    );
  }

  const rawMode = (() => {
    const value = resolvedSearchParams?.mode;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0) return value[0];
    return undefined;
  })();

  const mode: Mode = rawMode === "admin" ? "admin" : "operations";

  const rawAdminTab = (() => {
    const value = resolvedSearchParams?.tab;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0) return value[0];
    return undefined;
  })();

  const adminTab: AdminTab =
    rawAdminTab === "cockpit" || rawAdminTab === "invoice" || rawAdminTab === "workflows"
      ? (rawAdminTab as AdminTab)
      : "cockpit";

  const adminTabs: { id: AdminTab; label: string }[] = [
    { id: "cockpit", label: "Cockpit" },
    { id: "invoice", label: "Quotes & Invoices" },
    { id: "workflows", label: "Workflows" },
  ];

  const statusDisplay = (() => {
    if (project.status === "Processed" && project.processed_outcome) {
      return `Processed (${project.processed_outcome})`;
    }
    return project.status;
  })();

  return (
    <div className="space-y-6">
      <CollapseSidebarOnMount />
      <div className="relative">
        <div className="relative z-10 flex items-baseline justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-slate-900">{project.name}</h1>
              <ProjectModeToggle projectId={project.id} mode={mode} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
              {statusDisplay ? (
                <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-50">
                  <span className="opacity-80">Status</span>
                  <span className="ml-1 font-semibold">{statusDisplay}</span>
                </span>
              ) : null}
              {project.pipeline ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  Pipeline: {project.pipeline}
                </span>
              ) : null}
              {company ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  Company: {company.name ?? "Unnamed"}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ProjectDanoteButton projectId={project.id} projectName={project.name} />
            {company ? (
              <Link
                href={`/companies/${company.id}`}
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
                <span>Company</span>
              </Link>
            ) : null}
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
          <div
            className={`${mode === "admin" ? "medical-glow" : "crm-glow"} h-full w-full`}
          />
        </div>
      </div>

      {mode === "operations" ? (
        <>
          <div className="grid items-stretch gap-6 md:grid-cols-2">
            {/* Enhanced Project Details Card - Editable */}
            <ProjectDetailsCard project={project} />

            {/* Enhanced Context Card */}
            <ProjectContextCard
              projectId={project.id}
              company={company}
              primaryContact={primaryContact}
            />
          </div>

          <ProjectNotesTasksCard projectId={project.id} />
        </>
      ) : (
        <div className="space-y-5">
          {/* Admin Mode Header Bar */}
          <div className="rounded-lg border border-slate-300/80 bg-gradient-to-r from-slate-50 to-slate-100/80 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-white shadow-sm">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Administrative Panel</h2>
                  <p className="text-[10px] text-slate-500">Manage financials, documents, and administrative records</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-500">
                <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-600">Admin Mode</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation - More Formal Style */}
          <div className="rounded-lg border border-slate-200/80 bg-white shadow-sm">
            <nav className="flex flex-wrap border-b border-slate-200 px-2">
              {adminTabs.map((tab) => {
                const isActive = tab.id === adminTab;
                return (
                  <Link
                    key={tab.id}
                    href={`/projects/${project.id}?mode=admin&tab=${tab.id}`}
                    className={
                      (isActive
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-800") +
                      " relative inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[11px] font-semibold tracking-wide transition-all"
                    }
                    style={isActive ? { borderRadius: '6px 6px 0 0', marginBottom: '-1px' } : {}}
                  >
                    {tab.id === "cockpit" && (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    )}
                    {tab.id === "invoice" && (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <path d="M2 10h20" />
                      </svg>
                    )}
                    {tab.label}
                  </Link>
                );
              })}
            </nav>

            {/* Tab Content Area */}
            <div className="p-4">
              {adminTab === "cockpit" ? (
                <ProjectNotesTasksCard projectId={project.id} source="admin" />
              ) : null}

              {adminTab === "invoice" ? (
                <InvoiceManagement 
                  projectId={project.id} 
                  projectName={project.name}
                />
              ) : null}

              {adminTab === "workflows" ? (
                <ProjectWorkflows projectId={project.id} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
