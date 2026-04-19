import { useState, useRef } from 'react';
import api from '../../lib/axios';
import GlassSelect from './GlassSelect';

interface Option {
  option_text: string;
  option_image_url: string;
  is_correct: boolean;
  display_order: number;
}

interface MCQFormProps {
  onSuccess?: (id?: string) => void;
  initial?: {
    id: string;
    type: 'mcq_single' | 'mcq_multi';
    statement: string;
    statement_image_url: string;
    topic_tag: string;
    difficulty: string;
    marks: number;
    mcq_options: Option[];
  };
}

const defaultOptions = (): Option[] =>
  Array.from({ length: 4 }, (_, i) => ({
    option_text: '', option_image_url: '', is_correct: false, display_order: i,
  }));

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500';
const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.07)',
  border: '1px solid var(--glass-border)',
  color: 'rgb(var(--text-primary))',
};
const labelCls = 'block text-xs mb-1';
const labelStyle = { color: 'rgb(var(--text-secondary))' };

export default function MCQForm({ onSuccess, initial }: MCQFormProps) {
  const [tab, setTab] = useState<'details' | 'options'>('details');
  const [type, setType] = useState<'mcq_single' | 'mcq_multi'>(initial?.type ?? 'mcq_single');
  const [statement, setStatement] = useState(initial?.statement ?? '');
  const [statementImg, setStatementImg] = useState(initial?.statement_image_url ?? '');
  const [topicTag, setTopicTag] = useState(initial?.topic_tag ?? '');
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? '');
  const [marks, setMarks] = useState<number>(initial?.marks ?? 1);
  const [options, setOptions] = useState<Option[]>(
    initial?.mcq_options?.length ? initial.mcq_options : defaultOptions()
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [uploadingStmt, setUploadingStmt] = useState(false);
  const stmtImgRef = useRef<HTMLInputElement>(null);
  const optImgRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function uploadImage(file: File, onDone: (url: string) => void, setLoading: (v: boolean) => void) {
    setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/questions/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onDone(res.data.url);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Image upload failed');
    } finally {
      setLoading(false);
    }
  }

  function setOption(idx: number, field: keyof Option, value: string | boolean) {
    setOptions(prev => {
      const next = [...prev];
      // For single-correct, uncheck others when checking one
      if (field === 'is_correct' && value === true && type === 'mcq_single') {
        next.forEach((o, i) => { next[i] = { ...o, is_correct: i === idx }; });
      } else {
        next[idx] = { ...next[idx], [field]: value };
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!statement.trim()) { setError('Statement is required'); setTab('details'); return; }
    if (!options.some(o => o.is_correct)) { setError('At least one correct option required'); setTab('options'); return; }
    if (options.every(o => !o.option_text.trim() && !o.option_image_url)) {
      setError('Options cannot all be empty'); setTab('options'); return;
    }

    setSaving(true);
    try {
      const payload = { type, statement, statement_image_url: statementImg, topic_tag: topicTag, difficulty, marks, options };
      let newId = initial?.id;
      if (initial?.id) {
        await api.patch(`/questions/${initial.id}`, payload);
      } else {
        const res = await api.post('/questions/mcq', payload);
        newId = res.data.question?.id || res.data.id;
      }
      onSuccess?.(newId);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const tabBtn = (t: 'details' | 'options') => (
    <button type="button" onClick={() => setTab(t)}
      className="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
      style={{
        backgroundColor: tab === t ? 'rgba(99,102,241,0.2)' : 'transparent',
        color: tab === t ? 'rgb(var(--accent))' : 'rgb(var(--text-secondary))',
        borderBottom: tab === t ? '2px solid rgb(var(--accent))' : '2px solid transparent',
      }}>
      {t === 'details' ? 'Question Details' : 'Options'}
    </button>
  );

  return (
    <div className="flex gap-6 w-full">
      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="flex-1 min-w-0">
        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b" style={{ borderColor: 'var(--glass-border)' }}>
          {tabBtn('details')}
          {tabBtn('options')}
        </div>

        {/* Tab: Details */}
        {tab === 'details' && (
          <div className="space-y-4">
            {/* Type toggle */}
            <div>
              <label className={labelCls} style={labelStyle}>Question Type</label>
              <div className="flex gap-2">
                {(['mcq_single', 'mcq_multi'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: type === t ? 'rgb(var(--accent))' : 'rgba(255,255,255,0.07)',
                      color: type === t ? '#fff' : 'rgb(var(--text-secondary))',
                      border: '1px solid var(--glass-border)',
                    }}>
                    {t === 'mcq_single' ? 'Single Correct' : 'Multi Correct'}
                  </button>
                ))}
              </div>
            </div>

            {/* Statement */}
            <div>
              <label className={labelCls} style={labelStyle}>Question Statement *</label>
              <textarea rows={4} value={statement} onChange={e => setStatement(e.target.value)}
                className={`${inputCls} resize-none`} style={inputStyle} />
            </div>

            {/* Statement image */}
            <div>
              <label className={labelCls} style={labelStyle}>Statement Image (optional)</label>
              <div className="flex gap-2 items-center">
                <input ref={stmtImgRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f, setStatementImg, setUploadingStmt);
                  }} />
                <button type="button" onClick={() => stmtImgRef.current?.click()}
                  disabled={uploadingStmt}
                  className="px-3 py-1.5 rounded-lg text-xs transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
                  {uploadingStmt ? 'Uploading...' : 'Upload Image'}
                </button>
                {statementImg && (
                  <span className="text-xs truncate max-w-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                    ✓ Uploaded
                  </span>
                )}
              </div>
              {statementImg && <img src={statementImg} alt="statement" className="mt-2 max-h-32 rounded-lg object-contain" />}
            </div>

            {/* Topic / Difficulty / Marks */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Topic Tag</label>
                <input type="text" value={topicTag} onChange={e => setTopicTag(e.target.value)}
                  className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Difficulty</label>
                <GlassSelect 
                  value={difficulty} 
                  onChange={setDifficulty}
                  options={[
                    { value: 'easy', label: 'Easy' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'hard', label: 'Hard' },
                  ]}
                  placeholder="Select"
                />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Marks</label>
                <input type="number" min={0.5} step={0.5} value={marks}
                  onChange={e => setMarks(Number(e.target.value))}
                  className={inputCls} style={inputStyle} />
              </div>
            </div>
          </div>
        )}

        {/* Tab: Options */}
        {tab === 'options' && (
          <div className="space-y-3">
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--text-secondary))' }}>
              {type === 'mcq_single' ? 'Select one correct answer (radio).' : 'Select all correct answers (checkboxes).'}
            </p>
            {options.map((opt, idx) => (
              <div key={idx} className="glass p-3 rounded-xl space-y-2">
                <div className="flex items-center gap-3">
                  {/* Correct selector */}
                  {type === 'mcq_single' ? (
                    <input type="radio" name="correct" checked={opt.is_correct}
                      onChange={() => setOption(idx, 'is_correct', true)}
                      className="accent-indigo-500 mt-0.5 shrink-0" />
                  ) : (
                    <input type="checkbox" checked={opt.is_correct}
                      onChange={e => setOption(idx, 'is_correct', e.target.checked)}
                      className="accent-indigo-500 mt-0.5 shrink-0" />
                  )}
                  <span className="text-xs font-medium shrink-0" style={{ color: 'rgb(var(--text-secondary))' }}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <input type="text" placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    value={opt.option_text}
                    onChange={e => setOption(idx, 'option_text', e.target.value)}
                    className={`${inputCls} flex-1`} style={inputStyle} />
                  {/* Option image upload */}
                  <input ref={el => { optImgRefs.current[idx] = el; }} type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(f, url => setOption(idx, 'option_image_url', url),
                        v => setUploadingIdx(v ? idx : null));
                    }} />
                  <button type="button" onClick={() => optImgRefs.current[idx]?.click()}
                    disabled={uploadingIdx === idx}
                    className="text-xs px-2 py-1 rounded shrink-0 transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
                    {uploadingIdx === idx ? '...' : '🖼'}
                  </button>
                </div>
                {opt.option_image_url && (
                  <img src={opt.option_image_url} alt={`opt-${idx}`} className="max-h-20 rounded object-contain ml-8" />
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'rgb(var(--accent))' }}>
            {saving ? 'Saving...' : initial?.id ? 'Update Question' : 'Create Question'}
          </button>
          {tab === 'details' && (
            <button type="button" onClick={() => setTab('options')}
              className="px-5 py-2 rounded-lg text-sm transition-opacity"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
              Next: Options →
            </button>
          )}
        </div>
      </form>

      {/* ── Preview Panel ── */}
      <div className="w-72 shrink-0 hidden lg:block">
        <p className="text-xs font-medium mb-3" style={{ color: 'rgb(var(--text-secondary))' }}>
          STUDENT PREVIEW
        </p>
        <div className="glass p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: 'rgb(var(--accent))' }}>
              {type === 'mcq_single' ? 'Single Correct' : 'Multi Correct'}
            </span>
            {difficulty && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: difficulty === 'easy' ? 'rgba(34,197,94,0.15)' : difficulty === 'medium' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                  color: difficulty === 'easy' ? '#4ade80' : difficulty === 'medium' ? '#facc15' : '#f87171',
                }}>
                {difficulty}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}>
              {marks} mark{marks !== 1 ? 's' : ''}
            </span>
          </div>

          <p className="text-sm leading-relaxed" style={{ color: 'rgb(var(--text-primary))' }}>
            {statement || <span style={{ color: 'rgb(var(--text-secondary))' }}>Question statement will appear here...</span>}
          </p>

          {statementImg && <img src={statementImg} alt="stmt" className="rounded-lg max-h-28 object-contain" />}

          <div className="space-y-2 pt-1">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 rounded-lg"
                style={{
                  backgroundColor: opt.is_correct ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${opt.is_correct ? 'rgba(99,102,241,0.4)' : 'var(--glass-border)'}`,
                }}>
                <span className="text-xs font-bold mt-0.5 shrink-0"
                  style={{ color: opt.is_correct ? 'rgb(var(--accent))' : 'rgb(var(--text-secondary))' }}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs" style={{ color: 'rgb(var(--text-primary))' }}>
                    {opt.option_text || <span style={{ color: 'rgb(var(--text-secondary))' }}>Option {String.fromCharCode(65 + idx)}</span>}
                  </p>
                  {opt.option_image_url && <img src={opt.option_image_url} alt="" className="mt-1 max-h-14 rounded object-contain" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
