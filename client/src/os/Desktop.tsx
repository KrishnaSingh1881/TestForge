import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import WindowManager from './WindowManager';
import { useTheme } from '../context/ThemeContext';
import { useOSSettings } from './store/useOSSettings';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  opacity: number; targetOpacity: number;
  size: number;
}

export default function Desktop() {
  const wallpaperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const { isFocusMode } = useOSSettings();
  const isLight = theme === 'light';

  // GSAP parallax on mouse move
  useEffect(() => {
    if (!wallpaperRef.current || isFocusMode) return;
    const xTo = gsap.quickTo(wallpaperRef.current, 'x', { duration: 1.4, ease: 'power1.out' });
    const yTo = gsap.quickTo(wallpaperRef.current, 'y', { duration: 1.4, ease: 'power1.out' });
    const onMove = (e: MouseEvent) => {
      xTo((e.clientX / window.innerWidth  - 0.5) * 24);
      yTo((e.clientY / window.innerHeight - 0.5) * 14);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Canvas particles — re-run when theme changes to swap colors
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const count = 55;
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      opacity: Math.random() * 0.5 + 0.1,
      targetOpacity: Math.random() * 0.5 + 0.1,
      size: Math.random() * 1.3 + 0.4,
    }));

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Read current theme from DOM so we don't need to restart on change
      const light = document.documentElement.getAttribute('data-theme') === 'light';

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        p.opacity += (p.targetOpacity - p.opacity) * 0.015;
        if (Math.abs(p.opacity - p.targetOpacity) < 0.01) {
          p.targetOpacity = Math.random() * 0.5 + 0.1;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

        if (light) {
          // Clean blue/indigo glowing particles for crystal light mode
          const r = Math.random();
          let color: string;
          if (r > 0.7)       color = `rgba(59,  130, 246, ${p.opacity * 0.9})`;   // blue-500
          else if (r > 0.4)  color = `rgba(99,  102, 241, ${p.opacity * 0.8})`;   // indigo-500
          else               color = `rgba(148, 163, 184, ${p.opacity * 0.7})`;   // slate-400

          // Subtle cool glow halo
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5);
          grd.addColorStop(0, `rgba(99, 102, 241, ${p.opacity * 0.35})`);
          grd.addColorStop(1, `rgba(99, 102, 241, 0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 5, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();

          // Precise core dot
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.4, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        } else {
          // Cool blue-violet glowing particles for dark mode
          const blue = Math.random() > 0.75;

          // Glow halo
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.5);
          grd.addColorStop(0, blue ? `rgba(160,140,255,${p.opacity * 0.5})` : `rgba(220,215,255,${p.opacity * 0.35})`);
          grd.addColorStop(1, `rgba(160,140,255,0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();

          // Core dot
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = blue
            ? `rgba(160, 140, 255, ${p.opacity})`
            : `rgba(220, 215, 255, ${p.opacity})`;
          ctx.fill();
        }
      });

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [isFocusMode]); // Re-run or pause loop when Focus Mode changes

  return (
    <div 
      className={isFocusMode ? 'focus-mode-distraction-free' : ''}
      style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}
    >
      {/* Background layer — transitions via CSS */}
      <div
        ref={wallpaperRef}
        style={{ 
          position: 'absolute', 
          inset: -30, 
          willChange: 'transform',
          transform: isFocusMode ? 'translate(0,0) !important' : undefined 
        }}
      >
        <div className={isLight ? 'desktop-bg desktop-bg--light' : 'desktop-bg'} />
      </div>

      {/* Particle canvas */}
      {!isFocusMode && (
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
        />
      )}

      {/* Windows */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
        <WindowManager />
      </div>

      <style>{`
        /* ── Dark mode background ── */
        .desktop-bg {
          width: 100%; height: 100%;
          position: relative; overflow: hidden;
          background: #08081a;
          transition: background 0.8s ease;
        }
        .desktop-bg::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 70% 50% at 50% 100%, rgba(100, 60, 180, 0.28) 0%, transparent 65%),
            radial-gradient(ellipse 40% 30% at 75% 15%,  rgba(60,  40, 120, 0.15) 0%, transparent 60%),
            radial-gradient(ellipse 30% 25% at 20% 30%,  rgba(50,  30, 100, 0.12) 0%, transparent 55%);
          transition: opacity 0.8s ease;
        }
        .desktop-bg::after {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 50% 35% at 50% 95%, rgba(120, 70, 200, 0.15) 0%, transparent 60%);
          animation: ambientPulse 6s ease-in-out infinite alternate;
          transition: opacity 0.8s ease;
        }

        /* ── Light mode background — Arctic Crystal ── */
        .desktop-bg--light {
          background: #f8fafc;
        }
        .desktop-bg--light::before {
          background:
            radial-gradient(ellipse 70% 50% at 50% 100%, rgba(59,  130, 246, 0.12) 0%, transparent 65%),
            radial-gradient(ellipse 50% 35% at 80% 10%,  rgba(99,  102, 241, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse 40% 30% at 15% 25%,  rgba(148, 163, 184, 0.05) 0%, transparent 55%);
        }
        .desktop-bg--light::after {
          background: radial-gradient(ellipse 55% 40% at 50% 95%, rgba(59, 130, 246, 0.08) 0%, transparent 60%);
        }

        @keyframes ambientPulse {
          0%   { opacity: 0.6; }
          100% { opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
