import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.07)',
  border: '1px solid var(--glass-border)',
  color: 'rgb(var(--text-primary))',
};

const labelStyle = { color: 'rgb(var(--text-secondary))' };

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    role: 'student' as 'student' | 'admin',
    year: '', division: '', subject: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('http://localhost:4000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Registration failed');
      return;
    }

    navigate('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'rgb(var(--bg-primary))' }}>
      <div className="glass w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'rgb(var(--text-primary))' }}>
          Create account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm mb-1" style={labelStyle}>Full Name</label>
            <input type="text" required value={form.name} onChange={set('name')}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              style={inputStyle} />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm mb-1" style={labelStyle}>Email</label>
            <input type="email" required value={form.email} onChange={set('email')}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              style={inputStyle} />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm mb-1" style={labelStyle}>Password</label>
            <input type="password" required minLength={6} value={form.password} onChange={set('password')}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              style={inputStyle} />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm mb-1" style={labelStyle}>Role</label>
            <select value={form.role} onChange={set('role')}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              style={inputStyle}>
              <option value="student" style={{ background: '#1e293b', color: '#f8fafc' }}>Student</option>
              <option value="admin" style={{ background: '#1e293b', color: '#f8fafc' }}>Admin (Teacher)</option>
            </select>
          </div>

          {/* Student-only fields */}
          {form.role === 'student' && (
            <>
              <div>
                <label className="block text-sm mb-1" style={labelStyle}>Year</label>
                <select value={form.year} onChange={set('year')}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  style={inputStyle}>
                  <option value="" style={{ background: '#1e293b', color: '#f8fafc' }}>Select year</option>
                  {['FE', 'SE', 'TE', 'BE'].map(y => (
                    <option key={y} value={y} style={{ background: '#1e293b', color: '#f8fafc' }}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1" style={labelStyle}>Division</label>
                <select value={form.division} onChange={set('division')}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  style={inputStyle}>
                  <option value="" style={{ background: '#1e293b', color: '#f8fafc' }}>Select division</option>
                  {['A', 'B', 'C', 'D'].map(d => (
                    <option key={d} value={d} style={{ background: '#1e293b', color: '#f8fafc' }}>{d}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Admin-only fields */}
          {form.role === 'admin' && (
            <div>
              <label className="block text-sm mb-1" style={labelStyle}>Subject</label>
              <input type="text" value={form.subject} onChange={set('subject')}
                placeholder="e.g. Data Structures"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                style={inputStyle} />
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'rgb(var(--accent))' }}
          >
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="mt-4 text-sm text-center" style={{ color: 'rgb(var(--text-secondary))' }}>
          Already have an account?{' '}
          <Link to="/" className="underline" style={{ color: 'rgb(var(--accent))' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
