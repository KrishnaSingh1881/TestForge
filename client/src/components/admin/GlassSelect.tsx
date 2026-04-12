import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';

interface Option {
  value: string;
  label: string;
}

interface GlassSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export default function GlassSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  className = '',
}: GlassSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Selected Box */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 rounded-xl text-sm text-left flex items-center justify-between transition-all duration-300 group"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: value ? 'rgb(var(--text-primary))' : 'rgba(var(--text-primary), 0.5)',
        }}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <FiChevronDown 
          className={`transition-transform duration-300 text-indigo-400 ${isOpen ? 'rotate-180' : ''}`} 
        />
        
        {/* Glow effect on hover */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ boxShadow: '0 0 15px rgba(99, 102, 241, 0.1)' }} />
      </button>

      {/* Options Dropdown */}
      {isOpen && (
        <div 
          className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl border overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            background: 'rgba(15, 15, 25, 0.85)',
            backdropFilter: 'blur(20px)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          }}
        >
          <div className="max-h-60 overflow-auto custom-scrollbar p-1.5">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 mb-0.5 last:mb-0 flex items-center justify-between group ${
                  value === opt.value ? 'bg-indigo-500/20 text-indigo-400' : 'text-primary/70 hover:bg-white/5 hover:text-primary'
                }`}
              >
                <span>{opt.label}</span>
                {value === opt.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
