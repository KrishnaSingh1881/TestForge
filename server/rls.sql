-- ============================================================
-- TestForge — Row Level Security Policies
-- Run AFTER schema.sql. Safe to re-run.
-- ============================================================

-- ── HELPER FUNCTIONS ─────────────────────────────────────────

-- Explicitly references public.users to avoid schema resolution issues
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_year_division()
RETURNS TABLE(year text, division text) AS $$
  SELECT year, division FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── DROP EXISTING POLICIES (idempotent re-run) ────────────────

DO $$ DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── users ─────────────────────────────────────────────────────

CREATE POLICY "students_read_own_profile"
ON public.users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "admins_read_all_users"
ON public.users FOR SELECT
USING (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "users_update_own_profile"
ON public.users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT role FROM public.users WHERE id = auth.uid())
);

CREATE POLICY "super_admin_insert_users"
ON public.users FOR INSERT
WITH CHECK (public.get_user_role() = 'super_admin');

-- ── tests ─────────────────────────────────────────────────────

CREATE POLICY "students_read_active_tests"
ON public.tests FOR SELECT
USING (
  public.get_user_role() = 'student'
  AND status = 'active'
  AND year     = (SELECT u.year     FROM public.users u WHERE u.id = auth.uid())
  AND division = (SELECT u.division FROM public.users u WHERE u.id = auth.uid())
  AND start_time <= now()
  AND end_time   >= now()
);

CREATE POLICY "admins_read_own_tests"
ON public.tests FOR SELECT
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND (created_by = auth.uid() OR public.get_user_role() = 'super_admin')
);

CREATE POLICY "admins_create_tests"
ON public.tests FOR INSERT
WITH CHECK (
  public.get_user_role() IN ('admin', 'super_admin')
  AND created_by = auth.uid()
);

CREATE POLICY "admins_update_own_tests"
ON public.tests FOR UPDATE
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND created_by = auth.uid()
);

CREATE POLICY "admins_delete_own_draft_tests"
ON public.tests FOR DELETE
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND created_by = auth.uid()
  AND status = 'draft'
);

-- ── question_bank ─────────────────────────────────────────────

CREATE POLICY "students_read_attempted_questions"
ON public.question_bank FOR SELECT
USING (
  public.get_user_role() = 'student'
  AND id IN (
    SELECT tq.question_id
    FROM   public.test_questions tq
    JOIN   public.attempts a ON a.test_id = tq.test_id
    WHERE  a.user_id = auth.uid()
      AND  a.status  = 'in_progress'
  )
);

CREATE POLICY "admins_read_own_questions"
ON public.question_bank FOR SELECT
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND (created_by = auth.uid() OR public.get_user_role() = 'super_admin')
);

CREATE POLICY "admins_create_questions"
ON public.question_bank FOR INSERT
WITH CHECK (
  public.get_user_role() IN ('admin', 'super_admin')
  AND created_by = auth.uid()
);

CREATE POLICY "admins_update_own_questions"
ON public.question_bank FOR UPDATE
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND created_by = auth.uid()
);

CREATE POLICY "admins_delete_own_questions"
ON public.question_bank FOR DELETE
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND created_by = auth.uid()
);

-- ── test_questions ────────────────────────────────────────────

CREATE POLICY "students_read_test_questions"
ON public.test_questions FOR SELECT
USING (
  public.get_user_role() = 'student'
  AND test_id IN (
    SELECT test_id FROM public.attempts
    WHERE  user_id = auth.uid()
      AND  status  = 'in_progress'
  )
);

CREATE POLICY "admins_manage_test_questions"
ON public.test_questions FOR ALL
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND test_id IN (
    SELECT id FROM public.tests WHERE created_by = auth.uid()
  )
);

-- ── mcq_options ───────────────────────────────────────────────
-- is_correct must be stripped at the API layer during active attempts

CREATE POLICY "students_read_options_for_active_attempts"
ON public.mcq_options FOR SELECT
USING (
  public.get_user_role() = 'student'
  AND question_id IN (
    SELECT tq.question_id
    FROM   public.test_questions tq
    JOIN   public.attempts a ON a.test_id = tq.test_id
    WHERE  a.user_id = auth.uid()
      AND  a.status  = 'in_progress'
  )
);

CREATE POLICY "admins_manage_own_options"
ON public.mcq_options FOR ALL
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND question_id IN (
    SELECT id FROM public.question_bank WHERE created_by = auth.uid()
  )
);

-- ── debug_variants ────────────────────────────────────────────
-- Students see ONLY their assigned variant. diff_json stripped at API layer.

CREATE POLICY "students_read_assigned_variant_only"
ON public.debug_variants FOR SELECT
USING (
  public.get_user_role() = 'student'
  AND id IN (
    SELECT va.variant_id
    FROM   public.variant_assignments va
    JOIN   public.attempts a ON a.id = va.attempt_id
    WHERE  a.user_id = auth.uid()
      AND  a.status  = 'in_progress'
  )
);

CREATE POLICY "admins_manage_own_variants"
ON public.debug_variants FOR ALL
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND question_id IN (
    SELECT id FROM public.question_bank WHERE created_by = auth.uid()
  )
);

-- ── test_cases ────────────────────────────────────────────────
-- Hidden honeypot cases are NEVER accessible to students — enforced at RLS level.

CREATE POLICY "students_read_visible_test_cases_only"
ON public.test_cases FOR SELECT
USING (
  public.get_user_role() = 'student'
  AND is_hidden = false
  AND question_id IN (
    SELECT tq.question_id
    FROM   public.test_questions tq
    JOIN   public.attempts a ON a.test_id = tq.test_id
    WHERE  a.user_id = auth.uid()
      AND  a.status  = 'in_progress'
  )
);

CREATE POLICY "admins_manage_own_test_cases"
ON public.test_cases FOR ALL
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND question_id IN (
    SELECT id FROM public.question_bank WHERE created_by = auth.uid()
  )
);

-- ── attempts ──────────────────────────────────────────────────

CREATE POLICY "students_read_own_attempts"
ON public.attempts FOR SELECT
USING (
  public.get_user_role() = 'student'
  AND user_id = auth.uid()
);

CREATE POLICY "students_create_own_attempts"
ON public.attempts FOR INSERT
WITH CHECK (
  public.get_user_role() = 'student'
  AND user_id = auth.uid()
);

CREATE POLICY "students_update_own_inprogress_attempts"
ON public.attempts FOR UPDATE
USING (
  public.get_user_role() = 'student'
  AND user_id = auth.uid()
  AND status  = 'in_progress'
);

CREATE POLICY "admins_read_attempts_for_own_tests"
ON public.attempts FOR SELECT
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND test_id IN (
    SELECT id FROM public.tests WHERE created_by = auth.uid()
  )
);

-- ── variant_assignments ───────────────────────────────────────
-- Inserts via Express service_role only.

CREATE POLICY "students_read_own_variant_assignments"
ON public.variant_assignments FOR SELECT
USING (
  public.get_user_role() = 'student'
  AND attempt_id IN (
    SELECT id FROM public.attempts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "admins_read_variant_assignments"
ON public.variant_assignments FOR SELECT
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND attempt_id IN (
    SELECT a.id FROM public.attempts a
    JOIN   public.tests t ON t.id = a.test_id
    WHERE  t.created_by = auth.uid()
  )
);

-- ── option_shuffle ────────────────────────────────────────────
-- Inserts via Express service_role only.

CREATE POLICY "students_read_own_option_shuffle"
ON public.option_shuffle FOR SELECT
USING (
  public.get_user_role() = 'student'
  AND attempt_id IN (
    SELECT id FROM public.attempts WHERE user_id = auth.uid()
  )
);

-- ── responses ─────────────────────────────────────────────────

CREATE POLICY "students_read_own_responses"
ON public.responses FOR SELECT
USING (
  public.get_user_role() = 'student'
  AND attempt_id IN (
    SELECT id FROM public.attempts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "students_insert_own_responses"
ON public.responses FOR INSERT
WITH CHECK (
  public.get_user_role() = 'student'
  AND attempt_id IN (
    SELECT id FROM public.attempts
    WHERE  user_id = auth.uid()
      AND  status  = 'in_progress'
  )
);

CREATE POLICY "students_update_own_responses"
ON public.responses FOR UPDATE
USING (
  public.get_user_role() = 'student'
  AND attempt_id IN (
    SELECT id FROM public.attempts
    WHERE  user_id = auth.uid()
      AND  status  = 'in_progress'
  )
);

CREATE POLICY "admins_read_responses_for_own_tests"
ON public.responses FOR SELECT
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND attempt_id IN (
    SELECT a.id FROM public.attempts a
    JOIN   public.tests t ON t.id = a.test_id
    WHERE  t.created_by = auth.uid()
  )
);

-- ── results ───────────────────────────────────────────────────
-- No INSERT/UPDATE policy for students or admins — prevents score tampering.
-- All writes via Express service_role only.

CREATE POLICY "students_read_own_results"
ON public.results FOR SELECT
USING (
  public.get_user_role() = 'student'
  AND attempt_id IN (
    SELECT id FROM public.attempts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "admins_read_results_for_own_tests"
ON public.results FOR SELECT
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND attempt_id IN (
    SELECT a.id FROM public.attempts a
    JOIN   public.tests t ON t.id = a.test_id
    WHERE  t.created_by = auth.uid()
  )
);

-- ── similarity_flags ──────────────────────────────────────────
-- Students have zero access. Inserts via service_role similarity job.

CREATE POLICY "admins_read_own_similarity_flags"
ON public.similarity_flags FOR SELECT
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND test_id IN (
    SELECT id FROM public.tests WHERE created_by = auth.uid()
  )
);

CREATE POLICY "admins_update_own_similarity_flags"
ON public.similarity_flags FOR UPDATE
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND test_id IN (
    SELECT id FROM public.tests WHERE created_by = auth.uid()
  )
);

-- ── question_import_logs ──────────────────────────────────────
-- Inserts via Express import processor using service_role only.

CREATE POLICY "admins_read_own_import_logs"
ON public.question_import_logs FOR SELECT
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND imported_by = auth.uid()
);

-- ── STORAGE: question-images bucket ──────────────────────────
-- Create bucket first: Storage → New Bucket → "question-images" → Private

CREATE POLICY "admins_upload_question_images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'question-images'
  AND public.get_user_role() IN ('admin', 'super_admin')
);

CREATE POLICY "authenticated_read_question_images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'question-images'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "admins_delete_question_images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'question-images'
  AND public.get_user_role() IN ('admin', 'super_admin')
);
