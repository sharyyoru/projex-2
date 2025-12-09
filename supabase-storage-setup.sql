-- =====================================================
-- Supabase Storage Setup for Project Workflows
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Create the storage bucket for project files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-files',
  'project-files',
  true,  -- public bucket so files can be viewed
  52428800,  -- 50MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-files');

-- 3. Policy: Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'project-files');

-- 4. Policy: Allow anyone to view/download files (public bucket)
CREATE POLICY "Anyone can view files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'project-files');

-- 5. Policy: Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'project-files');

-- =====================================================
-- Also ensure the project_workflows table exists
-- =====================================================

CREATE TABLE IF NOT EXISTS project_workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workflow_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

-- Enable RLS
ALTER TABLE project_workflows ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view workflows
CREATE POLICY "Authenticated users can view workflows"
ON project_workflows
FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert workflows
CREATE POLICY "Authenticated users can insert workflows"
ON project_workflows
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Authenticated users can update workflows
CREATE POLICY "Authenticated users can update workflows"
ON project_workflows
FOR UPDATE
TO authenticated
USING (true);

-- =====================================================
-- Workflow Step Mentions table for @mentions in comments
-- =====================================================

CREATE TABLE IF NOT EXISTS workflow_step_mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  step_id TEXT NOT NULL,
  mentioned_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workflow_step_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workflow mentions"
ON workflow_step_mentions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert workflow mentions"
ON workflow_step_mentions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Authenticated users can delete workflows
CREATE POLICY "Authenticated users can delete workflows"
ON project_workflows
FOR DELETE
TO authenticated
USING (true);
