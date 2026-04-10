# Implementation Plan: TestForge OS UI

## Overview

Replace the existing React page-navigation frontend with a macOS-style browser desktop OS. The new shell lives at `client/src/os/`. All existing Express + Supabase APIs are reused unchanged. Work is ordered so each task produces runnable, testable code before the next begins.

---

## Tasks

- [x] 1. Foundation — dependencies, store, registry, color tokens
  - [x] 1.1 Install GSAP and extend `index.css` with OS color tokens
    - Run `npm install gsap` inside `client/`
    - Add OS-specific CSS custom properties to `index.css` under `:root` and `[data-theme="light"]`: `--menubar-bg`, `--dock-bg`, `--window-chrome-bg`, `--window-titlebar-bg`, `--traffic-red`, `--traffic-yellow`, `--traffic-green`
    - Add `.vscode-layout` scoped tokens block (always-dark VSCode palette): `--vscode-editor-bg`, `--vscode-sidebar-bg`, `--vscode-titlebar-bg`, `--vscode-tab-active-bg`, `--vscode-tab-inactive-bg`, `--vscode-statusbar-bg`, `--vscode-statusbar-test-bg`, `--vscode-terminal-bg`, `--vscode-terminal-green`, `--vscode-terminal-prompt`, `--vscode-selection`, `--vscode-line-highlight`
    - _Requirements: 1.4, 1.5, 18.1, 18.2, 18.3, 18.4_

  - [x] 1.2 Create `useOSStore` Zustand store
    - Create `client/src/os/store/useOSStore.ts`
    - Implement `WindowState` and `OSStore` interfaces exactly as specified in the design
    - Implement all actions: `openWindow`, `closeWindow`, `focusWindow`, `minimizeWindow`, `restoreWindow`, `maximizeWindow`, `unmaximizeWindow`, `updatePosition`, `updateSize`, `lockWindow`, `unlockWindow`, `closeAll`
    - Add `responsiveMode: ResponsiveMode` slice with `setResponsiveMode` action
    - Z-index strategy: `nextZIndex` starts at 100, increments by 1 on every `focusWindow` call
    - Window ID: `openWindow` generates `${appType}-${Date.now()}`; for `test-session` with `appProps.attemptId`, use `test-session-${attemptId}` and deduplicate (focus existing if already open)
    - Initialize with `windows: []`, `focusedWindowId: null`, `nextZIndex: 100`
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 4.4_

  - [x] 1.3 Write property tests for `useOSStore`
    - **Property 1: All zIndex values are unique** — call `openWindow` N times, assert all `zIndex` values in `windows[]` are distinct
    - **Property 2: focusWindow gives highest zIndex** — after `focusWindow(id)`, assert that window has the max `zIndex` in the array
    - **Property 3: minimizeWindow then restoreWindow preserves position/size** — assert `isMinimized === false` and position/size unchanged after round-trip
    - **Validates: Requirements 20.2, 4.4, 4.6**

  - [x] 1.4 Create app registry
    - Create `client/src/os/apps/registry.ts`
    - Define `AppDefinition` interface and `APP_REGISTRY` array with all 8 app entries exactly as specified in the design (id, name, icon, component, defaultSize, defaultPosition, allowedRoles, singleton)
    - Export a `getAppsForRole(role)` helper that filters by `allowedRoles`
    - _Requirements: 5.2, 19.2_

  - [x] 1.5 Write unit tests for app registry role filtering
    - Verify `getAppsForRole('student')` returns only student apps (tests, test-session, results, analytics)
    - Verify `getAppsForRole('admin')` returns only admin apps (question-bank, test-manager, integrity, admin-analytics) plus results
    - **Validates: Requirements 5.2, 19.2**

- [x] 2. OS Shell — Desktop, MenuBar, Dock, LockScreen, WindowManager, AppWindow
  - [x] 2.1 Create `TrafficLights` and `WindowTitleBar` components
    - Create `client/src/os/components/TrafficLights.tsx` — renders red/yellow/green circles; when `isLocked=true` renders a single lock icon instead; hover reveals `×`, `−`, `+` symbols on respective buttons
    - Create `client/src/os/components/WindowTitleBar.tsx` — renders `TrafficLights` + centered title + optional `timerSlot` prop on the right
    - _Requirements: 4.5, 4.9, 8.15_

  - [x] 2.2 Write unit tests for `TrafficLights`
    - Verify lock icon renders when `isLocked=true`
    - Verify three circles render when `isLocked=false`
    - **Validates: Requirements 4.5, 8.15**

  - [x] 2.3 Create `AppWindow` component
    - Create `client/src/os/AppWindow.tsx`
    - Wrap `react-rnd` for drag + resize; enforce minimum size 320×240px
    - Apply `isLocked`: set `disableDragging={true}` and `enableResizing={false}` when locked
    - Apply `isMaximized`: override position/size to fill desktop area (below MenuBar 28px, above Dock 72px)
    - Call `focusWindow(id)` on any `onPointerDown` event
    - Wrap with `motion.div` using `windowVariants` (scale 0.85→1, opacity 0→1, spring stiffness 400 damping 30); exit: scale 0.85, opacity 0, duration 0.15
    - Respect `prefers-reduced-motion`: when true, use opacity-only transitions (duration 0.01 for instant, 0.2 for exit)
    - Provide `WindowContext` with `window.id` so children can call `useCurrentWindowId()`
    - Wrap children in a React Error Boundary that shows "Reload App" button on crash
    - Apply `.glass` + `--window-chrome-bg` to window body; `--window-titlebar-bg` to title bar
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 8.15, 17.1, 17.9, 18.1, 18.5_

  - [x] 2.4 Create `WindowManager` component
    - Create `client/src/os/WindowManager.tsx`
    - Wrap all `AppWindow` renders in Framer Motion `AnimatePresence`
    - Read `windows[]` from `useOSStore`; for each non-minimized window render `<AppWindow>` with the correct app component from `APP_REGISTRY`
    - Pass `dockIconRef` for each app to `AppWindow` for minimize FLIP animation
    - _Requirements: 4.1, 4.5, 4.6, 4.9, 4.10, 17.1, 17.2, 17.3_

  - [x] 2.5 Create `DockIcon` and `Dock` components
    - Create `client/src/os/components/DockIcon.tsx` — accepts `app`, `isOpen`, `isMinimized`, `mouseX` (MotionValue), `ref`; implements distance-based scale (`[0,80,160]→[1.6,1.3,1.0]`) and y-lift (`[0,80,160]→[-12,-6,0]`) via `useTransform`; shows indicator dot when open; reduced opacity dot when minimized; tooltip label on hover
    - Create `client/src/os/Dock.tsx` — pill-shaped glassmorphism container; shares `mouseX = useMotionValue(Infinity)` across all icons; filters apps via `getAppsForRole(user.role)`; handles click: singleton apps focus existing window or open new; non-singleton always opens new; calls `restoreWindow` for minimized apps
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [x] 2.6 Write unit tests for `DockIcon` magnification
    - Verify scale value is 1.6 at distance 0, 1.3 at distance 80, 1.0 at distance 160
    - **Validates: Requirements 5.3**

  - [x] 2.7 Create `MenuBar` component
    - Create `client/src/os/MenuBar.tsx`
    - Left: active app name from `focusedWindowId` → window title, fallback "TestForge"
    - Right: theme toggle → user name → avatar circle → clock (HH:MM, `setInterval` every 60s)
    - Sign-out dropdown: absolute positioned below avatar, `z-index: 9999`, closes on outside click; calls `signOut()` + `closeAll()`
    - Apply `--menubar-bg` + `backdrop-filter: blur(20px)` + full-width fixed top bar
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 2.8 Create `LockScreen` component
    - Create `client/src/os/LockScreen.tsx`
    - Render centered `.glass` card (380px wide) over full-viewport blurred wallpaper
    - GSAP entrance timeline on mount: blur wallpaper → slide card up → stagger fields (exact sequence from design)
    - GSAP dismiss timeline on login success: card slides up + fades, wallpaper fades out
    - GSAP fade-in on logout appearance (300ms)
    - Call existing `/auth/login` via `supabase.auth.signInWithPassword`; display inline error on failure
    - Render as `position: fixed; z-index: 1000` inside OSShell, not a route
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 17.6, 17.7_

  - [x] 2.9 Create `Desktop` component
    - Create `client/src/os/Desktop.tsx`
    - CSS mesh gradient wallpaper (no image): four `radial-gradient` layers on `#0f172a`
    - GSAP `quickTo` wallpaper parallax on `mousemove` (x: ±10px, y: ±6px, duration 1.2)
    - GSAP canvas particle layer: 40–60 small dots with slow drift + opacity pulse; disable entirely when `prefers-reduced-motion` is true
    - Render `<WindowManager>` as a child
    - _Requirements: 1.1, 17.5_

  - [x] 2.10 Create `OSShell` root component
    - Create `client/src/os/OSShell.tsx`
    - Compose `<Desktop>`, `<MenuBar>`, `<Dock>`, and conditional `<LockScreen>` (shown when `session === null`)
    - Set `data-theme` on `document.documentElement` from `ThemeContext`
    - `overflow: hidden` on root to prevent browser scroll
    - `ResizeObserver` on `document.body` to call `setResponsiveMode` (≥1024 → desktop, 768–1023 → tablet, <768 → mobile)
    - Call `closeAll()` on sign-out (listen to `session` becoming null)
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 2.5, 2.6, 6.8, 16.6, 19.1, 20.4, 20.5_

  - [x] 2.11 Update `App.tsx` routing
    - Simplify `App.tsx` to two routes only: `/` → `<OSShell>` (wrapped in `AuthProvider` + `ThemeProvider`), `/register` → `<Register>`
    - Remove all old route imports; keep `BrowserRouter`
    - _Requirements: 2.5, 3.1, 19.4_

  - [x] 2.12 Checkpoint — OS shell renders and auth flow works
    - Ensure `OSShell` mounts, `LockScreen` appears when logged out, login dismisses it and shows Desktop + MenuBar + Dock, sign-out re-shows LockScreen and closes all windows
    - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Student apps — Tests, TestSession (VSCode layout + Terminal), Results, Analytics
  - [x] 3.1 Create `TestsApp`
    - Create `client/src/os/apps/TestsApp.tsx`
    - Port logic from `client/src/pages/student/AvailableTests.tsx` and `TestCard.tsx` into the window-hosted component
    - Fetch tests from existing API; poll every 60 seconds while window is open (`setInterval` cleared on unmount)
    - Show "Upcoming" (disabled), "Start", "Resume", or "Ended" states per test per R7 criteria
    - "Start" click: call `openWindow('test-session', { testId })` on OSStore
    - "Resume" click: call `openWindow('test-session', { testId, attemptId })` on OSStore
    - Apply Lenis for smooth scroll inside window
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.4a, 7.5, 7.5a, 7.6, 7.7_

  - [x] 3.2 Create `Terminal` component
    - Create `client/src/os/components/Terminal.tsx`
    - Render header bar: "TERMINAL" label, `▶ Run` button, "Runs: N/M" counter
    - Render scrollable output area with Lenis: green prompt line, per-test-case pass (✓ green `#4ade80`) / fail (✗ red `#f87171`) results with input/expected/actual/stderr
    - Disable Run button and show "No runs left" when `runsRemaining === 0`
    - Drag handle div at top: pointer capture resize logic (drag up = increase height, clamp min 100px, max 60% of window height)
    - Apply `--vscode-terminal-bg` background, monospace font
    - _Requirements: 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_

  - [x] 3.3 Write unit tests for `Terminal` drag handle height clamping
    - Verify height clamps to min 100px when dragged below
    - Verify height clamps to max 60% of window height when dragged above
    - **Validates: Requirements 11.5, 11.12**

  - [x] 3.4 Create `VSCodeLayout` component
    - Create `client/src/os/components/VSCodeLayout.tsx`
    - Left sidebar (200px fixed): question navigator in VSCode file-tree style — each question as a "file" entry with type icon (🐛 debugging, ❓ MCQ), question number, answered indicator; active question highlighted with `--vscode-selection`; background `--vscode-sidebar-bg`
    - Tab bar: "Buggy Code" (read-only, red dot) and "Your Fix" (editable, indigo dot) tabs; active tab bottom border; background `--vscode-titlebar-bg`
    - Monaco Editor area: fills remaining vertical space; `theme="vs-dark"` always; Buggy Code tab `readOnly: true`; Your Fix tab `readOnly: false` with behavioral tracking hooks (`onKeyDown`, `onPaste`) attached via `onMount`
    - Terminal panel: render `<Terminal>` component; drag handle between editor and terminal
    - Status bar (22px): `--vscode-statusbar-test-bg` when `sessionPhase === 'active'`, else `--vscode-statusbar-bg`; left: language + line/col; right: run status
    - Manage `VSCodeLayoutState` (activeTab, terminalHeight, code, runResults, runsRemaining, running, cursorPosition)
    - Call existing `/execute` API on Run; update `runsRemaining` from response
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12_

  - [x] 3.5 Create `TestSessionApp`
    - Create `client/src/os/apps/TestSessionApp.tsx`
    - Implement `SessionPhase` state machine: `'start-screen' | 'active' | 'evaluating' | 'done'`
    - Proctored start screen (phase = `start-screen`): full-bleed overlay inside window showing test title, duration, question count, subject badges, 5-item rules checklist, integrity policy checkbox, disabled "Begin Test" button until checkbox checked; POST `/attempts` on click → transition to `active`
    - Resume path (when `attemptId` passed in `appProps`): skip start screen, load existing attempt, go directly to `active`
    - If attempt status is already `submitted`/`auto_submitted` on open: immediately call `openWindow('results', { attemptId })` and `closeWindow(windowId)`
    - Countdown timer injected into `WindowTitleBar` `timerSlot`: green >10min, yellow 5–10min, red <5min; auto-submit on zero
    - Question navigator + MCQ card or `VSCodeLayout` based on question type
    - Auto-save responses with 1500ms debounce via existing responses API
    - Submit confirmation modal (answered vs total counts) before final submit
    - On submit complete: `unlockWindow` → `openWindow('results', { attemptId })` → `closeWindow(windowId)`
    - Integrity violation (tab_switch ≥ 3): auto-submit with `auto_submit_reason='integrity_violation'` → same close/open flow
    - Use `useCurrentWindowId()` to get own window id; call `lockWindow` after attempt created
    - Wire existing hooks: `useHeartbeat`, `useIntegrityListeners`, `useBehavioralTracking`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14, 8.15_

  - [x] 3.6 Create `ResultsApp`
    - Create `client/src/os/apps/ResultsApp.tsx`
    - Port logic from `client/src/pages/student/Results.tsx`
    - Fetch attempt result from existing results API using `appProps.attemptId`
    - Display: total score, total marks, percentage, rank, pass/fail status
    - Per-question breakdown: type, marks awarded, correct/incorrect
    - For debugging questions: visible test cases passed + hidden test cases passed as separate counts
    - Show prominent "Submitted due to integrity violation" banner when `auto_submit_reason === 'integrity_violation'`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 8.14_

  - [x] 3.7 Create `AnalyticsApp` (student variant)
    - Create `client/src/os/apps/AnalyticsApp.tsx`
    - Port logic from `client/src/pages/student/Analytics.tsx`
    - Score trend line chart (Recharts) across all attempted tests
    - Subject-wise performance bar or radar chart
    - MCQ accuracy rate and debugging accuracy rate displayed separately
    - Personal rank trend over time
    - Lenis smooth scroll inside window
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 3.8 Checkpoint — all student apps functional end-to-end
    - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Admin apps — QuestionBank, TestManager, Integrity, AdminAnalytics
  - [x] 4.1 Create `QuestionBankApp`
    - Create `client/src/os/apps/QuestionBankApp.tsx`
    - Port logic from `client/src/pages/admin/QuestionBank.tsx`, `DebugQuestions.tsx`, `ImportQuestions.tsx`
    - Filterable/searchable question list (type, difficulty, topic tag) from existing questions API
    - "Add MCQ" → inline form using existing `MCQForm` component and MCQ creation API
    - "Add Debugging Question" → inline form (statement, correct code, bug count, difficulty, language) → call Gemini variant generation API → display generated variants for review
    - Side-by-side diff view per variant using `diff_json` field (changed lines highlighted)
    - Approve variant button → existing variant approval API; show approved count per question; warn when < 3 approved
    - Bulk import via existing import API with per-row success/error feedback
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

  - [x] 4.2 Create `TestManagerApp`
    - Create `client/src/os/apps/TestManagerApp.tsx`
    - Port logic from `client/src/pages/AdminDashboard.tsx` and related admin pages
    - Test list with status badges (draft/active/ended) from existing tests API
    - "New Test" form: title, subject, year, division, duration, start/end time, questions per attempt, randomize toggle → existing test creation API
    - Edit form for draft tests (pre-populated)
    - Attach questions from Question Bank: set `unlock_at_minutes` and `question_order` per question using `AttachToTestModal`
    - Live leaderboard panel for active/ended tests from existing leaderboard API
    - "Integrity" button → `openWindow('integrity', { testId })`
    - "Similarity Report" button → open similarity report view (inline or new window)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [x] 4.3 Create `IntegrityApp`
    - Create `client/src/os/apps/IntegrityApp.tsx`
    - Port logic from `client/src/pages/admin/IntegrityDashboard.tsx` and `SimilarityReport.tsx`
    - Fetch integrity data for `appProps.testId` from existing integrity API
    - Summary stats: total attempts, average integrity score, high-risk count (score < 60), similarity flag count
    - Sortable table: name, division, integrity score, tab switches, focus lost count, behavioral flag count, similarity flag count
    - Expandable row: per-question behavioral detail (time to first keystroke, paste events, backspace count, edit count, WPM consistency, test runs before submit, idle periods)
    - Filters: division, integrity score range (high/medium/low), name search
    - Sort by integrity score asc/desc
    - "Similarity Report" button → open similarity report view
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [x] 4.4 Create `AdminAnalyticsApp`
    - Create `client/src/os/apps/AdminAnalyticsApp.tsx`
    - Port logic from `client/src/pages/admin/AdminAnalytics.tsx`
    - Per-test stats: average score, median score, completion rate, hardest question from existing analytics API
    - Filters: year, division, subject, test, date range
    - Division comparison chart (Recharts): e.g. SE-A vs SE-B on same test
    - Question bank health: actual difficulty distribution, most-failed questions
    - Per-student drill-down: all attempts, score trend, integrity score history
    - Lenis smooth scroll inside window
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [x] 4.5 Checkpoint — all admin apps functional end-to-end
    - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Responsive + polish — mobile/tablet modes, animations, reduced-motion, error boundaries
  - [x] 5.1 Implement tablet mode (768–1023px)
    - In `AppWindow.tsx`: when `responsiveMode === 'tablet'`, ignore `react-rnd` and render as `position: fixed; inset: 28px 0 72px 0; width: 100%`; disable drag and resize
    - Multiple windows stack; focused window on top via z-index
    - _Requirements: 16.2_

  - [x] 5.2 Implement mobile mode (< 768px)
    - In `AppWindow.tsx`: when `responsiveMode === 'mobile'`, render as bottom sheet: `position: fixed; bottom: 0; left: 0; right: 0; height: 85vh; border-radius: 1.5rem 1.5rem 0 0`; only focused window visible
    - In `Dock.tsx`: when `responsiveMode === 'mobile'`, render as `position: fixed; bottom: 0` full-width nav bar with icon + label always visible (no pill, no magnification)
    - In `MenuBar.tsx`: when `responsiveMode === 'mobile'`, hide active app name; show only clock + avatar
    - _Requirements: 16.3, 16.4, 16.5_

  - [x] 5.3 Add CSS media query responsive overrides
    - Add Tailwind responsive prefixes and CSS media queries in `index.css` for Dock and MenuBar layout changes at 768px and 1024px breakpoints
    - _Requirements: 16.6_

  - [x] 5.4 Write property test for `prefers-reduced-motion` animation compliance
    - **Property 5: When `prefers-reduced-motion` is true, no scale or translate transforms are applied — only opacity transitions**
    - Mock `window.matchMedia` to return `matches: true`; render `AppWindow` with open/close; assert no `scale` or `translate` in applied styles
    - **Validates: Requirements 17.9**

  - [x] 5.5 Write property test for maximize/restore invariant
    - **Property 4: For any AppWindow where `isMaximized === true`, `prevPosition` and `prevSize` are non-null**
    - Call `maximizeWindow` on any window; assert `prevPosition !== null && prevSize !== null` in store state
    - **Validates: Requirements 4.7, 4.8**

  - [x] 5.6 Write property test for LockScreen visibility invariant
    - **Property 8: LockScreen is rendered if and only if `session === null`**
    - Render `OSShell` with mocked `AuthContext`; toggle session between null and a valid session object; assert LockScreen presence matches `session === null`
    - **Validates: Requirements 2.3, 2.5, 19.1**

  - [x] 5.7 Write property test for locked window controls invariant
    - **Property 2: For all AppWindows where `isLocked === true`, `react-rnd` has `disableDragging={true}` and `enableResizing={false}`**
    - Call `lockWindow(id)`; render `AppWindow`; assert rendered `react-rnd` props
    - **Validates: Requirements 8.15**

  - [x] 5.8 Write property test for VSCode status bar color
    - **Property 6: Status bar background is `--vscode-statusbar-test-bg` when `sessionPhase === 'active'` and `--vscode-statusbar-bg` otherwise**
    - Render `VSCodeLayout` in both phases; assert computed background token
    - **Validates: Requirements 11.5_

  - [x] 5.9 Write property test for role-gated Dock icons
    - **Property 3: Only apps whose `allowedRoles` includes `user.role` are rendered in the Dock**
    - Render `Dock` with student role; assert no admin app icons present; render with admin role; assert no student-only app icons present
    - **Validates: Requirements 5.2, 19.2**

- [x] 6. Wiring + cleanup — update App.tsx routing, remove old pages/layouts, final integration
  - [x] 6.1 Remove old pages, layouts, and components superseded by OS apps
    - Delete `client/src/pages/Home.tsx`, `client/src/pages/Login.tsx`, `client/src/pages/Tests.tsx`, `client/src/pages/Dashboard.tsx`, `client/src/pages/AdminDashboard.tsx`, `client/src/pages/NotFound.tsx`
    - Delete `client/src/pages/student/` directory (all files ported into OS apps)
    - Delete `client/src/pages/admin/` directory (all files ported into OS apps)
    - Delete `client/src/layouts/` directory (RootLayout, StudentLayout no longer needed)
    - Delete `client/src/components/Navbar.tsx` (replaced by MenuBar)
    - Keep: `client/src/components/ProtectedRoute.tsx` (still used by Register route guard if needed), `client/src/components/Toast.tsx`, `client/src/components/ToastContainer.tsx`, all hooks, `lib/`, `context/`
    - _Requirements: 3.1_

  - [x] 6.2 Final `App.tsx` cleanup and integration verification
    - Confirm `App.tsx` has exactly two routes: `/` → `<OSShell>` and `/register` → `<Register>`
    - Confirm `AuthProvider` and `ThemeProvider` wrap `OSShell` in `main.tsx` or `App.tsx`
    - Verify no dead imports remain
    - _Requirements: 2.5, 3.1, 19.4_

  - [x] 6.3 Final checkpoint — full integration
    - Verify complete user flows: student login → Tests app → start test → TestSession locks → submit → Results opens; admin login → QuestionBank, TestManager, Integrity, AdminAnalytics all open correctly
    - Verify theme toggle, sign-out, window drag/resize/minimize/maximize/close all work
    - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each phase boundary
- Property tests validate universal correctness properties from the design document
- The design document contains full TypeScript interfaces, component APIs, animation specs, and color tokens — treat it as the authoritative implementation reference
