-- Add reactions column to dischat_messages table
ALTER TABLE dischat_messages 
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;

-- Add index for faster reaction queries
CREATE INDEX IF NOT EXISTS idx_dischat_messages_reactions 
ON dischat_messages USING gin(reactions);

-- Add reply_to_id column if not exists
ALTER TABLE dischat_messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES dischat_messages(id);

-- Add index for reply lookups
CREATE INDEX IF NOT EXISTS idx_dischat_messages_reply_to 
ON dischat_messages(reply_to_id) 
WHERE reply_to_id IS NOT NULL;
