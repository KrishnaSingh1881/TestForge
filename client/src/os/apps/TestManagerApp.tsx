
import { useEffect, useState, useMemo } from 'react';
import api from '../../lib/axios';
import AttachToTestModal from '../../components/admin/AttachToTestModal';
import { useOSStore } from '../store/useOSStore';
import AnimatedList from '../../components/AnimatedList';
import { FiPlus, FiBox, FiSettings, FiSearch, FiFolder, FiEdit3, FiPlay, FiSquare, FiTrash2, FiBarChart, FiShield, FiArrowLeft, FiClock, FiCalendar, FiUsers, FiChevronRight, FiActivity } from 'react-icons/fi';
import { GlassIcon } from '../components/AppIcons';
import GlassSelect from '../../components/admin/GlassSelect';
import OrbitalBuffer from '../components/OrbitalBuffer';

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

const inputCls = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none bg-black/5 border border-white/10 text-primary focus:ring-2 focus:ring-indigo-500/50 transition-all';
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-secondary opacity-60 mb-1.5 ml-1';

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
  const [wizardStep, setWizardStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const TOTAL_STEPS = 3;

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

  async function handleSubmit() {
    setError('');
    if (!title.trim() || !subject.trim() || !year || !division || !startTime || !endTime) {
      setError('Please fill in all required fields in earlier steps');
      setWizardStep(1); // Force back to start for validation
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
      setWizardStep(1);
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
    <div className="h-full flex flex-col bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between gap-6 p-6 border-b border-white/5">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-primary tracking-tight flex items-center gap-2">
            <FiFolder className="text-indigo-400" />
            Test Manager
          </h1>
          <p className="text-[10px] font-black uppercase text-secondary tracking-widest mt-0.5">
            {view === 'list' ? `Managing ${tests.length} academic evaluations` : editing ? `Editing: ${editing.title}` : 'Creating new evaluation'}
          </p>
        </div>

        {view === 'list' ? (
          <div className="flex items-center gap-3">
             <div className="relative w-64 mr-2">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                 <input 
                    type="text" 
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-black/10 border border-white/10 rounded-2xl text-[10px] text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all placeholder:text-white/10 font-bold uppercase tracking-widest"
                />
            </div>
            <button onClick={handleCreate} className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-accent text-white shadow-lg shadow-accent/20 hover:opacity-90 transition-all">+ New Test</button>
          </div>
        ) : (
          <button onClick={() => setView('list')} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 text-secondary hover:bg-white/10 transition-all flex items-center gap-2">
            <FiArrowLeft /> Cancel
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading && view === 'list' ? (
             <div className="h-full flex items-center justify-center">
                <OrbitalBuffer size={40} className="text-accent" />
             </div>
        ) : view === 'list' ? (
          <div className="p-6">
            {filteredTests.length === 0 ? (
                <div className="glass no-shadow p-16 text-center border-dashed border-white/10">
                    <p className="text-sm font-black text-secondary uppercase tracking-[0.4em]">No matching tests found</p>
                </div>
            ) : (
                <AnimatedList 
                  items={filteredTests}
                  containerClassName="w-full"
                  className="max-h-none"
                  gap={16}
                  renderItem={(t) => (
                    <div className="group relative glass no-shadow p-5 flex flex-col md:flex-row items-start md:items-center gap-6 transition-all hover:bg-white/[0.08] hover:border-white/20 overflow-hidden">
                        
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-accent/10 transition-colors">
                          <FiFolder className="text-secondary group-hover:text-accent opacity-60 group-hover:opacity-100 text-xl transition-colors" />
                        </div>

                        <div className="flex-1 min-w-0 relative">
                            <div className="flex items-center gap-3 mb-1.5">
                                <h3 className="text-lg font-black text-primary truncate tracking-tight uppercase group-hover:text-accent transition-colors">{t.title}</h3>
                                <StatusBadge status={t.status} />
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-secondary">
                                <span className="flex items-center gap-1.5 bg-black/5 px-2 py-1 rounded"><FiBox className="text-accent" /> {t.subject}</span>
                                <span className="flex items-center gap-1.5 bg-black/5 px-2 py-1 rounded"><FiUsers className="text-accent" /> {t.year} • {t.division}</span>
                                <span className="flex items-center gap-1.5 bg-black/5 px-2 py-1 rounded"><FiClock className="text-accent" /> {t.duration_minutes}m</span>
                                <span className="flex items-center gap-1.5 bg-black/5 px-2 py-1 rounded"><FiCalendar className="text-accent" /> {new Date(t.start_time).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 relative">
                            {t.status === 'draft' && (
                                <>
                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(t); }} className="p-2.5 rounded-xl bg-accent/20 text-accent hover:bg-accent hover:text-white transition-all"><FiEdit3 /></button>
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
                            <button onClick={(e) => { e.stopPropagation(); openWindow('question-bank', { testId: t.id, testTitle: t.title }); }} className="p-2.5 rounded-xl bg-black/5 text-secondary hover:bg-white/20 hover:text-primary transition-all"><FiSettings /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} className="p-2.5 rounded-xl bg-black/5 text-secondary hover:bg-red-500 hover:text-white transition-all"><FiTrash2 /></button>
                        </div>
                    </div>
                  )}
                  onItemSelect={(t) => handleEdit(t)}
                />
            )}
          </div>
        ) : (
          <div className="p-8 max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* Wizard Header / Progress */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-black text-primary tracking-tighter uppercase">{editing ? 'Edit Setup' : 'Create Setup'}</h2>
                    <div className="flex items-center gap-2">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`h-1.5 w-12 rounded-full transition-all duration-500 ${wizardStep >= s ? 'bg-accent shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)]' : 'bg-white/10'}`} />
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.3em] text-secondary opacity-40">
                    <span className={wizardStep === 1 ? 'text-accent opacity-100' : ''}>01. Identity</span>
                    <FiChevronRight />
                    <span className={wizardStep === 2 ? 'text-accent opacity-100' : ''}>02. Scheduling</span>
                    <FiChevronRight />
                    <span className={wizardStep === 3 ? 'text-accent opacity-100' : ''}>03. Controls</span>
                </div>
            </div>
            
            <div className="min-h-[300px] animate-in fade-in duration-300">
                {wizardStep === 1 && (
                    <div className="space-y-8 slide-in-from-right-4 animate-in duration-500">
                        <div className="glass no-shadow p-8 rounded-[2.5rem] border-white/5 space-y-6 bg-white/[0.01]">
                            <div>
                                <label className={labelCls}>Title of the Evaluation *</label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="e.g. End Semester Exam 2024" />
                            </div>
                            <div>
                                <label className={labelCls}>Academic Subject *</label>
                                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className={inputCls} placeholder="e.g. Data Structures" />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className={labelCls}>Target Year *</label>
                                    <GlassSelect value={year} onChange={setYear} placeholder="Year" options={[{ value: 'FE', label: 'FE' }, { value: 'SE', label: 'SE' }, { value: 'TE', label: 'TE' }, { value: 'BE', label: 'BE' }]} />
                                </div>
                                <div>
                                    <label className={labelCls}>Division *</label>
                                    <GlassSelect value={division} onChange={setDivision} placeholder="Division" options={[{ value: 'ALL', label: 'All' }, { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }, { value: 'D', label: 'D' }]} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {wizardStep === 2 && (
                    <div className="space-y-8 slide-in-from-right-4 animate-in duration-500">
                        <div className="glass no-shadow p-8 rounded-[2.5rem] border-white/5 space-y-6 bg-white/[0.01]">
                            <div>
                                <label className={labelCls}>Session Duration (Minutes) *</label>
                                <input type="number" min={1} value={duration} onChange={e => setDuration(Number(e.target.value))} className={inputCls} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className={labelCls}>Activation Window Start *</label>
                                    <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Activation Window End *</label>
                                    <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {wizardStep === 3 && (
                    <div className="space-y-8 slide-in-from-right-4 animate-in duration-500">
                        <div className="glass no-shadow p-8 rounded-[2.5rem] border-white/5 space-y-8 bg-white/[0.01]">
                            <div>
                                <label className={labelCls}>Items per Participant</label>
                                <input type="number" min={1} value={questionsPerAttempt} onChange={e => setQuestionsPerAttempt(Number(e.target.value))} className={inputCls} />
                            </div>
                            <div className="space-y-4">
                                <label className="group flex items-center gap-4 cursor-pointer p-6 rounded-3xl bg-black/5 border border-white/5 hover:bg-black/10 transition-all">
                                    <input type="checkbox" checked={randomize} onChange={e => setRandomize(e.target.checked)} className="w-5 h-5 accent-accent rounded-lg" />
                                    <div className="flex-1">
                                        <p className="text-xs font-black uppercase text-primary mb-1">Randomize Sequence</p>
                                        <p className="text-[10px] font-bold text-secondary opacity-40 uppercase">Ensures unique question order for every student session</p>
                                    </div>
                                </label>
                                {editing && (
                                    <button type="button" onClick={() => setAttachTestId(editing.id)} className="w-full flex items-center justify-center gap-3 py-6 rounded-3xl bg-accent/10 border border-accent/20 text-accent font-black uppercase text-[10px] tracking-widest hover:bg-accent hover:text-white transition-all">
                                        <FiSettings /> Modular Asset Management
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {error && <p className="text-xs font-black uppercase tracking-widest text-red-400 bg-red-400/10 p-4 rounded-xl border border-red-400/20 text-center">{error}</p>}

            <div className="flex gap-4 pt-4 pb-12">
                {wizardStep > 1 && (
                    <button 
                        type="button" 
                        onClick={() => setWizardStep(s => s - 1)}
                        className="px-8 py-4 rounded-[2rem] bg-white/5 text-secondary font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                        Back
                    </button>
                )}
                
                {wizardStep < TOTAL_STEPS ? (
                    <button 
                        type="button" 
                        onClick={() => setWizardStep(s => s + 1)}
                        className="px-6 py-2.5 rounded-xl bg-accent hover:opacity-90 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-accent/20 active:scale-95 transition-all"
                    >
                        Next Phase
                    </button>
                ) : (
                    <button 
                        type="button" 
                        onClick={handleSubmit} 
                        disabled={saving} 
                        className="flex-1 py-5 rounded-[2rem] bg-indigo-600 text-white font-black uppercase tracking-[0.3em] shadow-xl shadow-indigo-600/30 hover:bg-green-500 hover:text-white transition-all disabled:opacity-50"
                    >
                        {saving ? 'Processing...' : editing ? 'Finalize Changes' : 'Launch Setup'}
                    </button>
                )}
            </div>
          </div>
        )}
      </div>

      {/* Attach modal */}
      {attachTestId && (
        <AttachToTestModal
          questionId={attachTestId} 
          onClose={() => setAttachTestId(null)}
        />
      )}
    </div>
  );
}
