"use client";

import { useState, useEffect, useRef } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import MentionTextarea, { NoteBodyWithMentions, extractMentionedUserIds } from "@/components/MentionTextarea";

type StepStatus = "locked" | "pending" | "in_progress" | "completed";
type WebsiteProjectSubtype = "custom" | "template" | "saas" | null;
type ReviewStatus = "needs_improvement" | "lacks_information" | "passed" | null;
type PaymentStatus = "unpaid" | "partially_paid" | "paid";
type RevisionStepStatus = "in_progress" | "submitted" | "approved" | null;
type UserSummary = { id: string; full_name: string | null; email: string | null };
type FileUpload = { name: string; url: string; uploadedAt: string; isActive?: boolean; version?: number };
type StepComment = { id: string; userId: string; userName: string; body: string; createdAt: string };
type QuoteAssociation = { invoiceId: string; invoiceNumber: string; total: number; sentToClient: boolean; approvedByClient: boolean; revisions: { timestamp: string; changes: string }[] };
type InvoiceAssociation = { invoiceId: string; invoiceNumber: string; total: number; paymentStatus: PaymentStatus; paidAmount: number; revisions: { timestamp: string; changes: string }[] };
type RevisionChecklistItem = { id: string; text: string; completed: boolean; assignedUserId: string | null; assignedUserName: string | null; taskId: string | null };

type WorkflowStep = {
  id: string;
  number: number | string;
  title: string;
  description: string;
  status: StepStatus;
  assignedUserId: string | null;
  assignedUserName: string | null;
  taskId: string | null;
  completedAt: string | null;
  data?: Record<string, unknown>;
  files?: FileUpload[];
  comments?: StepComment[];
  reviewStatus?: ReviewStatus;
  revisionStatus?: RevisionStepStatus;
  revisionChecklist?: RevisionChecklistItem[];
  concurrent?: boolean;
  quotes?: QuoteAssociation[];
  invoices?: InvoiceAssociation[];
};

type WebsiteWorkflowData = {
  projectSubtype: WebsiteProjectSubtype;
  subtypeName?: string;
  needsFigma?: boolean;
  steps: WorkflowStep[];
};

const SUBTYPES = [
  { value: "custom", label: "Custom Project", desc: "Fully custom website built from scratch" },
  { value: "template", label: "Template Project", desc: "Website built using a pre-designed template" },
  { value: "saas", label: "SAAS Project", desc: "Software as a Service web application" },
] as const;

const REVIEW_OPTIONS = [
  { value: "needs_improvement", label: "Needs Improvement", color: "amber" },
  { value: "lacks_information", label: "Lacks Information", color: "red" },
  { value: "passed", label: "Passed", color: "emerald" },
] as const;

function getStepsForSubtype(subtype: WebsiteProjectSubtype, needsFigma?: boolean): WorkflowStep[] {
  const steps: WorkflowStep[] = [
    { id: "project_brief", number: 2, title: "Gather Project Brief", description: "Upload the project brief (PDF/Word)", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, files: [], comments: [] },
    { id: "brand_guidelines", number: 3, title: "Gather Brand Guidelines", description: "Upload brand guidelines document", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, files: [], comments: [] },
    { id: "technical_scope", number: 4, title: "Technical Scope", description: "Generate with AI or upload document", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, data: { scopeText: "", scopeMode: "ai" }, files: [], comments: [] },
    { id: "technical_review", number: 5, title: "Technical Review", description: "Review and approve the technical scope", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, reviewStatus: null, comments: [] },
    { id: "financials", number: 6, title: "Financials", description: "Associate quotes and invoices", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, quotes: [], invoices: [], comments: [] },
  ];

  let nextNum = 8;
  if (subtype === "custom") {
    steps.push(
      { id: "ui_ux_design", number: "7a", title: "UI/UX Design", description: "Provide Figma design link", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, data: { figmaLink: "" }, reviewStatus: null, comments: [], concurrent: true },
      { id: "project_scaffolding", number: "7b", title: "Project Scaffolding", description: "Define project schema and structure", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, data: { schemaText: "" }, reviewStatus: null, files: [], comments: [], concurrent: true }
    );
  } else if (subtype === "template") {
    if (needsFigma) {
      steps.push(
        { id: "ui_ux_design", number: 7, title: "UI/UX Design", description: "Provide Figma design link", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, data: { figmaLink: "" }, reviewStatus: null, comments: [] },
        { id: "project_scaffolding", number: 8, title: "Project Scaffolding", description: "Define project schema", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, data: { schemaText: "" }, reviewStatus: null, files: [], comments: [] }
      );
      nextNum = 9;
    } else {
      steps.push(
        { id: "project_scaffolding", number: 7, title: "Project Scaffolding", description: "Define project schema", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, data: { schemaText: "" }, reviewStatus: null, files: [], comments: [] }
      );
    }
  } else if (subtype === "saas") {
    steps.push(
      { id: "project_scaffolding", number: 7, title: "Project Scaffolding", description: "Define SAAS schema and architecture", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, data: { schemaText: "" }, reviewStatus: null, files: [], comments: [] }
    );
  }

  // Add final steps: MVP Production, Revisions, Project Completion
  steps.push(
    { id: "mvp_production", number: nextNum, title: "MVP Production", description: "Provide MVP preview link", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, data: { mvpLink: "" }, comments: [] },
    { id: "revisions", number: nextNum + 1, title: "Revisions", description: "Manage revision checklist and tasks", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, revisionStatus: null, revisionChecklist: [], comments: [] },
    { id: "project_completion", number: nextNum + 2, title: "Project Completion", description: "Upload project completion form", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, files: [], comments: [] }
  );

  return steps;
}

const getDefault = (): WebsiteWorkflowData => ({
  projectSubtype: null,
  subtypeName: "",
  needsFigma: undefined,
  steps: [{
    id: "website_type", number: 1, title: "Determine Website Project Type",
    description: "Select the type of website project",
    status: "pending", assignedUserId: null, assignedUserName: null,
    taskId: null, completedAt: null, data: { selectedType: null }, comments: [],
  }],
});

// Modal Components
function AssignmentModal({ userName, onClose }: { userName: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div ref={ref} className="relative rounded-2xl bg-white p-6 shadow-2xl text-center max-w-sm mx-4">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-8 w-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3 className="text-lg font-bold text-slate-900">User Assigned</h3>
        <p className="mt-2 text-sm text-slate-600"><strong>{userName}</strong> has been assigned</p>
        <p className="mt-3 text-xs text-slate-400">Closing automatically...</p>
      </div>
    </div>
  );
}

function UserPicker({ users, onSelect, onClose }: { users: UserSummary[]; onSelect: (u: UserSummary) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  const filtered = users.filter(u => (u.full_name || u.email || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
      <div className="p-2 border-b border-slate-100">
        <input type="text" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none" />
      </div>
      <div className="max-h-56 overflow-y-auto">
        {filtered.length === 0 ? <p className="p-4 text-center text-sm text-slate-500">No users found</p> : filtered.map(u => (
          <button key={u.id} type="button" onClick={() => onSelect(u)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-xs font-bold text-white">{(u.full_name || u.email || "?")[0].toUpperCase()}</div>
            <div className="flex-1 min-w-0"><p className="font-medium text-slate-900 truncate">{u.full_name || "No name"}</p><p className="text-xs text-slate-500 truncate">{u.email}</p></div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProjectWorkflows({ projectId, projectType }: { projectId: string; projectType: string | null }) {
  const [data, setData] = useState<WebsiteWorkflowData>(getDefault());
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [activePickerStep, setActivePickerStep] = useState<string | null>(null);
  const [selected, setSelected] = useState<WebsiteProjectSubtype>(null);
  const [subtypeName, setSubtypeName] = useState("");
  const [needsFigma, setNeedsFigma] = useState<boolean | undefined>(undefined);
  const [assignmentModal, setAssignmentModal] = useState<{ show: boolean; userName: string }>({ show: false, userName: "" });

  useEffect(() => { supabaseClient.from("users").select("id, full_name, email").order("full_name").then(({ data: u }) => u && setUsers(u)); }, []);

  useEffect(() => {
    supabaseClient.from("project_workflows").select("workflow_data").eq("project_id", projectId).single().then(({ data: d }) => {
      if (d?.workflow_data) {
        let loaded = d.workflow_data as WebsiteWorkflowData;
        
        // Migration: Add Financials step if missing (for existing workflows)
        if (loaded.projectSubtype && !loaded.steps.find(s => s.id === "financials")) {
          const techReviewIndex = loaded.steps.findIndex(s => s.id === "technical_review");
          if (techReviewIndex !== -1) {
            const financialsStep: WorkflowStep = {
              id: "financials", number: 6, title: "Financials", description: "Associate quotes and invoices",
              status: loaded.steps[techReviewIndex].status === "completed" ? "pending" : "locked",
              assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null,
              quotes: [], invoices: [], comments: []
            };
            // Insert after technical_review
            loaded = { ...loaded, steps: [...loaded.steps.slice(0, techReviewIndex + 1), financialsStep, ...loaded.steps.slice(techReviewIndex + 1)] };
            // Renumber subsequent steps
            loaded.steps = loaded.steps.map((s, i) => {
              if (i > techReviewIndex + 1) {
                const oldNum = typeof s.number === "string" ? s.number : s.number;
                if (s.concurrent) return { ...s, number: s.id === "ui_ux_design" ? "7a" : "7b" };
                return { ...s, number: 7 + (i - techReviewIndex - 2) };
              }
              return s;
            });
          }
        }

        // Migration: Add new final steps (MVP, Revisions, Project Completion) if missing
        if (loaded.projectSubtype && !loaded.steps.find(s => s.id === "mvp_production")) {
          // Find the last design/scaffolding step
          const scaffoldingIndex = loaded.steps.findIndex(s => s.id === "project_scaffolding");
          const designIndex = loaded.steps.findIndex(s => s.id === "ui_ux_design");
          const lastDesignStep = Math.max(scaffoldingIndex, designIndex);
          
          if (lastDesignStep !== -1) {
            // Check if all prior steps (including scaffolding) are complete
            const allPriorComplete = loaded.steps.slice(0, lastDesignStep + 1).every(s => s.status === "completed");
            // For concurrent steps, both must be complete
            const concurrentComplete = (!loaded.steps[scaffoldingIndex]?.concurrent || 
              (loaded.steps[scaffoldingIndex]?.status === "completed" && loaded.steps[designIndex]?.status === "completed"));
            const shouldUnlock = allPriorComplete && concurrentComplete;
            
            // Calculate step numbers
            let nextNum = 8;
            if (loaded.steps[lastDesignStep]?.concurrent) {
              nextNum = 8; // After 7a/7b
            } else {
              nextNum = (typeof loaded.steps[lastDesignStep]?.number === "number" ? loaded.steps[lastDesignStep].number as number : 8) + 1;
            }
            
            const newSteps: WorkflowStep[] = [
              { id: "mvp_production", number: nextNum, title: "MVP Production", description: "Provide MVP preview link", status: shouldUnlock ? "pending" : "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, data: { mvpLink: "" }, comments: [] },
              { id: "revisions", number: nextNum + 1, title: "Revisions", description: "Manage revision checklist and tasks", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, revisionStatus: null, revisionChecklist: [], comments: [] },
              { id: "project_completion", number: nextNum + 2, title: "Project Completion", description: "Upload project completion form", status: "locked", assignedUserId: null, assignedUserName: null, taskId: null, completedAt: null, files: [], comments: [] }
            ];
            
            loaded = { ...loaded, steps: [...loaded.steps, ...newSteps] };
          }
        }
        
        // Save any migrations
        if (loaded.projectSubtype) {
          supabaseClient.from("project_workflows").upsert({ project_id: projectId, workflow_data: loaded, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
        }
        
        setData(loaded);
        if (loaded.projectSubtype) setSelected(loaded.projectSubtype);
        if (loaded.subtypeName) setSubtypeName(loaded.subtypeName);
        if (loaded.needsFigma !== undefined) setNeedsFigma(loaded.needsFigma);
      }
    });
  }, [projectId]);

  async function save(updated: WebsiteWorkflowData) {
    setSaving(true);
    await supabaseClient.from("project_workflows").upsert({ project_id: projectId, workflow_data: updated, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
    setSaving(false);
  }

  async function createTask(step: WorkflowStep, userId: string, userName: string) {
    const { data: auth } = await supabaseClient.auth.getUser();
    if (!auth?.user) return null;
    const meta = auth.user.user_metadata || {};
    const name = [meta.first_name, meta.last_name].filter(Boolean).join(" ") || auth.user.email;
    const { data: t } = await supabaseClient.from("tasks").insert({
      project_id: projectId, name: `Workflow: ${step.title}`, content: step.description,
      status: "not_started", priority: "high", type: "todo",
      created_by_user_id: auth.user.id, created_by_name: name,
      assigned_user_id: userId, assigned_user_name: userName, source: "admin",
    }).select("id").single();
    return t?.id || null;
  }

  async function assignUser(stepId: string, user: UserSummary) {
    const step = data.steps.find(s => s.id === stepId);
    if (!step) return;
    const userName = user.full_name || user.email || "Unknown";
    const taskId = step.taskId || await createTask(step, user.id, userName);
    const updated = { ...data, steps: data.steps.map(s => s.id === stepId ? { ...s, assignedUserId: user.id, assignedUserName: userName, status: (s.status === "locked" ? "locked" : "in_progress") as StepStatus, taskId } : s) };
    setData(updated); save(updated); setActivePickerStep(null);
    setAssignmentModal({ show: true, userName });
  }

  async function addComment(stepId: string, body: string) {
    const { data: auth } = await supabaseClient.auth.getUser();
    if (!auth?.user || !body.trim()) return;
    const meta = auth.user.user_metadata || {};
    const userName = [meta.first_name, meta.last_name].filter(Boolean).join(" ") || auth.user.email || "Unknown";
    const comment: StepComment = { id: crypto.randomUUID(), userId: auth.user.id, userName, body: body.trim(), createdAt: new Date().toISOString() };
    const updated = { ...data, steps: data.steps.map(s => s.id === stepId ? { ...s, comments: [...(s.comments || []), comment] } : s) };
    setData(updated); await save(updated);
    
    // Handle mentions (non-blocking)
    const mentionedIds = extractMentionedUserIds(body);
    if (mentionedIds.length > 0) {
      try {
        await supabaseClient.from("workflow_step_mentions").insert(mentionedIds.map(uid => ({ 
          project_id: projectId, 
          step_id: stepId, 
          mentioned_user_id: uid,
          comment_body: body.trim(),
          author_name: userName
        })));
      } catch (e) { console.warn("Mentions table not ready:", e); }
    }
  }

  async function completeStep1() {
    if (!selected) return;
    const needsName = selected === "template" || selected === "saas";
    if (needsName && !subtypeName.trim()) return;
    if (selected === "template" && needsFigma === undefined) return;
    
    const newSteps = getStepsForSubtype(selected, selected === "template" ? needsFigma : undefined);
    newSteps[0].status = "pending";
    
    const updated: WebsiteWorkflowData = {
      projectSubtype: selected, subtypeName: subtypeName.trim(), needsFigma: selected === "template" ? needsFigma : undefined,
      steps: [{ ...data.steps[0], status: "completed" as StepStatus, completedAt: new Date().toISOString(), data: { selectedType: selected } }, ...newSteps]
    };
    setData(updated); await save(updated);
  }

  async function markStepIncomplete(stepId: string) {
    const stepIndex = data.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;
    // Lock subsequent steps but preserve their data
    const updated = { ...data, steps: data.steps.map((s, i) => {
      if (s.id === stepId) return { ...s, status: "in_progress" as StepStatus, completedAt: null, reviewStatus: null };
      if (i > stepIndex) return { ...s, status: "locked" as StepStatus, completedAt: null, reviewStatus: null };
      return s;
    })};
    if (stepId === "website_type") { updated.steps = [{ ...updated.steps[0] }]; updated.projectSubtype = null; updated.needsFigma = undefined; }
    setData(updated); await save(updated);
  }

  async function completeStep(stepId: string) {
    const stepIndex = data.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;
    const step = data.steps[stepIndex];
    if (!step.assignedUserId) return;

    const updated = { ...data, steps: data.steps.map((s, i) => {
      if (s.id === stepId) return { ...s, status: "completed" as StepStatus, completedAt: new Date().toISOString() };
      // Special: financials unlocks concurrent design/scaffolding steps
      if (step.id === "financials" && (s.id === "ui_ux_design" || s.id === "project_scaffolding") && s.status === "locked") {
        return { ...s, status: "pending" as StepStatus };
      }
      // Unlock next step sequentially
      if (i === stepIndex + 1 && s.status === "locked") {
        return { ...s, status: "pending" as StepStatus };
      }
      return s;
    })};
    setData(updated); await save(updated);
  }

  async function updateStepData(stepId: string, key: string, value: unknown) {
    const updated = { ...data, steps: data.steps.map(s => s.id === stepId ? { ...s, data: { ...s.data, [key]: value } } : s) };
    setData(updated); await save(updated);
  }

  async function setReviewStatus(stepId: string, status: ReviewStatus) {
    const step = data.steps.find(s => s.id === stepId);
    if (!step) return;
    
    if (status === "passed") {
      await completeStepWithReview(stepId);
    } else {
      const updated = { ...data, steps: data.steps.map(s => s.id === stepId ? { ...s, reviewStatus: status } : s) };
      setData(updated); await save(updated);
    }
  }

  async function completeStepWithReview(stepId: string) {
    const stepIndex = data.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;
    const step = data.steps[stepIndex];
    if (!step.assignedUserId) return;

    let updatedSteps = data.steps.map((s, i) => {
      if (s.id === stepId) return { ...s, status: "completed" as StepStatus, completedAt: new Date().toISOString(), reviewStatus: "passed" as ReviewStatus };
      return s;
    });

    // Special handling for financials - unlock concurrent design/scaffolding steps
    if (stepId === "financials") {
      updatedSteps = updatedSteps.map(s => {
        if ((s.id === "ui_ux_design" || s.id === "project_scaffolding") && s.status === "locked") {
          return { ...s, status: "pending" as StepStatus };
        }
        return s;
      });
    } else {
      // Normal sequential unlock
      const nextIndex = stepIndex + 1;
      if (nextIndex < updatedSteps.length && updatedSteps[nextIndex].status === "locked") {
        updatedSteps[nextIndex] = { ...updatedSteps[nextIndex], status: "pending" as StepStatus };
      }
    }

    const updated = { ...data, steps: updatedSteps };
    setData(updated); await save(updated);
  }

  async function handleFileUpload(stepId: string, file: File) {
    const ext = file.name.split(".").pop() || "file";
    const path = `workflows/${projectId}/${stepId}/${Date.now()}.${ext}`;
    const { error } = await supabaseClient.storage.from("project-files").upload(path, file);
    if (error) { console.error(error); return; }
    const { data: urlData } = supabaseClient.storage.from("project-files").getPublicUrl(path);
    
    // Get current files and determine next version
    const step = data.steps.find(s => s.id === stepId);
    const currentFiles = step?.files || [];
    const maxVersion = currentFiles.reduce((max, f) => Math.max(max, f.version || 1), 0);
    
    // New file is active by default, mark others as inactive
    const updatedFiles = currentFiles.map(f => ({ ...f, isActive: false }));
    const newFile: FileUpload = { name: file.name, url: urlData.publicUrl, uploadedAt: new Date().toISOString(), isActive: true, version: maxVersion + 1 };
    
    const updated = { ...data, steps: data.steps.map(s => s.id === stepId ? { ...s, files: [...updatedFiles, newFile] } : s) };
    setData(updated); await save(updated);
  }

  async function setFileActive(stepId: string, fileIndex: number) {
    const updated = { ...data, steps: data.steps.map(s => {
      if (s.id !== stepId) return s;
      const files = (s.files || []).map((f, i) => ({ ...f, isActive: i === fileIndex }));
      return { ...s, files };
    })};
    setData(updated); await save(updated);
  }

  async function deleteFile(stepId: string, fileIndex: number) {
    const updated = { ...data, steps: data.steps.map(s => {
      if (s.id !== stepId) return s;
      const files = (s.files || []).filter((_, i) => i !== fileIndex);
      // If we deleted the active file, make the latest one active
      if (files.length > 0 && !files.some(f => f.isActive)) {
        files[files.length - 1].isActive = true;
      }
      return { ...s, files };
    })};
    setData(updated); await save(updated);
  }

  async function updateQuotes(stepId: string, quotes: QuoteAssociation[]) {
    const updated = { ...data, steps: data.steps.map(s => s.id === stepId ? { ...s, quotes } : s) };
    setData(updated); await save(updated);
  }

  async function updateInvoices(stepId: string, invoices: InvoiceAssociation[]) {
    const updated = { ...data, steps: data.steps.map(s => s.id === stepId ? { ...s, invoices } : s) };
    setData(updated); await save(updated);
  }

  async function updateRevisionStatus(stepId: string, revisionStatus: RevisionStepStatus) {
    const updated = { ...data, steps: data.steps.map(s => s.id === stepId ? { ...s, revisionStatus } : s) };
    setData(updated); await save(updated);
  }

  async function updateRevisionChecklist(stepId: string, revisionChecklist: RevisionChecklistItem[]) {
    const updated = { ...data, steps: data.steps.map(s => s.id === stepId ? { ...s, revisionChecklist } : s) };
    setData(updated); await save(updated);
  }

  if (projectType !== "website") {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><h3 className="text-lg font-semibold text-slate-900">Workflow Not Available</h3><p className="mt-2 text-sm text-slate-500">Workflows are only available for Website projects.</p></div>;
  }

  const completedSteps = data.steps.filter(s => s.status === "completed").length;
  const totalSteps = data.steps.length;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="space-y-6">
      {assignmentModal.show && <AssignmentModal userName={assignmentModal.userName} onClose={() => setAssignmentModal({ show: false, userName: "" })} />}
      
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 text-white shadow-2xl">
        <div className="relative flex items-center justify-between">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase">Website Project</span>
            <h2 className="text-2xl font-bold mt-1">Website Project Workflow</h2>
            <p className="text-sm text-white/70 mt-1">{data.projectSubtype ? `${SUBTYPES.find(t => t.value === data.projectSubtype)?.label}${data.subtypeName ? `: ${data.subtypeName}` : ""}` : "Start by selecting the project type"}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right"><p className="text-3xl font-bold">{progress}%</p><p className="text-xs text-white/60">{completedSteps}/{totalSteps} steps</p></div>
            {saving && <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {data.steps.map((step) => (
          <StepCard key={step.id} step={step} data={data} users={users} projectId={projectId}
            activePickerStep={activePickerStep} setActivePickerStep={setActivePickerStep}
            onAssignUser={assignUser} onMarkIncomplete={markStepIncomplete} onComplete={completeStep}
            onAddComment={addComment} onUpdateData={updateStepData} onSetReviewStatus={setReviewStatus}
            onFileUpload={handleFileUpload} onSetFileActive={setFileActive} onDeleteFile={deleteFile}
            onUpdateQuotes={updateQuotes} onUpdateInvoices={updateInvoices}
            onUpdateRevisionStatus={updateRevisionStatus} onUpdateRevisionChecklist={updateRevisionChecklist}
            // Step 1 specific
            selected={selected} setSelected={setSelected} subtypeName={subtypeName} setSubtypeName={setSubtypeName}
            needsFigma={needsFigma} setNeedsFigma={setNeedsFigma} onCompleteStep1={completeStep1}
          />
        ))}
      </div>
    </div>
  );
}

type InvoiceListItem = { id: string; invoice_number: string; invoice_type: "quote" | "invoice"; status: string; total: number; client_name: string; notes: string | null };

// Step Card Component
function StepCard({ step, data, users, projectId, activePickerStep, setActivePickerStep, onAssignUser, onMarkIncomplete, onComplete, onAddComment, onUpdateData, onSetReviewStatus, onFileUpload, onSetFileActive, onDeleteFile, onUpdateQuotes, onUpdateInvoices, onUpdateRevisionStatus, onUpdateRevisionChecklist, selected, setSelected, subtypeName, setSubtypeName, needsFigma, setNeedsFigma, onCompleteStep1 }: {
  step: WorkflowStep; data: WebsiteWorkflowData; users: UserSummary[]; projectId: string;
  activePickerStep: string | null; setActivePickerStep: (s: string | null) => void;
  onAssignUser: (stepId: string, user: UserSummary) => void;
  onMarkIncomplete: (stepId: string) => void;
  onComplete: (stepId: string) => void;
  onAddComment: (stepId: string, body: string) => void;
  onUpdateData: (stepId: string, key: string, value: unknown) => void;
  onSetReviewStatus: (stepId: string, status: ReviewStatus) => void;
  onFileUpload: (stepId: string, file: File) => void;
  onSetFileActive: (stepId: string, fileIndex: number) => void;
  onDeleteFile: (stepId: string, fileIndex: number) => void;
  onUpdateQuotes: (stepId: string, quotes: QuoteAssociation[]) => void;
  onUpdateInvoices: (stepId: string, invoices: InvoiceAssociation[]) => void;
  onUpdateRevisionStatus: (stepId: string, status: RevisionStepStatus) => void;
  onUpdateRevisionChecklist: (stepId: string, checklist: RevisionChecklistItem[]) => void;
  selected: WebsiteProjectSubtype; setSelected: (s: WebsiteProjectSubtype) => void;
  subtypeName: string; setSubtypeName: (s: string) => void;
  needsFigma: boolean | undefined; setNeedsFigma: (v: boolean) => void;
  onCompleteStep1: () => void;
}) {
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [scopeText, setScopeText] = useState((step.data?.scopeText as string) || "");
  const [scopeMode, setScopeMode] = useState<"ai" | "upload">((step.data?.scopeMode as "ai" | "upload") || "ai");
  const [generating, setGenerating] = useState(false);
  const [figmaLink, setFigmaLink] = useState((step.data?.figmaLink as string) || "");
  const [schemaText, setSchemaText] = useState((step.data?.schemaText as string) || "");
  const [mvpLink, setMvpLink] = useState((step.data?.mvpLink as string) || "");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [showUserSearch, setShowUserSearch] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  
  // Financials state
  const [availableQuotes, setAvailableQuotes] = useState<InvoiceListItem[]>([]);
  const [availableInvoices, setAvailableInvoices] = useState<InvoiceListItem[]>([]);
  const [quoteSearch, setQuoteSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [showQuoteSearch, setShowQuoteSearch] = useState(false);
  const [showInvoiceSearch, setShowInvoiceSearch] = useState(false);
  
  useEffect(() => {
    if (step.id === "financials") {
      supabaseClient.from("invoices").select("id, invoice_number, invoice_type, status, total, client_name, notes").eq("project_id", projectId).order("created_at", { ascending: false }).then(({ data: inv }) => {
        if (inv) {
          setAvailableQuotes((inv as InvoiceListItem[]).filter(i => i.invoice_type === "quote"));
          setAvailableInvoices((inv as InvoiceListItem[]).filter(i => i.invoice_type === "invoice"));
        }
      });
    }
  }, [step.id, projectId]);

  const isLocked = step.status === "locked";
  const isDone = step.status === "completed";
  const isActive = step.status === "pending" || step.status === "in_progress";
  const isStep1 = step.id === "website_type";
  const isReviewStep = step.id === "technical_review" || step.id === "ui_ux_design" || step.id === "project_scaffolding";

  async function handleSubmitComment() {
    if (!commentText.trim()) return;
    await onAddComment(step.id, commentText);
    setCommentText("");
  }

  async function handleGenerateAI() {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-scope", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }) });
      if (res.ok) {
        const { scope } = await res.json();
        const text = typeof scope === "string" ? scope : JSON.stringify(scope, null, 2);
        setScopeText(text);
        onUpdateData(step.id, "scopeText", text);
        onUpdateData(step.id, "scopeMode", "ai");
      }
    } catch (e) { console.error(e); }
    setGenerating(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onFileUpload(step.id, file);
    setUploading(false);
  }

  const canComplete = step.assignedUserId && (
    (["project_brief", "brand_guidelines"].includes(step.id) && step.files && step.files.length > 0) ||
    (step.id === "technical_scope" && (scopeText.trim() || (step.files && step.files.length > 0))) ||
    (isReviewStep && step.reviewStatus === "passed")
  );

  return (
    <div className={`rounded-2xl border p-5 transition-all ${isLocked ? "border-slate-200 bg-slate-50 opacity-60" : isDone ? "border-emerald-200 bg-emerald-50/50" : "border-blue-200 bg-white shadow-lg"}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shrink-0 ${isLocked ? "bg-slate-300 text-slate-500" : isDone ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"}`}>{isDone ? "✓" : step.number}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-slate-900">{step.title}</h3>
              {step.concurrent && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase">Concurrent</span>}
            </div>
            <p className="text-[12px] text-slate-500">{step.description}</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase shrink-0 ${isLocked ? "bg-slate-200 text-slate-500" : isDone ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{isLocked ? "Locked" : isDone ? "Completed" : "In Progress"}</span>
        </div>
        {!isLocked && (
          <div className="flex items-center gap-2">
            {isDone && <button type="button" onClick={() => onMarkIncomplete(step.id)} className="text-xs text-amber-600 hover:text-amber-700 font-medium px-2 py-1 rounded hover:bg-amber-50">Mark Incomplete</button>}
            <div className="relative">
              <button type="button" onClick={() => !isDone && setActivePickerStep(activePickerStep === step.id ? null : step.id)} disabled={isDone} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] ${step.assignedUserId ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-900"} ${isDone ? "opacity-50" : ""}`}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span className="font-medium">{step.assignedUserName || "Assign User"}</span>
              </button>
              {activePickerStep === step.id && !isDone && <UserPicker users={users} onSelect={(u) => onAssignUser(step.id, u)} onClose={() => setActivePickerStep(null)} />}
            </div>
          </div>
        )}
      </div>

      {/* Step 1 Content */}
      {isStep1 && isActive && (
        <div className="mt-5 space-y-4">
          <p className="text-[11px] font-semibold text-slate-600 uppercase">Select Website Project Type</p>
          {SUBTYPES.map(t => (
            <label key={t.value} className={`flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer ${selected === t.value ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-200"}`}>
              <input type="radio" name="type" value={t.value} checked={selected === t.value} onChange={() => setSelected(t.value as WebsiteProjectSubtype)} className="h-5 w-5 accent-blue-600" />
              <div><p className="font-semibold text-slate-900">{t.label}</p><p className="text-[12px] text-slate-500">{t.desc}</p></div>
            </label>
          ))}
          {(selected === "template" || selected === "saas") && (
            <div className="mt-4">
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-2">{selected === "template" ? "Template Name" : "SAAS Name"}</label>
              <input type="text" value={subtypeName} onChange={(e) => setSubtypeName(e.target.value)} placeholder={`Enter ${selected} name...`} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none" />
            </div>
          )}
          {selected === "template" && (
            <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-sm font-semibold text-slate-900 mb-3">Do we need a Figma design?</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setNeedsFigma(true)} className={`flex-1 py-2 rounded-lg font-medium text-sm ${needsFigma === true ? "bg-blue-500 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>Yes</button>
                <button type="button" onClick={() => setNeedsFigma(false)} className={`flex-1 py-2 rounded-lg font-medium text-sm ${needsFigma === false ? "bg-blue-500 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>No</button>
              </div>
            </div>
          )}
          <button type="button" onClick={onCompleteStep1} disabled={!selected || !step.assignedUserId || ((selected === "template" || selected === "saas") && !subtypeName.trim()) || (selected === "template" && needsFigma === undefined)} className="w-full mt-4 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Complete Step & Continue</button>
          {!step.assignedUserId && <p className="text-[11px] text-amber-600 text-center">Please assign a user first</p>}
        </div>
      )}
      {isStep1 && isDone && (
        <div className="mt-4 p-4 rounded-xl bg-emerald-100 text-emerald-800 text-sm">
          <strong>Selected:</strong> {SUBTYPES.find(t => t.value === data.projectSubtype)?.label}{data.subtypeName && ` — ${data.subtypeName}`}
          {data.needsFigma !== undefined && <span className="ml-2">| Figma: {data.needsFigma ? "Yes" : "No"}</span>}
        </div>
      )}

      {/* File Upload Steps */}
      {["project_brief", "brand_guidelines"].includes(step.id) && isActive && (
        <div className="mt-5 space-y-4">
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleUpload} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 w-full hover:border-blue-400 hover:bg-blue-50/50 disabled:opacity-50">
            {uploading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /> : <svg className="h-8 w-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
          </button>
          {step.files && step.files.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Document Versions</p>
              {step.files.map((f, i) => (
                <div key={i} className={`flex items-center gap-2 p-3 rounded-lg border ${f.isActive ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span className="truncate">{f.name}</span>
                    <span className="text-[10px] text-slate-400">v{f.version || 1}</span>
                  </a>
                  {f.isActive && <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">ACTIVE</span>}
                  {!f.isActive && <button type="button" onClick={() => onSetFileActive(step.id, i)} className="text-[10px] text-blue-600 hover:underline">Set Active</button>}
                  <button type="button" onClick={() => onDeleteFile(step.id, i)} className="text-red-500 hover:text-red-700 p-1"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => onComplete(step.id)} disabled={!step.assignedUserId || !step.files?.some(f => f.isActive)} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed">Complete Step</button>
        </div>
      )}

      {/* Technical Scope Step */}
      {step.id === "technical_scope" && isActive && (
        <div className="mt-5 space-y-4">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            <button type="button" onClick={() => { setScopeMode("ai"); onUpdateData(step.id, "scopeMode", "ai"); }} className={`flex-1 py-2 rounded-md text-sm font-medium ${scopeMode === "ai" ? "bg-white shadow text-slate-900" : "text-slate-600"}`}>Generate with AI</button>
            <button type="button" onClick={() => { setScopeMode("upload"); onUpdateData(step.id, "scopeMode", "upload"); }} className={`flex-1 py-2 rounded-md text-sm font-medium ${scopeMode === "upload" ? "bg-white shadow text-slate-900" : "text-slate-600"}`}>Upload Document</button>
          </div>
          {scopeMode === "ai" ? (
            <>
              <button type="button" onClick={handleGenerateAI} disabled={generating} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {generating ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>}
                {generating ? "Generating..." : "Generate with AI"}
              </button>
              <textarea value={scopeText} onChange={(e) => setScopeText(e.target.value)} onBlur={() => onUpdateData(step.id, "scopeText", scopeText)} placeholder="Technical scope will appear here..." rows={10} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none" />
            </>
          ) : (
            <>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleUpload} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 w-full hover:border-blue-400 disabled:opacity-50">
                {uploading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /> : <span className="text-slate-500">Click to upload PDF/Word</span>}
              </button>
              {step.files && step.files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">Document Versions</p>
                  {step.files.map((f, i) => (
                    <div key={i} className={`flex items-center gap-2 p-3 rounded-lg border ${f.isActive ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span className="truncate">{f.name}</span>
                        <span className="text-[10px] text-slate-400">v{f.version || 1}</span>
                      </a>
                      {f.isActive && <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">ACTIVE</span>}
                      {!f.isActive && <button type="button" onClick={() => onSetFileActive(step.id, i)} className="text-[10px] text-blue-600 hover:underline">Set Active</button>}
                      <button type="button" onClick={() => onDeleteFile(step.id, i)} className="text-red-500 hover:text-red-700 p-1"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <button type="button" onClick={() => onComplete(step.id)} disabled={!step.assignedUserId || (!scopeText.trim() && !step.files?.some(f => f.isActive))} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Complete Step</button>
        </div>
      )}

      {/* Review Steps */}
      {isReviewStep && isActive && (
        <div className="mt-5 space-y-4">
          {step.id === "ui_ux_design" && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-2">Figma Link</label>
              <div className="flex gap-2">
                <input type="url" value={figmaLink} onChange={(e) => setFigmaLink(e.target.value)} onBlur={() => onUpdateData(step.id, "figmaLink", figmaLink)} placeholder="https://www.figma.com/..." className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm text-black focus:border-blue-400 focus:outline-none" />
                {figmaLink && (
                  <a href={figmaLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                    Preview
                  </a>
                )}
              </div>
            </div>
          )}
          {step.id === "project_scaffolding" && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-2">Project Schema</label>
                <textarea value={schemaText} onChange={(e) => setSchemaText(e.target.value)} onBlur={() => onUpdateData(step.id, "schemaText", schemaText)} placeholder="Define the project structure, database schema, API endpoints..." rows={8} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none" />
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleUpload} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()} className="text-sm text-blue-600 hover:underline">Or upload a document</button>
              {step.files && step.files.length > 0 && (
                <div className="space-y-2 mt-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">Document Versions</p>
                  {step.files.map((f, i) => (
                    <div key={i} className={`flex items-center gap-2 p-3 rounded-lg border ${f.isActive ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span className="truncate">{f.name}</span>
                        <span className="text-[10px] text-slate-400">v{f.version || 1}</span>
                      </a>
                      {f.isActive && <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">ACTIVE</span>}
                      {!f.isActive && <button type="button" onClick={() => onSetFileActive(step.id, i)} className="text-[10px] text-blue-600 hover:underline">Set Active</button>}
                      <button type="button" onClick={() => onDeleteFile(step.id, i)} className="text-red-500 hover:text-red-700 p-1"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-2">Review Status</label>
            <div className="flex gap-2">
              {REVIEW_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => onSetReviewStatus(step.id, opt.value as ReviewStatus)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${step.reviewStatus === opt.value ? `border-${opt.color}-500 bg-${opt.color}-50 text-${opt.color}-700` : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {step.reviewStatus && step.reviewStatus !== "passed" && <p className="text-sm text-amber-600">Status: {REVIEW_OPTIONS.find(o => o.value === step.reviewStatus)?.label}. Update and mark as Passed to continue.</p>}
        </div>
      )}

      {/* Financials Step */}
      {step.id === "financials" && isActive && (
        <div className="mt-5 space-y-6">
          {/* Part 1: Quotes */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">1</span>
              Quote
            </h4>
            
            {/* Associated Quotes */}
            {step.quotes && step.quotes.length > 0 && (
              <div className="space-y-2 mb-3">
                {step.quotes.map((q, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-white border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-900">{q.invoiceNumber}</span>
                      <span className="text-sm font-bold text-slate-700">AED {q.total.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={q.sentToClient} onChange={(e) => {
                          const updated = [...(step.quotes || [])];
                          updated[idx] = { ...updated[idx], sentToClient: e.target.checked, revisions: [...updated[idx].revisions, { timestamp: new Date().toISOString(), changes: `Sent to Client: ${e.target.checked}` }] };
                          onUpdateQuotes(step.id, updated);
                        }} className="h-4 w-4 accent-blue-600 rounded" />
                        <span className="text-slate-700">Sent to Client</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={q.approvedByClient} onChange={(e) => {
                          const updated = [...(step.quotes || [])];
                          updated[idx] = { ...updated[idx], approvedByClient: e.target.checked, revisions: [...updated[idx].revisions, { timestamp: new Date().toISOString(), changes: `Approved by Client: ${e.target.checked}` }] };
                          onUpdateQuotes(step.id, updated);
                        }} className="h-4 w-4 accent-emerald-600 rounded" />
                        <span className="text-slate-700">Approved by Client</span>
                      </label>
                    </div>
                    {q.revisions.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-[10px] text-slate-500 cursor-pointer">History ({q.revisions.length})</summary>
                        <div className="mt-1 space-y-1 text-[10px] text-slate-500">
                          {q.revisions.map((r, ri) => <div key={ri}>{new Date(r.timestamp).toLocaleString()}: {r.changes}</div>)}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Add Quote */}
            <div className="relative">
              <button type="button" onClick={() => setShowQuoteSearch(!showQuoteSearch)} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-slate-300 text-slate-600 hover:border-amber-400 hover:text-amber-600">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m-7-7h14"/></svg>
                Associate Quote
              </button>
              {showQuoteSearch && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-xl p-2">
                  <input type="text" value={quoteSearch} onChange={(e) => setQuoteSearch(e.target.value)} placeholder="Search quotes..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-2" autoFocus />
                  <div className="max-h-40 overflow-y-auto">
                    {availableQuotes.filter(q => q.invoice_number.toLowerCase().includes(quoteSearch.toLowerCase()) && !step.quotes?.some(sq => sq.invoiceId === q.id)).map(q => (
                      <button key={q.id} type="button" onClick={() => {
                        const newQuote: QuoteAssociation = { invoiceId: q.id, invoiceNumber: q.invoice_number, total: q.total, sentToClient: false, approvedByClient: false, revisions: [{ timestamp: new Date().toISOString(), changes: "Quote associated" }] };
                        onUpdateQuotes(step.id, [...(step.quotes || []), newQuote]);
                        setShowQuoteSearch(false); setQuoteSearch("");
                      }} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 rounded-lg border-b border-slate-100 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-blue-600">{q.invoice_number}</span>
                          <span className="text-sm font-bold text-blue-700">AED {q.total.toLocaleString()}</span>
                        </div>
                        {q.notes && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{q.notes}</p>}
                      </button>
                    ))}
                    {availableQuotes.filter(q => !step.quotes?.some(sq => sq.invoiceId === q.id)).length === 0 && <p className="text-sm text-slate-500 p-2">No quotes available. Create one in the Invoice tab.</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Part 2: Invoices */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold">2</span>
              Invoice
            </h4>
            
            {/* Associated Invoices */}
            {step.invoices && step.invoices.length > 0 && (
              <div className="space-y-2 mb-3">
                {step.invoices.map((inv, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-white border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-900">{inv.invoiceNumber}</span>
                      <span className="text-sm font-bold text-slate-700">AED {inv.total.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-600">Payment Status:</label>
                      <select value={inv.paymentStatus} onChange={(e) => {
                        const updated = [...(step.invoices || [])];
                        updated[idx] = { ...updated[idx], paymentStatus: e.target.value as PaymentStatus, revisions: [...updated[idx].revisions, { timestamp: new Date().toISOString(), changes: `Payment status: ${e.target.value}` }] };
                        onUpdateInvoices(step.id, updated);
                      }} className={`text-sm border border-slate-200 rounded-lg px-2 py-1 font-semibold ${inv.paymentStatus === "paid" ? "text-emerald-600" : inv.paymentStatus === "partially_paid" ? "text-amber-600" : "text-red-600"}`}>
                        <option value="unpaid" className="text-red-600">Unpaid</option>
                        <option value="partially_paid" className="text-amber-600">Partially Paid</option>
                        <option value="paid" className="text-emerald-600">Paid</option>
                      </select>
                    </div>
                    {inv.revisions.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-[10px] text-slate-500 cursor-pointer">History ({inv.revisions.length})</summary>
                        <div className="mt-1 space-y-1 text-[10px] text-slate-500">
                          {inv.revisions.map((r, ri) => <div key={ri}>{new Date(r.timestamp).toLocaleString()}: {r.changes}</div>)}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Add Invoice */}
            <div className="relative">
              <button type="button" onClick={() => setShowInvoiceSearch(!showInvoiceSearch)} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-slate-300 text-slate-600 hover:border-emerald-400 hover:text-emerald-600">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m-7-7h14"/></svg>
                Associate Invoice
              </button>
              {showInvoiceSearch && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-xl p-2">
                  <input type="text" value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)} placeholder="Search invoices..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-2" autoFocus />
                  <div className="max-h-40 overflow-y-auto">
                    {availableInvoices.filter(i => i.invoice_number.toLowerCase().includes(invoiceSearch.toLowerCase()) && !step.invoices?.some(si => si.invoiceId === i.id)).map(i => (
                      <button key={i.id} type="button" onClick={() => {
                        const newInv: InvoiceAssociation = { invoiceId: i.id, invoiceNumber: i.invoice_number, total: i.total, paymentStatus: "unpaid", paidAmount: 0, revisions: [{ timestamp: new Date().toISOString(), changes: "Invoice associated" }] };
                        onUpdateInvoices(step.id, [...(step.invoices || []), newInv]);
                        setShowInvoiceSearch(false); setInvoiceSearch("");
                      }} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 rounded-lg border-b border-slate-100 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-blue-600">{i.invoice_number}</span>
                          <span className="text-sm font-bold text-blue-700">AED {i.total.toLocaleString()}</span>
                        </div>
                        {i.notes && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{i.notes}</p>}
                      </button>
                    ))}
                    {availableInvoices.filter(i => !step.invoices?.some(si => si.invoiceId === i.id)).length === 0 && <p className="text-sm text-slate-500 p-2">No invoices available. Create one in the Invoice tab.</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Complete Button */}
          {(() => {
            const hasQuote = step.quotes && step.quotes.length > 0 && step.quotes.some(q => q.approvedByClient);
            const hasInvoice = step.invoices && step.invoices.length > 0;
            const invoicePaidOrPartial = step.invoices?.some(i => i.paymentStatus === "paid" || i.paymentStatus === "partially_paid");
            const canProceed = hasQuote && hasInvoice && invoicePaidOrPartial;
            return (
              <>
                <button type="button" onClick={() => onComplete(step.id)} disabled={!step.assignedUserId || !canProceed} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed">Complete Financials Step</button>
                {!canProceed && <p className="text-[11px] text-amber-600 text-center mt-2">Requires: approved quote + invoice with payment (paid or partially paid)</p>}
              </>
            );
          })()}
        </div>
      )}

      {/* MVP Production Step */}
      {step.id === "mvp_production" && isActive && (
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-2">MVP Preview Link</label>
            <div className="flex gap-2">
              <input type="url" value={mvpLink} onChange={(e) => setMvpLink(e.target.value)} onBlur={() => onUpdateData(step.id, "mvpLink", mvpLink)} placeholder="https://..." className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm text-black focus:border-blue-400 focus:outline-none" />
              {mvpLink && (
                <a href={mvpLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                  Preview
                </a>
              )}
            </div>
          </div>
          <button type="button" onClick={() => onComplete(step.id)} disabled={!step.assignedUserId || !mvpLink} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed">Complete MVP Production Step</button>
        </div>
      )}

      {/* Revisions Step */}
      {step.id === "revisions" && isActive && (
        <div className="mt-5 space-y-4">
          {/* Status Marker */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-2">Revision Status</label>
            <div className="flex gap-2">
              {(["in_progress", "submitted", "approved"] as RevisionStepStatus[]).map(status => (
                <button key={status} type="button" onClick={() => onUpdateRevisionStatus(step.id, status)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                    step.revisionStatus === status 
                      ? status === "approved" ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : status === "submitted" ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                  {status === "in_progress" ? "In Progress" : status === "submitted" ? "Submitted" : "Approved"}
                </button>
              ))}
            </div>
          </div>

          {/* Revision Checklist */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-2">Revision Checklist</label>
            <div className="space-y-2">
              {(step.revisionChecklist || []).map((item, idx) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <input type="checkbox" checked={item.completed} onChange={(e) => {
                    const updated = [...(step.revisionChecklist || [])];
                    updated[idx] = { ...updated[idx], completed: e.target.checked };
                    onUpdateRevisionChecklist(step.id, updated);
                  }} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <div className="flex-1">
                    <p className={`text-sm ${item.completed ? "line-through text-slate-400" : "text-slate-800"}`}>{item.text}</p>
                    {item.assignedUserName && (
                      <p className="text-[10px] text-slate-500 mt-1">Assigned to: {item.assignedUserName}</p>
                    )}
                  </div>
                  <div className="relative">
                    <button type="button" onClick={() => { setShowUserSearch(showUserSearch === item.id ? null : item.id); setUserSearchTerm(""); }} className="text-[10px] text-blue-600 hover:underline">
                      {item.assignedUserName ? "Reassign" : "Assign Task"}
                    </button>
                    {showUserSearch === item.id && (
                      <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-xl p-2 w-56">
                        <input type="text" value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} placeholder="Search users..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-black mb-2" autoFocus />
                        <div className="max-h-32 overflow-y-auto">
                          {users.filter(u => (u.full_name || u.email || "").toLowerCase().includes(userSearchTerm.toLowerCase())).map(u => (
                            <button key={u.id} type="button" onClick={() => {
                              const updated = [...(step.revisionChecklist || [])];
                              updated[idx] = { ...updated[idx], assignedUserId: u.id, assignedUserName: u.full_name || u.email || "Unknown" };
                              onUpdateRevisionChecklist(step.id, updated);
                              setShowUserSearch(null);
                            }} className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg text-sm text-slate-700">
                              {u.full_name || u.email}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => {
                    const updated = (step.revisionChecklist || []).filter((_, i) => i !== idx);
                    onUpdateRevisionChecklist(step.id, updated);
                  }} className="text-red-500 hover:text-red-700 p-1">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <input type="text" value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} placeholder="Add revision item..." className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-black focus:border-blue-400 focus:outline-none" />
              <button type="button" onClick={() => {
                if (!newChecklistItem.trim()) return;
                const newItem: RevisionChecklistItem = { id: Date.now().toString(), text: newChecklistItem, completed: false, assignedUserId: null, assignedUserName: null, taskId: null };
                onUpdateRevisionChecklist(step.id, [...(step.revisionChecklist || []), newItem]);
                setNewChecklistItem("");
              }} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Add</button>
            </div>
          </div>

          <button type="button" onClick={() => onComplete(step.id)} disabled={!step.assignedUserId || step.revisionStatus !== "approved"} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed">Complete Revisions Step</button>
          {step.revisionStatus !== "approved" && <p className="text-[11px] text-amber-600 text-center">Status must be "Approved" to proceed</p>}
        </div>
      )}

      {/* Project Completion Step */}
      {step.id === "project_completion" && isActive && (
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-2">Project Completion Form</label>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleUpload} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              Upload Project Completion Form
            </button>
          </div>
          {step.files && step.files.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Uploaded Documents</p>
              {step.files.map((f, i) => (
                <div key={i} className={`flex items-center gap-2 p-3 rounded-lg border ${f.isActive ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span className="truncate">{f.name}</span>
                    <span className="text-[10px] text-slate-400">v{f.version || 1}</span>
                  </a>
                  {f.isActive && <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">ACTIVE</span>}
                  {!f.isActive && <button type="button" onClick={() => onSetFileActive(step.id, i)} className="text-[10px] text-blue-600 hover:underline">Set Active</button>}
                  <button type="button" onClick={() => onDeleteFile(step.id, i)} className="text-red-500 hover:text-red-700 p-1"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => onComplete(step.id)} disabled={!step.assignedUserId || !step.files?.length} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed">Complete Project!</button>
        </div>
      )}

      {/* Completed content display */}
      {isDone && step.id === "technical_scope" && (step.data?.scopeText || step.files?.length) && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm">
          {typeof step.data?.scopeText === "string" && step.data.scopeText && <p className="text-emerald-800 whitespace-pre-wrap line-clamp-3">{step.data.scopeText}</p>}
          {step.files?.filter(f => f.isActive).map((f, i) => (
            <a key={i} href={f.url} target="_blank" className="flex items-center gap-2 text-emerald-700 hover:underline mt-1">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {f.name} <span className="text-[10px] text-emerald-500">(v{f.version || 1} - Active)</span>
            </a>
          ))}
        </div>
      )}
      {isDone && step.files && step.files.length > 0 && !["technical_scope"].includes(step.id) && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
          {step.files.filter(f => f.isActive).map((f, i) => (
            <a key={i} href={f.url} target="_blank" className="flex items-center gap-2 text-emerald-700 text-sm hover:underline">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {f.name} <span className="text-[10px] text-emerald-500">(v{f.version || 1} - Active)</span>
            </a>
          ))}
          {step.files.length > 1 && <p className="text-[10px] text-slate-400 mt-2">+{step.files.length - 1} more version(s)</p>}
        </div>
      )}
      {/* Completed Figma link display */}
      {isDone && step.id === "ui_ux_design" && step.data?.figmaLink && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
          <span className="text-sm text-emerald-700 truncate flex-1">{step.data.figmaLink as string}</span>
          <a href={step.data.figmaLink as string} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 ml-2">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
            Preview
          </a>
        </div>
      )}
      {/* Completed MVP link display */}
      {isDone && step.id === "mvp_production" && step.data?.mvpLink && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
          <span className="text-sm text-emerald-700 truncate flex-1">{step.data.mvpLink as string}</span>
          <a href={step.data.mvpLink as string} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 ml-2">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
            Preview
          </a>
        </div>
      )}
      {/* Completed Revisions display */}
      {isDone && step.id === "revisions" && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-emerald-700">Status:</span>
            <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded uppercase">{step.revisionStatus}</span>
          </div>
          {step.revisionChecklist && step.revisionChecklist.length > 0 && (
            <div className="space-y-1">
              {step.revisionChecklist.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-xs text-emerald-700">
                  <span>{item.completed ? "✓" : "○"}</span>
                  <span className={item.completed ? "line-through opacity-70" : ""}>{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comments Section */}
      {!isLocked && (
        <div className="mt-5 pt-4 border-t border-slate-100">
          <button type="button" onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {step.comments?.length || 0} Comments
            <svg className={`h-3 w-3 transition-transform ${showComments ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showComments && (
            <div className="mt-3 space-y-3">
              {step.comments?.map(c => (
                <div key={c.id} className="flex gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 shrink-0">{c.userName[0].toUpperCase()}</div>
                  <div className="flex-1 bg-slate-50 rounded-lg p-2">
                    <div className="flex items-center gap-2"><span className="text-xs font-semibold text-slate-800">{c.userName}</span><span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString()}</span></div>
                    <p className="text-xs text-slate-600 mt-1"><NoteBodyWithMentions body={c.body} /></p>
                  </div>
                </div>
              ))}
              <div className="space-y-2">
                <MentionTextarea value={commentText} onChange={setCommentText} users={users} placeholder="Add a comment... Use @ to mention" rows={2} />
                <button type="button" onClick={handleSubmitComment} disabled={!commentText.trim()} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">Post Comment</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
