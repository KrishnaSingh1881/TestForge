import { useEffect, useState } from 'react';
import api from '../../lib/axios';
import GlassSelect from '../../components/admin/GlassSelect';

interface Test {
  id: string;
  title: string;
  subject: string;
  status: string;
}

interface TestSettings {
  allow_paste: boolean;
  allow_copy: boolean;
  max_tab_switches: number;
  allow_right_click: boolean;
  show_remaining_time: boolean;
  auto_submit_on_tab_limit: boolean;
  show_question_marks: boolean;
  allow_back_navigation: boolean;
}

const DEFAULT_SETTINGS: TestSettings = {
  allow_paste: false,
  allow_copy: false,
  max_tab_switches: 3,
  allow_right_click: false,
  show_remaining_time: true,
  auto_submit_on_tab_limit: true,
  show_question_marks: true,
  allow_back_navigation: true,
};

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent transition-all';
const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.07)',
  border: '1px solid var(--glass-border)',
  color: 'rgb(var(--text-primary))',
};

function Toggle({ label, description, value, onChange }: {
  label: string; description?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3"
      style={{ borderBottom: '1px solid var(--glass-border)' }}>
      <div>
        <p className="text-sm font-black uppercase tracking-tight text-primary">{label}</p>
        {description && <p className="text-[10px] font-bold uppercase tracking-widest text-secondary opacity-40 mt-1">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
        style={{ backgroundColor: value ? 'rgb(var(--accent))' : 'rgba(255,255,255,0.15)' }}
      >
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-lg transition-transform"
          style={{ transform: value ? 'translateX(20px)' : 'translateX(0)' }} />
      </button>
    </div>
  );
}

export default function TestSettingsApp() {
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [settings, setSettings] = useState<TestSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/tests').then(r => {
      setTests(r.data.tests ?? []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTestId) return;
    api.get(`/tests/${selectedTestId}/settings`)
      .then(r => setSettings({ ...DEFAULT_SETTINGS, ...(r.data.settings ?? {}) }))
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, [selectedTestId]);

  function set<K extends keyof TestSettings>(key: K, value: TestSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (!selectedTestId) { setError('Select a test first'); return; }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/tests/${selectedTestId}/settings`, { settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-auto p-8 space-y-8 bg-transparent custom-scrollbar animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-primary uppercase tracking-tight">Test Settings</h1>
        <p className="text-[10px] font-black uppercase text-secondary tracking-widest mt-1 opacity-40">
           Environment configuration & Behavioral enforcement
        </p>
      </div>

      {/* Test selector */}
      <div className="glass-2 p-6 bg-white/[0.01]">
        <label className="block text-[10px] font-black uppercase tracking-widest text-secondary opacity-40 mb-3">Select Target Evaluation</label>
        {loading ? (
          <p className="text-xs font-black uppercase tracking-widest opacity-20">Syncing database...</p>
        ) : (
          <GlassSelect 
            value={selectedTestId}
            onChange={setSelectedTestId}
            options={tests.map(t => ({
              value: t.id,
              label: `${t.title} — ${t.subject} (${t.status})`
            }))}
            placeholder="Choose a test to configure..."
          />
        )}
      </div>

      {selectedTestId && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* Integrity & Anti-cheat */}
          <div className="glass-2 p-6 bg-white/[0.01]">
            <p className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-40 mb-4">Integrity & Forensic Countermeasures</p>
            <Toggle
              label="Allow Paste"
              description="Let students paste code/text into answers"
              value={settings.allow_paste}
              onChange={v => set('allow_paste', v)}
            />
            <Toggle
              label="Allow Copy"
              description="Let students copy text from the test"
              value={settings.allow_copy}
              onChange={v => set('allow_copy', v)}
            />
            <Toggle
              label="Allow Right Click"
              description="Enable browser context menu during test"
              value={settings.allow_right_click}
              onChange={v => set('allow_right_click', v)}
            />
            <Toggle
              label="Auto-submit on Tab Limit"
              description="Automatically submit when max tab switches is reached"
              value={settings.auto_submit_on_tab_limit}
              onChange={v => set('auto_submit_on_tab_limit', v)}
            />
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-sm font-black uppercase tracking-tight text-primary">Max Tab Switches</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-secondary opacity-40 mt-1">
                  Alert threshold before biometric disqualification
                </p>
              </div>
              <input
                type="number" min={1} max={20} value={settings.max_tab_switches}
                onChange={e => set('max_tab_switches', Number(e.target.value))}
                className="w-20 px-3 py-1.5 rounded-lg text-sm text-center font-bold outline-none focus:ring-2 focus:ring-accent"
                style={inputStyle}
              />
            </div>
          </div>

          {/* UI & Experience */}
          <div className="glass-2 p-6 bg-white/[0.01]">
            <p className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-40 mb-4">Interface & Feedback Systems</p>
            <Toggle
              label="Show Remaining Time"
              description="Display countdown timer to students"
              value={settings.show_remaining_time}
              onChange={v => set('show_remaining_time', v)}
            />
            <Toggle
              label="Show Question Marks"
              description="Show marks per question to students"
              value={settings.show_question_marks}
              onChange={v => set('show_question_marks', v)}
            />
            <Toggle
              label="Allow Back Navigation"
              description="Let students go back to previous questions"
              value={settings.allow_back_navigation}
              onChange={v => set('allow_back_navigation', v)}
            />
          </div>

          {error && <p className="text-sm text-red-400 font-bold uppercase tracking-widest">{error}</p>}

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className={`flex-1 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl disabled:opacity-50 ${saved ? 'bg-green-500 text-white' : 'bg-accent text-white hover:bg-accent/90 hover:-translate-y-0.5 shadow-accent/20'}`}
            >
              {saving ? 'Synchronizing...' : saved ? '✓ Configuration Locked' : 'Authorize Save'}
            </button>
            <button onClick={() => setSettings(DEFAULT_SETTINGS)}
              className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-white/5 bg-white/5 text-secondary hover:bg-white/10 transition-all"
            >
              Reset Protocols
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
