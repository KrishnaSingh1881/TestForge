# TestForge

A modern academic testing platform with macOS-style desktop UI, built for college environments. Features MCQ and debugging-based coding questions with comprehensive anti-cheat mechanisms through design, not surveillance.

## Overview

TestForge combines traditional multiple-choice questions with innovative debugging-based coding challenges. The platform uses unique code variants, behavioral fingerprinting, and similarity scoring to maintain academic integrity without invasive monitoring. The frontend runs as a browser-based operating system with windowed applications, while the backend uses Express + Supabase for data management.

## Key Features

### For Students
- **Desktop OS Interface**: macOS-style windowed environment with draggable, resizable app windows
- **Font Size Control**: Small / Medium / Large / XL scaling for accessibility
- **Dock Autohide**: Toggle dock visibility for maximum screen space
- **Test Taking**: Timed tests with MCQ and debugging questions, auto-submit on timer expiry
- **Code Editor**: VSCode-identical layout with Monaco editor, terminal panel, and test case execution
- **Results & Analytics**: Detailed score breakdowns, performance trends, and subject-wise analysis
- **Progressive Question Unlock**: Questions unlock at specific time intervals to prevent early sharing

### For Admins (Teachers)
- **Question Bank Management**: Create MCQ, debugging, and coding questions with AI-powered variant generation
- **Test Management**: Create tests, manually start/end tests, configure question pools and unlock timing
- **Test Settings**: Per-test configuration — allow/block copy-paste, right-click, tab switches, auto-submit
- **Integrity Dashboard**: Review behavioral patterns, tab switches, and code similarity flags
- **Analytics**: Per-test statistics, division comparisons, question difficulty analysis
- **Leaderboard**: Live ranked results with integrity scores
- **Bulk Import**: Import MCQ questions via CSV or JSON

### Anti-Cheat System
- **Code Variants**: AI-generated buggy code variants with different variable names and structure
- **Option Shuffling**: MCQ options randomized per student
- **Behavioral Fingerprinting**: Tracks typing patterns, paste events, idle periods, test runs
- **Code Similarity Detection**: Token-based comparison to flag copied solutions
- **Integrity Scoring**: Automated 0-100 score based on tab switches, focus loss, and behavioral flags
- **Progressive Reveal**: Questions unlock over time to prevent full paper sharing
- **Copy-Paste Blocking**: Configurable per test via Test Settings
- **Right-Click Disable**: Configurable per test via Test Settings

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS v4** for styling
- **Framer Motion** for window animations
- **Monaco Editor** for code editing
- **Zustand** for state management (with persistence)
- **React Router** for routing
- **Recharts** for analytics visualization
- **Lenis** for smooth scrolling

### Backend
- **Node.js** with Express
- **Supabase** (PostgreSQL + Auth + RLS)
- **Judge0 CE** (self-hosted via Docker) for code execution — supports Python, C++, C, Java with libraries
- **Local execution fallback** via Node.js child_process (uses system Python/g++)
- **NVIDIA Gemma 4** (via NVIDIA API) for AI variant generation and code simulation fallback

## Architecture

### Frontend Structure

```
client/src/
├── os/                          # OS Shell components
│   ├── OSShell.tsx             # Root OS component
│   ├── Desktop.tsx             # Wallpaper layer
│   ├── MenuBar.tsx             # Top bar — clock, theme, font size, dock autohide
│   ├── Dock.tsx                # Bottom app launcher with autohide support
│   ├── LockScreen.tsx          # Login overlay
│   ├── WindowManager.tsx       # Window orchestration
│   ├── AppWindow.tsx           # Individual window chrome (state preserved on resize/maximize)
│   ├── store/
│   │   ├── useOSStore.ts       # Zustand window management
│   │   └── useOSSettings.ts    # Font size + dock autohide (persisted)
│   ├── apps/                   # Windowed applications
│   │   ├── TestsApp.tsx        # Student: Browse tests
│   │   ├── TestSessionApp.tsx  # Student: Take test (integrity enforced)
│   │   ├── ResultsApp.tsx      # View results
│   │   ├── AnalyticsApp.tsx    # Student analytics
│   │   ├── QuestionBankApp.tsx # Admin: Manage questions (test-centric flow)
│   │   ├── TestManagerApp.tsx  # Admin: Create/start/end tests
│   │   ├── TestSettingsApp.tsx # Admin: Per-test environment settings
│   │   ├── IntegrityApp.tsx    # Admin: Review integrity
│   │   ├── AdminAnalyticsApp.tsx
│   │   └── CodeEditorApp.tsx   # Scratch pad with terminal-style I/O
│   └── components/
│       ├── VSCodeLayout.tsx    # Debugging question IDE
│       ├── Terminal.tsx        # Code execution output
│       └── TrafficLights.tsx   # Window controls (16px, improved spacing)
├── components/                  # Shared UI components
├── context/                     # Auth and Theme contexts
├── hooks/                       # Custom React hooks
│   ├── useBehavioralTracking.ts # Keystroke/paste/idle tracking
│   ├── useIntegrityListeners.ts # Tab switch / focus loss detection
│   └── useHeartbeat.ts         # Attempt keepalive
└── pages/
    └── Register.tsx            # Registration page
```

### Backend Structure

```
server/
├── index.js                    # Express server entry
├── routes/                     # API endpoints
│   ├── auth.js                # Authentication
│   ├── tests.js               # Test CRUD + start/end + settings + leaderboard
│   ├── questions.js           # Question CRUD + test attachment/detachment
│   ├── attempts.js            # Test attempts
│   ├── results.js             # Results and scoring
│   ├── integrity.js           # Integrity data
│   ├── analytics.js           # Analytics queries
│   ├── execute.js             # Code execution (Judge0 → local → Gemma fallback)
│   └── gemini.js              # AI variant generation (NVIDIA Gemma 4)
├── middleware/
│   └── auth.js                # JWT verification
├── lib/
│   ├── evaluator.js           # Test case evaluation
│   ├── similarity.js          # Code similarity scoring
│   ├── importParser.js        # Bulk question import
│   └── localRunner.js         # Local execution via child_process
├── schema.sql                 # Database schema
├── rls.sql                    # Row Level Security policies
├── migration_test_settings.sql # Add settings column to tests table
└── seed.sql                   # Sample data
```

## Code Execution Chain

Execution priority (first available wins):

1. **Judge0 CE** (self-hosted Docker) — real sandbox, supports libraries (numpy, pandas, boost)
2. **Local execution** — uses system Python/g++/gcc via Node.js child_process
3. **NVIDIA Gemma 4** — AI simulation fallback (no Docker needed)

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- NVIDIA API key (for AI variant generation)
- Docker Desktop (for Judge0 — recommended for production)

### 1. Clone and install

```bash
git clone https://github.com/KrishnaSingh1881/TestForge.git
cd TestForge

cd client && npm install
cd ../server && npm install
```

### 2. Configure environment

`client/.env`:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:4000/api
```

`server/.env`:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=4000
NVIDIA_API_KEY=your_nvidia_api_key

# Judge0 (self-hosted) — recommended
JUDGE0_URL=http://localhost:2358
JUDGE0_KEY=local
```

### 3. Set up database

Run in Supabase SQL Editor in order:
1. `server/schema.sql`
2. `server/rls.sql`
3. `server/migration_test_settings.sql`
4. `server/seed.sql` (optional — sample data)

### 4. Set up Judge0 (recommended)

```bash
git clone https://github.com/judge0/judge0.git
cd judge0
cp judge0.conf.example judge0.conf
docker-compose up -d
```

Wait ~60 seconds for initialization, then verify:
```powershell
Invoke-RestMethod http://localhost:2358/system_info
```

### 5. Start development servers

```bash
# Terminal 1 — backend
cd server
node index.js

# Terminal 2 — frontend
cd client
npm run dev
```

Access at: http://localhost:5174

### Sample Credentials (seed data)

**Admin**: admin@testforge.com / admin123  
**Students**: student1@testforge.com through student5@testforge.com / student123

## Admin Workflow

1. **Create Questions** → Question Bank → pick a test → "+ Create New" → MCQ / Debugging / Coding
2. **Bulk Import** → Question Bank → "+ Create New" → Bulk Import → upload CSV/JSON
3. **Create Test** → Test Manager → "+ New Test" → fill details → Save
4. **Attach Questions** → Test Manager → "Questions" button on test row
5. **Configure Settings** → Test Manager → "⚙️ Test Settings" → select test → configure copy-paste, tab limits etc.
6. **Start Test** → Test Manager → "▶ Start" button (manual override, independent of scheduled time)
7. **Monitor** → Leaderboard updates every 30s during active test
8. **End Test** → Test Manager → "■ End Test"
9. **Review Integrity** → "Integrity" button → sort by score → expand rows

## Bulk Import JSON Format

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
  }
]
```

## OS Features

- **Font Size**: Click avatar → slider → Small / Medium / Large / XL (persisted)
- **Dock Autohide**: Click avatar → toggle → dock slides off-screen, reappears on hover
- **Theme**: Light/dark toggle in menu bar
- **Window Management**: Drag, resize, minimize, maximize — state preserved across all operations

## License

MIT
