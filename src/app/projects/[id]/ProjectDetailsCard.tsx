"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type ProjectDetails = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  processed_outcome: string | null;
  pipeline: string | null;
  value: number | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string | null;
  is_archived?: boolean;
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

const STATUS_OPTIONS = [
  "New Lead",
  "Processed",
  "Discovery",
  "Proposal",
  "Quotation",
  "Invoice",
  "Project Started",
  "Project Delivered",
  "Closed",
  "Abandoned",
];

export default function ProjectDetailsCard({
  project,
}: {
  project: ProjectDetails;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Form state
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [status, setStatus] = useState(project.status || "");
  const [pipeline, setPipeline] = useState(project.pipeline || "");
  const [value, setValue] = useState(project.value?.toString() || "");
  const [startDate, setStartDate] = useState(project.start_date?.split("T")[0] || "");
  const [dueDate, setDueDate] = useState(project.due_date?.split("T")[0] || "");

  const isArchived = project.is_archived ?? false;

  const statusDisplay = (() => {
    if (project.status === "Processed" && project.processed_outcome) {
      return `Processed (${project.processed_outcome})`;
    }
    return project.status;
  })();

  async function handleSave() {
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabaseClient
        .from("projects")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          status: status || null,
          pipeline: pipeline.trim() || null,
          value: value ? Number(value) : null,
          start_date: startDate || null,
          due_date: dueDate || null,
        })
        .eq("id", project.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setIsEditing(false);
      setSaving(false);
      router.refresh();
    } catch {
      setError("Failed to save changes.");
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    setArchiving(true);
    setError(null);

    try {
      const { error: updateError } = await supabaseClient
        .from("projects")
        .update({ is_archived: !isArchived })
        .eq("id", project.id);

      if (updateError) {
        setError(updateError.message);
        setArchiving(false);
        return;
      }

      setArchiving(false);
      router.refresh();
    } catch {
      setError("Failed to update archive status.");
      setArchiving(false);
    }
  }

  function handleCancel() {
    setName(project.name);
    setDescription(project.description || "");
    setStatus(project.status || "");
    setPipeline(project.pipeline || "");
    setValue(project.value?.toString() || "");
    setStartDate(project.start_date?.split("T")[0] || "");
    setDueDate(project.due_date?.split("T")[0] || "");
    setError(null);
    setIsEditing(false);
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/80 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-sky-100/50 to-violet-100/30 blur-2xl" />
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-violet-500 shadow-lg shadow-sky-500/25">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" x2="8" y1="13" y2="13" />
                <line x1="16" x2="8" y1="17" y2="17" />
                <line x1="10" x2="8" y1="9" y2="9" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Project details</h2>
            {isArchived && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Archived
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleArchiveToggle}
                  disabled={archiving}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium shadow-sm transition-all disabled:opacity-50 ${
                    isArchived
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  }`}
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {isArchived ? (
                      <>
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="m9 14 2 2 4-4" />
                      </>
                    ) : (
                      <>
                        <rect x="2" y="4" width="20" height="5" rx="2" />
                        <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
                        <path d="M10 13h4" />
                      </>
                    )}
                  </svg>
                  {archiving ? "..." : isArchived ? "Unarchive" : "Archive"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-sky-500 to-violet-500 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg shadow-sky-500/25 hover:shadow-xl disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-600">
            {error}
          </div>
        )}

        {/* Content */}
        {!isEditing ? (
          <>
            <dl className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="rounded-lg bg-slate-50/80 p-2.5">
                <dt className="font-medium text-slate-400 uppercase tracking-wide text-[9px]">Status</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{statusDisplay ?? "—"}</dd>
              </div>
              <div className="rounded-lg bg-slate-50/80 p-2.5">
                <dt className="font-medium text-slate-400 uppercase tracking-wide text-[9px]">Pipeline</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{project.pipeline ?? "—"}</dd>
              </div>
              <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-2.5">
                <dt className="font-medium text-emerald-600 uppercase tracking-wide text-[9px]">Value</dt>
                <dd className="mt-0.5 font-bold text-emerald-700">{formatMoney(project.value)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50/80 p-2.5">
                <dt className="font-medium text-slate-400 uppercase tracking-wide text-[9px]">Start</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{formatDate(project.start_date)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50/80 p-2.5">
                <dt className="font-medium text-slate-400 uppercase tracking-wide text-[9px]">Target</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{formatDate(project.due_date)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50/80 p-2.5">
                <dt className="font-medium text-slate-400 uppercase tracking-wide text-[9px]">Created</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{formatDate(project.created_at)}</dd>
              </div>
            </dl>
            <div className="mt-4 rounded-lg border border-slate-100 bg-white/60 p-3">
              <dt className="text-[9px] font-medium text-slate-400 uppercase tracking-wide">Description</dt>
              <dd className="mt-1 text-[11px] text-slate-700 leading-relaxed">
                {project.description && project.description.trim().length > 0
                  ? project.description
                  : "No description yet."}
              </dd>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {/* Name */}
            <div>
              <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                Project Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Status */}
              <div>
                <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="">Select status</option>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Pipeline */}
              <div>
                <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Pipeline
                </label>
                <input
                  type="text"
                  value={pipeline}
                  onChange={(e) => setPipeline(e.target.value)}
                  placeholder="New Strategy"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Value */}
              <div>
                <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Value (AED)
                </label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  min="0"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
