import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All routes require auth — role split happens per-route
router.use(requireAuth);

// ── GET /api/tests — admin: list own tests ────────────────────
router.get('/', requireAdmin, async (req, res) => {
  const { data: tests, error } = await supabase
    .from('tests')
    .select('id, title, subject, year, division, status, duration_mins, start_time, end_time, total_marks, questions_per_attempt, created_at')
    .eq('created_by', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ tests });
});

// ── GET /api/tests/available — student: active tests for their year/division ──
router.get('/available', async (req, res) => {
  const { year, division, id: userId } = req.user;

  if (!year || !division) {
    return res.status(400).json({ error: 'Student profile missing year or division' });
  }

  const now = new Date().toISOString();

  // Fetch active tests matching student's year + division within time window
  const { data: tests, error: testsErr } = await supabase
    .from('tests')
    .select('id, title, subject, year, division, duration_mins, start_time, end_time, questions_per_attempt, total_marks, status')
    .eq('status', 'active')
    .eq('year', year)
    .eq('division', division)
    .lte('start_time', now)
    .gte('end_time', now);

  if (testsErr) return res.status(500).json({ error: testsErr.message });

  // For each test, check if student already has an attempt
  const testIds = tests.map(t => t.id);
  let attemptMap = {};

  if (testIds.length > 0) {
    const { data: attempts } = await supabase
      .from('attempts')
      .select('id, test_id, status, submitted_at')
      .eq('user_id', userId)
      .in('test_id', testIds);

    (attempts ?? []).forEach(a => { attemptMap[a.test_id] = a; });
  }

  const enriched = tests.map(t => ({
    ...t,
    attempt: attemptMap[t.id] ?? null,
  }));

  return res.json({ tests: enriched });
});

export default router;
