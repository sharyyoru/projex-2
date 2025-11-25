import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GET - Get AI leave recommendation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Get user's pending task count
    const { count: pendingTaskCount } = await supabaseAdmin
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_user_id", userId)
      .neq("status", "completed");

    // Get user's leave balance
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("annual_leave_used, annual_leave_total, sick_leave_used, sick_leave_total")
      .eq("id", userId)
      .single();

    const annualLeaveRemaining = (userData?.annual_leave_total || 30) - (userData?.annual_leave_used || 0);
    const sickLeaveRemaining = (userData?.sick_leave_total || 90) - (userData?.sick_leave_used || 0);

    // Get upcoming team events/deadlines (next 14 days)
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
    
    const { data: upcomingEvents } = await supabaseAdmin
      .from("team_schedule_events")
      .select("title, event_date, event_type, priority")
      .gte("event_date", new Date().toISOString().split("T")[0])
      .lte("event_date", twoWeeksFromNow.toISOString().split("T")[0])
      .order("event_date", { ascending: true });

    // Analyze workload and generate recommendation
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an HR assistant helping employees plan their leave. Based on the workload data provided, give a brief, friendly recommendation about whether it's a good time to take leave.

Consider:
- Number of pending tasks (high = busy, low = good time)
- Upcoming team events and deadlines
- Available leave balance
- UAE labor laws suggest employees take regular breaks

Keep your response to 2-3 sentences. Be specific about timing if possible.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            pendingTasks: pendingTaskCount || 0,
            annualLeaveRemaining,
            sickLeaveRemaining,
            upcomingEvents: upcomingEvents || [],
            currentDate: new Date().toISOString().split("T")[0],
          }),
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const recommendation = completion.choices[0]?.message?.content?.trim() || 
      "Unable to analyze workload at this time. Please check your task list and team calendar before planning leave.";

    // Determine workload level
    let workloadLevel: "low" | "medium" | "high" = "medium";
    if ((pendingTaskCount || 0) <= 3 && (!upcomingEvents || upcomingEvents.length === 0)) {
      workloadLevel = "low";
    } else if ((pendingTaskCount || 0) > 10 || (upcomingEvents && upcomingEvents.some((e: { priority: string }) => e.priority === "critical"))) {
      workloadLevel = "high";
    }

    return NextResponse.json({
      recommendation,
      workloadLevel,
      pendingTaskCount: pendingTaskCount || 0,
      upcomingEventsCount: upcomingEvents?.length || 0,
      annualLeaveRemaining,
    });
  } catch (err) {
    console.error("Error generating leave recommendation:", err);
    return NextResponse.json({
      recommendation: "Your workload appears manageable. Consider scheduling leave during quieter periods for maximum relaxation.",
      workloadLevel: "medium",
      pendingTaskCount: 0,
      upcomingEventsCount: 0,
      annualLeaveRemaining: 30,
    });
  }
}
