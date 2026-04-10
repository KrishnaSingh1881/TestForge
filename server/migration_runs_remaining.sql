-- Run in Supabase SQL Editor
ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS runs_remaining int NOT NULL DEFAULT 10;
