import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Join server via invite
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get invite
    const { data: invite } = await supabaseAdmin
      .from("dischat_invites")
      .select("*, server:dischat_servers(*)")
      .eq("code", code)
      .single();

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
    }

    // Check if max uses reached
    if (invite.max_uses && invite.uses >= invite.max_uses) {
      return NextResponse.json({ error: "Invite has reached maximum uses" }, { status: 410 });
    }

    // Check if already a member
    const { data: existingMembership } = await supabaseAdmin
      .from("dischat_members")
      .select("id")
      .eq("server_id", invite.server_id)
      .eq("user_id", user.id)
      .single();

    if (existingMembership) {
      return NextResponse.json({ 
        error: "Already a member of this server",
        server: invite.server 
      }, { status: 400 });
    }

    // Add user as member
    const { data: membership, error: memberError } = await supabaseAdmin
      .from("dischat_members")
      .insert({
        server_id: invite.server_id,
        user_id: user.id,
        status: "online",
      })
      .select()
      .single();

    if (memberError) {
      console.error("Error joining server:", memberError);
      return NextResponse.json({ error: "Failed to join server" }, { status: 500 });
    }

    // Increment invite uses
    await supabaseAdmin
      .from("dischat_invites")
      .update({ uses: invite.uses + 1 })
      .eq("id", invite.id);

    // Get default role and assign it
    const { data: defaultRole } = await supabaseAdmin
      .from("dischat_roles")
      .select("id")
      .eq("server_id", invite.server_id)
      .eq("is_default", true)
      .single();

    if (defaultRole) {
      await supabaseAdmin
        .from("dischat_member_roles")
        .insert({
          member_id: membership.id,
          role_id: defaultRole.id,
        });
    }

    return NextResponse.json({ 
      success: true,
      server: invite.server,
      membership 
    });
  } catch (error) {
    console.error("Error joining server:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
