import express from 'express';
import axios from 'axios';
import { supabase } from '../supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireAdmin);

const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'deepseek-coder-v2:16b';

// ── Robust JSON extractor ─────────────────────────────────────
function extractJSON(text) {
  // Strip markdown code fences
  let clean = text
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Try to find a JSON array first, then object
  const arrStart = clean.indexOf('[');
  const objStart = clean.indexOf('{');

  let start = -1, end = -1, isArray = false;

  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    start = arrStart;
    end = clean.lastIndexOf(']');
    isArray = true;
  } else if (objStart !== -1) {
    start = objStart;
    end = clean.lastIndexOf('}');
  }

  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON structure found in AI response');
  }

  let jsonStr = clean.slice(start, end + 1);

  // Fix unescaped newlines inside string values
  jsonStr = jsonStr.replace(/"((?:[^"\\]|\\.)*)"/g, (match, inner) => {
    const fixed = inner
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return `"${fixed}"`;
  });

  const parsed = JSON.parse(jsonStr);

  // Unwrap if wrapped in an object
  if (!isArray && parsed.variants) return parsed.variants;
  if (!isArray && parsed.test_cases) return parsed.test_cases;
  return parsed;
}

// ── Central AI caller with fallback chain ─────────────────────
async function callAI(prompt, taskName) {
  console.log(`\n[AI ENGINE] 🚀 Starting ${taskName}...`);

  // 1. Try Local Ollama first (fastest, free)
  try {
    console.log(`[AI ENGINE] 🤖 Attempting Local: ${OLLAMA_MODEL}`);
    const resp = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.1 },
    }, { timeout: 30000000 });

    const result = extractJSON(resp.data.response);
    console.log(`[AI ENGINE] ✅ Local success!`);
    return result;
  } catch (localErr) {
    console.log(`[AI ENGINE] ⚠️ Local failed: ${localErr.message}`);
  }

  // 2. NVIDIA NIM fallback chain — comment out for local-only testing
  /*
  const nvidiaModels = [
    'meta/llama-3.3-70b-instruct',
    'meta/llama-3.1-8b-instruct',
    'google/gemma-4-31b-it',
  ];

  for (const model of nvidiaModels) {
    try {
      console.log(`[AI ENGINE] ☁️ Attempting NVIDIA: ${model}`);
      const response = await axios.post(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 4096,
        },
        {
          headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
          timeout: 60000,
        }
      );

      const text = response.data.choices[0]?.message?.content ?? '';
      const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      const result = extractJSON(cleaned);
      console.log(`[AI ENGINE] ✅ NVIDIA success! [${model}]`);
      return result;
    } catch (err) {
      console.log(`[AI ENGINE] ❌ NVIDIA failed [${model}]: ${err.message}`);
    }
  }
  */

  throw new Error('Local AI model failed. Enable NVIDIA fallback or check Ollama is running.');
}

// ── Build variant generation prompt ──────────────────────────
function buildVariantPrompt(correct_code, bug_count, language, count) {
  return `You are a code variant generator for an academic testing platform.

Given the following correct ${language} code, generate exactly ${count} buggy variants.
Each variant must have exactly ${bug_count} bug(s) introduced.

Bugs should be subtle and realistic:
- Off-by-one errors
- Wrong operators (< vs <=, + vs -, etc.)
- Swapped variable names
- Wrong return values
- Missing or extra conditions

IMPORTANT: Do NOT introduce syntax errors. The code must still compile/run.
IMPORTANT: Use different variable names and minor structural differences across variants.

Correct code:
\`\`\`${language}
${correct_code}
\`\`\`

Return ONLY a valid JSON array. No explanation, no markdown, no extra text.
Each element must have exactly these fields:
- "buggy_code": string (the complete modified code)
- "explanation": string (brief description of what bug was introduced)

Example format:
[{"buggy_code": "...", "explanation": "Changed < to <= in loop condition"}, ...]`;
}

// ── Build test case generation prompt ────────────────────────
function buildTestCasePrompt(correct_code, statement, language, count) {
  return `You are a test case generator for a coding platform.

Problem: ${statement}

Correct ${language} solution:
\`\`\`${language}
${correct_code}
\`\`\`

Generate exactly ${count} diverse test cases covering:
- Normal cases
- Edge cases (empty input, zero, negative numbers, etc.)
- Boundary cases

Return ONLY a valid JSON array. No explanation, no markdown, no extra text.
Each element must have exactly these fields:
- "input": string (the stdin input, empty string if no input needed)
- "expected_output": string (exact expected stdout output, trimmed)

Example format:
[{"input": "5\\n3", "expected_output": "8"}, ...]`;
}

// ── POST /api/ai/generate-variants ───────────────────────────
router.post('/generate-variants', async (req, res) => {
  const { question_id, correct_code, statement, bug_count = 1, language = 'python', count = 5 } = req.body;

  let code = correct_code;
  let lang = language;
  let bugs = bug_count;

  // If question_id provided, fetch from DB
  if (question_id && !code) {
    const { data: q, error } = await supabase
      .from('question_bank')
      .select('id, created_by, correct_code, bug_count, language')
      .eq('id', question_id)
      .single();

    if (error || !q) return res.status(404).json({ error: 'Question not found' });
    if (q.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!q.correct_code) return res.status(400).json({ error: 'Question has no correct_code' });

    code = q.correct_code;
    lang = q.language ?? language;
    bugs = q.bug_count ?? bug_count;
  }

  if (!code) return res.status(400).json({ error: 'correct_code or question_id is required' });

  try {
    const prompt = buildVariantPrompt(code, bugs, lang, count);
    const variants = await callAI(prompt, 'Variant Generation');

    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(502).json({ error: 'AI returned no variants' });
    }

    // Return variants WITHOUT saving to DB
    // Client will handle approval and saving via /questions/debug/:id/approve-variant
    const formatted = variants.map(v => ({
      buggy_code: v.buggy_code ?? v.code ?? '',
      diff_json: [{ explanation: v.explanation ?? '' }],
      bug_count: bugs,
      language: lang,
      is_approved: false,
      generated_by: 'local-ollama',
    }));

    return res.json({ variants: formatted });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
});

// ── POST /api/ai/generate-variants-stream ────────────────────
// Generates variants one-by-one for better UX feedback
router.post('/generate-variants-stream', async (req, res) => {
  const { question_id, correct_code, bug_count = 1, language = 'python', count = 5 } = req.body;

  let code = correct_code;
  let lang = language;
  let bugs = bug_count;

  // If question_id provided, fetch from DB
  if (question_id && !code) {
    const { data: q, error } = await supabase
      .from('question_bank')
      .select('id, created_by, correct_code, bug_count, language')
      .eq('id', question_id)
      .single();

    if (error || !q) return res.status(404).json({ error: 'Question not found' });
    if (q.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!q.correct_code) return res.status(400).json({ error: 'Question has no correct_code' });

    code = q.correct_code;
    lang = q.language ?? language;
    bugs = q.bug_count ?? bug_count;
  }

  if (!code) return res.status(400).json({ error: 'correct_code or question_id is required' });

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Generate variants one at a time
    for (let i = 0; i < count; i++) {
      const prompt = buildVariantPrompt(code, bugs, lang, 1);
      const variants = await callAI(prompt, `Variant ${i + 1}/${count}`);
      
      const v = Array.isArray(variants) ? variants[0] : variants;
      
      if (v?.buggy_code) {
        const formatted = {
          id: `temp-${Date.now()}-${i}`,
          buggy_code: v.buggy_code,
          diff_json: [{ explanation: v.explanation ?? '' }],
          bug_count: bugs,
          language: lang,
          is_approved: false,
          generated_by: 'local-ollama',
        };
        
        // Send variant as SSE event
        res.write(`data: ${JSON.stringify(formatted)}\n\n`);
      }
    }
    
    // Send completion event
    res.write(`data: {"done": true}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: {"error": "${e.message}"}\n\n`);
    res.end();
  }
});

// ── POST /api/ai/regenerate-variant/:question_id ─────────────
router.post('/regenerate-variant/:question_id', async (req, res) => {
  const { question_id } = req.params;

  const { data: q, error } = await supabase
    .from('question_bank')
    .select('id, created_by, correct_code, bug_count, language')
    .eq('id', question_id)
    .single();

  if (error || !q) return res.status(404).json({ error: 'Question not found' });
  if (q.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  try {
    const prompt = buildVariantPrompt(q.correct_code, q.bug_count ?? 1, q.language ?? 'python', 1);
    const variants = await callAI(prompt, 'Single Variant Regeneration');
    const v = Array.isArray(variants) ? variants[0] : variants;

    if (!v?.buggy_code) return res.status(502).json({ error: 'AI returned invalid variant' });

    const { data: saved, error: insertErr } = await supabase
      .from('debug_variants')
      .insert({
        question_id,
        generated_by: 'nvidia-gemma',
        buggy_code: v.buggy_code,
        diff_json: [{ explanation: v.explanation ?? '' }],
        bug_count: q.bug_count ?? 1,
        language: q.language ?? null,
        is_approved: false,
      })
      .select()
      .single();

    if (insertErr) return res.status(500).json({ error: insertErr.message });
    return res.json({ variant: saved });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
});

// ── POST /api/ai/generate-test-cases ─────────────────────────
router.post('/generate-test-cases', async (req, res) => {
  const { correct_code, statement, language = 'python', count = 5 } = req.body;

  if (!correct_code) return res.status(400).json({ error: 'correct_code is required' });

  try {
    const prompt = buildTestCasePrompt(correct_code, statement ?? '', language, count);
    const testCases = await callAI(prompt, 'Test Case Generation');

    if (!Array.isArray(testCases) || testCases.length === 0) {
      return res.status(502).json({ error: 'AI returned no test cases' });
    }

    return res.json({ test_cases: testCases });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
});

export default router;
