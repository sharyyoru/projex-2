-- ============================================
-- DANOTE COMMENTS & MENTIONS SYSTEM
-- Run this in Supabase SQL Editor
-- ============================================

-- Comments on Danote boards
CREATE TABLE IF NOT EXISTS danote_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES danote_boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  parent_id uuid REFERENCES danote_comments(id) ON DELETE CASCADE, -- For threaded replies
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Mentions in comments
CREATE TABLE IF NOT EXISTS danote_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES danote_comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Notifications for mentions
CREATE TABLE IF NOT EXISTS danote_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Who receives the notification
  from_user_id uuid REFERENCES users(id) ON DELETE SET NULL, -- Who triggered it
  board_id uuid NOT NULL REFERENCES danote_boards(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES danote_comments(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'mention' CHECK (type IN ('mention', 'comment', 'reply')),
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS danote_comments_board_id_idx ON danote_comments(board_id);
CREATE INDEX IF NOT EXISTS danote_comments_user_id_idx ON danote_comments(user_id);
CREATE INDEX IF NOT EXISTS danote_comments_parent_id_idx ON danote_comments(parent_id);
CREATE INDEX IF NOT EXISTS danote_mentions_comment_id_idx ON danote_mentions(comment_id);
CREATE INDEX IF NOT EXISTS danote_mentions_user_id_idx ON danote_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS danote_notifications_user_id_idx ON danote_notifications(user_id);
CREATE INDEX IF NOT EXISTS danote_notifications_board_id_idx ON danote_notifications(board_id);
CREATE INDEX IF NOT EXISTS danote_notifications_is_read_idx ON danote_notifications(is_read);

-- RLS Policies
ALTER TABLE danote_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE danote_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE danote_notifications ENABLE ROW LEVEL SECURITY;

-- Comments: Anyone can read, authenticated users can create
CREATE POLICY "Anyone can view comments" ON danote_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON danote_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON danote_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON danote_comments FOR DELETE USING (auth.uid() = user_id);

-- Mentions: Anyone can read
CREATE POLICY "Anyone can view mentions" ON danote_mentions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create mentions" ON danote_mentions FOR INSERT WITH CHECK (true);

-- Notifications: Users can only see their own
CREATE POLICY "Users can view their own notifications" ON danote_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON danote_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own notifications" ON danote_notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON danote_notifications FOR DELETE USING (auth.uid() = user_id);
