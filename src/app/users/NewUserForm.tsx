"use client";

import { FormEvent, useState } from "react";

export default function NewUserForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const firstName = (formData.get("first_name") as string | null)?.trim();
    const lastName = (formData.get("last_name") as string | null)?.trim();
    const designation = (formData.get("designation") as string | null)?.trim();
    const email = (formData.get("email") as string | null)?.trim();
    const password = (formData.get("password") as string | null)?.trim();
    const role = ((formData.get("role") as string | null) || "staff").trim();

    if (!firstName || !lastName || !email || !password || !designation || !role) {
      setError("All fields are required.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          role,
          firstName,
          lastName,
          designation,
        }),
      });

      let json: any = null;
      try {
        json = await response.json();
      } catch {
        // non-JSON response, ignore
      }

      if (!response.ok) {
        setError(json?.error ?? "Failed to create user");
      } else {
        setSuccess("User created successfully.");
        form.reset();
      }
    } catch (err) {
      setError("Network or server error while creating user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white shadow-xl shadow-slate-200/30">
      {/* Gradient bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 to-purple-500" />
      
      {/* Decorative element */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-violet-100/40 to-purple-100/30 blur-2xl" />
      
      <form onSubmit={handleSubmit} className="relative p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
            <svg className="h-4.5 w-4.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M20 8v6M23 11h-6" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Invite Team Member</h2>
            <p className="text-[11px] text-slate-500">Add a new user to the system</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="first_name" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
              First Name *
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              required
              placeholder="John"
              className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="last_name" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
              Last Name *
            </label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              required
              placeholder="Doe"
              className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
              Email *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="john@company.com"
              className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
              Temporary Password *
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 pr-10 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                {showPassword ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.01-2.89 2.98-5.11 5.35-6.44" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c5 0 9.27 3.11 11 8-.62 1.77-1.67 3.32-3.02 4.57" />
                    <path d="M1 1l22 22" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="role" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
              Role *
            </label>
            <select
              id="role"
              name="role"
              defaultValue="staff"
              required
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-black shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="designation" className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
              Designation *
            </label>
            <input
              id="designation"
              name="designation"
              type="text"
              placeholder="e.g. Project Manager"
              required
              className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}
        
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
            {success}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-6 py-2.5 text-[13px] font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M20 8v6M23 11h-6" />
                </svg>
                Create User
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
