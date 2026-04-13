import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { tokenise, jaccardSimilarity } from '../lib/similarity.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const SIMILARITY_THRESHOLD = 0.80;

// ── GET /admin/tests/:id/integrity ───────────────────────────
router.get('/tests/:id/integrity', async (req, res) => {
  const { id: testId } = req.params;

  const { data: test, error: testErr } = await supabase
    .from('tests')
    .select('id, title, created_by')
    .eq('id', testId)
    .single();

  if (testErr || !test) return res.status(404).json({ error: 'Test not found' });
  // Ownership check removed for admin testing

  // Fetch all submitted attempts with user info + result integrity_score
  const { data: attempts, error: aErr } = await supabase
    .from('attempts')
    .select(`
      id, tab_switches, focus_lost_count, started_at, submitted_at,
      users ( id, name, email, division, year ),
      results ( integrity_score, total_score, total_marks, percentage )
    `)
    .eq('test_id', testId)
    .in('status', ['submitted', 'auto_submitted'])
    .order('id');

  if (aErr) return res.status(500).json({ error: aErr.message });
  if (!attempts?.length) return res.json({ attempts: [], summary: { total: 0, avg_integrity: 0, high_risk: 0, similarity_flags: 0 } });

  const attemptIds = attempts.map(a => a.id);

  // Fetch behavioral_meta from responses (coding questions only)
  const { data: responses } = await supabase
    .from('responses')
    .select('attempt_id, question_id, behavioral_meta, submitted_code, time_spent_seconds, question_bank(type)')
    .in('attempt_id', attemptIds)
    .not('behavioral_meta', 'is', null);

  // Group responses by attempt
  const respByAttempt = {};
  (responses ?? []).forEach(r => {
    const qb = Array.isArray(r.question_bank) ? r.question_bank[0] : r.question_bank;
    const enriched = { ...r, question_type: qb?.type ?? null };
    if (!respByAttempt[r.attempt_id]) respByAttempt[r.attempt_id] = [];
    respByAttempt[r.attempt_id].push(enriched);
  });

  // Fetch similarity flag counts per attempt
  const { data: simFlags } = await supabase
    .from('similarity_flags')
    .select('attempt_id_1, attempt_id_2, admin_verdict')
    .eq('test_id', testId);

  const simFlagCount = {};
  (simFlags ?? []).forEach(f => {
    if (f.admin_verdict !== 'dismissed') {
      simFlagCount[f.attempt_id_1] = (simFlagCount[f.attempt_id_1] ?? 0) + 1;
      simFlagCount[f.attempt_id_2] = (simFlagCount[f.attempt_id_2] ?? 0) + 1;
    }
  });

  // Compute behavioral flags per attempt (with severity)
  function computeBehavioralFlags(attemptResponses, tabSwitches, focusLost) {
    const flags = [];
    for (const resp of (attemptResponses ?? [])) {
      const m = resp.behavioral_meta;
      if (!m) continue;
      const codeLen = (resp.submitted_code ?? '').length;

      if ((m.paste_events ?? 0) >= 1)
        flags.push({ type: 'paste', severity: 'high', label: `Paste event detected (${m.paste_events}×)`, question_id: resp.question_id });

      if ((m.backspace_count ?? 99) <= 2 && (m.wpm_consistency ?? 0) > 100)
        flags.push({ type: 'no_corrections', severity: 'high', label: 'No corrections at high WPM — likely pre-typed', question_id: resp.question_id });
      else if ((m.backspace_count ?? 99) === 0 && codeLen > 100)
        flags.push({ type: 'no_backspace', severity: 'medium', label: 'No backspaces on long submission', question_id: resp.question_id });

      if (m.time_to_first_keystroke !== null && m.time_to_first_keystroke < 3000)
        flags.push({ type: 'fast_start', severity: 'high', label: 'Typed within 3s of opening question', question_id: resp.question_id });
      else if (m.time_to_first_keystroke !== null && m.time_to_first_keystroke < 8000)
        flags.push({ type: 'fast_start', severity: 'medium', label: 'Typed within 8s of opening question', question_id: resp.question_id });

      if ((m.wpm_consistency ?? 0) > 120)
        flags.push({ type: 'high_wpm', severity: 'medium', label: `Extreme typing speed (${Math.round(m.wpm_consistency)} WPM)`, question_id: resp.question_id });

      if ((m.test_runs_before_submit ?? 1) === 0 && codeLen > 50)
        flags.push({ type: 'no_test_run', severity: 'medium', label: 'Submitted without running visible test cases', question_id: resp.question_id });

      const longIdlePeriods = (m.idle_periods ?? []).filter(p => (p.duration_seconds ?? p.duration ?? 0) > 180);
      if (longIdlePeriods.length > 0)
        flags.push({ type: 'long_idle', severity: 'medium', label: `${longIdlePeriods.length} idle period(s) >3 min detected`, question_id: resp.question_id });
    }

    if ((tabSwitches ?? 0) >= 5)
      flags.push({ type: 'tab_switch', severity: 'high', label: `Excessive tab switches (${tabSwitches}×)`, question_id: null });
    else if ((tabSwitches ?? 0) >= 2)
      flags.push({ type: 'tab_switch', severity: 'medium', label: `Tab switches detected (${tabSwitches}×)`, question_id: null });

    if ((focusLost ?? 0) >= 5)
      flags.push({ type: 'focus_loss', severity: 'medium', label: `Window focus lost ${focusLost} times`, question_id: null });

    return flags;
  }

  // Build enriched attempt rows
  const enriched = attempts.map(a => {
    const user   = Array.isArray(a.users)   ? a.users[0]   : a.users;
    const result = Array.isArray(a.results) ? a.results[0] : a.results;
    const attemptResps   = respByAttempt[a.id] ?? [];
    const behavioralFlags = computeBehavioralFlags(attemptResps, a.tab_switches, a.focus_lost_count);

    // Per-question behavioral detail for expanded view
    const behavioralDetail = attemptResps.map(r => ({
      question_id:             r.question_id,
      question_type:           r.question_type ?? null,
      time_to_first_keystroke: r.behavioral_meta?.time_to_first_keystroke ?? null,
      paste_events:            r.behavioral_meta?.paste_events            ?? 0,
      backspace_count:         r.behavioral_meta?.backspace_count         ?? 0,
      edit_count:              r.behavioral_meta?.edit_count              ?? 0,
      wpm_consistency:         r.behavioral_meta?.wpm_consistency         ?? 0,
      test_runs_before_submit: r.behavioral_meta?.test_runs_before_submit ?? 0,
      idle_periods:            r.behavioral_meta?.idle_periods            ?? [],
      time_spent_seconds:      r.time_spent_seconds                       ?? null,
    }));

    return {
      attempt_id:        a.id,
      student_name:      user?.name     ?? 'Unknown',
      student_email:     user?.email    ?? '',
      division:          user?.division ?? '—',
      year:              user?.year     ?? '—',
      tab_switches:      a.tab_switches     ?? 0,
      focus_lost_count:  a.focus_lost_count ?? 0,
      integrity_score:   result?.integrity_score ?? null,
      total_score:       result?.total_score     ?? null,
      total_marks:       result?.total_marks     ?? null,
      percentage:        result?.percentage      ?? null,
      similarity_flag_count: simFlagCount[a.id] ?? 0,
      behavioral_flags:  behavioralFlags,
      behavioral_detail: behavioralDetail,
    };
  });

  // Summary stats
  const withScore    = enriched.filter(a => a.integrity_score !== null);
  const avgIntegrity = withScore.length
    ? Math.round(withScore.reduce((s, a) => s + a.integrity_score, 0) / withScore.length)
    : 0;
  const highRisk     = withScore.filter(a => a.integrity_score < 60).length;
  const totalSimFlags = Object.values(simFlagCount).reduce((s, v) => s + v, 0) / 2; // each flag counted twice

  return res.json({
    test_title: test.title,
    attempts:   enriched,
    summary: {
      total:           enriched.length,
      avg_integrity:   avgIntegrity,
      high_risk:       highRisk,
      similarity_flags: Math.round(totalSimFlags),
    },
  });
});

// ── POST /admin/tests/:id/run-similarity ──────────────────────
router.post('/tests/:id/run-similarity', async (req, res) => {
  const { id: testId } = req.params;

  // Verify admin owns this test
  const { data: test, error: testErr } = await supabase
    .from('tests')
    .select('id, title, created_by')
    .eq('id', testId)
    .single();

  if (testErr || !test) return res.status(404).json({ error: 'Test not found' });
  // Ownership check removed for admin testing

  // 1. Fetch all submitted attempts for this test
  const { data: attempts, error: aErr } = await supabase
    .from('attempts')
    .select('id, user_id, users ( name, email )')
    .eq('test_id', testId)
    .in('status', ['submitted', 'auto_submitted']);

  if (aErr) return res.status(500).json({ error: aErr.message });
  if (!attempts?.length) return res.json({ pairs_analyzed: 0, flags_raised: 0, flags: [] });

  const attemptIds  = attempts.map(a => a.id);
  const attemptMeta = Object.fromEntries(attempts.map(a => {
    const u = Array.isArray(a.users) ? a.users[0] : a.users;
    return [a.id, { user_id: a.user_id, name: u?.name ?? 'Unknown', email: u?.email ?? '' }];
  }));

  // 2. Fetch debugging responses with variant assignments
  const { data: responses, error: rErr } = await supabase
    .from('responses')
    .select('id, attempt_id, question_id, submitted_code, language')
    .in('attempt_id', attemptIds)
    .not('submitted_code', 'is', null);

  if (rErr) return res.status(500).json({ error: rErr.message });

  // Fetch variant assignments for these attempt+question combos
  const { data: variantAssignments } = await supabase
    .from('variant_assignments')
    .select('attempt_id, question_id, variant_id')
    .in('attempt_id', attemptIds);

  const variantKey = (attemptId, questionId) => `${attemptId}::${questionId}`;
  const variantMap = Object.fromEntries(
    (variantAssignments ?? []).map(va => [variantKey(va.attempt_id, va.question_id), va.variant_id])
  );

  // Fetch question info for debugging questions only
  const questionIds = [...new Set((responses ?? []).map(r => r.question_id))];
  const { data: questions } = await supabase
    .from('question_bank')
    .select('id, type, statement, language')
    .in('id', questionIds)
    .eq('type', 'debugging');

  const debugQIds = new Set((questions ?? []).map(q => q.id));
  const qMeta     = Object.fromEntries((questions ?? []).map(q => [q.id, q]));

  // Filter to debugging responses only
  const debugResponses = (responses ?? []).filter(r => debugQIds.has(r.question_id));

  // 3. Group by (question_id + variant_id)
  const groups = new Map(); // key → [{ attempt_id, submitted_code, language }]
  for (const resp of debugResponses) {
    const vid = variantMap[variantKey(resp.attempt_id, resp.question_id)];
    if (!vid) continue; // no variant assignment — skip
    const key = `${resp.question_id}::${vid}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      attempt_id:     resp.attempt_id,
      question_id:    resp.question_id,
      submitted_code: resp.submitted_code,
      language:       resp.language ?? qMeta[resp.question_id]?.language ?? 'python',
    });
  }

  // 4. Pairwise Jaccard similarity within each group
  let pairsAnalyzed = 0;
  const newFlags    = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairsAnalyzed++;
        const a = group[i];
        const b = group[j];

        const tokA = tokenise(a.submitted_code, a.language);
        const tokB = tokenise(b.submitted_code, b.language);
        const score = jaccardSimilarity(tokA, tokB);

        if (score >= SIMILARITY_THRESHOLD) {
          newFlags.push({
            test_id:          testId,
            attempt_id_1:     a.attempt_id,
            attempt_id_2:     b.attempt_id,
            question_id:      a.question_id,
            similarity_score: Math.round(score * 10000) / 10000,
          });
        }
      }
    }
  }

  // 5. Insert flags (skip duplicates)
  let flagsRaised = 0;
  const flagDetails = [];

  for (const flag of newFlags) {
    // Check if flag already exists for this pair+question
    const { data: existing } = await supabase
      .from('similarity_flags')
      .select('id')
      .eq('test_id', flag.test_id)
      .eq('question_id', flag.question_id)
      .or(`and(attempt_id_1.eq.${flag.attempt_id_1},attempt_id_2.eq.${flag.attempt_id_2}),and(attempt_id_1.eq.${flag.attempt_id_2},attempt_id_2.eq.${flag.attempt_id_1})`)
      .maybeSingle();

    if (existing) continue; // already flagged

    const { error: insertErr } = await supabase.from('similarity_flags').insert(flag);
    if (!insertErr) {
      flagsRaised++;
      const m1 = attemptMeta[flag.attempt_id_1];
      const m2 = attemptMeta[flag.attempt_id_2];
      flagDetails.push({
        attempt_id_1:     flag.attempt_id_1,
        attempt_id_2:     flag.attempt_id_2,
        student1:         m1?.name ?? 'Unknown',
        student2:         m2?.name ?? 'Unknown',
        question:         qMeta[flag.question_id]?.statement?.slice(0, 80) ?? flag.question_id,
        question_id:      flag.question_id,
        similarity_score: flag.similarity_score,
      });
    }
  }

  return res.json({ pairs_analyzed: pairsAnalyzed, flags_raised: flagsRaised, flags: flagDetails });
});

// ── GET /admin/tests/:id/similarity-flags ─────────────────────
router.get('/tests/:id/similarity-flags', async (req, res) => {
  const { id: testId } = req.params;

  const { data: test } = await supabase
    .from('tests')
    .select('id, created_by')
    .eq('id', testId)
    .single();

  if (!test) return res.status(404).json({ error: 'Test not found' });
  // Ownership check removed for admin testing

  const { data: flags, error } = await supabase
    .from('similarity_flags')
    .select(`
      id, similarity_score, admin_verdict, reviewed, flagged_at,
      attempt_id_1, attempt_id_2, question_id,
      question_bank ( statement )
    `)
    .eq('test_id', testId)
    .order('similarity_score', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Enrich with student names + submitted code
  const allAttemptIds = [
    ...new Set(flags.flatMap(f => [f.attempt_id_1, f.attempt_id_2]))
  ];

  const { data: attempts } = await supabase
    .from('attempts')
    .select('id, user_id, users ( name, email )')
    .in('id', allAttemptIds);

  const attemptMeta = Object.fromEntries((attempts ?? []).map(a => {
    const u = Array.isArray(a.users) ? a.users[0] : a.users;
    return [a.id, { user_id: a.user_id, name: u?.name ?? 'Unknown', email: u?.email ?? '' }];
  }));

  // Fetch submitted code for each flag pair
  const questionIds = [...new Set(flags.map(f => f.question_id))];
  const { data: responses } = await supabase
    .from('responses')
    .select('attempt_id, question_id, submitted_code, language')
    .in('attempt_id', allAttemptIds)
    .in('question_id', questionIds);

  const codeKey = (aid, qid) => `${aid}::${qid}`;
  const codeMap = Object.fromEntries(
    (responses ?? []).map(r => [codeKey(r.attempt_id, r.question_id), { code: r.submitted_code, language: r.language }])
  );

  const enriched = flags.map(f => {
    const q = Array.isArray(f.question_bank) ? f.question_bank[0] : f.question_bank;
    return {
      id:               f.id,
      similarity_score: f.similarity_score,
      admin_verdict:    f.admin_verdict,
      reviewed:         f.reviewed,
      flagged_at:       f.flagged_at,
      question_id:      f.question_id,
      question_statement: q?.statement?.slice(0, 100) ?? '',
      attempt_id_1:     f.attempt_id_1,
      attempt_id_2:     f.attempt_id_2,
      student1:         attemptMeta[f.attempt_id_1]?.name ?? 'Unknown',
      student2:         attemptMeta[f.attempt_id_2]?.name ?? 'Unknown',
      code1:            codeMap[codeKey(f.attempt_id_1, f.question_id)]?.code ?? null,
      code2:            codeMap[codeKey(f.attempt_id_2, f.question_id)]?.code ?? null,
      language:         codeMap[codeKey(f.attempt_id_1, f.question_id)]?.language ?? 'python',
    };
  });

  return res.json({ flags: enriched });
});

// ── PATCH /admin/flags/:id/verdict ────────────────────────────
router.patch('/flags/:id/verdict', async (req, res) => {
  const { id } = req.params;
  const { verdict } = req.body;

  if (!['confirmed', 'dismissed'].includes(verdict)) {
    return res.status(400).json({ error: 'verdict must be confirmed or dismissed' });
  }

  // Verify admin owns the test this flag belongs to
  const { data: flag } = await supabase
    .from('similarity_flags')
    .select('id, test_id')
    .eq('id', id)
    .single();

  if (!flag) return res.status(404).json({ error: 'Flag not found' });

  const { data: test } = await supabase
    .from('tests')
    .select('created_by')
    .eq('id', flag.test_id)
    .single();

  if (!test || (req.user.role !== 'master_admin' && test.created_by !== req.user.id)) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase
    .from('similarity_flags')
    .update({ admin_verdict: verdict, reviewed: true })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ flag: data });
});

export default router;
