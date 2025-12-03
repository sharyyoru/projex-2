import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Create a call invite for guests
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { channel_id, server_id, max_uses, expires_in_minutes } = body;

    if (!channel_id) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 });
    }

    // Verify user is a member and has permission
    if (server_id) {
      const { data: membership } = await supabaseAdmin
        .from("dischat_members")
        .select("is_owner, is_admin")
        .eq("server_id", server_id)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: "Not a member of this server" }, { status: 403 });
      }
    }

    // Generate invite code
    const code = `call_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    // Calculate expiry
    let expiresAt = null;
    if (expires_in_minutes) {
      expiresAt = new Date(Date.now() + expires_in_minutes * 60 * 1000).toISOString();
    }

    // Create invite
    const { data: invite, error } = await supabaseAdmin
      .from("dischat_call_invites")
      .insert({
        channel_id,
        server_id: server_id || null,
        code,
        created_by: user.id,
        max_uses: max_uses || null,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating call invite:", error);
      return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
    }

    // Generate full invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/dischat/call/${code}`;

    return NextResponse.json({ 
      invite,
      inviteUrl,
      code,
    });
  } catch (error) {
    console.error("Error creating call invite:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET - Get active call invites for a channel
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channel_id");

    if (!channelId) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 });
    }

    const { data: invites } = await supabaseAdmin
      .from("dischat_call_invites")
      .select("*")
      .eq("channel_id", channelId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false });

    return NextResponse.json({ invites: invites || [] });
  } catch (error) {
    console.error("Error fetching call invites:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
