import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import api from '../../lib/axios';

const LANGUAGES = [
  { label: 'Python', value: 'python', starter: '# Write your Python code here\nname = input("Enter your name: ")\nprint(f"Hello, {name}!")\n' },
  { label: 'C++',    value: 'cpp',    starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    string name;\n    cout << "Enter your name: ";\n    cin >> name;\n    cout << "Hello, " << name << "!" << endl;\n    return 0;\n}\n' },
  { label: 'C',      value: 'c',      starter: '#include <stdio.h>\n\nint main() {\n    char name[100];\n    printf("Enter your name: ");\n    scanf("%s", name);\n    printf("Hello, %s!\\n", name);\n    return 0;\n}\n' },
  { label: 'Java',   value: 'java',   starter: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        System.out.print("Enter your name: ");\n        String name = sc.nextLine();\n        System.out.println("Hello, " + name + "!");\n    }\n}\n' },
];

interface TerminalLine {
  type: 'output' | 'input' | 'error' | 'system';
  text: string;
}

export default function CodeEditorApp() {
  const [lang, setLang] = useState(LANGUAGES[0]);
  const [code, setCode] = useState(LANGUAGES[0].starter);
  const [terminal, setTerminal] = useState<TerminalLine[]>([
    { type: 'system', text: 'TestForge Terminal — click ▶ Run to execute your code' }
  ]);
  const [running, setRunning] = useState(false);
  const [waitingInput, setWaitingInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [pendingInputs, setPendingInputs] = useState<string[]>([]);
  const [inputQueue, setInputQueue] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminal]);

  useEffect(() => {
    if (waitingInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [waitingInput]);

  function addLine(type: TerminalLine['type'], text: string) {
    setTerminal(prev => [...prev, { type, text }]);
  }

  async function handleRun() {
    setTerminal([{ type: 'system', text: `Running ${lang.label} program...` }]);
    setRunning(true);
    setWaitingInput(false);
    setPendingInputs([]);
    setInputQueue([]);

    try {
      const { data } = await api.post('/execute/scratch', {
        language: lang.value,
        code,
        stdin: '',
      });

      // Show output
      if (data.stdout) {
        const lines = data.stdout.split('\n');
        lines.forEach((line: string, i: number) => {
          if (i < lines.length - 1 || line) addLine('output', line);
        });
      }
      if (data.stderr) {
        addLine('error', data.stderr);
      }
      if (!data.stdout && !data.stderr) {
        addLine('system', '(no output)');
      }
      addLine('system', `Process exited with code ${data.exitCode ?? 0}`);
    } catch (err: any) {
      addLine('error', err?.response?.data?.error ?? 'Execution failed');
    } finally {
      setRunning(false);
    }
  }

  async function handleRunWithInput() {
    const allInputs = [...pendingInputs];
    setTerminal([{ type: 'system', text: `Running ${lang.label} program...` }]);
    setRunning(true);
    setWaitingInput(false);

    try {
      const { data } = await api.post('/execute/scratch', {
        language: lang.value,
        code,
        stdin: allInputs.join('\n'),
      });

      if (data.stdout) {
        const lines = data.stdout.split('\n');
        lines.forEach((line: string, i: number) => {
          if (i < lines.length - 1 || line) addLine('output', line);
        });
      }
      if (data.stderr) addLine('error', data.stderr);
      if (!data.stdout && !data.stderr) addLine('system', '(no output)');
      addLine('system', `Process exited with code ${data.exitCode ?? 0}`);
    } catch (err: any) {
      addLine('error', err?.response?.data?.error ?? 'Execution failed');
    } finally {
      setRunning(false);
      setPendingInputs([]);
    }
  }

  function handleInputSubmit(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      const val = inputValue;
      addLine('input', `> ${val}`);
      const newInputs = [...pendingInputs, val];
      setPendingInputs(newInputs);
      setInputValue('');
      setWaitingInput(false);
      // Re-run with all collected inputs
      setTimeout(() => handleRunWithInputs(newInputs), 50);
    }
  }

  async function handleRunWithInputs(inputs: string[]) {
    setRunning(true);
    try {
      const { data } = await api.post('/execute/scratch', {
        language: lang.value,
        code,
        stdin: inputs.join('\n'),
      });

      if (data.stdout) {
        const lines = data.stdout.split('\n');
        lines.forEach((line: string, i: number) => {
          if (i < lines.length - 1 || line) addLine('output', line);
        });
      }
      if (data.stderr) addLine('error', data.stderr);
      if (!data.stdout && !data.stderr) addLine('system', '(no output)');
      addLine('system', `Process exited with code ${data.exitCode ?? 0}`);
    } catch (err: any) {
      addLine('error', err?.response?.data?.error ?? 'Execution failed');
    } finally {
      setRunning(false);
    }
  }

  function handleLangChange(value: string) {
    const l = LANGUAGES.find(l => l.value === value) ?? LANGUAGES[0];
    setLang(l);
    setCode(l.starter);
    setTerminal([{ type: 'system', text: 'TestForge Terminal — click ▶ Run to execute your code' }]);
  }

  const editorFontSize = Math.round(parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.93);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#2d2d2d', borderBottom: '1px solid #3c3c3c', flexShrink: 0 }}>
        <select value={lang.value} onChange={e => handleLangChange(e.target.value)}
          style={{ background: '#3c3c3c', color: '#d4d4d4', border: '1px solid #555', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>
          {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>

        <button onClick={handleRun} disabled={running}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: running ? '#444' : '#007acc', color: '#fff',
            border: 'none', borderRadius: 6, padding: '5px 14px',
            fontSize: 12, fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer',
          }}>
          {running ? '⏳ Running…' : '▶ Run'}
        </button>

        <button onClick={() => setTerminal([{ type: 'system', text: 'Terminal cleared.' }])}
          style={{ background: 'transparent', color: '#888', border: '1px solid #555', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
          Clear
        </button>

        <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>Scratch pad — not saved</span>
      </div>

      {/* Editor + Terminal split */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Monaco editor — left 60% */}
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

        {/* Terminal panel — right 40% */}
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', background: '#0d0d0d' }}>
          {/* Terminal header */}
          <div style={{ padding: '5px 12px', background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#4ec9b0', fontWeight: 700, letterSpacing: 1 }}>TERMINAL</span>
            {running && <span style={{ fontSize: 10, color: '#facc15' }}>● running</span>}
          </div>

          {/* Output lines */}
          <div ref={terminalRef} style={{ flex: 1, overflow: 'auto', padding: '8px 12px', fontSize: 12, lineHeight: 1.7, fontFamily: "'Cascadia Code', 'Fira Code', monospace" }}>
            {terminal.map((line, i) => (
              <div key={i} style={{
                color: line.type === 'error' ? '#f87171'
                  : line.type === 'input' ? '#4ec9b0'
                  : line.type === 'system' ? '#6b7280'
                  : '#d4d4d4',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {line.text}
              </div>
            ))}

            {/* Input prompt when waiting */}
            {waitingInput && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#4ec9b0' }}>{'>'}</span>
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleInputSubmit}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: '#4ec9b0', fontSize: 12, fontFamily: 'inherit', flex: 1,
                    caretColor: '#4ec9b0',
                  }}
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Provide input button */}
          {!running && !waitingInput && (
            <div style={{ padding: '6px 12px', borderTop: '1px solid #2a2a2a', display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setWaitingInput(true); addLine('system', 'Provide input then press Enter:'); }}
                style={{ background: '#1a3a2a', color: '#4ec9b0', border: '1px solid #2a5a3a', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>
                + Provide Input
              </button>
              {pendingInputs.length > 0 && (
                <button onClick={handleRunWithInput}
                  style={{ background: '#007acc', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>
                  ▶ Run with inputs
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
