import express from 'express';
import axios from 'axios';

const router = express.Router();

const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'deepseek-coder-v2:16b';

// Central AI caller with fallback logic
async function callAI(prompt, taskName) {
  console.log(`\n[AI ENGINE] 🚀 Starting ${taskName}...`);
  
  // 1. Try Local Ollama
  try {
    console.log(`[AI ENGINE] 🤖 Attempting Local: ${OLLAMA_MODEL}`);
    const resp = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: { temperature: 0.1 }
    });

    const text = resp.data.response;
    return processJsonResponse(text);
  } catch (localError) {
    console.log(`[AI ENGINE] ⚠️ Local failed: ${localError.message}`);
    
    // 2. Fallback Chain (NVIDIA NIM)
    const models = [
      'meta/llama-3.3-70b-instruct',
      'nvidia/llama-3.1-405b-instruct',
      'meta/llama-3.1-8b-instruct'
    ];

    for (const model of models) {
      try {
        console.log(`[AI ENGINE] ☁️ Attempting NVIDIA Fallback: ${model}`);
        const response = await axios.post(
          'https://integrate.api.nvidia.com/v1/chat/completions',
          {
            model: model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            max_tokens: 2048,
          },
          { headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` } }
        );

        const text = response.data.choices[0].message.content;
        console.log(`[AI ENGINE] ✅ Success! [${model}]`);
        return processJsonResponse(text);
      } catch (fallbackError) {
        console.log(`[AI ENGINE] ❌ Fallback failed [${model}]: ${fallbackError.message}`);
      }
    }

    throw new Error('All AI models failed to fulfill the request.');
  }
}

function processJsonResponse(text) {
    const sArr = text.indexOf('[');
    const sObj = text.indexOf('{');
    let s = -1, e = -1;

    if (sArr !== -1 && (sObj === -1 || sArr < sObj)) { s = sArr; e = text.lastIndexOf(']'); }
    else { s = sObj; e = text.lastIndexOf('}'); }
    
    if (s === -1 || e === -1) throw new Error('AI output was not in valid JSON format.');

    let jsonStr = text.slice(s, e + 1);

    // Sanitize raw newlines within string values
    jsonStr = jsonStr.replace(/"([^"]*)"/g, (match) => {
      return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    });

    const result = JSON.parse(jsonStr);
    return result.variants || result.test_cases || result;
}

// ── GENERATE VARIANTS ─────────────────────────────────────────
router.post('/generate-variants', async (req, res) => {
  const { correct_code, statement, count, difficulty, language } = req.body;
  const prompt = `Act as an UNRELENTING and BRUTAL Code Saboteur.
Task: Create ${count} ${difficulty} level buggy variants in ${language}.
Problem: ${statement}
Correct Code: ${correct_code}
Return JSON array with "buggy_code" and "explanation".`;

  try {
    const variants = await callAI(prompt, 'Variant Generation');
    res.json({ variants });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── GENERATE TEST CASES ───────────────────────────────────────
router.post('/generate-test-cases', async (req, res) => {
  const { correct_code, statement, count } = req.body;
  const prompt = `Generate ${count} test cases. Problem: ${statement}. Solution: ${correct_code}. 
Return JSON array: [{"input": "...", "expected_output": "..."}]`;

  try {
    const tcs = await callAI(prompt, 'Test Case Generation');
    res.json({ test_cases: tcs });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

export default router;
