-- ============================================
-- DISCHAT MODULE - Discord-like Communication System
-- ============================================

-- Channel Types enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'dischat_channel_type') then
    create type dischat_channel_type as enum (
      'text',
      'voice',
      'video',
      'stage',
      'forum',
      'announcement'
    );
  end if;
end$$;

-- Message Types enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'dischat_message_type') then
    create type dischat_message_type as enum (
      'default',
      'reply',
      'thread_starter',
      'system',
      'voice_message',
      'pin_notification'
    );
  end if;
end$$;

-- Member Status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'dischat_member_status') then
    create type dischat_member_status as enum (
      'online',
      'idle',
      'dnd',
      'invisible',
      'offline'
    );
  end if;
end$$;

-- ============================================
-- SERVERS (Communities)
-- ============================================
create table if not exists dischat_servers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon_url text,
  banner_url text,
  owner_id uuid not null references users(id) on delete cascade,
  
  -- Server settings
  is_public boolean default false,
  verification_level integer default 0, -- 0: none, 1: email, 2: phone, 3: member 5min, 4: member 10min
  default_notifications text default 'all', -- 'all', 'mentions'
  explicit_content_filter integer default 0, -- 0: off, 1: no roles, 2: all
  
  -- Features
  features jsonb default '[]'::jsonb, -- Array of enabled features
  
  -- Invite
  invite_code text unique default substr(md5(random()::text), 1, 8),
  
  -- Stats
  member_count integer default 1,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists dischat_servers_owner_id_idx on dischat_servers(owner_id);
create index if not exists dischat_servers_invite_code_idx on dischat_servers(invite_code);

-- ============================================
-- CHANNEL CATEGORIES
-- ============================================
create table if not exists dischat_categories (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references dischat_servers(id) on delete cascade,
  name text not null,
  position integer default 0,
  is_collapsed boolean default false,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists dischat_categories_server_id_idx on dischat_categories(server_id);

-- ============================================
-- CHANNELS
-- ============================================
create table if not exists dischat_channels (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references dischat_servers(id) on delete cascade,
  category_id uuid references dischat_categories(id) on delete set null,
  
  name text not null,
  topic text, -- Channel description/topic
  channel_type dischat_channel_type not null default 'text',
  position integer default 0,
  
  -- Text channel settings
  slowmode_seconds integer default 0,
  nsfw boolean default false,
  
  -- Voice/Video channel settings
  bitrate integer default 64000, -- Audio bitrate in bps
  user_limit integer default 0, -- 0 = unlimited
  video_quality_mode integer default 1, -- 1: auto, 2: full (720p)
  
  -- Stage channel settings
  stage_topic text,
  
  -- Forum channel settings
  default_thread_rate_limit integer default 0,
  available_tags jsonb default '[]'::jsonb,
  default_sort_order integer default 0, -- 0: latest activity, 1: creation date
  
  -- Permissions (null = inherit from category/server)
  permission_overwrites jsonb default '[]'::jsonb,
  
  -- Thread settings
  default_auto_archive_duration integer default 1440, -- minutes (24h default)
  
  is_archived boolean default false,
  last_message_at timestamptz,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists dischat_channels_server_id_idx on dischat_channels(server_id);
create index if not exists dischat_channels_category_id_idx on dischat_channels(category_id);

-- ============================================
-- ROLES
-- ============================================
create table if not exists dischat_roles (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references dischat_servers(id) on delete cascade,
  name text not null,
  color text default '#99AAB5', -- Hex color
  position integer default 0, -- Higher = more important
  
  -- Permissions (bitfield stored as bigint)
  permissions bigint default 0,
  
  -- Display
  is_hoisted boolean default false, -- Show separately in member list
  is_mentionable boolean default false,
  
  -- Special roles
  is_default boolean default false, -- @everyone role
  is_managed boolean default false, -- Bot/integration managed
  
  icon_url text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists dischat_roles_server_id_idx on dischat_roles(server_id);

-- ============================================
-- SERVER MEMBERS
-- ============================================
create table if not exists dischat_members (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references dischat_servers(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  
  nickname text,
  avatar_url text, -- Server-specific avatar
  
  -- Status & Presence
  status dischat_member_status default 'offline',
  custom_status text,
  custom_status_emoji text,
  
  -- Activity (Rich Presence)
  activity_type text, -- 'playing', 'streaming', 'listening', 'watching', 'custom', 'competing'
  activity_name text,
  activity_details text,
  activity_state text,
  activity_started_at timestamptz,
  
  -- Voice state
  is_muted boolean default false,
  is_deafened boolean default false,
  is_streaming boolean default false,
  is_video_enabled boolean default false,
  current_voice_channel_id uuid references dischat_channels(id) on delete set null,
  
  -- Permissions
  is_owner boolean default false,
  is_admin boolean default false,
  
  -- Timestamps
  joined_at timestamptz default now(),
  premium_since timestamptz, -- Server boost date
  communication_disabled_until timestamptz, -- Timeout
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(server_id, user_id)
);

create index if not exists dischat_members_server_id_idx on dischat_members(server_id);
create index if not exists dischat_members_user_id_idx on dischat_members(user_id);
create index if not exists dischat_members_voice_channel_idx on dischat_members(current_voice_channel_id) where current_voice_channel_id is not null;

-- ============================================
-- MEMBER ROLES (Many-to-Many)
-- ============================================
create table if not exists dischat_member_roles (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references dischat_members(id) on delete cascade,
  role_id uuid not null references dischat_roles(id) on delete cascade,
  
  created_at timestamptz default now(),
  
  unique(member_id, role_id)
);

create index if not exists dischat_member_roles_member_id_idx on dischat_member_roles(member_id);
create index if not exists dischat_member_roles_role_id_idx on dischat_member_roles(role_id);

-- ============================================
-- MESSAGES
-- ============================================
create table if not exists dischat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references dischat_channels(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  
  content text, -- Markdown supported
  message_type dischat_message_type default 'default',
  
  -- Reply
  reply_to_id uuid references dischat_messages(id) on delete set null,
  
  -- Thread
  thread_id uuid references dischat_channels(id) on delete set null, -- If this starts a thread
  
  -- Attachments & Embeds
  attachments jsonb default '[]'::jsonb, -- Array of {url, filename, size, content_type}
  embeds jsonb default '[]'::jsonb, -- Rich embeds (links, images, etc.)
  
  -- Mentions
  mentions jsonb default '[]'::jsonb, -- Array of user IDs
  mention_roles jsonb default '[]'::jsonb, -- Array of role IDs
  mention_everyone boolean default false,
  mention_channels jsonb default '[]'::jsonb, -- Array of channel IDs
  
  -- Voice message
  voice_duration_seconds integer,
  voice_waveform text, -- Base64 encoded waveform
  
  -- Flags
  is_pinned boolean default false,
  is_edited boolean default false,
  is_deleted boolean default false,
  
  edited_at timestamptz,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists dischat_messages_channel_id_idx on dischat_messages(channel_id);
create index if not exists dischat_messages_author_id_idx on dischat_messages(author_id);
create index if not exists dischat_messages_created_at_idx on dischat_messages(created_at desc);
create index if not exists dischat_messages_thread_id_idx on dischat_messages(thread_id) where thread_id is not null;
create index if not exists dischat_messages_pinned_idx on dischat_messages(channel_id, is_pinned) where is_pinned = true;

-- ============================================
-- THREADS
-- ============================================
create table if not exists dischat_threads (
  id uuid primary key default gen_random_uuid(),
  parent_channel_id uuid not null references dischat_channels(id) on delete cascade,
  thread_channel_id uuid not null references dischat_channels(id) on delete cascade,
  starter_message_id uuid references dischat_messages(id) on delete set null,
  
  name text not null,
  owner_id uuid not null references users(id) on delete cascade,
  
  -- Thread settings
  auto_archive_duration integer default 1440, -- minutes
  is_archived boolean default false,
  is_locked boolean default false,
  is_private boolean default false,
  
  -- Forum thread specific
  applied_tags jsonb default '[]'::jsonb,
  
  message_count integer default 0,
  member_count integer default 0,
  
  archived_at timestamptz,
  last_message_at timestamptz,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists dischat_threads_parent_channel_id_idx on dischat_threads(parent_channel_id);

-- ============================================
-- MESSAGE REACTIONS
-- ============================================
create table if not exists dischat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references dischat_messages(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  
  emoji text not null, -- Unicode emoji or custom emoji ID
  emoji_name text, -- For custom emojis
  is_custom boolean default false,
  
  created_at timestamptz default now(),
  
  unique(message_id, user_id, emoji)
);

create index if not exists dischat_reactions_message_id_idx on dischat_reactions(message_id);

-- ============================================
-- DIRECT MESSAGES
-- ============================================
create table if not exists dischat_dm_channels (
  id uuid primary key default gen_random_uuid(),
  
  -- For 1:1 DMs
  user1_id uuid references users(id) on delete cascade,
  user2_id uuid references users(id) on delete cascade,
  
  -- For group DMs
  is_group boolean default false,
  group_name text,
  group_icon_url text,
  owner_id uuid references users(id) on delete set null,
  
  last_message_at timestamptz,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(user1_id, user2_id)
);

create index if not exists dischat_dm_channels_user1_idx on dischat_dm_channels(user1_id);
create index if not exists dischat_dm_channels_user2_idx on dischat_dm_channels(user2_id);

-- ============================================
-- GROUP DM MEMBERS
-- ============================================
create table if not exists dischat_dm_members (
  id uuid primary key default gen_random_uuid(),
  dm_channel_id uuid not null references dischat_dm_channels(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  
  nickname text,
  
  created_at timestamptz default now(),
  
  unique(dm_channel_id, user_id)
);

create index if not exists dischat_dm_members_channel_idx on dischat_dm_members(dm_channel_id);
create index if not exists dischat_dm_members_user_idx on dischat_dm_members(user_id);

-- ============================================
-- DM MESSAGES
-- ============================================
create table if not exists dischat_dm_messages (
  id uuid primary key default gen_random_uuid(),
  dm_channel_id uuid not null references dischat_dm_channels(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  
  content text,
  message_type dischat_message_type default 'default',
  
  reply_to_id uuid references dischat_dm_messages(id) on delete set null,
  
  attachments jsonb default '[]'::jsonb,
  embeds jsonb default '[]'::jsonb,
  
  voice_duration_seconds integer,
  voice_waveform text,
  
  is_pinned boolean default false,
  is_edited boolean default false,
  is_deleted boolean default false,
  
  edited_at timestamptz,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists dischat_dm_messages_channel_idx on dischat_dm_messages(dm_channel_id);
create index if not exists dischat_dm_messages_created_at_idx on dischat_dm_messages(created_at desc);

-- ============================================
-- AUTOMOD RULES
-- ============================================
create table if not exists dischat_automod_rules (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references dischat_servers(id) on delete cascade,
  
  name text not null,
  is_enabled boolean default true,
  
  -- Trigger type: 1=keyword, 2=spam, 3=mention_spam, 4=harmful_links
  trigger_type integer not null,
  
  -- Trigger metadata
  keyword_filter jsonb default '[]'::jsonb, -- Array of blocked words/patterns
  regex_patterns jsonb default '[]'::jsonb,
  allow_list jsonb default '[]'::jsonb, -- Allowed words/patterns
  mention_total_limit integer, -- Max mentions per message
  
  -- Actions
  actions jsonb not null default '[]'::jsonb, -- Array of {type, metadata}
  -- Action types: 1=block_message, 2=send_alert, 3=timeout
  
  -- Exempt
  exempt_roles jsonb default '[]'::jsonb,
  exempt_channels jsonb default '[]'::jsonb,
  
  created_by_user_id uuid references users(id),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists dischat_automod_rules_server_id_idx on dischat_automod_rules(server_id);

-- ============================================
-- SERVER INVITES
-- ============================================
create table if not exists dischat_invites (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references dischat_servers(id) on delete cascade,
  channel_id uuid references dischat_channels(id) on delete set null,
  
  code text unique not null default substr(md5(random()::text), 1, 8),
  
  inviter_id uuid not null references users(id) on delete cascade,
  
  max_uses integer, -- null = unlimited
  uses integer default 0,
  max_age_seconds integer, -- null = never expires
  is_temporary boolean default false, -- Kick when they go offline if they don't get role
  
  expires_at timestamptz,
  
  created_at timestamptz default now()
);

create index if not exists dischat_invites_server_id_idx on dischat_invites(server_id);
create index if not exists dischat_invites_code_idx on dischat_invites(code);

-- ============================================
-- USER CONNECTIONS (External accounts)
-- ============================================
create table if not exists dischat_user_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  
  -- Connection type
  connection_type text not null, -- 'spotify', 'steam', 'twitch', 'youtube', 'github', etc.
  
  -- External account info
  external_id text not null,
  external_username text,
  external_display_name text,
  external_avatar_url text,
  
  -- Visibility
  is_visible boolean default true, -- Show on profile
  is_verified boolean default false,
  
  -- OAuth tokens (encrypted in production)
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  
  metadata jsonb default '{}'::jsonb, -- Additional connection-specific data
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(user_id, connection_type, external_id)
);

create index if not exists dischat_user_connections_user_id_idx on dischat_user_connections(user_id);

-- ============================================
-- ACTIVITIES (For Watch Together, Games, etc.)
-- ============================================
create table if not exists dischat_activities (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references dischat_channels(id) on delete cascade,
  
  activity_type text not null, -- 'watch_together', 'poker', 'chess', 'sketch_heads', etc.
  activity_name text not null,
  
  host_user_id uuid not null references users(id) on delete cascade,
  
  -- Participants
  participants jsonb default '[]'::jsonb, -- Array of user IDs
  max_participants integer,
  
  -- Activity state
  state jsonb default '{}'::jsonb, -- Activity-specific state data
  
  is_active boolean default true,
  
  started_at timestamptz default now(),
  ended_at timestamptz,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists dischat_activities_channel_id_idx on dischat_activities(channel_id);

-- ============================================
-- SERVER INSIGHTS / ANALYTICS
-- ============================================
create table if not exists dischat_server_insights (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references dischat_servers(id) on delete cascade,
  
  date date not null,
  
  -- Member metrics
  total_members integer default 0,
  new_members integer default 0,
  left_members integer default 0,
  
  -- Engagement metrics
  messages_sent integer default 0,
  voice_minutes integer default 0,
  active_members integer default 0, -- Members who sent at least 1 message
  
  -- Channel metrics
  most_active_channel_id uuid references dischat_channels(id) on delete set null,
  most_active_channel_messages integer default 0,
  
  created_at timestamptz default now(),
  
  unique(server_id, date)
);

create index if not exists dischat_server_insights_server_date_idx on dischat_server_insights(server_id, date);

-- ============================================
-- ONBOARDING
-- ============================================
create table if not exists dischat_onboarding (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references dischat_servers(id) on delete cascade,
  
  is_enabled boolean default false,
  
  -- Welcome screen
  welcome_title text,
  welcome_description text,
  
  -- Prompts/Questions
  prompts jsonb default '[]'::jsonb,
  -- Each prompt: {id, title, options: [{label, description, emoji, roles: [], channels: []}]}
  
  -- Default channels shown after onboarding
  default_channels jsonb default '[]'::jsonb,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(server_id)
);

-- ============================================
-- READ STATES (Track unread messages)
-- ============================================
create table if not exists dischat_read_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  channel_id uuid not null references dischat_channels(id) on delete cascade,
  
  last_read_message_id uuid references dischat_messages(id) on delete set null,
  last_read_at timestamptz default now(),
  mention_count integer default 0,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(user_id, channel_id)
);

create index if not exists dischat_read_states_user_channel_idx on dischat_read_states(user_id, channel_id);

-- ============================================
-- PINNED MESSAGES
-- ============================================
create table if not exists dischat_pins (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references dischat_channels(id) on delete cascade,
  message_id uuid not null references dischat_messages(id) on delete cascade,
  pinned_by uuid not null references users(id) on delete cascade,
  
  created_at timestamptz default now(),
  
  unique(channel_id, message_id)
);

create index if not exists dischat_pins_channel_idx on dischat_pins(channel_id);

-- ============================================
-- EMOJI (Custom server emoji)
-- ============================================
create table if not exists dischat_emoji (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references dischat_servers(id) on delete cascade,
  
  name text not null,
  image_url text not null,
  
  is_animated boolean default false,
  is_available boolean default true,
  
  uploaded_by uuid references users(id) on delete set null,
  
  created_at timestamptz default now()
);

create index if not exists dischat_emoji_server_id_idx on dischat_emoji(server_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get unread count for a user in a channel
create or replace function get_dischat_unread_count(
  p_user_id uuid,
  p_channel_id uuid
) returns integer as $$
declare
  v_last_read_id uuid;
  v_count integer;
begin
  select last_read_message_id into v_last_read_id
  from dischat_read_states
  where user_id = p_user_id and channel_id = p_channel_id;
  
  if v_last_read_id is null then
    select count(*) into v_count
    from dischat_messages
    where channel_id = p_channel_id and is_deleted = false;
  else
    select count(*) into v_count
    from dischat_messages
    where channel_id = p_channel_id 
      and is_deleted = false
      and created_at > (select created_at from dischat_messages where id = v_last_read_id);
  end if;
  
  return coalesce(v_count, 0);
end;
$$ language plpgsql;

-- Function to update server member count
create or replace function update_dischat_server_member_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update dischat_servers set member_count = member_count + 1, updated_at = now()
    where id = NEW.server_id;
  elsif TG_OP = 'DELETE' then
    update dischat_servers set member_count = member_count - 1, updated_at = now()
    where id = OLD.server_id;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger dischat_member_count_trigger
after insert or delete on dischat_members
for each row execute function update_dischat_server_member_count();

-- Function to update channel last_message_at
create or replace function update_dischat_channel_last_message()
returns trigger as $$
begin
  update dischat_channels set last_message_at = NEW.created_at, updated_at = now()
  where id = NEW.channel_id;
  return null;
end;
$$ language plpgsql;

create trigger dischat_channel_last_message_trigger
after insert on dischat_messages
for each row execute function update_dischat_channel_last_message();

-- ============================================
-- DEFAULT PERMISSIONS CONSTANTS (for reference)
-- ============================================
-- These are bitfield values for role permissions:
-- CREATE_INSTANT_INVITE = 1 << 0
-- KICK_MEMBERS = 1 << 1
-- BAN_MEMBERS = 1 << 2
-- ADMINISTRATOR = 1 << 3
-- MANAGE_CHANNELS = 1 << 4
-- MANAGE_GUILD = 1 << 5
-- ADD_REACTIONS = 1 << 6
-- VIEW_AUDIT_LOG = 1 << 7
-- PRIORITY_SPEAKER = 1 << 8
-- STREAM = 1 << 9
-- VIEW_CHANNEL = 1 << 10
-- SEND_MESSAGES = 1 << 11
-- SEND_TTS_MESSAGES = 1 << 12
-- MANAGE_MESSAGES = 1 << 13
-- EMBED_LINKS = 1 << 14
-- ATTACH_FILES = 1 << 15
-- READ_MESSAGE_HISTORY = 1 << 16
-- MENTION_EVERYONE = 1 << 17
-- USE_EXTERNAL_EMOJIS = 1 << 18
-- VIEW_GUILD_INSIGHTS = 1 << 19
-- CONNECT = 1 << 20
-- SPEAK = 1 << 21
-- MUTE_MEMBERS = 1 << 22
-- DEAFEN_MEMBERS = 1 << 23
-- MOVE_MEMBERS = 1 << 24
-- USE_VAD = 1 << 25
-- CHANGE_NICKNAME = 1 << 26
-- MANAGE_NICKNAMES = 1 << 27
-- MANAGE_ROLES = 1 << 28
-- MANAGE_WEBHOOKS = 1 << 29
-- MANAGE_EMOJIS = 1 << 30
-- USE_APPLICATION_COMMANDS = 1 << 31
-- REQUEST_TO_SPEAK = 1 << 32
-- MANAGE_EVENTS = 1 << 33
-- MANAGE_THREADS = 1 << 34
-- CREATE_PUBLIC_THREADS = 1 << 35
-- CREATE_PRIVATE_THREADS = 1 << 36
-- USE_EXTERNAL_STICKERS = 1 << 37
-- SEND_MESSAGES_IN_THREADS = 1 << 38
-- USE_EMBEDDED_ACTIVITIES = 1 << 39
-- MODERATE_MEMBERS = 1 << 40
