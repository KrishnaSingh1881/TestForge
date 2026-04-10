import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="relative w-12 h-6 rounded-full transition-colors duration-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      style={{
        backgroundColor:
          theme === 'dark' ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.3)',
      }}
    >
      {/* Track glow */}
      <span
        className="absolute inset-0 rounded-full blur-sm opacity-50 transition-opacity duration-400"
        style={{ backgroundColor: 'rgb(99 102 241)' }}
      />
      {/* Thumb */}
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-400 flex items-center justify-center text-xs"
        style={{
          left: theme === 'dark' ? '2px' : 'calc(100% - 22px)',
          backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
        }}
      >
        {theme === 'dark' ? '🌙' : '☀️'}
      </span>
    </button>
  );
}
