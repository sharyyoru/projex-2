create extension if not exists "pgcrypto";

-- Users table linked to Supabase auth.users
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'staff',
  full_name text,
  email text,
  designation text,
  created_at timestamptz default now()
);

-- Companies (B2B accounts / organizations)
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  website text,
  email text,
  phone text,
  industry text,
  size text,
  street_address text,
  postal_code text,
  town text,
  country text,
  notes text,
  created_by_user_id uuid references users(id),
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists companies
  add column if not exists social_facebook text,
  add column if not exists social_instagram text,
  add column if not exists social_twitter text,
  add column if not exists social_linkedin text,
  add column if not exists social_youtube text,
  add column if not exists social_tiktok text;

create index if not exists companies_name_idx on companies(name);
create index if not exists companies_email_idx on companies(email);

-- Contacts belonging to a company
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  mobile text,
  job_title text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists contacts_company_id_idx on contacts(company_id);
create index if not exists contacts_email_idx on contacts(email);

-- Projects tracked under a company (optionally tied to a primary contact)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  primary_contact_id uuid references contacts(id) on delete set null,
  name text not null,
  description text,
  status text,
  pipeline text,
  value numeric(12, 2),
  start_date date,
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists projects_company_id_idx on projects(company_id);
create index if not exists projects_primary_contact_id_idx on projects(primary_contact_id);

alter table if exists projects
  add column if not exists processed_outcome text;

-- Patients
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  gender text check (gender in ('male','female','other')),
  dob date,
  marital_status text,
  nationality text,
  street_address text,
  postal_code text,
  town text,
  profession text,
  current_employer text,
  source text check (source in ('manual','event','meta','google')) default 'manual',
  notes text,
  avatar_url text,
  language_preference text,
  clinic_preference text,
  lifecycle_stage text,
  contact_owner_name text,
  contact_owner_email text,
  created_by_user_id uuid references users(id),
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists patients_email_idx on patients(email);
create unique index if not exists patients_email_unique
  on patients (lower(email));
create index if not exists patients_last_name_idx on patients(last_name);

-- Patient insurance information
create table if not exists patient_insurances (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  provider_name text not null,
  card_number text not null,
  insurance_type text check (insurance_type in ('private','semi_private','basic')) not null,
  created_at timestamptz default now()
);

create index if not exists patient_insurances_patient_id_idx on patient_insurances(patient_id);

-- Providers (doctors, clinicians)
create table if not exists providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text,
  email text,
  phone text,
  created_at timestamptz default now()
);

-- Appointment status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_status') then
    create type appointment_status as enum (
      'scheduled',
      'confirmed',
      'completed',
      'cancelled',
      'no_show'
    );
  end if;
end
$$;

-- Appointments
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  provider_id uuid references providers(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz,
  status appointment_status not null default 'scheduled',
  reason text,
  location text,
  source text check (source in ('manual','ai')) default 'manual',
  created_at timestamptz default now()
);

create index if not exists appointments_patient_id_idx on appointments(patient_id);
create index if not exists appointments_provider_id_idx on appointments(provider_id);
create index if not exists appointments_start_time_idx on appointments(start_time);

-- Deal stage type enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'deal_stage_type') then
    create type deal_stage_type as enum (
      'lead',
      'consultation',
      'surgery',
      'post_op',
      'follow_up',
      'other'
    );
  end if;
end
$$;

-- Deal pipeline stages
create table if not exists deal_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type deal_stage_type not null default 'other',
  sort_order int not null,
  is_default boolean not null default false
);

-- Services
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  name text not null,
  description text,
  base_price numeric(12, 2) not null default 0,
  category_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Deals (cases / opportunities)
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  stage_id uuid not null references deal_stages(id),
  service_id uuid references services(id) on delete set null,
  pipeline text,
  contact_label text,
  location text,
  title text,
  value numeric(12,2),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists deals_patient_id_idx on deals(patient_id);
create index if not exists deals_stage_id_idx on deals(stage_id);

alter table if exists deals
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists deals_project_id_idx on deals(project_id);

-- Crisalix reconstructions
create table if not exists crisalix_reconstructions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  crisalix_patient_id integer not null,
  reconstruction_type text not null,
  player_id text,
  created_at timestamp with time zone default now() not null
);

create index if not exists crisalix_reconstructions_patient_type_idx on crisalix_reconstructions(patient_id, reconstruction_type);

-- Workflow trigger type enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'workflow_trigger_type') then
    create type workflow_trigger_type as enum (
      'deal_stage_changed',
      'appointment_created',
      'appointment_updated'
    );
  end if;
end
$$;

-- Workflows
create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type workflow_trigger_type not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Ensure workflows has a JSONB config column for trigger-specific settings
alter table if exists workflows
  add column if not exists config jsonb not null default '{}'::jsonb;

-- Workflow action type enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'workflow_action_type') then
    create type workflow_action_type as enum (
      'draft_email_patient',
      'draft_email_insurance',
      'generate_postop_doc'
    );
  end if;
end
$$;

-- Workflow actions
create table if not exists workflow_actions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  action_type workflow_action_type not null,
  config jsonb not null default '{}'::jsonb,
  sort_order int not null default 1
);

create index if not exists workflow_actions_workflow_id_idx on workflow_actions(workflow_id);

-- Email template type enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'email_template_type') then
    create type email_template_type as enum (
      'patient',
      'insurance',
      'post_op'
    );
  end if;
end
$$;

-- Email templates
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type email_template_type not null,
  subject_template text not null,
  body_template text not null,
  created_at timestamptz default now()
);

-- Email status and direction enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'email_status') then
    create type email_status as enum (
      'draft',
      'queued',
      'sent',
      'failed'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'email_direction') then
    create type email_direction as enum (
      'outbound',
      'inbound'
    );
  end if;
end
$$;

-- Emails (patient + insurance)
create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  to_address text not null,
  from_address text,
  subject text not null,
  body text not null,
  status email_status not null default 'draft',
  direction email_direction not null default 'outbound',
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists emails_patient_id_idx on emails(patient_id);
create index if not exists emails_deal_id_idx on emails(deal_id);

create table if not exists email_attachments (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references emails(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  created_at timestamptz default now()
);

create index if not exists email_attachments_email_id_idx on email_attachments(email_id);

-- WhatsApp message status and direction enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'whatsapp_status') then
    create type whatsapp_status as enum (
      'queued',
      'sent',
      'delivered',
      'failed'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'whatsapp_direction') then
    create type whatsapp_direction as enum (
      'outbound',
      'inbound'
    );
  end if;
end
$$;

-- WhatsApp messages linked to a patient
create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete set null,
  to_number text not null,
  from_number text,
  body text not null,
  status whatsapp_status not null default 'queued',
  direction whatsapp_direction not null default 'outbound',
  provider_message_sid text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists whatsapp_messages_patient_id_idx on whatsapp_messages(patient_id);

-- Document type enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_type') then
    create type document_type as enum (
      'post_op',
      'report',
      'other'
    );
  end if;
end
$$;

-- Documents (e.g. AI-generated post-op instructions)
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  type document_type not null default 'other',
  title text not null,
  content text not null,
  created_by_user_id uuid references users(id),
  created_by text,
  created_at timestamptz default now()
);

create index if not exists documents_patient_id_idx on documents(patient_id);

-- Patient notes (internal collaboration notes on a patient)
create table if not exists patient_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  author_user_id uuid references users(id),
  author_name text,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists patient_notes_patient_id_idx on patient_notes(patient_id);

-- Project notes (internal collaboration notes on a project)
create table if not exists project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  author_user_id uuid references users(id),
  author_name text,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists project_notes_project_id_idx on project_notes(project_id);

-- Add source column to project_notes to track if created from admin or operations mode
alter table if exists project_notes
  add column if not exists source text check (source in ('operations','admin')) default 'operations';

-- Mentions/messages generated from project notes
create table if not exists project_note_mentions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references project_notes(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  mentioned_user_id uuid not null references users(id) on delete cascade,
  source text check (source in ('operations','admin')) default 'operations',
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists project_note_mentions_recipient_idx
  on project_note_mentions(mentioned_user_id, read_at);

-- Mentions/messages generated from patient notes
create table if not exists patient_note_mentions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references patient_notes(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  mentioned_user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists patient_note_mentions_recipient_idx
  on patient_note_mentions(mentioned_user_id, read_at);

-- Task status / priority / type enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type task_status as enum (
      'not_started',
      'in_progress',
      'completed'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type task_priority as enum (
      'low',
      'medium',
      'high'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_type') then
    create type task_type as enum (
      'todo',
      'call',
      'email',
      'other'
    );
  end if;
end
$$;

-- Tasks linked to a patient with optional assignee
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  name text not null,
  content text,
  status task_status not null default 'not_started',
  priority task_priority not null default 'medium',
  type task_type not null default 'todo',
  activity_date timestamptz,
  created_by_user_id uuid references users(id),
  created_by_name text,
  assigned_user_id uuid references users(id),
  assigned_user_name text,
  assigned_read_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tasks_patient_id_idx on tasks(patient_id);
create index if not exists tasks_assigned_user_id_idx on tasks(assigned_user_id);

alter table if exists tasks
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists tasks_project_id_idx on tasks(project_id);

-- Add source column to tasks to track if created from admin or operations mode
alter table if exists tasks
  add column if not exists source text check (source in ('operations','admin')) default 'operations';

-- Checklist items for tasks (patient or project)
create table if not exists task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  label text not null,
  is_completed boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists task_checklist_items_task_id_idx
  on task_checklist_items(task_id);

-- Task comments with mention support
create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  author_user_id uuid references users(id) on delete set null,
  author_name text,
  body text not null,
  source text check (source in ('operations','admin')) default 'operations',
  created_at timestamptz default now()
);

create index if not exists task_comments_task_id_idx on task_comments(task_id);

-- Mentions from task comments
create table if not exists task_comment_mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references task_comments(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  mentioned_user_id uuid not null references users(id) on delete cascade,
  source text check (source in ('operations','admin')) default 'operations',
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists task_comment_mentions_recipient_idx
  on task_comment_mentions(mentioned_user_id, read_at);

-- Patient edit locks (which user is currently editing which patient)
create table if not exists patient_edit_locks (
  patient_id uuid primary key references patients(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  user_name text,
  user_avatar_url text,
  updated_at timestamptz not null default now()
);

create index if not exists patient_edit_locks_user_id_idx
  on patient_edit_locks(user_id);

-- Consultation record type enum (aligns with medical tabs: notes onward)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'consultation_record_type') then
    create type consultation_record_type as enum (
      'notes',
      'prescription',
      'invoice',
      'file',
      'photo',
      '3d',
      'patient_information',
      'documents',
      'form_photos'
    );
  end if;
end
$$;

-- Consultations linked to a patient
create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  consultation_id text not null,
  title text not null,
  record_type consultation_record_type not null,
  doctor_user_id uuid references users(id),
  doctor_name text,
  scheduled_at timestamptz not null,
  payment_method text,
  content text,
  duration_seconds integer,
  invoice_total_amount numeric(12, 2),
  invoice_is_complimentary boolean not null default false,
  invoice_is_paid boolean not null default false,
  cash_receipt_path text,
  created_by_user_id uuid references users(id),
  created_by_name text,
  created_at timestamptz default now(),
  is_archived boolean not null default false,
  archived_at timestamptz
);

create index if not exists consultations_patient_id_idx on consultations(patient_id);

alter table if exists consultations
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists consultations_project_id_idx on consultations(project_id);

alter table if exists consultations
  alter column patient_id drop not null;

-- Comments on tasks
create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_user_id uuid references users(id),
  author_name text,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists task_comments_task_id_idx on task_comments(task_id);

-- Mentions generated from task comments
create table if not exists task_comment_mentions (
  id uuid primary key default gen_random_uuid(),
  task_comment_id uuid not null references task_comments(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  mentioned_user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists task_comment_mentions_recipient_idx
  on task_comment_mentions(mentioned_user_id, read_at);

-- Service categories (e.g. Aesthetics, Reconstructive)
create table if not exists service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order int not null default 1,
  created_at timestamptz default now()
);

create unique index if not exists service_categories_name_key
  on service_categories(name);

-- Services offered by the clinic, grouped by category
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references service_categories(id) on delete restrict,
  name text not null,
  description text,
  is_active boolean not null default true,
  base_price numeric(12,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists services_category_id_idx on services(category_id);
create unique index if not exists services_category_id_name_key
  on services(category_id, name);

-- Service groups (bundles of services)
create table if not exists service_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz default now()
);

create unique index if not exists service_groups_name_key
  on service_groups(name);

-- Many-to-many relation between service groups and services
create table if not exists service_group_services (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references service_groups(id) on delete cascade,
  service_id uuid not null references services(id) on delete restrict,
  created_at timestamptz default now()
);

create unique index if not exists service_group_services_group_service_key
  on service_group_services(group_id, service_id);

alter table if exists service_groups
  add column if not exists discount_percent numeric(5, 2);

alter table if exists service_group_services
  add column if not exists discount_percent numeric(5, 2),
  add column if not exists quantity integer not null default 1;

-- Seed initial Services data: Aesthetics category and core services
insert into service_categories (id, name, description, sort_order)
values (
  gen_random_uuid(),
  'Aesthetics',
  'Aesthetic and cosmetic procedures',
  1
)
on conflict (name) do nothing;

insert into services (id, category_id, name, description, is_active, base_price)
select
  gen_random_uuid(),
  c.id,
  s.name,
  s.description,
  true,
  s.base_price
from service_categories c
join (
  values
    ('Liposuction', 'Targeted fat removal', null::numeric),
    ('Breast Reconstruction', 'Reconstructive breast surgery', null::numeric),
    ('Filler', 'Dermal filler treatment', null::numeric),
    ('Blepharoplasty', 'Eyelid surgery', null::numeric)
) as s(name, description, base_price)
  on c.name = 'Aesthetics'
on conflict (category_id, name) do nothing;

-- Chat folders for organizing conversations per staff user
create table if not exists chat_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists chat_folders_user_id_idx on chat_folders(user_id);

-- Chat conversations linked to a user and optional folder/patient/deal
create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  folder_id uuid references chat_folders(id) on delete set null,
  title text,
  patient_id uuid references patients(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_archived boolean not null default false,
  archived_at timestamptz
);

create index if not exists chat_conversations_user_id_idx
  on chat_conversations(user_id);

create index if not exists chat_conversations_folder_id_idx
  on chat_conversations(folder_id);

create index if not exists chat_conversations_user_updated_idx
  on chat_conversations(user_id, updated_at desc);

alter table if exists chat_conversations
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

create index if not exists chat_conversations_user_archived_idx
  on chat_conversations(user_id, is_archived, updated_at desc);

-- Chat messages belonging to conversations
do $$
begin
  if not exists (select 1 from pg_type where typname = 'chat_message_role') then
    create type chat_message_role as enum ('user', 'assistant', 'system');
  end if;
end
$$;

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  role chat_message_role not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists chat_messages_conversation_id_idx
  on chat_messages(conversation_id);

create index if not exists chat_messages_conversation_created_idx
  on chat_messages(conversation_id, created_at);

-- ============================================
-- INVOICING SYSTEM
-- ============================================

-- Invoice settings (company details, logo, etc.)
create table if not exists invoice_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  company_name text,
  company_logo_url text,
  company_address text,
  company_city text,
  company_country text,
  company_phone text,
  company_email text,
  company_website text,
  company_tax_id text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_iban text,
  bank_swift text,
  invoice_prefix text default 'INV',
  quote_prefix text default 'QUO',
  invoice_notes text,
  quote_notes text,
  currency text default 'AED',
  tax_rate numeric(5,2) default 5.00,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists invoice_settings_user_id_idx
  on invoice_settings(user_id);

-- Invoice/Quote status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_type') then
    create type invoice_type as enum ('quote', 'invoice');
  end if;
end$$;

-- Invoices and quotes table
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  invoice_number text not null,
  invoice_type text check (invoice_type in ('quote', 'invoice')) default 'invoice',
  status text check (status in ('draft', 'sent', 'paid', 'unpaid', 'overdue', 'cancelled', 'accepted', 'rejected')) default 'draft',
  
  -- Client details
  client_name text not null,
  client_email text,
  client_phone text,
  client_address text,
  client_city text,
  client_country text,
  client_tax_id text,
  
  -- Dates
  issue_date date not null default current_date,
  due_date date,
  paid_date date,
  
  -- Amounts
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) default 5.00,
  tax_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) default 0,
  total numeric(12,2) not null default 0,
  currency text default 'AED',
  
  -- Notes
  notes text,
  terms text,
  
  -- Company snapshot (copied from settings at creation)
  company_name text,
  company_logo_url text,
  company_address text,
  company_city text,
  company_country text,
  company_phone text,
  company_email text,
  company_tax_id text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_iban text,
  bank_swift text,
  
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists invoices_project_id_idx on invoices(project_id);
create index if not exists invoices_status_idx on invoices(status);
create index if not exists invoices_type_idx on invoices(invoice_type);
create index if not exists invoices_created_at_idx on invoices(created_at desc);

-- Invoice line items
create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  sort_order int default 0,
  created_at timestamptz default now()
);

create index if not exists invoice_items_invoice_id_idx on invoice_items(invoice_id);

-- Project workflows (stores workflow progress as JSON)
create table if not exists project_workflows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  workflow_data jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists project_workflows_project_id_idx on project_workflows(project_id);

-- ============================================
-- SOCIAL MEDIA MODULE
-- ============================================

-- Social Media Projects (separate from regular projects)
create table if not exists social_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  description text,
  brand_color text,
  logo_url text,
  status text check (status in ('active', 'paused', 'completed', 'archived')) default 'active',
  platforms jsonb default '[]'::jsonb, -- array of platform names: instagram, linkedin, tiktok, x
  created_by_user_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists social_projects_company_id_idx on social_projects(company_id);

-- Social Posts (short-form content)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'social_post_status') then
    create type social_post_status as enum ('draft', 'pending', 'approved', 'published');
  end if;
end$$;

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references social_projects(id) on delete cascade,
  platforms jsonb default '[]'::jsonb, -- selected platforms for this post
  caption text,
  media_urls jsonb default '[]'::jsonb, -- array of {url, type: 'image'|'video', thumbnail_url}
  scheduled_date timestamptz,
  status text check (status in ('draft', 'pending', 'approved', 'published')) default 'draft',
  published_urls jsonb default '{}'::jsonb, -- { instagram: 'https://...', linkedin: 'https://...' }
  hashtags text[] default '{}',
  created_by_user_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists social_posts_project_id_idx on social_posts(project_id);
create index if not exists social_posts_scheduled_date_idx on social_posts(scheduled_date);
create index if not exists social_posts_status_idx on social_posts(status);

-- Social Articles (long-form / blog content)
create table if not exists social_articles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references social_projects(id) on delete cascade,
  title text not null,
  slug text,
  body_html text,
  body_markdown text,
  featured_image_url text,
  status text check (status in ('draft', 'pending', 'approved', 'published')) default 'draft',
  
  -- SEO fields
  target_keyword text,
  meta_title text,
  meta_description text,
  
  -- Content pillars / categories
  content_pillar text, -- 'thought_leadership', 'product_update', 'case_study', 'how_to', 'industry_news'
  
  -- Links
  internal_links jsonb default '[]'::jsonb,
  external_links jsonb default '[]'::jsonb,
  
  scheduled_date timestamptz,
  published_url text,
  
  created_by_user_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists social_articles_project_id_idx on social_articles(project_id);
create index if not exists social_articles_status_idx on social_articles(status);

-- Social Reports (monthly analytics)
create table if not exists social_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references social_projects(id) on delete cascade,
  report_month date not null, -- first day of the month (e.g., '2025-11-01')
  
  -- KPI data
  kpi_data jsonb default '{}'::jsonb, -- { reach: {actual, goal}, engagement: {actual, goal}, ... }
  
  -- Platform-specific metrics
  platform_metrics jsonb default '{}'::jsonb, -- { instagram: {...}, linkedin: {...} }
  
  -- Month-over-month calculations stored
  mom_comparison jsonb default '{}'::jsonb,
  
  -- Public link for client access
  public_link_token text unique,
  public_link_expires_at timestamptz,
  is_published boolean default false,
  
  notes text,
  
  created_by_user_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists social_reports_project_id_idx on social_reports(project_id);
create index if not exists social_reports_month_idx on social_reports(report_month);
create unique index if not exists social_reports_public_token_idx on social_reports(public_link_token) where public_link_token is not null;

-- Client feedback on posts/articles (for external access)
create table if not exists social_content_feedback (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references social_posts(id) on delete cascade,
  article_id uuid references social_articles(id) on delete cascade,
  action text check (action in ('approved', 'changes_requested')) not null,
  client_name text not null,
  comment text,
  created_at timestamptz default now(),
  
  constraint feedback_has_content check (post_id is not null or article_id is not null)
);

create index if not exists social_content_feedback_post_idx on social_content_feedback(post_id);
create index if not exists social_content_feedback_article_idx on social_content_feedback(article_id);

-- Public access links for content review
create table if not exists social_public_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references social_projects(id) on delete cascade,
  token text unique not null default gen_random_uuid()::text,
  link_type text check (link_type in ('content_review', 'report')) not null,
  expires_at timestamptz,
  created_by_user_id uuid references users(id),
  created_at timestamptz default now()
);

create unique index if not exists social_public_links_token_idx on social_public_links(token);

-- ============================================
-- DANOTE - VISUAL COLLABORATION BOARDS
-- ============================================

-- Danote Boards (main containers)
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

create index if not exists danote_boards_user_id_idx on danote_boards(user_id);
create index if not exists danote_boards_parent_id_idx on danote_boards(parent_board_id);
create index if not exists danote_boards_project_id_idx on danote_boards(project_id);

-- Danote Elements (cards, notes, images, etc.)
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

create index if not exists danote_elements_board_id_idx on danote_elements(board_id);
create index if not exists danote_elements_parent_id_idx on danote_elements(parent_id);

-- Danote Connections (lines/arrows between elements)
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

create index if not exists danote_connections_board_id_idx on danote_connections(board_id);
create index if not exists danote_connections_from_idx on danote_connections(from_element_id);
create index if not exists danote_connections_to_idx on danote_connections(to_element_id);

-- Danote Unsorted Tray (elements not yet placed on board)
create table if not exists danote_unsorted (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references danote_boards(id) on delete cascade,
  type text not null check (type in ('note', 'text', 'image', 'todo', 'color-swatch')),
  content text default '',
  color text default '#fef3c7',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists danote_unsorted_board_id_idx on danote_unsorted(board_id);
