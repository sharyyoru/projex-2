import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - List servers for current user
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

    // Get servers where user is a member
    const { data: memberships } = await supabaseAdmin
      .from("dischat_members")
      .select("server_id")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ servers: [] });
    }

    const serverIds = memberships.map(m => m.server_id);
    const { data: servers } = await supabaseAdmin
      .from("dischat_servers")
      .select("*")
      .in("id", serverIds);

    return NextResponse.json({ servers: servers || [] });
  } catch (error) {
    console.error("Error fetching servers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new server
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
    const { name, description, icon_url } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Server name is required" }, { status: 400 });
    }

    // Create server
    const { data: server, error: serverError } = await supabaseAdmin
      .from("dischat_servers")
      .insert({
        name: name.trim(),
        description: description || null,
        icon_url: icon_url || null,
        owner_id: user.id,
      })
      .select()
      .single();

    if (serverError) {
      console.error("Error creating server:", serverError);
      return NextResponse.json({ error: "Failed to create server" }, { status: 500 });
    }

    // Add owner as member
    await supabaseAdmin.from("dischat_members").insert({
      server_id: server.id,
      user_id: user.id,
      is_owner: true,
      status: "online",
    });

    // Create default @everyone role
    await supabaseAdmin.from("dischat_roles").insert({
      server_id: server.id,
      name: "@everyone",
      is_default: true,
      permissions: 1049600, // VIEW_CHANNEL, SEND_MESSAGES, READ_MESSAGE_HISTORY, ADD_REACTIONS, CONNECT, SPEAK
    });

    // Create default category
    const { data: category } = await supabaseAdmin
      .from("dischat_categories")
      .insert({
        server_id: server.id,
        name: "Text Channels",
        position: 0,
      })
      .select()
      .single();

    // Create default channels
    if (category) {
      await supabaseAdmin.from("dischat_channels").insert([
        {
          server_id: server.id,
          category_id: category.id,
          name: "general",
          channel_type: "text",
          position: 0,
        },
        {
          server_id: server.id,
          category_id: category.id,
          name: "voice",
          channel_type: "voice",
          position: 1,
        },
      ]);
    }

    return NextResponse.json({ server });
  } catch (error) {
    console.error("Error creating server:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
