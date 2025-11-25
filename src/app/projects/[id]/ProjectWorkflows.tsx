"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type PhaseStatus = "pending" | "in_progress" | "completed";
type TaskStatus = "pending" | "in_progress" | "completed" | "skipped";

type WorkflowTask = {
  id: string;
  label: string;
  description: string;
  status: TaskStatus;
};

type WorkflowPhase = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  tasks: WorkflowTask[];
  status: PhaseStatus;
};

const defaultWorkflow: WorkflowPhase[] = [
  {
    id: "discovery",
    number: 1,
    title: "Brand Discovery & Alignment",
    subtitle: "Understand business, audience, and objectives",
    icon: "compass",
    color: "violet",
    status: "pending",
    tasks: [
      { id: "d1", label: "Deep-Dive Discovery Session", description: "60-90 min workshop with stakeholders", status: "pending" },
      { id: "d2", label: "Brand Audit", description: "Review current assets, website, and social presence", status: "pending" },
      { id: "d3", label: "Aspirations Interview", description: "Define 3-year vision goals", status: "pending" },
      { id: "d4", label: "Audience Personas", description: "Define customer personas", status: "pending" },
      { id: "d5", label: "Strategic Brief", description: "Create Creative Brief - the North Star", status: "pending" },
      { id: "d6", label: "Mood Boards", description: "Visual direction and style references", status: "pending" },
      { id: "d7", label: "Competitor Analysis", description: "Research competitors and differentiation", status: "pending" },
      { id: "d8", label: "Client Approval", description: "Get verbal agreement on direction", status: "pending" },
    ],
  },
  {
    id: "documentation",
    number: 2,
    title: "Documentation & Agreement",
    subtitle: "Define boundaries, deliverables, and legal terms",
    icon: "file-text",
    color: "blue",
    status: "pending",
    tasks: [
      { id: "doc1", label: "Scope of Work (SOW)", description: "Define deliverables, timeline, exclusions, revisions", status: "pending" },
      { id: "doc2", label: "Service Contract", description: "Payment terms, IP rights, kill fee", status: "pending" },
      { id: "doc3", label: "Digital Signing", description: "Send SOW & Contract via DocuSign/HelloSign", status: "pending" },
      { id: "doc4", label: "Deposit Received", description: "Confirm deposit payment in bank", status: "pending" },
    ],
  },
  {
    id: "production",
    number: 3,
    title: "Production & Review Cycles",
    subtitle: "Execute vision and manage client feedback",
    icon: "layers",
    color: "emerald",
    status: "pending",
    tasks: [
      { id: "p1", label: "Internal Sprint", description: "Team executes first draft", status: "pending" },
      { id: "p2", label: "Quality Assurance", description: "Creative Director reviews against SOW & Brief", status: "pending" },
      { id: "p3", label: "Sanity Check", description: "Verify solution solves Phase 1 problem", status: "pending" },
      { id: "p4", label: "Reveal Presentation", description: "Schedule call to walk through work", status: "pending" },
      { id: "p5", label: "Feedback Round 1", description: "Consolidated feedback from client team", status: "pending" },
      { id: "p6", label: "Implement Changes", description: "Apply Round 1 revisions", status: "pending" },
      { id: "p7", label: "Feedback Round 2", description: "Minor tweaks and refinements", status: "pending" },
      { id: "p8", label: "Final Polish", description: "Complete all refinements", status: "pending" },
    ],
  },
  {
    id: "delivery",
    number: 4,
    title: "Project Delivery & Offboarding",
    subtitle: "Hand over assets and build future relationships",
    icon: "package",
    color: "amber",
    status: "pending",
    tasks: [
      { id: "del1", label: "Final Approval", description: "Get written sign-off on final version", status: "pending" },
      { id: "del2", label: "Final Invoice", description: "Send invoice for remaining balance", status: "pending" },
      { id: "del3", label: "Payment Cleared", description: "Confirm final payment received", status: "pending" },
      { id: "del4", label: "Asset Pack", description: "Organize delivery folder (Logo, Fonts, Guidelines, Source)", status: "pending" },
      { id: "del5", label: "Client Training", description: "Record Loom walkthrough if applicable", status: "pending" },
      { id: "del6", label: "Review Request", description: "Send Google Reviews / Clutch link", status: "pending" },
      { id: "del7", label: "Case Study", description: "Gather assets for portfolio", status: "pending" },
    ],
  },
];

const phaseColors: Record<string, { bg: string; border: string; text: string; light: string; gradient: string }> = {
  violet: { bg: "bg-violet-500", border: "border-violet-500", text: "text-violet-600", light: "bg-violet-50", gradient: "from-violet-500 to-purple-600" },
  blue: { bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-600", light: "bg-blue-50", gradient: "from-blue-500 to-indigo-600" },
  emerald: { bg: "bg-emerald-500", border: "border-emerald-500", text: "text-emerald-600", light: "bg-emerald-50", gradient: "from-emerald-500 to-teal-600" },
  amber: { bg: "bg-amber-500", border: "border-amber-500", text: "text-amber-600", light: "bg-amber-50", gradient: "from-amber-500 to-orange-600" },
};

function PhaseIcon({ icon, className }: { icon: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    compass: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm3.5-13.5l-5 2.5-2.5 5 5-2.5 2.5-5z" />,
    "file-text": <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>,
    layers: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
    package: <><line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[icon]}
    </svg>
  );
}

export default function ProjectWorkflows({ projectId }: { projectId: string }) {
  const [workflow, setWorkflow] = useState<WorkflowPhase[]>(defaultWorkflow);
  const [expandedPhase, setExpandedPhase] = useState<string | null>("discovery");
  const [saving, setSaving] = useState(false);

  // Load workflow from database
  useEffect(() => {
    async function loadWorkflow() {
      const { data } = await supabaseClient
        .from("project_workflows")
        .select("workflow_data")
        .eq("project_id", projectId)
        .single();

      if (data?.workflow_data) {
        setWorkflow(data.workflow_data as WorkflowPhase[]);
      }
    }
    loadWorkflow();
  }, [projectId]);

  // Save workflow
  async function saveWorkflow(updatedWorkflow: WorkflowPhase[]) {
    setSaving(true);
    await supabaseClient
      .from("project_workflows")
      .upsert({
        project_id: projectId,
        workflow_data: updatedWorkflow,
        updated_at: new Date().toISOString(),
      }, { onConflict: "project_id" });
    setSaving(false);
  }

  function toggleTask(phaseId: string, taskId: string) {
    const updated = workflow.map((phase) => {
      if (phase.id !== phaseId) return phase;

      const updatedTasks = phase.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const newStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";
        return { ...task, status: newStatus };
      });

      // Calculate phase status
      const completedCount = updatedTasks.filter((t) => t.status === "completed").length;
      let phaseStatus: PhaseStatus = "pending";
      if (completedCount === updatedTasks.length) phaseStatus = "completed";
      else if (completedCount > 0) phaseStatus = "in_progress";

      return { ...phase, tasks: updatedTasks, status: phaseStatus };
    });

    setWorkflow(updated);
    saveWorkflow(updated);
  }

  // Calculate overall progress
  const totalTasks = workflow.reduce((sum, p) => sum + p.tasks.length, 0);
  const completedTasks = workflow.reduce((sum, p) => sum + p.tasks.filter((t) => t.status === "completed").length, 0);
  const overallProgress = Math.round((completedTasks / totalTasks) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-6 text-white shadow-2xl">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Project Workflow</h2>
            <p className="text-sm text-white/70">Track progress through discovery, documentation, production & delivery</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-3xl font-bold">{overallProgress}%</p>
              <p className="text-xs text-white/60">{completedTasks}/{totalTasks} tasks</p>
            </div>
            <div className="relative h-16 w-16">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="white" strokeWidth="3" strokeDasharray={`${overallProgress}, 100`} strokeLinecap="round" />
              </svg>
              {saving && <div className="absolute inset-0 flex items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /></div>}
            </div>
          </div>
        </div>

        {/* Phase Progress Bar */}
        <div className="mt-6 flex items-center gap-2">
          {workflow.map((phase, index) => {
            const phaseProgress = phase.tasks.filter((t) => t.status === "completed").length / phase.tasks.length;
            return (
              <div key={phase.id} className="flex flex-1 items-center">
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-white/60">Phase {phase.number}</span>
                    <span className="text-[10px] font-bold text-white/80">{Math.round(phaseProgress * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full bg-gradient-to-r ${phaseColors[phase.color].gradient} transition-all duration-500`} style={{ width: `${phaseProgress * 100}%` }} />
                  </div>
                </div>
                {index < workflow.length - 1 && (
                  <div className="mx-2 flex h-6 w-6 items-center justify-center">
                    <svg className="h-4 w-4 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Workflow Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-[27px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-violet-300 via-blue-300 via-emerald-300 to-amber-300" />

        <div className="space-y-4">
          {workflow.map((phase) => {
            const colors = phaseColors[phase.color];
            const isExpanded = expandedPhase === phase.id;
            const phaseProgress = phase.tasks.filter((t) => t.status === "completed").length;

            return (
              <div key={phase.id} className="relative pl-16">
                {/* Phase Node */}
                <button
                  type="button"
                  onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                  className={`absolute left-0 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-all ${
                    phase.status === "completed"
                      ? `bg-gradient-to-br ${colors.gradient} text-white`
                      : phase.status === "in_progress"
                        ? `${colors.light} ${colors.text} ring-4 ring-offset-2 ${colors.border}/30`
                        : "bg-white text-slate-400 ring-2 ring-slate-200"
                  }`}
                >
                  {phase.status === "completed" ? (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <PhaseIcon icon={phase.icon} className="h-6 w-6" />
                  )}
                </button>

                {/* Phase Card */}
                <div className={`rounded-2xl border transition-all ${isExpanded ? "border-slate-200 bg-white shadow-xl" : "border-slate-100 bg-slate-50/50"}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold ${colors.light} ${colors.text}`}>
                          {phase.number}
                        </span>
                        <h3 className="text-[15px] font-bold text-slate-900">{phase.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          phase.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                          phase.status === "in_progress" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-500"
                        }`}>
                          {phase.status === "in_progress" ? "In Progress" : phase.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-slate-500">{phase.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] font-semibold text-slate-500">{phaseProgress}/{phase.tasks.length}</span>
                      <svg className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                    </div>
                  </button>

                  {/* Tasks */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4">
                      <div className="grid gap-2">
                        {phase.tasks.map((task) => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => toggleTask(phase.id, task.id)}
                            className={`flex items-center gap-3 rounded-xl p-3 text-left transition-all ${
                              task.status === "completed" ? "bg-emerald-50" : "bg-slate-50 hover:bg-slate-100"
                            }`}
                          >
                            <span className={`flex h-6 w-6 items-center justify-center rounded-lg transition-all ${
                              task.status === "completed"
                                ? "bg-emerald-500 text-white"
                                : "border-2 border-slate-300 bg-white"
                            }`}>
                              {task.status === "completed" && (
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                              )}
                            </span>
                            <div className="flex-1">
                              <p className={`text-[13px] font-medium ${task.status === "completed" ? "text-emerald-800" : "text-slate-800"}`}>
                                {task.label}
                              </p>
                              <p className={`text-[11px] ${task.status === "completed" ? "text-emerald-600/70" : "text-slate-500"}`}>
                                {task.description}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Checklist Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h3 className="text-[14px] font-bold text-slate-900 mb-4">Project Manager Checklist</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Discovery", phase: "discovery", check: workflow[0].status === "completed" },
            { label: "Docs Signed", phase: "documentation", check: workflow[1].tasks[2]?.status === "completed" },
            { label: "Deposit Received", phase: "documentation", check: workflow[1].tasks[3]?.status === "completed" },
            { label: "Draft Approved", phase: "production", check: workflow[2].tasks[2]?.status === "completed" },
            { label: "Round 1 Complete", phase: "production", check: workflow[2].tasks[5]?.status === "completed" },
            { label: "Round 2 Complete", phase: "production", check: workflow[2].tasks[7]?.status === "completed" },
            { label: "Final Paid", phase: "delivery", check: workflow[3].tasks[2]?.status === "completed" },
            { label: "Files Delivered", phase: "delivery", check: workflow[3].tasks[3]?.status === "completed" },
          ].map((item) => (
            <div key={item.label} className={`flex items-center gap-2 rounded-xl p-3 ${item.check ? "bg-emerald-50" : "bg-slate-50"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-md ${item.check ? "bg-emerald-500 text-white" : "border border-slate-300 bg-white"}`}>
                {item.check && <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
              </span>
              <span className={`text-[11px] font-semibold ${item.check ? "text-emerald-700" : "text-slate-600"}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
