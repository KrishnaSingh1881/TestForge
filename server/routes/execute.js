import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

// Map our language names to Piston's runtime names + versions
const LANG_MAP = {
  python: { language: 'python', version: '3.10.0' },
  cpp:    { language: 'c++',    version: '10.2.0'  },
};

// ── POST /api/execute ─────────────────────────────────────────
router.post('/', async (req, res) => {
  const { attempt_id, question_id, language, code } = req.body;

  if (!attempt_id || !question_id || !language || !code) {
    return res.status(400).json({ error: 'attempt_id, question_id, language, and code are required' });
  }

  const runtime = LANG_MAP[language];
  if (!runtime) return res.status(400).json({ error: `Unsupported language: ${language}` });

  // 1. Verify attempt ownership + in_progress + runs_remaining
  const { data: attempt, error: aErr } = await supabase
    .from('attempts')
    .select('id, status, runs_remaining, user_id')
    .eq('id', attempt_id)
    .eq('user_id', req.user.id)
    .single();

  if (aErr || !attempt) return res.status(404).json({ error: 'Attempt not found' });
  if (attempt.status !== 'in_progress') return res.status(400).json({ error: 'Attempt is not in progress' });
  if ((attempt.runs_remaining ?? 0) <= 0) {
    return res.status(429).json({ error: 'No runs remaining for this attempt', runs_remaining: 0 });
  }

  // 2. Fetch VISIBLE test cases only
  const { data: testCases, error: tcErr } = await supabase
    .from('test_cases')
    .select('id, input, expected_output')
    .eq('question_id', question_id)
    .eq('is_hidden', false);

  if (tcErr) return res.status(500).json({ error: tcErr.message });
  if (!testCases?.length) {
    return res.json({ results: [], runs_remaining: attempt.runs_remaining });
  }

  // 3. Decrement runs_remaining atomically
  const newRunsRemaining = (attempt.runs_remaining ?? 10) - 1;
  await supabase
    .from('attempts')
    .update({ runs_remaining: newRunsRemaining })
    .eq('id', attempt_id);

  // 4. Run code against each visible test case via Piston
  const results = [];

  for (const tc of testCases) {
    try {
      const pistonRes = await fetch(PISTON_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: runtime.language,
          version:  runtime.version,
          files:    [{ content: code }],
          stdin:    tc.input ?? '',
          run_timeout: 5000,
          compile_timeout: 10000,
        }),
      });

      if (!pistonRes.ok) {
        results.push({
          input:           tc.input,
          expected_output: tc.expected_output,
          actual_output:   null,
          stderr:          `Execution service error: ${pistonRes.status}`,
          passed:          false,
        });
        continue;
      }

      const pistonData = await pistonRes.json();
      const run        = pistonData.run ?? {};
      const stdout     = (run.stdout ?? '').trim();
      const stderr     = (run.stderr ?? '').trim();
      const expected   = (tc.expected_output ?? '').trim();
      const passed     = stdout === expected;

      results.push({
        input:           tc.input,
        expected_output: tc.expected_output,
        actual_output:   stdout,
        stderr:          stderr || null,
        passed,
      });
    } catch (e) {
      results.push({
        input:           tc.input,
        expected_output: tc.expected_output,
        actual_output:   null,
        stderr:          'Network error reaching execution service',
        passed:          false,
      });
    }
  }

  return res.json({ results, runs_remaining: newRunsRemaining });
});

export default router;
