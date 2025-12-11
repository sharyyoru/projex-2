-- ============================================
-- ACCOUNT MANAGEMENT MODULE
-- Client Directory, Profiles, Documents, SOA
-- ============================================

-- Clients table (Account Management specific)
create table if not exists account_clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete set null,
  
  -- Basic Info
  client_name text not null,
  industry text,
  avatar_url text,
  
  -- Client Classification
  client_type text check (client_type in ('high_maintenance', 'mid_maintenance', 'low_maintenance', 'standard')),
  client_category text check (client_category in ('active_retainer', 'project_based')) default 'active_retainer',
  
  -- Dates
  client_since date,
  end_date date,
  
  -- Services (stored as JSONB array)
  services_signed jsonb default '[]'::jsonb,
  
  -- Contract
  contract_type text check (contract_type in ('service_based', '3_month', '6_month', '12_month', 'project_based')),
  
  -- Billing
  invoice_due_day text,
  
  -- Fees
  retainer_fee numeric(12, 2) default 0,
  service_based_fee numeric(12, 2) default 0,
  adhoc_fee numeric(12, 2) default 0,
  currency text default 'AED',
  
  -- Metadata
  notes text,
  created_by_user_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists account_clients_company_id_idx on account_clients(company_id);
create index if not exists account_clients_category_idx on account_clients(client_category);
create index if not exists account_clients_client_type_idx on account_clients(client_type);
create index if not exists account_clients_created_at_idx on account_clients(created_at desc);

-- Client Documents (MOA, SOWs, Invoices, Roadmaps)
create table if not exists account_client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references account_clients(id) on delete cascade,
  
  -- Document Info
  document_type text not null check (document_type in ('moa', 'sow', 'invoice', 'roadmap', 'other')),
  title text not null,
  description text,
  
  -- File Storage
  file_name text not null,
  file_url text not null,
  file_size bigint,
  mime_type text,
  
  -- Metadata
  uploaded_by_user_id uuid references users(id),
  uploaded_by_name text,
  created_at timestamptz default now()
);

create index if not exists account_client_documents_client_id_idx on account_client_documents(client_id);
create index if not exists account_client_documents_type_idx on account_client_documents(document_type);

-- Statement of Account (SOA)
create table if not exists account_soa (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references account_clients(id) on delete cascade,
  
  -- Period
  period_start date not null,
  period_end date not null,
  
  -- Totals
  subtotal numeric(12, 2) default 0,
  adjustments numeric(12, 2) default 0,
  total numeric(12, 2) default 0,
  currency text default 'AED',
  
  -- Status
  status text check (status in ('draft', 'sent', 'paid', 'overdue')) default 'draft',
  
  -- Notes
  notes text,
  
  -- Metadata
  created_by_user_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists account_soa_client_id_idx on account_soa(client_id);
create index if not exists account_soa_period_idx on account_soa(period_start, period_end);

-- SOA Line Items (Monthly Service Breakdown)
create table if not exists account_soa_items (
  id uuid primary key default gen_random_uuid(),
  soa_id uuid not null references account_soa(id) on delete cascade,
  
  -- Service Info
  service_name text not null,
  category text,
  
  -- Monthly amounts (stored as JSONB for flexibility)
  -- e.g., {"2024-03": 1000, "2024-04": 1000, "2024-05": 1000}
  monthly_amounts jsonb default '{}'::jsonb,
  
  -- Total for this line
  line_total numeric(12, 2) default 0,
  
  -- Sort order
  sort_order int default 0,
  
  created_at timestamptz default now()
);

create index if not exists account_soa_items_soa_id_idx on account_soa_items(soa_id);

-- Ad-Hoc Requirements Tracker
create table if not exists account_adhoc_requirements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references account_clients(id) on delete cascade,
  soa_id uuid references account_soa(id) on delete set null,
  
  -- Requirement Details
  date_requested date not null,
  description text not null,
  service_date_start date,
  service_date_end date,
  
  -- Amount
  amount numeric(12, 2) default 0,
  currency text default 'AED',
  
  -- Status
  status text check (status in ('pending', 'completed')) default 'pending',
  
  -- Notes
  notes text,
  
  -- Metadata
  created_by_user_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists account_adhoc_client_id_idx on account_adhoc_requirements(client_id);
create index if not exists account_adhoc_soa_id_idx on account_adhoc_requirements(soa_id);
create index if not exists account_adhoc_status_idx on account_adhoc_requirements(status);

-- Client Services (for multi-select services)
create table if not exists account_service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  category text,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Seed common service types
insert into account_service_types (name, category, sort_order)
values 
  ('CRM Development', 'Development', 1),
  ('Hubspot Management', 'Marketing', 2),
  ('Website Maintenance', 'Development', 3),
  ('Social Media Management', 'Marketing', 4),
  ('SEO Services', 'Marketing', 5),
  ('CDN Services', 'Infrastructure', 6),
  ('Email Marketing', 'Marketing', 7),
  ('Content Creation', 'Marketing', 8),
  ('Branding', 'Design', 9),
  ('UI/UX Design', 'Design', 10)
on conflict (name) do nothing;
