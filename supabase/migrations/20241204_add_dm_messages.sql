-- Create DM messages table for personal chats
CREATE TABLE IF NOT EXISTS dischat_dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  reactions JSONB DEFAULT '[]'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching conversation messages efficiently
CREATE INDEX IF NOT EXISTS idx_dm_messages_sender ON dischat_dm_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_receiver ON dischat_dm_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation ON dischat_dm_messages(sender_id, receiver_id, created_at DESC);

-- Enable RLS
ALTER TABLE dischat_dm_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see DMs they sent or received
CREATE POLICY "Users can view their own DMs" ON dischat_dm_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Policy: Users can send DMs to anyone
CREATE POLICY "Users can send DMs" ON dischat_dm_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
  );

-- Policy: Users can update their own sent messages
CREATE POLICY "Users can update their own DMs" ON dischat_dm_messages
  FOR UPDATE USING (
    auth.uid() = sender_id
  );

-- Policy: Users can delete their own sent messages
CREATE POLICY "Users can delete their own DMs" ON dischat_dm_messages
  FOR DELETE USING (
    auth.uid() = sender_id
  );

-- Enable realtime for DM messages
ALTER PUBLICATION supabase_realtime ADD TABLE dischat_dm_messages;
