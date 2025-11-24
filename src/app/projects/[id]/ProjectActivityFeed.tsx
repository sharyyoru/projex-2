"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type ActivityKind = "note" | "task" | "invoice" | "deal" | "file";

type TaskStatus = "not_started" | "in_progress" | "completed";

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  body: string | null;
  meta: string;
  at: string | null;
  taskStatus?: TaskStatus | null;
  taskId?: string | null;
};

function parseTimestamp(value: string | null): number {
  if (!value) return 0;
  const d = new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function formatShortDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatMoneyAed(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value);
}

export function useProjectActivityFeed(
  projectId: string,
  options?: { includeDeals?: boolean; includeInvoices?: boolean; reloadKey?: number },
) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const includeDeals = options?.includeDeals ?? true;
  const includeInvoices = options?.includeInvoices ?? true;
  const reloadKey = options?.reloadKey ?? 0;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const notesPromise = supabaseClient
          .from("project_notes")
          .select("id, body, author_name, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });
        const tasksPromise = supabaseClient
          .from("tasks")
          .select(
            "id, project_id, name, content, status, priority, activity_date, created_at",
          )
          .eq("project_id", projectId)
          .order("activity_date", { ascending: false });
        const dealsPromise = includeDeals
          ? supabaseClient
              .from("deals")
              .select("id, project_id, title, pipeline, value, created_at")
              .eq("project_id", projectId)
              .order("created_at", { ascending: false })
          : Promise.resolve({
              data: null,
              error: null,
            } as { data: any[] | null; error: { message?: string } | null });
        const invoicesPromise = includeInvoices
          ? supabaseClient
              .from("consultations")
              .select(
                "id, project_id, title, content, record_type, scheduled_at, payment_method, invoice_total_amount, invoice_is_complimentary, invoice_is_paid, created_at",
              )
              .eq("project_id", projectId)
              .eq("record_type", "invoice")
              .order("scheduled_at", { ascending: false })
          : Promise.resolve({
              data: null,
              error: null,
            } as { data: any[] | null; error: { message?: string } | null });

        const [notesResult, tasksResult, dealsResult, invoicesResult] =
          await Promise.all([
            notesPromise,
            tasksPromise,
            dealsPromise,
            invoicesPromise,
          ]);

        if (!isMounted) return;

        const all: ActivityItem[] = [];

        {
          const { data, error } = notesResult;
          if (error) {
            setError((prev) => prev ?? error.message ?? "Failed to load notes.");
          } else if (data) {
            for (const row of data as any[]) {
              const rawBody = (row.body as string | null) ?? null;
              const body = rawBody;

              const isFileUpload =
                !!body &&
                (body.startsWith("Uploaded file \"") ||
                  (body.startsWith("Uploaded ") &&
                    body.includes(" files to the project files: ")));

              const kind: ActivityKind = isFileUpload ? "file" : "note";
              const title = isFileUpload ? "File" : "Note";
              const idPrefix = isFileUpload ? "file" : "note";

              all.push({
                id: `${idPrefix}-${row.id as string}`,
                kind,
                title,
                body,
                meta: ((row.author_name as string | null) ?? "Unknown author").toString(),
                at: (row.created_at as string) ?? null,
              });
            }
          }
        }

        {
          const { data, error } = tasksResult;
          if (error) {
            setError((prev) => prev ?? error.message ?? "Failed to load tasks.");
          } else if (data) {
            for (const row of data as any[]) {
              const name = (row.name as string) ?? "Task";
              const status = (row.status as string | null) as TaskStatus | null;
              const priority = (row.priority as string | null) ?? null;
              const at =
                ((row.activity_date as string | null) ??
                  (row.created_at as string | null)) ?? null;

              const metaParts: string[] = [];
              if (status) metaParts.push(status.replace("_", " "));
              if (priority) metaParts.push(`Priority ${priority}`);

              all.push({
                id: `task-${row.id as string}`,
                kind: "task",
                title: name,
                body: (row.content as string | null) ?? null,
                meta: metaParts.join(" • ") || "Task",
                at,
                taskStatus: status,
                taskId: (row.id as string) ?? null,
              });
            }
          }
        }

        {
          const { data, error } = dealsResult;
          if (error) {
            setError((prev) => prev ?? error.message ?? "Failed to load deals.");
          } else if (data) {
            for (const row of data as any[]) {
              const title = (row.title as string | null) ?? "Deal";
              const pipeline = (row.pipeline as string | null) ?? null;
              const value = (row.value as number | null) ?? null;

              const metaParts: string[] = [];
              if (pipeline) metaParts.push(pipeline);
              if (value !== null) metaParts.push(formatMoneyAed(value));

              all.push({
                id: `deal-${row.id as string}`,
                kind: "deal",
                title,
                body: null,
                meta: metaParts.join(" • ") || "Deal",
                at: (row.created_at as string | null) ?? null,
              });
            }
          }
        }

        {
          const { data, error } = invoicesResult;
          if (error) {
            setError((prev) => prev ?? error.message ?? "Failed to load invoices.");
          } else if (data) {
            for (const row of data as any[]) {
              const title = (row.title as string | null) ?? "Invoice";
              const method = (row.payment_method as string | null) ?? null;
              const amount = (row.invoice_total_amount as number | null) ?? null;
              const isComplimentary =
                ((row.invoice_is_complimentary as boolean | null) ?? false) &&
                amount !== null;
              const isPaid = (row.invoice_is_paid as boolean | null) ?? false;

              const metaParts: string[] = [];
              if (method) metaParts.push(method);
              if (amount !== null) metaParts.push(formatMoneyAed(amount));
              if (isComplimentary) {
                metaParts.push("Complimentary");
              } else {
                metaParts.push(isPaid ? "Paid" : "Unpaid");
              }

              const at =
                ((row.scheduled_at as string | null) ??
                  (row.created_at as string | null)) ?? null;

              all.push({
                id: `invoice-${row.id as string}`,
                kind: "invoice",
                title,
                body: null,
                meta: metaParts.join(" • ") || "Invoice",
                at,
              });
            }
          }
        }

        all.sort((a, b) => parseTimestamp(b.at) - parseTimestamp(a.at));

        setItems(all);
        setLoading(false);
      } catch {
        if (!isMounted) return;
        setError("Failed to load project activity.");
        setItems([]);
        setLoading(false);
      }
    }

    void load();

    return () => {
      setLoading(false);
    }
  }, [projectId, includeDeals, includeInvoices, reloadKey]);

  const hasItems = useMemo(() => items.length > 0, [items]);

  return { items, loading, error, hasItems };
}

export default function ProjectActivityFeed({
  projectId,
}: {
  projectId: string;
}) {
  const { items, loading, error, hasItems } = useProjectActivityFeed(projectId);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
          <p className="text-[11px] text-slate-500">
            Notes, tasks, invoices, and deals for this project.
          </p>
        </div>
        <p className="text-[11px] text-slate-400">{items.length} entries</p>
      </div>

      {loading ? (
        <p className="text-[11px] text-slate-500">Loading activity…</p>
      ) : error ? (
        <p className="text-[11px] text-red-600">{error}</p>
      ) : !hasItems ? (
        <p className="text-[11px] text-slate-500">No activity yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                      (item.kind === "note" || item.kind === "file"
                        ? "bg-slate-900 text-slate-50"
                        : item.kind === "task"
                        ? "bg-emerald-50 text-emerald-700"
                        : item.kind === "invoice"
                        ? "bg-sky-50 text-sky-700"
                        : "bg-amber-50 text-amber-700")
                    }
                  >
                    {item.kind === "note"
                      ? "Note"
                      : item.kind === "task"
                      ? "Task"
                      : item.kind === "invoice"
                      ? "Invoice"
                      : item.kind === "file"
                      ? "File"
                      : "Deal"}
                  </span>
                  <p className="text-[11px] font-medium text-slate-900">
                    {item.title}
                  </p>
                </div>
                {item.body ? (
                  <p className="text-[11px] text-slate-700">{item.body}</p>
                ) : null}
                <p className="text-[10px] text-slate-500">{item.meta}</p>
              </div>
              <p className="shrink-0 text-[10px] text-slate-400">
                {formatShortDateTime(item.at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
