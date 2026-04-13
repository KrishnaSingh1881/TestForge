import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Mail, Shield, User, Globe } from 'lucide-react';

export default function LockScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'student' | 'admin'>('student');
  const [isLogin, setIsLogin] = useState(true);

  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(containerRef.current, 
      { opacity: 0, scale: 0.98 },
      { opacity: 1, scale: 1, duration: 1.2, ease: 'power4.out' }
    );
  }, []);

  async function handleAction(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isLogin) {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError('Invalid credentials');
        setLoading(false);
        gsap.to(cardRef.current, { x: -6, repeat: 5, yoyo: true, duration: 0.05, onComplete: () => gsap.set(cardRef.current, { x: 0 }) });
      }
    } else {
      const { error: authError } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: { name, role: mode } }
      });
      if (authError) {
        setError(authError.message);
        setLoading(false);
      } else {
        setError('Check your email for confirmation!');
        setLoading(false);
      }
    }
  }

  const accentColor = mode === 'admin' ? '#ff4d00' : '#6366f1';

  return (
    <div ref={containerRef} className="fixed inset-0 flex items-center justify-center bg-[#0a0a0c] font-sans selection:bg-white/10" style={{ zIndex: 1000 }}>
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 opacity-[0.03]" 
           style={{ backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      
      {/* Radial Spotlight */}
      <div className="absolute inset-0" 
           style={{ background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 70%)` }} />

      {/* Main Window Wrapper */}
      <div className="relative w-full max-w-[900px] aspect-[s16/10] bg-[#111114] rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/5 overflow-hidden flex flex-col">
        
        {/* macOS Traffic Lights */}
        <div className="p-5 flex gap-2 border-b border-white/[0.02]">
          <div className="w-3 h-3 rounded-full bg-red-500/20" />
          <div className="w-3 h-3 rounded-full bg-amber-500/20" />
          <div className="w-3 h-3 rounded-full bg-green-500/20" />
        </div>

        <div className="flex-1 flex items-center justify-center relative">
          
          <div ref={cardRef} className="w-[380px] p-10 flex flex-col items-center">
            
            {/* Logo */}
            <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-8 shadow-inner">
               <Shield size={24} style={{ color: accentColor }} />
            </div>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-medium text-white mb-2 tracking-tight">
                {isLogin ? 'Welcome back to' : 'Join'} <span style={{ color: accentColor }}>TestForge</span>
              </h1>
              <p className="text-sm text-white/40 font-light">
                {isLogin ? 'Continue your academic journey.' : 'Begin your secure testing experience.'}
              </p>
            </div>

            {/* Mode Toggle */}
            <div className="w-full flex p-1 bg-white/[0.03] rounded-full border border-white/5 mb-6">
              <button onClick={() => setMode('student')} 
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all ${mode === 'student' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30'}`}>
                Student
              </button>
              <button onClick={() => setMode('admin')} 
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all ${mode === 'admin' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30'}`}>
                Admin
              </button>
            </div>

            <form onSubmit={handleAction} className="w-full space-y-3">
              {!isLogin && (
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full h-11 px-4 bg-transparent border border-white/5 focus:border-white/20 rounded-xl outline-none text-white text-sm transition-all placeholder:text-white/20"
                />
              )}
              
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-11 px-4 bg-transparent border border-white/5 focus:border-white/20 rounded-xl outline-none text-white text-sm transition-all placeholder:text-white/20"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-11 px-4 bg-transparent border border-white/5 focus:border-white/20 rounded-xl outline-none text-white text-sm transition-all placeholder:text-white/20"
              />

              {error && <p className={`text-[10px] text-center font-bold uppercase tracking-widest pt-2 ${error.includes('Check') ? 'text-green-400' : 'text-red-500/80'}`}>{error}</p>}

              <button disabled={loading} className="w-full h-11 rounded-xl text-white text-sm font-bold transition-all mt-4 flex items-center justify-center gap-2"
                      style={{ background: accentColor, boxShadow: `0 10px 30px ${accentColor}22` }}>
                {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-[11px] text-white/30 hover:text-white transition-all underline underline-offset-4">
               {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>

          </div>

          <div className="absolute bottom-8 right-10 text-white/[0.02] text-7xl font-black italic select-none pointer-events-none">
             FORGE
          </div>
        </div>
      </div>
    </div>
  );
}
