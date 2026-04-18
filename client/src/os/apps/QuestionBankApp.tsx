import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft, FiPlus, FiLayers, FiList,
  FiChevronRight, FiTrash2, FiSearch, FiFileText, FiCpu,
  FiUpload, FiBookOpen, FiActivity, FiLayers as FiTestIcon
} from 'react-icons/fi';
import api from '../../lib/axios';
import MCQForm from '../../components/admin/MCQForm';
import DebugQuestionForm from '../../components/admin/DebugQuestionForm';
import AnimatedList from '../../components/AnimatedList';
import OrbitalBuffer from '../components/OrbitalBuffer';
import { useOSStore } from '../store/useOSStore';

interface Test { id: string; title: string; subject: string; status: string; year?: string; division?: string; }
interface Question {
  id: string; type: string; statement: string; statement_image_url: string;
  topic_tag: string; difficulty: string; marks: number; language: string;
  created_at: string; mcq_options: any[];
}
interface TestQuestion {
  id: string; question_id: string; unlock_at_minutes: number;
  question_order: number; question_bank: Question;
}

type WorkbenchMode = 'list' | 'pick-type' | 'mcq' | 'debug' | 'coding' | 'import';

// ── Sub-Components ──────────────────────────────────────────

const Header = ({ title, sub, onBack, showSearch, search, setSearch }: {
  title: string, sub: string, onBack: () => void, showSearch?: boolean,
  search: string, setSearch: (v: string) => void
}) => (
  <div className="flex items-center gap-4 p-6 border-b border-white/5 bg-white/[0.02] backdrop-blur-md shrink-0">
    <button onClick={onBack} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors border border-white/5 active:scale-95">
      <FiArrowLeft className="text-secondary" />
    </button>
    <div className="flex-1">
      <h1 className="text-xl font-black text-primary tracking-tight flex items-center gap-3 uppercase">
        <FiBookOpen className="text-accent" />
        {title}
      </h1>
      <p className="text-[10px] font-black uppercase text-secondary tracking-widest mt-0.5 opacity-40">{sub}</p>
    </div>
    {showSearch && (
      <div className="relative w-64">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 bg-black/10 border border-white/10 rounded-2xl text-[10px] text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all placeholder:text-white/10 font-bold uppercase tracking-widest"
        />
      </div>
    )}
  </div>
);

export default function QuestionBankApp({ id, testId: initTestId }: { id: string, testId?: string }) {
  const { closeWindow } = useOSStore();
  const [tests, setTests] = useState<Test[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [activeTest, setActiveTest] = useState<Test | null>(null);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [mode, setMode] = useState<WorkbenchMode>('list');
  const [search, setSearch] = useState('');

  // Data State
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Load Initial Data
  useEffect(() => {
    api.get('/tests').then(r => setTests(r.data.tests ?? [])).finally(() => setLoadingTests(false));
  }, []);

  useEffect(() => {
    if (initTestId && tests.length > 0 && !hasAutoSelected) {
      const t = tests.find(x => x.id === initTestId);
      if (t) {
        selectTest(t);
        setHasAutoSelected(true);
      }
    }
  }, [initTestId, tests, hasAutoSelected]);

  const selectTest = async (test: Test) => {
    setActiveTest(test);
    setMode('list');
    setLoadingQuestions(true);
    setSearch('');
    try {
      const r = await api.get(`/questions/test/${test.id}`);
      setTestQuestions(r.data.questions ?? []);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleDetach = async (tqId: string) => {
    if (!confirm('Permanently remove this question from the test session?')) return;
    await api.delete(`/questions/test-question/${tqId}`);
    setTestQuestions(prev => prev.filter(q => q.id !== tqId));
  };

  const refreshQuestions = async () => {
    if (!activeTest) return;
    const r = await api.get(`/questions/test/${activeTest.id}`);
    setTestQuestions(r.data.questions ?? []);
    setMode('list');
  };

  const filteredTests = useMemo(() =>
    tests.filter(t => t.title.toLowerCase().includes(search.toLowerCase())),
    [tests, search]
  );

  const filteredQuestions = useMemo(() =>
    testQuestions.filter(tq => tq.question_bank?.statement?.toLowerCase().includes(search.toLowerCase())),
    [testQuestions, search]
  );

  // ── View: Test Picker ─────────────────────────────────────
  if (!activeTest) {
    return (
      <div className="h-full flex flex-col bg-transparent animate-in fade-in duration-500 overflow-hidden">
        <Header
          title="Question Editor"
          sub="Select a workspace to manage its unique question set"
          onBack={() => closeWindow(id)}
          showSearch={true}
          search={search}
          setSearch={setSearch}
        />

        <div className="flex-1 p-8 overflow-auto custom-scrollbar">
          <div className="max-w-5xl mx-auto">
            {loadingTests ? (
              <div className="h-64 flex items-center justify-center">
                <OrbitalBuffer size={40} className="text-accent" />
              </div>
            ) : filteredTests.length === 0 ? (
              <div className="py-20 text-center glass-2 border-dashed border-white/10">
                <FiList className="mx-auto text-4xl text-white/10 mb-4" />
                <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">No matching workspaces found</p>
              </div>
            ) : (
              <AnimatedList items={filteredTests} className="grid grid-cols-1 md:grid-cols-1" gap={16} renderItem={(t) => {
                const statusColor = t.status === 'ended' ? '#4ade80' : t.status === 'active' ? '#facc15' : 'rgba(255,255,255,0.2)';
                return (
                  <div
                    onClick={() => selectTest(t)}
                    className="group glass-2 p-8 flex items-center gap-8 hover:bg-white/[0.08] hover:border-accent/40 cursor-pointer transition-all rounded-[3.5rem] active:scale-[0.99] shadow-xl"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-accent/10 transition-colors shadow-2xl shrink-0">
                      <FiTestIcon className="text-secondary group-hover:text-accent opacity-60 group-hover:opacity-100 text-2xl transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-4">
                        <h3 className="text-xl font-black text-primary truncate uppercase tracking-tight group-hover:text-accent transition-colors">{t.title}</h3>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-current opacity-60" style={{ color: statusColor }}>
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
                          <span className="text-[8px] font-black tracking-widest uppercase">{t.status}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-secondary font-black uppercase tracking-[0.3em] opacity-40 mt-2">
                        {t.subject} {t.year ? `· Year ${t.year}` : ''} {t.division ? `· Div ${t.division}` : ''}
                      </p>
                    </div>
                  </div>
                );
              }} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── View: Workbench ───────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-transparent animate-in fade-in duration-500 overflow-hidden relative">
      <AnimatePresence mode="wait">
        {mode === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <Header
              title={activeTest.title}
              sub={`${activeTest.subject} · ${testQuestions.length} Items Indexed`}
              onBack={() => setActiveTest(null)}
              showSearch={true}
              search={search}
              setSearch={setSearch}
            />

            <div className="flex-1 overflow-auto custom-scrollbar">
              <div className="p-8 max-w-5xl mx-auto space-y-6 pb-32">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40">Test Integrity Scope</h3>
                  <button
                    onClick={() => setMode('pick-type')}
                    className="px-6 py-2.5 rounded-xl bg-accent hover:opacity-90 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-accent/20 active:scale-95 transition-all"
                  >
                    <FiPlus size={14} /> New Fragment
                  </button>
                </div>

                {loadingQuestions ? (
                  <div className="h-64 flex items-center justify-center">
                    <OrbitalBuffer size={40} className="text-accent opacity-40" />
                  </div>
                ) : filteredQuestions.length === 0 ? (
                  <div className="py-20 text-center glass no-shadow border-dashed border-white/10 rounded-[3.5rem] bg-white/[0.01]">
                    <FiActivity className="animate-spin mx-auto text-4xl text-accent opacity-40 mb-4" />
                    <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">No active fragments in scope</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {filteredQuestions.map((tq, i) => (
                      <div key={tq.id} className="group glass-2 p-5 flex items-center gap-5 hover:bg-white/[0.08] hover:border-accent/40 transition-all active:scale-[0.99]">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-[10px] font-black text-accent/40 shrink-0 border border-white/5">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="text-[8px] px-2 py-0.5 rounded bg-accent/10 text-accent font-black uppercase tracking-widest border border-accent/10">
                              {tq.question_bank?.type}
                            </span>
                            <span className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40">
                              {tq.question_bank?.marks} Pts
                            </span>
                          </div>
                          <p className="text-sm font-bold text-primary truncate pr-10 mt-1 uppercase tracking-tight">{tq.question_bank?.statement}</p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleDetach(tq.id)} className="p-2.5 rounded-xl text-red-500/40 hover:text-red-400 hover:bg-red-400/10 transition-all active:scale-90">
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'pick-type' && (
          <motion.div
            key="type-picker"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <Header title="Injection Mode" sub="Select assessment archetype" onBack={() => setMode('list')} search={search} setSearch={setSearch} />
            <div className="flex-1 flex flex-col p-12 max-w-2xl mx-auto w-full justify-center space-y-4">
              {[
                { id: 'mcq' as WorkbenchMode, icon: <FiFileText />, title: 'Multiple Choice', desc: 'Quantitative selection protocols' },
                { id: 'debug' as WorkbenchMode, icon: <FiCpu />, title: 'Debugging Forensic', desc: 'Code repair and remediation tasks' },
                { id: 'coding' as WorkbenchMode, icon: <FiLayers />, title: 'Developmental', desc: 'Full algorithm construction scope' },
                { id: 'import' as WorkbenchMode, icon: <FiUpload />, title: 'Bulk Artifacts', desc: 'Ingest external dataset volumes' }
              ].map((opt) => (
                <button key={opt.id} onClick={() => setMode(opt.id)} className="group glass-2 p-6 flex items-center gap-6 hover:bg-white/[0.08] hover:border-accent/40 transition-all active:scale-[0.98]">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl text-secondary transition-all group-hover:scale-110 group-hover:bg-accent/10 group-hover:text-accent border border-white/5">
                    {opt.icon}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <h4 className="text-base font-black text-primary uppercase tracking-tight">{opt.title}</h4>
                    <p className="text-[10px] text-secondary font-black uppercase tracking-widest opacity-30 mt-1">{opt.desc}</p>
                  </div>
                  <FiChevronRight className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-secondary" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {(mode === 'mcq' || mode === 'debug') && (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <Header title={`${mode.toUpperCase()} Build`} sub={`Integrating fragment into ${activeTest.title}`} onBack={() => setMode('pick-type')} search={search} setSearch={setSearch} />
            <div className="flex-1 p-8 overflow-auto custom-scrollbar">
              <div className="max-w-4xl mx-auto w-full pb-20">
                <div className="glass-2 p-10 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-accent/20" />
                  {mode === 'mcq' ? (
                    <MCQForm
                      onSuccess={async (newQId) => {
                        if (newQId) {
                          await api.post(`/questions/${newQId}/attach`, { test_id: activeTest.id, unlock_at_minutes: 0, question_order: testQuestions.length });
                        }
                        refreshQuestions();
                      }}
                    />
                  ) : (
                    <DebugQuestionForm onSuccess={refreshQuestions} />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'import' && (
          <motion.div
            key="import"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <Header title="Artifact Intake" sub="Localized dataset ingestion" onBack={() => setMode('pick-type')} search={search} setSearch={setSearch} />
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-xl w-full glass-2 p-12 text-center relative overflow-hidden">
                <FiUpload className="mx-auto text-5xl mb-6 text-accent opacity-40 hover:scale-110 transition-transform cursor-pointer" />
                <h2 className="text-2xl font-black text-primary tracking-tighter uppercase">Drop Core</h2>
                <p className="text-[10px] font-black text-secondary tracking-[0.4em] uppercase opacity-30 mt-2 mb-10">Select JSON / CSV Bundle</p>
                <button onClick={() => setMode('list')} className="text-[10px] font-black uppercase text-accent/60 tracking-widest hover:opacity-100 transition-opacity">Abort intake procedure</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
