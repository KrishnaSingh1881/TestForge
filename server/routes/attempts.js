import { Router } from 'express';
import { randomUUID } from 'crypto';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { evaluateMCQ, evaluateDebugging } from '../lib/evaluator.js';

const router = Router();
router.use(requireAuth);

// ── helpers ───────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample(arr, n) {
  return shuffle(arr).slice(0, n);
}

// ── POST /api/attempts/start ──────────────────────────────────
router.post('/start', async (req, res) => {
  const { test_id } = req.body;
  const userId = req.user.id;

  if (!test_id) return res.status(400).json({ error: 'test_id is required' });

  // 1. Fetch test and validate
  const { data: test, error: testErr } = await supabase
    .from('tests')
    .select('id, status, start_time, end_time, duration_mins, questions_per_attempt, randomize_questions, total_marks')
    .eq('id', test_id)
    .single();

  if (testErr || !test) return res.status(404).json({ error: 'Test not found' });
  if (test.status !== 'active') return res.status(400).json({ error: 'Test is not active' });

  const now = new Date();
  if (new Date(test.start_time) > now) return res.status(400).json({ error: 'Test has not started yet' });
  if (new Date(test.end_time) < now) return res.status(400).json({ error: 'Test has ended' });

  // 2. Check for existing attempt
  const { data: existing } = await supabase
    .from('attempts')
    .select('id, status, started_at, question_selection')
    .eq('user_id', userId)
    .eq('test_id', test_id)
    .maybeSingle();

  if (existing) {
    if (['submitted', 'auto_submitted'].includes(existing.status)) {
      return res.status(400).json({ error: 'You have already submitted this test' });
    }
    // Resume in-progress attempt
    const elapsedSecs = Math.floor((now - new Date(existing.started_at)) / 1000);
    const totalSecs = test.duration_mins * 60;
    const timeRemaining = Math.max(0, totalSecs - elapsedSecs);

    return res.json({
      attempt_id: existing.id,
      question_ids: existing.question_selection ?? [],
      time_remaining_seconds: timeRemaining,
      resumed: true,
    });
  }

  // 3. Fetch all questions in this test pool
  const { data: testQuestions, error: tqErr } = await supabase
    .from('test_questions')
    .select('question_id, unlock_at_minutes, question_order')
    .eq('test_id', test_id)
    .order('question_order');

  if (tqErr) return res.status(500).json({ error: tqErr.message });
  if (!testQuestions?.length) return res.status(400).json({ error: 'Test has no questions' });

  // 4. Sample questions
  const qpa = test.questions_per_attempt ?? testQuestions.length;
  const selected = test.randomize_questions
    ? sample(testQuestions, Math.min(qpa, testQuestions.length))
    : testQuestions.slice(0, qpa);

  const selectedIds = selected.map(q => q.question_id);

  // 5. Create attempt
  const sessionToken = randomUUID();
  const { data: attempt, error: attemptErr } = await supabase
    .from('attempts')
    .insert({
      user_id: userId,
      test_id,
      status: 'in_progress',
      session_token: sessionToken,
      started_at: now.toISOString(),
      last_active_at: now.toISOString(),
      ip_address: req.ip ?? null,
      question_selection: selectedIds,
    })
    .select('id')
    .single();

  if (attemptErr) return res.status(500).json({ error: attemptErr.message });
  const attemptId = attempt.id;

  // 6. Fetch question types for selected ids
  const { data: questions } = await supabase
    .from('question_bank')
    .select('id, type')
    .in('id', selectedIds);

  const qMap = Object.fromEntries((questions ?? []).map(q => [q.id, q]));

  // 7. Assign variants for debugging questions
  const debugIds = selectedIds.filter(id => qMap[id]?.type === 'debugging');
  for (const qid of debugIds) {
    const { data: variants } = await supabase
      .from('debug_variants')
      .select('id')
      .eq('question_id', qid)
      .eq('is_approved', true);

    if (variants?.length) {
      const picked = variants[Math.floor(Math.random() * variants.length)];
      await supabase.from('variant_assignments').insert({
        attempt_id: attemptId,
        question_id: qid,
        variant_id: picked.id,
      });
    }
  }

  // 8. Shuffle MCQ options
  const mcqIds = selectedIds.filter(id =>
    qMap[id]?.type === 'mcq_single' || qMap[id]?.type === 'mcq_multi'
  );
  for (const qid of mcqIds) {
    const { data: options } = await supabase
      .from('mcq_options')
      .select('id')
      .eq('question_id', qid)
      .order('display_order');

    if (options?.length) {
      const shuffledOrder = shuffle(options.map(o => o.id));
      await supabase.from('option_shuffle').insert({
        attempt_id: attemptId,
        question_id: qid,
        shuffled_order: shuffledOrder,
      });
    }
  }

  const timeRemaining = test.duration_mins * 60;

  return res.status(201).json({
    attempt_id: attemptId,
    session_token: sessionToken,
    question_ids: selectedIds,
    time_remaining_seconds: timeRemaining,
    resumed: false,
  });
});

// ── GET /api/attempts/my ─── MUST be before /:id wildcard ────
router.get('/my', async (req, res) => {
  const { id: userId, year, division } = req.user;

  const { data: attempts, error: aErr } = await supabase
    .from('attempts')
    .select(`
      id, test_id, status, started_at, submitted_at,
      tests ( id, title, subject, end_time, total_marks ),
      results ( total_score, total_marks, percentage, rank )
    `)
    .eq('user_id', userId)
    .in('status', ['submitted', 'auto_submitted'])
    .order('submitted_at', { ascending: false });

  if (aErr) return res.status(500).json({ error: aErr.message });

  const attemptedTestIds = (attempts ?? []).map(a => a.test_id);

  let missedQuery = supabase
    .from('tests')
    .select('id, title, subject, end_time, total_marks')
    .eq('year', year)
    .in('division', [division, 'ALL'])
    .eq('status', 'ended');

  if (attemptedTestIds.length > 0) {
    missedQuery = missedQuery.not('id', 'in', `(${attemptedTestIds.map(id => `'${id}'`).join(',')})`);
  }

  const { data: missedTests, error: mErr } = await missedQuery;
  if (mErr) return res.status(500).json({ error: mErr.message });

  const submittedHistory = (attempts ?? []).map(a => {
    const result = Array.isArray(a.results) ? a.results[0] : a.results;
    const test   = Array.isArray(a.tests)   ? a.tests[0]   : a.tests;
    return {
      id: a.id, test_id: a.test_id, test_title: test?.title ?? 'Unknown',
      test_subject: test?.subject ?? null, status: a.status,
      submitted_at: a.submitted_at,
      total_score: result?.total_score ?? 0,
      total_marks: result?.total_marks ?? test?.total_marks ?? 0,
      percentage: result?.percentage ?? 0,
    };
  });

  const absentHistory = (missedTests ?? []).map(t => ({
    id: null, test_id: t.id, test_title: t.title, test_subject: t.subject,
    status: 'absent', submitted_at: t.end_time, total_score: 0,
    total_marks: t.total_marks ?? 0, percentage: 0,
  }));

  const history = [...submittedHistory, ...absentHistory]
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

  return res.json({ attempts: history });
});

// ── GET /api/attempts/:id — fetch attempt state ───────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data: attempt, error } = await supabase
    .from('attempts')
    .select(`
      id, test_id, status, started_at, submitted_at,
      session_token, question_selection, tab_switches, focus_lost_count, runs_remaining,
      tests ( duration_mins, title, subject )
    `)
    .eq('id', id)
    .eq('user_id', req.user.id)   // students can only fetch their own
    .single();

  if (error || !attempt) return res.status(404).json({ error: 'Attempt not found' });

  const test = Array.isArray(attempt.tests) ? attempt.tests[0] : attempt.tests;
  const elapsedSecs = Math.floor((Date.now() - new Date(attempt.started_at)) / 1000);
  const totalSecs = (test?.duration_mins ?? 0) * 60;
  const timeRemaining = Math.max(0, totalSecs - elapsedSecs);

  return res.json({
    ...attempt,
    test_title: test?.title ?? null,
    test_subject: test?.subject ?? null,
    duration_mins: test?.duration_mins ?? null,
    time_remaining_seconds: timeRemaining,
  });
});

// ── POST /api/attempts/:id/heartbeat ─────────────────────────
router.post('/:id/heartbeat', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('attempts')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', req.user.id)
    .eq('status', 'in_progress');

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// ── PATCH /api/attempts/:id/integrity ────────────────────────
router.patch('/:id/integrity', async (req, res) => {
  const { id } = req.params;
  const { event, data } = req.body;

  if (!['tab_switch', 'focus_lost', 'telemetry'].includes(event)) {
    return res.status(400).json({ error: 'invalid event' });
  }

  // Helper to update a single attempt row with increments
  const updateAttempt = async (updates) => {
    // Since Supabase JS has no .increment(), we perform a raw patch or fetch-then-update
    const { data: current } = await supabase
      .from('attempts')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (!current) throw new Error('Attempt not found');

    const finalUpdates = {};
    for (const [k, v] of Object.entries(updates)) {
      finalUpdates[k] = (current[k] ?? 0) + v;
    }

    return supabase.from('attempts').update(finalUpdates).eq('id', id).select().single();
  };

  try {
    if (event === 'tab_switch' || event === 'focus_lost') {
      const field = event === 'tab_switch' ? 'tab_switches' : 'focus_lost_count';
      const { data: updated, error } = await updateAttempt({ [field]: 1 });
      if (error) throw error;
      return res.json({ ok: true, [field]: updated[field] });
    }

    if (event === 'telemetry') {
      // Global telemetry tracking (experimental)
      // We store this in the attempts table if columns exist, otherwise we just return ok
      // For now, let's just make sure it doesn't crash.
      // If we want to store it, we'd need attempt columns for backspace_count, etc.
      return res.json({ ok: true });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


// ── GET /api/attempts/:id/questions ──────────────────────────
router.get('/:id/questions', async (req, res) => {
  const { id: attemptId } = req.params;
  const userId = req.user.id;

  // Verify ownership and get attempt data
  const { data: attempt, error: aErr } = await supabase
    .from('attempts')
    .select('id, test_id, status, started_at, question_selection')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single();

  if (aErr || !attempt) return res.status(404).json({ error: 'Attempt not found' });

  const questionIds = attempt.question_selection ?? [];
  if (!questionIds.length) return res.json({ questions: [] });

  // Fetch question bank rows (no correct_code, no diff_json)
  const { data: qRows, error: qErr } = await supabase
    .from('question_bank')
    .select('id, type, statement, statement_image_url, marks, language, bug_count')
    .in('id', questionIds);

  if (qErr) return res.status(500).json({ error: qErr.message });

  // Fetch test_questions for unlock_at_minutes
  const { data: tqRows } = await supabase
    .from('test_questions')
    .select('question_id, unlock_at_minutes')
    .eq('test_id', attempt.test_id)
    .in('question_id', questionIds);

  const unlockMap = Object.fromEntries(
    (tqRows ?? []).map(r => [r.question_id, r.unlock_at_minutes ?? 0])
  );

  // Fetch option shuffles for MCQ questions
  const { data: shuffleRows } = await supabase
    .from('option_shuffle')
    .select('question_id, shuffled_order')
    .eq('attempt_id', attemptId)
    .in('question_id', questionIds);

  const shuffleMap = Object.fromEntries(
    (shuffleRows ?? []).map(r => [r.question_id, r.shuffled_order])
  );

  // Fetch all MCQ options for MCQ questions (no is_correct)
  const mcqIds = (qRows ?? [])
    .filter(q => q.type === 'mcq_single' || q.type === 'mcq_multi')
    .map(q => q.id);

  let optionsMap = {};
  if (mcqIds.length) {
    const { data: optRows } = await supabase
      .from('mcq_options')
      .select('id, question_id, option_text, option_image_url, display_order')
      .in('question_id', mcqIds);

    // Group by question_id
    (optRows ?? []).forEach(o => {
      if (!optionsMap[o.question_id]) optionsMap[o.question_id] = [];
      optionsMap[o.question_id].push(o);
    });
  }

  // Fetch variant assignments for debugging questions
  const debugIds = (qRows ?? [])
    .filter(q => q.type === 'debugging')
    .map(q => q.id);

  let variantMap = {};
  if (debugIds.length) {
    const { data: vaRows } = await supabase
      .from('variant_assignments')
      .select('question_id, variant_id, debug_variants ( buggy_code, language )')
      .eq('attempt_id', attemptId)
      .in('question_id', debugIds);

    (vaRows ?? []).forEach(va => {
      const dv = Array.isArray(va.debug_variants) ? va.debug_variants[0] : va.debug_variants;
      variantMap[va.question_id] = {
        variant_id: va.variant_id,
        buggy_code: dv?.buggy_code ?? null,
        language: dv?.language ?? null,
      };
    });
  }

  // Fetch existing responses for this attempt
  const { data: responseRows } = await supabase
    .from('responses')
    .select('question_id, selected_option_ids, submitted_code, language, time_spent_seconds')
    .eq('attempt_id', attemptId);

  const responseMap = Object.fromEntries(
    (responseRows ?? []).map(r => [r.question_id, r])
  );

  // Build ordered question list
  const qMap = Object.fromEntries((qRows ?? []).map(q => [q.id, q]));

  const questions = questionIds.map(qid => {
    const q = qMap[qid];
    if (!q) return null;

    const base = {
      id: q.id,
      type: q.type,
      statement: q.statement,
      statement_image_url: q.statement_image_url ?? null,
      marks: q.marks,
      unlock_at_minutes: unlockMap[qid] ?? 0,
      saved_response: responseMap[qid] ?? null,
    };

    if (q.type === 'mcq_single' || q.type === 'mcq_multi') {
      const allOptions = optionsMap[qid] ?? [];
      const shuffledIds = shuffleMap[qid] ?? allOptions.map(o => o.id);
      // Return options in shuffled order, strip is_correct
      const optById = Object.fromEntries(allOptions.map(o => [o.id, o]));
      const options = shuffledIds
        .map(oid => optById[oid])
        .filter(Boolean)
        .map(o => ({ id: o.id, option_text: o.option_text, option_image_url: o.option_image_url }));

      return { ...base, options };
    }

    if (q.type === 'debugging') {
      const v = variantMap[qid];
      return {
        ...base,
        buggy_code: v?.buggy_code ?? null,
        language: v?.language ?? q.language ?? null,
        variant_id: v?.variant_id ?? null,
      };
    }

    return base;
  }).filter(Boolean);

  return res.json({ questions });
});

// ── POST /api/attempts/:id/responses ─────────────────────────
router.post('/:id/responses', async (req, res) => {
  const { id: attemptId } = req.params;
  const {
    question_id, selected_option_ids, submitted_code,
    language, time_spent_seconds, behavioral_meta,
  } = req.body;

  if (!question_id) return res.status(400).json({ error: 'question_id is required' });

  // Verify attempt ownership and in_progress status
  const { data: attempt } = await supabase
    .from('attempts')
    .select('id, status')
    .eq('id', attemptId)
    .eq('user_id', req.user.id)
    .single();

  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  if (attempt.status !== 'in_progress') {
    return res.status(400).json({ error: 'Attempt is not in progress' });
  }

  // Check if response already exists (upsert)
  const { data: existing } = await supabase
    .from('responses')
    .select('id')
    .eq('attempt_id', attemptId)
    .eq('question_id', question_id)
    .maybeSingle();

  const payload = {
    attempt_id: attemptId,
    question_id,
    selected_option_ids: selected_option_ids ?? null,
    submitted_code: submitted_code ?? null,
    language: language ?? null,
    time_spent_seconds: time_spent_seconds ?? null,
    behavioral_meta: behavioral_meta ?? null,
  };

  let error;
  if (existing) {
    ({ error } = await supabase
      .from('responses')
      .update(payload)
      .eq('id', existing.id));
  } else {
    ({ error } = await supabase.from('responses').insert(payload));
  }

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// ── GET /api/attempts/:id/result — full result breakdown ─────
router.get('/:id/result', async (req, res) => {
  const { id: attemptId } = req.params;
  const requestingUser = req.user;

  // Fetch attempt — allow owner OR admin
  const { data: attempt, error: aErr } = await supabase
    .from('attempts')
    .select('id, test_id, user_id, status, started_at, submitted_at, question_selection')
    .eq('id', attemptId)
    .single();

  if (aErr || !attempt) return res.status(404).json({ error: 'Attempt not found' });

  const isOwner = attempt.user_id === requestingUser.id;
  const isAdmin = ['admin', 'super_admin', 'master_admin'].includes(requestingUser.role);
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

  // Must be submitted
  if (!['submitted', 'auto_submitted'].includes(attempt.status)) {
    return res.status(400).json({ error: 'Attempt not yet submitted' });
  }

  // Fetch result row
  const { data: result } = await supabase
    .from('results')
    .select('total_score, total_marks, percentage, rank, integrity_score, pass_fail_overall, computed_at')
    .eq('attempt_id', attemptId)
    .single();

  // Fetch test info
  const { data: test } = await supabase
    .from('tests')
    .select('title, subject, total_marks, duration_mins')
    .eq('id', attempt.test_id)
    .single();

  // Time taken
  const timeTakenMins = attempt.started_at && attempt.submitted_at
    ? Math.round((new Date(attempt.submitted_at) - new Date(attempt.started_at)) / 60000)
    : null;

  // Fetch responses
  const { data: responses } = await supabase
    .from('responses')
    .select(`
      question_id, selected_option_ids, submitted_code, language,
      is_correct, marks_awarded,
      visible_cases_passed, visible_cases_total,
      hidden_cases_passed, hidden_cases_total,
      time_spent_seconds
    `)
    .eq('attempt_id', attemptId);

  const respMap = Object.fromEntries((responses ?? []).map(r => [r.question_id, r]));

  // Fetch questions
  const questionIds = attempt.question_selection ?? [];
  const { data: questions } = await supabase
    .from('question_bank')
    .select('id, type, statement, marks, topic_tag, language')
    .in('id', questionIds);

  const qMap = Object.fromEntries((questions ?? []).map(q => [q.id, q]));

  // Fetch MCQ options WITH is_correct (post-submission, safe to reveal)
  const mcqIds = (questions ?? [])
    .filter(q => q.type === 'mcq_single' || q.type === 'mcq_multi')
    .map(q => q.id);

  let optionsMap = {};
  if (mcqIds.length) {
    const { data: opts } = await supabase
      .from('mcq_options')
      .select('id, question_id, option_text, is_correct, display_order')
      .in('question_id', mcqIds)
      .order('display_order');

    (opts ?? []).forEach(o => {
      if (!optionsMap[o.question_id]) optionsMap[o.question_id] = [];
      optionsMap[o.question_id].push(o);
    });
  }

  // Build per-question breakdown in selection order
  const breakdown = questionIds.map((qid, idx) => {
    const q = qMap[qid];
    const resp = respMap[qid];
    if (!q) return null;

    const base = {
      number: idx + 1,
      question_id: qid,
      type: q.type,
      statement: q.statement,
      topic_tag: q.topic_tag ?? null,
      marks_total: Number(q.marks),
      marks_awarded: resp ? Number(resp.marks_awarded ?? 0) : 0,
      is_correct: resp?.is_correct ?? false,
      time_spent_seconds: resp?.time_spent_seconds ?? null,
      answered: !!resp,
    };

    if (q.type === 'mcq_single' || q.type === 'mcq_multi') {
      const options = optionsMap[qid] ?? [];
      return {
        ...base,
        selected_option_ids: resp?.selected_option_ids ?? [],
        options: options.map(o => ({
          id: o.id,
          option_text: o.option_text,
          is_correct: o.is_correct,
          was_selected: (resp?.selected_option_ids ?? []).includes(o.id),
        })),
      };
    }

    if (q.type === 'debugging') {
      return {
        ...base,
        submitted_code: resp?.submitted_code ?? null,
        language: resp?.language ?? q.language,
        visible_cases_passed: resp?.visible_cases_passed ?? 0,
        visible_cases_total: resp?.visible_cases_total ?? 0,
        hidden_cases_passed: resp?.hidden_cases_passed ?? 0,
        hidden_cases_total: resp?.hidden_cases_total ?? 0,
      };
    }

    return base;
  }).filter(Boolean);

  // Compute section scores
  const mcqBreakdown = breakdown.filter(q => q.type === 'mcq_single' || q.type === 'mcq_multi');
  const debugBreakdown = breakdown.filter(q => q.type === 'debugging');

  const mcqScore = mcqBreakdown.reduce((s, q) => s + q.marks_awarded, 0);
  const mcqTotal = mcqBreakdown.reduce((s, q) => s + q.marks_total, 0);
  const debugScore = debugBreakdown.reduce((s, q) => s + q.marks_awarded, 0);
  const debugTotal = debugBreakdown.reduce((s, q) => s + q.marks_total, 0);

  return res.json({
    attempt: {
      id: attemptId,
      test_title: test?.title ?? null,
      test_subject: test?.subject ?? null,
      submitted_at: attempt.submitted_at,
      time_taken_mins: timeTakenMins,
      status: attempt.status,
    },
    result: {
      total_score: result?.total_score ?? 0,
      total_marks: result?.total_marks ?? test?.total_marks ?? 0,
      percentage: result?.percentage ?? 0,
      rank: result?.rank ?? null,
      pass_fail_overall: result?.pass_fail_overall ?? false,
      // integrity_score only for admins
      ...(isAdmin ? { integrity_score: result?.integrity_score ?? null } : {}),
    },
    section_scores: { mcqScore, mcqTotal, debugScore, debugTotal },
    breakdown,
  });
});

// ── GET /api/attempts/test/:testId/integrity/me — student's own integrity ─────────
router.get('/test/:testId/integrity/me', async (req, res) => {
  const { testId } = req.params;
  const userId = req.user.id;

  const { data: attempt, error } = await supabase
    .from('attempts')
    .select(`
      id, tab_switches, focus_lost_count, started_at, submitted_at, status,
      results ( total_score, total_marks, percentage, integrity_score )
    `)
    .eq('test_id', testId)
    .eq('user_id', userId)
    .single();

  if (error || !attempt) return res.status(404).json({ error: 'Integrity data not found for this test.' });

  const result = Array.isArray(attempt.results) ? attempt.results[0] : attempt.results;

  // Fetch behavioral detail if needed or just flags
  const { data: flags } = await supabase.from('behavioral_flags').select('type, label, question_id').eq('attempt_id', attempt.id);
  const { data: details } = await supabase.from('behavioral_details').select('*').eq('attempt_id', attempt.id);

  return res.json({
    attempt_id: attempt.id,
    tab_switches: attempt.tab_switches,
    focus_lost_count: attempt.focus_lost_count,
    integrity_score: result?.integrity_score ?? 100,
    behavioral_flags: flags ?? [],
    behavioral_detail: details ?? [],
    total_score: result?.total_score,
    total_marks: result?.total_marks,
    percentage: result?.percentage,
  });
});

// ── GET /api/attempts/my — student's past attempts + absentees ────
router.get('/my', async (req, res) => {
  const { id: userId, year, division } = req.user;

  // 1. Fetch all submitted attempts with joined test + result data
  const { data: attempts, error: aErr } = await supabase
    .from('attempts')
    .select(`
      id, test_id, status, started_at, submitted_at,
      tests ( id, title, subject, end_time, total_marks ),
      results ( total_score, total_marks, percentage, rank )
    `)
    .eq('user_id', userId)
    .in('status', ['submitted', 'auto_submitted'])
    .order('submitted_at', { ascending: false });

  if (aErr) return res.status(500).json({ error: aErr.message });

  const attemptedTestIds = (attempts ?? []).map(a => a.test_id);

  // 2. Fetch ENDED tests assigned to this student that they MISSED
  let missedQuery = supabase
    .from('tests')
    .select('id, title, subject, end_time, total_marks')
    .eq('year', year)
    .in('division', [division, 'ALL'])
    .eq('status', 'ended');

  // Exclude tests already attempted — use array filter (safe for empty arrays)
  if (attemptedTestIds.length > 0) {
    missedQuery = missedQuery.not('id', 'in', `(${attemptedTestIds.map(id => `'${id}'`).join(',')})`);
  }

  const { data: missedTests, error: mErr } = await missedQuery;
  if (mErr) return res.status(500).json({ error: mErr.message });

  // 3. Build unified history — submitted attempts + absent records
  const submittedHistory = (attempts ?? []).map(a => {
    const result = Array.isArray(a.results) ? a.results[0] : a.results;
    const test   = Array.isArray(a.tests)   ? a.tests[0]   : a.tests;
    return {
      id:           a.id,
      test_id:      a.test_id,
      test_title:   test?.title   ?? 'Unknown',
      test_subject: test?.subject ?? null,
      status:       a.status,
      submitted_at: a.submitted_at,
      total_score:  result?.total_score  ?? 0,
      total_marks:  result?.total_marks  ?? test?.total_marks ?? 0,
      percentage:   result?.percentage   ?? 0,
    };
  });

  const absentHistory = (missedTests ?? []).map(t => ({
    id:           null,
    test_id:      t.id,
    test_title:   t.title,
    test_subject: t.subject,
    status:       'absent',
    submitted_at: t.end_time,
    total_score:  0,
    total_marks:  t.total_marks ?? 0,
    percentage:   0,
  }));

  const history = [...submittedHistory, ...absentHistory]
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

  return res.json({ attempts: history });
});

// ── POST /api/attempts/:id/submit ────────────────────────────
router.post('/:id/submit', async (req, res) => {
  const { id: attemptId } = req.params;
  const { auto = false } = req.body;
  const userId = req.user.id;

  // ── 1. Verify attempt ─────────────────────────────────────
  const { data: attempt, error: aErr } = await supabase
    .from('attempts')
    .select('id, test_id, status, started_at, question_selection')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single();

  if (aErr || !attempt) return res.status(404).json({ error: 'Attempt not found' });
  if (attempt.status !== 'in_progress') {
    // Idempotent: already submitted — return existing result
    const { data: existing } = await supabase
      .from('results')
      .select('total_score, total_marks, percentage')
      .eq('attempt_id', attemptId)
      .maybeSingle();
    return res.json({ attempt_id: attemptId, ...existing, redirect: `/results/${attemptId}` });
  }

  // ── 2. Mark attempt submitted immediately ─────────────────
  const submittedAt = new Date().toISOString();
  const newStatus = auto ? 'auto_submitted' : 'submitted';

  await supabase
    .from('attempts')
    .update({ status: newStatus, submitted_at: submittedAt })
    .eq('id', attemptId);

  // ── 3. Fetch test for total_marks ─────────────────────────
  const { data: test } = await supabase
    .from('tests')
    .select('total_marks')
    .eq('id', attempt.test_id)
    .single();

  const totalMarks = Number(test?.total_marks ?? 0);

  // ── 4. Fetch all responses for this attempt ───────────────
  const { data: responses } = await supabase
    .from('responses')
    .select('id, question_id, selected_option_ids, submitted_code, language')
    .eq('attempt_id', attemptId);

  if (!responses?.length) {
    // No responses — insert zero result
    await supabase.from('results').insert({
      attempt_id: attemptId,
      total_score: 0,
      total_marks: totalMarks,
      percentage: 0,
      pass_fail_overall: false,
    });
    return res.json({ attempt_id: attemptId, total_score: 0, percentage: 0, redirect: `/results/${attemptId}` });
  }

  // ── 5. Fetch question metadata for all responded questions ─
  const questionIds = responses.map(r => r.question_id);

  const { data: questions } = await supabase
    .from('question_bank')
    .select('id, type, marks, language')
    .in('id', questionIds);

  const qMap = Object.fromEntries((questions ?? []).map(q => [q.id, q]));

  // ── 6. Fetch correct options for MCQ questions ────────────
  const mcqIds = (questions ?? [])
    .filter(q => q.type === 'mcq_single' || q.type === 'mcq_multi')
    .map(q => q.id);

  let correctOptionsMap = {};
  if (mcqIds.length) {
    const { data: opts } = await supabase
      .from('mcq_options')
      .select('id, question_id, is_correct')
      .in('question_id', mcqIds);

    (opts ?? []).forEach(o => {
      if (!correctOptionsMap[o.question_id]) correctOptionsMap[o.question_id] = [];
      correctOptionsMap[o.question_id].push(o);
    });
  }

  // ── 7. Fetch test cases for debugging questions ───────────
  const debugIds = (questions ?? [])
    .filter(q => q.type === 'debugging')
    .map(q => q.id);

  let testCasesMap = {};
  if (debugIds.length) {
    const { data: tcs } = await supabase
      .from('test_cases')
      .select('question_id, input, expected_output, is_hidden')
      .in('question_id', debugIds);

    (tcs ?? []).forEach(tc => {
      if (!testCasesMap[tc.question_id]) testCasesMap[tc.question_id] = [];
      testCasesMap[tc.question_id].push(tc);
    });
  }

  // ── 8. Evaluate each response ─────────────────────────────
  let totalScore = 0;
  const responseUpdates = [];

  for (const resp of responses) {
    const q = qMap[resp.question_id];
    if (!q) continue;

    if (q.type === 'mcq_single' || q.type === 'mcq_multi') {
      const correctOptions = correctOptionsMap[q.id] ?? [];
      const { is_correct, marks_awarded } = evaluateMCQ(
        q.type,
        resp.selected_option_ids ?? [],
        correctOptions,
        q.marks
      );
      totalScore += marks_awarded;
      responseUpdates.push({ id: resp.id, is_correct, marks_awarded });

    } else if (q.type === 'debugging') {
      const code = resp.submitted_code ?? '';
      const language = resp.language ?? q.language ?? 'python';
      const testCases = testCasesMap[q.id] ?? [];

      if (!code.trim() || !testCases.length) {
        responseUpdates.push({
          id: resp.id, is_correct: false, marks_awarded: 0,
          visible_cases_passed: 0, visible_cases_total: testCases.filter(t => !t.is_hidden).length,
          hidden_cases_passed: 0, hidden_cases_total: testCases.filter(t => t.is_hidden).length,
        });
        continue;
      }

      const result = await evaluateDebugging(code, language, testCases, q.marks);
      totalScore += result.marks_awarded;
      responseUpdates.push({ id: resp.id, is_correct: result.hidden_cases_passed === result.hidden_cases_total && result.hidden_cases_total > 0, ...result });
    }
  }

  // ── 9. Batch update responses ─────────────────────────────
  for (const upd of responseUpdates) {
    const { id, ...fields } = upd;
    await supabase.from('responses').update(fields).eq('id', id);
  }

  // ── 10. Insert result (integrity_score computed by trigger) ─
  totalScore = Math.round(totalScore * 100) / 100;
  const percentage = totalMarks > 0
    ? Math.round((totalScore / totalMarks) * 10000) / 100
    : 0;

  const { error: resultErr } = await supabase.from('results').insert({
    attempt_id: attemptId,
    total_score: totalScore,
    total_marks: totalMarks,
    percentage,
    pass_fail_overall: percentage >= 40,
  });

  if (resultErr) {
    // If duplicate (race condition), ignore
    if (!resultErr.message.includes('duplicate')) {
      return res.status(500).json({ error: resultErr.message });
    }
  }

  return res.json({
    attempt_id: attemptId,
    total_score: totalScore,
    total_marks: totalMarks,
    percentage,
    redirect: `/results/${attemptId}`,
  });
});

export default router;
