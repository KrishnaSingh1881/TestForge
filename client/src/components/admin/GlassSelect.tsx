import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
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

  function handleOpen() {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
      });
    }
    setIsOpen(v => !v);
  }

  const dropdown = isOpen ? createPortal(
    <div
      style={{
        ...dropdownStyle,
        background: 'rgba(15, 15, 25, 0.97)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '1rem',
        boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}
    >
      <div className="max-h-60 overflow-auto p-1.5">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onMouseDown={e => { e.preventDefault(); onChange(opt.value); setIsOpen(false); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 mb-0.5 last:mb-0 flex items-center justify-between ${
              value === opt.value ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>{opt.label}</span>
            {value === opt.value && (
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}
          </button>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="w-full px-4 py-2.5 rounded-xl text-sm text-left flex items-center justify-between transition-all duration-300"
        style={{
          backgroundColor: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: value ? 'rgb(var(--text-primary))' : 'rgba(255,255,255,0.4)',
        }}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <FiChevronDown className={`transition-transform duration-300 text-indigo-400 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {dropdown}
    </div>
  );
}
