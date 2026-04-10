-- ============================================================
-- TestForge — Supabase SQL Schema
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS guards
-- ============================================================

-- ── ENUMS ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE test_status AS ENUM ('draft', 'active', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE question_type AS ENUM ('mcq_single', 'mcq_multi', 'debugging');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE code_language AS ENUM ('python', 'cpp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attempt_status AS ENUM ('in_progress', 'submitted', 'auto_submitted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE variant_source AS ENUM ('gemini', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE verdict_type AS ENUM ('dismissed', 'confirmed', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE file_type AS ENUM ('json', 'csv');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── TABLES ───────────────────────────────────────────────────

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text UNIQUE NOT NULL,
  role       user_role NOT NULL,
  year       text,
  division   text,
  subject    text,
  created_at timestamp DEFAULT now()
);

-- 2. tests
CREATE TABLE IF NOT EXISTS tests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  subject               text,
  year                  text,
  division              text,
  duration_mins         int NOT NULL,
  start_time            timestamp,
  end_time              timestamp,
  status                test_status NOT NULL DEFAULT 'draft',
  total_marks           decimal,
  pool_size             int,
  questions_per_attempt int,
  randomize_questions   boolean DEFAULT true,
  created_at            timestamp DEFAULT now()
);

-- 3. question_bank
CREATE TABLE IF NOT EXISTS question_bank (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                question_type NOT NULL,
  statement           text NOT NULL,
  statement_image_url text,
  topic_tag           text,
  difficulty          difficulty_level,
  marks               decimal NOT NULL DEFAULT 1,
  language            code_language,
  correct_code        text,
  bug_count           int,
  created_at          timestamp DEFAULT now()
);

-- 4. test_questions
CREATE TABLE IF NOT EXISTS test_questions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id           uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question_id       uuid NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  unlock_at_minutes int NOT NULL DEFAULT 0,
  question_order    int NOT NULL
);

-- 5. mcq_options
CREATE TABLE IF NOT EXISTS mcq_options (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      uuid NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  option_text      text,
  option_image_url text,
  is_correct       boolean NOT NULL DEFAULT false,
  display_order    int NOT NULL
);

-- 6. debug_variants
CREATE TABLE IF NOT EXISTS debug_variants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  uuid NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  generated_by variant_source NOT NULL,
  buggy_code   text NOT NULL,
  diff_json    jsonb,
  bug_count    int,
  difficulty   difficulty_level,
  language     code_language,
  is_approved  boolean NOT NULL DEFAULT false,
  approved_at  timestamp
);

-- 7. test_cases
CREATE TABLE IF NOT EXISTS test_cases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     uuid NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  input           text,
  expected_output text NOT NULL,
  is_hidden       boolean NOT NULL DEFAULT false
);

-- 8. attempts
CREATE TABLE IF NOT EXISTS attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_id          uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  status           attempt_status NOT NULL DEFAULT 'in_progress',
  started_at       timestamp NOT NULL DEFAULT now(),
  submitted_at     timestamp,
  ip_address       text,
  session_token    text,
  last_active_at   timestamp,
  tab_switches     int NOT NULL DEFAULT 0,
  focus_lost_count int NOT NULL DEFAULT 0
);

-- 9. variant_assignments
CREATE TABLE IF NOT EXISTS variant_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id  uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  variant_id  uuid NOT NULL REFERENCES debug_variants(id) ON DELETE CASCADE,
  assigned_at timestamp NOT NULL DEFAULT now()
);

-- 10. option_shuffle
CREATE TABLE IF NOT EXISTS option_shuffle (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id     uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id    uuid NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  shuffled_order jsonb NOT NULL
);

-- 11. responses
-- behavioral_meta shape:
--   { time_to_first_keystroke: int, wpm_consistency: float, backspace_count: int,
--     edit_count: int, test_runs_before_submit: int, paste_events: int,
--     idle_periods: [{ start: timestamp, duration_seconds: int }] }
CREATE TABLE IF NOT EXISTS responses (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id           uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id          uuid NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  selected_option_ids  uuid[],
  is_correct           boolean,
  marks_awarded        decimal,
  submitted_code       text,
  language             code_language,
  visible_cases_passed int,
  visible_cases_total  int,
  hidden_cases_passed  int,
  hidden_cases_total   int,
  behavioral_meta      jsonb,
  time_spent_seconds   int
);

-- 12. results
CREATE TABLE IF NOT EXISTS results (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id        uuid NOT NULL UNIQUE REFERENCES attempts(id) ON DELETE CASCADE,
  total_score       decimal,
  total_marks       decimal,
  percentage        decimal,
  rank              int,
  integrity_score   int,
  pass_fail_overall boolean,
  computed_at       timestamp NOT NULL DEFAULT now()
);

-- 13. similarity_flags
CREATE TABLE IF NOT EXISTS similarity_flags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id          uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  attempt_id_1     uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  attempt_id_2     uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id      uuid NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  similarity_score decimal NOT NULL,
  flagged_at       timestamp NOT NULL DEFAULT now(),
  reviewed         boolean NOT NULL DEFAULT false,
  admin_verdict    verdict_type NOT NULL DEFAULT 'pending'
);

-- 14. question_import_logs
CREATE TABLE IF NOT EXISTS question_import_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_type     file_type NOT NULL,
  total_rows    int NOT NULL,
  success_count int NOT NULL,
  error_rows    jsonb,
  imported_at   timestamp NOT NULL DEFAULT now()
);

-- ── INDEXES ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_attempts_test_user      ON attempts (test_id, user_id);
CREATE INDEX IF NOT EXISTS idx_responses_attempt       ON responses (attempt_id);
CREATE INDEX IF NOT EXISTS idx_test_questions_test     ON test_questions (test_id);
CREATE INDEX IF NOT EXISTS idx_debug_variants_question ON debug_variants (question_id);

-- ── VIEWS ────────────────────────────────────────────────────

CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.name,
  u.year,
  u.division,
  r.total_score,
  r.percentage,
  RANK() OVER (
    PARTITION BY a.test_id
    ORDER BY r.total_score DESC
  ) AS rank,
  r.integrity_score,
  a.test_id
FROM results r
JOIN attempts a ON a.id = r.attempt_id
JOIN users u    ON u.id = a.user_id;

CREATE OR REPLACE VIEW test_analytics AS
SELECT
  a.test_id,
  COUNT(DISTINCT a.id)                                                     AS total_attempts,
  ROUND(AVG(r.total_score), 2)                                             AS avg_score,
  ROUND(AVG(r.percentage), 2)                                              AS avg_percentage,
  ROUND(AVG(EXTRACT(EPOCH FROM (a.submitted_at - a.started_at)) / 60), 2) AS avg_time_mins,
  COUNT(CASE WHEN a.status IN ('submitted', 'auto_submitted') THEN 1 END)
    * 100.0 / NULLIF(COUNT(*), 0)                                          AS completion_rate
FROM attempts a
JOIN results r ON r.attempt_id = a.id
GROUP BY a.test_id;

CREATE OR REPLACE VIEW question_difficulty_actual AS
SELECT
  resp.question_id,
  COUNT(*)                                                                  AS total_attempts,
  SUM(CASE WHEN resp.is_correct THEN 1 ELSE 0 END)                         AS correct_count,
  ROUND(SUM(CASE WHEN resp.is_correct THEN 1 ELSE 0 END) * 100.0
    / NULLIF(COUNT(*), 0), 2)                                               AS correct_rate
FROM responses resp
GROUP BY resp.question_id;

-- ── TRIGGER — Integrity Score ─────────────────────────────────

CREATE OR REPLACE FUNCTION compute_integrity_score()
RETURNS TRIGGER AS $$
DECLARE
  v_tab_switches    int;
  v_focus_lost      int;
  v_score           int := 100;
  v_similarity_flag boolean;
BEGIN
  SELECT tab_switches, focus_lost_count
  INTO   v_tab_switches, v_focus_lost
  FROM   attempts
  WHERE  id = NEW.attempt_id;

  SELECT EXISTS (
    SELECT 1
    FROM   similarity_flags
    WHERE  (attempt_id_1 = NEW.attempt_id OR attempt_id_2 = NEW.attempt_id)
      AND  admin_verdict <> 'dismissed'
  ) INTO v_similarity_flag;

  v_score := v_score - (COALESCE(v_tab_switches, 0) * 5);
  v_score := v_score - (COALESCE(v_focus_lost,   0) * 2);

  IF v_similarity_flag THEN
    v_score := v_score - 15;
  END IF;

  NEW.integrity_score := GREATEST(v_score, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_integrity_score ON results;
CREATE TRIGGER trg_integrity_score
BEFORE INSERT ON results
FOR EACH ROW
EXECUTE FUNCTION compute_integrity_score();

-- ── ROW LEVEL SECURITY ───────────────────────────────────────

ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests                ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank        ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_questions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcq_options          ENABLE ROW LEVEL SECURITY;
ALTER TABLE debug_variants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_shuffle       ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE results              ENABLE ROW LEVEL SECURITY;
ALTER TABLE similarity_flags     ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_import_logs ENABLE ROW LEVEL SECURITY;
