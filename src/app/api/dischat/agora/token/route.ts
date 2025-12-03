import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { RtcTokenBuilder, RtcRole } from "agora-token";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || "";

// POST - Generate Agora token for a channel
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    
    const body = await request.json();
    const { channel_id, server_id, is_guest, guest_code, uid } = body;

    if (!channel_id) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 });
    }

    let userId = uid || Math.floor(Math.random() * 100000);
    let userName = "Guest";
    let role = 1; // HOST role by default

    // Authenticated user
    if (authHeader && !is_guest) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Get user info
      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("id, full_name")
        .eq("id", user.id)
        .single();

      if (userData) {
        userName = userData.full_name || "User";
        // Generate a numeric UID from user ID
        userId = parseInt(user.id.replace(/-/g, "").substring(0, 8), 16) % 100000000;
      }

      // Verify membership if server_id provided
      if (server_id) {
        const { data: membership } = await supabaseAdmin
          .from("dischat_members")
          .select("id")
          .eq("server_id", server_id)
          .eq("user_id", user.id)
          .single();

        if (!membership) {
          return NextResponse.json({ error: "Not a member of this server" }, { status: 403 });
        }
      }
    } else if (is_guest && guest_code) {
      // Validate guest invite code
      const { data: invite } = await supabaseAdmin
        .from("dischat_call_invites")
        .select("*")
        .eq("code", guest_code)
        .eq("channel_id", channel_id)
        .single();

      if (!invite) {
        return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
      }

      // Check expiry
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        return NextResponse.json({ error: "Invite has expired" }, { status: 403 });
      }

      // Check max uses
      if (invite.max_uses && invite.uses >= invite.max_uses) {
        return NextResponse.json({ error: "Invite has reached max uses" }, { status: 403 });
      }

      // Increment uses
      await supabaseAdmin
        .from("dischat_call_invites")
        .update({ uses: invite.uses + 1 })
        .eq("id", invite.id);

      userName = `Guest_${userId}`;
    } else {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Generate channel name - must be alphanumeric only, max 64 chars
    // Remove dashes from UUIDs and limit length
    const sanitizedServerId = (server_id || "dm").replace(/-/g, "").substring(0, 12);
    const sanitizedChannelId = channel_id.replace(/-/g, "").substring(0, 12);
    const channelName = `ch${sanitizedServerId}${sanitizedChannelId}`;

    // Generate token
    let agoraToken = "";
    if (AGORA_APP_CERTIFICATE) {
      // Token expires in 1 hour
      const expirationTimeInSeconds = 3600;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
      
      agoraToken = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID, 
        AGORA_APP_CERTIFICATE, 
        channelName, 
        userId, 
        RtcRole.PUBLISHER,
        privilegeExpiredTs,
        privilegeExpiredTs
      );
    }

    return NextResponse.json({
      appId: AGORA_APP_ID,
      channel: channelName,
      token: agoraToken,
      uid: userId,
      userName,
    });
  } catch (error) {
    console.error("Error generating Agora token:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
