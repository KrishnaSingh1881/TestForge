-- ============================================================
-- Fix: Add UNIQUE constraint to responses table
-- This fixes the "no unique or exclusion constraint" error
-- ============================================================

-- Add UNIQUE constraint on (attempt_id, question_id)
-- This ensures one response per question per attempt
ALTER TABLE responses 
ADD CONSTRAINT responses_attempt_question_unique 
UNIQUE (attempt_id, question_id);

-- Verify the constraint was added
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'responses'::regclass
AND conname = 'responses_attempt_question_unique';

-- This will return:
-- constraint_name: responses_attempt_question_unique
-- constraint_type: u (unique)
-- definition: UNIQUE (attempt_id, question_id)
