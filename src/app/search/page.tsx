"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type PatientHit = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  contact_owner_name: string | null;
};

type DealHit = {
  id: string;
  patient_id: string;
  title: string | null;
  pipeline: string | null;
  notes: string | null;
};

type TaskHit = {
  id: string;
  patient_id: string;
  name: string;
  content: string | null;
};

type ServiceHit = {
  id: string;
  name: string;
  description: string | null;
};

export default function GlobalSearchPage() {
  const searchParams = useSearchParams();
  const rawQuery = searchParams.get("q") ?? "";
  const trimmedQuery = rawQuery.trim();

  const [patients, setPatients] = useState<PatientHit[]>([]);
  const [deals, setDeals] = useState<DealHit[]>([]);
  const [tasks, setTasks] = useState<TaskHit[]>([]);
  const [services, setServices] = useState<ServiceHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      if (!trimmedQuery) {
        setPatients([]);
        setDeals([]);
        setTasks([]);
        setServices([]);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const normalized = trimmedQuery.toLowerCase();
        const escaped = normalized.replace(/[%]/g, "");
        const pattern = `%${escaped}%`;

        const [patientsResult, dealsResult, tasksResult, servicesResult] =
          await Promise.all([
            supabaseClient
              .from("patients")
              .select(
                "id, first_name, last_name, email, phone, contact_owner_name",
              )
              .or(
                `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`,
              )
              .limit(8),
            supabaseClient
              .from("deals")
              .select("id, patient_id, title, pipeline, notes")
              .or(
                `title.ilike.${pattern},pipeline.ilike.${pattern},notes.ilike.${pattern}`,
              )
              .limit(8),
            supabaseClient
              .from("tasks")
              .select("id, patient_id, name, content")
              .or(`name.ilike.${pattern},content.ilike.${pattern}`)
              .limit(8),
            supabaseClient
              .from("services")
              .select("id, name, description")
              .or(`name.ilike.${pattern},description.ilike.${pattern}`)
              .limit(8),
          ]);

        if (cancelled) return;

        if (
          patientsResult.error ||
          dealsResult.error ||
          tasksResult.error ||
          servicesResult.error
        ) {
          const message =
            patientsResult.error?.message ??
            dealsResult.error?.message ??
            tasksResult.error?.message ??
            servicesResult.error?.message ??
            "Failed to run search.";
          setError(message);
          setPatients([]);
          setDeals([]);
          setTasks([]);
          setServices([]);
          setLoading(false);
          return;
        }

        setPatients((patientsResult.data ?? []) as PatientHit[]);
        setDeals((dealsResult.data ?? []) as DealHit[]);
        setTasks((tasksResult.data ?? []) as TaskHit[]);
        setServices((servicesResult.data ?? []) as ServiceHit[]);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError("Failed to run search.");
        setPatients([]);
        setDeals([]);
        setTasks([]);
        setServices([]);
        setLoading(false);
      }
    }

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [trimmedQuery]);

  const totalResults = useMemo(
    () => patients.length + deals.length + tasks.length + services.length,
    [patients.length, deals.length, tasks.length, services.length],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-slate-900">Search</h1>
        <p className="text-xs text-slate-500">
          Search across patients, deals, tasks, and services.
        </p>
      </header>

      {!trimmedQuery ? (
        <p className="text-xs text-slate-500">
          Use the search bar in the header to find any content across the CRM.
        </p>
      ) : loading ? (
        <p className="text-xs text-slate-500">Searching for "{trimmedQuery}"...</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : totalResults === 0 ? (
        <p className="text-xs text-slate-500">
          No results found for "{trimmedQuery}".
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {patients.length > 0 ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Patients</h2>
                <span className="text-[11px] text-slate-400">
                  {patients.length} match{patients.length === 1 ? "" : "es"}
                </span>
              </div>
              <ul className="space-y-1.5">
                {patients.map((patient) => {
                  const fullName = `${patient.first_name ?? ""} ${
                    patient.last_name ?? ""
                  }`
                    .trim()
                    .replace(/\s+/g, " ");
                  return (
                    <li key={patient.id}>
                      <Link
                        href={`/patients/${patient.id}`}
                        className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-slate-800 hover:bg-slate-100"
                      >
                        <div>
                          <p className="text-[11px] font-semibold text-sky-700">
                            {fullName || "Unnamed patient"}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {patient.email || patient.phone || "No contact details"}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {patient.contact_owner_name || "Unassigned"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {deals.length > 0 ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Deals</h2>
                <span className="text-[11px] text-slate-400">
                  {deals.length} match{deals.length === 1 ? "" : "es"}
                </span>
              </div>
              <ul className="space-y-1.5">
                {deals.map((deal) => (
                  <li key={deal.id}>
                    <Link
                      href={`/patients/${deal.patient_id}?mode=crm&tab=deals`}
                      className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-slate-800 hover:bg-slate-100"
                    >
                      <div>
                        <p className="text-[11px] font-semibold text-slate-800">
                          {deal.title || "Untitled deal"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {deal.pipeline || "Pipeline"}
                        </p>
                      </div>
                      <span className="line-clamp-2 max-w-[160px] text-right text-[10px] text-slate-400">
                        {deal.notes || ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tasks.length > 0 ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Tasks</h2>
                <span className="text-[11px] text-slate-400">
                  {tasks.length} match{tasks.length === 1 ? "" : "es"}
                </span>
              </div>
              <ul className="space-y-1.5">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/patients/${task.patient_id}?mode=crm&tab=tasks`}
                      className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-slate-800 hover:bg-slate-100"
                    >
                      <div>
                        <p className="text-[11px] font-semibold text-slate-800">
                          {task.name}
                        </p>
                        {task.content ? (
                          <p className="line-clamp-2 text-[11px] text-slate-500">
                            {task.content}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {services.length > 0 ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Services</h2>
                <span className="text-[11px] text-slate-400">
                  {services.length} match{services.length === 1 ? "" : "es"}
                </span>
              </div>
              <ul className="space-y-1.5">
                {services.map((service) => (
                  <li key={service.id}>
                    <Link
                      href="/services"
                      className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-slate-800 hover:bg-slate-100"
                    >
                      <div>
                        <p className="text-[11px] font-semibold text-slate-800">
                          {service.name}
                        </p>
                        {service.description ? (
                          <p className="line-clamp-2 text-[11px] text-slate-500">
                            {service.description}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
