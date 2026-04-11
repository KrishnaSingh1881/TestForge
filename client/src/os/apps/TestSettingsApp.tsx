import { useEffect, useState } from 'react';
import api from '../../lib/axios';
import { useLenis } from '../../hooks/useLenis';

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

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500';
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
        <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ backgroundColor: value ? 'rgb(var(--accent))' : 'rgba(255,255,255,0.15)' }}
      >
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
          style={{ transform: value ? 'translateX(20px)' : 'translateX(0)' }} />
      </button>
    </div>
  );
}

export default function TestSettingsApp() {
  const lenisRef = useLenis();
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
    <div ref={lenisRef} className="h-full overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Test Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
          Configure the test environment for each test
        </p>
      </div>

      {/* Test selector */}
      <div className="glass p-5">
        <label className="block text-xs mb-2 font-medium uppercase tracking-wide"
          style={{ color: 'rgb(var(--text-secondary))' }}>Select Test</label>
        {loading ? (
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Loading tests...</p>
        ) : (
          <select value={selectedTestId} onChange={e => setSelectedTestId(e.target.value)}
            className={inputCls} style={inputStyle}>
            <option value="">Choose a test to configure...</option>
            {tests.map(t => (
              <option key={t.id} value={t.id}>{t.title} — {t.subject} ({t.status})</option>
            ))}
          </select>
        )}
      </div>

      {selectedTestId && (
        <>
          {/* Integrity & Anti-cheat */}
          <div className="glass p-5">
            <p className="text-xs font-medium uppercase tracking-wide mb-1"
              style={{ color: 'rgb(var(--text-secondary))' }}>Integrity & Anti-cheat</p>
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
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Max Tab Switches</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Number of tab switches before auto-submit triggers
                </p>
              </div>
              <input
                type="number" min={1} max={20} value={settings.max_tab_switches}
                onChange={e => set('max_tab_switches', Number(e.target.value))}
                className="w-20 px-3 py-1.5 rounded-lg text-sm text-center outline-none focus:ring-2 focus:ring-indigo-500"
                style={inputStyle}
              />
            </div>
          </div>

          {/* UI & Experience */}
          <div className="glass p-5">
            <p className="text-xs font-medium uppercase tracking-wide mb-1"
              style={{ color: 'rgb(var(--text-secondary))' }}>UI & Experience</p>
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: saved ? '#4ade80' : 'rgb(var(--accent))' }}>
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Settings'}
            </button>
            <button onClick={() => setSettings(DEFAULT_SETTINGS)}
              className="px-4 py-2.5 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
              Reset to Defaults
            </button>
          </div>
        </>
      )}
    </div>
  );
}
