# TestForge — Knowledge Graph Report

> Generated from AST analysis of 221 files · ~127,821 words  
> Covers: `client/`, `server/`, `piston/`, `documentation/`

---

## God Nodes (Highest Connectivity)

These are the most depended-upon nodes in the graph — changing them has the widest blast radius.

| Node | File | Why It's a God Node |
|------|------|---------------------|
| `useOSStore` | `client/src/os/store/useOSStore.ts` | Central Zustand store for all window state. Every OS component (Dock, Desktop, AppWindow, MenuBar, WindowManager, all Apps) reads or writes to it. |
| `supabase` (client) | `client/src/lib/supabase.ts` | Singleton Supabase client imported by `AuthContext`. All auth flows depend on it. |
| `supabase.js` (server) | `server/supabase/supabase.js` | Server-side Supabase service-role client. Imported by every route (`auth`, `tests`, `questions`, `attempts`, `admin`, `analytics`) and `middleware/auth.js`. |
| `requireAuth` | `server/middleware/auth.js` | Auth middleware applied to all protected routes. Verifies Bearer token via Supabase and attaches `req.user`. |
| `AuthContext` | `client/src/context/AuthContext.tsx` | Provides `session`, `user`, `loading`, `signOut` to the entire app. `OSShell`, `MenuBar`, `LockScreen`, `ProtectedRoute` all consume it. |
| `axios.ts` | `client/src/lib/axios.ts` | Configured Axios instance used by all client-side API calls. |
| `registry.ts` | `client/src/os/apps/registry.ts` | Defines `APP_REGISTRY` — the single source of truth for all app IDs, roles, sizes, and dock visibility. |
| `server/index.js` | `server/index.js` | Express entry point. Mounts all 8 route modules. |

---

## Community Structure (Clusters)

### 1. OS Shell Layer
**Files:** `OSShell.tsx`, `Desktop.tsx`, `MenuBar.tsx`, `Dock.tsx`, `LockScreen.tsx`, `WindowManager.tsx`, `AppWindow.tsx`, `WindowSwitcher.tsx`

The top-level UI shell. `OSShell` is the root — it composes all shell components and gates on `session` from `AuthContext`. On sign-out it calls `closeAll()` from `useOSStore`.

**Key edges:**
- `OSShell` → `AuthContext` (session gate)
- `OSShell` → `useOSStore` (closeAll, setResponsiveMode)
- `OSShell` → `useKeyboardManager` (global keyboard shortcuts)
- `Dock` → `registry.ts` (getAppsForRole)
- `Dock` → `useOSStore` (openWindow)
- `AppWindow` → `useOSStore` (focus, minimize, maximize, close)

---

### 2. App Registry + Window System
**Files:** `registry.ts`, `useOSStore.ts`, `AppWindow.tsx`, `WindowManager.tsx`

`useOSStore` is the state machine for all windows. `registry.ts` defines what apps exist and who can open them. `WindowManager` renders all open windows. `AppWindow` wraps each app with drag/resize/traffic-light controls.

**Singleton enforcement:** All apps except `test-session` are singletons — re-opening focuses the existing window.

**Stable window IDs:** `test-session` uses `test-session-{attemptId}` as its ID to prevent duplicate windows for the same attempt.

---

### 3. Student App Cluster
**Files:** `TestsApp.tsx`, `TestSessionApp.tsx`, `ResultsApp.tsx` (→ `StudentResultsApp`), `AnalyticsApp.tsx` (→ `StudentAnalyticsApp`), `IntegrityApp.tsx` (→ `StudentIntegrityApp`)

Student-facing apps. All gated by `allowedRoles: ['student']` in the registry (except `test-session` which is universal).

**Key flow:**
```
TestsApp → opens test-session window (openWindow('test-session', { testId, attemptId }))
TestSessionApp → MCQQuestion / DebugQuestion / QuestionNavigator / SubmitConfirmModal
TestSessionApp → useBehavioralTracking + useHeartbeat + useIntegrityListeners
```

**Behavioral tracking hooks:**
- `useBehavioralTracking` — tracks keystrokes, paste events, time-per-question
- `useHeartbeat` — pings `/api/attempts/:id/heartbeat` every 30s
- `useIntegrityListeners` — listens for tab-switch / focus-lost events, POSTs to `/api/attempts/:id/integrity`

---

### 4. Admin App Cluster
**Files:** `QuestionBankApp.tsx`, `TestManagerApp.tsx`, `AdminAnalyticsApp.tsx`, `AdminIntegrityApp.tsx`, `ResultsApp.tsx` (admin variant), `TestSettingsApp.tsx`

Admin-facing apps. Gated by `allowedRoles: ['admin', 'super_admin', 'master_admin']`.

**Sub-components used:**
- `MCQForm`, `DebugQuestionForm`, `BulkImportPanel`, `AttachToTestModal`, `VariantReviewPanel` (all in `components/admin/`)
- `AttemptAuditPanel`, `SimilarityFlagsPanel` (in `os/apps/integrity/`)

---

### 5. Server API Layer
**Files:** `server/index.js`, `server/routes/*.js`, `server/middleware/auth.js`

Express REST API with 8 route modules:

| Route | Path | Auth |
|-------|------|------|
| `auth.js` | `/api/auth` | Public (register/login/me) |
| `tests.js` | `/api/tests` | requireAuth |
| `questions.js` | `/api/questions` | requireAuth + requireAdmin |
| `attempts.js` | `/api/attempts` | requireAuth |
| `admin.js` | `/api/admin` | requireAuth + requireAdmin |
| `ai.js` | `/api/ai` | requireAuth + requireAdmin |
| `execute.js` | `/api/execute` | requireAuth |
| `analytics.js` | `/api/analytics` | requireAuth |

**`attempts.js` is the largest and most complex route** (932 lines). It handles: start, resume, heartbeat, integrity events, question fetching (with shuffle), response saving, submission, evaluation, and result retrieval.

---

### 6. Evaluation + Integrity Pipeline
**Files:** `server/lib/evaluator.js`, `server/lib/auditor.js`, `server/lib/similarity.js`, `server/lib/importParser.js`, `server/lib/localRunner.js`

**Evaluation flow on submit:**
```
POST /api/attempts/:id/submit
  → evaluateMCQ() — checks selected_option_ids against is_correct
  → evaluateDebugging() — runs code via Piston API, checks test cases
  → INSERT results row (total_score, percentage, integrity_score)
```

**Integrity pipeline:**
- `auditor.js` — calls local Ollama (`deepseek-coder-v2`) to generate a suspicion score (0–100) + narrative
- `similarity.js` — Jaccard token similarity between student code submissions to detect copying
- `importParser.js` — parses import statements from submitted code
- `localRunner.js` — local code execution fallback

---

### 7. Code Execution Layer (Piston)
**Files:** `piston/api/src/index.js`, `piston/api/src/job.js`, `piston/api/src/runtime.js`, `piston/api/src/package.js`, `server/routes/execute.js`

Self-hosted Piston code execution engine. `server/routes/execute.js` proxies execution requests to the Piston API. Supports 20+ languages via sandboxed runtimes.

**Flow:**
```
client CodeEditorApp / DebugQuestion → POST /api/execute
  → execute.js → Piston API (localhost)
    → job.js (sandbox) → runtime binary
```

---

### 8. Auth + Session Layer
**Files:** `client/src/context/AuthContext.tsx`, `client/src/lib/supabase.ts`, `server/routes/auth.js`, `server/middleware/auth.js`, `client/src/components/ProtectedRoute.tsx`, `client/src/pages/Register.tsx`

**Auth flow:**
```
Register.tsx → POST /api/auth/register (creates Supabase auth user + public.users row)
LockScreen → Supabase signInWithPassword → session token
AuthContext → supabase.auth.onAuthStateChange → fetchProfile(/api/auth/me)
All API calls → axios.ts (attaches Bearer token) → requireAuth middleware
```

---

### 9. UI Component Library
**Files:** `BorderGlow.tsx`, `ClickSpark.tsx`, `AnimatedList.tsx`, `Counter.tsx`, `Toast.tsx`, `ToastContainer.tsx`, `ThemeToggle.tsx`, `GlassSelect.tsx`, `OrbitalBuffer.tsx`

Reusable visual components. `ClickSpark` wraps the entire `OSShell`. `BorderGlow` used in cards/panels. `GlassSelect` used in `CodeEditorApp` and admin forms.

---

## Surprising Connections

1. **`middleware/auth.js` imports from `server/supabase/supabase.js`** — the supabase client was moved to `server/supabase/` but all server imports still reference it. If the path changes, all routes break simultaneously.

2. **`attempts.js` is a monolith** — at 932 lines it handles 10+ distinct endpoints. It's the single highest-risk file for regressions. Consider splitting into `attempts/start.js`, `attempts/submit.js`, `attempts/questions.js`.

3. **`useOSStore` duplicates `registry.ts` data** — `APP_DEFAULTS` and `APP_TITLES` in `useOSStore.ts` mirror the `defaultSize`/`defaultPosition`/`name` fields in `registry.ts`. These can drift out of sync.

4. **`auditor.js` depends on a local Ollama instance** — if Ollama isn't running, it silently falls back to a heuristic score. This is invisible to the admin UI.

5. **`TestSessionApp` is the most complex client file** — it orchestrates 5 hooks (`useBehavioralTracking`, `useHeartbeat`, `useIntegrityListeners`, `useCountdown`, `useLenis`) plus 4 question components. It's the highest-risk client file.

6. **`piston/` is a fully self-contained sub-project** — it has its own `package.json`, CLI, API, and 20+ language packages. It's loosely coupled to the main app via HTTP only.

---

## Dependency Hotspots (Files Most Imported By Others)

| File | Imported By |
|------|-------------|
| `server/supabase/supabase.js` | auth.js, tests.js, questions.js, attempts.js, admin.js, ai.js, analytics.js, middleware/auth.js |
| `middleware/auth.js` | tests.js, questions.js, attempts.js, admin.js, ai.js, analytics.js |
| `client/src/lib/axios.ts` | Most OS apps and admin components |
| `client/src/context/AuthContext.tsx` | OSShell, MenuBar, LockScreen, ProtectedRoute, Dock |
| `client/src/os/store/useOSStore.ts` | OSShell, Dock, Desktop, AppWindow, WindowManager, all Apps |
| `registry.ts` | Dock, OSShell, AppWindow |

---

## Role-Based Access Map

| Role | Apps Available |
|------|---------------|
| `student` | Tests, Test Session, Results, Analytics, Integrity, Code Editor |
| `admin` | Test Session, Question Bank, Test Manager, Results (admin), Analytics (admin), Integrity (admin), Code Editor, Test Settings |
| `super_admin` | Same as admin |
| `master_admin` | Same as admin |

---

## Database Tables (from schema + routes)

| Table | Purpose |
|-------|---------|
| `users` | User profiles (id, name, email, role, year, division, subject) |
| `tests` | Test definitions (title, subject, status, start/end time, duration) |
| `question_bank` | Questions (type: mcq_single, mcq_multi, debugging) |
| `test_questions` | Many-to-many: tests ↔ questions (with unlock_at_minutes) |
| `mcq_options` | MCQ answer options (with is_correct) |
| `debug_variants` | Buggy code variants for debugging questions |
| `attempts` | Student test attempts (status, session_token, behavioral counters) |
| `responses` | Per-question responses (selected_option_ids, submitted_code) |
| `results` | Computed scores (total_score, percentage, integrity_score, rank) |
| `variant_assignments` | Which debug variant was assigned to which attempt |
| `option_shuffle` | Shuffled MCQ option order per attempt |
| `behavioral_flags` | Integrity flag events per attempt |
| `behavioral_details` | Detailed behavioral telemetry |

---

## Navigation Guide

- **Tracing a test attempt end-to-end:** Start at `TestsApp.tsx` → `TestSessionApp.tsx` → `server/routes/attempts.js` (start → questions → responses → submit) → `server/lib/evaluator.js`
- **Understanding window management:** `useOSStore.ts` → `AppWindow.tsx` → `WindowManager.tsx`
- **Adding a new app:** `registry.ts` (add entry) → create `YourApp.tsx` in `os/apps/` → add to `AppWindow.tsx` render switch → add to `useOSStore.ts` `AppType` union + `APP_DEFAULTS`
- **Auth flow:** `AuthContext.tsx` → `supabase.ts` → `server/routes/auth.js` → `middleware/auth.js`
- **Integrity/cheating detection:** `useIntegrityListeners.ts` + `useBehavioralTracking.ts` → `attempts.js` (integrity endpoint) → `server/lib/auditor.js` + `server/lib/similarity.js`
