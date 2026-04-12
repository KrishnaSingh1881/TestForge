# TestForge - Next-Generation Academic Testing Platform

TestForge is not a standard web application. It is a **macOS-replicated desktop environment** inside the browser, designed specifically for college examinations bridging MCQs and code-debugging. 

Crucially, it achieves state-of-the-art **Anti-Cheat without Surveillance**—relying entirely on architectural design, generative LLM variants, and behavioral fingerprinting rather than invasive webcams or screen recording.

---

## 🌟 The "macOS in the Browser" Experience (Unique UI/UX)

The frontend is built entirely as a Desktop OS abstraction. Instead of standard web page routing, users interact with a simulated Apple Mac desktop.

- **Windowed OS Environment**: Features draggable, resizable, minimizable, and maximizable app windows (powered by Framer Motion). Window states and positions are preserved seamlessly as you manage multiple apps simultaneously.
- **Dock & Menu Bar**: Includes a bottom App Dock that supports auto-hiding for maximum screen real estate, and a top Menu Bar featuring a live clock, dynamic Theme toggling (Light/Dark), and global profile settings.
- **Accessibility Engine**: Font-scaling is built into the OS globally (Small, Medium, Large, XL sizes). User preferences are saved locally via Zustand.
- **VSCode-Identical Application**: The coding interface meticulously replicates VSCode using the Monaco Editor, complete with a terminal I/O panel, test-case execution ribbons, and traffic-light style window controls.

---

## 🛡️ Anti-Cheat by Design (Zero Surveillance)

TestForge completely abandons webcam monitoring and strict browser-locking. Instead, it relies on psychological and systemic deterrents:

### 1. AI-Driven Buggy Code Variants (Gemma 4 integration)
Instead of asking students to write code from scratch (which is easily solved by ChatGPT), students are given **pre-written buggy code** that they must logically trace and repair.
- **The LLM Engine**: Admins upload a single clean code block. Our NVIDIA Gemma 4 integration instantly generates multiple uniquely varied versions of the buggy code.
- **The Result**: Two students sitting next to each other get the "same" question, but the code structure, variable names, and bug logic are visually and uniquely different. Simply copying answers from peers is impossible.

### 2. Deep Behavioral Fingerprinting
The platform tracks *"How"* a student answers, not just *"What"* they answer, compiling an automated 0-100 Integrity Score.
- **Keystroke Dynamics**: Identifies mechanical input speeds and inhuman typing curves (`wpm_consistency`).
- **Suspicious Paste Detection**: Captures `edit_count` and traces massive block paste anomalies.
- **Logic Validation**: Flags zero-test-runs before perfect submissions, identifies `time_to_first_keystroke` anomalies, and tracks `idle_periods`.

### 3. Server-Side Structural Validation
- **Hidden Honeypot Cases**: Students validate against *visible test cases*, but the code is ultimately graded server-side against *hidden test cases*. Hardcoded `print()` cheats fail instantaneously.
- **Tokenized Code Similarity Index**: Advanced post-test similarity algorithms don't compare raw code strings; they tokenize the logical control structures. This perfectly flags students who copy a solution but manually rename their variables to evade detection.

### 4. Smart Deliveries
- **Progressive Question Reveal**: Tests can be configured so Q1 unlocks at 0:00, Q2 at 5:00, etc. This prevents students from mass-screenshotting papers at the beginning to share externally.
- **Locally Shuffled MCQs**: MCQ options (A/B/C/D) are locally randomized per student to defeat letter-based cheating.

---

## 💻 Technical Architecture (For AI & Agent Context)

TestForge is structured as a dual-layer monolithic repository explicitly mapped for UI complexity and secured data execution.

### Tech Stack Details
- **Frontend OS**: React 19 + TypeScript + Vite. Tailwind CSS v4 handles UI styling. Framer Motion handles OS window drag & drop. Lenis handles smooth scrolling.
- **State management**: Zustand (with persisting middleware for OS features).
- **Backend API**: Node.js + Express.
- **Database & Auth**: PostgreSQL powered by **Supabase**. Security is aggressively handled at the DB layer via **Row Level Security (RLS)**, ensuring API hijacking is structurally impossible.
- **Code Execution**: Containerized **Judge0 CE** server.

### The Code Execution Chain Priority
TestForge runs code dynamically through a multi-tiered fallback architecture to ensure maximum uptime:
1. **Judge0 CE** (Self-Hosted via Docker): The primary execution layer providing absolute sandboxed validation and library loading (numpy, pandas).
2. **Local native Execution** (Via child process): Native Python/G++ compile paths if Judge0 instances fall offline.
3. **NVIDIA Gemma 4 Simulation**: Used when direct execution fails or sandbox bounds limits are hit.

### System Directory Blueprint
```markdown
├── client/src/
│   ├── os/                          # Core OS Simulation environment
│   │   ├── OSShell.tsx              # Root component boundary
│   │   ├── Desktop.tsx, Dock.tsx, MenuBar.tsx, WindowManager.tsx
│   │   └── apps/                    # Core Window Applications
│   │       ├── CodeEditorApp.tsx, TestSessionApp.tsx, IntegrityApp.tsx, TestManagerApp.tsx
│   └── hooks/
│       ├── useBehavioralTracking.ts # Keystroke & Idle tracking hooks
│       └── useIntegrityListeners.ts # Hardware tab-shift event listeners
├── server/
│   ├── index.js                     # Express API Core
│   ├── routes/                      # Functional paths (tests, execute, gemini)
│   ├── lib/
│   │   └── similarity.js            # Code structural Tokenizer Engine
│   ├── schema.sql, rls.sql, migration_test_settings.sql
│   └── seed.sql                     # Dummy test identities
```

---

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v18+) and NPM
- A Supabase Project
- NVIDIA API Key (for LLM variant injections)
- Docker Desktop (Required if utilizing Judge0 CE locally)

### 1. Repository Installation
```bash
git clone https://github.com/KrishnaSingh1881/TestForge.git
cd TestForge
cd client && npm install
cd ../server && npm install
```

### 2. Environment Configuration
**`client/.env`**:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:4000/api
```

**`server/.env`**:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=4000
NVIDIA_API_KEY=your_nvidia_api_key
JUDGE0_URL=http://localhost:2358 # Recommended
JUDGE0_KEY=local
```

### 3. Database Sync (Supabase UI)
Load and execute these natively via your Supabase SQL Editor in exact sequence:
1. `server/schema.sql`
2. `server/rls.sql`
3. `server/migration_test_settings.sql`
4. `server/seed.sql` 

### 4. Running the Clusters
```bash
# Terminal 1: Backend
cd server
node index.js

# Terminal 2: OS Frontend
cd client
npm run dev
```
Navigate to the localhost port indicated by Vite. 

### 5. Setup Judge0 Container (Recommended Exec Engine)
```bash
git clone https://github.com/judge0/judge0.git
cd judge0
cp judge0.conf.example judge0.conf
docker-compose up -d
```

### Credentials Note (If utilizing seed.sql):
- **Admin Root**: admin@testforge.com / admin123 
- **Student Examples**: student1@testforge.com / student123

---

## 📝 The Bulk Import (JSON Format Example)
Admins can bypass manual creation by injecting question banks directly using standard JSON:
```json
[
  {
    "type": "mcq_single",
    "statement": "What is the time complexity of a standard binary search?",
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

## License
MIT
