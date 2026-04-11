import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Judge0 CE — supports libraries (numpy, pandas, boost, etc.)
// Uses the free public instance; set JUDGE0_URL + JUDGE0_KEY for self-hosted or RapidAPI
const JUDGE0_URL  = process.env.JUDGE0_URL  ?? 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_KEY  = process.env.JUDGE0_KEY  ?? '';
const USE_JUDGE0  = Boolean(JUDGE0_KEY);

// Judge0 language IDs
const JUDGE0_LANG = {
  python: 71,   // Python 3.8 (numpy, pandas, scipy pre-installed)
  cpp:    54,   // C++ (GCC 9.2, boost available)
  c:      50,   // C (GCC 9.2)
  java:   62,   // Java (OpenJDK 13)
};

// Piston fallback — try multiple public instances
const PISTON_INSTANCES = [
  'https://emkc.org/api/v2/piston/execute',
  'https://piston.krunker.io/api/v2/piston/execute',
];
const PISTON_LANG = {
  python: { language: 'python', version: '3.10.0' },
  cpp:    { language: 'c++',    version: '10.2.0'  },
  c:      { language: 'c',      version: '10.2.0'  },
  java:   { language: 'java',   version: '15.0.2'  },
};

// ── Judge0 helpers ────────────────────────────────────────────
async function judge0Submit(languageId, code, stdin) {
  const headers = {
    'Content-Type': 'application/json',
    'X-RapidAPI-Key': JUDGE0_KEY,
    'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
  };

  // Submit
  const submitRes = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      language_id: languageId,
      source_code: code,
      stdin: stdin ?? '',
      cpu_time_limit: 5,
      wall_time_limit: 10,
      memory_limit: 256000,
    }),
  });

  if (!submitRes.ok) throw new Error(`Judge0 error: ${submitRes.status}`);
  const data = await submitRes.json();

  return {
    stdout:   data.stdout   ?? '',
    stderr:   (data.compile_output ?? '') + (data.stderr ?? ''),
    exitCode: data.exit_code ?? (data.status?.id === 3 ? 0 : 1),
  };
}

// ── Piston fallback helper — tries multiple instances ─────────
async function pistonRun(language, code, stdin) {
  const runtime = PISTON_LANG[language];
  const body = JSON.stringify({
    language: runtime.language,
    version:  runtime.version,
    files:    [{ content: code }],
    stdin:    stdin ?? '',
    run_timeout: 10000,
    compile_timeout: 15000,
  });

  let lastError;
  for (const url of PISTON_INSTANCES) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) { lastError = new Error(`Piston error: ${res.status}`); continue; }
      const data = await res.json();
      const run  = data.run ?? {};
      return {
        stdout:   run.stdout ?? '',
        stderr:   (data.compile?.stderr ?? '') + (run.stderr ?? ''),
        exitCode: run.code ?? 0,
      };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('All execution instances failed');
}

async function runCode(language, code, stdin) {
  if (USE_JUDGE0 && JUDGE0_LANG[language]) {
    return judge0Submit(JUDGE0_LANG[language], code, stdin);
  }
  return pistonRun(language, code, stdin);
}

// ── POST /api/execute/scratch ─────────────────────────────────
router.post('/scratch', async (req, res) => {
  const { language, code, stdin } = req.body;
  if (!language || !code) return res.status(400).json({ error: 'language and code are required' });
  if (!PISTON_LANG[language]) return res.status(400).json({ error: `Unsupported language: ${language}` });

  try {
    const result = await runCode(language, code, stdin);
    return res.json(result);
  } catch (e) {
    return res.status(502).json({ error: e.message ?? 'Execution service error' });
  }
});

// ── POST /api/execute ─────────────────────────────────────────
router.post('/', async (req, res) => {
  const { attempt_id, question_id, language, code } = req.body;
  if (!attempt_id || !question_id || !language || !code) {
    return res.status(400).json({ error: 'attempt_id, question_id, language, and code are required' });
  }
  if (!PISTON_LANG[language]) return res.status(400).json({ error: `Unsupported language: ${language}` });

  // Verify attempt ownership + in_progress + runs_remaining
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

  // Fetch visible test cases
  const { data: testCases, error: tcErr } = await supabase
    .from('test_cases')
    .select('id, input, expected_output')
    .eq('question_id', question_id)
    .eq('is_hidden', false);

  if (tcErr) return res.status(500).json({ error: tcErr.message });
  if (!testCases?.length) return res.json({ results: [], runs_remaining: attempt.runs_remaining });

  // Decrement runs_remaining
  const newRunsRemaining = (attempt.runs_remaining ?? 10) - 1;
  await supabase.from('attempts').update({ runs_remaining: newRunsRemaining }).eq('id', attempt_id);

  // Run against each test case
  const results = [];
  for (const tc of testCases) {
    try {
      const { stdout, stderr } = await runCode(language, code, tc.input);
      const passed = stdout.trim() === (tc.expected_output ?? '').trim();
      results.push({
        input:           tc.input,
        expected_output: tc.expected_output,
        actual_output:   stdout.trim(),
        stderr:          stderr || null,
        passed,
      });
    } catch (e) {
      results.push({
        input:           tc.input,
        expected_output: tc.expected_output,
        actual_output:   null,
        stderr:          e.message ?? 'Execution error',
        passed:          false,
      });
    }
  }

  return res.json({ results, runs_remaining: newRunsRemaining });
});

export default router;
