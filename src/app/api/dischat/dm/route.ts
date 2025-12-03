import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Get DM channels for current user
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

    // Get 1:1 DMs
    const { data: dms } = await supabaseAdmin
      .from("dischat_dm_channels")
      .select(`
        *,
        user1:users!dischat_dm_channels_user1_id_fkey(id, full_name, avatar_url),
        user2:users!dischat_dm_channels_user2_id_fkey(id, full_name, avatar_url)
      `)
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .eq("is_group", false)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    // Get group DMs
    const { data: groupMemberships } = await supabaseAdmin
      .from("dischat_dm_members")
      .select("dm_channel_id")
      .eq("user_id", user.id);

    let groupDms: unknown[] = [];
    if (groupMemberships && groupMemberships.length > 0) {
      const channelIds = groupMemberships.map(m => m.dm_channel_id);
      const { data } = await supabaseAdmin
        .from("dischat_dm_channels")
        .select("*")
        .in("id", channelIds)
        .eq("is_group", true)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      
      if (data) {
        // Get members for each group DM
        for (const dm of data) {
          const { data: members } = await supabaseAdmin
            .from("dischat_dm_members")
            .select("*, user:users(id, full_name, avatar_url)")
            .eq("dm_channel_id", dm.id);
          (dm as Record<string, unknown>).members = members;
        }
        groupDms = data;
      }
    }

    // Format 1:1 DMs to include the other user
    const formattedDms = (dms || []).map(dm => ({
      ...dm,
      other_user: dm.user1_id === user.id ? dm.user2 : dm.user1,
    }));

    return NextResponse.json({ 
      dms: formattedDms,
      groupDms 
    });
  } catch (error) {
    console.error("Error fetching DMs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create or get DM channel
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
    const { recipient_id, recipient_ids, group_name } = body;

    // Group DM
    if (recipient_ids && recipient_ids.length > 1) {
      // Create group DM
      const { data: dmChannel, error: dmError } = await supabaseAdmin
        .from("dischat_dm_channels")
        .insert({
          is_group: true,
          group_name: group_name || null,
          owner_id: user.id,
        })
        .select()
        .single();

      if (dmError) {
        console.error("Error creating group DM:", dmError);
        return NextResponse.json({ error: "Failed to create group DM" }, { status: 500 });
      }

      // Add all members including creator
      const members = [user.id, ...recipient_ids].map(userId => ({
        dm_channel_id: dmChannel.id,
        user_id: userId,
      }));

      await supabaseAdmin.from("dischat_dm_members").insert(members);

      return NextResponse.json({ dm: dmChannel, created: true });
    }

    // 1:1 DM
    if (!recipient_id) {
      return NextResponse.json({ error: "Recipient ID is required" }, { status: 400 });
    }

    if (recipient_id === user.id) {
      return NextResponse.json({ error: "Cannot create DM with yourself" }, { status: 400 });
    }

    // Check if DM already exists (order users consistently)
    const [user1Id, user2Id] = [user.id, recipient_id].sort();

    const { data: existingDm } = await supabaseAdmin
      .from("dischat_dm_channels")
      .select("*")
      .eq("user1_id", user1Id)
      .eq("user2_id", user2Id)
      .eq("is_group", false)
      .single();

    if (existingDm) {
      return NextResponse.json({ dm: existingDm, created: false });
    }

    // Create new DM
    const { data: dmChannel, error: dmError } = await supabaseAdmin
      .from("dischat_dm_channels")
      .insert({
        user1_id: user1Id,
        user2_id: user2Id,
        is_group: false,
      })
      .select()
      .single();

    if (dmError) {
      console.error("Error creating DM:", dmError);
      return NextResponse.json({ error: "Failed to create DM" }, { status: 500 });
    }

    return NextResponse.json({ dm: dmChannel, created: true });
  } catch (error) {
    console.error("Error creating DM:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
