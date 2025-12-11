"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";

type AccountClient = {
  id: string;
  company_id: string | null;
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
  notes: string | null;
  created_at: string | null;
};

type AssociatedProject = {
  id: string;
  name: string;
  status: string | null;
};

type ClientDocument = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  document_type: string;
  title: string;
  description: string | null;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by_name: string | null;
  created_at: string;
};

type AdhocRequirement = {
  id: string;
  date_requested: string;
  description: string;
  service_date_start: string | null;
  service_date_end: string | null;
  amount: number;
  currency: string;
  status: string;
  notes: string | null;
  created_at: string;
};

const CONTRACT_LABELS: Record<string, string> = {
  service_based: "Service Based",
  "3_month": "3 Mos",
  "6_month": "6 Mos",
  "12_month": "1 Year",
  project_based: "Project Based",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(amount: number, currency: string = "AED"): string {
  return new Intl.NumberFormat("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + " " + currency;
}

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<AccountClient | null>(null);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [adhocItems, setAdhocItems] = useState<AdhocRequirement[]>([]);
  const [associatedProjects, setAssociatedProjects] = useState<AssociatedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "soa">("overview");

  useEffect(() => {
    if (clientId) loadClient();
  }, [clientId]);

  async function loadClient() {
    try {
      setLoading(true);
      const [clientRes, docsRes, adhocRes, projectsRes] = await Promise.all([
        supabaseClient.from("account_clients").select("*").eq("id", clientId).single(),
        supabaseClient.from("account_client_documents").select("*, projects(name)").eq("client_id", clientId).order("created_at", { ascending: false }),
        supabaseClient.from("account_adhoc_requirements").select("*").eq("client_id", clientId).order("date_requested", { ascending: false }),
        supabaseClient.from("account_client_projects").select("project_id, projects(id, name, status)").eq("account_client_id", clientId),
      ]);

      if (clientRes.data) {
        setClient({
          ...clientRes.data,
          services_signed: Array.isArray(clientRes.data.services_signed) ? clientRes.data.services_signed : [],
          retainer_fee: Number(clientRes.data.retainer_fee) || 0,
          service_based_fee: Number(clientRes.data.service_based_fee) || 0,
          adhoc_fee: Number(clientRes.data.adhoc_fee) || 0,
        });
      }
      // Map documents to include project_name from join
      const docsWithProjects = (docsRes.data || []).map((doc: any) => ({
        ...doc,
        project_name: doc.projects?.name || null,
      }));
      setDocuments(docsWithProjects);
      setAdhocItems((adhocRes.data || []).map((a) => ({ ...a, amount: Number(a.amount) || 0 })));
      
      // Extract associated projects from join query
      const projectsList = (projectsRes.data || []).map((p: any) => p.projects).filter(Boolean);
      setAssociatedProjects(projectsList);
    } catch (err) {
      console.error("Failed to load client:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500" />
          <p className="text-[13px] text-slate-500">Loading client...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <p className="text-slate-500">Client not found</p>
        <Link href="/accounts" className="mt-4 text-teal-600 hover:underline">← Back to Directory</Link>
      </div>
    );
  }

  const totalFees = client.retainer_fee + client.service_based_fee + client.adhoc_fee;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/accounts" className="inline-flex items-center gap-2 text-[13px] text-slate-500 hover:text-teal-600">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to Client Directory
      </Link>

      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gradient-to-br from-teal-100/50 to-emerald-100/30 blur-3xl" />
        
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-2xl font-bold text-white shadow-lg shadow-teal-500/30">
              {client.client_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{client.client_name}</h1>
              <div className="mt-1 flex items-center gap-2">
                {client.industry && (
                  <span className="rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-3 py-0.5 text-[11px] font-semibold text-white">
                    {client.industry}
                  </span>
                )}
                {client.client_type && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-0.5 text-[11px] font-semibold text-amber-700">
                    {client.client_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {[
          { key: "overview", label: "Overview" },
          { key: "documents", label: "Documents" },
          { key: "soa", label: "Statement of Account" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-[13px] font-medium transition-all ${
              activeTab === tab.key
                ? "bg-teal-500 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab client={client} associatedProjects={associatedProjects} />
      )}
      {activeTab === "documents" && (
        <DocumentsTab clientId={clientId} documents={documents} associatedProjects={associatedProjects} onRefresh={loadClient} />
      )}
      {activeTab === "soa" && (
        <SOATab clientId={clientId} client={client} adhocItems={adhocItems} onRefresh={loadClient} />
      )}
    </div>
  );
}

function OverviewTab({ client, associatedProjects }: { client: AccountClient; associatedProjects: AssociatedProject[] }) {
  const totalFees = client.retainer_fee + client.service_based_fee + client.adhoc_fee;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left Column - Key Metadata */}
      <div className="lg:col-span-2 space-y-6">
        {/* Associated Projects */}
        {associatedProjects.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5">
            <h3 className="text-[14px] font-semibold text-emerald-700 mb-4">Associated Projects</h3>
            <div className="flex flex-wrap gap-2">
              {associatedProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[12px] font-medium text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  {project.name}
                  {project.status && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-600">
                      {project.status}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Services */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-[14px] font-semibold text-slate-700 mb-4">Services from Mutant</h3>
          <div className="flex flex-wrap gap-2">
            {client.services_signed.length > 0 ? (
              client.services_signed.map((service, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-[12px] font-medium text-sky-700 border border-sky-200">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {service}
                </span>
              ))
            ) : (
              <span className="text-[13px] text-slate-400">No services assigned</span>
            )}
          </div>
        </div>

        {/* Dates & Contract */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-[14px] font-semibold text-slate-700 mb-4">Dates</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-slate-500">Client Since</span>
                <span className="text-[13px] font-medium text-slate-900">{formatDate(client.client_since)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-slate-500">End Date</span>
                <span className="text-[13px] font-medium text-slate-900">{formatDate(client.end_date)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-slate-500">Invoice Due Every</span>
                <span className="text-[13px] font-medium text-slate-900">{client.invoice_due_day || "—"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-[14px] font-semibold text-slate-700 mb-4">Contract Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-slate-500">Contract Type</span>
                {client.contract_type ? (
                  <span className="rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-3 py-0.5 text-[11px] font-semibold text-white">
                    {CONTRACT_LABELS[client.contract_type] || client.contract_type}
                  </span>
                ) : (
                  <span className="text-[13px] text-slate-400">—</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-slate-500">Category</span>
                <span className="text-[13px] font-medium text-slate-900">
                  {client.client_category === "active_retainer" ? "Active Retainer" : "Project Based"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {client.notes && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-[14px] font-semibold text-slate-700 mb-3">Notes</h3>
            <p className="text-[13px] text-slate-600 whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Right Column - Financial Overview */}
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5">
          <h3 className="text-[14px] font-semibold text-emerald-700 mb-4">Financial Overview</h3>
          <div className="space-y-4">
            <div className="rounded-lg bg-white/80 p-3 border border-emerald-100">
              <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wide">Retainer Fees</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">{formatCurrency(client.retainer_fee, client.currency)}</p>
            </div>
            <div className="rounded-lg bg-white/80 p-3 border border-emerald-100">
              <p className="text-[11px] font-medium text-sky-600 uppercase tracking-wide">Service Based Fees</p>
              <p className="mt-1 text-xl font-bold text-sky-700">{formatCurrency(client.service_based_fee, client.currency)}</p>
            </div>
            <div className="rounded-lg bg-white/80 p-3 border border-emerald-100">
              <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wide">Ad-Hoc Fees</p>
              <p className="mt-1 text-xl font-bold text-amber-700">{formatCurrency(client.adhoc_fee, client.currency)}</p>
            </div>
            <div className="border-t border-emerald-200 pt-3">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Total Monthly</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalFees, client.currency)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({ clientId, documents, associatedProjects, onRefresh }: { clientId: string; documents: ClientDocument[]; associatedProjects: AssociatedProject[]; onRefresh: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [filterProjectId, setFilterProjectId] = useState<string>("all");

  const docTypes = [
    { key: "moa", label: "MOA", icon: "📜", color: "from-violet-500 to-purple-500" },
    { key: "sow", label: "SOWs", icon: "📋", color: "from-sky-500 to-cyan-500" },
    { key: "invoice", label: "Invoices", icon: "📄", color: "from-emerald-500 to-teal-500" },
    { key: "roadmap", label: "Roadmaps", icon: "🗺️", color: "from-amber-500 to-orange-500" },
  ];

  // Filter documents by project
  const filteredDocuments = filterProjectId === "all" 
    ? documents 
    : filterProjectId === "none"
      ? documents.filter(d => !d.project_id)
      : documents.filter(d => d.project_id === filterProjectId);

  // Group documents by project
  const documentsByProject = documents.reduce((acc, doc) => {
    const key = doc.project_id || "unassigned";
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {} as Record<string, ClientDocument[]>);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file") as File;
    const docType = formData.get("document_type") as string;
    const title = (formData.get("title") as string)?.trim();
    const projectId = selectedProjectId || null;

    if (!file || !docType || !title) return;

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `account-documents/${clientId}/${projectId || "general"}/${fileName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseClient.storage.from("documents").getPublicUrl(filePath);

      await supabaseClient.from("account_client_documents").insert({
        client_id: clientId,
        project_id: projectId,
        document_type: docType,
        title,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
      });

      form.reset();
      setSelectedProjectId("");
      setShowUpload(false);
      onRefresh();
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-[15px] font-semibold text-slate-700">Document Repository</h3>
          {/* Project Filter */}
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-black"
          >
            <option value="all">All Projects</option>
            <option value="none">General (No Project)</option>
            {associatedProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-[13px] font-medium text-white shadow-lg shadow-teal-500/25"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload Document
        </button>
      </div>

      {showUpload && (
        <form onSubmit={handleUpload} className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Project *</label>
              <select 
                value={selectedProjectId} 
                onChange={(e) => setSelectedProjectId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-black"
              >
                <option value="">Select project...</option>
                {associatedProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Document Type</label>
              <select name="document_type" required className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-black">
                <option value="">Select type...</option>
                <option value="moa">MOA</option>
                <option value="sow">SOW</option>
                <option value="invoice">Invoice</option>
                <option value="roadmap">Roadmap</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Title</label>
              <input name="title" type="text" required placeholder="Document title" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-black placeholder:text-slate-400" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">File</label>
              <input name="file" type="file" required className="w-full text-[13px] text-black" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowUpload(false)} className="px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={uploading || !selectedProjectId} className="px-4 py-2 text-[13px] bg-teal-500 text-white rounded-lg disabled:opacity-50">
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      )}

      {/* Documents by Project */}
      {associatedProjects.length > 0 && filterProjectId === "all" && (
        <div className="space-y-4">
          {associatedProjects.map((project) => {
            const projectDocs = documentsByProject[project.id] || [];
            return (
              <div key={project.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3">
                  <svg className="h-5 w-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <h4 className="text-[14px] font-semibold text-emerald-700">{project.name}</h4>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                    {projectDocs.length} doc{projectDocs.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {projectDocs.length > 0 ? (
                  <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
                    {projectDocs.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 hover:bg-slate-100 transition-colors"
                      >
                        <span className="text-lg">
                          {docTypes.find(t => t.key === doc.document_type)?.icon || "📎"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium text-slate-700 truncate">{doc.title}</p>
                          <p className="text-[10px] text-slate-400 uppercase">{doc.document_type}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-6 text-center text-[12px] text-slate-400">No documents uploaded for this project</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Document Categories - only show when filtering a specific project */}
      {filterProjectId !== "all" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {docTypes.map((type) => {
            const typeDocs = filteredDocuments.filter((d) => d.document_type === type.key);
            return (
              <div key={type.key} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{type.icon}</span>
                  <h4 className="text-[14px] font-semibold text-slate-700">{type.label}</h4>
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{typeDocs.length}</span>
                </div>
                <div className="space-y-2">
                  {typeDocs.length === 0 ? (
                    <p className="text-[12px] text-slate-400">No documents</p>
                  ) : (
                    typeDocs.slice(0, 3).map((doc) => (
                      <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer" className="block rounded-lg bg-slate-50 p-2 hover:bg-slate-100 transition-colors">
                        <p className="text-[12px] font-medium text-slate-700 truncate">{doc.title}</p>
                        <p className="text-[10px] text-slate-400">{formatDate(doc.created_at)}</p>
                      </a>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All Documents Table */}
      {filteredDocuments.length > 0 && filterProjectId !== "all" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Title</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Project</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Uploaded</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{doc.title}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 uppercase">{doc.document_type}</span>
                  </td>
                  <td className="px-4 py-3">
                    {doc.project_name ? (
                      <span className="text-[12px] text-emerald-600 font-medium">{doc.project_name}</span>
                    ) : (
                      <span className="text-[12px] text-slate-400">General</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(doc.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Download</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {associatedProjects.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-[13px] text-amber-700">No projects associated with this account yet. Associate projects first to upload documents.</p>
        </div>
      )}
    </div>
  );
}

function SOATab({ clientId, client, adhocItems, onRefresh }: { clientId: string; client: AccountClient; adhocItems: AdhocRequirement[]; onRefresh: () => void }) {
  const [showAddAdhoc, setShowAddAdhoc] = useState(false);
  const [saving, setSaving] = useState(false);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonth = new Date().getMonth();
  const displayMonths = months.slice(Math.max(0, currentMonth - 2), currentMonth + 1);

  async function handleAddAdhoc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    setSaving(true);
    try {
      await supabaseClient.from("account_adhoc_requirements").insert({
        client_id: clientId,
        date_requested: formData.get("date_requested"),
        description: formData.get("description"),
        service_date_start: formData.get("service_date_start") || null,
        service_date_end: formData.get("service_date_end") || null,
        amount: parseFloat(formData.get("amount") as string) || 0,
        status: formData.get("status") || "pending",
      });
      form.reset();
      setShowAddAdhoc(false);
      onRefresh();
    } catch (err) {
      console.error("Failed to add ad-hoc:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleExport(format: "pdf" | "excel") {
    const data = {
      client: client.client_name,
      period: `${displayMonths[0]} - ${displayMonths[displayMonths.length - 1]} ${new Date().getFullYear()}`,
      retainer: client.retainer_fee,
      serviceBased: client.service_based_fee,
      adhoc: adhocItems.reduce((sum, a) => sum + a.amount, 0),
      adhocItems,
    };

    if (format === "excel") {
      const csvContent = [
        ["Statement of Account", client.client_name],
        ["Period", data.period],
        [""],
        ["Service", "Amount"],
        ["Retainer Fee", client.retainer_fee],
        ["Service Based Fee", client.service_based_fee],
        ["Ad-Hoc Total", data.adhoc],
        [""],
        ["Ad-Hoc Requirements"],
        ["Date", "Description", "Amount", "Status"],
        ...adhocItems.map((a) => [a.date_requested, a.description, a.amount, a.status]),
      ].map((row) => row.join(",")).join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SOA_${client.client_name}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    }
  }

  const adhocTotal = adhocItems.reduce((sum, a) => sum + a.amount, 0);
  const grandTotal = client.retainer_fee + client.service_based_fee + adhocTotal;

  return (
    <div className="space-y-6">
      {/* Export Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-slate-700">Statement of Account</h3>
        <div className="flex gap-2">
          <button onClick={() => handleExport("excel")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
            <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Export Excel
          </button>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h4 className="text-[13px] font-semibold text-slate-700">Monthly Service Breakdown</h4>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Service</th>
              {displayMonths.map((m) => (
                <th key={m} className="px-4 py-3 text-right font-semibold text-slate-600">{m}</th>
              ))}
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Adjustments</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700 bg-slate-50">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-4 py-3 font-medium text-slate-900">Retainer Fee</td>
              {displayMonths.map((m) => (
                <td key={m} className="px-4 py-3 text-right text-slate-600">{formatCurrency(client.retainer_fee / 3)}</td>
              ))}
              <td className="px-4 py-3 text-right text-slate-400">—</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900 bg-slate-50">{formatCurrency(client.retainer_fee)}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium text-slate-900">Service Based</td>
              {displayMonths.map((m) => (
                <td key={m} className="px-4 py-3 text-right text-slate-600">{formatCurrency(client.service_based_fee / 3)}</td>
              ))}
              <td className="px-4 py-3 text-right text-slate-400">—</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900 bg-slate-50">{formatCurrency(client.service_based_fee)}</td>
            </tr>
            <tr className="bg-emerald-50/50">
              <td className="px-4 py-3 font-bold text-slate-900">Total</td>
              {displayMonths.map((m) => (
                <td key={m} className="px-4 py-3 text-right font-semibold text-slate-700">{formatCurrency((client.retainer_fee + client.service_based_fee) / 3)}</td>
              ))}
              <td className="px-4 py-3 text-right text-slate-400">—</td>
              <td className="px-4 py-3 text-right font-bold text-emerald-700 bg-emerald-100">{formatCurrency(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Ad-Hoc Requirements */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
          <h4 className="text-[13px] font-semibold text-slate-700">Ad-Hoc Requirements</h4>
          <button onClick={() => setShowAddAdhoc(!showAddAdhoc)} className="inline-flex items-center gap-1 text-[12px] font-medium text-teal-600 hover:text-teal-700">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Add Requirement
          </button>
        </div>

        {showAddAdhoc && (
          <form onSubmit={handleAddAdhoc} className="border-b border-slate-100 bg-teal-50/50 p-4">
            <div className="grid gap-4 sm:grid-cols-5">
              <input name="date_requested" type="date" required className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-black" />
              <input name="description" type="text" required placeholder="Description" className="sm:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-black placeholder:text-slate-400" />
              <input name="amount" type="number" step="0.01" placeholder="Amount" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-black placeholder:text-slate-400" />
              <select name="status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-black">
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={() => setShowAddAdhoc(false)} className="px-3 py-1.5 text-[12px] text-slate-600">Cancel</button>
              <button type="submit" disabled={saving} className="px-3 py-1.5 text-[12px] bg-teal-500 text-white rounded-lg disabled:opacity-50">
                {saving ? "Saving..." : "Add"}
              </button>
            </div>
          </form>
        )}

        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Date Requested</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Description</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Service Dates</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Amount</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {adhocItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No ad-hoc requirements</td>
              </tr>
            ) : (
              adhocItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{formatDate(item.date_requested)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.description}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.service_date_start ? `${formatDate(item.service_date_start)} - ${formatDate(item.service_date_end)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(item.amount, item.currency)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      item.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {adhocItems.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={3} className="px-4 py-3 text-right font-semibold text-slate-700">Ad-Hoc Total:</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(adhocTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
