import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// GET - Fetch user's leave balance
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("annual_leave_used, annual_leave_total, sick_leave_used, sick_leave_total")
      .eq("id", userId)
      .single();

    if (error) {
      // If user doesn't exist in users table, return defaults
      if (error.code === "PGRST116") {
        return NextResponse.json({
          balance: {
            annualLeaveUsed: 0,
            annualLeaveTotal: 30,
            annualLeaveRemaining: 30,
            sickLeaveUsed: 0,
            sickLeaveTotal: 90,
            sickLeaveRemaining: 90,
          },
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const annualLeaveUsed = data.annual_leave_used || 0;
    const annualLeaveTotal = data.annual_leave_total || 30;
    const sickLeaveUsed = data.sick_leave_used || 0;
    const sickLeaveTotal = data.sick_leave_total || 90;

    return NextResponse.json({
      balance: {
        annualLeaveUsed,
        annualLeaveTotal,
        annualLeaveRemaining: annualLeaveTotal - annualLeaveUsed,
        sickLeaveUsed,
        sickLeaveTotal,
        sickLeaveRemaining: sickLeaveTotal - sickLeaveUsed,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch leave balance" }, { status: 500 });
  }
}
