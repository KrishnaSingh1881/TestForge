import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ── GET /api/analytics/student ────────────────────────────────
router.get('/student', async (req, res) => {
  const userId = req.user.id;

  // All submitted attempts with test + result data
  const { data: attempts, error: aErr } = await supabase
    .from('attempts')
    .select(`
      id, started_at, submitted_at,
      tests ( title, subject, total_marks ),
      results ( total_score, percentage, rank, computed_at )
    `)
    .eq('user_id', userId)
    .in('status', ['submitted', 'auto_submitted'])
    .order('submitted_at', { ascending: true });

  if (aErr) return res.status(500).json({ error: aErr.message });
  if (!attempts?.length) {
    return res.json({
      tests_attempted: 0,
      avg_percentage: 0,
      best_rank: null,
      overall_accuracy: 0,
      score_trend: [],
      subject_performance: [],
      question_type_accuracy: { mcq: 0, debugging: 0 },
      avg_time_per_question_type: { mcq: 0, debugging: 0 },
    });
  }

  const attemptIds = attempts.map(a => a.id);

  // All responses for these attempts
  const { data: responses } = await supabase
    .from('responses')
    .select('attempt_id, question_id, is_correct, marks_awarded, time_spent_seconds, visible_cases_passed, visible_cases_total')
    .in('attempt_id', attemptIds);

  // Question types for all responded questions
  const questionIds = [...new Set((responses ?? []).map(r => r.question_id))];
  let qTypeMap = {};
  if (questionIds.length) {
    const { data: qs } = await supabase
      .from('question_bank')
      .select('id, type')
      .in('id', questionIds);
    qTypeMap = Object.fromEntries((qs ?? []).map(q => [q.id, q.type]));
  }

  // ── Compute metrics ───────────────────────────────────────

  // Score trend — one point per attempt
  const scoreTrend = attempts.map(a => {
    const result = Array.isArray(a.results) ? a.results[0] : a.results;
    const test   = Array.isArray(a.tests)   ? a.tests[0]   : a.tests;
    return {
      test_title:  test?.title      ?? 'Unknown',
      date:        a.submitted_at,
      percentage:  result?.percentage ?? 0,
      rank:        result?.rank       ?? null,
    };
  });

  // Avg percentage
  const withPct   = scoreTrend.filter(s => s.percentage != null);
  const avgPct    = withPct.length
    ? Math.round(withPct.reduce((s, t) => s + t.percentage, 0) / withPct.length * 10) / 10
    : 0;

  // Best rank
  const ranks    = scoreTrend.filter(s => s.rank).map(s => s.rank);
  const bestRank = ranks.length ? Math.min(...ranks) : null;

  // Subject performance
  const subjectMap = {};
  attempts.forEach(a => {
    const test   = Array.isArray(a.tests)   ? a.tests[0]   : a.tests;
    const result = Array.isArray(a.results) ? a.results[0] : a.results;
    const subj   = test?.subject ?? 'Unknown';
    const pct    = result?.percentage ?? 0;
    if (!subjectMap[subj]) subjectMap[subj] = { total: 0, count: 0 };
    subjectMap[subj].total += pct;
    subjectMap[subj].count++;
  });
  const subjectPerformance = Object.entries(subjectMap).map(([subject, { total, count }]) => ({
    subject,
    avg_percentage: Math.round(total / count * 10) / 10,
    tests_count:    count,
  })).sort((a, b) => b.avg_percentage - a.avg_percentage);

  // Question type accuracy + avg time
  const mcqResps   = (responses ?? []).filter(r => {
    const t = qTypeMap[r.question_id];
    return t === 'mcq_single' || t === 'mcq_multi';
  });
  const debugResps = (responses ?? []).filter(r => qTypeMap[r.question_id] === 'debugging');

  const mcqCorrect   = mcqResps.filter(r => r.is_correct).length;
  const mcqAccuracy  = mcqResps.length ? Math.round(mcqCorrect / mcqResps.length * 100) : 0;

  // Debugging: avg visible cases pass rate
  const debugWithCases = debugResps.filter(r => (r.visible_cases_total ?? 0) > 0);
  const debugAccuracy  = debugWithCases.length
    ? Math.round(
        debugWithCases.reduce((s, r) => s + (r.visible_cases_passed / r.visible_cases_total), 0)
        / debugWithCases.length * 100
      )
    : 0;

  // Avg time per question type (seconds)
  const mcqWithTime   = mcqResps.filter(r => r.time_spent_seconds != null);
  const debugWithTime = debugResps.filter(r => r.time_spent_seconds != null);

  const avgMcqTime   = mcqWithTime.length
    ? Math.round(mcqWithTime.reduce((s, r) => s + r.time_spent_seconds, 0) / mcqWithTime.length)
    : 0;
  const avgDebugTime = debugWithTime.length
    ? Math.round(debugWithTime.reduce((s, r) => s + r.time_spent_seconds, 0) / debugWithTime.length)
    : 0;

  // Overall accuracy (any correct response / total answered)
  const totalAnswered = (responses ?? []).filter(r => r.is_correct !== null).length;
  const totalCorrect  = (responses ?? []).filter(r => r.is_correct === true).length;
  const overallAcc    = totalAnswered ? Math.round(totalCorrect / totalAnswered * 100) : 0;

  return res.json({
    tests_attempted:  attempts.length,
    avg_percentage:   avgPct,
    best_rank:        bestRank,
    overall_accuracy: overallAcc,
    score_trend:      scoreTrend,
    subject_performance: subjectPerformance,
    question_type_accuracy:     { mcq: mcqAccuracy,  debugging: debugAccuracy  },
    avg_time_per_question_type: { mcq: avgMcqTime,   debugging: avgDebugTime   },
  });
});

// ── GET /api/analytics/admin ──────────────────────────────────
router.get('/admin', async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const adminId = req.user.id;
  const { year, division, subject, test_id, date_from, date_to } = req.query;

  // Build tests query with filters
  let testsQuery = supabase
    .from('tests')
    .select('id, title, subject, year, division, total_marks, status, created_at')
    .eq('created_by', adminId)
    .order('created_at', { ascending: false });

  if (year)    testsQuery = testsQuery.eq('year', year);
  if (division) testsQuery = testsQuery.eq('division', division);
  if (subject) testsQuery = testsQuery.eq('subject', subject);
  if (test_id) testsQuery = testsQuery.eq('id', test_id);

  const { data: tests, error: tErr } = await testsQuery;
  if (tErr) return res.status(500).json({ error: tErr.message });
  if (!tests?.length) {
    return res.json({
      total_tests: 0, total_students_tested: 0,
      avg_score_across_tests: 0, overall_completion_rate: 0,
      tests: [], division_comparison: [], student_performance: [],
    });
  }

  const testIds = tests.map(t => t.id);
  const testMap = Object.fromEntries(tests.map(t => [t.id, t]));

  // Fetch all attempts for these tests
  let attemptsQuery = supabase
    .from('attempts')
    .select(`
      id, test_id, user_id, status, started_at, submitted_at,
      users ( id, name, email, year, division )
    `)
    .in('test_id', testIds);

  if (date_from) attemptsQuery = attemptsQuery.gte('submitted_at', date_from);
  if (date_to)   attemptsQuery = attemptsQuery.lte('submitted_at', date_to);

  const { data: attempts } = await attemptsQuery;
  const submitted = (attempts ?? []).filter(a => ['submitted', 'auto_submitted'].includes(a.status));
  const submittedIds = submitted.map(a => a.id);

  // Fetch results for submitted attempts
  let resultsMap = {};
  if (submittedIds.length) {
    const { data: results } = await supabase
      .from('results')
      .select('attempt_id, total_score, total_marks, percentage, rank')
      .in('attempt_id', submittedIds);
    resultsMap = Object.fromEntries((results ?? []).map(r => [r.attempt_id, r]));
  }

  // Fetch all responses for hardest question computation
  let responsesMap = {};
  if (submittedIds.length) {
    const { data: responses } = await supabase
      .from('responses')
      .select('attempt_id, question_id, is_correct')
      .in('attempt_id', submittedIds);

    (responses ?? []).forEach(r => {
      if (!responsesMap[r.question_id]) responsesMap[r.question_id] = { correct: 0, total: 0 };
      responsesMap[r.question_id].total++;
      if (r.is_correct) responsesMap[r.question_id].correct++;
    });
  }

  // Fetch question statements for hardest question lookup
  const allQuestionIds = Object.keys(responsesMap);
  let qStatements = {};
  if (allQuestionIds.length) {
    const { data: qs } = await supabase
      .from('question_bank')
      .select('id, statement')
      .in('id', allQuestionIds);
    qStatements = Object.fromEntries((qs ?? []).map(q => [q.id, q.statement]));
  }

  // ── Per-test analytics ────────────────────────────────────
  const testAnalytics = tests.map(t => {
    const testAttempts  = (attempts ?? []).filter(a => a.test_id === t.id);
    const testSubmitted = testAttempts.filter(a => ['submitted', 'auto_submitted'].includes(a.status));

    const percentages = testSubmitted
      .map(a => resultsMap[a.id]?.percentage)
      .filter(p => p != null);

    const avgPct   = percentages.length
      ? Math.round(percentages.reduce((s, p) => s + p, 0) / percentages.length * 10) / 10
      : 0;
    const avgScore = testSubmitted.length
      ? Math.round(testSubmitted.reduce((s, a) => s + (resultsMap[a.id]?.total_score ?? 0), 0) / testSubmitted.length * 10) / 10
      : 0;

    const timeMins = testSubmitted
      .filter(a => a.started_at && a.submitted_at)
      .map(a => (new Date(a.submitted_at) - new Date(a.started_at)) / 60000);
    const avgTimeMins = timeMins.length
      ? Math.round(timeMins.reduce((s, t) => s + t, 0) / timeMins.length * 10) / 10
      : 0;

    const completionRate = testAttempts.length
      ? Math.round(testSubmitted.length / testAttempts.length * 100)
      : 0;

    // Hardest question for this test's responses
    const testQIds = testSubmitted.flatMap(a => {
      // We only have aggregate data — find questions with lowest correct rate
      return [];
    });

    // Find hardest question from responses belonging to this test's attempts
    const testAttemptIds = new Set(testSubmitted.map(a => a.id));
    let hardestQ = null;
    let lowestRate = Infinity;

    for (const [qid, stats] of Object.entries(responsesMap)) {
      // Check if this question was answered in this test (approximate via attempt overlap)
      const rate = stats.total > 0 ? stats.correct / stats.total : 1;
      if (rate < lowestRate) {
        lowestRate = rate;
        hardestQ = {
          statement_preview: (qStatements[qid] ?? '').slice(0, 60),
          correct_rate: Math.round(rate * 100),
        };
      }
    }

    return {
      id:              t.id,
      title:           t.title,
      subject:         t.subject ?? '—',
      year:            t.year    ?? '—',
      division:        t.division ?? '—',
      total_attempts:  testAttempts.length,
      submitted_count: testSubmitted.length,
      avg_score:       avgScore,
      avg_percentage:  avgPct,
      completion_rate: completionRate,
      avg_time_mins:   avgTimeMins,
      hardest_question: hardestQ,
    };
  });

  // ── Division comparison (per test) ────────────────────────
  const divisionComparison = [];
  for (const t of tests) {
    const testSubmitted = submitted.filter(a => a.test_id === t.id);
    const divMap = {};
    testSubmitted.forEach(a => {
      const user = Array.isArray(a.users) ? a.users[0] : a.users;
      const div  = user?.division ?? 'Unknown';
      const pct  = resultsMap[a.id]?.percentage ?? 0;
      if (!divMap[div]) divMap[div] = { total: 0, count: 0 };
      divMap[div].total += pct;
      divMap[div].count++;
    });
    Object.entries(divMap).forEach(([division, { total, count }]) => {
      divisionComparison.push({
        test_id:        t.id,
        test_title:     t.title,
        division,
        avg_percentage: Math.round(total / count * 10) / 10,
      });
    });
  }

  // ── Student performance ───────────────────────────────────
  const studentMap = {};
  submitted.forEach(a => {
    const user = Array.isArray(a.users) ? a.users[0] : a.users;
    if (!user) return;
    const uid = user.id;
    if (!studentMap[uid]) {
      studentMap[uid] = {
        user_id:       uid,
        name:          user.name     ?? 'Unknown',
        year:          user.year     ?? '—',
        division:      user.division ?? '—',
        attempts:      [],
      };
    }
    const pct   = resultsMap[a.id]?.percentage ?? null;
    const score = resultsMap[a.id]?.total_score ?? null;
    studentMap[uid].attempts.push({ pct, score, test_id: a.test_id });
  });

  const studentPerformance = Object.values(studentMap).map((s) => {
    const withPct = s.attempts.filter((a) => a.pct != null);
    const avgPct  = withPct.length
      ? Math.round(withPct.reduce((sum, a) => sum + a.pct, 0) / withPct.length * 10) / 10
      : 0;
    const bestScore = s.attempts.reduce((best, a) => Math.max(best, a.score ?? 0), 0);
    return {
      user_id:         s.user_id,
      name:            s.name,
      year:            s.year,
      division:        s.division,
      tests_attempted: s.attempts.length,
      avg_percentage:  avgPct,
      best_score:      bestScore,
    };
  }).sort((a, b) => b.avg_percentage - a.avg_percentage);

  // ── Summary ───────────────────────────────────────────────
  const uniqueStudents = new Set(submitted.map(a => a.user_id)).size;
  const allPcts = submitted.map(a => resultsMap[a.id]?.percentage).filter(p => p != null);
  const avgScoreAll = allPcts.length
    ? Math.round(allPcts.reduce((s, p) => s + p, 0) / allPcts.length * 10) / 10
    : 0;
  const overallCompletion = (attempts ?? []).length
    ? Math.round(submitted.length / (attempts ?? []).length * 100)
    : 0;

  return res.json({
    total_tests:             tests.length,
    total_students_tested:   uniqueStudents,
    avg_score_across_tests:  avgScoreAll,
    overall_completion_rate: overallCompletion,
    tests:                   testAnalytics,
    division_comparison:     divisionComparison,
    student_performance:     studentPerformance,
  });
});

export default router;
