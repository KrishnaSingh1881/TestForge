
import { useEffect, useState, useMemo } from 'react';
import api from '../../lib/axios';
import AttachToTestModal from '../../components/admin/AttachToTestModal';
import { useOSStore } from '../store/useOSStore';
import AnimatedList from '../../components/AnimatedList';
import { FiPlus, FiBox, FiSettings, FiSearch, FiFolder, FiEdit3, FiPlay, FiSquare, FiTrash2, FiBarChart, FiShield, FiArrowLeft, FiClock, FiCalendar, FiUsers } from 'react-icons/fi';
import { GlassIcon } from '../components/AppIcons';

interface Test {
  id: string;
  title: string;
  subject: string;
  year: string;
  division: string;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  questions_per_attempt: number;
  randomize_questions: boolean;
  status: 'draft' | 'active' | 'ended';
  created_at: string;
}

type View = 'list' | 'create' | 'edit';

const inputCls = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none bg-white/[0.05] border border-white/10 text-white focus:ring-2 focus:ring-indigo-500/50 transition-all';
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5 ml-1';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; icon: any }> = {
    draft:  { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', icon: FiBox },
    active: { bg: 'rgba(74,222,128,0.1)',  color: '#4ade80', icon: FiPlay },
    ended:  { bg: 'rgba(239,68,68,0.1)',   color: '#f87171', icon: FiSquare },
  };
  const s = styles[status] ?? styles.draft;
  const Icon = s.icon;
  return (
    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/5 shadow-sm"
      style={{ backgroundColor: s.bg, color: s.color }}>
      <Icon className="text-xs" />
      {status}
    </span>
  );
}

export default function TestManagerApp() {
  const { openWindow } = useOSStore();

  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [editing, setEditing] = useState<Test | null>(null);
  const [attachTestId, setAttachTestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [year, setYear] = useState('');
  const [division, setDivision] = useState('');
  const [duration, setDuration] = useState(60);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [questionsPerAttempt, setQuestionsPerAttempt] = useState(10);
  const [randomize, setRandomize] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/tests');
      setTests(r.data.tests ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setTitle('');
    setSubject('');
    setYear('');
    setDivision('');
    setDuration(60);
    setStartTime('');
    setEndTime('');
    setQuestionsPerAttempt(10);
    setRandomize(false);
    setError('');
  }

  function handleCreate() {
    resetForm();
    setEditing(null);
    setView('create');
  }

  function handleEdit(test: Test) {
    setEditing(test);
    setTitle(test.title);
    setSubject(test.subject);
    setYear(test.year);
    setDivision(test.division);
    setDuration(test.duration_minutes);
    setStartTime(test.start_time.slice(0, 16));
    setEndTime(test.end_time.slice(0, 16));
    setQuestionsPerAttempt(test.questions_per_attempt);
    setRandomize(test.randomize_questions);
    setView('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim() || !subject.trim() || !year || !division || !startTime || !endTime) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title, subject, year, division,
        duration_minutes: duration,
        start_time: startTime,
        end_time: endTime,
        questions_per_attempt: questionsPerAttempt,
        randomize_questions: randomize,
      };

      if (editing) await api.patch(`/tests/${editing.id}`, payload);
      else await api.post('/tests', payload);

      setView('list');
      load();
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Permanently delete this test?')) return;
    await api.delete(`/tests/${id}`);
    setTests(prev => prev.filter(t => t.id !== id));
  }

  async function handleStatusChange(id: string, status: 'active' | 'ended') {
    if (!confirm(`Are you sure you want to ${status === 'active' ? 'START' : 'END'} this test?`)) return;
    try {
      await api.patch(`/tests/${id}`, { status });
      load();
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Status update failed');
    }
  }

  const filteredTests = useMemo(() => {
    return tests.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase()));
  }, [tests, search]);

  return (
    <div className="h-full flex flex-col bg-[#0c0c16]/60 backdrop-blur-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-6 p-6 border-b border-white/5">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FiFolder className="text-indigo-400" />
            Test Manager
          </h1>
          <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mt-0.5">
            {view === 'list' ? `Managing ${tests.length} academic evaluations` : editing ? `Editing: ${editing.title}` : 'Creating new evaluation'}
          </p>
        </div>

        {view === 'list' ? (
          <div className="flex items-center gap-3">
             <div className="relative w-64 mr-2">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                    type="text" 
                    placeholder="Quick search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
            </div>
            <button onClick={handleCreate} className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 transition-all">+ New Test</button>
          </div>
        ) : (
          <button onClick={() => setView('list')} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 text-white/60 hover:bg-white/10 transition-all flex items-center gap-2">
            <FiArrowLeft /> Cancel
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading && view === 'list' ? (
             <div className="h-full flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
             </div>
        ) : view === 'list' ? (
          <div className="p-6">
            {filteredTests.length === 0 ? (
                <div className="glass p-16 text-center border-dashed border-white/10">
                    <p className="text-sm font-black text-white/30 uppercase tracking-[0.4em]">No matching tests found</p>
                </div>
            ) : (
                <AnimatedList 
                  items={filteredTests}
                  containerClassName="w-full"
                  className="max-h-none"
                  gap={16}
                  renderItem={(t) => (
                    <div className="group relative glass p-5 flex flex-col md:flex-row items-start md:items-center gap-6 transition-all hover:bg-white/[0.08] hover:border-indigo-500/30 overflow-hidden shadow-xl hover:shadow-indigo-500/5">
                        <div className="absolute inset-0 bg-linear-to-r from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="relative p-4 bg-indigo-500/10 rounded-2xl group-hover:scale-105 transition-all duration-500">
                            <GlassIcon id="folder" size="md" />
                        </div>

                        <div className="flex-1 min-w-0 relative">
                            <div className="flex items-center gap-3 mb-1.5">
                                <h3 className="text-lg font-black text-white truncate tracking-tight uppercase group-hover:text-indigo-400 transition-colors">{t.title}</h3>
                                <StatusBadge status={t.status} />
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-white/30">
                                <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded"><FiBox className="text-indigo-400" /> {t.subject}</span>
                                <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded"><FiUsers className="text-indigo-400" /> {t.year} • {t.division}</span>
                                <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded"><FiClock className="text-indigo-400" /> {t.duration_minutes}m</span>
                                <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded"><FiCalendar className="text-indigo-400" /> {new Date(t.start_time).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 relative">
                            {t.status === 'draft' && (
                                <>
                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(t); }} className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all"><FiEdit3 /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleStatusChange(t.id, 'active'); }} className="px-4 py-2.5 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">Start</button>
                                </>
                            )}
                            {t.status === 'active' && (
                                <button onClick={(e) => { e.stopPropagation(); handleStatusChange(t.id, 'ended'); }} className="px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">End Test</button>
                            )}
                            {(t.status === 'active' || t.status === 'ended') && (
                                <>
                                    <button onClick={(e) => { e.stopPropagation(); openWindow('results', { testId: t.id, testTitle: t.title }); }} className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"><FiBarChart /></button>
                                    <button onClick={(e) => { e.stopPropagation(); openWindow('integrity', { testId: t.id, testTitle: t.title }); }} className="p-2.5 rounded-xl bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500 hover:text-white transition-all"><FiShield /></button>
                                </>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); openWindow('question-bank', { testId: t.id, testTitle: t.title }); }} className="p-2.5 rounded-xl bg-white/10 text-white/40 hover:bg-white/20 hover:text-white transition-all transition-all"><FiSettings /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} className="p-2.5 rounded-xl bg-white/10 text-white/40 hover:bg-red-500 hover:text-white transition-all"><FiTrash2 /></button>
                        </div>
                    </div>
                  )}
                  onItemSelect={(t) => handleEdit(t)}
                />
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <h2 className="text-2xl font-black text-white tracking-widest uppercase border-b border-white/5 pb-4">{editing ? 'Edit Configuration' : 'Test Creation'}</h2>
            
            <div className="space-y-6">
                <div>
                   <label className={labelCls}>Title of the Evaluation *</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="e.g. End Semester Exam 2024" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label className={labelCls}>Academic Subject *</label>
                        <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className={inputCls} placeholder="e.g. Data Structures" />
                    </div>
                    <div>
                        <label className={labelCls}>Estimated Duration (Min) *</label>
                        <input type="number" min={1} value={duration} onChange={e => setDuration(Number(e.target.value))} className={inputCls} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className={labelCls}>Target Year *</label>
                        <select value={year} onChange={e => setYear(e.target.value)} className={inputCls}>
                             <option value="">Select Target Year</option>
                             {['FE', 'SE', 'TE', 'BE'].map(y => <option key={y} value={y} className="bg-[#0c0c16]">{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Departmental Division *</label>
                        <select value={division} onChange={e => setDivision(e.target.value)} className={inputCls}>
                             <option value="">Select Division</option>
                             <option value="ALL" className="bg-[#0c0c16]">All Divisions</option>
                             {['A', 'B', 'C', 'D'].map(d => <option key={d} value={d} className="bg-[#0c0c16]">{d}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className={labelCls}>Evaluation Start Window *</label>
                        <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Evaluation End Window *</label>
                        <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-6">
                    <div>
                        <label className={labelCls}>Questions per Participant</label>
                        <input type="number" min={1} value={questionsPerAttempt} onChange={e => setQuestionsPerAttempt(Number(e.target.value))} className={inputCls} />
                    </div>
                    <div className="flex items-center h-full pt-6">
                         <label className="group flex items-center gap-3 cursor-pointer p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all flex-1">
                            <input type="checkbox" checked={randomize} onChange={e => setRandomize(e.target.checked)} className="w-5 h-5 accent-indigo-500 rounded-lg" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/50 group-hover:text-white transition-colors">Randomize question sequence</span>
                        </label>
                    </div>
                </div>
            </div>

            {error && <p className="text-xs font-black uppercase tracking-widest text-red-400 bg-red-400/10 p-4 rounded-xl border border-red-400/20">{error}</p>}

            <div className="flex gap-4 pt-4 pb-12">
                <button type="submit" disabled={saving} className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50">
                    {saving ? 'Processing...' : editing ? 'Commit Changes' : 'Initialize Test'}
                </button>
                {editing && (
                    <button type="button" onClick={() => setAttachTestId(editing.id)} className="px-8 py-4 rounded-2xl bg-white/10 text-white font-black uppercase tracking-widest hover:bg-white/20 transition-all">
                        Attach Assets
                    </button>
                )}
            </div>
          </form>
        )}
      </div>

      {/* Attach modal */}
      {attachTestId && (
        <AttachToTestModal
          testId={attachTestId} 
          onClose={() => setAttachTestId(null)}
        />
      )}
    </div>
  );
}
