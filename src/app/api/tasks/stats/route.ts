import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// GET - Fetch task statistics for dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Count tasks completed today
    const { count: completedToday } = await supabaseAdmin
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", startOfDay.toISOString())
      .lt("completed_at", endOfDay.toISOString());

    // Also check for tasks with updated_at today and status = completed (fallback)
    const { count: completedTodayFallback } = await supabaseAdmin
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_user_id", userId)
      .eq("status", "completed")
      .gte("updated_at", startOfDay.toISOString())
      .lt("updated_at", endOfDay.toISOString());

    // Count pending tasks (not completed)
    const { count: pendingCount } = await supabaseAdmin
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_user_id", userId)
      .neq("status", "completed");

    // Count in-progress tasks
    const { count: inProgressCount } = await supabaseAdmin
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_user_id", userId)
      .eq("status", "in_progress");

    // Count overdue tasks (activity_date < today and not completed)
    const { count: overdueCount } = await supabaseAdmin
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_user_id", userId)
      .neq("status", "completed")
      .lt("activity_date", startOfDay.toISOString());

    const finishedToday = Math.max(completedToday || 0, completedTodayFallback || 0);

    return NextResponse.json({
      stats: {
        finishedToday,
        pending: pendingCount || 0,
        inProgress: inProgressCount || 0,
        overdue: overdueCount || 0,
      },
    });
  } catch (err) {
    console.error("Error fetching task stats:", err);
    return NextResponse.json({ error: "Failed to fetch task statistics" }, { status: 500 });
  }
}
