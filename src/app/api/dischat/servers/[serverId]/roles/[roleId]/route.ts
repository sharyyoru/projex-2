import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH - Update a role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string; roleId: string }> }
) {
  try {
    const { serverId, roleId } = await params;
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

    // Get the role to check if it's the default role
    const { data: existingRole } = await supabaseAdmin
      .from("dischat_roles")
      .select("is_default")
      .eq("id", roleId)
      .single();

    if (!existingRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, color, permissions, position, is_hoisted, is_mentionable } = body;

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    
    // Don't allow changing name of default role
    if (name !== undefined && !existingRole.is_default) {
      updateData.name = name;
    }
    if (color !== undefined) updateData.color = color;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (position !== undefined) updateData.position = position;
    if (is_hoisted !== undefined) updateData.is_hoisted = is_hoisted;
    if (is_mentionable !== undefined) updateData.is_mentionable = is_mentionable;

    const { data: role, error } = await supabaseAdmin
      .from("dischat_roles")
      .update(updateData)
      .eq("id", roleId)
      .select()
      .single();

    if (error) {
      console.error("Error updating role:", error);
      return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
    }

    return NextResponse.json({ role });
  } catch (error) {
    console.error("Error updating role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete a role
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string; roleId: string }> }
) {
  try {
    const { serverId, roleId } = await params;
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

    // Check if it's the default role
    const { data: role } = await supabaseAdmin
      .from("dischat_roles")
      .select("is_default")
      .eq("id", roleId)
      .single();

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (role.is_default) {
      return NextResponse.json({ error: "Cannot delete the default role" }, { status: 400 });
    }

    // Delete role (member_roles will cascade)
    const { error } = await supabaseAdmin
      .from("dischat_roles")
      .delete()
      .eq("id", roleId);

    if (error) {
      console.error("Error deleting role:", error);
      return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
