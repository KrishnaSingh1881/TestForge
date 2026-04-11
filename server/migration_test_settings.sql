-- Add settings JSONB column to tests table
ALTER TABLE tests ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
