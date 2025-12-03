import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Create a new channel
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
    const { server_id, category_id, name, channel_type, topic } = body;

    if (!server_id || !name || !channel_type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if user has permission to create channels
    const { data: membership } = await supabaseAdmin
      .from("dischat_members")
      .select("is_owner, is_admin")
      .eq("server_id", server_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || (!membership.is_owner && !membership.is_admin)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Get next position
    const { data: existingChannels } = await supabaseAdmin
      .from("dischat_channels")
      .select("position")
      .eq("server_id", server_id)
      .eq("category_id", category_id || null)
      .order("position", { ascending: false })
      .limit(1);

    const nextPosition = existingChannels && existingChannels.length > 0 
      ? existingChannels[0].position + 1 
      : 0;

    // Create channel
    const { data: channel, error } = await supabaseAdmin
      .from("dischat_channels")
      .insert({
        server_id,
        category_id: category_id || null,
        name: name.toLowerCase().replace(/\s+/g, "-"),
        channel_type,
        topic: topic || null,
        position: nextPosition,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating channel:", error);
      return NextResponse.json({ error: "Failed to create channel" }, { status: 500 });
    }

    return NextResponse.json({ channel });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
