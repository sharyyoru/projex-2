"use client";

import { useState } from "react";
import DashboardOverview from "./DashboardOverview";
import LeaveManagement from "./LeaveManagement";
import ProfileSecurity from "./ProfileSecurity";
import AdminLeavePortal from "./AdminLeavePortal";
import { useUserRole } from "./hooks/useUserRole";

type TabId = "dashboard" | "leave" | "profile" | "admin";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const { role, loading: roleLoading } = useUserRole();

  const isAdmin = role === "admin" || role === "hr";

  const tabs: { id: TabId; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      ),
    },
    {
      id: "leave",
      label: "Leave Management",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      id: "profile",
      label: "Profile & Security",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      id: "admin",
      label: "Admin Portal",
      adminOnly: true,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
  ];

  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Employee Dashboard</h1>
        <p className="text-sm text-slate-500">
          Manage your tasks, leave requests, and profile settings
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25"
                : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[60vh]">
        {activeTab === "dashboard" && <DashboardOverview />}
        {activeTab === "leave" && <LeaveManagement />}
        {activeTab === "profile" && <ProfileSecurity />}
        {activeTab === "admin" && isAdmin && <AdminLeavePortal />}
      </div>
    </div>
  );
}
