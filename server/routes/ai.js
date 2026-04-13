import { Router } from 'express';
import OpenAI from 'openai';
import { supabase } from '../supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

function getClient() {
  return new OpenAI({
    apiKey: 'ollama',
    baseURL: 'http://localhost:11434/v1',
  });
}

const MODEL_ID = 'deepseek-coder-v2:16b';

async function callAI(prompt, type = 'Generation') {
  const start = Date.now();
  console.log(`\n[AI ENGINE] 🚀 Starting ${type}...`);
  console.log(`[AI ENGINE] 🤖 Model: ${MODEL_ID}`);
  
  try {
    const client = getClient();
    const completion = await client.chat.completions.create({
      model: MODEL_ID,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 4096,
    });

    const duration = ((Date.now() - start) / 1000).toFixed(1);
    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    
    // Safety check for empty responses
    if (!raw) throw new Error('AI returned an empty response.');

    const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const sArr = text.indexOf('[');
    const sObj = text.indexOf('{');
    let s = -1, e = -1;

    if (sArr !== -1 && (sObj === -1 || sArr < sObj)) { s = sArr; e = text.lastIndexOf(']'); }
    else { s = sObj; e = text.lastIndexOf('}'); }
    
    if (s === -1 || e === -1) {
       console.error("[AI ENGINE] ❌ Failed to find JSON in response:", text);
       throw new Error('AI output was not in valid JSON format.');
    }

    const result = JSON.parse(text.slice(s, e + 1));
    const finalData = result.variants || result.test_cases || result;
    
    const count = Array.isArray(finalData) ? finalData.length : 1;
    console.log(`[AI ENGINE] ✅ Success! Generated ${count} item(s) in ${duration}s\n`);
    
    return finalData;
  } catch (err) {
    console.error(`[AI ENGINE] ❌ ERROR: ${err.message}`);
    if (err.message.includes('ECONNREFUSED')) {
        throw new Error('Local AI (Ollama) is not running! Please start it for the demo.');
    }
    throw err;
  }
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
