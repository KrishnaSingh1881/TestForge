# Design Document: TestForge OS UI


## Overview

TestForge OS UI replaces the current page-navigation model with a macOS-style browser desktop. The entire application runs inside a single React tree rooted at `<OSShell>`. Users authenticate through a Lock Screen overlay, then interact with the platform by launching windowed apps from a Dock. All existing Express + Supabase backend APIs remain unchanged; only the frontend shell and component architecture changes.

The design is split into two layers: the **OS Shell** (MenuBar, Dock, Desktop, LockScreen, WindowManager) and the **App Layer** (eight role-gated apps rendered inside draggable, resizable windows). The most complex app is `TestSessionApp`, which hosts a VSCode-identical layout for debugging questions — left file-tree navigator, Monaco editor, resizable terminal panel, and a VSCode-style status bar.

The animation stack is deliberately split by concern: Framer Motion owns all window lifecycle and dock magnification (React-integrated, spring physics), GSAP owns the lock screen entrance sequence and wallpaper parallax (timeline-based, imperative), and Lenis handles smooth scrolling inside window content areas.


---

## Architecture

### System Diagram

```
Browser Viewport (100vw × 100vh)
├── <OSShell>                          ← root, owns ThemeContext + AuthContext
│   ├── <LockScreen>                   ← conditional overlay (unauthenticated)
│   ├── <Desktop>                      ← wallpaper layer (mesh gradient + GSAP particles)
│   │   └── <WindowManager>            ← renders all open AppWindows
│   │       ├── <AppWindow id="tests">
│   │       │   └── <TestsApp>
│   │       ├── <AppWindow id="session-{attemptId}">
│   │       │   └── <TestSessionApp>
│   │       │       └── <VSCodeLayout>
│   │       │           ├── <QuestionNavigator> (file tree)
│   │       │           ├── <MonacoEditor>
│   │       │           └── <Terminal>
│   │       └── ... (other app windows)
│   ├── <MenuBar>
│   └── <Dock>
```

### Data Flow

```
Zustand OSStore
  ├── windows[]          → WindowManager reads, renders AppWindows
  ├── focusedWindowId    → MenuBar reads active app name
  ├── isAuthenticated    → OSShell shows LockScreen or Desktop
  └── theme              → OSShell sets data-theme on <html>

AuthContext (existing)
  └── user, session, signOut → consumed by LockScreen, MenuBar, Dock, all Apps

React Router (minimal)
  ├── /          → OSShell (entire OS lives here)
  └── /register  → standalone Register page (no OS chrome)
```

### Routing Strategy

The OS lives entirely at `/`. React Router is used only to separate the `/register` page from the OS shell. All "navigation" inside the OS is window open/close operations on the Zustand store — no URL changes.


---

## Component Tree and File Structure

```
client/src/
├── os/
│   ├── OSShell.tsx              ← root OS component, mounts MenuBar + Dock + Desktop + LockScreen
│   ├── Desktop.tsx              ← wallpaper (mesh gradient CSS) + GSAP particle layer
│   ├── MenuBar.tsx              ← top bar: active app name, clock, avatar, theme toggle
│   ├── Dock.tsx                 ← bottom pill: app icons with Framer Motion magnification
│   ├── LockScreen.tsx           ← auth overlay with GSAP entrance timeline
│   ├── WindowManager.tsx        ← AnimatePresence wrapper, renders all open AppWindows
│   ├── AppWindow.tsx            ← single window: react-rnd + Framer Motion + glass chrome
│   ├── store/
│   │   └── useOSStore.ts        ← Zustand store (window manager state)
│   ├── apps/
│   │   ├── registry.ts          ← app definitions (id, name, icon, component, roles, defaultSize)
│   │   ├── TestsApp.tsx
│   │   ├── TestSessionApp.tsx
│   │   ├── ResultsApp.tsx
│   │   ├── AnalyticsApp.tsx     ← student variant
│   │   ├── QuestionBankApp.tsx
│   │   ├── TestManagerApp.tsx
│   │   ├── IntegrityApp.tsx
│   │   └── AdminAnalyticsApp.tsx
│   └── components/
│       ├── TrafficLights.tsx    ← red/yellow/green circles
│       ├── WindowTitleBar.tsx   ← title bar chrome (traffic lights + title + timer slot)
│       ├── DockIcon.tsx         ← single dock icon with magnification + indicator dot
│       ├── VSCodeLayout.tsx     ← the debugging question IDE layout
│       └── Terminal.tsx         ← terminal panel (output, run button, results)
├── context/
│   ├── AuthContext.tsx          ← existing, unchanged
│   └── ThemeContext.tsx         ← existing, unchanged
└── pages/
    └── Register.tsx             ← existing, standalone (no OS chrome)
```


---

## Zustand Store — `useOSStore`

```typescript
// os/store/useOSStore.ts

export type AppType =
  | 'tests'
  | 'test-session'
  | 'results'
  | 'analytics'
  | 'question-bank'
  | 'test-manager'
  | 'integrity'
  | 'admin-analytics';

export interface WindowState {
  id: string;                    // unique instance id, e.g. "tests-1", "session-abc123"
  appType: AppType;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  isLocked: boolean;             // true during active test attempt — disables drag/resize/close
  zIndex: number;
  // Stored pre-maximize values for restore
  prevPosition?: { x: number; y: number };
  prevSize?: { width: number; height: number };
  // App-specific props passed into the app component
  appProps?: Record<string, unknown>;
}

export interface OSStore {
  windows: WindowState[];
  focusedWindowId: string | null;
  nextZIndex: number;

  // Actions
  openWindow: (appType: AppType, appProps?: Record<string, unknown>) => string;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  unmaximizeWindow: (id: string) => void;
  updatePosition: (id: string, pos: { x: number; y: number }) => void;
  updateSize: (id: string, size: { width: number; height: number }) => void;
  lockWindow: (id: string) => void;
  unlockWindow: (id: string) => void;
  closeAll: () => void;          // called on sign-out
}
```

**Z-index strategy**: `nextZIndex` starts at 100 and increments by 1 on every `focusWindow` call. The focused window always gets `nextZIndex`; all others keep their last assigned value. This gives a stable paint order without repainting the entire stack.

**Window ID generation**: `openWindow` generates `${appType}-${Date.now()}`. For test sessions, the caller passes `appProps: { attemptId }` and the id becomes `test-session-${attemptId}` to prevent duplicate session windows.


---

## App Registry

```typescript
// os/apps/registry.ts

export interface AppDefinition {
  id: AppType;
  name: string;
  icon: string;                  // emoji or SVG path reference
  component: React.ComponentType<any>;
  defaultSize: { width: number; height: number };
  defaultPosition: { x: number; y: number };  // offset from center
  allowedRoles: Array<'student' | 'admin' | 'super_admin'>;
  singleton: boolean;            // if true, clicking dock re-focuses instead of opening new
}

export const APP_REGISTRY: AppDefinition[] = [
  // Student apps
  {
    id: 'tests',
    name: 'Tests',
    icon: '📋',
    component: TestsApp,
    defaultSize: { width: 760, height: 560 },
    defaultPosition: { x: 80, y: 60 },
    allowedRoles: ['student'],
    singleton: true,
  },
  {
    id: 'test-session',
    name: 'Test Session',
    icon: '⌨️',
    component: TestSessionApp,
    defaultSize: { width: 1100, height: 720 },
    defaultPosition: { x: 60, y: 40 },
    allowedRoles: ['student'],
    singleton: false,           // multiple sessions not allowed but ID deduplication handles it
  },
  {
    id: 'results',
    name: 'Results',
    icon: '📊',
    component: ResultsApp,
    defaultSize: { width: 800, height: 600 },
    defaultPosition: { x: 100, y: 80 },
    allowedRoles: ['student', 'admin', 'super_admin'],
    singleton: false,
  },
  {
    id: 'analytics',
    name: 'Analytics',
    icon: '📈',
    component: AnalyticsApp,
    defaultSize: { width: 900, height: 640 },
    defaultPosition: { x: 120, y: 70 },
    allowedRoles: ['student'],
    singleton: true,
  },
  // Admin apps
  {
    id: 'question-bank',
    name: 'Question Bank',
    icon: '🗃️',
    component: QuestionBankApp,
    defaultSize: { width: 1000, height: 680 },
    defaultPosition: { x: 80, y: 50 },
    allowedRoles: ['admin', 'super_admin'],
    singleton: true,
  },
  {
    id: 'test-manager',
    name: 'Test Manager',
    icon: '🗓️',
    component: TestManagerApp,
    defaultSize: { width: 960, height: 660 },
    defaultPosition: { x: 100, y: 60 },
    allowedRoles: ['admin', 'super_admin'],
    singleton: true,
  },
  {
    id: 'integrity',
    name: 'Integrity',
    icon: '🔍',
    component: IntegrityApp,
    defaultSize: { width: 1000, height: 680 },
    defaultPosition: { x: 90, y: 55 },
    allowedRoles: ['admin', 'super_admin'],
    singleton: false,
  },
  {
    id: 'admin-analytics',
    name: 'Analytics',
    icon: '📈',
    component: AdminAnalyticsApp,
    defaultSize: { width: 960, height: 660 },
    defaultPosition: { x: 110, y: 65 },
    allowedRoles: ['admin', 'super_admin'],
    singleton: true,
  },
];
```


---

## Component APIs

### `<OSShell>`

```typescript
// No external props — reads AuthContext and OSStore internally
export default function OSShell(): JSX.Element
```

Responsibilities:
- Renders `<Desktop>`, `<MenuBar>`, `<Dock>`, and conditionally `<LockScreen>`
- Sets `data-theme` on `document.documentElement` via `ThemeContext`
- Prevents default browser scroll on the desktop layer (`overflow: hidden` on root)
- Calls `closeAll()` on sign-out

---

### `<AppWindow>`

```typescript
interface AppWindowProps {
  window: WindowState;
  dockIconRef: React.RefObject<HTMLElement>; // for minimize FLIP animation target
  children: React.ReactNode;
}

export default function AppWindow({ window, dockIconRef, children }: AppWindowProps): JSX.Element
```

Responsibilities:
- Wraps `react-rnd` for drag + resize
- Renders `<WindowTitleBar>` with `<TrafficLights>`
- Applies `isLocked` state: disables `react-rnd` drag/resize, replaces traffic lights with lock icon
- Applies `isMaximized` state: overrides position/size to fill desktop area (below MenuBar, above Dock)
- Calls `focusWindow` on any pointer-down event
- Framer Motion `motion.div` wraps the entire window for mount/unmount/minimize animations

---

### `<WindowTitleBar>`

```typescript
interface WindowTitleBarProps {
  windowId: string;
  title: string;
  isLocked: boolean;
  timerSlot?: React.ReactNode;   // optional — TestSessionApp injects countdown timer here
}

export default function WindowTitleBar(props: WindowTitleBarProps): JSX.Element
```

---

### `<TrafficLights>`

```typescript
interface TrafficLightsProps {
  windowId: string;
  isLocked: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

export default function TrafficLights(props: TrafficLightsProps): JSX.Element
```

When `isLocked` is true, renders a single lock icon (🔒) instead of the three circles.

---

### `<Dock>`

```typescript
// No external props — reads OSStore and AuthContext internally
export default function Dock(): JSX.Element
```

Renders only apps whose `allowedRoles` includes the current user's role.

---

### `<DockIcon>`

```typescript
interface DockIconProps {
  app: AppDefinition;
  isOpen: boolean;
  isMinimized: boolean;
  mouseX: MotionValue<number>;   // shared from Dock for magnification
  ref: React.RefObject<HTMLElement>; // exposed so AppWindow can target it for minimize animation
}

export default function DockIcon(props: DockIconProps): JSX.Element
```

---

### `<MenuBar>`

```typescript
// No external props — reads OSStore (focusedWindowId) and AuthContext internally
export default function MenuBar(): JSX.Element
```

---

### `<LockScreen>`

```typescript
// No external props — reads AuthContext internally
export default function LockScreen(): JSX.Element
```

---

### `<VSCodeLayout>`

```typescript
interface VSCodeLayoutProps {
  question: DebuggingQuestion;
  attemptId: string;
  questionNumber: number;
  initialRunsRemaining: number;
  isMarkedForReview: boolean;
  onAnswered: (qid: string, answered: boolean) => void;
  onToggleReview: (qid: string) => void;
}

export default function VSCodeLayout(props: VSCodeLayoutProps): JSX.Element
```

This is the most complex component. See the dedicated section below.

---

### `<Terminal>`

```typescript
interface TerminalProps {
  results: RunResult[];
  runsRemaining: number;
  running: boolean;
  onRun: () => void;
  height: number;                // controlled by drag handle
  onHeightChange: (h: number) => void;
}

export default function Terminal(props: TerminalProps): JSX.Element
```


---

## Animation Specifications

### Library Responsibilities

| Concern | Library | Rationale |
|---|---|---|
| Window open / close / minimize / maximize | Framer Motion | React-integrated, `AnimatePresence` handles mount/unmount cleanly |
| Dock icon magnification | Framer Motion `useMotionValue` + `useTransform` | Reactive to mouse position, no imperative code needed |
| Lock screen entrance sequence | GSAP timeline | Multi-step choreography (blur wallpaper → slide card → stagger fields) is cleaner as an imperative timeline |
| Wallpaper parallax on mouse move | GSAP | `gsap.quickTo` for performant pointer-tracking without React re-renders |
| Desktop particle layer | GSAP | Canvas-based, imperative animation loop |
| Smooth scroll inside window content | Lenis | Existing hook `useLenis` already in codebase |
| Theme color transitions | CSS transitions | Already defined in `index.css` on `*` selector |

### Window Open Animation (Framer Motion)

```typescript
// AppWindow motion variants
const windowVariants = {
  initial: { scale: 0.85, opacity: 0, y: 20 },
  animate: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
  exit: {
    scale: 0.85,
    opacity: 0,
    y: 20,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

// Minimize animation — window flies to dock icon position
// Uses FLIP: record window rect, record dock icon rect, animate translate + scale to zero
const minimizeVariants = (dockIconRect: DOMRect, windowRect: DOMRect) => ({
  exit: {
    x: dockIconRect.x - windowRect.x,
    y: dockIconRect.y - windowRect.y,
    scale: 0.1,
    opacity: 0,
    transition: { type: 'spring', stiffness: 300, damping: 28 },
  },
});
```

`prefers-reduced-motion` override: wrap all `transition` objects with a check:
```typescript
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const transition = reduceMotion
  ? { duration: 0.01 }
  : { type: 'spring', stiffness: 400, damping: 30 };
```

### Dock Magnification (Framer Motion)

```typescript
// In Dock.tsx
const mouseX = useMotionValue(Infinity);

// In DockIcon.tsx — distance-based scale
const distance = useTransform(mouseX, (x) => Math.abs(x - iconCenterX));
const scale = useTransform(distance, [0, 80, 160], [1.6, 1.3, 1.0]);
const y = useTransform(distance, [0, 80, 160], [-12, -6, 0]);
```

### Lock Screen GSAP Timeline

```typescript
// LockScreen.tsx — on mount
useEffect(() => {
  const tl = gsap.timeline();
  tl.fromTo('.lock-wallpaper', { filter: 'blur(0px)' }, { filter: 'blur(20px)', duration: 0.6 })
    .fromTo('.lock-card', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, '-=0.2')
    .fromTo('.lock-field', { y: 10, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, duration: 0.3 }, '-=0.1');
  return () => { tl.kill(); };
}, []);

// On successful login — reverse and reveal desktop
const dismissTimeline = gsap.timeline({ onComplete: onLoginSuccess });
dismissTimeline
  .to('.lock-card', { y: -40, opacity: 0, duration: 0.35, ease: 'power2.in' })
  .to('.lock-wallpaper', { opacity: 0, duration: 0.3 }, '-=0.1');
```

### Wallpaper Parallax (GSAP)

```typescript
// Desktop.tsx
const xTo = gsap.quickTo('.wallpaper-layer', 'x', { duration: 1.2, ease: 'power1.out' });
const yTo = gsap.quickTo('.wallpaper-layer', 'y', { duration: 1.2, ease: 'power1.out' });

window.addEventListener('mousemove', (e) => {
  const dx = (e.clientX / window.innerWidth - 0.5) * 20;
  const dy = (e.clientY / window.innerHeight - 0.5) * 12;
  xTo(dx);
  yTo(dy);
});
```


---

## VSCode Layout — Debugging Question

This is the most critical layout in the entire redesign. It must visually match VSCode running inside a macOS window.

### Layout Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ AppWindow chrome: [● ● ●]  Test Session — Q3: Debugging  [🔒]  │
│                                          [⏱ 12:34 green]        │
├──────────┬──────────────────────────────────────────────────────┤
│          │ [Buggy Code ×]  [Your Fix ×]                         │  ← Tab bar
│  Q       ├──────────────────────────────────────────────────────┤
│  Nav     │                                                       │
│          │   Monaco Editor (editable — "Your Fix" tab active)   │
│  (file   │                                                       │
│  tree    │                                                       │
│  style)  ├──────────────────────────────────────────────────────┤  ← drag handle
│          │ ▼ TERMINAL   [▶ Run]  Runs: 8/10                     │
│          │ $ testforge run solution.py                           │
│          │ ✓ Test 1: passed (42 == 42)                           │
│          │ ✗ Test 2: failed (got 41, expected 42)                │
├──────────┴──────────────────────────────────────────────────────┤
│ Python  Ln 14, Col 8  ●  Test Mode                              │  ← Status bar
└─────────────────────────────────────────────────────────────────┘
```

### Sub-component Breakdown

**Left sidebar — Question Navigator (file tree style)**
- Renders as a VSCode-style file explorer panel
- Each question is a "file" entry: icon (🐛 for debugging, ❓ for MCQ), question number, answered indicator
- Active question highlighted with VSCode selection blue (`rgba(0, 120, 212, 0.3)`)
- Width: 200px fixed, not resizable (matches VSCode sidebar)
- Background: `--vscode-sidebar-bg: #252526`

**Tab bar**
- Two tabs: "Buggy Code" (read-only, red dot indicator) and "Your Fix" (editable, indigo dot)
- Active tab has bottom border in tab color
- Clicking "Buggy Code" tab shows the read-only Monaco instance
- Clicking "Your Fix" tab shows the editable Monaco instance
- Background: `--vscode-titlebar-bg: #3c3c3c`

**Monaco Editor area**
- Fills remaining vertical space between tab bar and terminal drag handle
- `theme="vs-dark"` always (regardless of OS theme — VSCode dark is the design intent)
- `--vscode-editor-bg: #1e1e1e`
- Buggy Code tab: `readOnly: true`, red-tinted gutter (`lineNumbersMinChars: 3`)
- Your Fix tab: `readOnly: false`, behavioral tracking hooks attached via `onMount`

**Terminal panel**
- Resizable via a drag handle div between editor and terminal
- Default height: 200px, min: 100px, max: 60% of window height
- Header bar: "TERMINAL" label (uppercase, VSCode style), Run button, runs counter
- Output area: dark background (`--vscode-terminal-bg: #1e1e1e`), monospace font
- Green prompt: `$ testforge run solution.py` in `--vscode-terminal-green: #4ec9b0`
- Pass results: `✓` in `#4ade80`, fail results: `✗` in `#f87171`
- Scrollable output with Lenis

**Status bar**
- Full-width bar at the very bottom of the window (inside AppWindow, below terminal)
- Height: 22px (matches VSCode)
- Background: `--vscode-statusbar-bg: #007acc` (normal) or `#6c2fbb` (during active test)
- Left items: language badge (Python / C++), line/col indicator
- Right items: run status (idle / running / last result summary)
- Font: 11px, white text

### `VSCodeLayout` Internal State

```typescript
interface VSCodeLayoutState {
  activeTab: 'buggy' | 'fix';
  terminalHeight: number;        // px, controlled by drag handle
  isDraggingHandle: boolean;
  code: string;                  // editable code in "Your Fix" tab
  runResults: RunResult[];
  runsRemaining: number;
  running: boolean;
  cursorPosition: { line: number; col: number };
}
```

### Terminal Drag Handle

```typescript
// Pointer events on the drag handle div
function onHandlePointerDown(e: React.PointerEvent) {
  e.currentTarget.setPointerCapture(e.pointerId);
  setIsDraggingHandle(true);
  const startY = e.clientY;
  const startHeight = terminalHeight;

  function onMove(ev: PointerEvent) {
    const delta = startY - ev.clientY;  // drag up = increase terminal height
    const newHeight = Math.max(100, Math.min(windowHeight * 0.6, startHeight + delta));
    setTerminalHeight(newHeight);
  }
  function onUp() {
    setIsDraggingHandle(false);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}
```


---

## Window Manager — Sequence Diagrams

### Opening a Window

```
User clicks Dock icon
  → Dock calls openWindow(appType, appProps) on OSStore
  → OSStore creates WindowState, pushes to windows[]
  → WindowManager re-renders, AnimatePresence detects new child
  → AppWindow mounts with initial animation (scale 0.85→1, opacity 0→1)
  → focusWindow(id) called, assigns highest zIndex
```

### Minimizing a Window

```
User clicks yellow traffic light
  → TrafficLights calls minimizeWindow(id) on OSStore
  → OSStore sets isMinimized: true
  → AppWindow reads isMinimized, triggers Framer Motion exit variant
  → Exit variant: translate toward dockIconRef.getBoundingClientRect(), scale to 0.1
  → Window content hidden (display: none after animation)
  → DockIcon shows minimized indicator (reduced opacity dot)
```

### Restoring a Minimized Window

```
User clicks Dock icon of minimized app
  → Dock calls restoreWindow(id) on OSStore
  → OSStore sets isMinimized: false
  → AppWindow re-enters AnimatePresence, plays enter animation from dock position
  → focusWindow(id) called
```

### Locking a Window (Test Session)

```
TestSessionApp creates attempt via API
  → Calls lockWindow(windowId) on OSStore
  → AppWindow reads isLocked: true
  → react-rnd drag/resize disabled (disableDragging + enableResizing={false})
  → TrafficLights replaced with lock icon
  → Window cannot be closed, minimized, or moved

Test submitted / integrity violation
  → TestSessionApp calls unlockWindow(windowId)
  → Normal controls restored
  → TestSessionApp calls openWindow('results', { attemptId })
  → TestSessionApp calls closeWindow(its own id)
```

---

## OS Shell Components — Detailed Specs

### Desktop

```typescript
// Desktop.tsx
// Wallpaper: CSS mesh gradient (no image dependency)
// background: radial-gradient(at 20% 30%, #1e1b4b 0%, transparent 50%),
//             radial-gradient(at 80% 70%, #0f172a 0%, transparent 50%),
//             radial-gradient(at 50% 50%, #1e293b 0%, transparent 80%),
//             #0f172a;
//
// Particle layer: <canvas> absolutely positioned, GSAP animates 40–60 small dots
// with slow drift and subtle opacity pulse. Respects prefers-reduced-motion
// (particles disabled when reduced motion preferred).
```

### MenuBar

Left side: `focusedWindowId ? windows.find(w => w.id === focusedWindowId)?.title : 'TestForge'`

Right side (left to right): theme toggle icon → user name → avatar circle → clock

Clock update:
```typescript
useEffect(() => {
  const tick = () => {
    const now = new Date();
    setClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };
  tick();
  const id = setInterval(tick, 60_000);
  return () => clearInterval(id);
}, []);
```

Sign-out dropdown: absolute positioned below avatar, `z-index: 9999`, closes on outside click.

### LockScreen

```typescript
// Structure
<div className="lock-wallpaper"> {/* full viewport, blurred wallpaper */}
  <div className="lock-card glass"> {/* centered card, 380px wide */}
    <div className="avatar-circle" />   {/* 80px circle, initials */}
    <h2>{user?.name ?? 'TestForge'}</h2>
    <input type="email" className="lock-field" />
    <input type="password" className="lock-field" />
    <button>Sign In →</button>
    {error && <p className="error">{error}</p>}
  </div>
</div>
```

The LockScreen is NOT a route. It is rendered inside OSShell conditionally:
```typescript
{!session && <LockScreen />}
```
It sits above the Desktop via `position: fixed; z-index: 1000`.


---

## Color System

### OS Shell Tokens (extend existing `index.css`)

```css
:root {
  /* Existing tokens — unchanged */
  --glass-bg: rgba(255 255 255 / 0.06);
  --glass-border: rgba(255 255 255 / 0.12);
  --bg-primary: 15 23 42;
  --bg-secondary: 30 41 59;
  --accent: 99 102 241;

  /* New OS-specific tokens */
  --menubar-bg: rgba(15, 23, 42, 0.75);
  --dock-bg: rgba(255, 255, 255, 0.08);
  --window-chrome-bg: rgba(30, 41, 59, 0.85);
  --window-titlebar-bg: rgba(15, 23, 42, 0.9);
  --traffic-red: #ff5f57;
  --traffic-yellow: #febc2e;
  --traffic-green: #28c840;
}

[data-theme="light"] {
  /* Existing tokens — unchanged */
  --glass-bg: rgba(255 255 255 / 0.45);
  --glass-border: rgba(255 255 255 / 0.7);

  /* New OS-specific tokens */
  --menubar-bg: rgba(241, 245, 249, 0.8);
  --dock-bg: rgba(255, 255, 255, 0.5);
  --window-chrome-bg: rgba(226, 232, 240, 0.9);
  --window-titlebar-bg: rgba(203, 213, 225, 0.95);
}
```

### VSCode Editor Tokens (always dark, not theme-dependent)

```css
/* Applied only inside .vscode-layout — these never change with OS theme */
.vscode-layout {
  --vscode-editor-bg: #1e1e1e;
  --vscode-sidebar-bg: #252526;
  --vscode-titlebar-bg: #3c3c3c;
  --vscode-tab-active-bg: #1e1e1e;
  --vscode-tab-inactive-bg: #2d2d2d;
  --vscode-statusbar-bg: #007acc;
  --vscode-statusbar-test-bg: #6c2fbb;
  --vscode-terminal-bg: #1e1e1e;
  --vscode-terminal-green: #4ec9b0;
  --vscode-terminal-prompt: #569cd6;
  --vscode-selection: rgba(0, 120, 212, 0.3);
  --vscode-line-highlight: rgba(255, 255, 255, 0.04);
}
```

### Traffic Light Colors

These are fixed regardless of theme (match macOS exactly):
- Red: `#ff5f57` — hover shows `×`
- Yellow: `#febc2e` — hover shows `−`
- Green: `#28c840` — hover shows `+` (maximize) or `⤢` (restore)

---

## Glassmorphism System

All glass surfaces use the existing `.glass` utility class from `index.css`:
```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid var(--glass-border);
  border-radius: 1rem;
}
```

Surface hierarchy (opacity levels):
- MenuBar: `backdrop-filter: blur(20px)`, `--menubar-bg` (slightly more opaque than glass)
- Dock: `--dock-bg`, `border-radius: 9999px` (pill shape)
- AppWindow body: `.glass` utility
- AppWindow title bar: `--window-titlebar-bg` (more opaque than body — visually separates chrome from content)
- LockScreen card: `.glass` with extra `box-shadow: 0 32px 64px rgba(0,0,0,0.4)`
- Dropdowns / tooltips: `.glass` with `border-radius: 0.5rem`


---

## Responsive Strategy

### Breakpoints

| Viewport | Mode | Window behavior | Dock | MenuBar |
|---|---|---|---|---|
| ≥ 1024px | Full OS | Draggable + resizable via react-rnd | Floating pill, magnification | Full (app name + clock + avatar) |
| 768–1023px | Tablet | Fixed panels, full-width, no drag/resize | Floating pill, no magnification | Full |
| < 768px | Mobile | Bottom sheet, one at a time | Bottom nav bar, always-visible labels | Clock + avatar only |

### Implementation

```typescript
// useOSStore — responsive mode derived from window width
// Updated on resize via ResizeObserver on document.body

type ResponsiveMode = 'desktop' | 'tablet' | 'mobile';

// In OSStore
responsiveMode: ResponsiveMode;
setResponsiveMode: (mode: ResponsiveMode) => void;
```

```typescript
// OSShell.tsx — sets mode on mount and resize
useEffect(() => {
  const obs = new ResizeObserver(([entry]) => {
    const w = entry.contentRect.width;
    const mode = w >= 1024 ? 'desktop' : w >= 768 ? 'tablet' : 'mobile';
    setResponsiveMode(mode);
  });
  obs.observe(document.body);
  return () => obs.disconnect();
}, []);
```

**Tablet mode**: `AppWindow` ignores `react-rnd` and renders as `position: fixed; inset: menubar-height 0 dock-height 0; width: 100%`. Multiple windows stack; focused window is on top.

**Mobile mode**: `AppWindow` renders as a bottom sheet — `position: fixed; bottom: 0; left: 0; right: 0; height: 85vh; border-radius: 1.5rem 1.5rem 0 0`. Only the focused window is visible. Dock becomes a `position: fixed; bottom: 0` nav bar with icon + label for each app.

CSS media queries handle the Dock and MenuBar layout changes; JavaScript handles window positioning overrides.

---

## TestSessionApp — Window Locking Integration

```typescript
// TestSessionApp.tsx
const { lockWindow, unlockWindow, openWindow, closeWindow } = useOSStore();
const windowId = useCurrentWindowId(); // custom hook that reads own window id from context

// After "Begin Test" clicked and attempt created:
useEffect(() => {
  if (attemptStatus === 'in_progress') {
    lockWindow(windowId);
  }
}, [attemptStatus]);

// On submit complete or integrity violation:
async function handleSubmitComplete(attemptId: string) {
  unlockWindow(windowId);
  openWindow('results', { attemptId });
  closeWindow(windowId);
}
```

The `windowId` is passed down via a `WindowContext` that `AppWindow` provides to its children:
```typescript
// AppWindow.tsx
const WindowContext = createContext<string>('');
// ...
<WindowContext.Provider value={window.id}>
  {children}
</WindowContext.Provider>

// useCurrentWindowId hook
export const useCurrentWindowId = () => useContext(WindowContext);
```

---

## Proctored Start Screen

Rendered inside `TestSessionApp` before the attempt is created. It is a full-bleed overlay within the window (not a modal — it replaces the question view entirely).

```typescript
// State machine inside TestSessionApp
type SessionPhase = 'start-screen' | 'active' | 'evaluating' | 'done';
```

Start screen layout:
- Test title (large)
- Duration, question count, subject badges
- Rules checklist (5 items, each with a checkmark icon)
- Integrity policy checkbox (required)
- "Begin Test" button (disabled until checkbox checked)
- On click: POST `/attempts` → on success → set phase to 'active', start timer, lock window

---

## Dependencies to Add

```json
// Already in package.json — confirmed present:
// framer-motion, react-rnd, zustand, lenis, @monaco-editor/react, recharts

// To add:
"gsap": "^3.12.x"
```

GSAP is the only missing dependency. All others are already installed per `client/package.json`.

---

## Correctness Properties

1. For all `WindowState` in `OSStore.windows`, `zIndex` values are unique — no two windows share the same z-index at any point in time.
2. For all `AppWindow` where `isLocked === true`, the `react-rnd` component has `disableDragging={true}` and `enableResizing={false}` — verified by checking rendered props.
3. For all `DockIcon` renders, only apps whose `allowedRoles` includes `user.role` are rendered — no admin apps visible to students and vice versa.
4. For any `AppWindow` where `isMaximized === true`, `prevPosition` and `prevSize` are non-null — restore is always possible.
5. For all animations, when `window.matchMedia('(prefers-reduced-motion: reduce)').matches === true`, no `scale` or `translate` transforms are applied — only `opacity` transitions.
6. The `VSCodeLayout` status bar background is `--vscode-statusbar-test-bg` (`#6c2fbb`) when `sessionPhase === 'active'` and `--vscode-statusbar-bg` (`#007acc`) otherwise.
7. For all `TestSessionApp` instances, `lockWindow` is called before the first question is rendered and `unlockWindow` is called before `closeWindow` — the window is never closed while locked.
8. The `LockScreen` is rendered if and only if `session === null` in `AuthContext` — it is never shown to authenticated users and never hidden from unauthenticated users.


---

## Error Handling

### Window Crash Isolation

Each `AppWindow` wraps its `children` in a React Error Boundary. If an app throws, the window shows an error state with a "Reload App" button that remounts the component — other windows are unaffected.

### Network Failures in Apps

All apps use the existing `api` axios instance (with auth interceptor). Network errors surface as inline error states within the app window — no OS-level error handling needed.

### Auth Expiry During Session

If the Supabase session expires mid-test, the existing `onAuthStateChange` listener fires. `OSShell` detects `session === null`, calls `closeAll()`, and shows `LockScreen`. The test attempt is preserved server-side; the student can log back in and resume.

---

## Testing Strategy

### Unit Tests

- `useOSStore`: test all actions (openWindow, closeWindow, focusWindow, lockWindow, etc.) with Vitest + `@testing-library/react`
- `TrafficLights`: verify lock icon renders when `isLocked=true`, three circles when `false`
- `DockIcon`: verify magnification scale values at distance 0, 80, 160px
- `VSCodeLayout`: verify terminal height clamping (min 100px, max 60% of window height)
- App registry: verify role filtering returns correct apps for student vs admin

### Property-Based Tests (fast-check)

- `useOSStore.openWindow` called N times → `windows.length === N` and all `zIndex` values are unique
- `focusWindow` called on any window → that window has the highest `zIndex` in the array
- `minimizeWindow` then `restoreWindow` → `isMinimized === false` and position/size unchanged

### Integration Tests

- Full lock screen → login → desktop flow (mock Supabase auth)
- Open TestsApp → click Start → TestSessionApp opens with locked window controls
- Submit test → Results window opens, TestSession window closes, window controls restored

---

## Security Considerations

- The app registry role check (`allowedRoles.includes(user.role)`) is a UI-only guard. All API calls enforce role-based access server-side via existing middleware — the OS layer adds no new security surface.
- The `LockScreen` overlay is a visual gate only. The actual auth state is managed by `AuthContext` + Supabase. Even if the overlay were bypassed, all API calls would fail without a valid session token.
- Window `appProps` (e.g., `attemptId`) are passed through Zustand store state — they are not URL-exposed, reducing the surface for parameter tampering via URL manipulation.
