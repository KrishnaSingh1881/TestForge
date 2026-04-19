-- ============================================================
-- Test Script for Behavioral Flags
-- This script tests all behavioral flag generation scenarios
-- ============================================================

-- First, let's check if the trigger function exists
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'auto_generate_behavioral_flags';

-- Check if the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trg_auto_behavioral_flags';

-- ============================================================
-- TEST 1: Paste Event Flag (HIGH severity)
-- ============================================================
DO $$
DECLARE
  test_attempt_id uuid;
  test_question_id uuid;
BEGIN
  -- Get a test attempt and question
  SELECT id INTO test_attempt_id FROM attempts WHERE status = 'in_progress' LIMIT 1;
  SELECT id INTO test_question_id FROM question_bank WHERE type = 'debugging' LIMIT 1;
  
  IF test_attempt_id IS NULL OR test_question_id IS NULL THEN
    RAISE NOTICE 'No test data available. Create an in-progress attempt first.';
    RETURN;
  END IF;

  RAISE NOTICE 'TEST 1: Testing paste event flag...';
  
  -- Insert/Update response with paste event
  INSERT INTO responses (attempt_id, question_id, submitted_code, behavioral_meta)
  VALUES (
    test_attempt_id,
    test_question_id,
    'print("test")',
    jsonb_build_object(
      'paste_events', 1,
      'time_to_first_keystroke', 5000,
      'backspace_count', 5,
      'edit_count', 3,
      'wpm_consistency', 50,
      'test_runs_before_submit', 2,
      'idle_periods', '[]'::jsonb
    )
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE
  SET behavioral_meta = EXCLUDED.behavioral_meta;
  
  -- Check if flag was created
  IF EXISTS (
    SELECT 1 FROM behavioral_flags
    WHERE attempt_id = test_attempt_id
    AND question_id = test_question_id
    AND type = 'paste'
  ) THEN
    RAISE NOTICE '✅ Paste flag created successfully';
  ELSE
    RAISE NOTICE '❌ Paste flag NOT created';
  END IF;
END $$;

-- ============================================================
-- TEST 2: Fast Start Flag (HIGH severity)
-- ============================================================
DO $$
DECLARE
  test_attempt_id uuid;
  test_question_id uuid;
BEGIN
  SELECT id INTO test_attempt_id FROM attempts WHERE status = 'in_progress' LIMIT 1;
  SELECT id INTO test_question_id FROM question_bank WHERE type = 'debugging' LIMIT 1;
  
  IF test_attempt_id IS NULL OR test_question_id IS NULL THEN
    RETURN;
  END IF;

  RAISE NOTICE 'TEST 2: Testing fast start flag (typed within 3s)...';
  
  -- Insert response with fast start (< 3000ms)
  INSERT INTO responses (attempt_id, question_id, submitted_code, behavioral_meta)
  VALUES (
    test_attempt_id,
    test_question_id,
    'print("fast")',
    jsonb_build_object(
      'paste_events', 0,
      'time_to_first_keystroke', 2000,  -- 2 seconds (< 3000)
      'backspace_count', 5,
      'edit_count', 3,
      'wpm_consistency', 50,
      'test_runs_before_submit', 2,
      'idle_periods', '[]'::jsonb
    )
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE
  SET behavioral_meta = EXCLUDED.behavioral_meta;
  
  -- Check if flag was created
  IF EXISTS (
    SELECT 1 FROM behavioral_flags
    WHERE attempt_id = test_attempt_id
    AND question_id = test_question_id
    AND type = 'fast_start'
  ) THEN
    RAISE NOTICE '✅ Fast start flag created successfully';
  ELSE
    RAISE NOTICE '❌ Fast start flag NOT created';
  END IF;
END $$;

-- ============================================================
-- TEST 3: High WPM Flag (MEDIUM severity)
-- ============================================================
DO $$
DECLARE
  test_attempt_id uuid;
  test_question_id uuid;
BEGIN
  SELECT id INTO test_attempt_id FROM attempts WHERE status = 'in_progress' LIMIT 1;
  SELECT id INTO test_question_id FROM question_bank WHERE type = 'debugging' LIMIT 1;
  
  IF test_attempt_id IS NULL OR test_question_id IS NULL THEN
    RETURN;
  END IF;

  RAISE NOTICE 'TEST 3: Testing high WPM flag (>120 WPM)...';
  
  -- Insert response with high WPM
  INSERT INTO responses (attempt_id, question_id, submitted_code, behavioral_meta)
  VALUES (
    test_attempt_id,
    test_question_id,
    'print("speed")',
    jsonb_build_object(
      'paste_events', 0,
      'time_to_first_keystroke', 5000,
      'backspace_count', 5,
      'edit_count', 3,
      'wpm_consistency', 150,  -- > 120
      'test_runs_before_submit', 2,
      'idle_periods', '[]'::jsonb
    )
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE
  SET behavioral_meta = EXCLUDED.behavioral_meta;
  
  -- Check if flag was created
  IF EXISTS (
    SELECT 1 FROM behavioral_flags
    WHERE attempt_id = test_attempt_id
    AND question_id = test_question_id
    AND type = 'high_wpm'
  ) THEN
    RAISE NOTICE '✅ High WPM flag created successfully';
  ELSE
    RAISE NOTICE '❌ High WPM flag NOT created';
  END IF;
END $$;

-- ============================================================
-- TEST 4: No Corrections Flag (HIGH severity)
-- ============================================================
DO $$
DECLARE
  test_attempt_id uuid;
  test_question_id uuid;
BEGIN
  SELECT id INTO test_attempt_id FROM attempts WHERE status = 'in_progress' LIMIT 1;
  SELECT id INTO test_question_id FROM question_bank WHERE type = 'debugging' LIMIT 1;
  
  IF test_attempt_id IS NULL OR test_question_id IS NULL THEN
    RETURN;
  END IF;

  RAISE NOTICE 'TEST 4: Testing no corrections flag (<=2 backspaces + >100 WPM)...';
  
  -- Insert response with no corrections
  INSERT INTO responses (attempt_id, question_id, submitted_code, behavioral_meta)
  VALUES (
    test_attempt_id,
    test_question_id,
    'print("perfect")',
    jsonb_build_object(
      'paste_events', 0,
      'time_to_first_keystroke', 5000,
      'backspace_count', 1,  -- <= 2
      'edit_count', 3,
      'wpm_consistency', 110,  -- > 100
      'test_runs_before_submit', 2,
      'idle_periods', '[]'::jsonb
    )
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE
  SET behavioral_meta = EXCLUDED.behavioral_meta;
  
  -- Check if flag was created
  IF EXISTS (
    SELECT 1 FROM behavioral_flags
    WHERE attempt_id = test_attempt_id
    AND question_id = test_question_id
    AND type = 'no_corrections'
  ) THEN
    RAISE NOTICE '✅ No corrections flag created successfully';
  ELSE
    RAISE NOTICE '❌ No corrections flag NOT created';
  END IF;
END $$;

-- ============================================================
-- TEST 5: No Test Run Flag (MEDIUM severity)
-- ============================================================
DO $$
DECLARE
  test_attempt_id uuid;
  test_question_id uuid;
BEGIN
  SELECT id INTO test_attempt_id FROM attempts WHERE status = 'in_progress' LIMIT 1;
  SELECT id INTO test_question_id FROM question_bank WHERE type = 'debugging' LIMIT 1;
  
  IF test_attempt_id IS NULL OR test_question_id IS NULL THEN
    RETURN;
  END IF;

  RAISE NOTICE 'TEST 5: Testing no test run flag (0 runs)...';
  
  -- Insert response with no test runs
  INSERT INTO responses (attempt_id, question_id, submitted_code, behavioral_meta)
  VALUES (
    test_attempt_id,
    test_question_id,
    'print("no test")',
    jsonb_build_object(
      'paste_events', 0,
      'time_to_first_keystroke', 5000,
      'backspace_count', 5,
      'edit_count', 3,
      'wpm_consistency', 50,
      'test_runs_before_submit', 0,  -- 0 runs
      'idle_periods', '[]'::jsonb
    )
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE
  SET behavioral_meta = EXCLUDED.behavioral_meta;
  
  -- Check if flag was created
  IF EXISTS (
    SELECT 1 FROM behavioral_flags
    WHERE attempt_id = test_attempt_id
    AND question_id = test_question_id
    AND type = 'no_test_run'
  ) THEN
    RAISE NOTICE '✅ No test run flag created successfully';
  ELSE
    RAISE NOTICE '❌ No test run flag NOT created';
  END IF;
END $$;

-- ============================================================
-- TEST 6: Long Idle Period Flag (MEDIUM severity)
-- ============================================================
DO $$
DECLARE
  test_attempt_id uuid;
  test_question_id uuid;
BEGIN
  SELECT id INTO test_attempt_id FROM attempts WHERE status = 'in_progress' LIMIT 1;
  SELECT id INTO test_question_id FROM question_bank WHERE type = 'debugging' LIMIT 1;
  
  IF test_attempt_id IS NULL OR test_question_id IS NULL THEN
    RETURN;
  END IF;

  RAISE NOTICE 'TEST 6: Testing long idle period flag (>180s)...';
  
  -- Insert response with long idle period
  INSERT INTO responses (attempt_id, question_id, submitted_code, behavioral_meta)
  VALUES (
    test_attempt_id,
    test_question_id,
    'print("idle")',
    jsonb_build_object(
      'paste_events', 0,
      'time_to_first_keystroke', 5000,
      'backspace_count', 5,
      'edit_count', 3,
      'wpm_consistency', 50,
      'test_runs_before_submit', 2,
      'idle_periods', jsonb_build_array(
        jsonb_build_object('start', now()::text, 'duration_seconds', 200)
      )
    )
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE
  SET behavioral_meta = EXCLUDED.behavioral_meta;
  
  -- Check if flag was created
  IF EXISTS (
    SELECT 1 FROM behavioral_flags
    WHERE attempt_id = test_attempt_id
    AND question_id = test_question_id
    AND type = 'long_idle'
  ) THEN
    RAISE NOTICE '✅ Long idle flag created successfully';
  ELSE
    RAISE NOTICE '❌ Long idle flag NOT created';
  END IF;
END $$;

-- ============================================================
-- SUMMARY: Show all flags created
-- ============================================================
SELECT 
  bf.type,
  bf.label,
  bf.severity,
  COUNT(*) as count
FROM behavioral_flags bf
WHERE bf.question_id IS NOT NULL  -- Question-level flags only
GROUP BY bf.type, bf.label, bf.severity
ORDER BY bf.severity DESC, bf.type;

RAISE NOTICE '============================================================';
RAISE NOTICE 'Test complete! Check the results above.';
RAISE NOTICE '============================================================';
