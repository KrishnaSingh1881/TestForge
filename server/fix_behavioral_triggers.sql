-- ============================================================
-- Fix for Behavioral Flags Trigger
-- This fixes the issue where flags aren't being generated properly
-- ============================================================

-- ── Enhanced Trigger Function with Logging ───
CREATE OR REPLACE FUNCTION auto_generate_behavioral_flags()
RETURNS TRIGGER AS $$
DECLARE
  v_tab_switches    int;
  v_focus_lost      int;
  v_meta            jsonb;
  v_paste_events    int;
  v_ttfk            int;
  v_backspace       int;
  v_wpm             int;
  v_test_runs       int;
  v_idle_periods    jsonb;
  v_flags_created   int := 0;
BEGIN
  -- Get attempt-level metrics
  SELECT tab_switches, focus_lost_count
  INTO v_tab_switches, v_focus_lost
  FROM attempts
  WHERE id = NEW.attempt_id;

  v_meta := NEW.behavioral_meta;
  IF v_meta IS NULL THEN
    RAISE NOTICE 'No behavioral_meta provided for question % in attempt %', NEW.question_id, NEW.attempt_id;
    RETURN NEW;
  END IF;

  -- Extract behavioral metrics
  v_paste_events := COALESCE((v_meta->>'paste_events')::int, 0);
  v_ttfk         := COALESCE((v_meta->>'time_to_first_keystroke')::int, 999999);
  v_backspace    := COALESCE((v_meta->>'backspace_count')::int, 999);
  v_wpm          := COALESCE((v_meta->>'wpm_consistency')::int, 0);
  v_test_runs    := COALESCE((v_meta->>'test_runs_before_submit')::int, 1);
  v_idle_periods := COALESCE(v_meta->'idle_periods', '[]'::jsonb);

  RAISE NOTICE 'Processing behavioral flags for Q% in A%: paste=%, ttfk=%ms, backspace=%, wpm=%, runs=%',
    NEW.question_id, NEW.attempt_id, v_paste_events, v_ttfk, v_backspace, v_wpm, v_test_runs;

  -- Clear existing flags for this question
  DELETE FROM behavioral_flags
  WHERE attempt_id = NEW.attempt_id
  AND question_id = NEW.question_id;

  -- Generate flags based on thresholds
  
  -- HIGH SEVERITY FLAGS
  IF v_paste_events >= 1 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.attempt_id, NEW.question_id, 'paste', 
            'Paste event detected (' || v_paste_events || '×)', 'high');
    v_flags_created := v_flags_created + 1;
    RAISE NOTICE '  ✓ Created PASTE flag (high)';
  END IF;

  IF v_ttfk < 3000 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.attempt_id, NEW.question_id, 'fast_start',
            'Typed within 3s of opening question', 'high');
    v_flags_created := v_flags_created + 1;
    RAISE NOTICE '  ✓ Created FAST_START flag (high)';
  END IF;

  IF v_backspace <= 2 AND v_wpm > 100 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.attempt_id, NEW.question_id, 'no_corrections',
            'No corrections at high WPM — likely pre-typed', 'high');
    v_flags_created := v_flags_created + 1;
    RAISE NOTICE '  ✓ Created NO_CORRECTIONS flag (high)';
  END IF;

  -- MEDIUM SEVERITY FLAGS
  IF v_wpm > 120 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.attempt_id, NEW.question_id, 'high_wpm',
            'Extreme typing speed (' || v_wpm || ' WPM)', 'medium');
    v_flags_created := v_flags_created + 1;
    RAISE NOTICE '  ✓ Created HIGH_WPM flag (medium)';
  END IF;

  IF v_test_runs = 0 AND NEW.submitted_code IS NOT NULL THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.attempt_id, NEW.question_id, 'no_test_run',
            'Submitted without running visible test cases', 'medium');
    v_flags_created := v_flags_created + 1;
    RAISE NOTICE '  ✓ Created NO_TEST_RUN flag (medium)';
  END IF;

  -- Check for long idle periods (>180 seconds)
  IF jsonb_array_length(v_idle_periods) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_idle_periods) AS period
      WHERE (period->>'duration_seconds')::int > 180
    ) THEN
      INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
      VALUES (NEW.attempt_id, NEW.question_id, 'long_idle',
              'Unusually long idle period detected (>3 min)', 'medium');
      v_flags_created := v_flags_created + 1;
      RAISE NOTICE '  ✓ Created LONG_IDLE flag (medium)';
    END IF;
  END IF;

  RAISE NOTICE 'Total flags created: %', v_flags_created;

  -- Upsert behavioral_details
  INSERT INTO behavioral_details (
    attempt_id, question_id, time_to_first_keystroke, paste_events,
    backspace_count, edit_count, wpm_consistency, test_runs_before_submit, idle_periods
  ) VALUES (
    NEW.attempt_id, NEW.question_id, v_ttfk, v_paste_events,
    v_backspace, COALESCE((v_meta->>'edit_count')::int, 0),
    v_wpm, v_test_runs, v_idle_periods
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET
    time_to_first_keystroke = EXCLUDED.time_to_first_keystroke,
    paste_events            = EXCLUDED.paste_events,
    backspace_count         = EXCLUDED.backspace_count,
    edit_count              = EXCLUDED.edit_count,
    wpm_consistency         = EXCLUDED.wpm_consistency,
    test_runs_before_submit = EXCLUDED.test_runs_before_submit,
    idle_periods            = EXCLUDED.idle_periods;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_behavioral_flags ON responses;
CREATE TRIGGER trg_auto_behavioral_flags
AFTER INSERT OR UPDATE OF behavioral_meta ON responses
FOR EACH ROW
WHEN (NEW.behavioral_meta IS NOT NULL)
EXECUTE FUNCTION auto_generate_behavioral_flags();

-- ── Updated Trigger Function: Generate attempt-level flags ───
CREATE OR REPLACE FUNCTION auto_generate_attempt_level_flags()
RETURNS TRIGGER AS $$
BEGIN
  -- Clear existing attempt-level flags for tab_switch and focus_loss types only
  DELETE FROM behavioral_flags
  WHERE attempt_id = NEW.id
  AND question_id IS NULL
  AND type IN ('tab_switch', 'focus_loss');

  -- Tab switch flags (max 3 allowed, -30 points each)
  IF NEW.tab_switches >= 3 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'tab_switch',
            'Critical: Tab switch limit reached (' || NEW.tab_switches || '×) — Auto-submit triggered', 'high');
  ELSIF NEW.tab_switches >= 2 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'tab_switch',
            'Warning: ' || NEW.tab_switches || ' tab switches detected — One more will auto-submit', 'high');
  ELSIF NEW.tab_switches >= 1 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'tab_switch',
            'Tab switch detected (' || NEW.tab_switches || '×) — Integrity penalty applied', 'medium');
  END IF;

  -- Focus loss flags
  IF NEW.focus_lost_count >= 5 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'focus_loss',
            'Window focus lost ' || NEW.focus_lost_count || ' times', 'medium');
  ELSIF NEW.focus_lost_count >= 3 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'focus_loss',
            'Window focus lost ' || NEW.focus_lost_count || ' times', 'low');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Recreate Trigger (fires on ANY update to attempts table) ───
DROP TRIGGER IF EXISTS trg_attempt_level_flags ON attempts;
CREATE TRIGGER trg_attempt_level_flags
AFTER UPDATE ON attempts
FOR EACH ROW
WHEN (NEW.tab_switches > 0 OR NEW.focus_lost_count > 0)
EXECUTE FUNCTION auto_generate_attempt_level_flags();

-- ── Manual flag generation for existing attempts (run once) ───
-- This will generate flags for any existing attempts that have tab_switches or focus_lost_count
DO $$
DECLARE
  attempt_record RECORD;
BEGIN
  FOR attempt_record IN 
    SELECT id, tab_switches, focus_lost_count 
    FROM attempts 
    WHERE (tab_switches > 0 OR focus_lost_count > 0)
    AND status = 'in_progress'
  LOOP
    -- Clear existing flags
    DELETE FROM behavioral_flags
    WHERE attempt_id = attempt_record.id
    AND question_id IS NULL
    AND type IN ('tab_switch', 'focus_loss');

    -- Generate tab switch flags
    IF attempt_record.tab_switches >= 3 THEN
      INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
      VALUES (attempt_record.id, NULL, 'tab_switch',
              'Critical: Tab switch limit reached (' || attempt_record.tab_switches || '×) — Auto-submit triggered', 'high');
    ELSIF attempt_record.tab_switches >= 2 THEN
      INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
      VALUES (attempt_record.id, NULL, 'tab_switch',
              'Warning: ' || attempt_record.tab_switches || ' tab switches detected — One more will auto-submit', 'high');
    ELSIF attempt_record.tab_switches >= 1 THEN
      INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
      VALUES (attempt_record.id, NULL, 'tab_switch',
              'Tab switch detected (' || attempt_record.tab_switches || '×) — Integrity penalty applied', 'medium');
    END IF;

    -- Generate focus loss flags
    IF attempt_record.focus_lost_count >= 5 THEN
      INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
      VALUES (attempt_record.id, NULL, 'focus_loss',
              'Window focus lost ' || attempt_record.focus_lost_count || ' times', 'medium');
    ELSIF attempt_record.focus_lost_count >= 3 THEN
      INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
      VALUES (attempt_record.id, NULL, 'focus_loss',
              'Window focus lost ' || attempt_record.focus_lost_count || ' times', 'low');
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Behavioral flags regenerated for existing attempts';
END $$;
