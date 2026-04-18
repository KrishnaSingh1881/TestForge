import { parse } from 'csv-parse/sync';

const VALID_TYPES       = ['mcq_single', 'mcq_multi', 'debugging'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

// ── Validate + normalise a single question object ────────────
// Returns { ok: true, question } or { ok: false, reason }
export function validateQuestion(raw, rowNum) {
  const { type, statement, options, marks, topic_tag, difficulty, correct_code, bug_count, language } = raw;

  const normalizedType = type?.toLowerCase().trim();
  if (!VALID_TYPES.includes(normalizedType))
    return { ok: false, reason: `Row ${rowNum}: invalid type "${type}" — must be mcq_single, mcq_multi, or debugging` };

  if (!statement?.trim())
    return { ok: false, reason: `Row ${rowNum}: statement is required` };

  if (normalizedType.startsWith('mcq')) {
    if (!Array.isArray(options) || options.length < 2)
      return { ok: false, reason: `Row ${rowNum}: at least 2 options required for MCQs` };

    const hasCorrect = options.some(o => o.is_correct);
    if (!hasCorrect)
      return { ok: false, reason: `Row ${rowNum}: no correct option specified` };

    if (normalizedType === 'mcq_single') {
      const correctCount = options.filter(o => o.is_correct).length;
      if (correctCount > 1)
        return { ok: false, reason: `Row ${rowNum}: mcq_single must have exactly 1 correct option (found ${correctCount})` };
    }
  } else if (normalizedType === 'debugging') {
    if (!correct_code?.trim())
      return { ok: false, reason: `Row ${rowNum}: correct_code is required for debugging questions` };
  }

  const normalizedDiff = difficulty?.toLowerCase().trim();
  if (normalizedDiff && !VALID_DIFFICULTIES.includes(normalizedDiff))
    return { ok: false, reason: `Row ${rowNum}: invalid difficulty "${difficulty}"` };

  const parsedMarks = Number(marks);
  if (isNaN(parsedMarks) || parsedMarks <= 0)
    return { ok: false, reason: `Row ${rowNum}: marks must be a positive number` };

  return {
    ok: true,
    question: {
      type:       normalizedType,
      statement:  statement.trim(),
      topic_tag:  topic_tag  ?? null,
      difficulty: normalizedDiff ?? null,
      marks:      parsedMarks,
      language:   language ?? (normalizedType === 'debugging' ? 'python' : null),
      correct_code: correct_code ?? null,
      bug_count:    Number(bug_count) || 1,
      options: (options || []).map((o, i) => ({
        option_text:  (o.text ?? o.option_text ?? o.option ?? '').trim(),
        is_correct:   Boolean(o.is_correct),
        display_order: i,
      })),
    },
  };
}

// ── Parse CSV buffer → array of raw question objects ─────────
export function parseCSV(buffer) {
  const records = parse(buffer, {
    columns:          header => header.map(h => h.toLowerCase().replace(/\s+/g, '_').trim()),
    skip_empty_lines: true,
    trim:             true,
    bom:              true, // Handle byte order mark
  });

  return records.map((row, i) => {
    // correct_options can be "0" or "0,2" — 0-indexed into option_1..option_n
    const correctIndices = String(row.correct_options ?? row.correct ?? '')
      .split(/[,;|]/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n));

    // Support flexible option headers: option_1, option_2... or option1, option2...
    const optionTexts = [];
    for (let j = 1; j <= 10; j++) {
      const val = row[`option_${j}`] ?? row[`option${j}`];
      if (val) optionTexts.push(val);
    }

    const options = optionTexts.map((text, idx) => ({
      text,
      is_correct: correctIndices.includes(idx),
    }));

    return {
      _row: i + 2,
      type:         row.type,
      statement:    row.statement,
      options,
      marks:        row.marks,
      topic_tag:    row.topic_tag ?? row.topic ?? row.tag,
      difficulty:   row.difficulty,
      correct_code: row.correct_code ?? row.code,
      bug_count:    row.bug_count,
      language:     row.language ?? row.lang,
    };
  });
}

// ── Parse JSON buffer → array of raw question objects ────────
export function parseJSON(buffer) {
  const parsed = JSON.parse(buffer.toString('utf8'));
  if (!Array.isArray(parsed)) throw new Error('JSON must be an array of questions');
  return parsed.map((item, i) => ({ ...item, _row: i + 1 }));
}

