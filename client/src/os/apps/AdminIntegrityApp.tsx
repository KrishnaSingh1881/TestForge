import { useEffect, useState, useMemo } from 'react';
import api from '../../lib/axios';
import {
  FiShield, FiAlertTriangle, FiActivity, FiSearch, FiArrowLeft,
  FiChevronRight, FiCheckCircle, FiSlash, FiUsers, FiList,
  FiPlay, FiLayers, FiCpu, FiClock, FiBarChart2, FiFilter,
} from 'react-icons/fi';
import OrbitalBuffer from '../components/OrbitalBuffer';
import AnimatedList from '../../components/AnimatedList';
import GlassSelect from '../../components/admin/GlassSelect';
import SimilarityFlagsPanel from './integrity/SimilarityFlagsPanel';
import AttemptAuditPanel from './integrity/AttemptAuditPanel';

// ── helpers ──────────────────────────────────────────────────────────────────
function scoreColor(score: number | null) {
  if (score === null || score === undefined) return 'rgba(255,255,255,0.4)';
  if (score >= 90) return '#4ade80';
  if (score >= 70) return '#facc15';
  return '#f87171';
}

function riskLabel(score: number | null) {
  if (score === null) return { label: 'Unscored', color: 'rgba(255,255,255,0.2)' };
  if (score >= 90) return { label: 'Clean', color: '#4ade80' };
  if (score >= 70) return { label: 'Low Risk', color: '#facc15' };
  return { label: 'High Risk', color: '#f87171' };
}

// ── View: Test List ───────────────────────────────────────────────────────────
function TestListView({
  onSelect,
}: {
  onSelect: (test: { id: string; title: string }) => void;
}) {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/tests')
      .then(r => setTests(r.data.tests ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => tests.filter(t => t.title?.toLowerCase().includes(search.toLowerCase())),
    [tests, search],
  );

  return (
    <div className="p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6">
      {/* Search */}
      <div className="relative group">
        <FiSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-accent transition-colors" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tests..."
          className="w-full pl-14 pr-6 py-4 glass-2 border border-white/5 rounded-[1.5rem] text-[11px] text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all font-black uppercase tracking-[0.2em] placeholder:text-white/10"
        />
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <OrbitalBuffer size={48} className="text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-32 text-center glass-2 border-dashed border-white/10 rounded-[3.5rem]">
          <FiList className="mx-auto text-5xl text-white/5 mb-6" />
          <p className="text-[12px] font-black text-white/20 tracking-[0.5em] uppercase">No Tests Found</p>
        </div>
      ) : (
        <AnimatedList items={filtered} className="grid grid-cols-1" gap={16} renderItem={(t) => {
          const statusColor =
            t.status === 'ended' ? '#4ade80' :
            t.status === 'active' ? '#facc15' :
            'rgba(255,255,255,0.2)';
          return (
            <div
              onClick={() => onSelect({ id: t.id, title: t.title })}
              className="group glass-2 p-8 flex items-center gap-8 rounded-[3rem] border border-white/5 hover:bg-white/[0.05] hover:border-accent/30 cursor-pointer transition-all active:scale-[0.98]"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-accent/10 transition-colors shrink-0">
                <FiLayers className="text-secondary group-hover:text-accent text-xl transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-black text-primary truncate uppercase tracking-tight group-hover:text-accent transition-colors">
                    {t.title}
                  </h3>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-current opacity-60 shrink-0" style={{ color: statusColor }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                    <span className="text-[8px] font-black tracking-widest uppercase">{t.status}</span>
                  </div>
                </div>
                <p className="text-[10px] text-secondary font-black uppercase tracking-[0.3em] opacity-40 mt-1">
                  {[t.subject, t.year, t.division].filter(Boolean).join(' · ')}
                </p>
              </div>
              <FiChevronRight className="text-secondary opacity-10 group-hover:translate-x-2 group-hover:opacity-100 transition-all text-xl" />
            </div>
          );
        }} />
      )}
    </div>
  );
}

// ── View: Student List ────────────────────────────────────────────────────────
function StudentListView({
  testId,
  testTitle,
  onSelect,
}: {
  testId: string;
  testTitle: string;
  onSelect: (attemptId: string, studentName: string) => void;
}) {
  const [students, setStudents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'integrity_asc' | 'integrity_desc' | 'name' | 'flags'>('integrity_asc');
  const [tab, setTab] = useState<'students' | 'similarity'>('students');

  useEffect(() => {
    api.get(`/admin/tests/${testId}/integrity`)
      .then(r => { setStudents(r.data.attempts ?? []); setSummary(r.data.summary); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [testId]);

  const sorted = useMemo(() => {
    const filtered = students.filter(s =>
      s.student_name?.toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      if (sort === 'integrity_asc')  return (a.integrity_score ?? 101) - (b.integrity_score ?? 101);
      if (sort === 'integrity_desc') return (b.integrity_score ?? -1)  - (a.integrity_score ?? -1);
      if (sort === 'flags')          return (b.behavioral_flags?.length ?? 0) - (a.behavioral_flags?.length ?? 0);
      return (a.student_name ?? '').localeCompare(b.student_name ?? '');
    });
  }, [students, search, sort]);

  return (
    <div className="p-10 space-y-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-6">

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Attempts',    val: summary.total,            icon: <FiUsers /> },
            { label: 'High Risk',         val: summary.high_risk,        color: summary.high_risk > 0 ? '#f87171' : '#4ade80', icon: <FiShield /> },
            { label: 'Similarity Flags',  val: summary.similarity_flags, color: summary.similarity_flags > 0 ? '#facc15' : '#4ade80', icon: <FiBarChart2 /> },
          ].map((s, i) => (
            <div key={i} className="glass-2 p-6 rounded-[2rem] border-white/5 text-center">
              <p className="text-[9px] font-black text-secondary uppercase tracking-[0.3em] opacity-40 mb-2">{s.label}</p>
              <p className="text-3xl font-black tabular-nums" style={{ color: (s as any).color ?? 'rgb(var(--accent))' }}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab + controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2 p-1.5 glass-2 rounded-[1.5rem] border border-white/10 shrink-0">
          {(['students', 'similarity'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${tab === t ? 'bg-white/10 text-primary' : 'text-secondary opacity-40 hover:opacity-100'}`}>
              {t === 'students' ? 'Students' : 'Similarity'}
            </button>
          ))}
        </div>

        {tab === 'students' && (
          <>
            <div className="relative flex-1 min-w-48 group">
              <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-accent transition-colors text-sm" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search students..."
                className="w-full pl-12 pr-5 py-3 glass-2 border border-white/5 rounded-[1.5rem] text-[11px] text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all font-black uppercase tracking-[0.2em] placeholder:text-white/10"
              />
            </div>
            <GlassSelect
              value={sort}
              onChange={v => setSort(v as any)}
              options={[
                { value: 'integrity_asc',  label: 'Sort: Lowest Integrity' },
                { value: 'integrity_desc', label: 'Sort: Highest Integrity' },
                { value: 'flags',          label: 'Sort: Most Flags' },
                { value: 'name',           label: 'Sort: Name A–Z' },
              ]}
              className="w-56"
            />
          </>
        )}
      </div>

      {tab === 'similarity' ? (
        <SimilarityFlagsPanel testId={testId} />
      ) : loading ? (
        <div className="h-64 flex items-center justify-center">
          <OrbitalBuffer size={48} className="text-accent" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-24 text-center glass-2 border-dashed border-white/10 rounded-[3.5rem]">
          <FiUsers className="mx-auto text-5xl text-white/10 mb-6" />
          <p className="text-[12px] font-black text-white/20 tracking-[0.5em] uppercase">No Submissions Yet</p>
        </div>
      ) : (
        <AnimatedList items={sorted} className="grid grid-cols-1" gap={12} renderItem={(s) => {
          const risk = riskLabel(s.integrity_score);
          const highFlags = (s.behavioral_flags ?? []).filter((f: any) => f.severity === 'high').length;
          const medFlags  = (s.behavioral_flags ?? []).filter((f: any) => f.severity === 'medium').length;
          const hasSim    = (s.similarity_flag_count ?? 0) > 0;
          return (
            <div
              onClick={() => onSelect(s.attempt_id, s.student_name)}
              className={`group glass-2 p-6 flex items-center gap-6 rounded-[2.5rem] border border-white/5 hover:bg-white/[0.06] cursor-pointer transition-all active:scale-[0.98] ${(s.integrity_score ?? 100) < 60 ? 'hover:border-red-500/30' : 'hover:border-accent/30'}`}
            >
              {/* Avatar */}
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black shrink-0 border ${(s.integrity_score ?? 100) < 60 ? 'bg-red-500/10 text-red-500 border-red-500/20' : (s.integrity_score ?? 100) < 80 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                {s.student_name?.[0] ?? '?'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-black text-primary uppercase tracking-tight truncate group-hover:text-accent transition-colors">
                  {s.student_name}
                </h4>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {highFlags > 0 && <span className="text-[8px] font-black px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/20 rounded-full tracking-widest uppercase">{highFlags} critical</span>}
                  {medFlags  > 0 && <span className="text-[8px] font-black px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-full tracking-widest uppercase">{medFlags} medium</span>}
                  {hasSim        && <span className="text-[8px] font-black px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-full tracking-widest uppercase">similarity match</span>}
                  {highFlags === 0 && medFlags === 0 && !hasSim && <span className="text-[8px] font-black px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full tracking-widest uppercase">clean</span>}
                </div>
              </div>

              <FiChevronRight className="text-secondary opacity-10 group-hover:translate-x-1 group-hover:opacity-60 transition-all" />
            </div>
          );
        }} />
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
type View = 'tests' | 'students' | 'audit';

export default function AdminIntegrityApp() {
  const [view, setView]           = useState<View>('tests');
  const [selectedTest, setSelectedTest]   = useState<{ id: string; title: string } | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<{ id: string; name: string } | null>(null);

  const handleBack = () => {
    if (view === 'audit')    { setView('students'); setSelectedAttempt(null); }
    else if (view === 'students') { setView('tests'); setSelectedTest(null); }
  };

  const title =
    view === 'tests'    ? 'Integrity Monitor' :
    view === 'students' ? selectedTest?.title ?? 'Students' :
    `Audit: ${selectedAttempt?.name ?? ''}`;

  const subtitle =
    view === 'tests'    ? 'Select a test to inspect' :
    view === 'students' ? 'Select a student to view analytics' :
    'Behavioral & forensic analysis';

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-5 px-8 py-5 border-b border-white/5 bg-white/[0.01] shrink-0">
        {view !== 'tests' && (
          <button
            onClick={handleBack}
            className="p-3 rounded-xl hover:bg-white/5 transition-all border border-white/5 active:scale-90 group shrink-0"
          >
            <FiArrowLeft className="text-secondary group-hover:text-primary transition-colors" />
          </button>
        )}
        <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
          <FiShield className="text-red-500 text-sm" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-primary tracking-tighter uppercase truncate">{title}</h1>
          <p className="text-[9px] font-black uppercase text-secondary tracking-[0.3em] opacity-30 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {view === 'tests' && (
          <TestListView
            onSelect={t => { setSelectedTest(t); setView('students'); }}
          />
        )}

        {view === 'students' && selectedTest && (
          <StudentListView
            testId={selectedTest.id}
            testTitle={selectedTest.title}
            onSelect={(id, name) => { setSelectedAttempt({ id, name }); setView('audit'); }}
          />
        )}

        {view === 'audit' && selectedAttempt && selectedTest && (
          <AttemptAuditPanel
            attemptId={selectedAttempt.id}
            testId={selectedTest.id}
            studentName={selectedAttempt.name}
          />
        )}
      </div>
    </div>
  );
}
