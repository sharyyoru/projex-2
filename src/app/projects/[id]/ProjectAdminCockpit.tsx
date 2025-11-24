"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type InvoiceRow = {
  id: string;
  project_id: string | null;
  title: string | null;
  content: string | null;
  record_type: string;
  scheduled_at: string | null;
  payment_method: string | null;
  invoice_total_amount: number | null;
  invoice_is_complimentary: boolean | null;
  invoice_is_paid: boolean | null;
};

type NormalizedInvoice = InvoiceRow & {
  amount: number;
  isComplimentary: boolean;
  isPaid: boolean;
};

type DealRow = {
  id: string;
  project_id: string | null;
  stage_id: string;
  pipeline: string | null;
  title: string | null;
  value: number | null;
  created_at: string;
};

function extractInvoiceInfoFromContent(content: string | null): {
  total: number;
  isComplimentary: boolean;
} {
  if (!content) {
    return { total: 0, isComplimentary: false };
  }

  const html = content;

  const isComplimentary =
    html.includes("Extra option:</strong> Complimentary service") ||
    html.includes("Extra option:</strong> Complimentary Service");

  let total = 0;
  const match = html.match(
    /Estimated total:<\/strong>\s*CHF\s*([0-9]+(?:\.[0-9]{1,2})?)/,
  );
  if (match) {
    const parsed = Number.parseFloat(match[1].replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed)) {
      total = parsed;
    }
  }

  return { total, isComplimentary };
}

function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0.00 CHF";
  return `${amount.toFixed(2)} CHF`;
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMoneyAed(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProjectAdminCockpit({
  projectId,
}: {
  projectId: string;
}) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [invoicesResult, dealsResult] = await Promise.all([
          supabaseClient
            .from("consultations")
            .select(
              "id, project_id, title, content, record_type, scheduled_at, payment_method, invoice_total_amount, invoice_is_complimentary, invoice_is_paid",
            )
            .eq("record_type", "invoice")
            .eq("project_id", projectId)
            .order("scheduled_at", { ascending: false }),
          supabaseClient
            .from("deals")
            .select(
              "id, project_id, stage_id, pipeline, title, value, created_at",
            )
            .eq("project_id", projectId)
            .order("created_at", { ascending: false }),
        ]);

        if (!isMounted) return;

        const { data: invoicesData, error: invoicesError } = invoicesResult;
        const { data: dealsData, error: dealsError } = dealsResult;

        if (invoicesError && !invoicesData) {
          setError(invoicesError.message ?? "Failed to load invoices.");
          setInvoices([]);
        } else if (invoicesData) {
          setInvoices(invoicesData as InvoiceRow[]);
        } else {
          setInvoices([]);
        }

        if (dealsError && !dealsData) {
          setError((prev) => prev ?? dealsError.message ?? "Failed to load deals.");
          setDeals([]);
        } else if (dealsData) {
          setDeals(dealsData as DealRow[]);
        } else {
          setDeals([]);
        }

        setLoading(false);
      } catch {
        if (!isMounted) return;
        setError("Failed to load project financial data.");
        setInvoices([]);
        setDeals([]);
        setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const normalizedInvoices = useMemo<NormalizedInvoice[]>(() => {
    if (!invoices || invoices.length === 0) return [];

    return invoices.map((row) => {
      const { total: parsedTotal, isComplimentary } =
        extractInvoiceInfoFromContent(row.content ?? null);

      let amount = 0;
      const rawAmount = row.invoice_total_amount;
      if (rawAmount !== null && rawAmount !== undefined) {
        const numeric = Number(rawAmount);
        if (Number.isFinite(numeric) && numeric > 0) {
          amount = numeric;
        }
      } else if (parsedTotal > 0) {
        amount = parsedTotal;
      }

      const isPaid =
        typeof row.invoice_is_paid === "boolean" ? row.invoice_is_paid : false;

      return {
        ...row,
        amount,
        isComplimentary: isComplimentary && amount > 0,
        isPaid,
      };
    });
  }, [invoices]);

  const totals = useMemo(() => {
    let invoiceAmount = 0;
    let invoiceUnpaid = 0;
    let complimentary = 0;
    let dealTotal = 0;

    for (const inv of normalizedInvoices) {
      const amount = inv.amount;
      if (!Number.isFinite(amount) || amount <= 0) continue;

      if (inv.isComplimentary) {
        complimentary += amount;
      } else {
        invoiceAmount += amount;
        if (!inv.isPaid) {
          invoiceUnpaid += amount;
        }
      }
    }

    for (const deal of deals) {
      const value = deal.value;
      if (value !== null && value !== undefined) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
          dealTotal += numeric;
        }
      }
    }

    return { invoiceAmount, invoiceUnpaid, complimentary, dealTotal };
  }, [normalizedInvoices, deals]);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Admin cockpit</h3>
          <p className="text-[11px] text-slate-500">
            Invoices and deals linked to this project.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-[11px] text-slate-500">Loading admin data...</p>
      ) : error ? (
        <p className="text-[11px] text-red-600">{error}</p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[11px] font-medium text-slate-500">
                Invoiced amount
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {formatCurrency(totals.invoiceAmount)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[11px] font-medium text-slate-500">
                Outstanding invoices
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {formatCurrency(totals.invoiceUnpaid)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[11px] font-medium text-slate-500">
                Complimentary value
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {formatCurrency(totals.complimentary)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[11px] font-medium text-slate-500">
                Deals value (approx.)
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {formatMoneyAed(totals.dealTotal || null)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-slate-900">Invoices</h4>
                <p className="text-[10px] text-slate-500">
                  {normalizedInvoices.length} records
                </p>
              </div>
              {normalizedInvoices.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No invoices linked to this project yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {normalizedInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2"
                    >
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-medium text-slate-900">
                          {invoice.title || "Invoice"}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {formatShortDate(invoice.scheduled_at)} • {" "}
                          {invoice.payment_method || "Payment method not set"}
                        </p>
                      </div>
                      <div className="text-right text-[10px]">
                        <p className="font-semibold text-slate-900">
                          {invoice.amount > 0
                            ? formatCurrency(invoice.amount)
                            : "-"}
                        </p>
                        <p className="mt-0.5">
                          <span
                            className={
                              invoice.isComplimentary
                                ? "inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-50"
                                : invoice.isPaid
                                ? "inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                                : "inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                            }
                          >
                            {invoice.isComplimentary
                              ? "Complimentary"
                              : invoice.isPaid
                              ? "Paid"
                              : "Unpaid"}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-slate-900">Deals</h4>
                <p className="text-[10px] text-slate-500">{deals.length} records</p>
              </div>
              {deals.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No deals linked to this project yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {deals.map((deal) => (
                    <div
                      key={deal.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2"
                    >
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-medium text-slate-900">
                          {deal.title || "Untitled deal"}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {deal.pipeline || "Pipeline not set"} • {" "}
                          {formatShortDate(deal.created_at)}
                        </p>
                      </div>
                      <div className="text-right text-[10px]">
                        <p className="font-semibold text-slate-900">
                          {formatMoneyAed(deal.value)}
                        </p>
                        <p className="mt-0.5 text-slate-500">Stage: {deal.stage_id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
