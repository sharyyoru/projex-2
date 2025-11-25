import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Helper: Verify user session from Authorization header
async function verifySession(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "") || request.cookies.get("sb-access-token")?.value;
  
  if (!token) {
    // Fallback: get session from Supabase client cookie
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/sb-[^-]+-auth-token=([^;]+)/);
    if (match) {
      try {
        const parsed = JSON.parse(decodeURIComponent(match[1]));
        if (parsed?.[0]?.access_token) {
          const { data } = await supabaseAdmin.auth.getUser(parsed[0].access_token);
          return data.user;
        }
      } catch {}
    }
    return null;
  }
  
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user;
}

// Helper: Check if user is admin/hr
async function isAdminOrHR(userId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role === "admin" || data?.role === "hr";
}

// GET - Fetch leave requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    const all = searchParams.get("all") === "true";

    let query = supabaseAdmin.from("leaves").select(`
      *,
      user:users!leaves_user_id_fkey(id, full_name, email, avatar_url),
      reviewer:users!leaves_reviewed_by_fkey(id, full_name)
    `);

    if (!all && userId) {
      query = query.eq("user_id", userId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ leaves: data });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 });
  }
}

// POST - Create leave request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, leaveType, startDate, endDate, reason } = body;

    if (!userId || !leaveType || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Calculate days count
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Validate against available balance
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("annual_leave_used, annual_leave_total, sick_leave_used, sick_leave_total")
      .eq("id", userId)
      .single();

    if (userError) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (leaveType === "annual") {
      const available = (userData.annual_leave_total || 30) - (userData.annual_leave_used || 0);
      if (daysCount > available) {
        return NextResponse.json(
          { error: `Insufficient annual leave balance. Available: ${available} days` },
          { status: 400 }
        );
      }
    } else if (leaveType === "sick") {
      const available = (userData.sick_leave_total || 90) - (userData.sick_leave_used || 0);
      if (daysCount > available) {
        return NextResponse.json(
          { error: `Insufficient sick leave balance. Available: ${available} days` },
          { status: 400 }
        );
      }
    }

    // Create leave request
    const { data, error } = await supabaseAdmin
      .from("leaves")
      .insert({
        user_id: userId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        days_count: daysCount,
        reason: reason || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ leave: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create leave request" }, { status: 500 });
  }
}

// PATCH - Update leave status (approve/reject) - ADMIN ONLY
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { leaveId, status, reviewedBy, reviewNotes } = body;

    if (!leaveId || !status || !reviewedBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Security: Verify the reviewer is admin/hr
    const isAdmin = await isAdminOrHR(reviewedBy);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized. Only admin/hr can approve or reject leave requests." },
        { status: 403 }
      );
    }

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    // Get leave details first
    const { data: leaveData, error: leaveError } = await supabaseAdmin
      .from("leaves")
      .select("*")
      .eq("id", leaveId)
      .single();

    if (leaveError || !leaveData) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (leaveData.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending leave requests can be updated" },
        { status: 400 }
      );
    }

    // Update leave status
    const { data, error } = await supabaseAdmin
      .from("leaves")
      .update({
        status,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leaveId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If approved, update user's leave balance
    if (status === "approved") {
      // Fetch current user balance first
      const { data: currentUser } = await supabaseAdmin
        .from("users")
        .select("annual_leave_used, sick_leave_used")
        .eq("id", leaveData.user_id)
        .single();

      if (leaveData.leave_type === "annual") {
        const currentUsed = currentUser?.annual_leave_used || 0;
        await supabaseAdmin
          .from("users")
          .update({ annual_leave_used: currentUsed + leaveData.days_count })
          .eq("id", leaveData.user_id);
      } else if (leaveData.leave_type === "sick") {
        const currentUsed = currentUser?.sick_leave_used || 0;
        await supabaseAdmin
          .from("users")
          .update({ sick_leave_used: currentUsed + leaveData.days_count })
          .eq("id", leaveData.user_id);
      }
    }

    return NextResponse.json({ leave: data });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update leave request" }, { status: 500 });
  }
}
