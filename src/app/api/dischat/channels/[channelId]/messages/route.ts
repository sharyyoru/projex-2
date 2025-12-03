import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Get messages for a channel
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
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before"); // Message ID for pagination
    const after = searchParams.get("after"); // Message ID for pagination

    // Get channel to verify server membership
    const { data: channel } = await supabaseAdmin
      .from("dischat_channels")
      .select("server_id")
      .eq("id", channelId)
      .single();

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check if user is a member
    const { data: membership } = await supabaseAdmin
      .from("dischat_members")
      .select("id")
      .eq("server_id", channel.server_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this server" }, { status: 403 });
    }

    // Build query
    let query = supabaseAdmin
      .from("dischat_messages")
      .select("*, author:users(id, full_name, avatar_url)")
      .eq("channel_id", channelId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      const { data: beforeMsg } = await supabaseAdmin
        .from("dischat_messages")
        .select("created_at")
        .eq("id", before)
        .single();
      
      if (beforeMsg) {
        query = query.lt("created_at", beforeMsg.created_at);
      }
    }

    if (after) {
      const { data: afterMsg } = await supabaseAdmin
        .from("dischat_messages")
        .select("created_at")
        .eq("id", after)
        .single();
      
      if (afterMsg) {
        query = query.gt("created_at", afterMsg.created_at);
      }
    }

    const { data: messages } = await query;

    // Reverse to get chronological order
    const orderedMessages = (messages || []).reverse();

    return NextResponse.json({ messages: orderedMessages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Send a message
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
    const { content, reply_to_id, attachments } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    // Get channel to verify server membership and check permissions
    const { data: channel } = await supabaseAdmin
      .from("dischat_channels")
      .select("server_id, channel_type")
      .eq("id", channelId)
      .single();

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (channel.channel_type !== "text" && channel.channel_type !== "announcement") {
      return NextResponse.json({ error: "Cannot send messages to this channel type" }, { status: 400 });
    }

    // Check if user is a member and not timed out
    const { data: membership } = await supabaseAdmin
      .from("dischat_members")
      .select("id, communication_disabled_until")
      .eq("server_id", channel.server_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this server" }, { status: 403 });
    }

    if (membership.communication_disabled_until && new Date(membership.communication_disabled_until) > new Date()) {
      return NextResponse.json({ error: "You are timed out from this server" }, { status: 403 });
    }

    // Parse mentions from content
    const mentionRegex = /<@(\w+)>/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    // Check for @everyone mention
    const mentionEveryone = content.includes("@everyone") || content.includes("@here");

    // Create message
    const { data: message, error } = await supabaseAdmin
      .from("dischat_messages")
      .insert({
        channel_id: channelId,
        author_id: user.id,
        content: content.trim(),
        message_type: reply_to_id ? "reply" : "default",
        reply_to_id: reply_to_id || null,
        attachments: attachments || [],
        mentions: mentions,
        mention_everyone: mentionEveryone,
      })
      .select("*, author:users(id, full_name, avatar_url)")
      .single();

    if (error) {
      console.error("Error creating message:", error);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    // Update channel's last_message_at
    await supabaseAdmin
      .from("dischat_channels")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", channelId);

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
