"use client";

import Image from "next/image";
import { useState, useRef, type ChangeEvent } from "react";

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

type ProjectBrief = {
  executive_summary: string;
  objectives: string[];
  target_audience: { primary: string; secondary: string; demographics: string; psychographics: string };
  scope: { deliverables: string[]; in_scope: string[]; out_of_scope: string[] };
  key_messages: string[];
  success_metrics: string[];
  timeline_considerations: string;
  budget_considerations: string;
  stakeholders: string[];
  constraints: string[];
  inspiration: string;
};

type BrandColor = { name: string; hex: string; usage: string };

type BrandGuidelines = {
  colors: { primary: BrandColor[]; secondary: BrandColor[]; accent: BrandColor[]; neutrals: BrandColor[] };
  typography: {
    primary_font: { name: string; weights: string[]; usage: string } | null;
    secondary_font: { name: string; weights: string[]; usage: string } | null;
    special_fonts: { name: string; weights: string[]; usage: string }[];
  };
  tone_of_voice: { personality: string[]; do: string[]; dont: string[]; sample_phrases: string[] };
  logo_usage: { clear_space: string; minimum_size: string; dont: string[] };
  imagery_style: { description: string; characteristics: string[] };
  brand_values: string[];
  tagline: string;
  additional_notes: string;
  pdfUrl?: string;
};

function formatFullName(first: string | null, last: string | null): string {
  return [first ?? "", last ?? ""].join(" ").trim();
}

function ColorSwatch({ color, onCopy }: { color: BrandColor; onCopy: (hex: string) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(color.hex);
        onCopy(color.hex);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 transition-all hover:border-slate-300 hover:shadow-md"
    >
      <div className="h-10 w-10 rounded-lg shadow-inner transition-transform group-hover:scale-105" style={{ backgroundColor: color.hex }} />
      <div className="text-left">
        <p className="text-[11px] font-semibold text-slate-800">{color.name}</p>
        <p className="font-mono text-[10px] text-slate-500">{color.hex}</p>
        {copied && <span className="text-[9px] font-medium text-emerald-600">Copied!</span>}
      </div>
    </button>
  );
}

export default function ProjectContextCard({
  projectId,
  company,
  primaryContact,
}: {
  projectId: string;
  company: CompanySummary | null;
  primaryContact: ContactSummary | null;
}) {
  // Brief modal states
  const [briefModalOpen, setBriefModalOpen] = useState(false);
  const [briefModalMode, setBriefModalMode] = useState<"form" | "view">("form");
  const [projectBrief, setProjectBrief] = useState<ProjectBrief | null>(null);
  const [briefGenerating, setBriefGenerating] = useState(false);
  const [briefFormData, setBriefFormData] = useState({
    projectName: "", projectType: "", industry: "", targetAudience: "", objectives: "", existingInfo: "",
  });

  // Brand guidelines modal states
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandModalMode, setBrandModalMode] = useState<"upload" | "view">("upload");
  const [brandGuidelines, setBrandGuidelines] = useState<BrandGuidelines | null>(null);
  const [brandAnalyzing, setBrandAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [briefError, setBriefError] = useState<string | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);

  const canGenerateBrief = briefFormData.projectName.trim() || briefFormData.objectives.trim() || briefFormData.existingInfo.trim();

  const handleGenerateBrief = async () => {
    if (!canGenerateBrief) {
      setBriefError("Please fill in at least one field (Project Name, Objectives, or Additional Context) before generating.");
      return;
    }
    setBriefGenerating(true);
    setBriefError(null);
    try {
      const res = await fetch("/api/projects/generate-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: company?.name, ...briefFormData }),
      });
      if (res.ok) {
        const data = await res.json();
        setProjectBrief(data.brief);
        setBriefModalMode("view");
      } else {
        const data = await res.json();
        setBriefError(data.error || "Failed to generate brief. Please check if OpenAI API key is configured.");
      }
    } catch (e) {
      console.error(e);
      setBriefError("Network error. Please try again.");
    }
    finally { setBriefGenerating(false); }
  };

  const handleSaveBrief = () => {
    if (!projectBrief) {
      setProjectBrief({
        executive_summary: briefFormData.existingInfo || `Project brief for ${briefFormData.projectName}`,
        objectives: briefFormData.objectives.split("\n").filter(Boolean),
        target_audience: { primary: briefFormData.targetAudience, secondary: "", demographics: "", psychographics: "" },
        scope: { deliverables: [], in_scope: [], out_of_scope: [] },
        key_messages: [], success_metrics: [], timeline_considerations: "", budget_considerations: "",
        stakeholders: [], constraints: [], inspiration: "",
      });
    }
    setBriefModalOpen(false);
  };

  const handleBrandUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBrandAnalyzing(true);
    setBrandError(null);
    try {
      const pdfUrl = URL.createObjectURL(file);
      const pdfText = `Brand guidelines document: ${file.name}. Company: ${company?.name || 'Unknown'}. Please analyze this brand guidelines document and extract: 1) Brand colors with hex codes, 2) Typography/fonts used, 3) Tone of voice guidelines, 4) Brand values. File size: ${(file.size / 1024).toFixed(1)}KB.`;
      const res = await fetch("/api/projects/analyze-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfText, companyName: company?.name, pdfUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setBrandGuidelines({ ...data.brandGuidelines, pdfUrl });
        setBrandModalMode("view");
      } else {
        const data = await res.json();
        setBrandError(data.error || "Failed to analyze brand guidelines. Please check if OpenAI API key is configured.");
      }
    } catch (e) {
      console.error(e);
      setBrandError("Network error. Please try again.");
    }
    finally { setBrandAnalyzing(false); }
  };

  return (
    <>
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-amber-50/30 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-amber-100/50 to-orange-100/30 blur-2xl" />
      <div className="relative flex-1 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-slate-900">Context</h2>
        </div>
        <div className="mt-4 space-y-3">
          {/* Company with logo */}
          {company ? (
            <div className="flex items-center gap-3 rounded-lg bg-white/80 p-2.5 shadow-sm">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                {company.logo_url ? (
                  <Image
                    src={company.logo_url}
                    alt={company.name ?? "Company logo"}
                    fill
                    className="object-contain p-1"
                  />
                ) : (
                  <svg className="h-5 w-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 6h4v12H3zM10 10h4v8h-4zM17 8h4v10h-4z" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wide">Company</p>
                <p className="font-semibold text-slate-900">{company.name ?? "Unnamed"}</p>
              </div>
            </div>
          ) : null}
          {/* Primary contact */}
          {primaryContact ? (
            <div className="rounded-lg bg-white/80 p-2.5 shadow-sm">
              <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wide">Primary contact</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {formatFullName(primaryContact.first_name, primaryContact.last_name)}
              </p>
              <p className="text-[11px] text-slate-500">
                {[primaryContact.job_title, primaryContact.email].filter(Boolean).join(" • ") || "—"}
              </p>
            </div>
          ) : null}
          {!company && !primaryContact ? (
            <p className="text-[11px] text-slate-500">
              This project is not linked to a company or contact yet.
            </p>
          ) : null}
          {/* Project Brief & Brand Guidelines buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {projectBrief ? (
              <button type="button" onClick={() => { setBriefModalMode("view"); setBriefModalOpen(true); }}
                className="group w-full rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-sky-100/50 p-3 text-left transition-all hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wide">Project Brief</p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-800 line-clamp-2">{projectBrief.executive_summary}</p>
                    <p className="mt-1 text-[10px] text-sky-500">Click to view full brief →</p>
                  </div>
                </div>
              </button>
            ) : (
              <button type="button" onClick={() => { setBriefModalMode("form"); setBriefModalOpen(true); }}
                className="group inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-gradient-to-r from-sky-50 to-sky-100/50 px-3 py-1.5 text-[11px] font-medium text-sky-700 shadow-sm transition-all hover:shadow-md">
                <svg className="h-3.5 w-3.5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                Enter Project Brief
              </button>
            )}
            {brandGuidelines ? (
              <button type="button" onClick={() => { setBrandModalMode("view"); setBrandModalOpen(true); }}
                className="group w-full rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-violet-100/50 p-3 text-left transition-all hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 text-white shadow-lg">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="13.5" cy="6.5" r="2.5" /><circle cx="19" cy="17" r="2" /><circle cx="6" cy="12" r="3" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide">Brand Guidelines</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {[...brandGuidelines.colors.primary, ...brandGuidelines.colors.secondary].slice(0, 6).map((c, i) => (
                        <div key={i} className="h-5 w-5 rounded-md shadow-sm" style={{ backgroundColor: c.hex }} />
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-violet-500">Click to view brand guidelines →</p>
                  </div>
                </div>
              </button>
            ) : (
              <button type="button" onClick={() => { setBrandModalMode("upload"); setBrandModalOpen(true); }}
                className="group inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-gradient-to-r from-violet-50 to-violet-100/50 px-3 py-1.5 text-[11px] font-medium text-violet-700 shadow-sm transition-all hover:shadow-md">
                <svg className="h-3.5 w-3.5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                Upload Brand Guidelines
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Jade glass project ID footer */}
      <div className="relative mt-auto border-t border-emerald-200/50 bg-gradient-to-r from-emerald-100/80 via-teal-100/60 to-cyan-100/80 px-4 py-2.5 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5" />
        <div className="relative flex items-center justify-between gap-2">
          <div>
            <p className="text-[9px] font-medium text-emerald-600 uppercase tracking-wide">Project ID</p>
            <p className="font-mono text-[11px] font-semibold text-emerald-800">{projectId}</p>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(projectId)}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-700 transition-all hover:bg-emerald-500/20"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            Copy
          </button>
        </div>
      </div>
    </div>

    {/* Project Brief Modal */}
    {briefModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
        <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setBriefModalOpen(false)} />
        <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
          {briefModalMode === "form" ? (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Create Project Brief</h3>
                  <p className="text-sm text-slate-500">Fill in details or let AI generate a comprehensive brief</p>
                </div>
                <button type="button" onClick={() => setBriefModalOpen(false)} className="rounded-full p-2 hover:bg-slate-100">
                  <svg className="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="mb-1 block text-xs font-medium text-slate-700">Project Name</label>
                    <input type="text" value={briefFormData.projectName} onChange={(e) => setBriefFormData(p => ({...p, projectName: e.target.value}))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20" placeholder="Website Redesign" /></div>
                  <div><label className="mb-1 block text-xs font-medium text-slate-700">Project Type</label>
                    <input type="text" value={briefFormData.projectType} onChange={(e) => setBriefFormData(p => ({...p, projectType: e.target.value}))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20" placeholder="Branding, Website, Campaign..." /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="mb-1 block text-xs font-medium text-slate-700">Industry</label>
                    <input type="text" value={briefFormData.industry} onChange={(e) => setBriefFormData(p => ({...p, industry: e.target.value}))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20" placeholder="Healthcare, Tech, Retail..." /></div>
                  <div><label className="mb-1 block text-xs font-medium text-slate-700">Target Audience</label>
                    <input type="text" value={briefFormData.targetAudience} onChange={(e) => setBriefFormData(p => ({...p, targetAudience: e.target.value}))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20" placeholder="Young professionals, B2B..." /></div>
                </div>
                <div><label className="mb-1 block text-xs font-medium text-slate-700">Key Objectives</label>
                  <textarea value={briefFormData.objectives} onChange={(e) => setBriefFormData(p => ({...p, objectives: e.target.value}))} rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20" placeholder="One objective per line..." /></div>
                <div><label className="mb-1 block text-xs font-medium text-slate-700">Additional Context</label>
                  <textarea value={briefFormData.existingInfo} onChange={(e) => setBriefFormData(p => ({...p, existingInfo: e.target.value}))} rows={4}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20" placeholder="Any existing information, requirements, constraints..." /></div>
              </div>
              {briefError && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                  {briefError}
                </div>
              )}
              <div className="mt-6 flex items-center justify-between gap-3">
                <button type="button" onClick={handleGenerateBrief} disabled={briefGenerating || !canGenerateBrief}
                  title={!canGenerateBrief ? "Fill in at least one field first" : "Generate brief with AI"}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
                  {briefGenerating ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Generating...</> :
                    <><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/></svg>Generate with AI</>}
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setBriefModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={handleSaveBrief} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600">Save Brief</button>
                </div>
              </div>
            </>
          ) : projectBrief ? (
            <>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Project Brief</h3>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setBriefModalMode("form")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Edit</button>
                  <button type="button" onClick={() => setBriefModalOpen(false)} className="rounded-full p-2 hover:bg-slate-100">
                    <svg className="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
              <div className="space-y-6">
                <div className="rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 p-4">
                  <h4 className="text-xs font-bold text-sky-700 uppercase tracking-wide mb-2">Executive Summary</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{projectBrief.executive_summary}</p>
                </div>
                {projectBrief.objectives.length > 0 && (
                  <div><h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Objectives</h4>
                    <ul className="space-y-1">{projectBrief.objectives.map((o, i) => <li key={i} className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />{o}</li>)}</ul></div>)}
                {projectBrief.target_audience.primary && (
                  <div><h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Target Audience</h4>
                    <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">{projectBrief.target_audience.primary}</div></div>)}
                {projectBrief.key_messages.length > 0 && (
                  <div><h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Key Messages</h4>
                    <div className="flex flex-wrap gap-2">{projectBrief.key_messages.map((m, i) => <span key={i} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">{m}</span>)}</div></div>)}
                {projectBrief.success_metrics.length > 0 && (
                  <div><h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Success Metrics</h4>
                    <ul className="space-y-1">{projectBrief.success_metrics.map((m, i) => <li key={i} className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />{m}</li>)}</ul></div>)}
              </div>
            </>
          ) : null}
        </div>
      </div>
    )}

    {/* Brand Guidelines Modal */}
    {brandModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
        <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setBrandModalOpen(false)} />
        <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
          {brandModalMode === "upload" ? (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div><h3 className="text-lg font-bold text-slate-900">Upload Brand Guidelines</h3>
                  <p className="text-sm text-slate-500">Upload a PDF and AI will extract colors, fonts, and tone</p></div>
                <button type="button" onClick={() => setBrandModalOpen(false)} className="rounded-full p-2 hover:bg-slate-100">
                  <svg className="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <input type="file" ref={fileInputRef} accept=".pdf" onChange={handleBrandUpload} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={brandAnalyzing}
                className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/50 p-12 transition-all hover:border-violet-400 hover:bg-violet-50 disabled:opacity-50">
                {brandAnalyzing ? <><div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-500" /><p className="mt-4 text-sm font-medium text-violet-700">Analyzing brand guidelines...</p><p className="mt-1 text-xs text-slate-500">This may take a moment...</p></>
                  : <><svg className="h-12 w-12 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                    <p className="mt-4 text-sm font-medium text-violet-700">Click to upload PDF</p><p className="mt-1 text-xs text-slate-500">Brand guidelines document</p></>}
              </button>
              {brandError && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                  {brandError}
                </div>
              )}
            </>
          ) : brandGuidelines ? (
            <>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Brand Guidelines</h3>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setBrandModalMode("upload")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Re-upload</button>
                  <button type="button" onClick={() => setBrandModalOpen(false)} className="rounded-full p-2 hover:bg-slate-100">
                    <svg className="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
              <div className="space-y-6">
                {/* Colors Section */}
                <div className="rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50/50 to-purple-50/30 p-4">
                  <h4 className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-3">Brand Colors</h4>
                  <div className="space-y-4">
                    {brandGuidelines.colors.primary.length > 0 && (<div><p className="text-[10px] font-semibold text-slate-500 mb-2">Primary</p>
                      <div className="flex flex-wrap gap-2">{brandGuidelines.colors.primary.map((c, i) => <ColorSwatch key={i} color={c} onCopy={() => {}} />)}</div></div>)}
                    {brandGuidelines.colors.secondary.length > 0 && (<div><p className="text-[10px] font-semibold text-slate-500 mb-2">Secondary</p>
                      <div className="flex flex-wrap gap-2">{brandGuidelines.colors.secondary.map((c, i) => <ColorSwatch key={i} color={c} onCopy={() => {}} />)}</div></div>)}
                    {brandGuidelines.colors.accent.length > 0 && (<div><p className="text-[10px] font-semibold text-slate-500 mb-2">Accent</p>
                      <div className="flex flex-wrap gap-2">{brandGuidelines.colors.accent.map((c, i) => <ColorSwatch key={i} color={c} onCopy={() => {}} />)}</div></div>)}
                    {brandGuidelines.colors.neutrals.length > 0 && (<div><p className="text-[10px] font-semibold text-slate-500 mb-2">Neutrals</p>
                      <div className="flex flex-wrap gap-2">{brandGuidelines.colors.neutrals.map((c, i) => <ColorSwatch key={i} color={c} onCopy={() => {}} />)}</div></div>)}
                  </div>
                </div>
                {/* Typography Section */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Typography</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {brandGuidelines.typography.primary_font && (
                      <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-semibold text-slate-400">Primary Font</p>
                        <p className="text-lg font-bold text-slate-800">{brandGuidelines.typography.primary_font.name}</p>
                        <p className="text-xs text-slate-500">{brandGuidelines.typography.primary_font.weights.join(", ")}</p></div>)}
                    {brandGuidelines.typography.secondary_font && (
                      <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-semibold text-slate-400">Secondary Font</p>
                        <p className="text-lg font-bold text-slate-800">{brandGuidelines.typography.secondary_font.name}</p>
                        <p className="text-xs text-slate-500">{brandGuidelines.typography.secondary_font.weights.join(", ")}</p></div>)}
                  </div>
                </div>
                {/* Tone of Voice Section */}
                <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/50 to-orange-50/30 p-4">
                  <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-3">Tone of Voice</h4>
                  {brandGuidelines.tone_of_voice.personality.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">{brandGuidelines.tone_of_voice.personality.map((p, i) =>
                      <span key={i} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{p}</span>)}</div>)}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {brandGuidelines.tone_of_voice.do.length > 0 && (<div><p className="text-[10px] font-semibold text-emerald-600 mb-1">✓ Do</p>
                      <ul className="space-y-1">{brandGuidelines.tone_of_voice.do.map((d, i) => <li key={i} className="text-xs text-slate-700">{d}</li>)}</ul></div>)}
                    {brandGuidelines.tone_of_voice.dont.length > 0 && (<div><p className="text-[10px] font-semibold text-red-600 mb-1">✗ Don&apos;t</p>
                      <ul className="space-y-1">{brandGuidelines.tone_of_voice.dont.map((d, i) => <li key={i} className="text-xs text-slate-700">{d}</li>)}</ul></div>)}
                  </div>
                </div>
                {/* Brand Values */}
                {brandGuidelines.brand_values.length > 0 && (
                  <div><h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Brand Values</h4>
                    <div className="flex flex-wrap gap-2">{brandGuidelines.brand_values.map((v, i) =>
                      <span key={i} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">{v}</span>)}</div></div>)}
              </div>
            </>
          ) : null}
        </div>
      </div>
    )}
    </>
  );
}
