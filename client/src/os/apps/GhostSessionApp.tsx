import { useState, useEffect, useRef } from 'react';
import api from '../../lib/axios';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import { useAuth } from '../../context/AuthContext';

interface Question {
  id: string;
  statement: string;
  buggy_code: string;
  language: string;
}

export default function GhostSessionApp() {
  const { user } = useAuth();
  const [tests, setTests] = useState<any[]>([]);
  const [activeTest, setActiveTest] = useState<any>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [typedCode, setTypedCode] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'typing' | 'running' | 'success' | 'alert'>('idle');
  const [violationCount, setViolationCount] = useState(0);

  const typewriterRef = useRef<any>(null);

  useEffect(() => {
    api.get('/tests').then(r => setTests(r.data.tests || []));
  }, []);

  const startGhost = async (test: any) => {
    setActiveTest(test);
    setStatus('thinking');
    setLogs(['[SYSTEM] 🛡️ Sandbox initialized.', '[GHOST] 👻 Student simulation starting...']);
    
    try {
      const attResp = await api.post('/ghost/start', { test_id: test.id, user_id: user?.id });
      setAttemptId(attResp.data.attempt_id);

      const qResp = await api.get(`/questions/test/${test.id}`);
      const qs = qResp.data.questions.map((tq: any) => ({
        id: tq.question_bank.id,
        statement: tq.question_bank.statement,
        buggy_code: tq.variant_assignments?.[0]?.debug_variants?.[0]?.buggy_code || tq.question_bank.correct_code || '',
        language: tq.question_bank.language
      })).filter((q: any) => q.statement);
      
      setQuestions(qs);
      if (qs.length > 0) simulateHumanProcess(qs[0]);
    } catch (e) {
      setLogs(p => [...p, '[ERROR] Simulation failed to start.']);
    }
  };

  const simulateHumanProcess = async (q: Question) => {
    setIsSimulating(true);
    setTypedCode(q.buggy_code || ''); // Start with the broken code
    
    // 1. Thinking Phase
    setStatus('thinking');
    setLogs(p => [...p, '[STUDENT] 🤨 Identifying logic errors...', '[STUDENT] 📝 Reviewing variable scopes...']);
    await new Promise(r => setTimeout(r, 6000)); // 6s of staring

    // 2. Fetch Solution while thinking
    try {
      const resp = await api.post('/ghost/solve', {
        buggy_code: q.buggy_code,
        statement: q.statement,
        language: q.language
      });
      const solution = resp.data.fixed_code;

      // 3. Struggle & "Backtracking" Phase
      setStatus('typing');
      setLogs(p => [...p, '[STUDENT] ✍️ Trying first fix...']);
      setTypedCode(prev => prev + '\n// Fix attempt 1\n');
      await new Promise(r => setTimeout(r, 2000));
      setTypedCode(prev => prev.slice(0, -15)); // Delete it
      setLogs(p => [...p, '[STUDENT] ❌ That didnt work. Reverting...']);
      await new Promise(r => setTimeout(r, 2000));

      // 4. Cheating Trigger
      await raiseFlag('tab_switch');
      setLogs(p => [...p, '[GHOST] 🕵️ Searching stackoverflow...']);
      await new Promise(r => setTimeout(r, 3000));

      // 5. Resolution (Paste)
      setLogs(p => [...p, '[ALERT] ⚠️ Unnatural text injection (PASTE) detected!']);
      setTypedCode(solution);
      await raiseFlag('paste_detected');
      
      setTimeout(finishQuestion, 2000);
    } catch (e: any) {
      setLogs(p => [...p, `[ERROR] AI Brain failure.`]);
    }
  };

  const raiseFlag = async (type: string) => {
    if (!attemptId) return;
    setViolationCount(prev => prev + 1);
    const prevStatus = status;
    setStatus('alert');
    try {
      await api.post('/ghost/log-event', {
        attempt_id: attemptId,
        event_type: type,
        metadata: { timestamp: new Date().toISOString() }
      });
      setLogs(p => [...p, `[PROCTOR] 🚨 FLAG RAISED: ${type.toUpperCase()}`]);
    } catch (e) {}
    setTimeout(() => setStatus(prevStatus), 2000);
  };

  const finishQuestion = () => {
    setStatus('running');
    setLogs(p => [...p, '[STUDENT] ⚙️ Testing final fix...', '[GHOST] 🧪 Passing test cases...']);
    setTimeout(() => {
      setLogs(p => [...p, '[GHOST] 🎉 SUCCESS.', '[GHOST] 📮 Submitting...']);
      setStatus('success');
      setTimeout(() => setIsSimulating(false), 2000);
    }, 2000);
  };

  if (!activeTest) {
    return (
      <div className="p-8 h-full overflow-auto space-y-6 bg-[#0f0f13]">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Ghost Simulation Center 👻</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tests.map(t => (
            <button key={t.id} onClick={() => startGhost(t)} 
                    className="glass p-6 rounded-2xl text-left hover:border-indigo-500/50 transition-all group overflow-hidden">
              <h3 className="text-white font-semibold text-lg">{t.title}</h3>
              <p className="text-slate-400 text-xs mt-1">{t.subject}</p>
              <div className="mt-4 flex gap-2">
                 <span className="text-[9px] font-bold px-2 py-0.5 bg-red-500/10 rounded text-red-400 uppercase tracking-tighter">Saboteur Simulation</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0b0b0e]">
      <div className={`p-4 border-b transition-colors duration-500 flex justify-between items-center ${status === 'alert' ? 'bg-red-950/40 border-red-500/30' : 'bg-[#12121a] border-white/5'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full animate-pulse ${status === 'alert' ? 'bg-red-500' : 'bg-green-500'}`} />
          <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${status === 'alert' ? 'text-red-400' : 'text-slate-500'}`}>
            {status === 'alert' ? 'Violation Flagged' : 'Agent Activity Live'}
          </span>
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-[10px] font-mono text-white flex items-center gap-2">
            <span className="text-red-500">⚠</span> {violationCount} FLAGS
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative">
            <Editor
              height="100%"
              theme="vs-dark"
              language={questions[currentIdx]?.language || 'cpp'}
              value={typedCode}
              options={{
                readOnly: true,
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontFamily: 'JetBrains Mono',
                lineHeight: 22
              }}
            />
            {status === 'thinking' && (
              <div className="absolute top-4 right-4 z-10 p-3 rounded-lg border border-indigo-500/30 bg-black/80 backdrop-blur-sm">
                 <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                    <p className="text-[10px] font-mono text-indigo-400 font-bold">STUDENT THINKING...</p>
                 </div>
              </div>
            )}
          </div>
          <div className="h-44 bg-black border-t border-white/5 p-4 font-mono text-[11px] overflow-auto">
            <AnimatePresence>
              {logs.map((log, i) => (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={i}
                            className={`mb-1.5 flex gap-2 ${log.includes('🚨') ? 'text-red-400 font-bold' : log.startsWith('[STUDENT]') ? 'text-amber-400/80' : 'text-slate-500'}`}>
                  <span>{log}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="w-72 bg-[#12121a] border-l border-white/5 hidden lg:flex flex-col p-5">
            <div className="mb-8">
              <h4 className="text-[9px] uppercase font-black text-slate-600 tracking-widest mb-4">Integrity Tracker</h4>
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                <div className="flex justify-between items-center mb-1">
                   <span className="text-[10px] text-slate-400 font-medium">Risk Score</span>
                   <span className="text-xs font-bold text-red-500">{violationCount * 33}%</span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-red-500" animate={{ width: `${violationCount * 33}%` }} />
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-[9px] uppercase font-black text-slate-600 tracking-widest mb-4">Agent Mentality</h4>
              <div className="space-y-3">
                 <div className="flex items-center gap-2 text-[10px] text-white/70">
                    <span className={status === 'thinking' ? 'text-amber-500' : 'text-slate-700'}>●</span> Thinking
                 </div>
                 <div className="flex items-center gap-2 text-[10px] text-white/70">
                    <span className={status === 'typing' ? 'text-indigo-500' : 'text-slate-700'}>●</span> Struggling
                 </div>
                 <div className="flex items-center gap-2 text-[10px] text-white/70">
                    <span className={status === 'alert' ? 'text-red-500' : 'text-slate-700'}>●</span> Cheating
                 </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
