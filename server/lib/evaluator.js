// ── Evaluation helpers ────────────────────────────────────────

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';
const LANG_MAP   = {
  python: { language: 'python', version: '3.10.0' },
  cpp:    { language: 'c++',    version: '10.2.0'  },
};

// Run code against a single test case via Piston
async function runOnce(language, code, stdin) {
  const runtime = LANG_MAP[language];
  if (!runtime) throw new Error(`Unsupported language: ${language}`);

  const res = await fetch(PISTON_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language:        runtime.language,
      version:         runtime.version,
      files:           [{ content: code }],
      stdin:           stdin ?? '',
      run_timeout:     5000,
      compile_timeout: 10000,
    }),
  });

  if (!res.ok) throw new Error(`Piston error: ${res.status}`);
  const data = await res.json();
  return (data.run?.stdout ?? '').trim();
}

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
  const visible = testCases.filter(tc => !tc.is_hidden);
  const hidden  = testCases.filter(tc => tc.is_hidden);

  let visiblePassed = 0;
  let hiddenPassed  = 0;

  for (const tc of visible) {
    try {
      const out = await runOnce(language, code, tc.input);
      if (out === (tc.expected_output ?? '').trim()) visiblePassed++;
    } catch { /* count as failed */ }
  }

  for (const tc of hidden) {
    try {
      const out = await runOnce(language, code, tc.input);
      if (out === (tc.expected_output ?? '').trim()) hiddenPassed++;
    } catch { /* count as failed */ }
  }

  const hiddenTotal  = hidden.length;
  const marksAwarded = hiddenTotal > 0
    ? (hiddenPassed / hiddenTotal) * Number(questionMarks)
    : 0;

  return {
    visible_cases_passed: visiblePassed,
    visible_cases_total:  visible.length,
    hidden_cases_passed:  hiddenPassed,
    hidden_cases_total:   hiddenTotal,
    marks_awarded:        Math.round(marksAwarded * 100) / 100,
  };
}
