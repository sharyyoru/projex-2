-- ============================================
-- SOCIAL POSTS ENHANCEMENTS
-- Run this in Supabase SQL Editor
-- ============================================

-- Add new columns to social_posts table
ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS workflow_status text 
  CHECK (workflow_status IN ('new', 'creatives_approval', 'captions', 'client_approval', 'approved', 'posted')) 
  DEFAULT 'new';

ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS post_type text 
  CHECK (post_type IN ('organic', 'boosted')) 
  DEFAULT 'organic';

ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS content_type text;  -- reel, carousel, story, post, etc.

ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS image_asset_url text;

ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS video_url text;

ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS first_comment text;

-- Shoot details
ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS shoot_status text 
  CHECK (shoot_status IN ('pending', 'scheduled', 'completed', 'cancelled')) 
  DEFAULT 'pending';

ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS shoot_date date;

ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS shoot_time time;

ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS shoot_count integer DEFAULT 0;

ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS shoot_notes text;

-- Creatives section
ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS creative_notes text;

-- Associate with Danote board
ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS danote_board_id uuid REFERENCES danote_boards(id) ON DELETE SET NULL;

-- Platform-specific budget for boosted posts
ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS platform_budgets jsonb DEFAULT '{}'::jsonb;

-- Scheduled time separate from date for easier UI
ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS scheduled_time time;

-- Create index for danote_board_id
CREATE INDEX IF NOT EXISTS social_posts_danote_board_id_idx ON social_posts(danote_board_id);
CREATE INDEX IF NOT EXISTS social_posts_workflow_status_idx ON social_posts(workflow_status);
