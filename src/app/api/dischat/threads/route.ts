import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Create a thread from a message
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
    const { channel_id, message_id, name, auto_archive_duration } = body;

    if (!channel_id || !name) {
      return NextResponse.json({ error: "Channel ID and name are required" }, { status: 400 });
    }

    // Get parent channel
    const { data: parentChannel } = await supabaseAdmin
      .from("dischat_channels")
      .select("server_id, channel_type")
      .eq("id", channel_id)
      .single();

    if (!parentChannel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check membership
    const { data: membership } = await supabaseAdmin
      .from("dischat_members")
      .select("id")
      .eq("server_id", parentChannel.server_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this server" }, { status: 403 });
    }

    // Create thread channel
    const { data: threadChannel, error: channelError } = await supabaseAdmin
      .from("dischat_channels")
      .insert({
        server_id: parentChannel.server_id,
        name: name.toLowerCase().replace(/\s+/g, "-"),
        channel_type: "text",
        default_auto_archive_duration: auto_archive_duration || 1440,
      })
      .select()
      .single();

    if (channelError) {
      console.error("Error creating thread channel:", channelError);
      return NextResponse.json({ error: "Failed to create thread" }, { status: 500 });
    }

    // Create thread record
    const { data: thread, error: threadError } = await supabaseAdmin
      .from("dischat_threads")
      .insert({
        parent_channel_id: channel_id,
        thread_channel_id: threadChannel.id,
        starter_message_id: message_id || null,
        name,
        owner_id: user.id,
        auto_archive_duration: auto_archive_duration || 1440,
      })
      .select()
      .single();

    if (threadError) {
      // Rollback channel creation
      await supabaseAdmin.from("dischat_channels").delete().eq("id", threadChannel.id);
      console.error("Error creating thread:", threadError);
      return NextResponse.json({ error: "Failed to create thread" }, { status: 500 });
    }

    // If created from a message, update the message to reference the thread
    if (message_id) {
      await supabaseAdmin
        .from("dischat_messages")
        .update({ 
          thread_id: threadChannel.id,
          message_type: "thread_starter" 
        })
        .eq("id", message_id);
    }

    return NextResponse.json({ thread, channel: threadChannel });
  } catch (error) {
    console.error("Error creating thread:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET - Get threads for a channel
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
    const includeArchived = searchParams.get("include_archived") === "true";

    if (!channelId) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 });
    }

    // Get channel to verify membership
    const { data: channel } = await supabaseAdmin
      .from("dischat_channels")
      .select("server_id")
      .eq("id", channelId)
      .single();

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check membership
    const { data: membership } = await supabaseAdmin
      .from("dischat_members")
      .select("id")
      .eq("server_id", channel.server_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this server" }, { status: 403 });
    }

    // Get threads
    let query = supabaseAdmin
      .from("dischat_threads")
      .select("*, thread_channel:dischat_channels(*)")
      .eq("parent_channel_id", channelId)
      .order("created_at", { ascending: false });

    if (!includeArchived) {
      query = query.eq("is_archived", false);
    }

    const { data: threads } = await query;

    return NextResponse.json({ threads: threads || [] });
  } catch (error) {
    console.error("Error fetching threads:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
