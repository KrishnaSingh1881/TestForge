-- ============================================================
-- TestForge — Behavioral Tracking Tables Migration
-- Creates behavioral_flags and behavioral_details tables
-- ============================================================

-- ── behavioral_flags table ───────────────────────────────────
-- Stores individual integrity flags raised during test attempts
CREATE TABLE IF NOT EXISTS behavioral_flags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id   uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id  uuid REFERENCES question_bank(id) ON DELETE CASCADE,
  type         text NOT NULL,  -- 'paste', 'fast_start', 'no_corrections', 'high_wpm', 'data_mismatch', 'tab_switch', 'focus_loss', 'long_idle', 'no_test_run'
  label        text NOT NULL,  -- Human-readable description
  severity     text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  flagged_at   timestamp NOT NULL DEFAULT now(),
  created_at   timestamp DEFAULT now()
);

-- ── behavioral_details table ─────────────────────────────────
-- Stores detailed behavioral metrics per question per attempt
CREATE TABLE IF NOT EXISTS behavioral_details (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id               uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id              uuid NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  time_to_first_keystroke  int,   -- milliseconds
  paste_events             int DEFAULT 0,
  backspace_count          int DEFAULT 0,
  edit_count               int DEFAULT 0,
  wpm_consistency          int DEFAULT 0,  -- average WPM
  test_runs_before_submit  int DEFAULT 0,
  idle_periods             jsonb DEFAULT '[]'::jsonb,  -- [{ start: timestamp, duration_seconds: int }]
  created_at               timestamp DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_behavioral_flags_attempt   ON behavioral_flags (attempt_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_flags_severity  ON behavioral_flags (severity);
CREATE INDEX IF NOT EXISTS idx_behavioral_details_attempt ON behavioral_details (attempt_id);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE behavioral_flags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_details ENABLE ROW LEVEL SECURITY;

-- Admin can see all
DROP POLICY IF EXISTS admin_all_behavioral_flags ON behavioral_flags;
CREATE POLICY admin_all_behavioral_flags ON behavioral_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'master_admin')
    )
  );

DROP POLICY IF EXISTS admin_all_behavioral_details ON behavioral_details;
CREATE POLICY admin_all_behavioral_details ON behavioral_details
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'master_admin')
    )
  );

-- Students can only see their own
DROP POLICY IF EXISTS student_own_behavioral_flags ON behavioral_flags;
CREATE POLICY student_own_behavioral_flags ON behavioral_flags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM attempts
      WHERE attempts.id = behavioral_flags.attempt_id
      AND attempts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS student_own_behavioral_details ON behavioral_details;
CREATE POLICY student_own_behavioral_details ON behavioral_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM attempts
      WHERE attempts.id = behavioral_details.attempt_id
      AND attempts.user_id = auth.uid()
    )
  );

-- ── Trigger: Auto-generate behavioral flags on response insert/update ────
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
BEGIN
  -- Get attempt-level metrics
  SELECT tab_switches, focus_lost_count
  INTO v_tab_switches, v_focus_lost
  FROM attempts
  WHERE id = NEW.attempt_id;

  v_meta := NEW.behavioral_meta;
  IF v_meta IS NULL THEN
    RETURN NEW;
  END IF;

  -- Extract behavioral metrics
  v_paste_events := COALESCE((v_meta->>'paste_events')::int, 0);
  v_ttfk         := COALESCE((v_meta->>'time_to_first_keystroke')::int, 999999);
  v_backspace    := COALESCE((v_meta->>'backspace_count')::int, 999);
  v_wpm          := COALESCE((v_meta->>'wpm_consistency')::int, 0);
  v_test_runs    := COALESCE((v_meta->>'test_runs_before_submit')::int, 1);
  v_idle_periods := COALESCE(v_meta->'idle_periods', '[]'::jsonb);

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
  END IF;

  IF v_ttfk < 3000 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.attempt_id, NEW.question_id, 'fast_start',
            'Typed within 3s of opening question', 'high');
  END IF;

  IF v_backspace <= 2 AND v_wpm > 100 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.attempt_id, NEW.question_id, 'no_corrections',
            'No corrections at high WPM — likely pre-typed', 'high');
  END IF;

  -- MEDIUM SEVERITY FLAGS
  IF v_wpm > 120 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.attempt_id, NEW.question_id, 'high_wpm',
            'Extreme typing speed (' || v_wpm || ' WPM)', 'medium');
  END IF;

  IF v_test_runs = 0 AND NEW.submitted_code IS NOT NULL THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.attempt_id, NEW.question_id, 'no_test_run',
            'Submitted without running visible test cases', 'medium');
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
    END IF;
  END IF;

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

-- ── Trigger: Generate attempt-level flags (tab switches, focus loss) ─────
CREATE OR REPLACE FUNCTION auto_generate_attempt_level_flags()
RETURNS TRIGGER AS $$
BEGIN
  -- Clear existing attempt-level flags
  DELETE FROM behavioral_flags
  WHERE attempt_id = NEW.id
  AND question_id IS NULL;

  -- Tab switch flags (max 3 allowed)
  IF NEW.tab_switches >= 3 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'tab_switch',
            'Critical: Tab switch limit reached (' || NEW.tab_switches || '×)', 'high');
  ELSIF NEW.tab_switches >= 2 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'tab_switch',
            'Warning: Tab switches detected (' || NEW.tab_switches || '×)', 'medium');
  ELSIF NEW.tab_switches >= 1 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'tab_switch',
            'Tab switch detected (' || NEW.tab_switches || '×)', 'medium');
  END IF;

  -- Focus loss flags
  IF NEW.focus_lost_count >= 5 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'focus_loss',
            'Window focus lost ' || NEW.focus_lost_count || ' times', 'medium');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attempt_level_flags ON attempts;
CREATE TRIGGER trg_attempt_level_flags
AFTER UPDATE OF tab_switches, focus_lost_count ON attempts
FOR EACH ROW
WHEN (NEW.tab_switches > 0 OR NEW.focus_lost_count > 0)
EXECUTE FUNCTION auto_generate_attempt_level_flags();

-- ── Update integrity score computation to include behavioral flags ───────
CREATE OR REPLACE FUNCTION compute_integrity_score()
RETURNS TRIGGER AS $$
DECLARE
  v_tab_switches    int;
  v_focus_lost      int;
  v_score           int := 100;
  v_similarity_flag boolean;
  v_high_flags      int;
  v_med_flags       int;
BEGIN
  SELECT tab_switches, focus_lost_count
  INTO   v_tab_switches, v_focus_lost
  FROM   attempts
  WHERE  id = NEW.attempt_id;

  -- Count behavioral flags
  SELECT 
    COUNT(*) FILTER (WHERE severity = 'high'),
    COUNT(*) FILTER (WHERE severity = 'medium')
  INTO v_high_flags, v_med_flags
  FROM behavioral_flags
  WHERE attempt_id = NEW.attempt_id;

  -- Check similarity flags
  SELECT EXISTS (
    SELECT 1
    FROM   similarity_flags
    WHERE  (attempt_id_1 = NEW.attempt_id OR attempt_id_2 = NEW.attempt_id)
      AND  admin_verdict <> 'dismissed'
  ) INTO v_similarity_flag;

  -- Compute score
  v_score := v_score - (COALESCE(v_tab_switches, 0) * 30);
  v_score := v_score - (COALESCE(v_focus_lost,   0) * 2);
  v_score := v_score - (COALESCE(v_high_flags,   0) * 15);
  v_score := v_score - (COALESCE(v_med_flags,    0) * 7);

  IF v_similarity_flag THEN
    v_score := v_score - 15;
  END IF;

  NEW.integrity_score := GREATEST(v_score, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists, just replaced the function above
