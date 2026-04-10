import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { parseCSV, parseJSON, validateQuestion } from '../lib/importParser.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// All question routes require auth + admin role
router.use(requireAuth, requireAdmin);

// ── POST /questions/upload-image ──────────────────────────────
router.post('/upload-image', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const ext = req.file.originalname.split('.').pop();
  const filename = `${req.user.id}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('question-images')
    .upload(filename, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

  if (error) return res.status(500).json({ error: error.message });

  const { data: { publicUrl } } = supabase.storage
    .from('question-images')
    .getPublicUrl(filename);

  return res.json({ url: publicUrl });
});

// ── POST /questions/mcq ───────────────────────────────────────
router.post('/mcq', async (req, res) => {
  const { type, statement, statement_image_url, topic_tag, difficulty, marks, options } = req.body;

  if (!['mcq_single', 'mcq_multi'].includes(type)) {
    return res.status(400).json({ error: 'type must be mcq_single or mcq_multi' });
  }
  if (!statement) return res.status(400).json({ error: 'statement is required' });
  if (!Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'At least 2 options required' });
  }

  // Insert question
  const { data: question, error: qErr } = await supabase
    .from('question_bank')
    .insert({
      created_by: req.user.id,
      type,
      statement,
      statement_image_url: statement_image_url ?? null,
      topic_tag: topic_tag ?? null,
      difficulty: difficulty ?? null,
      marks: marks ?? 1,
    })
    .select()
    .single();

  if (qErr) return res.status(500).json({ error: qErr.message });

  // Insert options
  const optionRows = options.map((opt, i) => ({
    question_id:      question.id,
    option_text:      opt.option_text ?? null,
    option_image_url: opt.option_image_url ?? null,
    is_correct:       Boolean(opt.is_correct),
    display_order:    opt.display_order ?? i,
  }));

  const { error: optErr } = await supabase.from('mcq_options').insert(optionRows);
  if (optErr) return res.status(500).json({ error: optErr.message });

  return res.status(201).json({ question });
});

// ── GET /questions/bank ───────────────────────────────────────
router.get('/bank', async (req, res) => {
  const { data: questions, error } = await supabase
    .from('question_bank')
    .select(`
      id, type, statement, statement_image_url, topic_tag,
      difficulty, marks, language, bug_count, created_at,
      mcq_options ( id, option_text, option_image_url, is_correct, display_order )
    `)
    .eq('created_by', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ questions });
});

// ── PATCH /questions/:id ──────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { statement, statement_image_url, topic_tag, difficulty, marks, type, options } = req.body;

  // Verify ownership
  const { data: existing, error: fetchErr } = await supabase
    .from('question_bank')
    .select('id, created_by')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) return res.status(404).json({ error: 'Question not found' });
  if (existing.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const updates = {};
  if (statement           !== undefined) updates.statement            = statement;
  if (statement_image_url !== undefined) updates.statement_image_url  = statement_image_url;
  if (topic_tag           !== undefined) updates.topic_tag            = topic_tag;
  if (difficulty          !== undefined) updates.difficulty           = difficulty;
  if (marks               !== undefined) updates.marks                = marks;
  if (type                !== undefined) updates.type                 = type;

  const { data: question, error: updateErr } = await supabase
    .from('question_bank')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  // Replace options if provided
  if (Array.isArray(options)) {
    await supabase.from('mcq_options').delete().eq('question_id', id);

    const optionRows = options.map((opt, i) => ({
      question_id:      id,
      option_text:      opt.option_text ?? null,
      option_image_url: opt.option_image_url ?? null,
      is_correct:       Boolean(opt.is_correct),
      display_order:    opt.display_order ?? i,
    }));

    const { error: optErr } = await supabase.from('mcq_options').insert(optionRows);
    if (optErr) return res.status(500).json({ error: optErr.message });
  }

  return res.json({ question });
});

// ── DELETE /questions/:id ─────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { data: existing, error: fetchErr } = await supabase
    .from('question_bank')
    .select('id, created_by')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) return res.status(404).json({ error: 'Question not found' });
  if (existing.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  // Options cascade via FK; delete question
  const { error } = await supabase.from('question_bank').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ message: 'Question deleted' });
});

// ── POST /questions/debug ─────────────────────────────────────
router.post('/debug', async (req, res) => {
  const { statement, topic_tag, difficulty, marks, language, correct_code, bug_count } = req.body;

  if (!statement)    return res.status(400).json({ error: 'statement is required' });
  if (!correct_code) return res.status(400).json({ error: 'correct_code is required' });
  if (!language || !['python', 'cpp'].includes(language)) {
    return res.status(400).json({ error: 'language must be python or cpp' });
  }

  const { data: question, error } = await supabase
    .from('question_bank')
    .insert({
      created_by:  req.user.id,
      type:        'debugging',
      statement,
      topic_tag:   topic_tag   ?? null,
      difficulty:  difficulty  ?? null,
      marks:       marks       ?? 1,
      language,
      correct_code,
      bug_count:   bug_count   ?? 1,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ question });
});

// ── POST /questions/debug/:id/test-cases ─────────────────────
router.post('/debug/:id/test-cases', async (req, res) => {
  const { id } = req.params;
  const { test_cases } = req.body; // array of { input, expected_output, is_hidden }

  if (!Array.isArray(test_cases) || test_cases.length === 0) {
    return res.status(400).json({ error: 'test_cases array is required' });
  }

  const { data: q } = await supabase
    .from('question_bank')
    .select('id, created_by')
    .eq('id', id)
    .single();

  if (!q) return res.status(404).json({ error: 'Question not found' });
  if (q.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const rows = test_cases.map(tc => ({
    question_id:     id,
    input:           tc.input ?? '',
    expected_output: tc.expected_output,
    is_hidden:       Boolean(tc.is_hidden),
  }));

  const { data, error } = await supabase.from('test_cases').insert(rows).select();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ test_cases: data });
});

// ── GET /questions/debug/:id/variants ────────────────────────
router.get('/debug/:id/variants', async (req, res) => {
  const { id } = req.params;

  const { data: q } = await supabase
    .from('question_bank')
    .select('id, created_by')
    .eq('id', id)
    .single();

  if (!q) return res.status(404).json({ error: 'Question not found' });
  if (q.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { data: variants, error } = await supabase
    .from('debug_variants')
    .select('id, buggy_code, diff_json, bug_count, difficulty, language, is_approved, approved_at, generated_by')
    .eq('question_id', id)
    .order('is_approved', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ variants });
});

// ── PATCH /variants/:id/approve ──────────────────────────────
router.patch('/variants/:id/approve', async (req, res) => {
  const { id } = req.params;

  const { data: v } = await supabase
    .from('debug_variants')
    .select('id, question_id')
    .eq('id', id)
    .single();

  if (!v) return res.status(404).json({ error: 'Variant not found' });

  // Verify admin owns the parent question
  const { data: q } = await supabase
    .from('question_bank')
    .select('created_by')
    .eq('id', v.question_id)
    .single();

  if (!q || q.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase
    .from('debug_variants')
    .update({ is_approved: true, approved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ variant: data });
});

// ── PATCH /variants/:id/reject ───────────────────────────────
router.patch('/variants/:id/reject', async (req, res) => {
  const { id } = req.params;

  const { data: v } = await supabase
    .from('debug_variants')
    .select('id, question_id')
    .eq('id', id)
    .single();

  if (!v) return res.status(404).json({ error: 'Variant not found' });

  const { data: q } = await supabase
    .from('question_bank')
    .select('created_by')
    .eq('id', v.question_id)
    .single();

  if (!q || q.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { error } = await supabase.from('debug_variants').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ message: 'Variant rejected and deleted' });
});

// ── GET /questions/debug/:id/test-cases-visible ──────────────
// Student-facing: only visible (non-hidden) test cases
router.get('/debug/:id/test-cases-visible', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('test_cases')
    .select('input, expected_output')
    .eq('question_id', id)
    .eq('is_hidden', false)
    .order('id');

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ test_cases: data ?? [] });
});

// ── POST /questions/:id/attach ────────────────────────────────
router.post('/:id/attach', async (req, res) => {
  const { id } = req.params;
  const { test_id, unlock_at_minutes = 0, question_order } = req.body;

  if (!test_id) return res.status(400).json({ error: 'test_id is required' });

  // Verify admin owns the test
  const { data: test, error: testErr } = await supabase
    .from('tests')
    .select('id, created_by')
    .eq('id', test_id)
    .single();

  if (testErr || !test) return res.status(404).json({ error: 'Test not found' });
  if (test.created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase
    .from('test_questions')
    .insert({ test_id, question_id: id, unlock_at_minutes, question_order: question_order ?? 0 })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ test_question: data });
});

// ── POST /questions/import ────────────────────────────────────
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const ext = req.file.originalname.split('.').pop()?.toLowerCase();
  if (!['csv', 'json'].includes(ext)) {
    return res.status(400).json({ error: 'Only .csv and .json files are supported' });
  }

  // 1. Parse file
  let rawRows;
  try {
    rawRows = ext === 'csv'
      ? parseCSV(req.file.buffer)
      : parseJSON(req.file.buffer);
  } catch (e) {
    return res.status(400).json({ error: `File parse error: ${e.message}` });
  }

  if (rawRows.length === 0) {
    return res.status(400).json({ error: 'File contains no rows' });
  }

  // 2. Validate each row
  const valid   = [];
  const errors  = [];

  for (const raw of rawRows) {
    const result = validateQuestion(raw, raw._row);
    if (result.ok) valid.push(result.question);
    else           errors.push({ row: raw._row, reason: result.reason });
  }

  // 3. Insert valid questions
  let successCount = 0;

  for (const q of valid) {
    const { data: question, error: qErr } = await supabase
      .from('question_bank')
      .insert({
        created_by: req.user.id,
        type:       q.type,
        statement:  q.statement,
        topic_tag:  q.topic_tag,
        difficulty: q.difficulty,
        marks:      q.marks,
      })
      .select('id')
      .single();

    if (qErr) {
      errors.push({ row: '?', reason: `DB insert failed: ${qErr.message}` });
      continue;
    }

    const optRows = q.options.map(o => ({
      question_id:   question.id,
      option_text:   o.option_text,
      is_correct:    o.is_correct,
      display_order: o.display_order,
    }));

    const { error: optErr } = await supabase.from('mcq_options').insert(optRows);
    if (optErr) {
      // Roll back the question if options fail
      await supabase.from('question_bank').delete().eq('id', question.id);
      errors.push({ row: '?', reason: `Options insert failed: ${optErr.message}` });
      continue;
    }

    successCount++;
  }

  // 4. Log to question_import_logs
  await supabase.from('question_import_logs').insert({
    imported_by:   req.user.id,
    file_type:     ext,
    total_rows:    rawRows.length,
    success_count: successCount,
    error_rows:    errors.length > 0 ? errors : null,
  });

  return res.json({
    success_count: successCount,
    error_count:   errors.length,
    errors,
  });
});

export default router;
