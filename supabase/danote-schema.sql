-- ============================================
-- DANOTE - VISUAL COLLABORATION BOARDS
-- Complete SQL Schema for Supabase
-- ============================================

-- Danote Boards (main containers for visual collaboration)
create table if not exists danote_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  parent_board_id uuid references danote_boards(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  name text not null,
  description text,
  thumbnail_color text default 'from-cyan-500 to-teal-500',
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for boards
create index if not exists danote_boards_user_id_idx on danote_boards(user_id);
create index if not exists danote_boards_parent_id_idx on danote_boards(parent_board_id);
create index if not exists danote_boards_project_id_idx on danote_boards(project_id);

-- Danote Elements (cards, notes, images, todos, columns, etc.)
create table if not exists danote_elements (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references danote_boards(id) on delete cascade,
  type text not null check (type in ('note', 'text', 'image', 'todo', 'column', 'color-swatch', 'board-link')),
  x numeric not null default 0,
  y numeric not null default 0,
  width numeric not null default 240,
  height numeric not null default 160,
  content text default '',
  color text default '#fef3c7',
  locked boolean default false,
  parent_id uuid references danote_elements(id) on delete set null,
  z_index integer default 1,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for elements
create index if not exists danote_elements_board_id_idx on danote_elements(board_id);
create index if not exists danote_elements_parent_id_idx on danote_elements(parent_id);
create index if not exists danote_elements_type_idx on danote_elements(type);

-- Danote Connections (lines/arrows between elements for flowcharts)
create table if not exists danote_connections (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references danote_boards(id) on delete cascade,
  from_element_id uuid not null references danote_elements(id) on delete cascade,
  to_element_id uuid not null references danote_elements(id) on delete cascade,
  label text,
  color text default '#6366f1',
  stroke_style text default 'solid' check (stroke_style in ('solid', 'dashed', 'dotted')),
  created_at timestamptz default now()
);

-- Indexes for connections
create index if not exists danote_connections_board_id_idx on danote_connections(board_id);
create index if not exists danote_connections_from_idx on danote_connections(from_element_id);
create index if not exists danote_connections_to_idx on danote_connections(to_element_id);

-- Danote Unsorted Tray (elements not yet placed on board - quick capture)
create table if not exists danote_unsorted (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references danote_boards(id) on delete cascade,
  type text not null check (type in ('note', 'text', 'image', 'todo', 'color-swatch')),
  content text default '',
  color text default '#fef3c7',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Index for unsorted tray
create index if not exists danote_unsorted_board_id_idx on danote_unsorted(board_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
alter table danote_boards enable row level security;
alter table danote_elements enable row level security;
alter table danote_connections enable row level security;
alter table danote_unsorted enable row level security;

-- Boards: Users can view all boards (for now - adjust as needed)
create policy "Users can view all boards" on danote_boards
  for select using (true);

create policy "Users can insert boards" on danote_boards
  for insert with check (auth.uid() = user_id or user_id is null);

create policy "Users can update boards" on danote_boards
  for update using (true);

create policy "Users can delete their boards" on danote_boards
  for delete using (auth.uid() = user_id or user_id is null);

-- Elements: Anyone can manage elements on boards they can access
create policy "Users can view elements" on danote_elements
  for select using (true);

create policy "Users can insert elements" on danote_elements
  for insert with check (true);

create policy "Users can update elements" on danote_elements
  for update using (true);

create policy "Users can delete elements" on danote_elements
  for delete using (true);

-- Connections: Anyone can manage connections
create policy "Users can view connections" on danote_connections
  for select using (true);

create policy "Users can insert connections" on danote_connections
  for insert with check (true);

create policy "Users can update connections" on danote_connections
  for update using (true);

create policy "Users can delete connections" on danote_connections
  for delete using (true);

-- Unsorted: Anyone can manage unsorted items
create policy "Users can view unsorted" on danote_unsorted
  for select using (true);

create policy "Users can insert unsorted" on danote_unsorted
  for insert with check (true);

create policy "Users can update unsorted" on danote_unsorted
  for update using (true);

create policy "Users can delete unsorted" on danote_unsorted
  for delete using (true);
