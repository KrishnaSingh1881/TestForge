import { runLocally } from './localRunner.js';

// ── MCQ evaluation ────────────────────────────────────────────
export function evaluateMCQ(type, selectedIds, correctOptions, questionMarks) {
  const correctIds = correctOptions.filter(o => o.is_correct).map(o => o.id);
  const totalCorrect = correctIds.length;

  if (type === 'mcq_single') {
    const isCorrect = selectedIds?.length === 1 && correctIds.includes(selectedIds[0]);
    return {
      is_correct:    isCorrect,
      marks_awarded: isCorrect ? Number(questionMarks) : 0,
    };
  }

  // mcq_multi: partial credit
  const selected      = selectedIds ?? [];
  const correctSel    = selected.filter(id => correctIds.includes(id)).length;
  const wrongSel      = selected.filter(id => !correctIds.includes(id)).length;
  const net           = Math.max(0, correctSel - wrongSel);
  const marksAwarded  = totalCorrect > 0
    ? (net / totalCorrect) * Number(questionMarks)
    : 0;
  const isCorrect     = correctSel === totalCorrect && wrongSel === 0;

  return {
    is_correct:    isCorrect,
    marks_awarded: Math.round(marksAwarded * 100) / 100,
  };
}

// ── Debugging evaluation ──────────────────────────────────────
export async function evaluateDebugging(code, language, testCases, questionMarks) {
  if (!testCases || testCases.length === 0) {
    return {
      visible_cases_passed: 0,
      visible_cases_total: 0,
      hidden_cases_passed: 0,
      hidden_cases_total: 0,
      marks_awarded: Number(questionMarks), 
      is_correct: true
    };
  }

  const visible = testCases.filter(tc => !tc.is_hidden);
  const hidden  = testCases.filter(tc => tc.is_hidden);

  let visiblePassed = 0;
  let hiddenPassed  = 0;

  const compare = (output, expected) => {
    if (output === null || expected === null) return false;
    const cleanOut = output.toString().replace(/\0/g, '').trim().toLowerCase();
    const cleanExp = expected.toString().replace(/\0/g, '').trim().toLowerCase();
    return cleanOut === cleanExp;
  };

  // Run all cases locally
  for (const tc of visible) {
    try {
      const res = await runLocally(language, code, tc.input);
      if (compare(res.stdout, tc.expected_output)) visiblePassed++;
    } catch (e) { console.error('Local run failed:', e); }
  }

  for (const tc of hidden) {
    try {
      const res = await runLocally(language, code, tc.input);
      if (compare(res.stdout, tc.expected_output)) hiddenPassed++;
    } catch { /* fail */ }
  }

  const grandTotal  = testCases.length;
  const grandPassed = visiblePassed + hiddenPassed;
  
  const marksAwarded = (grandPassed / grandTotal) * Number(questionMarks);

  return {
    visible_cases_passed: visiblePassed,
    visible_cases_total:  visible.length,
    hidden_cases_passed:  hiddenPassed,
    hidden_cases_total:   hidden.length,
    marks_awarded:        Math.round(marksAwarded * 100) / 100,
  };
}
