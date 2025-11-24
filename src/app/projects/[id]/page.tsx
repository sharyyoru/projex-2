import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import CollapseSidebarOnMount from "@/components/CollapseSidebarOnMount";
import ProjectModeToggle from "./ProjectModeToggle";
import ProjectNotesTasksCard from "./ProjectNotesTasksCard";
import ProjectAdminCockpit from "./ProjectAdminCockpit";
import ProjectActivityFeed from "./ProjectActivityFeed";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

type Mode = "operations" | "admin";

type AdminTab =
  | "cockpit"
  | "notes"
  | "invoice"
  | "file"
  | "photo"
  | "project_information"
  | "documents";

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
};

type CompanySummary = {
  id: string;
  name: string | null;
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
        "id, company_id, primary_contact_id, name, description, status, processed_outcome, pipeline, value, start_date, due_date, created_at",
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
        .select("id, name")
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
    rawAdminTab === "cockpit" ||
    rawAdminTab === "notes" ||
    rawAdminTab === "invoice" ||
    rawAdminTab === "file" ||
    rawAdminTab === "photo" ||
    rawAdminTab === "project_information" ||
    rawAdminTab === "documents"
      ? (rawAdminTab as AdminTab)
      : "cockpit";

  const adminTabs: { id: AdminTab; label: string }[] = [
    { id: "cockpit", label: "Cockpit" },
    { id: "notes", label: "Notes" },
    { id: "invoice", label: "Invoice" },
    { id: "file", label: "File" },
    { id: "photo", label: "Photo" },
    { id: "project_information", label: "Project Information" },
    { id: "documents", label: "Documents" },
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
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <h2 className="text-sm font-semibold text-slate-900">Project details</h2>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-slate-600 sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-500">Status</dt>
                  <dd className="text-slate-900">{statusDisplay ?? "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Pipeline</dt>
                  <dd className="text-slate-900">{project.pipeline ?? "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Value (approx.)</dt>
                  <dd className="text-slate-900">{formatMoney(project.value)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Start date</dt>
                  <dd className="text-slate-900">{formatDate(project.start_date)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Target date</dt>
                  <dd className="text-slate-900">{formatDate(project.due_date)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Created at</dt>
                  <dd className="text-slate-900">{formatDate(project.created_at)}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <dt className="text-[11px] font-medium text-slate-500">Description</dt>
                <dd className="mt-1 text-[11px] text-slate-700">
                  {project.description && project.description.trim().length > 0
                    ? project.description
                    : "No description yet."}
                </dd>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <h2 className="text-sm font-semibold text-slate-900">Context</h2>
              <div className="mt-3 space-y-3 text-[11px] text-slate-600">
                {company ? (
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">Company</p>
                    <p className="text-slate-900">{company.name ?? "Unnamed"}</p>
                  </div>
                ) : null}
                {primaryContact ? (
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">Primary contact</p>
                    <p className="text-slate-900">
                      {formatFullName(primaryContact.first_name, primaryContact.last_name)}
                    </p>
                    <p className="text-slate-500">
                      {[primaryContact.job_title, primaryContact.email]
                        .filter(Boolean)
                        .join(" • ") || "—"}
                    </p>
                  </div>
                ) : null}
                {!company && !primaryContact ? (
                  <p className="text-slate-500">
                    This project is not linked to a company or contact yet.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <ProjectNotesTasksCard projectId={project.id} />
        </>
      ) : (
        <div className="space-y-6">
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex flex-wrap gap-4 text-xs font-medium text-slate-500">
              {adminTabs.map((tab) => {
                const isActive = tab.id === adminTab;
                return (
                  <Link
                    key={tab.id}
                    href={`/projects/${project.id}?mode=admin&tab=${tab.id}`}
                    className={
                      (isActive
                        ? "border-sky-500 text-sky-600"
                        : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700") +
                      " inline-flex items-center border-b-2 px-1.5 py-1"
                    }
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {adminTab === "cockpit" ? (
            <div className="space-y-4">
              <ProjectAdminCockpit projectId={project.id} />
              <ProjectActivityFeed projectId={project.id} />
            </div>
          ) : null}

          {adminTab === "notes" ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
              <p className="mt-2 text-xs text-slate-500">
                Notes for this project will appear here. You can extend this area with
                a notes timeline or comment system.
              </p>
            </div>
          ) : null}

          {adminTab === "invoice" ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <h3 className="text-sm font-semibold text-slate-900">Invoice</h3>
              <p className="mt-2 text-xs text-slate-500">
                Project-level invoicing can be surfaced here. For now this shows only
                the approximate project value.
              </p>
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-[11px]">
                <p className="font-medium text-slate-500">Estimated project value</p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {formatMoney(project.value)}
                </p>
              </div>
            </div>
          ) : null}

          {adminTab === "file" ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <h3 className="text-sm font-semibold text-slate-900">File</h3>
              <p className="mt-2 text-xs text-slate-500">
                Project files and admin documents can be shown here in a future
                iteration.
              </p>
            </div>
          ) : null}

          {adminTab === "photo" ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <h3 className="text-sm font-semibold text-slate-900">Photo</h3>
              <p className="mt-2 text-xs text-slate-500">
                Photos related to this project will appear here.
              </p>
            </div>
          ) : null}

          {adminTab === "project_information" ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <h3 className="text-sm font-semibold text-slate-900">Project information</h3>
              <p className="mt-2 text-xs text-slate-500">
                Additional structured information about this project can be modelled
                here.
              </p>
            </div>
          ) : null}

          {adminTab === "documents" ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <h3 className="text-sm font-semibold text-slate-900">Documents</h3>
              <p className="mt-2 text-xs text-slate-500">
                Documents associated with this project can be listed here.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
