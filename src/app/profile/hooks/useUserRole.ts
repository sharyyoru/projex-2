"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export type UserRole = "employee" | "admin" | "hr" | "staff" | null;

interface UseUserRoleResult {
  role: UserRole;
  userId: string | null;
  loading: boolean;
}

export function useUserRole(): UseUserRoleResult {
  const [role, setRole] = useState<UserRole>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchUserRole() {
      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!isMounted) return;

        if (!user) {
          setRole(null);
          setUserId(null);
          setLoading(false);
          return;
        }

        setUserId(user.id);

        // Check user metadata for role
        const meta = (user.user_metadata || {}) as Record<string, unknown>;
        const metaRole = (meta["role"] as string)?.toLowerCase();

        if (metaRole === "admin" || metaRole === "hr") {
          setRole(metaRole as UserRole);
        } else {
          // Default to employee
          setRole("employee");
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setRole("employee");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchUserRole();

    return () => {
      isMounted = false;
    };
  }, []);

  return { role, userId, loading };
}
