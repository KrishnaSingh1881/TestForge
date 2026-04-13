import axios from 'axios';

const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-coder-v2';

/**
 * AI Integrity Auditor
 * Analyzes heartbeat data, code complexity, and completion time 
 * to determine the probability of academic dishonesty.
 */
export async function auditAttempt(attempt, questions, logs) {
  const { 
    total_time_seconds, 
    violation_count, 
    pasted_chars_total,
    code_final 
  } = attempt;

  const prompt = `Act as an AI Forensic Code Auditor.
Analyze this exam session for potential cheating.

EXAM METRICS:
- Time Spent: ${total_time_seconds}s
- Violations (Tab Switches): ${violation_count}
- Data Injected (Pasted): ${pasted_chars_total} characters

PROBLEM CONTEXT:
${questions.map((q, i) => `Q${i+1}: ${q.statement}`).join('\n')}

STUDENT'S FINAL CODE:
${code_final}

INSTRUCTIONS:
1. Provide a "Suspicion Score" (0-100).
2. Write a 2-sentence "Auditor Narrative" explaining the logic behind the score.
3. Identify the "Primary Red Flag".

Return ONLY JSON:
{
  "suspicion_score": number, 
  "narrative": "...", 
  "primary_flag": "..."
}`;

  try {
    const resp = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: "json",
      options: { temperature: 0.1 }
    });

    return JSON.parse(resp.data.response);
  } catch (e) {
    console.error(`[AUDITOR] AI Audit failed for model '${OLLAMA_MODEL}':`, e.response?.data || e.message);
    
    // Attempt fallback data on failure
    return {
      suspicion_score: violation_count > 0 ? 50 : 10,
      narrative: "Forensic logic analysis temporarily defaulted. (Local AI model not found or busy)",
      primary_flag: violation_count > 0 ? "Behavioral Patterns" : "Automatic Clean Bill"
    };
  }
}
