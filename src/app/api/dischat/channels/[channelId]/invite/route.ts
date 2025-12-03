import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Invite a user to a specific channel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
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
    const { user_id, email } = body;

    // Get channel info
    const { data: channel } = await supabaseAdmin
      .from("dischat_channels")
      .select("server_id, name")
      .eq("id", channelId)
      .single();

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check if inviter has permission
    const { data: inviterMembership } = await supabaseAdmin
      .from("dischat_members")
      .select("is_owner, is_admin")
      .eq("server_id", channel.server_id)
      .eq("user_id", user.id)
      .single();

    if (!inviterMembership) {
      return NextResponse.json({ error: "You are not a member of this server" }, { status: 403 });
    }

    // Find the user to invite
    let targetUserId = user_id;
    if (!targetUserId && email) {
      const { data: targetUser } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .single();
      
      if (targetUser) {
        targetUserId = targetUser.id;
      }
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is already a member of the server
    const { data: existingMembership } = await supabaseAdmin
      .from("dischat_members")
      .select("id")
      .eq("server_id", channel.server_id)
      .eq("user_id", targetUserId)
      .single();

    if (existingMembership) {
      // User is already a member, just add channel permission
      // For now, we'll just return success since all members can see all channels by default
      return NextResponse.json({ 
        success: true, 
        message: "User is already a member of this server",
        alreadyMember: true 
      });
    }

    // Add user as a member of the server
    const { error: memberError } = await supabaseAdmin
      .from("dischat_members")
      .insert({
        server_id: channel.server_id,
        user_id: targetUserId,
        status: "offline",
      });

    if (memberError) {
      console.error("Error adding member:", memberError);
      return NextResponse.json({ error: "Failed to add user" }, { status: 500 });
    }

    // Create a notification/DM to the user about the invite
    // This would be a good place to send an in-app notification

    return NextResponse.json({ 
      success: true, 
      message: `User invited to channel #${channel.name}` 
    });
  } catch (error) {
    console.error("Error inviting user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET - Get users that can be invited to a channel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
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
    const search = searchParams.get("search") || "";

    // Get channel info
    const { data: channel } = await supabaseAdmin
      .from("dischat_channels")
      .select("server_id")
      .eq("id", channelId)
      .single();

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Get current server members
    const { data: currentMembers } = await supabaseAdmin
      .from("dischat_members")
      .select("user_id")
      .eq("server_id", channel.server_id);

    const memberIds = currentMembers?.map(m => m.user_id) || [];

    // Search for users not in the server
    let query = supabaseAdmin
      .from("users")
      .select("id, full_name, email, avatar_url");

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (memberIds.length > 0) {
      query = query.not("id", "in", `(${memberIds.join(",")})`);
    }

    const { data: users } = await query.limit(20);

    return NextResponse.json({ users: users || [] });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
