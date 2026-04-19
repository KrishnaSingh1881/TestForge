-- ============================================================
-- Diagnostic Script: Question Visibility Issues
-- Run this in Supabase SQL Editor to diagnose why questions aren't visible
-- ============================================================

-- 1. Check your user info and role
SELECT 
  id,
  email,
  role,
  created_at
FROM users 
WHERE id = auth.uid();

-- 2. Check recent questions you created
SELECT 
  id,
  type,
  statement,
  marks,
  created_by,
  created_at
FROM question_bank 
WHERE created_by = auth.uid() 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Check all tests you own
SELECT 
  id,
  title,
  subject,
  created_by,
  created_at,
  (SELECT COUNT(*) FROM test_questions WHERE test_id = tests.id) as question_count
FROM tests 
WHERE created_by = auth.uid()
ORDER BY created_at DESC;

-- 4. Check test_questions for a specific test (replace 'your-test-id')
-- SELECT 
--   tq.id,
--   tq.test_id,
--   tq.question_id,
--   tq.question_order,
--   tq.unlock_at_minutes,
--   qb.statement,
--   qb.type,
--   qb.marks
-- FROM test_questions tq
-- JOIN question_bank qb ON qb.id = tq.question_id
-- WHERE tq.test_id = 'your-test-id'
-- ORDER BY tq.question_order;

-- 5. Check RLS policies on question_bank
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'question_bank'
ORDER BY policyname;

-- 6. Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('question_bank', 'test_questions', 'mcq_options');

-- 7. Find orphaned questions (created but not attached to any test)
SELECT 
  qb.id,
  qb.type,
  qb.statement,
  qb.marks,
  qb.created_at,
  CASE 
    WHEN tq.question_id IS NULL THEN 'NOT ATTACHED'
    ELSE 'ATTACHED'
  END as status
FROM question_bank qb
LEFT JOIN test_questions tq ON tq.question_id = qb.id
WHERE qb.created_by = auth.uid()
ORDER BY qb.created_at DESC
LIMIT 20;

-- 8. Check for questions with missing options (MCQ only)
SELECT 
  qb.id,
  qb.statement,
  qb.type,
  COUNT(mo.id) as option_count
FROM question_bank qb
LEFT JOIN mcq_options mo ON mo.question_id = qb.id
WHERE qb.created_by = auth.uid()
AND qb.type IN ('mcq_single', 'mcq_multi')
GROUP BY qb.id, qb.statement, qb.type
HAVING COUNT(mo.id) = 0
ORDER BY qb.created_at DESC;

-- ============================================================
-- INTERPRETATION GUIDE
-- ============================================================

-- Query 1: Your user info
-- - If role is 'student', you can't create questions
-- - If role is 'admin', you can only see your own questions
-- - If role is 'super_admin', you can see all questions

-- Query 2: Recent questions
-- - If empty, questions aren't being created
-- - If has rows, questions are being created successfully

-- Query 3: Your tests
-- - Shows all tests you own
-- - question_count shows how many questions are attached
-- - If question_count is 0, questions aren't being attached

-- Query 7: Orphaned questions
-- - Shows questions that exist but aren't attached to any test
-- - If you see 'NOT ATTACHED', those questions need to be manually attached

-- Query 8: Questions with missing options
-- - MCQ questions should have at least 2 options
-- - If any show option_count = 0, the question is incomplete

-- ============================================================
-- QUICK FIXES
-- ============================================================

-- Fix 1: Manually attach an orphaned question to a test
-- (Replace the IDs with your actual values)
/*
INSERT INTO test_questions (test_id, question_id, unlock_at_minutes, question_order)
VALUES (
  'your-test-id',
  'your-question-id',
  0,
  (SELECT COALESCE(MAX(question_order), -1) + 1 FROM test_questions WHERE test_id = 'your-test-id')
);
*/

-- Fix 2: Upgrade yourself to super_admin (if needed)
/*
UPDATE users 
SET role = 'super_admin' 
WHERE id = auth.uid();
*/

-- Fix 3: Allow all admins to see all questions (modify RLS policy)
/*
DROP POLICY IF EXISTS "admins_read_own_questions" ON public.question_bank;

CREATE POLICY "admins_read_all_questions"
ON public.question_bank FOR SELECT
USING (
  public.get_user_role() IN ('admin', 'super_admin', 'master_admin')
);
*/
