import { parse } from 'csv-parse/sync';

const VALID_TYPES       = ['mcq_single', 'mcq_multi'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

// ── Validate + normalise a single question object ────────────
// Returns { ok: true, question } or { ok: false, reason }
export function validateQuestion(raw, rowNum) {
  const { type, statement, options, marks, topic_tag, difficulty } = raw;

  if (!VALID_TYPES.includes(type))
    return { ok: false, reason: `Row ${rowNum}: invalid type "${type}" — must be mcq_single or mcq_multi` };

  if (!statement?.trim())
    return { ok: false, reason: `Row ${rowNum}: statement is required` };

  if (!Array.isArray(options) || options.length < 2)
    return { ok: false, reason: `Row ${rowNum}: at least 2 options required` };

  const hasCorrect = options.some(o => o.is_correct);
  if (!hasCorrect)
    return { ok: false, reason: `Row ${rowNum}: no correct option specified` };

  if (type === 'mcq_single') {
    const correctCount = options.filter(o => o.is_correct).length;
    if (correctCount > 1)
      return { ok: false, reason: `Row ${rowNum}: mcq_single must have exactly 1 correct option (found ${correctCount})` };
  }

  if (difficulty && !VALID_DIFFICULTIES.includes(difficulty))
    return { ok: false, reason: `Row ${rowNum}: invalid difficulty "${difficulty}"` };

  const parsedMarks = Number(marks);
  if (isNaN(parsedMarks) || parsedMarks <= 0)
    return { ok: false, reason: `Row ${rowNum}: marks must be a positive number` };

  return {
    ok: true,
    question: {
      type,
      statement: statement.trim(),
      topic_tag:  topic_tag  ?? null,
      difficulty: difficulty ?? null,
      marks:      parsedMarks,
      options: options.map((o, i) => ({
        option_text:  (o.text ?? o.option_text ?? '').trim(),
        is_correct:   Boolean(o.is_correct),
        display_order: i,
      })),
    },
  };
}

// ── Parse CSV buffer → array of raw question objects ─────────
export function parseCSV(buffer) {
  const records = parse(buffer, {
    columns:          true,
    skip_empty_lines: true,
    trim:             true,
  });

  return records.map((row, i) => {
    // correct_options is "0" or "0,2" — 0-indexed into option_1..option_4
    const correctIndices = String(row.correct_options ?? '')
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n));

    const optionTexts = [row.option_1, row.option_2, row.option_3, row.option_4]
      .filter(Boolean);

    const options = optionTexts.map((text, idx) => ({
      text,
      is_correct: correctIndices.includes(idx),
    }));

    return {
      _row: i + 2, // 1-indexed, +1 for header
      type:        row.type,
      statement:   row.statement,
      options,
      marks:       row.marks,
      topic_tag:   row.topic_tag,
      difficulty:  row.difficulty,
    };
  });
}

// ── Parse JSON buffer → array of raw question objects ────────
export function parseJSON(buffer) {
  const parsed = JSON.parse(buffer.toString('utf8'));
  if (!Array.isArray(parsed)) throw new Error('JSON must be an array');
  return parsed.map((item, i) => ({ ...item, _row: i + 1 }));
}
