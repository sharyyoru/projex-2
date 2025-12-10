-- Add parent_id column to danote_elements for column parent-child relationships
-- Run this in Supabase SQL Editor

-- Add parent_id column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'danote_elements' AND column_name = 'parent_id') THEN
        ALTER TABLE danote_elements 
        ADD COLUMN parent_id uuid REFERENCES danote_elements(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS danote_elements_parent_id_idx ON danote_elements(parent_id);
    END IF;
END $$;
