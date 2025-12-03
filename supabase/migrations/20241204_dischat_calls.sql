-- ============================================
-- DISCHAT CALL INVITES (For guest users)
-- ============================================

create table if not exists dischat_call_invites (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references dischat_channels(id) on delete cascade,
  server_id uuid references dischat_servers(id) on delete cascade,
  
  code text unique not null,
  
  created_by uuid not null references users(id) on delete cascade,
  
  max_uses integer, -- null = unlimited
  uses integer default 0,
  
  expires_at timestamptz, -- null = never expires
  
  created_at timestamptz default now()
);

create index if not exists dischat_call_invites_code_idx on dischat_call_invites(code);
create index if not exists dischat_call_invites_channel_idx on dischat_call_invites(channel_id);

-- ============================================
-- CHANNEL PERMISSIONS (For per-channel access control)
-- ============================================

create table if not exists dischat_channel_permissions (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references dischat_channels(id) on delete cascade,
  
  -- Can be for a role or a specific user
  role_id uuid references dischat_roles(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  
  -- Permission overrides (null = inherit)
  allow_view boolean,
  allow_send_messages boolean,
  allow_connect boolean,
  allow_speak boolean,
  allow_video boolean,
  allow_screen_share boolean,
  allow_manage_messages boolean,
  allow_manage_channel boolean,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Either role_id or user_id must be set
  constraint channel_perm_target check (role_id is not null or user_id is not null)
);

create index if not exists dischat_channel_permissions_channel_idx on dischat_channel_permissions(channel_id);
create index if not exists dischat_channel_permissions_role_idx on dischat_channel_permissions(role_id);
create index if not exists dischat_channel_permissions_user_idx on dischat_channel_permissions(user_id);

-- ============================================
-- ACTIVE CALLS (Track who's in a call)
-- ============================================

create table if not exists dischat_active_calls (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references dischat_channels(id) on delete cascade,
  
  started_at timestamptz default now(),
  ended_at timestamptz,
  
  -- Call stats
  peak_participants integer default 0,
  total_participants integer default 0,
  
  created_at timestamptz default now()
);

create index if not exists dischat_active_calls_channel_idx on dischat_active_calls(channel_id);

-- ============================================
-- CALL PARTICIPANTS (Who's currently in a call)
-- ============================================

create table if not exists dischat_call_participants (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references dischat_active_calls(id) on delete cascade,
  
  -- Can be a member or guest
  user_id uuid references users(id) on delete cascade,
  guest_name text,
  
  -- State
  is_muted boolean default false,
  is_deafened boolean default false,
  is_video_on boolean default false,
  is_screen_sharing boolean default false,
  
  joined_at timestamptz default now(),
  left_at timestamptz,
  
  created_at timestamptz default now()
);

create index if not exists dischat_call_participants_call_idx on dischat_call_participants(call_id);
create index if not exists dischat_call_participants_user_idx on dischat_call_participants(user_id);
