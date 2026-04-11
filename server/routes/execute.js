import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const JUDGE0_URL  = process.env.JUDGE0_URL  ?? 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_KEY  = process.env.JUDGE0_KEY  ?? '';
const USE_JUDGE0  = Boolean(JUDGE0_KEY);
const CUSTOM_PISTON = process.env.PISTON_URL ?? '';

const JUDGE0_LANG = { python: 71, cpp: 54, c: 50, java: 62 };

const PISTON_INSTANCES = [
  ...(CUSTOM_PISTON ? [CUSTOM_PISTON] : []),
  'https://emkc.org/api/v2/piston/execute',
];

const PISTON_LANG = {
  python: { language: 'python', version: '3.10.0' },
  cpp:    { language: 'c++',    version: '10.2.0'  },
  c:      { language: 'c',      version: '10.2.0'  },
  java:   { language: 'java',   version: '15.0.2'  },
};

async function judge0Submit(languageId, code, stdin) {
  const res = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RapidAPI-Key': JUDGE0_KEY, 'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com' },
    body: JSON.stringify({ language_id: languageId, source_code: code, stdin: stdin ?? '', cpu_time_limit: 5, wall_time_limit: 10, memory_limit: 256000 }),
  });
  if (!res.ok) throw new Error(`Judge0 error: ${res.status}`);
  const data = await res.json();
  return {
    stdout:   data.stdout ?? '',
    stderr:   (data.compile_output ?? '') + (data.stderr ?? ''),
    exitCode: data.exit_code ?? (data.status?.id === 3 ? 0 : 1),
  };
}

async function pistonRun(language, code, stdin) {
  const runtime = PISTON_LANG[language];
  const body = JSON.stringify({
    language: runtime.language, version: runtime.version,
    files: [{ content: code }], stdin: stdin ?? '',
    run_timeout: 10000, compile_timeout: 15000,
  });
  let lastError;
  for (const url of PISTON_INSTANCES) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (!res.ok) { lastError = new Error(`Piston error: ${res.status}`); continue; }
      const data = await res.json();
      const run  = data.run ?? {};
      return { stdout: run.stdout ?? '', stderr: (data.compile?.stderr ?? '') + (run.stderr ?? ''), exitCode: run.code ?? 0 };
    } catch (e) { lastError = e; }
  }
  throw lastError ?? new Error('Piston unavailable');
}

async function geminiSimulate(language, code, stdin) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });
  const prompt = `You are a code execution simulator. Execute the following ${language} code and return the exact output.

Code:
\`\`\`${language}
${code}
\`\`\`

${stdin ? `Stdin:\n${stdin}` : 'No stdin.'}

Rules:
- Simulate exactly as a real interpreter would
- stdout = only what gets printed
- stderr = compile/runtime errors
- exitCode = 0 for success, 1 for error

Return ONLY valid JSON: {"stdout": "...", "stderr": "...", "exitCode": 0}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  const data = JSON.parse(text);
  return {
    stdout:   String(data.stdout   ?? ''),
    stderr:   String(data.stderr   ?? ''),
    exitCode: Number(data.exitCode ?? data.exit_code ?? 0),
  };
}

async function runCode(language, code, stdin) {
  if (USE_JUDGE0 && JUDGE0_LANG[language]) return judge0Submit(JUDGE0_LANG[language], code, stdin);
  try { return await pistonRun(language, code, stdin); } catch { /* fall through */ }
  return geminiSimulate(language, code, stdin);
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
    return res.status(502).json({ error: e.message ?? 'Execution failed' });
  }
});

// ── POST /api/execute ─────────────────────────────────────────
router.post('/', async (req, res) => {
  const { attempt_id, question_id, language, code } = req.body;
  if (!attempt_id || !question_id || !language || !code) {
    return res.status(400).json({ error: 'attempt_id, question_id, language, and code are required' });
  }
  if (!PISTON_LANG[language]) return res.status(400).json({ error: `Unsupported language: ${language}` });

  const { data: attempt, error: aErr } = await supabase
    .from('attempts').select('id, status, runs_remaining, user_id')
    .eq('id', attempt_id).eq('user_id', req.user.id).single();

  if (aErr || !attempt) return res.status(404).json({ error: 'Attempt not found' });
  if (attempt.status !== 'in_progress') return res.status(400).json({ error: 'Attempt is not in progress' });
  if ((attempt.runs_remaining ?? 0) <= 0) return res.status(429).json({ error: 'No runs remaining', runs_remaining: 0 });

  const { data: testCases, error: tcErr } = await supabase
    .from('test_cases').select('id, input, expected_output')
    .eq('question_id', question_id).eq('is_hidden', false);

  if (tcErr) return res.status(500).json({ error: tcErr.message });
  if (!testCases?.length) return res.json({ results: [], runs_remaining: attempt.runs_remaining });

  const newRunsRemaining = (attempt.runs_remaining ?? 10) - 1;
  await supabase.from('attempts').update({ runs_remaining: newRunsRemaining }).eq('id', attempt_id);

  const results = [];
  for (const tc of testCases) {
    try {
      const { stdout, stderr } = await runCode(language, code, tc.input);
      results.push({
        input: tc.input, expected_output: tc.expected_output,
        actual_output: stdout.trim(), stderr: stderr || null,
        passed: stdout.trim() === (tc.expected_output ?? '').trim(),
      });
    } catch (e) {
      results.push({ input: tc.input, expected_output: tc.expected_output, actual_output: null, stderr: e.message, passed: false });
    }
  }

  return res.json({ results, runs_remaining: newRunsRemaining });
});

export default router;
