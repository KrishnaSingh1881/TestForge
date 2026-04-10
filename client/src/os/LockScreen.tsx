import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function LockScreen() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const wallpaperRef = useRef<HTMLDivElement>(null);
  const cardRef      = useRef<HTMLDivElement>(null);
  const fieldsRef    = useRef<HTMLDivElement>(null);

  // Entrance animation
  useEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo(wallpaperRef.current,
      { filter: 'blur(0px)', opacity: 0 },
      { filter: 'blur(20px)', opacity: 1, duration: 0.6, ease: 'power2.out' }
    )
    .fromTo(cardRef.current,
      { y: 60, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' },
      '-=0.2'
    )
    .fromTo('.lock-field',
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.1, duration: 0.3 },
      '-=0.1'
    );
    return () => { tl.kill(); };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      // Shake card
      gsap.fromTo(cardRef.current,
        { x: -8 },
        { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' }
      );
      return;
    }

    // Dismiss animation
    const tl = gsap.timeline();
    tl.to(cardRef.current, { y: -40, opacity: 0, duration: 0.35, ease: 'power2.in' })
      .to(wallpaperRef.current, { opacity: 0, duration: 0.3 }, '-=0.1');
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 1000 }}
    >
      {/* Blurred wallpaper background */}
      <div
        ref={wallpaperRef}
        className="absolute inset-0 desktop-wallpaper"
        style={{ opacity: 0 }}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} />

      {/* Login card */}
      <div
        ref={cardRef}
        className="relative glass flex flex-col items-center gap-5 p-8"
        style={{ width: 340, opacity: 0 }}
      >
        {/* Avatar */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
          style={{ background: 'rgba(99,102,241,0.3)', border: '2px solid rgba(99,102,241,0.5)', color: '#fff' }}
        >
          {user?.name?.[0]?.toUpperCase() ?? '🔒'}
        </div>

        <div className="text-center">
          <h2 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {user?.name ?? 'TestForge'}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-3" ref={fieldsRef}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="lock-field w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="lock-field w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
            }}
          />

          {error && (
            <p className="text-xs text-center" style={{ color: '#f87171' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="lock-field w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'rgb(var(--accent))' }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : 'Sign In →'}
          </button>
        </form>

        <a
          href="/register"
          className="text-xs transition-opacity hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Create account
        </a>
      </div>
    </div>
  );
}
