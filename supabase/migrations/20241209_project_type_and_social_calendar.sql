-- Add project_type column to projects table
-- Allowed values: social_media, website, branding
ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS project_type TEXT CHECK (project_type IN ('social_media', 'website', 'branding'));

-- Add social_calendar_id to link a project to a social media calendar (social_projects)
ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS social_calendar_id UUID REFERENCES social_projects(id) ON DELETE SET NULL;

-- Create index for social_calendar_id
CREATE INDEX IF NOT EXISTS projects_social_calendar_id_idx ON projects(social_calendar_id);
