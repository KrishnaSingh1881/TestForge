import { useEffect, useMemo, useState } from 'react';
import api from '../../lib/axios';
import { useLenis } from '../../hooks/useLenis';

interface BehavioralFlag { type: string; label: string; question_id: string; }
interface BehavioralDetail {
  question_id: string;
  time_to_first_keystroke: number | null;
  paste_events: number;
  backspace_count: number;
  edit_count: number;
  wpm_consistency: number;
  test_runs_before_submit: number;
  idle_periods: { start: string; duration_seconds: number }[];
}
interface AttemptRow {
  attempt_id: string;
  student_name: string;
  student_email: string;
  division: string;
  year: string;
  tab_switches: number;
  focus_lost_count: number;
  integrity_score: number | null;
  total_score: number | null;
  total_marks: number | null;
  percentage: number | null;
  similarity_flag_count: number;
  behavioral_flags: BehavioralFlag[];
  behavioral_detail: BehavioralDetail[];
}

interface SimilarityFlag {
  id: string;
  similarity_score: number;
  admin_verdict: 'pending' | 'confirmed' | 'dismissed';
  reviewed: boolean;
  flagged_at: string;
  question_id: string;
  question_statement: string;
  attempt_id_1: string;
  attempt_id_2: string;
  student1: string;
  student2: string;
  code1: string | null;
  code2: string | null;
  language: string;
}

function scoreColor(score: number | null) {
  if (score === null) return 'rgb(var(--text-secondary))';
  if (score >= 80) return '#4ade80';
  if (score >= 60) return '#facc15';
  return '#f87171';
}
function scoreBg(score: number | null) {
  if (score === null) return 'rgba(255,255,255,0.07)';
  if (score >= 80) return 'rgba(74,222,128,0.12)';
  if (score >= 60) return 'rgba(234,179,8,0.12)';
  return 'rgba(239,68,68,0.12)';
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="glass p-5 text-center">
      <p className="text-2xl font-bold" style={{ color: color ?? 'rgb(var(--accent))' }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>{label}</p>
    </div>
  );
}

function BehavioralPanel({ detail, flags }: { detail: BehavioralDetail[]; flags: BehavioralFlag[] }) {
  if (!detail.length) {
    return <p className="text-xs py-2" style={{ color: 'rgb(var(--text-secondary))' }}>No coding responses recorded.</p>;
  }

  return (
    <div className="space-y-3 pt-1">
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {flags.map((f, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
              ⚠ {f.label}
            </span>
          ))}
        </div>
      )}

      {detail.map((d, i) => (
        <div key={i} className="rounded-xl p-3"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'rgb(var(--text-secondary))' }}>
            Coding Q{i + 1}
          </p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { label: 'First Key',  value: d.time_to_first_keystroke != null ? `${(d.time_to_first_keystroke / 1000).toFixed(1)}s` : '—' },
              { label: 'Pastes',     value: d.paste_events,            warn: d.paste_events > 0 },
              { label: 'Backspaces', value: d.backspace_count,         warn: d.backspace_count === 0 },
              { label: 'Edits',      value: d.edit_count },
              { label: 'WPM',        value: d.wpm_consistency },
              { label: 'Test Runs',  value: d.test_runs_before_submit },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-sm font-semibold"
                  style={{ color: (s as any).warn ? '#f87171' : 'rgb(var(--text-primary))' }}>
                  {s.value}
                </p>
                <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{s.label}</p>
              </div>
            ))}
          </div>
          {d.idle_periods.length > 0 && (
            <p className="text-xs mt-2" style={{ color: '#facc15' }}>
              ⏸ {d.idle_periods.length} idle period{d.idle_periods.length !== 1 ? 's' : ''} detected
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    pending:   { bg: 'rgba(234,179,8,0.12)',  color: '#facc15', label: 'Pending'   },
    confirmed: { bg: 'rgba(239,68,68,0.12)',  color: '#f87171', label: 'Confirmed' },
    dismissed: { bg: 'rgba(74,222,128,0.12)', color: '#4ade80', label: 'Dismissed' },
  };
  const s = styles[verdict] ?? styles.pending;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function IntegrityApp({ appProps }: { appProps?: Record<string, unknown> }) {
  const lenisRef = useLenis();
  const testId = appProps?.testId as string | undefined;

  const [data, setData] = useState<{ attempts: AttemptRow[]; summary: any; test_title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Similarity report state
  const [showSimilarity, setShowSimilarity] = useState(false);
  const [similarityFlags, setSimilarityFlags] = useState<SimilarityFlag[]>([]);
  const [loadingSimilarity, setLoadingSimilarity] = useState(false);
  const [runningSimilarity, setRunningSimilarity] = useState(false);
  const [similarityResult, setSimilarityResult] = useState<{ pairs_analyzed: number; flags_raised: number } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState('');
  const [scoreFilter, setScoreFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    if (!testId) return;
    api.get(`/admin/tests/${testId}/integrity`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [testId]);

  async function loadSimilarityFlags() {
    if (!testId) return;
    setLoadingSimilarity(true);
    try {
      const r = await api.get(`/admin/tests/${testId}/similarity-flags`);
      setSimilarityFlags(r.data.flags ?? []);
    } catch (e: any) {
      console.error('Failed to load similarity flags:', e);
    } finally {
      setLoadingSimilarity(false);
    }
  }

  useEffect(() => {
    if (showSimilarity) {
      loadSimilarityFlags();
    }
  }, [showSimilarity]);

  async function handleRunSimilarity() {
    if (!testId) return;
    if (!confirm('Run similarity analysis on all submissions for this test? This may take a moment.')) return;
    setRunningSimilarity(true);
    try {
      const r = await api.post(`/admin/tests/${testId}/run-similarity`);
      setSimilarityResult({ pairs_analyzed: r.data.pairs_analyzed, flags_raised: r.data.flags_raised });
      await loadSimilarityFlags();
    } catch (e: any) {
      console.error('Similarity check failed:', e);
    } finally {
      setRunningSimilarity(false);
    }
  }

  async function handleVerdict(flagId: string, verdict: 'confirmed' | 'dismissed') {
    await api.patch(`/admin/flags/${flagId}/verdict`, { verdict });
    setSimilarityFlags(prev => prev.map(f =>
      f.id === flagId ? { ...f, admin_verdict: verdict, reviewed: true } : f
    ));
  }

  const divisions = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.attempts.map(a => a.division).filter(d => d !== '—'))].sort();
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    let list = [...data.attempts];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.student_name.toLowerCase().includes(q) || a.student_email.toLowerCase().includes(q));
    }
    if (divFilter) list = list.filter(a => a.division === divFilter);
    if (scoreFilter === 'high')   list = list.filter(a => (a.integrity_score ?? 100) >= 80);
    if (scoreFilter === 'medium') list = list.filter(a => (a.integrity_score ?? 100) >= 60 && (a.integrity_score ?? 100) < 80);
    if (scoreFilter === 'low')    list = list.filter(a => (a.integrity_score ?? 100) < 60);

    list.sort((a, b) => {
      const sa = a.integrity_score ?? 100;
      const sb = b.integrity_score ?? 100;
      return sortAsc ? sa - sb : sb - sa;
    });

    return list;
  }, [data, search, divFilter, scoreFilter, sortAsc]);

  const inputStyle = {
    backgroundColor: 'rgba(255,255,255,0.07)',
    border: '1px solid var(--glass-border)',
    color: 'rgb(var(--text-primary))',
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Loading integrity data...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="h-full flex items-center justify-center">
      <div className="glass p-10 text-center max-w-md">
        <p className="text-red-400 mb-4">{error}</p>
      </div>
    </div>
  );

  const { summary } = data!;

  const pending   = similarityFlags.filter(f => f.admin_verdict === 'pending').length;
  const confirmed = similarityFlags.filter(f => f.admin_verdict === 'confirmed').length;
  const dismissed = similarityFlags.filter(f => f.admin_verdict === 'dismissed').length;

  return (
    <div ref={lenisRef} className="h-full overflow-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
            Integrity Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
            {data?.test_title}
          </p>
        </div>
        <button onClick={() => setShowSimilarity(v => !v)}
          className="text-xs px-3 py-2 rounded-lg transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))', border: '1px solid rgba(99,102,241,0.3)' }}>
          {showSimilarity ? '← Back to Integrity' : 'Similarity Report →'}
        </button>
      </div>

      {!showSimilarity ? (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox label="Total Attempts"    value={summary.total} />
            <StatBox label="Avg Integrity"     value={`${summary.avg_integrity}`}
              color={scoreColor(summary.avg_integrity)} />
            <StatBox label="High Risk (< 60)"  value={summary.high_risk}
              color={summary.high_risk > 0 ? '#f87171' : '#4ade80'} />
            <StatBox label="Similarity Flags"  value={summary.similarity_flags}
              color={summary.similarity_flags > 0 ? '#facc15' : '#4ade80'} />
          </div>

          {/* Filter bar */}
          <div className="glass p-4 flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-48"
              style={inputStyle}
            />

            <select value={divFilter} onChange={e => setDivFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              style={inputStyle}>
              <option value="">All Divisions</option>
              {divisions.map(d => <option key={d} value={d}>Division {d}</option>)}
            </select>

            <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              style={inputStyle}>
              <option value="all">All Scores</option>
              <option value="high">High (≥ 80)</option>
              <option value="medium">Medium (60–79)</option>
              <option value="low">Low (&lt; 60)</option>
            </select>

            <button onClick={() => setSortAsc(v => !v)}
              className="px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
              Sort: {sortAsc ? 'Worst first ↑' : 'Best first ↓'}
            </button>

            <span className="ml-auto text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
              {rows.length} student{rows.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Integrity table */}
          {rows.length === 0 ? (
            <div className="glass p-12 text-center">
              <p style={{ color: 'rgb(var(--text-secondary))' }}>No results match your filters.</p>
            </div>
          ) : (
            <div className="glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    {['Student', 'Div', 'Integrity', 'Tab Sw.', 'Focus Lost', 'Behavioral', 'Similarity', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide"
                        style={{ color: 'rgb(var(--text-secondary))' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isExpanded = expanded === row.attempt_id;
                    const sc = row.integrity_score;

                    return (
                      <>
                        <tr key={row.attempt_id}
                          style={{ borderBottom: '1px solid var(--glass-border)', backgroundColor: isExpanded ? 'rgba(99,102,241,0.05)' : 'transparent' }}>

                          <td className="px-4 py-3">
                            <p className="font-medium text-sm" style={{ color: 'rgb(var(--text-primary))' }}>
                              {row.student_name}
                            </p>
                            <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                              {row.year}
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                              {row.division}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span className="text-sm font-bold px-2.5 py-1 rounded-full"
                              style={{ backgroundColor: scoreBg(sc), color: scoreColor(sc) }}>
                              {sc ?? '—'}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span className="text-sm" style={{ color: row.tab_switches > 0 ? '#f87171' : 'rgb(var(--text-secondary))' }}>
                              {row.tab_switches}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span className="text-sm" style={{ color: row.focus_lost_count > 2 ? '#facc15' : 'rgb(var(--text-secondary))' }}>
                              {row.focus_lost_count}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            {row.behavioral_flags.length > 0 ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                                {row.behavioral_flags.length} flag{row.behavioral_flags.length !== 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: '#4ade80' }}>Clean</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {row.similarity_flag_count > 0 ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: 'rgba(234,179,8,0.12)', color: '#facc15' }}>
                                {row.similarity_flag_count}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>—</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <button
                              onClick={() => setExpanded(isExpanded ? null : row.attempt_id)}
                              className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                              style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: 'rgb(var(--accent))' }}>
                              {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${row.attempt_id}-detail`}
                            style={{ borderBottom: '1px solid var(--glass-border)', backgroundColor: 'rgba(99,102,241,0.03)' }}>
                            <td colSpan={8} className="px-6 py-4">
                              <BehavioralPanel
                                detail={row.behavioral_detail}
                                flags={row.behavioral_flags}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Similarity Report View */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
                Similarity Report
              </h2>
              {similarityFlags.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}>
                    {similarityFlags.length} pair{similarityFlags.length !== 1 ? 's' : ''} flagged
                  </span>
                  {confirmed > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                      {confirmed} confirmed
                    </span>
                  )}
                  {dismissed > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>
                      {dismissed} dismissed
                    </span>
                  )}
                  {pending > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(234,179,8,0.12)', color: '#facc15' }}>
                      {pending} pending
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleRunSimilarity}
              disabled={runningSimilarity}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50 shrink-0"
              style={{ backgroundColor: 'rgb(var(--accent))' }}>
              {runningSimilarity ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : '🔍 Run Similarity Check'}
            </button>
          </div>

          {similarityResult && (
            <div className="glass px-5 py-3 mb-4 flex items-center gap-3"
              style={{ border: '1px solid rgba(99,102,241,0.3)' }}>
              <span style={{ color: 'rgb(var(--accent))' }}>✓</span>
              <p className="text-sm" style={{ color: 'rgb(var(--text-primary))' }}>
                Analysis complete — {similarityResult.pairs_analyzed} pair{similarityResult.pairs_analyzed !== 1 ? 's' : ''} analyzed,{' '}
                <span style={{ color: similarityResult.flags_raised > 0 ? '#f87171' : '#4ade80' }}>
                  {similarityResult.flags_raised} new flag{similarityResult.flags_raised !== 1 ? 's' : ''} raised
                </span>
              </p>
            </div>
          )}

          {loadingSimilarity ? (
            <p className="text-sm text-center py-12" style={{ color: 'rgb(var(--text-secondary))' }}>Loading...</p>
          ) : similarityFlags.length === 0 ? (
            <div className="glass p-12 text-center">
              <p className="text-lg mb-2" style={{ color: 'rgb(var(--text-primary))' }}>No flags yet</p>
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                Run the similarity check after the test ends to analyze submissions.
              </p>
            </div>
          ) : (
            <div className="glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    {['Student 1', 'Student 2', 'Question', 'Similarity', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide"
                        style={{ color: 'rgb(var(--text-secondary))' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {similarityFlags.map((flag, i) => {
                    const pct = Math.round(flag.similarity_score * 100);
                    const scoreColor = pct >= 95 ? '#f87171' : pct >= 90 ? '#fb923c' : '#facc15';

                    return (
                      <tr key={flag.id}
                        style={{ borderBottom: i < similarityFlags.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                          {flag.student1}
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                          {flag.student2}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                            {flag.question_statement}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold tabular-nums" style={{ color: scoreColor }}>
                            {pct}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <VerdictBadge verdict={flag.admin_verdict} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {flag.admin_verdict === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleVerdict(flag.id, 'confirmed')}
                                  className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                                  style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                                  Confirm
                                </button>
                                <button
                                  onClick={() => handleVerdict(flag.id, 'dismissed')}
                                  className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                                  style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                                  Dismiss
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
