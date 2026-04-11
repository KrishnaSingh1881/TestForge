import { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import api from '../../lib/axios';

const LANGUAGES = [
  { label: 'Python', value: 'python', starter: '# Write your Python code here\nprint("Hello, World!")\n' },
  { label: 'C++',    value: 'cpp',    starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n' },
  { label: 'C',      value: 'c',      starter: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n' },
  { label: 'Java',   value: 'java',   starter: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n' },
];

export default function CodeEditorApp() {
  const [lang, setLang] = useState(LANGUAGES[0]);
  const [code, setCode] = useState(LANGUAGES[0].starter);
  const [stdin, setStdin] = useState('');
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const editorFontSize = Math.round(parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.93);

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

        <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>Scratch pad — code is not saved</span>
      </div>

      {/* Editor + right panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Monaco editor */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
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

        {/* Right panel: stdin + output */}
        <div style={{ width: 320, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #3c3c3c', flexShrink: 0 }}>

          {/* Stdin */}
          <div style={{ padding: '8px 10px', background: '#252526', borderBottom: '1px solid #3c3c3c', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Input (stdin)</div>
            <textarea
              value={stdin}
              onChange={e => setStdin(e.target.value)}
              placeholder="Provide input for your program here..."
              style={{
                width: '100%', height: 80, resize: 'none',
                background: '#1e1e1e', color: '#d4d4d4',
                border: '1px solid #3c3c3c', borderRadius: 4,
                padding: '6px 8px', fontSize: 12, fontFamily: 'monospace', outline: 'none',
              }}
            />
          </div>

          {/* Output */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '6px 10px', background: '#252526', borderBottom: '1px solid #3c3c3c', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Output</span>
              {exitCode !== null && (
                <span style={{ fontSize: 10, fontWeight: 700, color: exitCode === 0 ? '#4ade80' : '#f87171' }}>
                  {exitCode === 0 ? '✓ OK' : `✗ Exit ${exitCode}`}
                </span>
              )}
            </div>
            <div ref={outputRef} style={{ flex: 1, overflow: 'auto', padding: '8px 10px', background: '#1e1e1e', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {!stdout && !stderr && !running && <span style={{ color: '#555' }}>Run your code to see output here.</span>}
              {running && <span style={{ color: '#888' }}>Running…</span>}
              {stdout && <span style={{ color: '#d4d4d4' }}>{stdout}</span>}
              {stderr && <span style={{ color: '#f87171' }}>{stderr}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
