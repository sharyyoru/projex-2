import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Get server details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const { serverId } = await params;
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a member
    const { data: membership } = await supabaseAdmin
      .from("dischat_members")
      .select("*")
      .eq("server_id", serverId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this server" }, { status: 403 });
    }

    // Get server with channels, categories, and members
    const [serverRes, channelsRes, categoriesRes, membersRes, rolesRes] = await Promise.all([
      supabaseAdmin.from("dischat_servers").select("*").eq("id", serverId).single(),
      supabaseAdmin.from("dischat_channels").select("*").eq("server_id", serverId).order("position"),
      supabaseAdmin.from("dischat_categories").select("*").eq("server_id", serverId).order("position"),
      supabaseAdmin.from("dischat_members").select("*, user:users(id, full_name, avatar_url)").eq("server_id", serverId),
      supabaseAdmin.from("dischat_roles").select("*").eq("server_id", serverId).order("position", { ascending: false }),
    ]);

    return NextResponse.json({
      server: serverRes.data,
      channels: channelsRes.data || [],
      categories: categoriesRes.data || [],
      members: membersRes.data || [],
      roles: rolesRes.data || [],
      currentMember: membership,
    });
  } catch (error) {
    console.error("Error fetching server:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - Update server
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const { serverId } = await params;
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is owner or admin
    const { data: membership } = await supabaseAdmin
      .from("dischat_members")
      .select("*")
      .eq("server_id", serverId)
      .eq("user_id", user.id)
      .single();

    if (!membership || (!membership.is_owner && !membership.is_admin)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, icon_url, banner_url, is_public, verification_level } = body;

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (icon_url !== undefined) updateData.icon_url = icon_url;
    if (banner_url !== undefined) updateData.banner_url = banner_url;
    if (is_public !== undefined) updateData.is_public = is_public;
    if (verification_level !== undefined) updateData.verification_level = verification_level;

    const { data: server, error } = await supabaseAdmin
      .from("dischat_servers")
      .update(updateData)
      .eq("id", serverId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update server" }, { status: 500 });
    }

    return NextResponse.json({ server });
  } catch (error) {
    console.error("Error updating server:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete server
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const { serverId } = await params;
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is owner
    const { data: server } = await supabaseAdmin
      .from("dischat_servers")
      .select("owner_id")
      .eq("id", serverId)
      .single();

    if (!server || server.owner_id !== user.id) {
      return NextResponse.json({ error: "Only the server owner can delete the server" }, { status: 403 });
    }

    // Delete server (cascades to all related tables)
    const { error } = await supabaseAdmin
      .from("dischat_servers")
      .delete()
      .eq("id", serverId);

    if (error) {
      return NextResponse.json({ error: "Failed to delete server" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting server:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
