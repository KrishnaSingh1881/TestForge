import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import api from '../../lib/axios';
import { useTheme } from '../../context/ThemeContext';
import { FiPlay, FiTerminal, FiCode, FiCpu, FiAlertCircle } from 'react-icons/fi';
import GlassSelect from '../../components/admin/GlassSelect';

const LANGUAGES = [
  { label: 'Python 3', value: 'python', starter: '# Write your Python code here\nprint("Hello, World!")\n' },
  { label: 'C++ 17',    value: 'cpp',    starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n' },
  { label: 'C 11',      value: 'c',      starter: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n' },
  { label: 'Java 11',   value: 'java',   starter: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n' },
];

export default function CodeEditorApp() {
  const { theme } = useTheme();
  const [lang, setLang] = useState(LANGUAGES[0]);
  const [code, setCode] = useState(LANGUAGES[0].starter);
  const [stdin, setStdin] = useState('');
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'light';

  async function handleRun() {
    setRunning(true);
    setStdout('');
    setStderr('');
    setExitCode(null);
    try {
      const { data } = await api.post('/execute/scratch', { language: lang.value, code, stdin });
      setStdout(data.stdout ?? '');
      setStderr(data.stderr ?? '');
      setExitCode(data.exitCode ?? 0);
    } catch (err: any) {
      setStderr(err?.response?.data?.error ?? 'Execution failed');
      setExitCode(1);
    } finally {
      setRunning(false);
      setTimeout(() => outputRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }), 50);
    }
  }

  function handleLangChange(value: string) {
    const l = LANGUAGES.find(l => l.value === value) ?? LANGUAGES[0];
    setLang(l);
    setCode(l.starter);
    setStdout('');
    setStderr('');
    setExitCode(null);
  }

  return (
    <div className="h-full flex flex-col bg-transparent animate-in fade-in duration-500">
      {/* Premium Toolbar */}
      <div className="flex items-center gap-4 px-6 py-4 bg-black/5 border-b border-white/5 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 pr-4 border-r border-white/10">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <FiCode />
          </div>
          <GlassSelect 
            value={lang.value} 
            onChange={handleLangChange}
            options={LANGUAGES.map(l => ({ value: l.value, label: l.label }))}
            className="w-40"
          />
        </div>

        <button 
          onClick={handleRun} 
          disabled={running}
          className={`flex items-center gap-3 px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl disabled:opacity-50 ${running ? 'bg-black/10 text-secondary' : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:-translate-y-0.5 shadow-indigo-600/20'}`}
        >
          {running ? (
            <>
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <FiPlay className="text-sm" /> Initiate Logic
            </>
          )}
        </button>

        <div className="ml-auto flex items-center gap-3 px-4 py-1.5 bg-black/5 rounded-full border border-white/5">
           <FiCpu className="text-indigo-400 opacity-40 text-sm" />
           <span className="text-[9px] font-black uppercase tracking-widest text-secondary opacity-40">Scratchpad Environment v1.0.4</span>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Zone */}
        <div className="flex-1 min-w-0 bg-transparent">
          <Editor
            height="100%"
            language={lang.value === 'cpp' ? 'cpp' : lang.value}
            value={code}
            onChange={v => setCode(v ?? '')}
            theme={monacoTheme}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              wordWrap: 'on',
              padding: { top: 16 },
              backgroundColor: 'transparent',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          />
        </div>

        {/* Console Sidecar */}
        <div className="w-80 flex flex-col border-l border-white/10 bg-black/10 backdrop-blur-sm shrink-0">
          {/* Stdin */}
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center gap-2 mb-3 text-[9px] font-black uppercase tracking-[0.3em] text-secondary opacity-40">
                <FiTerminal /> Data Stream (stdin)
            </div>
            <textarea
              value={stdin}
              onChange={e => setStdin(e.target.value)}
              placeholder="Inject programmatic inputs..."
              className="w-full h-32 resize-none bg-black/5 text-primary border border-white/5 rounded-2xl p-4 text-xs font-mono outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:opacity-20"
            />
          </div>

          {/* Stdout / Stderr */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/5">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-secondary opacity-40">
                Processed Output
              </div>
              {exitCode !== null && (
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${exitCode === 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                   {exitCode === 0 ? 'SUCCESS' : `FAULT ${exitCode}`}
                </span>
              )}
            </div>
            <div 
                ref={outputRef} 
                className="flex-1 overflow-auto p-6 font-mono text-[11px] leading-relaxed custom-scrollbar selection:bg-indigo-500/30"
            >
              {!stdout && !stderr && !running && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20 group">
                    <FiTerminal className="text-3xl mb-3 group-hover:scale-110 transition-transform" />
                    <p className="text-[9px] font-black uppercase tracking-widest">Awaiting Command Execution</p>
                </div>
              )}
              {running && (
                <div className="flex items-center gap-3 text-indigo-400/60">
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Processing Logic...</span>
                </div>
              )}
              {stdout && <div className="text-primary/90 whitespace-pre-wrap animate-in fade-in slide-in-from-top-1">{stdout}</div>}
              {stderr && (
                <div className="mt-2 p-3 bg-red-400/5 border border-red-400/20 rounded-xl text-red-400/80 whitespace-pre-wrap animate-in zoom-in duration-300">
                    <div className="flex items-center gap-2 mb-1 opacity-60">
                        <FiAlertCircle /> <span className="text-[9px] font-black uppercase tracking-widest">Exception Trace</span>
                    </div>
                    {stderr}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
