import { useState } from 'react';
import Editor from '@monaco-editor/react';
import api from '../../lib/axios';
import { useTheme } from '../../context/ThemeContext';

interface DiffEntry { line_number: number; original_line: string; buggy_line: string; }

interface Variant {
  id: string;
  buggy_code: string;
  diff_json: DiffEntry[];
  is_approved: boolean;
  generated_by: string;
}

interface Props {
  correctCode: string;
  language: 'python' | 'cpp';
  variants: Variant[];
  questionId: string;
  onApprove: (v: Variant, oldId?: string) => void;
  onReject: (id: string) => void;
  onRegenerate: () => void;
}

function DiffView({ correctCode, buggyCode, diffEntries, monacoTheme, language }: {
  correctCode: string; buggyCode: string; diffEntries: DiffEntry[];
  monacoTheme: string; language: string;
}) {
  const changedLines = new Set(diffEntries.map(d => d.line_number));

  // Build decorated correct code lines
  const correctLines = (correctCode || '').split('\n');
  const buggyLines   = (buggyCode || '').split('\n');

  return (
    <div className="space-y-3">
      {/* Side-by-side code */}
      <div className="grid grid-cols-2 gap-2">
        {/* Correct */}
        <div>
          <p className="text-xs mb-1 font-medium" style={{ color: '#4ade80' }}>✓ Correct Code</p>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(74,222,128,0.3)' }}>
            <div className="relative">
              {/* Line highlights overlay */}
              <div className="absolute inset-0 pointer-events-none z-10" style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: '18px', padding: '8px 0' }}>
                {correctLines.map((_, i) => (
                  <div key={i} style={{
                    height: 18,
                    backgroundColor: changedLines.has(i + 1) ? 'rgba(74,222,128,0.15)' : 'transparent',
                  }} />
                ))}
              </div>
              <Editor
                height={`${Math.min(Math.max(correctLines.length * 18 + 20, 80), 300)}px`}
                language={language}
                theme={monacoTheme}
                value={correctCode}
                options={{ readOnly: true, fontSize: 12, minimap: { enabled: false }, lineNumbers: 'on', scrollBeyondLastLine: false, padding: { top: 8 } }}
              />
            </div>
          </div>
        </div>

        {/* Buggy */}
        <div>
          <p className="text-xs mb-1 font-medium" style={{ color: '#f87171' }}>✗ Buggy Variant</p>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(248,113,113,0.3)' }}>
            <div className="relative">
              <div className="absolute inset-0 pointer-events-none z-10" style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: '18px', padding: '8px 0' }}>
                {buggyLines.map((_, i) => (
                  <div key={i} style={{
                    height: 18,
                    backgroundColor: changedLines.has(i + 1) ? 'rgba(248,113,113,0.15)' : 'transparent',
                  }} />
                ))}
              </div>
              <Editor
                height={`${Math.min(Math.max(buggyLines.length * 18 + 20, 80), 300)}px`}
                language={language}
                theme={monacoTheme}
                value={buggyCode}
                options={{ readOnly: true, fontSize: 12, minimap: { enabled: false }, lineNumbers: 'on', scrollBeyondLastLine: false, padding: { top: 8 } }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Change list */}
      {diffEntries.length > 0 && (
        <div className="rounded-lg p-3 space-y-1.5"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'rgb(var(--text-secondary))' }}>
            Changes ({diffEntries.length} bug{diffEntries.length !== 1 ? 's' : ''})
          </p>
          {diffEntries.map((d, i) => (
            <div key={i} className="text-xs font-mono">
              {d.line_number ? (
                <>
                  <span className="mr-2" style={{ color: 'rgb(var(--text-secondary))' }}>Line {d.line_number}:</span>
                  <span style={{ color: '#f87171', textDecoration: 'line-through' }}>{(d.original_line || '').trim()}</span>
                  <span className="mx-2" style={{ color: 'rgb(var(--text-secondary))' }}>→</span>
                  <span style={{ color: '#4ade80' }}>{(d.buggy_line || '').trim()}</span>
                </>
              ) : (
                <span style={{ color: 'rgb(var(--text-secondary))', fontStyle: 'italic' }}>
                  {(d as any).explanation || 'No details available'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VariantReviewPanel({ correctCode, language, variants, questionId, onApprove, onReject, onRegenerate }: Props) {
  const { theme } = useTheme();
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'light';
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(variants[0]?.id ?? null);

  const approvedCount = variants.filter(v => v.is_approved).length;

  async function approve(v: Variant) {
    setLoadingId(v.id);
    try {
      // If variant has a real ID (not temporary from AI generation), just approve it via PATCH
      if (!v.id.startsWith('temp-')) {
        const { data } = await api.patch(`/questions/variants/${v.id}/approve`);
        onApprove(data.variant, v.id);
      } else {
        // If it's a temp ID, we POST it to save and approve in one go
        const { data } = await api.post(`/questions/debug/${questionId}/approve-variant`, {
          buggy_code: v.buggy_code,
          diff_json: v.diff_json,
          generated_by: v.generated_by
        });
        onApprove(data.variant, v.id);
      }
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Approval failed');
    } finally {
      setLoadingId(null);
    }
  }

  async function reject(v: Variant) {
    if (!confirm('Reject and delete this variant?')) return;
    
    // If it's a temp ID, just remove from UI
    if (v.id.startsWith('temp-')) {
      onReject(v.id);
      return;
    }

    setLoadingId(v.id);
    try {
      await api.patch(`/questions/variants/${v.id}/reject`);
      onReject(v.id);
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Rejection failed');
    } finally {
      setLoadingId(null);
    }
  }


  return (
    <div className="glass p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            Variant Review
          </h3>
          <p className="text-xs mt-0.5" style={{ color: approvedCount < 3 ? '#facc15' : '#4ade80' }}>
            {approvedCount < 3
              ? `⚠ ${approvedCount}/5 approved — minimum 3 recommended`
              : `✓ ${approvedCount}/5 approved`}
          </p>
        </div>
        <button onClick={onRegenerate}
          className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
          + Regenerate New
        </button>
      </div>

      {/* Variant cards */}
      {variants.map((v, idx) => (
        <div key={v.id} className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${v.is_approved ? 'rgba(74,222,128,0.4)' : 'var(--glass-border)'}` }}>

          {/* Card header */}
          <div className="flex items-center justify-between px-4 py-3 cursor-pointer"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
            onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                Variant {idx + 1}
              </span>
              {v.is_approved ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                  ✓ Approved
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}>
                  Pending
                </span>
              )}
              <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                {v.diff_json?.length ?? 0} change{(v.diff_json?.length ?? 0) !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!v.is_approved && (
                <>
                  <button onClick={e => { e.stopPropagation(); approve(v); }}
                    disabled={loadingId === v.id}
                    className="text-xs px-3 py-1 rounded-lg font-medium transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                    {loadingId === v.id ? '...' : 'Approve'}
                  </button>
                  <button onClick={e => { e.stopPropagation(); reject(v); }}
                    disabled={loadingId === v.id}
                    className="text-xs px-3 py-1 rounded-lg transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                    Reject
                  </button>
                </>
              )}
              <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                {expanded === v.id ? '▲' : '▼'}
              </span>
            </div>
          </div>

          {/* Diff view */}
          {expanded === v.id && (
            <div className="p-4">
              <DiffView
                correctCode={correctCode}
                buggyCode={v.buggy_code}
                diffEntries={v.diff_json ?? []}
                monacoTheme={monacoTheme}
                language={language === 'cpp' ? 'cpp' : 'python'}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
