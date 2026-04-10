import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

function getModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });
}

function buildPrompt(correct_code, bug_count, difficulty, count = 5) {
  return `You are a programming question generator for an academic test platform.

Given the following correct code, generate ${count} buggy variant${count > 1 ? 's' : ''}.

Rules:
- Each variant must have exactly ${bug_count} bug${bug_count > 1 ? 's' : ''} introduced.
- Difficulty level: ${difficulty}.
- Use different variable names, function names, and minor structural differences across variants to make each unique.
- Bugs must be subtle and realistic (off-by-one errors, wrong operators, swapped conditions, wrong return values, etc).
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

async function callGemini(prompt) {
  const model = getModel();
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  // Strip any accidental markdown fences
  const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(clean);
}

// ── POST /gemini/generate-variants ────────────────────────────
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
    variants = await callGemini(buildPrompt(q.correct_code, q.bug_count ?? 1, q.difficulty ?? 'medium', 5));
  } catch (e) {
    return res.status(502).json({ error: 'Gemini generation failed: ' + e.message });
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    return res.status(502).json({ error: 'Gemini returned no variants' });
  }

  const rows = variants.map(v => ({
    question_id,
    generated_by: 'gemini',
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

// ── POST /gemini/regenerate-variant/:question_id ──────────────
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
    variants = await callGemini(buildPrompt(q.correct_code, q.bug_count ?? 1, q.difficulty ?? 'medium', 1));
  } catch (e) {
    return res.status(502).json({ error: 'Gemini generation failed: ' + e.message });
  }

  const v = Array.isArray(variants) ? variants[0] : variants;
  if (!v?.buggy_code) return res.status(502).json({ error: 'Gemini returned invalid variant' });

  const { data: saved, error: insertErr } = await supabase
    .from('debug_variants')
    .insert({
      question_id,
      generated_by: 'gemini',
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
