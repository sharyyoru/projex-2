import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Get roles for a server
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
      .select("id")
      .eq("server_id", serverId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this server" }, { status: 403 });
    }

    const { data: roles } = await supabaseAdmin
      .from("dischat_roles")
      .select("*")
      .eq("server_id", serverId)
      .order("position", { ascending: false });

    return NextResponse.json({ roles: roles || [] });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new role
export async function POST(
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

    // Check if user has permission to manage roles
    const { data: membership } = await supabaseAdmin
      .from("dischat_members")
      .select("is_owner, is_admin")
      .eq("server_id", serverId)
      .eq("user_id", user.id)
      .single();

    if (!membership || (!membership.is_owner && !membership.is_admin)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { name, color, permissions, is_hoisted, is_mentionable } = body;

    // Get next position
    const { data: existingRoles } = await supabaseAdmin
      .from("dischat_roles")
      .select("position")
      .eq("server_id", serverId)
      .order("position", { ascending: false })
      .limit(1);

    const nextPosition = existingRoles && existingRoles.length > 0 
      ? existingRoles[0].position + 1 
      : 1;

    const { data: role, error } = await supabaseAdmin
      .from("dischat_roles")
      .insert({
        server_id: serverId,
        name: name || "new role",
        color: color || "#99AAB5",
        position: nextPosition,
        permissions: permissions || 0,
        is_hoisted: is_hoisted || false,
        is_mentionable: is_mentionable || false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating role:", error);
      return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
    }

    return NextResponse.json({ role });
  } catch (error) {
    console.error("Error creating role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
