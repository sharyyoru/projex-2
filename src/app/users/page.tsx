import { supabaseAdmin } from "@/lib/supabaseAdmin";
import NewUserForm from "./NewUserForm";

type UserRow = {
  id: string;
  email: string | null;
  role: string | null;
  firstName: string | null;
  lastName: string | null;
  designation: string | null;
  createdAt: string | null;
};

const ROLE_COLORS: Record<string, string> = {
  admin: "from-violet-500 to-purple-500",
  staff: "from-slate-500 to-gray-500",
};

async function getUsers(): Promise<UserRow[]> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 50,
  });

  if (error || !data?.users) {
    return [];
  }

  return data.users.map((user) => {
    const meta = (user.user_metadata || {}) as Record<string, unknown>;

    return {
      id: user.id,
      email: user.email ?? null,
      role: (meta["role"] as string) ?? null,
      firstName: (meta["first_name"] as string) ?? null,
      lastName: (meta["last_name"] as string) ?? null,
      designation: (meta["designation"] as string) ?? null,
      createdAt: (user as any).created_at ?? null,
    };
  });
}

export default async function UsersPage() {
  const users = await getUsers();
  const adminCount = users.filter(u => u.role === "admin").length;
  const staffCount = users.filter(u => u.role !== "admin").length;

  return (
    <div className="space-y-6">
      {/* Decorative gradient background */}
      <div className="pointer-events-none fixed top-[120px] right-0 h-[400px] w-[500px] overflow-hidden opacity-50">
        <div className="absolute top-0 -right-10 h-[300px] w-[400px] rounded-full bg-gradient-to-br from-slate-200/60 to-gray-200/40 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-gray-600 shadow-lg shadow-slate-500/30">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
              <p className="text-[13px] text-slate-500">
                Invite, manage, and configure roles for team members
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/50 bg-gradient-to-br from-slate-50 to-gray-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-slate-200/30 blur-2xl transition-all group-hover:bg-slate-300/40" />
          <p className="text-[11px] font-medium text-slate-600 uppercase tracking-wide">Total Users</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{users.length}</p>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-violet-200/50 bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-violet-200/30 blur-2xl transition-all group-hover:bg-violet-300/40" />
          <p className="text-[11px] font-medium text-violet-600 uppercase tracking-wide">Admins</p>
          <p className="mt-1 text-2xl font-bold text-violet-700">{adminCount}</p>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-sky-200/50 bg-gradient-to-br from-sky-50 to-cyan-50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-sky-200/30 blur-2xl transition-all group-hover:bg-sky-300/40" />
          <p className="text-[11px] font-medium text-sky-600 uppercase tracking-wide">Staff</p>
          <p className="mt-1 text-2xl font-bold text-sky-700">{staffCount}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <NewUserForm />
        
        {/* Team Members Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white shadow-xl shadow-slate-200/30">
          {/* Gradient bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-slate-500 to-gray-500" />
          
          {/* Decorative element */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-slate-100/40 to-gray-100/30 blur-2xl" />
          
          <div className="relative p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-gray-100">
                <svg className="h-4.5 w-4.5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Team Members</h2>
                <p className="text-[11px] text-slate-500">
                  {users.length} user{users.length !== 1 ? "s" : ""} in the system
                </p>
              </div>
            </div>

            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-gray-100">
                  <svg className="h-8 w-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <p className="mt-4 text-[14px] font-medium text-slate-700">No team members yet</p>
                <p className="mt-1 text-[12px] text-slate-500">Create your first team member using the form</p>
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => {
                  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
                  const initials = `${(user.firstName || "U").charAt(0)}${(user.lastName || "").charAt(0)}`.toUpperCase();
                  const roleColor = ROLE_COLORS[user.role || "staff"] || ROLE_COLORS.staff;

                  return (
                    <div
                      key={user.id}
                      className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-all hover:border-slate-200 hover:bg-white hover:shadow-sm"
                    >
                      {/* Avatar */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-200 to-gray-200 text-sm font-semibold text-slate-600">
                        {initials}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-medium text-slate-900 truncate">
                            {fullName || "Unnamed User"}
                          </p>
                          <span className={`inline-flex rounded-full bg-gradient-to-r px-2 py-0.5 text-[10px] font-semibold text-white capitalize ${roleColor}`}>
                            {user.role || "staff"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {user.email || "No email"} {user.designation ? `• ${user.designation}` : ""}
                        </p>
                      </div>
                      
                      {/* Date */}
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-400">Joined</p>
                        <p className="text-[11px] font-medium text-slate-600">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
