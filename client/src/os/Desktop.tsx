import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import WindowManager from './WindowManager';

export default function Desktop() {
  const wallpaperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // GSAP wallpaper parallax
  useEffect(() => {
    if (!wallpaperRef.current) return;

    const xTo = gsap.quickTo(wallpaperRef.current, 'x', { duration: 1.2, ease: 'power1.out' });
    const yTo = gsap.quickTo(wallpaperRef.current, 'y', { duration: 1.2, ease: 'power1.out' });

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX / window.innerWidth - 0.5) * 20;
      const dy = (e.clientY / window.innerHeight - 0.5) * 12;
      xTo(dx);
      yTo(dy);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // GSAP canvas particle layer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return; // Disable particles entirely
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create particles
    const particleCount = Math.floor(Math.random() * 21) + 40; // 40-60 particles
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      opacity: number;
      size: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3, // Slow drift
        vy: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.2,
        size: Math.random() * 2 + 1,
      });
    }

    // Animation loop
    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(particle => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Opacity pulse (subtle)
        particle.opacity += (Math.random() - 0.5) * 0.01;
        particle.opacity = Math.max(0.1, Math.min(0.7, particle.opacity));

        // Draw particle
        ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <div className="desktop">
      {/* Wallpaper layer with mesh gradient */}
      <div ref={wallpaperRef} className="wallpaper-layer">
        <div className="mesh-gradient" />
      </div>

      {/* Particle canvas */}
      <canvas ref={canvasRef} className="particle-canvas" />

      {/* Window manager */}
      <WindowManager />

      <style>{`
        .desktop {
          position: fixed;
          inset: 0;
          overflow: hidden;
        }

        .wallpaper-layer {
          position: absolute;
          inset: -20px;
          will-change: transform;
        }

        .mesh-gradient {
          width: 100%;
          height: 100%;
          background: 
            radial-gradient(at 20% 30%, #1e1b4b 0%, transparent 50%),
            radial-gradient(at 80% 70%, #0f172a 0%, transparent 50%),
            radial-gradient(at 50% 50%, #1e293b 0%, transparent 80%),
            #0f172a;
        }

        .particle-canvas {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
        }
      `}</style>
    </div>
  );
}
