import { useState } from 'react';
import Editor from '@monaco-editor/react';
import api from '../../lib/axios';
import VariantReviewPanel from './VariantReviewPanel';
import { useTheme } from '../../context/ThemeContext';
import GlassSelect from './GlassSelect';

interface TestCase { input: string; expected_output: string; is_hidden: boolean; }

interface Props { onSuccess?: () => void; }

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500';
const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.07)',
  border: '1px solid var(--glass-border)',
  color: 'rgb(var(--text-primary))',
};
const labelStyle = { color: 'rgb(var(--text-secondary))' };

export default function DebugQuestionForm({ onSuccess }: Props) {
  const { theme } = useTheme();
  const [statement, setStatement]   = useState('');
  const [language, setLanguage]     = useState<'python' | 'cpp'>('python');
  const [difficulty, setDifficulty] = useState('medium');
  const [marks, setMarks]           = useState(2);
  const [topicTag, setTopicTag]     = useState('');
  const [bugCount, setBugCount]     = useState(1);
  const [correctCode, setCorrectCode] = useState('');
  const [testCases, setTestCases]   = useState<TestCase[]>([
    { input: '', expected_output: '', is_hidden: false },
  ]);

  const [savedQuestionId, setSavedQuestionId] = useState<string | null>(null);
  const [variants, setVariants]               = useState<any[]>([]);
  const [saving, setSaving]                   = useState(false);
  const [generating, setGenerating]           = useState(false);
  const [error, setError]                     = useState('');

  function addTestCase() {
    setTestCases(prev => [...prev, { input: '', expected_output: '', is_hidden: false }]);
  }
  function removeTestCase(i: number) {
    setTestCases(prev => prev.filter((_, idx) => idx !== i));
  }
  function updateTestCase(i: number, field: keyof TestCase, value: string | boolean) {
    setTestCases(prev => prev.map((tc, idx) => idx === i ? { ...tc, [field]: value } : tc));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!statement.trim())   { setError('Statement is required'); return; }
    if (!correctCode.trim()) { setError('Correct code is required'); return; }

    setSaving(true);
    try {
      const { data } = await api.post('/questions/debug', {
        statement, topic_tag: topicTag, difficulty, marks, language, correct_code: correctCode, bug_count: bugCount,
      });
      const qid = data.question.id;
      setSavedQuestionId(qid);

      // Save test cases
      const validTc = testCases.filter(tc => tc.expected_output.trim());
      if (validTc.length > 0) {
        await api.post(`/questions/debug/${qid}/test-cases`, { test_cases: validTc });
      }
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    if (!savedQuestionId) { setError('Save the question first'); return; }
    setError('');
    setGenerating(true);
    try {
      const { data } = await api.post('/ai/generate-variants', { question_id: savedQuestionId });
      // Map AI response to frontend format with temp IDs
      const raw = data.variants ?? [];
      const formatted = raw.map((v: any, i: number) => ({
        id: `temp-${Date.now()}-${i}`,
        buggy_code: v.buggy_code,
        diff_json: v.diff.map((d: any) => ({
          line_number: d.line,
          original_line: d.original,
          buggy_line: d.buggy
        })),
        is_approved: false,
        generated_by: 'local-ollama'
      }));
      setVariants(formatted);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  function handleVariantUpdate(updated: any) {
    setVariants(prev => prev.map(v => v.id === updated.id ? updated : v));
  }
  function handleVariantRemove(id: string) {
    setVariants(prev => prev.filter(v => v.id !== id));
  }
  const [generatingTC, setGeneratingTC]       = useState(false);

  async function handleGenerateTestCases() {
    if (!statement.trim() || !correctCode.trim()) {
      setError('Please provide a statement and correct code first');
      return;
    }
    setError('');
    setGeneratingTC(true);
    try {
      const { data } = await api.post('/ai/generate-test-cases', {
        question_id: savedQuestionId,
        statement,
        solution_code: correctCode,
        language
      });
      // If we got new test cases, APPEND or REPLACE? 
      // User likely wants to replace the placeholders or append
      const newCases = data.test_cases.map((tc: any) => ({
        input: tc.input,
        expected_output: tc.expected_output,
        is_hidden: !!tc.is_hidden
      }));
      setTestCases(prev => {
         // Filter out empty placeholders
         const existing = prev.filter(p => p.expected_output.trim() !== '');
         return [...existing, ...newCases];
      });
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Test case generation failed');
    } finally {
      setGeneratingTC(false);
    }
  }

  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'light';

  return (
    <div className="space-y-6">
      {/* ── Question Details ── */}
      <form onSubmit={handleSave}>
        <div className="glass p-6 space-y-4">
          <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            Question Details
          </h3>

          {/* Statement */}
          <div>
            <label className="block text-xs mb-1" style={labelStyle}>Statement *</label>
            <textarea rows={3} value={statement} onChange={e => setStatement(e.target.value)}
              className={`${inputCls} resize-none`} style={inputStyle} />
          </div>

          {/* Row: language / difficulty / marks / topic / bug_count */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Language</label>
              <div className="flex gap-1">
                {(['python', 'cpp'] as const).map(l => (
                  <button key={l} type="button" onClick={() => setLanguage(l)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: language === l ? 'rgb(var(--accent))' : 'rgba(255,255,255,0.07)',
                      color: language === l ? '#fff' : 'rgb(var(--text-secondary))',
                      border: '1px solid var(--glass-border)',
                    }}>
                    {l === 'cpp' ? 'C++' : 'Python'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Difficulty</label>
              <GlassSelect 
                value={difficulty} 
                onChange={setDifficulty}
                options={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Marks</label>
              <input type="number" min={0.5} step={0.5} value={marks}
                onChange={e => setMarks(Number(e.target.value))}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Topic Tag</label>
              <input type="text" value={topicTag} onChange={e => setTopicTag(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Bug Count (1–5)</label>
              <input type="number" min={1} max={5} value={bugCount}
                onChange={e => setBugCount(Number(e.target.value))}
                className={inputCls} style={inputStyle} />
            </div>
          </div>

          {/* Correct code */}
          <div>
            <label className="block text-xs mb-1" style={labelStyle}>Correct Code *</label>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
              <Editor
                height="260px"
                language={language === 'cpp' ? 'cpp' : 'python'}
                theme={monacoTheme}
                value={correctCode}
                onChange={v => setCorrectCode(v ?? '')}
                options={{ fontSize: Math.round(parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.93), minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 8 } }}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving || !!savedQuestionId}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: 'rgb(var(--accent))' }}>
              {saving ? 'Saving...' : savedQuestionId ? '✓ Saved' : 'Save Question'}
            </button>
            {savedQuestionId && (
              <button type="button" onClick={handleGenerate} disabled={generating}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: generating ? 'rgba(99,102,241,0.5)' : 'rgb(var(--accent))' }}>
                {generating ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : '✨ Generate Variants'}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* ── Test Cases ── */}
      <div className="glass p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            Test Cases
          </h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleGenerateTestCases} disabled={generatingTC}
              className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 flex items-center gap-2"
              style={{ backgroundColor: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
              {generatingTC ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-[#4ade80] border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : '✨ AI Test Cases'}
            </button>
            <button type="button" onClick={addTestCase}
              className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
              + Add Test Case
            </button>
          </div>
        </div>

        {testCases.map((tc, i) => (
          <div key={i} className="rounded-xl p-3 space-y-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Test Case {i + 1}
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={tc.is_hidden}
                    onChange={e => updateTestCase(i, 'is_hidden', e.target.checked)}
                    className="accent-indigo-500" />
                  <span className="text-xs" style={{ color: tc.is_hidden ? '#f87171' : 'rgb(var(--text-secondary))' }}>
                    {tc.is_hidden ? '🔒 Hidden (honeypot)' : 'Visible'}
                  </span>
                </label>
              </div>
              {testCases.length > 1 && (
                <button type="button" onClick={() => removeTestCase(i)}
                  className="text-xs" style={{ color: '#f87171' }}>Remove</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs mb-1" style={labelStyle}>Input</label>
                <textarea rows={2} value={tc.input} onChange={e => updateTestCase(i, 'input', e.target.value)}
                  className={`${inputCls} resize-none font-mono text-xs`} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={labelStyle}>Expected Output *</label>
                <textarea rows={2} value={tc.expected_output}
                  onChange={e => updateTestCase(i, 'expected_output', e.target.value)}
                  className={`${inputCls} resize-none font-mono text-xs`} style={inputStyle} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Variant Review Panel ── */}
      {variants.length > 0 && savedQuestionId && (
        <>
          <VariantReviewPanel
            correctCode={correctCode}
            language={language}
            variants={variants}
            questionId={savedQuestionId}
            onApprove={handleVariantUpdate}
            onReject={handleVariantRemove}
            onRegenerate={() => handleRegenerate(savedQuestionId)}
          />

          {/* Done button — shown when at least one variant is approved */}
          {variants.some(v => v.is_approved) && (
            <div className="glass p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                  {variants.filter(v => v.is_approved).length} variant{variants.filter(v => v.is_approved).length !== 1 ? 's' : ''} approved
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Question is ready to be added to tests
                </p>
              </div>
              <button
                onClick={onSuccess}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: '#4ade80', color: '#000' }}>
                ✓ Done — Back to Questions
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
