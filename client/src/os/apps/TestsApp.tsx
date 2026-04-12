
import { useEffect, useState, useMemo } from 'react';
import api from '../../lib/axios';
import { useOSStore } from '../store/useOSStore';
import { useCountdown } from '../../hooks/useCountdown';
import { useAuth } from '../../context/AuthContext';
import AnimatedList from '../../components/AnimatedList';
import { FiClock, FiFileText, FiCalendar, FiPlay, FiCheckCircle, FiRotateCcw, FiLock } from 'react-icons/fi';
import { GlassIcon } from '../components/AppIcons';

interface Attempt {
  id: string;
  status: string;
}

interface Test {
  id: string;
  title: string;
  subject: string;
  year: string;
  division: string;
  duration_mins: number;
  start_time: string;
  end_time: string;
  questions_per_attempt: number;
  total_marks: number;
  attempt: Attempt | null;
  status: 'draft' | 'active' | 'ended';
}

function TestCard({ test }: { test: Test }) {
  const openWindow = useOSStore(s => s.openWindow);
  const now = Date.now();
  const started = new Date(test.start_time).getTime() <= now;
  const ended = new Date(test.end_time).getTime() <= now;
  const countdown = useCountdown(!started ? test.start_time : null);

  const attempted = !!test.attempt;
  const submitted = test.attempt?.status === 'submitted' || test.attempt?.status === 'auto_submitted';

  const handleStart = () => {
    openWindow('test-session', { testId: test.id });
  };

  const handleResume = () => {
    openWindow('test-session', { testId: test.id, attemptId: test.attempt!.id });
  };

  const handleViewResults = () => {
    openWindow('results', { attemptId: test.attempt!.id });
  };

  return (
    <div className="group relative glass p-6 flex flex-col gap-4 transition-all hover:bg-white/[0.08] hover:border-white/20 hover:shadow-2xl hover:shadow-indigo-500/10 h-full">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 group-hover:scale-110 transition-all duration-700">
        <GlassIcon id="folder" size="sm" />
      </div>

      <div className="flex-1">
        <div className="flex items-start justify-between gap-3 mb-4">
             <div className="flex flex-col">
                <h3 className="text-lg font-black text-white leading-tight uppercase tracking-tight group-hover:text-indigo-400 transition-colors">
                {test.title}
                </h3>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-1">{test.subject}</p>
             </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 bg-white/5 rounded border border-white/5 text-white/40 group-hover:text-white/60 transition-colors">
                {test.year} • {test.division}
            </span>
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 bg-white/5 rounded border border-white/5 text-white/40 group-hover:text-white/60 transition-colors">
                <FiClock className="inline mr-1 mb-0.5" /> {test.duration_mins}m
            </span>
             <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 bg-white/5 rounded border border-white/5 text-white/40 group-hover:text-white/60 transition-colors">
                {test.questions_per_attempt} Ques
            </span>
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-white/5">
        {ended ? (
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
            <FiLock /> Test Concluded
          </div>
        ) : test.status === 'draft' ? (
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-[10px] font-black uppercase tracking-[0.2em] text-yellow-400">
            <FiClock className="animate-pulse" /> Pending Launch
          </div>
        ) : submitted ? (
          <button
            onClick={handleViewResults}
            className="w-full py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-[10px] font-black uppercase tracking-[0.2em] text-green-400 hover:bg-green-500 hover:text-white transition-all shadow-lg shadow-green-500/0 hover:shadow-green-500/20 flex items-center justify-center gap-2"
          >
            <FiCheckCircle /> View Stats
          </button>
        ) : attempted ? (
          <button
            onClick={handleResume}
            className="w-full py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-[10px] font-black uppercase tracking-[0.2em] text-yellow-400 hover:bg-yellow-500 hover:text-white transition-all shadow-lg shadow-yellow-500/0 hover:shadow-yellow-500/20 flex items-center justify-center gap-2"
          >
            <FiRotateCcw /> Resume Now
          </button>
        ) : started ? (
          <button
            onClick={handleStart}
            className="w-full py-4 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.3em] hover:bg-indigo-500 hover:-translate-y-1 transition-all shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 active:translate-y-0"
          >
            <FiPlay className="fill-current" /> Begin Test
          </button>
        ) : (
          <div className="flex flex-col items-center justify-center py-3 rounded-xl bg-white/5 border border-white/10 group-hover:border-indigo-500/30 transition-all">
             <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em] mb-1">Unlocking In</p>
             <p className="text-xs font-black text-indigo-400 tracking-widest">{countdown}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TestsApp() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchTests = () => {
    api
      .get('/tests/available')
      .then(r => setTests(r.data.tests ?? []))
      .catch(err => console.error('Failed to fetch tests:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTests();
    const interval = setInterval(fetchTests, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#0c0c16]/40 backdrop-blur-xl">
      <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
            <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                DASHBOARD
            </h1>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em] mt-1.5">Your Academic Evaluations</p>
        </div>

        {user && (
            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/5">
                <div className="flex flex-col px-4 border-r border-white/10">
                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Enrollment</p>
                    <p className="text-xs font-black text-white tracking-widest leading-none mt-1">{user.year} • {user.division}</p>
                </div>
                <div className="flex flex-col px-4">
                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Active Trials</p>
                    <p className="text-xs font-black text-indigo-400 tracking-widest leading-none mt-1">{tests.length}</p>
                </div>
            </div>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-8">
        {loading ? (
             <div className="h-full flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
             </div>
        ) : tests.length === 0 ? (
          <div className="glass p-20 text-center border-dashed border-white/10 max-w-2xl mx-auto mt-10">
             <div className="mb-6 opacity-20"><GlassIcon id="shield" size="md" /></div>
            <p className="text-sm font-black text-white/40 uppercase tracking-[0.5em]">No active tests found</p>
            <p className="text-[10px] text-white/20 mt-4 max-w-xs mx-auto uppercase font-bold leading-relaxed">System is syncing with server. Check your divisional broadcast for schedule updates.</p>
          </div>
        ) : (
          <AnimatedList 
            items={tests}
            containerClassName="h-full"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            renderItem={(t) => <TestCard test={t} />}
          />
        )}
      </div>
    </div>
  );
}
