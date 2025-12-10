-- Migration: Update danote_elements type constraint to include new element types
-- Run this in Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE danote_elements DROP CONSTRAINT IF EXISTS danote_elements_type_check;

-- Add the new constraint with all element types
ALTER TABLE danote_elements 
ADD CONSTRAINT danote_elements_type_check 
CHECK (type IN (
  'note', 
  'text',           -- legacy, keep for backward compatibility
  'text-header', 
  'text-paragraph', 
  'text-sentence',
  'image', 
  'todo', 
  'column', 
  'color-swatch', 
  'board-link',
  'rectangle',
  'circle',
  'line',
  'arrow',
  'container',
  'audio'
));

-- Also update the danote_unsorted table if needed
ALTER TABLE danote_unsorted DROP CONSTRAINT IF EXISTS danote_unsorted_type_check;

ALTER TABLE danote_unsorted 
ADD CONSTRAINT danote_unsorted_type_check 
CHECK (type IN (
  'note', 
  'text',
  'text-header', 
  'text-paragraph', 
  'text-sentence',
  'image', 
  'todo', 
  'color-swatch'
));
