-- ============================================================
-- Quick Fix: Attach Orphaned Questions to Test
-- INSTRUCTIONS: Run each step in order, copy the IDs, then use them in the final step
-- ============================================================

-- ============================================================
-- STEP 1: Find your test ID
-- Run this query and COPY the test_id from the results
-- ============================================================
SELECT 
  id as test_id,
  title,
  subject,
  (SELECT COUNT(*) FROM test_questions WHERE test_id = tests.id) as attached_questions
FROM tests 
WHERE created_by = auth.uid()
ORDER BY created_at DESC
LIMIT 5;


-- ============================================================
-- STEP 2: Find orphaned questions (not attached to any test)
-- Run this query and COPY the question_id(s) from the results
-- ============================================================
SELECT 
  qb.id as question_id,
  qb.type,
  qb.statement,
  qb.marks,
  qb.created_at
FROM question_bank qb
LEFT JOIN test_questions tq ON tq.question_id = qb.id
WHERE qb.created_by = auth.uid()
AND tq.question_id IS NULL  -- Not attached to any test
ORDER BY qb.created_at DESC
LIMIT 10;


-- ============================================================
-- STEP 3A: Attach a SINGLE question to test
-- 
-- BEFORE RUNNING:
-- 1. Copy the test_id from STEP 1 results
-- 2. Copy a question_id from STEP 2 results
-- 3. Replace BOTH placeholders below with your actual UUIDs
-- 4. Then run this query
-- ============================================================

-- EXAMPLE: If your test_id is abc123... and question_id is def456...
-- Change this:
--   v_test_id uuid := 'abc123...'::uuid;
--   v_question_id uuid := 'def456...'::uuid;

DO $$
DECLARE
  v_test_id uuid := 'REPLACE-WITH-YOUR-TEST-ID'::uuid;
  v_question_id uuid := 'REPLACE-WITH-YOUR-QUESTION-ID'::uuid;
  v_next_order int;
BEGIN
  -- Get the next question order
  SELECT COALESCE(MAX(question_order), -1) + 1 
  INTO v_next_order
  FROM test_questions 
  WHERE test_id = v_test_id;
  
  -- Attach the question
  INSERT INTO test_questions (test_id, question_id, unlock_at_minutes, question_order)
  VALUES (v_test_id, v_question_id, 0, v_next_order);
  
  RAISE NOTICE 'Question attached successfully at position %', v_next_order;
END $$;


-- ============================================================
-- STEP 3B (ALTERNATIVE): Attach ALL orphaned questions at once
-- 
-- BEFORE RUNNING:
-- 1. Copy the test_id from STEP 1 results
-- 2. Replace the placeholder below with your actual test UUID
-- 3. Then run this query
-- 
-- This will attach ALL questions from STEP 2 to your test
-- ============================================================

DO $$
DECLARE
  v_test_id uuid := 'REPLACE-WITH-YOUR-TEST-ID'::uuid;
  v_question record;
  v_order int;
  v_start_order int;
  v_count int := 0;
BEGIN
  -- Get starting order
  SELECT COALESCE(MAX(question_order), -1) + 1 
  INTO v_order
  FROM test_questions 
  WHERE test_id = v_test_id;
  
  v_start_order := v_order;
  
  -- Loop through all orphaned questions
  FOR v_question IN 
    SELECT qb.id
    FROM question_bank qb
    LEFT JOIN test_questions tq ON tq.question_id = qb.id
    WHERE qb.created_by = auth.uid()
    AND tq.question_id IS NULL
    ORDER BY qb.created_at
  LOOP
    INSERT INTO test_questions (test_id, question_id, unlock_at_minutes, question_order)
    VALUES (v_test_id, v_question.id, 0, v_order);
    
    v_order := v_order + 1;
    v_count := v_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Successfully attached % questions', v_count;
END $$;


-- ============================================================
-- STEP 4: Verify the attachment worked
-- 
-- BEFORE RUNNING:
-- 1. Copy the test_id from STEP 1 results
-- 2. Replace the placeholder below with your actual test UUID
-- 3. Then run this query to see all attached questions
-- ============================================================

SELECT 
  tq.question_order,
  qb.type,
  qb.statement,
  qb.marks,
  qb.created_at
FROM test_questions tq
JOIN question_bank qb ON qb.id = tq.question_id
WHERE tq.test_id = 'REPLACE-WITH-YOUR-TEST-ID'::uuid
ORDER BY tq.question_order;
