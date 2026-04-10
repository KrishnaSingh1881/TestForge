# TestForge

A modern academic testing platform with macOS-style desktop UI, built for college environments. Features MCQ and debugging-based coding questions with comprehensive anti-cheat mechanisms through design, not surveillance.

## Overview

TestForge combines traditional multiple-choice questions with innovative debugging-based coding challenges. The platform uses unique code variants, behavioral fingerprinting, and similarity scoring to maintain academic integrity without invasive monitoring. The frontend runs as a browser-based operating system with windowed applications, while the backend uses Express + Supabase for data management.

## Key Features

### For Students

- **Desktop OS Interface**: macOS-style windowed environment with draggable, resizable app windows
- **Test Taking**: Timed tests with MCQ and debugging questions, auto-submit on timer expiry
- **Code Editor**: VSCode-identical layout with Monaco editor, terminal panel, and test case execution
- **Results & Analytics**: Detailed score breakdowns, performance trends, and subject-wise analysis
- **Progressive Question Unlock**: Questions unlock at specific time intervals to prevent early sharing

### For Admins (Teachers)

- **Question Bank Management**: Create MCQ and debugging questions with AI-powered variant generation
- **Test Management**: Schedule tests, set duration, configure question pools and unlock timing
- **Integrity Dashboard**: Review behavioral patterns, tab switches, and code similarity flags
- **Analytics**: Per-test statistics, division comparisons, question difficulty analysis
- **Leaderboard**: Live ranked results with integrity scores

### Anti-Cheat System

- **Code Variants**: AI-generated buggy code variants with different variable names and structure
- **Option Shuffling**: MCQ options randomized per student
- **Behavioral Fingerprinting**: Tracks typing patterns, paste events, idle periods, test runs
- **Code Similarity Detection**: Token-based comparison to flag copied solutions
- **Integrity Scoring**: Automated 0-100 score based on tab switches, focus loss, and behavioral flags
- **Progressive Reveal**: Questions unlock over time to prevent full paper sharing

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Framer Motion** for window animations
- **Monaco Editor** for code editing
- **Zustand** for state management
- **React Router** for routing
- **Recharts** for analytics visualization
- **Lenis** for smooth scrolling

### Backend
- **Node.js** with Express
- **Supabase** (PostgreSQL + Auth + RLS)
- **Piston API** for code execution (Python, C++, C, Java)
- **Gemini AI** for code variant generation

## Architecture

### Frontend Structure

```
client/src/
├── os/                          # OS Shell components
│   ├── OSShell.tsx             # Root OS component
│   ├── Desktop.tsx             # Wallpaper layer
│   ├── MenuBar.tsx             # Top bar with clock, theme toggle
│   ├── Dock.tsx                # Bottom app launcher
│   ├── LockScreen.tsx          # Login overlay
│   ├── WindowManager.tsx       # Window orchestration
│   ├── AppWindow.tsx           # Individual window chrome
│   ├── store/
│   │   └── useOSStore.ts       # Zustand state management
│   ├── apps/                   # Windowed applications
│   │   ├── TestsApp.tsx        # Student: Browse tests
│   │   ├── TestSessionApp.tsx  # Student: Take test
│   │   ├── ResultsApp.tsx      # View results
│   │   ├── AnalyticsApp.tsx    # Student analytics
│   │   ├── QuestionBankApp.tsx # Admin: Manage questions
│   │   ├── TestManagerApp.tsx  # Admin: Create tests
│   │   ├── IntegrityApp.tsx    # Admin: Review integrity
│   │   └── AdminAnalyticsApp.tsx
│   └── components/
│       ├── VSCodeLayout.tsx    # Debugging question IDE
│       ├── Terminal.tsx        # Code execution output
│       └── TrafficLights.tsx   # Window controls
├── components/                  # Shared UI components
├── context/                     # Auth and Theme contexts
├── hooks/                       # Custom React hooks
└── pages/
    └── Register.tsx            # Registration page
```

### Backend Structure

```
server/
├── index.js                    # Express server entry
├── routes/                     # API endpoints
│   ├── auth.js                # Authentication
│   ├── tests.js               # Test management
│   ├── questions.js           # Question CRUD
│   ├── attempts.js            # Test attempts
│   ├── results.js             # Results and scoring
│   ├── integrity.js           # Integrity data
│   ├── analytics.js           # Analytics queries
│   ├── execute.js             # Code execution
│   └── gemini.js              # AI variant generation
├── middleware/
│   └── auth.js                # JWT verification
├── lib/
│   ├── evaluator.js           # Test case evaluation
│   ├── similarity.js          # Code similarity scoring
│   └── importParser.js        # Bulk question import
├── schema.sql                 # Database schema
├── rls.sql                    # Row Level Security policies
└── seed.sql                   # Sample data
```

## Database Schema

### Core Tables

- **users**: Authentication and role management (student/admin)
- **tests**: Test definitions with scheduling and configuration
- **question_bank**: MCQ and debugging questions
- **test_questions**: Junction table linking tests to questions
- **mcq_options**: Multiple choice options with correct answer flags
- **debug_variants**: AI-generated buggy code variants
- **test_cases**: Input/output pairs for debugging questions (visible + hidden)
- **attempts**: Student test sessions with integrity tracking
- **variant_assignments**: Maps students to specific code variants
- **option_shuffle**: Stores MCQ option order per student
- **responses**: Student answers with behavioral metadata
- **results**: Computed scores, ranks, and integrity scores
- **similarity_flags**: Code similarity detection results

### Key Features

- **Row Level Security (RLS)**: Enforces role-based access at database level
- **Triggers**: Auto-compute integrity scores on result insert
- **Views**: Leaderboard, test analytics, question difficulty
- **Window Functions**: Rank calculation using `RANK() OVER (PARTITION BY ...)`

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Supabase account (or local Supabase CLI)
- Gemini API key (for variant generation)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/KrishnaSingh1881/TestForge.git
   cd TestForge
   ```

2. **Install dependencies**
   ```bash
   # Install client dependencies
   cd client
   npm install

   # Install server dependencies
   cd ../server
   npm install
   ```

3. **Configure environment variables**

   Create `client/.env`:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   Create `server/.env`:
   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key
   JWT_SECRET=your_jwt_secret
   GEMINI_API_KEY=your_gemini_api_key
   PORT=4000
   ```

4. **Set up database**
   ```bash
   # Run schema creation
   psql -h your_db_host -U postgres -d postgres -f server/schema.sql

   # Apply Row Level Security policies
   psql -h your_db_host -U postgres -d postgres -f server/rls.sql

   # (Optional) Load sample data
   psql -h your_db_host -U postgres -d postgres -f server/seed.sql
   ```

5. **Start development servers**
   ```bash
   # Terminal 1: Start backend
   cd server
   node index.js

   # Terminal 2: Start frontend
   cd client
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5174
   - Backend API: http://localhost:4000

### Sample Credentials (if using seed data)

**Admin**:
- Email: admin@testforge.com
- Password: admin123

**Students**:
- Email: student1@testforge.com through student5@testforge.com
- Password: student123

## User Workflows

### Student Workflow

1. **Login**: Enter credentials on the Lock Screen overlay
2. **Browse Tests**: Open Tests app from Dock to see available/upcoming tests
3. **Start Test**: Click "Start" → Review proctored start checklist → Begin
4. **Answer Questions**:
   - MCQ: Select options (shuffled per student)
   - Debugging: View buggy code, write fix in Monaco editor, run against test cases
5. **Submit**: Manual submit or auto-submit on timer expiry
6. **View Results**: Results app opens automatically showing score, rank, per-question breakdown
7. **Track Progress**: Open Analytics app to see performance trends

### Admin Workflow

1. **Login**: Admin credentials on Lock Screen
2. **Create Questions**:
   - Open Question Bank app
   - Add MCQ with options and correct answer
   - Add debugging question with correct code
   - Generate variants using Gemini AI
   - Review and approve variants (minimum 3 recommended)
3. **Create Test**:
   - Open Test Manager app
   - Set title, subject, duration, schedule (start/end time)
   - Attach questions from Question Bank
   - Configure question unlock timing
   - Set questions per attempt (randomized pool)
4. **Monitor Test**:
   - View live leaderboard during active test
   - Check completion rates and average scores
5. **Review Integrity**:
   - Open Integrity app for specific test
   - Sort by integrity score to find high-risk submissions
   - Expand student rows to see behavioral details
   - Review similarity report for flagged pairs
6. **Analyze Results**:
   - Open Admin Analytics app
   - Filter by year, division, subject, date range
   - Compare division performance
   - Identify hardest questions and actual difficulty distribution

## Debugging Question System

### How It Works

1. **Admin creates question**: Writes correct code + description of bug to introduce
2. **AI generates variants**: Gemini produces 5+ buggy versions with different:
   - Variable names
   - Function names
   - Code structure
   - Same underlying bug logic
3. **Admin reviews**: Side-by-side diff view, approves good variants
4. **Student assignment**: One variant randomly assigned per student when test starts
5. **Student workflow**:
   - Read buggy code (read-only panel, collapsible)
   - Write fix in editable Monaco editor
   - Run against visible test cases (limited runs, e.g. 10)
   - Submit when confident
6. **Evaluation**:
   - Visible test cases: shown during attempt
   - Hidden test cases: evaluated server-side only on submit
   - Score: `(passed_cases / total_cases) × question_marks`

### Why It's Cheat-Resistant

- Can't paste into ChatGPT and get instant solution (bug is unique to variant)
- Screenshots shared in group chats show different code (different variable names)
- Hidden test cases catch hardcoded outputs
- Behavioral tracking detects paste events and suspicious typing patterns
- Code similarity scoring flags copied solutions even with manual adjustments

## Integrity System

### Behavioral Signals Tracked

Per coding question:
- `time_to_first_keystroke`: Delay before typing starts
- `wpm_consistency`: Typing speed variance (detects paste events)
- `backspace_frequency`: Corrections and backtracking
- `edit_count`: Number of distinct edit sessions
- `test_runs_before_submit`: How many times code was tested
- `idle_periods`: Stretches of 3+ minutes with no activity
- `paste_events`: Direct paste detection

### Integrity Score Calculation

Starting at 100, deductions:
- Tab switch: -5 per event
- Focus lost: -2 per event
- Suspicious paste pattern: -10
- Zero backspaces on complex code: -5
- Idle period during coding: -3 per period
- Flagged by similarity scoring: -15

Score never goes below 0. Displayed to admin only, not students.

### Automatic Actions

- **3 tab switches**: Immediate auto-submit with integrity violation flag, score override to 0
- **Window locked during test**: Cannot drag, resize, minimize, or close test window until submit

## Code Execution

- **Execution API**: Piston (free, no API key required)
- **Supported Languages**: Python, C++, C, Java
- **Sandboxing**: Handled by Piston API
- **Run Limits**: Configurable per question (default: 10 runs)
- **Test Cases**: Visible (shown to student) + Hidden (honeypot, evaluated server-side only)
- **Results**: Per-case pass/fail with input, expected output, actual output, stderr

## Responsive Design

- **Desktop (≥1024px)**: Full windowed OS with drag/resize
- **Tablet (768-1023px)**: Fixed full-width panels, no drag/resize
- **Mobile (<768px)**: Bottom sheet style, one app at a time, dock becomes bottom nav bar

## Animation System

- **Framer Motion**: Window open/close/minimize/maximize, dock magnification
- **GSAP**: Lock screen entrance, wallpaper parallax, particle effects
- **Lenis**: Smooth scrolling inside window content
- **CSS Transitions**: Theme color changes (400ms)
- **Accessibility**: Respects `prefers-reduced-motion` (opacity-only transitions)

## Testing

### Run Tests

```bash
cd client
npm run test        # Run all tests
npm run test:ui     # Open Vitest UI
```

### Test Coverage

- Unit tests for OS store actions (Zustand)
- Component tests for window controls, dock icons, traffic lights
- Integration tests for login flow, test session, window locking
- Property-based tests for z-index uniqueness, window state consistency

## Deployment

### Frontend (Vercel/Netlify)

```bash
cd client
npm run build
# Deploy dist/ folder
```

Environment variables required:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Backend (Railway/Render/Heroku)

```bash
cd server
# Deploy with Node.js buildpack
```

Environment variables required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `PORT`

### Database (Supabase)

1. Create Supabase project
2. Run `schema.sql` in SQL editor
3. Run `rls.sql` to enable Row Level Security
4. Copy project URL and keys to environment variables

## Security Considerations

- **JWT Authentication**: All API endpoints protected with JWT middleware
- **Row Level Security**: Database-level access control per user role
- **Role-Based UI**: Apps filtered by user role (student/admin)
- **Code Execution Sandboxing**: Handled by Piston API, no local execution
- **Input Validation**: Server-side validation on all API endpoints
- **CORS**: Configured for specific origins only
- **Environment Variables**: Sensitive keys never committed to repository

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- **Monaco Editor**: VSCode's editor component
- **Piston API**: Free code execution service
- **Gemini AI**: Code variant generation
- **Supabase**: Backend infrastructure
- **Framer Motion**: Animation library

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Built with ❤️ for academic integrity and modern testing experiences**
