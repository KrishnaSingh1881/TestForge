import { Router } from 'express';
import OpenAI from 'openai';
import { supabase } from '../supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

function getClient() {
  return new OpenAI({
    apiKey:  process.env.NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });
}

const MODEL = 'google/gemma-4-31b-it';

async function callAI(prompt) {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 8192,
  });
  const raw = completion.choices[0]?.message?.content?.trim() ?? '';

  // Strip thinking tags (Gemma 4 uses <think>...</think>)
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Extract JSON array — find first [ to last ]
  const start = text.indexOf('[');
  const end   = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array found in response');

  return JSON.parse(text.slice(start, end + 1));
}

function buildPrompt(correct_code, bug_count, difficulty, count = 5) {
  return `You are a programming question generator for an academic test platform.

Given the following correct code, generate ${count} buggy variant${count > 1 ? 's' : ''}.

Rules:
- Each variant must have exactly ${bug_count} bug${bug_count > 1 ? 's' : ''} introduced.
- Difficulty level: ${difficulty}.
- Use different variable names, function names, and minor structural differences across variants.
- Bugs must be subtle and realistic (off-by-one errors, wrong operators, swapped conditions, wrong return values).
- Do NOT add syntax errors that prevent compilation/parsing.

Correct code:
\`\`\`
${correct_code}
\`\`\`

Return ONLY a valid JSON array with no markdown, no explanation, no code fences.
Each element must have exactly these fields:
- "buggy_code": string (the full modified code)
- "diff": array of objects, each with { "line_number": number, "original_line": string, "buggy_line": string }`;
}

// ── POST /api/ai/generate-variants ───────────────────────────
router.post('/generate-variants', async (req, res) => {
  const { question_id } = req.body;
  if (!question_id) return res.status(400).json({ error: 'question_id is required' });

  const { data: q, error: qErr } = await supabase
    .from('question_bank')
    .select('id, created_by, correct_code, bug_count, difficulty, language')
    .eq('id', question_id)
    .single();

  if (qErr || !q) return res.status(404).json({ error: 'Question not found' });
  if (q.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (!q.correct_code) return res.status(400).json({ error: 'Question has no correct_code' });

  let variants;
  try {
    variants = await callAI(buildPrompt(q.correct_code, q.bug_count ?? 1, q.difficulty ?? 'medium', 5));
  } catch (e) {
    return res.status(502).json({ error: 'AI generation failed: ' + e.message });
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    return res.status(502).json({ error: 'AI returned no variants' });
  }

  const rows = variants.map(v => ({
    question_id,
    generated_by: 'manual',   // using 'manual' to satisfy existing enum
    buggy_code:   v.buggy_code,
    diff_json:    v.diff ?? [],
    bug_count:    q.bug_count ?? 1,
    difficulty:   q.difficulty ?? null,
    language:     q.language ?? null,
    is_approved:  false,
  }));

  const { data: saved, error: insertErr } = await supabase
    .from('debug_variants')
    .insert(rows)
    .select();

  if (insertErr) return res.status(500).json({ error: insertErr.message });
  return res.json({ variants: saved });
});

// ── POST /api/ai/regenerate-variant/:question_id ─────────────
router.post('/regenerate-variant/:question_id', async (req, res) => {
  const { question_id } = req.params;

  const { data: q, error: qErr } = await supabase
    .from('question_bank')
    .select('id, created_by, correct_code, bug_count, difficulty, language')
    .eq('id', question_id)
    .single();

  if (qErr || !q) return res.status(404).json({ error: 'Question not found' });
  if (q.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  let variants;
  try {
    variants = await callAI(buildPrompt(q.correct_code, q.bug_count ?? 1, q.difficulty ?? 'medium', 1));
  } catch (e) {
    return res.status(502).json({ error: 'AI generation failed: ' + e.message });
  }

  const v = Array.isArray(variants) ? variants[0] : variants;
  if (!v?.buggy_code) return res.status(502).json({ error: 'AI returned invalid variant' });

  const { data: saved, error: insertErr } = await supabase
    .from('debug_variants')
    .insert({
      question_id,
      generated_by: 'manual',
      buggy_code:   v.buggy_code,
      diff_json:    v.diff ?? [],
      bug_count:    q.bug_count ?? 1,
      difficulty:   q.difficulty ?? null,
      language:     q.language ?? null,
      is_approved:  false,
    })
    .select()
    .single();

  if (insertErr) return res.status(500).json({ error: insertErr.message });
  return res.json({ variant: saved });
});

export default router;
