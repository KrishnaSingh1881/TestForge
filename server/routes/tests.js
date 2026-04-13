import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ── GET /api/tests — admin: list own tests (master_admin: all tests) ──
router.get('/', requireAdmin, async (req, res) => {
  const isElevated = ['master_admin', 'super_admin', 'admin'].includes(req.user.role);
  let query = supabase
    .from('tests')
    .select('id, title, subject, year, division, status, duration_mins, start_time, end_time, total_marks, questions_per_attempt, created_at, created_by')
    .order('created_at', { ascending: false });

  if (!isElevated) {
    query = query.eq('created_by', req.user.id);
  }

  const { data: tests, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ tests });
});

// ── GET /api/tests/available — student: active + upcoming tests ──
router.get('/available', async (req, res) => {
  const { year, division, id: userId } = req.user;
  if (!year || !division) return res.status(400).json({ error: 'Student profile missing year or division' });

  const now = new Date().toISOString();

  // Fetch all assigned tests (active, draft, and ended)
  const { data: tests, error: testsErr } = await supabase
    .from('tests')
    .select('id, title, subject, year, division, duration_mins, start_time, end_time, questions_per_attempt, total_marks, status')
    .eq('year', year)
    .in('division', [division, 'ALL'])
    .in('status', ['active', 'ended', 'draft'])
    .order('start_time', { ascending: false });

  if (testsErr) return res.status(500).json({ error: testsErr.message });

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

  return res.json({ tests: tests.map(t => ({ ...t, attempt: attemptMap[t.id] ?? null })) });
});

// ── POST /api/tests — admin: create test ─────────────────────
router.post('/', requireAdmin, async (req, res) => {
  const { title, subject, year, division, duration_minutes, start_time, end_time, questions_per_attempt, randomize_questions } = req.body;

  if (!title || !subject || !year || !division || !start_time || !end_time) {
    return res.status(400).json({ error: 'title, subject, year, division, start_time, end_time are required' });
  }

  const { data: test, error } = await supabase
    .from('tests')
    .insert({
      created_by: req.user.id,
      title, subject, year, division,
      duration_mins: duration_minutes ?? 60,
      start_time, end_time,
      questions_per_attempt: questions_per_attempt ?? 10,
      randomize_questions: randomize_questions ?? false,
      status: 'draft',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ test });
});

// ── PATCH /api/tests/:id — admin: update test ─────────────────
router.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, subject, year, division, duration_minutes, start_time, end_time, questions_per_attempt, randomize_questions, status } = req.body;

  const { data: existing } = await supabase.from('tests').select('id, created_by').eq('id', id).single();
  if (!existing) return res.status(404).json({ error: 'Test not found' });
  // Ownership check removed for admin testing

  const updates = {};
  if (title !== undefined)                updates.title                 = title;
  if (subject !== undefined)              updates.subject               = subject;
  if (year !== undefined)                 updates.year                  = year;
  if (division !== undefined)             updates.division              = division;
  if (duration_minutes !== undefined)     updates.duration_mins         = duration_minutes;
  if (start_time !== undefined)           updates.start_time            = start_time;
  if (end_time !== undefined)             updates.end_time              = end_time;
  if (questions_per_attempt !== undefined) updates.questions_per_attempt = questions_per_attempt;
  if (randomize_questions !== undefined)  updates.randomize_questions   = randomize_questions;
  if (status !== undefined)               updates.status                = status;

  const { data: test, error } = await supabase.from('tests').update(updates).eq('id', id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ test });
});

// ── DELETE /api/tests/:id ─────────────────────────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: existing } = await supabase.from('tests').select('id, created_by').eq('id', id).single();
  if (!existing) return res.status(404).json({ error: 'Test not found' });
  // Ownership check removed for admin testing

  const { error } = await supabase.from('tests').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ message: 'Test deleted' });
});

// ── GET /api/tests/:id/leaderboard ───────────────────────────
router.get('/:id/leaderboard', requireAdmin, async (req, res) => {
  const { id: testId } = req.params;
  const { data: test } = await supabase.from('tests').select('id, created_by').eq('id', testId).single();
  if (!test) return res.status(404).json({ error: 'Test not found' });
  if (test.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { data: results, error } = await supabase
    .from('results')
    .select('rank, total_score, total_marks, percentage, submitted_at, attempts ( submitted_at, users ( name, division ) )')
    .eq('test_id', testId)
    .order('rank', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const leaderboard = (results ?? []).map(r => {
    const attempt = Array.isArray(r.attempts) ? r.attempts[0] : r.attempts;
    const user = attempt ? (Array.isArray(attempt.users) ? attempt.users[0] : attempt.users) : null;
    return {
      rank: r.rank,
      student_name: user?.name ?? 'Unknown',
      division: user?.division ?? '—',
      score: r.total_score,
      total_marks: r.total_marks,
      percentage: r.percentage,
      submitted_at: attempt?.submitted_at ?? r.submitted_at,
    };
  });

  return res.json({ leaderboard });
});

// ── GET /api/tests/:id/settings ───────────────────────────────
router.get('/:id/settings', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: test } = await supabase.from('tests').select('id, created_by, settings').eq('id', id).single();
  if (!test) return res.status(404).json({ error: 'Test not found' });
  if (test.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  return res.json({ settings: test.settings ?? {} });
});

// ── PATCH /api/tests/:id/settings ────────────────────────────
router.patch('/:id/settings', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings object is required' });

  const { data: existing } = await supabase.from('tests').select('id, created_by').eq('id', id).single();
  if (!existing) return res.status(404).json({ error: 'Test not found' });
  // Ownership check removed for admin testing

  const { data, error } = await supabase.from('tests').update({ settings }).eq('id', id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ settings: data.settings });
});

export default router;
