-- Run this in Supabase SQL Editor to add question_selection column to attempts
ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS question_selection jsonb;
