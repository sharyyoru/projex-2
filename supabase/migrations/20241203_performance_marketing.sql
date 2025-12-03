-- ============================================
-- PERFORMANCE MARKETING MODULE
-- ============================================

-- Marketing Channels enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'marketing_channel') then
    create type marketing_channel as enum (
      'google_ads',
      'meta_ads',
      'linkedin_ads',
      'tiktok_ads',
      'twitter_ads',
      'microsoft_ads',
      'organic_search',
      'organic_social',
      'referral',
      'direct',
      'email',
      'other'
    );
  end if;
end$$;

-- Marketing Campaigns Master List
create table if not exists marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  channel marketing_channel not null,
  utm_campaign text, -- Exact UTM campaign value for matching
  utm_source text,
  utm_medium text,
  description text,
  start_date date,
  end_date date,
  budget numeric(12, 2),
  is_active boolean default true,
  created_by_user_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists marketing_campaigns_project_id_idx on marketing_campaigns(project_id);
create index if not exists marketing_campaigns_utm_campaign_idx on marketing_campaigns(utm_campaign);
create index if not exists marketing_campaigns_channel_idx on marketing_campaigns(channel);

-- Marketing Expense Log (Manual Spend Entries)
create table if not exists marketing_expense_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  campaign_id uuid references marketing_campaigns(id) on delete set null,
  date_start date not null,
  date_end date not null,
  channel marketing_channel not null,
  campaign_name text not null, -- The key for matching to utm_campaign
  spend_amount numeric(12, 2) not null,
  currency text default 'AED',
  manual_clicks integer,
  manual_impressions integer,
  manual_conversions integer,
  notes text,
  import_source text check (import_source in ('manual', 'csv', 'xlsx')) default 'manual',
  import_filename text, -- Original filename if imported
  import_hash text, -- Hash for duplicate detection
  created_by_user_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists marketing_expense_logs_project_id_idx on marketing_expense_logs(project_id);
create index if not exists marketing_expense_logs_campaign_id_idx on marketing_expense_logs(campaign_id);
create index if not exists marketing_expense_logs_date_idx on marketing_expense_logs(date_start, date_end);
create index if not exists marketing_expense_logs_channel_idx on marketing_expense_logs(channel);
create unique index if not exists marketing_expense_logs_import_hash_idx on marketing_expense_logs(project_id, import_hash) where import_hash is not null;

-- Marketing Leads (Leads with attribution data)
create table if not exists marketing_leads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  campaign_id uuid references marketing_campaigns(id) on delete set null,
  
  -- Lead information
  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,
  
  -- Attribution data
  channel marketing_channel,
  lead_source text, -- Manual tag: "How did you hear about us?"
  utm_campaign text,
  utm_source text,
  utm_medium text,
  utm_content text,
  utm_term text,
  
  -- Click IDs for offline conversion tracking
  gclid text, -- Google Click ID
  fbclid text, -- Facebook Click ID
  msclkid text, -- Microsoft Click ID
  ttclid text, -- TikTok Click ID
  li_fat_id text, -- LinkedIn First-Party Ad Tracking ID
  
  -- Conversion data
  landing_page text,
  referrer_url text,
  user_agent text,
  ip_address text,
  
  -- Deal/Revenue tracking
  deal_id uuid references deals(id) on delete set null,
  deal_value numeric(12, 2),
  deal_status text check (deal_status in ('open', 'won', 'lost')),
  converted_at timestamptz,
  
  -- Cost attribution (calculated)
  attributed_cost numeric(12, 2),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists marketing_leads_project_id_idx on marketing_leads(project_id);
create index if not exists marketing_leads_campaign_id_idx on marketing_leads(campaign_id);
create index if not exists marketing_leads_channel_idx on marketing_leads(channel);
create index if not exists marketing_leads_utm_campaign_idx on marketing_leads(utm_campaign);
create index if not exists marketing_leads_gclid_idx on marketing_leads(gclid) where gclid is not null;
create index if not exists marketing_leads_fbclid_idx on marketing_leads(fbclid) where fbclid is not null;
create index if not exists marketing_leads_deal_status_idx on marketing_leads(deal_status);
create index if not exists marketing_leads_created_at_idx on marketing_leads(created_at);

-- Marketing Reports (Stored snapshots for public sharing)
create table if not exists marketing_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  date_start date not null,
  date_end date not null,
  
  -- Report data (snapshot)
  report_data jsonb not null default '{}'::jsonb,
  
  -- Public access
  public_token text unique default gen_random_uuid()::text,
  public_expires_at timestamptz,
  is_published boolean default false,
  
  created_by_user_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists marketing_reports_project_id_idx on marketing_reports(project_id);
create unique index if not exists marketing_reports_token_idx on marketing_reports(public_token) where public_token is not null;

-- Function to calculate weighted cost per lead
create or replace function calculate_weighted_cpl(
  p_project_id uuid,
  p_channel marketing_channel,
  p_date_start date,
  p_date_end date
) returns numeric as $$
declare
  v_total_spend numeric;
  v_lead_count integer;
begin
  -- Get total spend for channel in date range
  select coalesce(sum(spend_amount), 0) into v_total_spend
  from marketing_expense_logs
  where project_id = p_project_id
    and channel = p_channel
    and date_start >= p_date_start
    and date_end <= p_date_end;
  
  -- Get lead count for channel in date range
  select count(*) into v_lead_count
  from marketing_leads
  where project_id = p_project_id
    and channel = p_channel
    and created_at >= p_date_start
    and created_at < p_date_end + interval '1 day';
  
  -- Return CPL
  if v_lead_count > 0 then
    return round(v_total_spend / v_lead_count, 2);
  else
    return null;
  end if;
end;
$$ language plpgsql;

-- Function to calculate ROAS
create or replace function calculate_roas(
  p_project_id uuid,
  p_date_start date,
  p_date_end date,
  p_channel marketing_channel default null
) returns numeric as $$
declare
  v_total_spend numeric;
  v_total_revenue numeric;
begin
  -- Get total spend
  select coalesce(sum(spend_amount), 0) into v_total_spend
  from marketing_expense_logs
  where project_id = p_project_id
    and date_start >= p_date_start
    and date_end <= p_date_end
    and (p_channel is null or channel = p_channel);
  
  -- Get total revenue from won deals
  select coalesce(sum(deal_value), 0) into v_total_revenue
  from marketing_leads
  where project_id = p_project_id
    and deal_status = 'won'
    and converted_at >= p_date_start
    and converted_at < p_date_end + interval '1 day'
    and (p_channel is null or channel = p_channel);
  
  -- Return ROAS
  if v_total_spend > 0 then
    return round(v_total_revenue / v_total_spend, 2);
  else
    return null;
  end if;
end;
$$ language plpgsql;
