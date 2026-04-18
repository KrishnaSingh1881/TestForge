import React from 'react';

// Glass-style SVG icons — transparent backgrounds, white/light symbols
// The tile background comes from DockIcon, not the SVG itself

const G = 'rgba(255,255,255,0.9)';   // main symbol color
const D = 'rgba(255,255,255,0.45)';  // dim / secondary

export function IconTests() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect x="11" y="8" width="22" height="28" rx="3" fill={G}/>
      <rect x="17" y="5" width="10" height="6" rx="2" fill="rgba(255,255,255,0.6)"/>
      <rect x="15" y="18" width="14" height="2.5" rx="1.2" fill="rgba(120,180,255,0.8)"/>
      <rect x="15" y="23" width="14" height="2.5" rx="1.2" fill="rgba(120,180,255,0.8)"/>
      <rect x="15" y="28" width="9"  height="2.5" rx="1.2" fill="rgba(120,180,255,0.5)"/>
    </svg>
  );
}

export function IconQuestionBank() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect x="10" y="18" width="24" height="16" rx="3" fill={D} transform="rotate(-5 10 18)"/>
      <rect x="10" y="16" width="24" height="16" rx="3" fill="rgba(255,255,255,0.6)" transform="rotate(-2 10 16)"/>
      <rect x="10" y="14" width="24" height="16" rx="3" fill={G}/>
      <rect x="14" y="19" width="16" height="2.5" rx="1.2" fill="rgba(160,120,255,0.8)"/>
      <rect x="14" y="24" width="10" height="2.5" rx="1.2" fill="rgba(160,120,255,0.5)"/>
      <text x="28" y="29" fontSize="9" fill="rgba(160,120,255,0.9)" fontWeight="bold" fontFamily="system-ui">?</text>
    </svg>
  );
}

export function IconTestManager() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect x="7" y="11" width="30" height="26" rx="4" fill={G}/>
      <rect x="7" y="11" width="30" height="9"  rx="4" fill="rgba(200,120,255,0.7)"/>
      <rect x="7" y="17" width="30" height="3"  fill="rgba(200,120,255,0.7)"/>
      <rect x="13" y="7"  width="3" height="8" rx="1.5" fill={G}/>
      <rect x="28" y="7"  width="3" height="8" rx="1.5" fill={G}/>
      {([[11,25],[18,25],[25,25],[11,31],[18,31],[25,31]] as [number,number][]).map(([x,y],i)=>(
        <rect key={i} x={x} y={y} width="5" height="4" rx="1" fill="rgba(200,120,255,0.45)"/>
      ))}
    </svg>
  );
}

export function IconIntegrity() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <path d="M22 6 L34 11 V20 C34 28 29 35 22 38 C15 35 10 28 10 20 V11 L22 6Z" fill="rgba(255,255,255,0.15)" stroke={G} strokeWidth="2.5" />
      <path d="M22 12 V32" stroke={D} strokeWidth="2" strokeLinecap="round" />
      <path d="M16 18 H28" stroke={D} strokeWidth="2" strokeLinecap="round" />
      <circle cx="22" cy="20" r="3" fill="rgba(120,200,255,0.8)" />
    </svg>
  );
}

export function IconAdminAnalytics() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect x="9"  y="28" width="7" height="10" rx="2" fill={G}/>
      <rect x="19" y="20" width="7" height="18" rx="2" fill={G}/>
      <rect x="29" y="13" width="7" height="25" rx="2" fill={G}/>
      <polyline points="12.5,26 22.5,18 32.5,11" stroke="rgba(250,200,80,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="12.5" cy="26" r="2" fill="rgba(250,200,80,0.9)"/>
      <circle cx="22.5" cy="18" r="2" fill="rgba(250,200,80,0.9)"/>
      <circle cx="32.5" cy="11" r="2" fill="rgba(250,200,80,0.9)"/>
    </svg>
  );
}

export function IconCodeEditor() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect x="5" y="9" width="34" height="24" rx="4" fill="rgba(255,255,255,0.12)" stroke={G} strokeWidth="1.5"/>
      <rect x="5" y="9" width="34" height="7" rx="4" fill="rgba(255,255,255,0.15)"/>
      <rect x="5" y="13" width="34" height="3" fill="rgba(255,255,255,0.15)"/>
      <circle cx="11" cy="13" r="2" fill="rgba(255,100,100,0.8)"/>
      <circle cx="17" cy="13" r="2" fill="rgba(255,200,80,0.8)"/>
      <circle cx="23" cy="13" r="2" fill="rgba(80,220,120,0.8)"/>
      <text x="9" y="26" fontSize="7" fill="rgba(80,220,120,0.9)" fontFamily="monospace" fontWeight="bold">{'<>'}</text>
      <rect x="18" y="22" width="12" height="2" rx="1" fill="rgba(120,200,255,0.7)"/>
      <rect x="9"  y="27" width="8"  height="2" rx="1" fill="rgba(255,120,180,0.7)"/>
      <rect x="19" y="27" width="14" height="2" rx="1" fill="rgba(255,255,255,0.3)"/>
      <rect x="18" y="33" width="8"  height="3" rx="1" fill="rgba(255,255,255,0.2)"/>
      <rect x="13" y="36" width="18" height="2.5" rx="1" fill="rgba(255,255,255,0.2)"/>
    </svg>
  );
}

export function IconAnalytics() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <path d="M8 36 L16 26 L24 30 L32 18 L36 22" stroke={G} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M8 36 L16 26 L24 30 L32 18 L36 22 L36 38 L8 38Z" fill="rgba(255,255,255,0.1)"/>
      <circle cx="16" cy="26" r="3" fill={G}/>
      <circle cx="24" cy="30" r="3" fill={G}/>
      <circle cx="32" cy="18" r="3" fill={G}/>
    </svg>
  );
}

export function IconResults() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect x="9"  y="29" width="7" height="11" rx="2" fill={G}/>
      <rect x="19" y="21" width="7" height="19" rx="2" fill={G}/>
      <rect x="29" y="14" width="7" height="26" rx="2" fill={G}/>
      <polyline points="12.5,27 22.5,19 32.5,12" stroke="rgba(120,220,180,0.7)" strokeWidth="2" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

export function IconSettings() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="22" r="14" stroke={G} strokeWidth="3" fill="rgba(255,255,255,0.1)"/>
      <circle cx="22" cy="22" r="5" fill={D}/>
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
        <rect key={deg} x="20.5" y="5" width="3" height="6" rx="1.5" fill={G} transform={`rotate(${deg} 22 22)`}/>
      ))}
    </svg>
  );
}

export const APP_ICONS: Record<string, React.FC> = {
  'tests':           IconTests,
  'test-session':    IconTests,
  'results':         IconResults,
  'analytics':       IconAnalytics,
  'question-bank':   IconQuestionBank,
  'test-manager':    IconTestManager,
  'integrity':       IconIntegrity,
  'admin-analytics': IconAdminAnalytics,
  'code-editor':     IconCodeEditor,
  'settings':        IconSettings,
  'folder':          IconTestManager,
  'shield':          IconIntegrity,
  'prism':           IconResults,
};

export function GlassIcon({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' | 'lg' }) {
    const Icon = APP_ICONS[id] || IconTests;
    const scale = size === 'sm' ? 0.7 : size === 'lg' ? 1.4 : 1;
    
    return (
        <div style={{ transform: `scale(${scale})`, display: 'inline-flex' }}>
            <Icon />
        </div>
    );
}
