import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Get messages for a DM channel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dmId: string }> }
) {
  try {
    const { dmId } = await params;
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this DM
    const { data: dmChannel } = await supabaseAdmin
      .from("dischat_dm_channels")
      .select("*")
      .eq("id", dmId)
      .single();

    if (!dmChannel) {
      return NextResponse.json({ error: "DM not found" }, { status: 404 });
    }

    // Check access
    if (dmChannel.is_group) {
      const { data: membership } = await supabaseAdmin
        .from("dischat_dm_members")
        .select("id")
        .eq("dm_channel_id", dmId)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    } else {
      if (dmChannel.user1_id !== user.id && dmChannel.user2_id !== user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const { data: messages } = await supabaseAdmin
      .from("dischat_dm_messages")
      .select("*, author:users(id, full_name, avatar_url)")
      .eq("dm_channel_id", dmId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Reverse to get chronological order
    const orderedMessages = (messages || []).reverse();

    return NextResponse.json({ messages: orderedMessages });
  } catch (error) {
    console.error("Error fetching DM messages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Send a DM message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dmId: string }> }
) {
  try {
    const { dmId } = await params;
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

    // Verify user has access to this DM
    const { data: dmChannel } = await supabaseAdmin
      .from("dischat_dm_channels")
      .select("*")
      .eq("id", dmId)
      .single();

    if (!dmChannel) {
      return NextResponse.json({ error: "DM not found" }, { status: 404 });
    }

    // Check access
    if (dmChannel.is_group) {
      const { data: membership } = await supabaseAdmin
        .from("dischat_dm_members")
        .select("id")
        .eq("dm_channel_id", dmId)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    } else {
      if (dmChannel.user1_id !== user.id && dmChannel.user2_id !== user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Create message
    const { data: message, error } = await supabaseAdmin
      .from("dischat_dm_messages")
      .insert({
        dm_channel_id: dmId,
        author_id: user.id,
        content: content.trim(),
        message_type: reply_to_id ? "reply" : "default",
        reply_to_id: reply_to_id || null,
        attachments: attachments || [],
      })
      .select("*, author:users(id, full_name, avatar_url)")
      .single();

    if (error) {
      console.error("Error sending DM message:", error);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    // Update last_message_at
    await supabaseAdmin
      .from("dischat_dm_channels")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", dmId);

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Error sending DM message:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
