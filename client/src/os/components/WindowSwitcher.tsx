import { motion, AnimatePresence } from 'framer-motion';
import { useOSStore } from '../store/useOSStore';

export default function WindowSwitcher() {
  const { windows, focusedWindowId, isSwitcherOpen, focusWindow, restoreWindow } = useOSStore();

  if (!isSwitcherOpen) return null;

  // Only show windows that aren't closed (windows in the store)
  const sortedWindows = [...windows].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-[600] flex items-center justify-center bg-black/40 backdrop-blur-md"
      >
        <div className="glass p-8 flex gap-6 overflow-x-auto max-w-[90vw] custom-scrollbar">
          {sortedWindows.map((win) => (
            <button
              key={win.id}
              onClick={() => {
                if (win.isMinimized) restoreWindow(win.id);
                focusWindow(win.id);
              }}
              className={`flex flex-col items-center gap-3 p-6 rounded-3xl transition-all ${
                focusedWindowId === win.id 
                  ? 'bg-white/10 ring-2 ring-indigo-500/50 shadow-2xl scale-110' 
                  : 'hover:bg-white/5 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-3xl">
                {/* 
                   In a real app, we'd get the icon from an app registry. 
                   For now, we just use the first letter of the type. 
                */}
                {win.appType[0].toUpperCase()}
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-white whitespace-nowrap">
                {win.title}
              </span>
            </button>
          ))}
          {windows.length === 0 && (
            <p className="text-sm font-bold opacity-40 uppercase tracking-widest text-white">
              No active windows
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
