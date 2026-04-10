import { useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../lib/axios';
import { useTheme } from '../../context/ThemeContext';
import Lenis from 'lenis';

interface ResultsAppProps {
  attemptId: string;
}

function gradeBand(pct: number) {
  if (pct >= 90) return { grade: 'A+', color: '#4ade80' };
  if (pct >= 80) return { grade: 'A', color: '#4ade80' };
  if (pct >= 70) return { grade: 'B', color: '#86efac' };
  if (pct >= 60) return { grade: 'C', color: '#facc15' };
  if (pct >= 40) return { grade: 'D', color: '#fb923c' };
  return { grade: 'F', color: '#f87171' };
}

function marksColor(awarded: number, total: number) {
  if (total === 0) return 'rgb(var(--text-secondary))';
  const r = awarded / total;
  if (r >= 1) return '#4ade80';
  if (r >= 0.5) return '#facc15';
  return '#f87171';
}

function ScoreCircle({ score, total, pct }: { score: number; total: number; pct: number }) {
  const { grade, color } = gradeBand(pct);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums" style={{ color: 'rgb(var(--text-primary))' }}>
          {score}
        </span>
        <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
          / {total}
        </span>
        <span className="text-lg font-bold mt-0.5" style={{ color }}>
          {grade}
        </span>
      </div>
    </div>
  );
}

function QuestionRow({ q, idx, monacoTheme }: { q: any; idx: number; monacoTheme: string }) {
  const [open, setOpen] = useState(false);
  const isMCQ = q.type === 'mcq_single' || q.type === 'mcq_multi';
  const isDebug = q.type === 'debugging';
  const mc = marksColor(q.marks_awarded, q.marks_total);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}
        >
          {idx + 1}
        </span>

        <span
          className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}
        >
          {isMCQ ? (q.type === 'mcq_multi' ? 'MCQ Multi' : 'MCQ') : 'Debug'}
        </span>

        <span className="flex-1 text-sm truncate" style={{ color: 'rgb(var(--text-primary))' }}>
          {q.statement}
        </span>

        {isMCQ && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
            style={{ backgroundColor: `${mc}20`, color: mc, border: `1px solid ${mc}40` }}
          >
            {q.marks_awarded}/{q.marks_total}
          </span>
        )}

        {isDebug && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
            style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: 'rgb(var(--accent))' }}
          >
            {q.visible_cases_passed}/{q.visible_cases_total} vis · {q.hidden_cases_passed}/{q.hidden_cases_total} hid
          </span>
        )}

        <span className="text-xs shrink-0" style={{ color: 'rgb(var(--text-secondary))' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t space-y-3" style={{ borderColor: 'var(--glass-border)' }}>
          {isMCQ && (
            <div className="space-y-2">
              {(q.options ?? []).map((opt: any) => {
                const selected = opt.was_selected;
                const correct = opt.is_correct;
                let bg = 'rgba(255,255,255,0.04)';
                let border = 'var(--glass-border)';
                let icon = '';
                if (correct && selected) {
                  bg = 'rgba(74,222,128,0.1)';
                  border = 'rgba(74,222,128,0.4)';
                  icon = '✓';
                } else if (correct) {
                  bg = 'rgba(74,222,128,0.06)';
                  border = 'rgba(74,222,128,0.25)';
                  icon = '✓';
                } else if (selected) {
                  bg = 'rgba(239,68,68,0.1)';
                  border = 'rgba(239,68,68,0.4)';
                  icon = '✗';
                }

                return (
                  <div
                    key={opt.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: bg, border: `1px solid ${border}` }}
                  >
                    {icon && (
                      <span
                        className="font-bold text-xs shrink-0"
                        style={{ color: correct ? '#4ade80' : '#f87171' }}
                      >
                        {icon}
                      </span>
                    )}
                    <span style={{ color: 'rgb(var(--text-primary))' }}>{opt.option_text}</span>
                    {selected && !correct && (
                      <span className="ml-auto text-xs" style={{ color: '#f87171' }}>
                        Your answer
                      </span>
                    )}
                    {correct && (
                      <span className="ml-auto text-xs" style={{ color: '#4ade80' }}>
                        Correct
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isDebug && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-lg p-3 text-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}
                >
                  <p
                    className="text-lg font-bold"
                    style={{
                      color: q.visible_cases_passed === q.visible_cases_total ? '#4ade80' : '#facc15',
                    }}
                  >
                    {q.visible_cases_passed}/{q.visible_cases_total}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Visible cases
                  </p>
                </div>
                <div
                  className="rounded-lg p-3 text-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}
                >
                  <p
                    className="text-lg font-bold"
                    style={{
                      color: q.hidden_cases_passed === q.hidden_cases_total ? '#4ade80' : '#f87171',
                    }}
                  >
                    {q.hidden_cases_passed}/{q.hidden_cases_total}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Hidden cases
                  </p>
                </div>
              </div>

              {q.submitted_code && (
                <div>
                  <p className="text-xs mb-1.5 font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Submitted Code
                  </p>
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
                    <Editor
                      height="200px"
                      language={q.language === 'cpp' ? 'cpp' : 'python'}
                      theme={monacoTheme}
                      value={q.submitted_code}
                      options={{
                        readOnly: true,
                        fontSize: 12,
                        minimap: { enabled: false },
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        padding: { top: 8 },
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimeTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-3 py-2 text-xs" style={{ color: 'rgb(var(--text-primary))' }}>
      <p className="font-medium">{payload[0].payload.label}</p>
      <p style={{ color: 'rgb(var(--accent))' }}>{payload[0].value}s</p>
    </div>
  );
}

export default function ResultsApp({ attemptId }: ResultsAppProps) {
  const { theme } = useTheme();
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'light';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!attemptId) return;
    api
      .get(`/attempts/${attemptId}/result`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error ?? 'Failed to load results'))
      .finally(() => setLoading(false));
  }, [attemptId]);

  // Lenis smooth scroll
  useEffect(() => {
    if (!containerRef.current) return;

    const lenis = new Lenis({
      wrapper: containerRef.current,
      duration: 1.2,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            Loading results...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="glass p-10 text-center max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  const { attempt, result, section_scores, breakdown } = data;
  const { grade, color } = gradeBand(result.percentage);
  const pct = Math.round(result.percentage);

  // Integrity violation banner
  const isIntegrityViolation = attempt.auto_submit_reason === 'integrity_violation';

  // Topic breakdown
  const topicMap: Record<string, { earned: number; total: number }> = {};
  breakdown.forEach((q: any) => {
    if (!q.topic_tag) return;
    if (!topicMap[q.topic_tag]) topicMap[q.topic_tag] = { earned: 0, total: 0 };
    topicMap[q.topic_tag].earned += q.marks_awarded;
    topicMap[q.topic_tag].total += q.marks_total;
  });

  // Time chart data
  const timeData = breakdown
    .filter((q: any) => q.time_spent_seconds != null)
    .map((q: any) => ({
      label: `Q${q.number}`,
      value: q.time_spent_seconds,
      color: marksColor(q.marks_awarded, q.marks_total),
    }));

  // MCQ accuracy
  const mcqAnswered = breakdown.filter(
    (q: any) => (q.type === 'mcq_single' || q.type === 'mcq_multi') && q.answered
  );
  const mcqAccuracy = mcqAnswered.length
    ? Math.round((mcqAnswered.filter((q: any) => q.is_correct).length / mcqAnswered.length) * 100)
    : null;

  // Debug avg test cases
  const debugAnswered = breakdown.filter((q: any) => q.type === 'debugging' && q.answered);
  const debugAvg = debugAnswered.length
    ? Math.round(
        (debugAnswered.reduce(
          (s: number, q: any) => s + (q.visible_cases_total > 0 ? q.visible_cases_passed / q.visible_cases_total : 0),
          0
        ) /
          debugAnswered.length) *
          100
      )
    : null;

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      <div className="p-8 space-y-8">
        {/* Integrity violation banner */}
        {isIntegrityViolation && (
          <div
            className="rounded-xl p-5 flex items-center gap-3"
            style={{ backgroundColor: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.5)' }}
          >
            <span className="text-3xl">⚠️</span>
            <div>
              <p className="text-base font-bold" style={{ color: '#f87171' }}>
                Submitted due to integrity violation
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                Your test was auto-submitted after exceeding the allowed tab switches.
              </p>
            </div>
          </div>
        )}

        {/* Score Hero */}
        <div className="glass p-8">
          <p className="text-sm font-medium text-center mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>
            {attempt.test_title}
          </p>
          <p className="text-xs text-center mb-6" style={{ color: 'rgb(var(--text-secondary))' }}>
            Submitted {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : '—'}
            {attempt.time_taken_mins != null && ` · ${attempt.time_taken_mins} min`}
          </p>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="shrink-0">
              <ScoreCircle score={result.total_score} total={result.total_marks} pct={pct} />
              <p className="text-center text-2xl font-bold mt-2" style={{ color }}>
                {pct}%
              </p>
            </div>

            <div className="flex-1 w-full space-y-4">
              {result.rank && (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}
                >
                  <span className="text-2xl">🏆</span>
                  <div>
                    <p className="text-lg font-bold" style={{ color: 'rgb(var(--accent))' }}>
                      #{result.rank} on leaderboard
                    </p>
                    <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                      {result.pass_fail_overall ? 'Passed' : 'Failed'}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div
                  className="rounded-xl p-3 text-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
                >
                  <p className="text-base font-bold" style={{ color: '#4ade80' }}>
                    {section_scores.mcqScore}/{section_scores.mcqTotal}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                    MCQ Score
                  </p>
                </div>
                <div
                  className="rounded-xl p-3 text-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
                >
                  <p className="text-base font-bold" style={{ color: 'rgb(var(--accent))' }}>
                    {section_scores.debugScore}/{section_scores.debugTotal}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Coding Score
                  </p>
                </div>
                <div
                  className="rounded-xl p-3 text-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
                >
                  <p className="text-base font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
                    {breakdown.filter((q: any) => q.answered).length}/{breakdown.length}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Attempted
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Question Breakdown */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>
            Question Breakdown
          </h2>
          <div className="space-y-2">
            {breakdown.map((q: any, i: number) => (
              <QuestionRow key={q.question_id} q={q} idx={i} monacoTheme={monacoTheme} />
            ))}
          </div>
        </div>

        {/* Performance Summary */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>
            Performance Summary
          </h2>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {mcqAccuracy !== null && (
              <div className="glass p-5">
                <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                  MCQ Accuracy
                </p>
                <p className="text-3xl font-bold" style={{ color: mcqAccuracy >= 60 ? '#4ade80' : '#f87171' }}>
                  {mcqAccuracy}%
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                  {mcqAnswered.filter((q: any) => q.is_correct).length} correct of {mcqAnswered.length} answered
                </p>
              </div>
            )}
            {debugAvg !== null && (
              <div className="glass p-5">
                <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Avg Visible Cases Passed
                </p>
                <p className="text-3xl font-bold" style={{ color: debugAvg >= 60 ? '#4ade80' : '#f87171' }}>
                  {debugAvg}%
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                  across {debugAnswered.length} coding question{debugAnswered.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>

          {timeData.length > 0 && (
            <div className="glass p-5 mb-4">
              <p className="text-xs font-medium mb-4" style={{ color: 'rgb(var(--text-secondary))' }}>
                Time Spent per Question (seconds)
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={timeData} barSize={28}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'rgb(148 163 184)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'rgb(148 163 184)' }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip content={<TimeTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {timeData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {Object.keys(topicMap).length > 0 && (
            <div className="glass p-5">
              <p className="text-xs font-medium mb-4" style={{ color: 'rgb(var(--text-secondary))' }}>
                Topic-wise Breakdown
              </p>
              <div className="space-y-3">
                {Object.entries(topicMap).map(([topic, { earned, total }]) => {
                  const topicPct = total > 0 ? Math.round((earned / total) * 100) : 0;
                  const tc = marksColor(earned, total);
                  return (
                    <div key={topic}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: 'rgb(var(--text-primary))' }}>{topic}</span>
                        <span style={{ color: tc }}>
                          {earned}/{total} ({topicPct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${topicPct}%`, backgroundColor: tc }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
