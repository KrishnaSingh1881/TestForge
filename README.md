# TestForge — Next-Generation Academic Testing Platform

TestForge is not a standard web application. It is a **macOS-replicated desktop environment running entirely inside the browser**, purpose-built for college examinations that combine MCQs and code-debugging challenges. It achieves state-of-the-art **anti-cheat without surveillance** — relying entirely on architectural design, generative AI variants, and behavioral fingerprinting rather than invasive webcams or screen recording.

---

## Table of Contents

1. [The OS Experience](#the-os-experience)
2. [Feature Reference](#feature-reference)
   - [Student Features](#student-features)
   - [Admin Features](#admin-features)
   - [Anti-Cheat System](#anti-cheat-system)
   - [Integrity & Behavioral Tracking](#integrity--behavioral-tracking)
   - [Code Execution Engine](#code-execution-engine)
3. [Technical Architecture](#technical-architecture)
4. [Database Schema](#database-schema)
5. [Setup Instructions](#setup-instructions)
6. [Deployment Guide](#deployment-guide)
7. [Bulk Import Format](#bulk-import-format)
8. [Supabase Migrations](#supabase-migrations)
9. [Credentials (Seed Data)](#credentials-seed-data)

---

## The OS Experience

The frontend is built as a complete Desktop OS abstraction. Instead of standard web page routing, users interact with a simulated macOS desktop environment.

### Windowed Application System
Every feature in TestForge lives inside a draggable, resizable, minimizable, and maximizable window — exactly like a native desktop app. Window positions and sizes are preserved across interactions. Multiple windows can be open simultaneously. When a test is active, the test session window is **locked** — it cannot be moved, resized, minimized, or closed until the test is submitted.

### Dock & Menu Bar
- **Bottom Dock**: App launcher with magnification animation on hover. Supports **auto-hide** mode — the dock slides off-screen and reappears when you hover the bottom edge, maximizing screen real estate during tests.
- **Top Menu Bar**: Shows the active window title, a live clock, a light/dark theme toggle, and a profile dropdown with font size controls and dock settings.

### Global Font Scaling (Accessibility)
The OS supports four font sizes — **Small (12px), Medium (14px), Large (17px), XL (20px)** — applied globally via a CSS `data-font` attribute on `<html>`. This scales every text element across all apps including the Monaco code editor. Settings persist across sessions via localStorage.

### Theme System
Full light and dark mode with warm sand tones in light mode and deep indigo in dark mode. Transitions are smooth (400ms). The theme toggle is a custom animated pill switch in the menu bar.

---

## Feature Reference

### Student Features

#### Academic Hub (Tests Dashboard)
Students see a unified "Academic Hub" showing their year and division. Tests are displayed as cards with status indicators:
- **Open** — active test, student can start immediately
- **Locked** — test is scheduled but not yet started by the admin
- **In Progress** — student has an ongoing attempt, can resume
- **Concluded** — test ended, student can view results

Tests are filtered by the student's year and division. Tests created with "All Divisions" are visible to all students of that year regardless of division.

#### Proctored Test Start Screen
Before the timer begins, students see a mandatory confirmation screen showing test duration, question count, total marks, and a numbered list of integrity rules. The student must check an acknowledgment checkbox before the "Begin Secure Session" button activates. This sets behavioral expectations and makes integrity scoring defensible.

#### Test Session
- **Countdown Timer**: Displayed prominently in the top bar with color coding — green above 10 minutes, yellow below 10 minutes, red below 5 minutes. Auto-submits when it reaches zero.
- **Live Integrity Score**: Displayed in the top bar alongside the timer. Starts at 100 and decrements in real-time as violations are detected. Color-coded green/yellow/red.
- **Question Navigator**: Left sidebar showing all question numbers with color-coded status — current (blue), answered (green), marked for review (yellow), unanswered (grey).
- **Progressive Question Unlock**: Questions can be configured to unlock at specific minute marks. Locked questions show a lock icon with the unlock time.
- **Mark for Review**: Students can flag questions to revisit before submitting.
- **Manual Submit**: Students can submit early with a confirmation modal showing answered vs total count.

#### MCQ Questions
Options are displayed as large clickable cards. Single-choice shows radio-style selection; multi-choice shows checkbox-style. Options are **shuffled per student** — the same question shows different option orders to different students, making letter-based answer sharing useless. Responses auto-save with a 300ms debounce.

#### Debugging Questions
Students are shown a read-only panel with buggy code and a full-screen Monaco editor to write their fix. A "Launch Full-Screen Editor" button opens the `CodingEditorOverlay` — a VSCode-identical interface covering the test window with:
- Side-by-side buggy code reference (toggleable)
- Editable Monaco editor for the fix
- Run button with visible test case results
- Run counter (default 10 runs per question)
- Submit button with confirmation

#### Results & Analytics
After submission, students can view:
- Total score, percentage, rank on leaderboard
- Per-question breakdown — correct/incorrect, marks awarded, time spent
- For coding questions: visible test cases passed, hidden test cases passed separately
- Personal analytics trends across all tests

---

### Admin Features

#### Test Manager
The central admin hub for managing tests. Features:
- **Create Test**: Set title, subject, year, division (or "All Divisions"), duration, start/end time, questions per attempt, and randomization toggle.
- **Manual Start/End**: Tests can be manually started (▶ Start) or ended (■ End Test) regardless of scheduled times. This gives admins full control over when students can access the test.
- **Question Bank shortcut**: Opens the Question Bank pre-filtered to the selected test.
- **Test Settings shortcut**: Opens per-test environment configuration.
- **Live Leaderboard**: Real-time ranked results during active tests, auto-refreshing every 30 seconds.
- **Integrity Dashboard**: Per-student behavioral analysis for any test.

#### Question Bank (Test-Centric Workflow)
The Question Bank opens to a test picker — select a test first, then manage its questions. This keeps the workflow focused:
1. **Pick a test** from the card grid
2. **Test Questions tab**: See all attached questions with order, unlock timing, and remove buttons
3. **All Questions tab**: Browse the full bank, attach questions with "+ Add" (sets unlock time), or use "+ Add All" to attach all filtered questions at once
4. **+ Create New**: Opens question type picker — Multiple Choice, Debugging Question, Coding Question, or Bulk Import

#### MCQ Question Creation
Form with statement, image upload support, difficulty, marks, topic tag, and dynamic option builder. Supports single-correct and multi-correct types. Options can have text or images.

#### Debugging Question Creation
Form with statement, language (Python/C++), difficulty, marks, bug count (1-5), and a Monaco editor for the correct code. After saving:
1. Click "✨ Generate Variants" — sends the correct code to NVIDIA Gemma 4 which generates 5 buggy variants with different variable names, function names, and code structure but the same underlying bug logic
2. Review each variant in a side-by-side diff view
3. Approve good variants (minimum 3 recommended)
4. Once at least one variant is approved, a green "✓ Done — Back to Questions" button appears

#### Test Settings (Per-Test Environment Configuration)
Each test has independently configurable environment settings:
- **Allow Paste** (default: OFF) — whether students can paste into answer fields
- **Allow Copy** (default: OFF) — whether students can copy text from the test
- **Allow Right Click** (default: OFF) — whether the browser context menu is enabled
- **Max Tab Switches** (default: 3) — number of tab switches before auto-submit triggers
- **Auto-submit on Tab Limit** (default: ON) — whether hitting the tab limit triggers auto-submit
- **Show Remaining Time** — whether the countdown timer is visible to students
- **Show Question Marks** — whether marks per question are shown
- **Allow Back Navigation** — whether students can go back to previous questions

#### Bulk Import
Admins can import multiple MCQ questions at once via CSV or JSON file. Template downloads are provided. Import results show success count and per-row error details.

---

### Anti-Cheat System

#### AI-Driven Buggy Code Variants
Instead of asking students to write code from scratch (trivially solved by ChatGPT), students receive **pre-written buggy code** they must trace and repair. The NVIDIA Gemma 4 integration generates multiple uniquely varied versions of the buggy code — different variable names, function names, code structure — but with the same underlying bug logic. Two students sitting next to each other get visually different code. Simply copying answers is impossible.

#### Per-Student Option Shuffling
MCQ options (A/B/C/D) are shuffled independently per student at attempt start and stored in the database. The same question shows different option orders to different students. Screenshots of answers shared in group chats become useless because the letter mappings differ.

#### Randomized Question Pool
Admins upload N questions to a test but configure M questions to be shown per student (e.g., upload 15, show 10). Each student gets a random sample. No two students are guaranteed the same paper.

#### Progressive Question Reveal
Questions unlock at configured minute marks. Students cannot jump ahead. This prevents mass-screenshotting the full paper at the start to share externally — by the time someone answers Q1 and shares it, Q2 is already available to everyone anyway.

#### Copy-Paste Blocking (Enforced During Test)
During any active test session, the following are blocked unconditionally regardless of test settings:
- `Ctrl+C` / `Cmd+C` (copy)
- `Ctrl+V` / `Cmd+V` (paste)
- `Ctrl+X` (cut)
- Browser right-click context menu
- Document-level `copy`, `paste`, `cut` events
- Paste inside Monaco editor (paste is intercepted and immediately undone)
- Text selection is disabled via CSS `user-select: none` on the entire test session

Each paste attempt deducts **5 integrity points** and shows a warning toast.

#### Tab Switch Detection & Penalties
Every tab switch (detected via `visibilitychange` event) is:
1. Recorded server-side in the `attempts` table
2. Deducts **30 integrity points** from the live score immediately
3. Shows a warning toast with current integrity score
4. At **3 tab switches** → auto-submit is triggered immediately

#### Window Locking
When a test starts, the test session window is locked — it cannot be dragged, resized, minimized, or closed. The OS window lock is enforced at the store level.

#### Hidden Honeypot Test Cases
Each debugging question has visible test cases (shown to students during the attempt) and hidden test cases (never shown, only evaluated server-side on final submission). Students who hardcode outputs to pass visible cases will fail hidden cases. Scores show visible and hidden case results separately.

#### Tokenized Code Similarity Scoring
After a test closes, admins can run a similarity analysis. Code submissions are tokenized — variable names stripped, structure normalized — and compared pairwise using Jaccard similarity. Pairs above 80% similarity are flagged. This catches students who copy a solution and manually rename variables to evade naive string comparison.

---

### Integrity & Behavioral Tracking

#### Live Integrity Score
Displayed in the test session top bar. Starts at 100, decrements in real-time:
- Tab switch: **−30**
- Paste attempt: **−5**
- Copy attempt: **−5**
- Score reaches 0: **auto-submit triggered**

#### Behavioral Fingerprinting (Per Coding/Debugging Question)
The platform tracks *how* a student answers, not just *what* they answer:

| Signal | What it detects |
|--------|----------------|
| `time_to_first_keystroke` | Delay before first edit. Under 3 seconds on a complex question is suspicious — likely pre-prepared. |
| `wpm_consistency` | Rolling 10-second WPM average. Inhuman speeds (>120 WPM) flag mechanical input or paste. |
| `backspace_count` | Number of corrections. Zero backspaces on a 40+ line submission at high WPM strongly suggests copy-paste. |
| `paste_events` | Direct paste detection via Monaco's `onDidPaste` event. |
| `edit_count` | Number of distinct edit sessions (debounced at 2 seconds). |
| `test_runs_before_submit` | How many times the student ran their code. Zero runs on a correct submission is a flag. |
| `idle_periods` | Stretches of 3+ minutes with no keystrokes. May indicate seeking external help. |

#### MCQ Behavioral Tracking
For MCQ questions, the platform tracks:
- `time_to_first_keystroke` — time to first option click
- `edit_count` — number of option changes (indecision or copying from someone)
- `time_spent_seconds` — total time on the question

#### Admin Integrity Dashboard
Per-student audit view showing:
- **Hero integrity score** with risk label (CLEAN / LOW RISK / HIGH RISK)
- **Summary stats**: score, tab switches, focus lost, total flags
- **Integrity flags** with severity (HIGH/MEDIUM) and plain-English explanations
- **Coding/Debugging Analysis** (marked as PRIMARY INTEGRITY SIGNAL):
  - Per-question metric grid with flag highlighting
  - **N/A displayed** for questions the student did not attempt
  - Flag explanations: "Typed within 3s of opening — likely pre-prepared", "No corrections at high speed — likely copy-pasted", etc.
- **MCQ Telemetry**: Compact per-question view with first-click timing and option change count
- **Similarity Report**: Flagged submission pairs with similarity percentage, admin can confirm or dismiss

#### Server-Side Integrity Score Trigger
The final `integrity_score` (0-100) stored in the `results` table is computed by a PostgreSQL trigger on result insert:
- Tab switches: −5 per event
- Focus lost: −2 per event
- Similarity flag (not dismissed): −15
- Score floor: 0

---

### Code Execution Engine

TestForge runs code through a multi-tiered fallback chain:

1. **Judge0 CE (Self-Hosted via Docker)** — Primary execution layer. Real sandbox, supports Python, C++, C, Java with libraries (numpy, pandas, boost). Recommended for production.
2. **Local Native Execution** — Falls back to system Python/g++/gcc via Node.js `child_process`. Handles stdin properly, real compilation, 10-second timeout.
3. **NVIDIA Gemma 4 Simulation** — Last resort when no execution backend is available. AI simulates the output. Suitable for prototyping.

Execution is controlled by environment variables:
- `JUDGE0_URL` + `JUDGE0_KEY` → enables Judge0
- `SKIP_LOCAL=true` → skips local execution
- `SKIP_PISTON=true` → skips Piston (legacy)

---

## Technical Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend OS | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Window Management | Framer Motion + react-rnd |
| State Management | Zustand (with persistence middleware) |
| Code Editor | Monaco Editor (@monaco-editor/react) |
| Smooth Scrolling | Lenis |
| Backend API | Node.js + Express |
| Database & Auth | Supabase (PostgreSQL + RLS) |
| AI Variant Generation | NVIDIA Gemma 4 (via OpenAI-compatible API) |
| Code Execution | Judge0 CE (Docker) → Local child_process → Gemma simulation |
| Similarity Scoring | Jaccard tokenization (custom `similarity.js`) |

### Directory Structure

```
TestForge/
├── client/
│   └── src/
│       ├── os/                          # OS Shell
│       │   ├── OSShell.tsx              # Root component, global integrity enforcement
│       │   ├── Desktop.tsx              # Wallpaper layer
│       │   ├── MenuBar.tsx              # Top bar: clock, theme, font size, dock toggle
│       │   ├── Dock.tsx                 # App launcher with autohide support
│       │   ├── WindowManager.tsx        # Renders all open windows
│       │   ├── AppWindow.tsx            # Window chrome: drag, resize, lock, maximize
│       │   ├── store/
│       │   │   ├── useOSStore.ts        # Window state management (Zustand)
│       │   │   └── useOSSettings.ts     # Font size + dock autohide (persisted)
│       │   ├── apps/
│       │   │   ├── TestsApp.tsx         # Student: Academic Hub
│       │   │   ├── TestSessionApp.tsx   # Student: Active test (integrity enforced)
│       │   │   ├── ResultsApp.tsx       # Student: Post-test results
│       │   │   ├── AnalyticsApp.tsx     # Student: Performance analytics
│       │   │   ├── QuestionBankApp.tsx  # Admin: Test-centric question management
│       │   │   ├── TestManagerApp.tsx   # Admin: Create/start/end tests
│       │   │   ├── TestSettingsApp.tsx  # Admin: Per-test environment config
│       │   │   ├── IntegrityApp.tsx     # Admin: Behavioral analysis dashboard
│       │   │   ├── AdminAnalyticsApp.tsx
│       │   │   └── CodeEditorApp.tsx    # Scratch pad (not used in tests)
│       │   └── components/
│       │       ├── CodingEditorOverlay.tsx  # Full-window debugging IDE
│       │       ├── VSCodeLayout.tsx         # Legacy VSCode layout
│       │       └── Terminal.tsx             # Test case results panel
│       ├── components/
│       │   ├── test/
│       │   │   ├── MCQQuestion.tsx      # MCQ with behavioral tracking
│       │   │   ├── QuestionNavigator.tsx
│       │   │   └── SubmitConfirmModal.tsx
│       │   └── admin/
│       │       ├── DebugQuestionForm.tsx    # Debugging question + variant generation
│       │       ├── MCQForm.tsx
│       │       └── VariantReviewPanel.tsx
│       └── hooks/
│           ├── useBehavioralTracking.ts # Keystroke, WPM, paste, idle tracking
│           ├── useIntegrityListeners.ts # Tab switch + focus loss detection
│           └── useHeartbeat.ts          # Attempt keepalive
├── server/
│   ├── index.js                         # Express entry point
│   ├── routes/
│   │   ├── tests.js                     # Test CRUD + start/end + settings + leaderboard
│   │   ├── questions.js                 # Question CRUD + attach/detach
│   │   ├── attempts.js                  # Start, resume, submit, heartbeat, integrity
│   │   ├── execute.js                   # Code execution (Judge0 → local → Gemma)
│   │   ├── ai.js                        # NVIDIA Gemma variant generation
│   │   ├── admin.js                     # Integrity dashboard + similarity analysis
│   │   ├── results.js                   # Results and scoring
│   │   └── analytics.js                 # Analytics queries
│   ├── lib/
│   │   ├── evaluator.js                 # MCQ + debugging test case evaluation
│   │   ├── similarity.js                # Jaccard tokenization engine
│   │   ├── localRunner.js               # Native execution via child_process
│   │   └── importParser.js              # CSV/JSON bulk import parser
│   ├── schema.sql                       # Full database schema
│   ├── rls.sql                          # Row Level Security policies
│   ├── migration_test_settings.sql      # Add settings column to tests
│   ├── migration_add_question_selection.sql  # Add question_selection to attempts
│   └── seed.sql                         # Sample data
```

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Auth + role (student/admin/super_admin), year, division |
| `tests` | Test metadata, scheduling, settings JSONB column |
| `question_bank` | MCQ and debugging questions |
| `test_questions` | Junction: test ↔ question with unlock timing |
| `mcq_options` | Options with correct answer flag |
| `debug_variants` | AI-generated buggy variants with approval status |
| `test_cases` | Visible + hidden test cases per question |
| `attempts` | Student sessions with integrity counters, question_selection |
| `variant_assignments` | Which variant each student got |
| `option_shuffle` | Per-student MCQ option order |
| `responses` | Answers with behavioral_meta JSONB |
| `results` | Computed scores, rank, integrity_score |
| `similarity_flags` | Flagged submission pairs |

### Key Design Decisions
- **RLS enforced at DB level**: A student JWT cannot access admin data even via direct API calls
- **Integrity score computed by trigger**: `compute_integrity_score()` runs on `results` INSERT
- **question_selection stored on attempt**: Each student's random question sample is locked at start
- **behavioral_meta as JSONB**: Flexible schema for all behavioral signals per response

---

## Setup Instructions

### Prerequisites
- Node.js v18+ and npm
- Supabase account (free tier works)
- NVIDIA API key (for AI variant generation — free at build.nvidia.com)
- Docker Desktop (for Judge0 — recommended but optional)

### 1. Clone and Install

```bash
git clone https://github.com/KrishnaSingh1881/TestForge.git
cd TestForge

cd client && npm install
cd ../server && npm install
```

### 2. Environment Variables

**`client/.env`**:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:4000/api
```

**`server/.env`**:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=4000
NVIDIA_API_KEY=your_nvidia_api_key

# Judge0 (self-hosted) — recommended
JUDGE0_URL=http://localhost:2358
JUDGE0_KEY=local

# Optional: skip execution backends for prototyping
# SKIP_LOCAL=true
# SKIP_PISTON=true
```

### 3. Database Setup (Supabase SQL Editor)

Run these files in exact order in your Supabase SQL Editor:

```
1. server/schema.sql                          — Creates all tables, views, triggers
2. server/rls.sql                             — Row Level Security policies
3. server/migration_test_settings.sql         — Adds settings column to tests
4. server/migration_add_question_selection.sql — Adds question_selection to attempts
5. server/seed.sql                            — (Optional) Sample data
```

**Required trigger** — run this if not already in schema.sql:
```sql
CREATE OR REPLACE FUNCTION compute_integrity_score()
RETURNS TRIGGER AS $$
DECLARE
  v_tab_switches int; v_focus_lost int; v_score int := 100; v_sim boolean;
BEGIN
  SELECT tab_switches, focus_lost_count INTO v_tab_switches, v_focus_lost
  FROM attempts WHERE id = NEW.attempt_id;
  SELECT EXISTS (
    SELECT 1 FROM similarity_flags
    WHERE (attempt_id_1 = NEW.attempt_id OR attempt_id_2 = NEW.attempt_id)
    AND admin_verdict != 'dismissed'
  ) INTO v_sim;
  v_score := v_score - (COALESCE(v_tab_switches, 0) * 5);
  v_score := v_score - (COALESCE(v_focus_lost, 0) * 2);
  IF v_sim THEN v_score := v_score - 15; END IF;
  NEW.integrity_score := GREATEST(v_score, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_integrity_score ON results;
CREATE TRIGGER trg_integrity_score
BEFORE INSERT ON results
FOR EACH ROW EXECUTE FUNCTION compute_integrity_score();
```

### 4. Judge0 Setup (Recommended)

```bash
git clone https://github.com/judge0/judge0.git
cd judge0
cp judge0.conf.example judge0.conf
```

**Windows users**: Convert judge0.conf to LF line endings before starting:
```powershell
(Get-Content judge0.conf -Raw) -replace "`r`n", "`n" | Set-Content judge0.conf -NoNewline
```

```bash
docker-compose up -d
```

Wait ~60 seconds, then verify:
```bash
curl http://localhost:2358/system_info
# or on Windows PowerShell:
Invoke-RestMethod http://localhost:2358/system_info
```

### 5. Start Development Servers

```bash
# Terminal 1 — Backend
cd server
node index.js

# Terminal 2 — Frontend
cd client
npm run dev
```

Navigate to `http://localhost:5174`

---

## Deployment Guide

### Frontend → Vercel
1. Import repo on vercel.com, set **Root Directory** to `client`
2. Build command: `npm run build` | Output: `dist`
3. Environment variables:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   VITE_API_URL=https://your-railway-app.up.railway.app/api
   ```

### Backend → Railway
1. New project → Deploy from GitHub, set **Root Directory** to `server`
2. Environment variables:
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   NVIDIA_API_KEY=...
   PORT=4000
   CLIENT_URL=https://your-vercel-app.vercel.app
   ```
3. Start command: `node index.js`

---

## Bulk Import Format

### JSON Format
```json
[
  {
    "type": "mcq_single",
    "statement": "What is the time complexity of binary search?",
    "options": [
      { "text": "O(n)",     "is_correct": false },
      { "text": "O(log n)", "is_correct": true  },
      { "text": "O(n²)",    "is_correct": false },
      { "text": "O(1)",     "is_correct": false }
    ],
    "marks": 2,
    "topic_tag": "Algorithms",
    "difficulty": "easy"
  },
  {
    "type": "mcq_multi",
    "statement": "Which are sorting algorithms?",
    "options": [
      { "text": "Merge Sort",    "is_correct": true  },
      { "text": "Binary Search", "is_correct": false },
      { "text": "Bubble Sort",   "is_correct": true  },
      { "text": "DFS",           "is_correct": false }
    ],
    "marks": 3,
    "topic_tag": "Sorting",
    "difficulty": "medium"
  }
]
```

### CSV Format
```csv
type,statement,option_1,option_2,option_3,option_4,correct_options,marks,topic_tag,difficulty
mcq_single,"What is O(log n)?","Binary Search","Bubble Sort","Linear Search","DFS","1",2,"Algorithms","easy"
```

Rules:
- `type`: `mcq_single` or `mcq_multi`
- `correct_options`: 1-indexed, comma-separated for multi (e.g., `"1,3"`)
- `difficulty`: `easy`, `medium`, or `hard`

---

## Supabase Migrations

Run these in Supabase SQL Editor if not already applied:

```sql
-- 1. Add settings column to tests (for per-test environment config)
ALTER TABLE tests ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- 2. Add question_selection to attempts (for randomized question pools)
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS question_selection JSONB;

-- 3. Add nvidia-gemma to variant_source enum (for AI-generated variants)
ALTER TYPE variant_source ADD VALUE IF NOT EXISTS 'nvidia-gemma';
```

---

## Credentials (Seed Data)

If you ran `seed.sql`:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@testforge.com | admin123 |
| Student | student1@testforge.com | student123 |
| Student | student2@testforge.com | student123 |
| Student | student3@testforge.com | student123 |

---

## License

MIT — Built for academic integrity and modern testing experiences.
