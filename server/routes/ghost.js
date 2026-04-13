import express from 'express';
import axios from 'axios';
import { supabase } from '../supabase.js';

const router = express.Router();

const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'deepseek-coder-v2:16b';

// Start a simulated attempt
router.post('/start', async (req, res) => {
  const { test_id, user_id } = req.body;
  
  if (!user_id || !test_id) {
    return res.status(400).json({ error: 'user_id and test_id are required' });
  }

  const payload = {
    test_id,
    user_id,
    status: 'in_progress',
    started_at: new Date().toISOString(),
    is_simulation: true, // Try with the flag first
  };

  const { data, error } = await supabase.from('attempts').insert(payload).select().single();

  if (error) {
    console.log('[GHOST] ⚠️ Simulation flag failed, trying safe fallback...');
    // Fallback: Try without the is_simulation column if it doesn't exist yet
    delete payload.is_simulation;
    const { data: retryData, error: retryError } = await supabase.from('attempts').insert(payload).select().single();
    
    if (retryError) return res.status(500).json({ error: retryError.message });
    return res.json({ attempt_id: retryData.id });
  }

  res.json({ attempt_id: data.id });
});

// Log a "Cheat" event (Tab switch, paste, etc)
router.post('/log-event', async (req, res) => {
  const { attempt_id, event_type, metadata } = req.body;
  
  const { error } = await supabase.from('test_integrity_logs').insert({
    attempt_id,
    event_type,
    severity: 'high',
    metadata: { ...metadata, is_ghost: true },
    created_at: new Date().toISOString()
  });

  if (error) console.log('[GHOST] Failed to log integrity event:', error.message);
  res.json({ status: 'noted' });
});

router.post('/solve', async (req, res) => {
  const { buggy_code, statement, language } = req.body;
  
  const prompt = `Act as a Student solving a ${language} debugging task.
Problem: ${statement}
Buggy Code: ${buggy_code}
INSTRUCTION: Fix the code. Return ONLY the clean source code. No explanations.`;

  try {
    const resp = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.2 }
    });

    res.json({ fixed_code: resp.data.response.replace(/```[a-z]*\n/gi, '').replace(/```/g, '').trim() });
  } catch (e) {
    res.status(503).json({ error: 'Local AI unavailable' });
  }
});

export default router;
