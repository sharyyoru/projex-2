import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Create an invite
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
    const { server_id, channel_id, max_uses, max_age_seconds, is_temporary } = body;

    if (!server_id) {
      return NextResponse.json({ error: "Server ID is required" }, { status: 400 });
    }

    // Check if user is a member
    const { data: membership } = await supabaseAdmin
      .from("dischat_members")
      .select("id")
      .eq("server_id", server_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this server" }, { status: 403 });
    }

    // Calculate expiry
    let expiresAt = null;
    if (max_age_seconds && max_age_seconds > 0) {
      expiresAt = new Date(Date.now() + max_age_seconds * 1000).toISOString();
    }

    // Create invite
    const { data: invite, error } = await supabaseAdmin
      .from("dischat_invites")
      .insert({
        server_id,
        channel_id: channel_id || null,
        inviter_id: user.id,
        max_uses: max_uses || null,
        max_age_seconds: max_age_seconds || null,
        is_temporary: is_temporary || false,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating invite:", error);
      return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
    }

    return NextResponse.json({ invite });
  } catch (error) {
    console.error("Error creating invite:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET - Get invite by code
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const { data: invite } = await supabaseAdmin
      .from("dischat_invites")
      .select("*, server:dischat_servers(id, name, icon_url, member_count)")
      .eq("code", code)
      .single();

    if (!invite) {
      return NextResponse.json({ error: "Invite not found or expired" }, { status: 404 });
    }

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
    }

    // Check if max uses reached
    if (invite.max_uses && invite.uses >= invite.max_uses) {
      return NextResponse.json({ error: "Invite has reached maximum uses" }, { status: 410 });
    }

    return NextResponse.json({ invite });
  } catch (error) {
    console.error("Error fetching invite:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
