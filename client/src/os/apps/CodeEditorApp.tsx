import { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import api from '../../lib/axios';

const LANGUAGES = [
  { label: 'Python', value: 'python', starter: '# Write your Python code here\nname = input("Enter your name: ")\nprint(f"Hello, {name}!")\n' },
  { label: 'C++',    value: 'cpp',    starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    string name;\n    cout << "Enter your name: ";\n    cin >> name;\n    cout << "Hello, " << name << "!" << endl;\n    return 0;\n}\n' },
  { label: 'C',      value: 'c',      starter: '#include <stdio.h>\n\nint main() {\n    char name[100];\n    printf("Enter your name: ");\n    scanf("%s", name);\n    printf("Hello, %s!\\n", name);\n    return 0;\n}\n' },
  { label: 'Java',   value: 'java',   starter: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        System.out.print("Enter your name: ");\n        String name = sc.nextLine();\n        System.out.println("Hello, " + name + "!");\n    }\n}\n' },
];

// Detect if output ends with an input prompt (waiting for user)
function looksLikePrompt(text: string): boolean {
  const trimmed = text.trimEnd();
  if (!trimmed) return false;
  const lastLine = trimmed.split('\n').pop() ?? '';
  // Common prompt endings: ": ", "? ", "> ", ">> ", ends without newline
  return /[:?>\]]\s*$/.test(lastLine) || !trimmed.endsWith('\n');
}

export default function CodeEditorApp() {
  const [lang, setLang] = useState(LANGUAGES[0]);
  const [code, setCode] = useState(LANGUAGES[0].starter);

  // Terminal state
  const [output, setOutput] = useState('');          // accumulated terminal text
  const [inputLine, setInputLine] = useState('');    // current input being typed
  const [inputs, setInputs] = useState<string[]>([]); // all inputs given so far
  const [phase, setPhase] = useState<'idle' | 'running' | 'waiting-input' | 'done'>('idle');
  const [exitCode, setExitCode] = useState<number | null>(null);

  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [output, phase]);

  // Focus input when waiting
  useEffect(() => {
    if (phase === 'waiting-input') inputRef.current?.focus();
  }, [phase]);

  const runWithInputs = useCallback(async (allInputs: string[]) => {
    setPhase('running');
    try {
      const { data } = await api.post('/execute/scratch', {
        language: lang.value,
        code,
        stdin: allInputs.join('\n') + (allInputs.length ? '\n' : ''),
      });

      const stdout: string = data.stdout ?? '';
      const stderr: string = data.stderr ?? '';
      const code_exit: number = data.exitCode ?? 0;

      setExitCode(code_exit);

      if (stderr) {
        setOutput(stdout + (stdout ? '' : '') + '\n\x1b[error]' + stderr);
        setPhase('done');
        return;
      }

      // Check if program is still waiting for more input
      if (code_exit === 0 && looksLikePrompt(stdout) && stdout.trim()) {
        setOutput(stdout);
        setPhase('waiting-input');
      } else {
        setOutput(stdout || '(no output)');
        setPhase('done');
      }
    } catch (err: any) {
      setOutput('\n[Error] ' + (err?.response?.data?.error ?? 'Execution failed'));
      setPhase('done');
      setExitCode(1);
    }
  }, [lang.value, code]);

  function handleRun() {
    setOutput('');
    setInputs([]);
    setInputLine('');
    setExitCode(null);
    runWithInputs([]);
  }

  function handleInputSubmit(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const val = inputLine;
    const newInputs = [...inputs, val];
    // Show the typed input inline in terminal
    setOutput(prev => prev + val + '\n');
    setInputs(newInputs);
    setInputLine('');
    setPhase('running');
    runWithInputs(newInputs);
  }

  function handleLangChange(value: string) {
    const l = LANGUAGES.find(l => l.value === value) ?? LANGUAGES[0];
    setLang(l);
    setCode(l.starter);
    setOutput('');
    setInputs([]);
    setPhase('idle');
    setExitCode(null);
  }

  function handleClear() {
    setOutput('');
    setInputs([]);
    setPhase('idle');
    setExitCode(null);
  }

  const editorFontSize = Math.round(parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.93);

  // Parse output for error segments
  const outputParts = output.split('\n\x1b[error]');
  const stdoutText = outputParts[0];
  const stderrText = outputParts[1] ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#2d2d2d', borderBottom: '1px solid #3c3c3c', flexShrink: 0 }}>
        <select value={lang.value} onChange={e => handleLangChange(e.target.value)}
          style={{ background: '#3c3c3c', color: '#d4d4d4', border: '1px solid #555', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>
          {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>

        <button onClick={handleRun} disabled={phase === 'running'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: phase === 'running' ? '#444' : '#007acc',
            color: '#fff', border: 'none', borderRadius: 6,
            padding: '5px 14px', fontSize: 12, fontWeight: 600,
            cursor: phase === 'running' ? 'not-allowed' : 'pointer',
          }}>
          {phase === 'running' ? '⏳ Running…' : '▶ Run'}
        </button>

        <button onClick={handleClear}
          style={{ background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
          Clear
        </button>

        <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>Scratch pad — not saved</span>
      </div>

      {/* Editor + Terminal */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Monaco editor */}
        <div style={{ flex: '0 0 60%', overflow: 'hidden', borderRight: '1px solid #3c3c3c' }}>
          <Editor
            height="100%"
            language={lang.value === 'cpp' ? 'cpp' : lang.value}
            value={code}
            onChange={v => setCode(v ?? '')}
            theme="vs-dark"
            options={{
              fontSize: editorFontSize,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              wordWrap: 'on',
              padding: { top: 8 },
            }}
          />
        </div>

        {/* Terminal */}
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', background: '#0c0c0c' }}
          onClick={() => phase === 'waiting-input' && inputRef.current?.focus()}>

          {/* Terminal header */}
          <div style={{ padding: '4px 12px', background: '#1a1a1a', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: '#4ec9b0', fontWeight: 700, letterSpacing: 1 }}>TERMINAL</span>
            {phase === 'running' && <span style={{ fontSize: 10, color: '#facc15' }}>● running</span>}
            {phase === 'waiting-input' && <span style={{ fontSize: 10, color: '#4ec9b0' }}>● waiting for input</span>}
            {phase === 'done' && exitCode !== null && (
              <span style={{ fontSize: 10, color: exitCode === 0 ? '#4ade80' : '#f87171' }}>
                {exitCode === 0 ? '✓ exited 0' : `✗ exited ${exitCode}`}
              </span>
            )}
          </div>

          {/* Output area */}
          <div ref={termRef}
            style={{ flex: 1, overflow: 'auto', padding: '10px 14px', fontSize: 13, lineHeight: 1.6, fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace", cursor: phase === 'waiting-input' ? 'text' : 'default' }}>

            {phase === 'idle' && (
              <span style={{ color: '#555' }}>Press ▶ Run to execute your code.</span>
            )}

            {/* stdout */}
            {stdoutText && (
              <span style={{ color: '#d4d4d4', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{stdoutText}</span>
            )}

            {/* stderr */}
            {stderrText && (
              <span style={{ color: '#f87171', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{stderrText}</span>
            )}

            {/* Inline input cursor — appears right after the last output line */}
            {phase === 'waiting-input' && (
              <span style={{ display: 'inline' }}>
                <input
                  ref={inputRef}
                  value={inputLine}
                  onChange={e => setInputLine(e.target.value)}
                  onKeyDown={handleInputSubmit}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: '#d4d4d4', fontSize: 13, fontFamily: 'inherit',
                    width: Math.max(4, inputLine.length + 1) + 'ch',
                    caretColor: '#d4d4d4', padding: 0, margin: 0,
                  }}
                  autoFocus
                />
                <span style={{ display: 'inline-block', width: 2, height: '1em', background: '#d4d4d4', verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite' }} />
              </span>
            )}

            {phase === 'running' && !output && (
              <span style={{ color: '#555' }}>Running…</span>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}
