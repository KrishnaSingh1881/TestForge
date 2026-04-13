import { Router } from 'express';
import OpenAI from 'openai';
import { supabase } from '../supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// Clients
const localClient = new OpenAI({
  apiKey: 'ollama',
  baseURL: 'http://localhost:11434/v1',
});

const nvidiaClient = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

// Model Chain
const LOCAL_MODEL = 'deepseek-coder-v2:16b';
const FALLBACK_MODELS = [
  'meta/llama-3.3-70b-instruct',
  'nvidia/llama-3.1-405b-instruct',
  'meta/llama-3.1-8b-instruct'
];

async function callAI(prompt, type = 'Generation') {
  const start = Date.now();
  console.log(`\n[AI ENGINE] 🚀 Starting ${type}...`);

  // 1. Try Local First
  try {
    console.log(`[AI ENGINE] 🤖 Attempting Local: ${LOCAL_MODEL}`);
    const completion = await localClient.chat.completions.create({
      model: LOCAL_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4096,
    });
    return processResponse(completion, start, LOCAL_MODEL);
  } catch (localErr) {
    console.warn(`[AI ENGINE] ⚠️ Local failed: ${localErr.message}`);
    
    // 2. Cascade through NVIDIA Fallbacks
    for (const model of FALLBACK_MODELS) {
      try {
        console.log(`[AI ENGINE] ☁️ Attempting NVIDIA Fallback: ${model}`);
        const completion = await nvidiaClient.chat.completions.create({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 4096,
        });
        return processResponse(completion, start, model);
      } catch (nimErr) {
        console.warn(`[AI ENGINE] ⚠️ Fallback ${model} failed: ${nimErr.message}`);
        continue; // Try next model
      }
    }
  }

  throw new Error('All AI models (Local & Cloud) failed to respond.');
}

function processResponse(completion, startTime, modelName) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    const sArr = text.indexOf('[');
    const sObj = text.indexOf('{');
    let s = -1, e = -1;

    if (sArr !== -1 && (sObj === -1 || sArr < sObj)) { s = sArr; e = text.lastIndexOf(']'); }
    else { s = sObj; e = text.lastIndexOf('}'); }
    
    if (s === -1 || e === -1) throw new Error('AI output was not in valid JSON format.');

    const result = JSON.parse(text.slice(s, e + 1));
    const finalData = result.variants || result.test_cases || result;
    
    const count = Array.isArray(finalData) ? finalData.length : 1;
    console.log(`[AI ENGINE] ✅ Success! [${modelName}] generated ${count} item(s) in ${duration}s\n`);
    return finalData;
}

// ── GENERATE VARIANTS ─────────────────────────────────────────
router.post('/generate-variants', async (req, res) => {
  const { question_id, count = 3 } = req.body;
  const { data: q } = await supabase.from('question_bank').select('*').eq('id', question_id).single();
  if (!q) return res.status(404).json({ error: 'Question not found' });

  const prompt = `Act as an Unrelenting Code Saboteur and Competitive Programming Architect.
Your goal is to SABOTAGE this CORRECT ${q.language} code to create a debugging challenge.

Correct Code:
${q.correct_code}

CURRENT MISSION:
1. Generate ${count} unique buggy variants.
2. For each variant, introduce EXACTLY ${q.bug_count || 1} bugs of ${q.difficulty || 'medium'} difficulty.
3. INCONSISTENCY IS A FAILURE: The "diff" and "buggy_code" MUST be perfectly synced.

DIFFICULTY GUIDELINES:
- EASY: Syntax errors (semicolons, brackets), obvious typos, beginner mistakes.
- MEDIUM: Logical errors, off-by-one, wrong math operators, incorrect return values.
- HARD: Subtle logic traps, edge case failures, complex boolean errors, memory/pointer confusion (if C++).

Rule: ANYTHING goes. You can break syntax, logic, or names.
Return ONLY JSON: [{"buggy_code": "...", "diff": [{"line": 1, "original": "...", "buggy": "..."}]}]`;

  try {
    const variants = await callAI(prompt, 'Variant Generation');
    res.json({ variants });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── GENERATE TEST CASES ───────────────────────────────────────
router.post('/generate-test-cases', async (req, res) => {
  const { statement, solution_code, language } = req.body;
  const prompt = `Act as a Quality Assurance Engineer. Generate 5 software test cases for:
Task: "${statement}"
Solution: ${solution_code}
Language: ${language}
Return ONLY a JSON array: [{"input": "...", "expected_output": "...", "is_hidden": false}]`;

  try {
    const tcs = await callAI(prompt, 'Test Case Generation');
    res.json({ test_cases: tcs });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

export default router;
