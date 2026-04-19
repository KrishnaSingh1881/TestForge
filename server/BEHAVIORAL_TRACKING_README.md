# Behavioral Tracking & Integrity System

## Quick Start

### 1. Run Migration
```bash
# Option A: Using Supabase SQL Editor (Recommended)
# Copy contents of migration_behavioral_tables.sql and run in SQL Editor

# Option B: Using psql
psql 'postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres' \
  -f migration_behavioral_tables.sql
```

### 2. Verify Setup
```bash
node --env-file=.env verify_behavioral_setup.js
```

### 3. Seed Test Data (Optional)
```bash
node --env-file=.env seed_behavioral.js
```

## System Overview

The behavioral tracking system monitors student behavior during tests to detect potential academic dishonesty. It tracks both **coding behavior** (typing patterns, paste events) and **session behavior** (tab switches, focus loss).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT SIDE                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  MCQQuestion     │         │  DebugQuestion   │         │
│  │  Component       │         │  Component       │         │
│  └────────┬─────────┘         └────────┬─────────┘         │
│           │                            │                    │
│           │ Tracks:                    │ Tracks:            │
│           │ • Time to first click      │ • WPM              │
│           │ • Edit count               │ • Paste events     │
│           │                            │ • Backspace count  │
│           │                            │ • Test runs        │
│           │                            │ • Idle periods     │
│           │                            │                    │
│           └────────────┬───────────────┘                    │
│                        │                                     │
│                        ▼                                     │
│           POST /attempts/:id/responses                      │
│           { behavioral_meta: {...} }                        │
│                                                              │
│  ┌──────────────────────────────────────────────┐          │
│  │  useIntegrityListeners Hook                  │          │
│  │  • Detects tab switches                      │          │
│  │  • Detects focus loss                        │          │
│  └────────────────────┬─────────────────────────┘          │
│                       │                                     │
│                       ▼                                     │
│           PATCH /attempts/:id/integrity                    │
│           { event: 'tab_switch' | 'focus_lost' }           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVER SIDE                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────┐          │
│  │  Routes                                       │          │
│  │  • POST /attempts/:id/responses               │          │
│  │    → Saves behavioral_meta to responses table │          │
│  │  • PATCH /attempts/:id/integrity              │          │
│  │    → Increments tab_switches/focus_lost_count │          │
│  └────────────────────┬─────────────────────────┘          │
│                       │                                     │
│                       ▼                                     │
│  ┌──────────────────────────────────────────────┐          │
│  │  Database Triggers                            │          │
│  │  • auto_generate_behavioral_flags()           │          │
│  │    → Analyzes behavioral_meta                 │          │
│  │    → Generates flags based on thresholds      │          │
│  │    → Inserts into behavioral_flags            │          │
│  │    → Upserts into behavioral_details          │          │
│  │                                                │          │
│  │  • auto_generate_attempt_level_flags()        │          │
│  │    → Generates tab_switch/focus_loss flags    │          │
│  │                                                │          │
│  │  • compute_integrity_score()                  │          │
│  │    → Counts flags by severity                 │          │
│  │    → Calculates final integrity score         │          │
│  └───────────────────────────────────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN VIEW                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GET /admin/tests/:id/integrity                             │
│  → Returns all attempts with:                               │
│    • behavioral_flags (type, severity, label)               │
│    • behavioral_detail (per-question metrics)               │
│    • integrity_score                                        │
│    • summary statistics                                     │
│                                                              │
│  AdminIntegrityApp displays:                                │
│  • Risk-coded student list (red/yellow/green)               │
│  • Flag counts and types                                    │
│  • Detailed audit panel per student                         │
│  • Coding analysis metrics                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     STUDENT VIEW                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GET /attempts/test/:testId/integrity/me                    │
│  → Returns own integrity data:                              │
│    • behavioral_flags                                       │
│    • behavioral_details                                     │
│    • integrity_score                                        │
│                                                              │
│  StudentIntegrityApp displays:                              │
│  • List of completed tests                                  │
│  • Flags raised (if any)                                    │
│  • Coding analysis breakdown                                │
│  • Session metrics                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Flag Types & Thresholds

### HIGH Severity (−15 points each)
| Flag Type | Threshold | Description |
|-----------|-----------|-------------|
| `paste` | ≥1 paste event | Paste operation detected in code editor |
| `fast_start` | <3 seconds | Typed within 3s of opening question |
| `no_corrections` | ≤2 backspaces AND >100 WPM | No corrections at high speed (pre-typed) |
| `data_mismatch` | Manual flag | WPM inconsistent with code complexity |

### MEDIUM Severity (−7 points each)
| Flag Type | Threshold | Description |
|-----------|-----------|-------------|
| `high_wpm` | >120 WPM | Extreme typing speed |
| `tab_switch` | 1-2 switches | Tab/window switches detected (3rd switch triggers auto-submit) |
| `focus_loss` | ≥5 times | Window focus lost multiple times |
| `long_idle` | >180 seconds | Idle period exceeding 3 minutes |
| `no_test_run` | 0 runs | Submitted code without running tests |

### Attempt-Level Deductions
- Tab switch: −30 points each (MAX 3 allowed, auto-submit after 3rd)
- Focus lost: −2 points each
- Similarity flag (confirmed): −15 points

### Attempt-Level Deductions
- Tab switch: −30 points each (MAX 3 allowed, auto-submit after 3rd)
- Focus lost: −2 points each
- Similarity flag (confirmed): −15 points

## Database Schema

### behavioral_flags
```sql
CREATE TABLE behavioral_flags (
  id           uuid PRIMARY KEY,
  attempt_id   uuid REFERENCES attempts(id),
  question_id  uuid REFERENCES question_bank(id),  -- NULL for attempt-level flags
  type         text NOT NULL,
  label        text NOT NULL,
  severity     text CHECK (severity IN ('low', 'medium', 'high')),
  flagged_at   timestamp DEFAULT now()
);
```

### behavioral_details
```sql
CREATE TABLE behavioral_details (
  id                       uuid PRIMARY KEY,
  attempt_id               uuid REFERENCES attempts(id),
  question_id              uuid REFERENCES question_bank(id),
  time_to_first_keystroke  int,      -- milliseconds
  paste_events             int,
  backspace_count          int,
  edit_count               int,
  wpm_consistency          int,      -- average WPM
  test_runs_before_submit  int,
  idle_periods             jsonb,    -- [{ start, duration_seconds }]
  UNIQUE(attempt_id, question_id)
);
```

## API Endpoints

### Student Endpoints

#### Save Response with Behavioral Data
```http
POST /attempts/:attemptId/responses
Content-Type: application/json

{
  "question_id": "uuid",
  "selected_option_ids": ["uuid"],  // for MCQ
  "submitted_code": "string",       // for debugging
  "language": "python",
  "time_spent_seconds": 120,
  "behavioral_meta": {
    "time_to_first_keystroke": 5000,
    "wpm_consistency": 45,
    "backspace_count": 23,
    "edit_count": 8,
    "paste_events": 0,
    "test_runs_before_submit": 3,
    "idle_periods": [
      { "start": "2024-01-01T10:05:00Z", "duration_seconds": 45 }
    ]
  }
}
```

#### Report Integrity Event
```http
PATCH /attempts/:attemptId/integrity
Content-Type: application/json

{
  "event": "tab_switch"  // or "focus_lost"
}

Response:
{
  "ok": true,
  "tab_switches": 3  // or "focus_lost_count": 5
}
```

#### Get Own Integrity Data
```http
GET /attempts/test/:testId/integrity/me

Response:
{
  "attempt_id": "uuid",
  "tab_switches": 2,
  "focus_lost_count": 3,
  "integrity_score": 85,
  "behavioral_flags": [
    {
      "type": "high_wpm",
      "label": "Extreme typing speed (143 WPM)",
      "severity": "medium",
      "question_id": "uuid"
    }
  ],
  "behavioral_detail": [
    {
      "question_id": "uuid",
      "time_to_first_keystroke": 8500,
      "wpm_consistency": 143,
      "paste_events": 0,
      "backspace_count": 15,
      "edit_count": 5,
      "test_runs_before_submit": 2
    }
  ]
}
```

### Admin Endpoints

#### Get Test Integrity Overview
```http
GET /admin/tests/:testId/integrity

Response:
{
  "test_title": "Midterm Exam",
  "attempts": [
    {
      "attempt_id": "uuid",
      "student_name": "John Doe",
      "student_email": "john@example.com",
      "integrity_score": 45,
      "tab_switches": 8,
      "focus_lost_count": 12,
      "behavioral_flags": [
        {
          "type": "paste",
          "severity": "high",
          "label": "Paste event detected (3×)",
          "question_id": "uuid"
        }
      ],
      "behavioral_detail": [...]
    }
  ],
  "summary": {
    "total": 25,
    "avg_integrity": 78,
    "high_risk": 3,
    "similarity_flags": 2
  }
}
```

## Client-Side Hooks

### useBehavioralTracking
```typescript
const { meta, onKeyDown, onPaste, onRunCode } = useBehavioralTracking(questionOpenTime);

// Attach to Monaco editor
editor.onKeyDown(onKeyDown);
editor.onDidPaste(onPaste);

// Call when running code
onRunCode();

// meta object contains all tracked metrics
console.log(meta);
// {
//   time_to_first_keystroke: 5000,
//   wpm_consistency: 45,
//   backspace_count: 23,
//   edit_count: 8,
//   paste_events: 0,
//   test_runs_before_submit: 3,
//   idle_periods: [...]
// }
```

### useIntegrityListeners
```typescript
useIntegrityListeners({
  attemptId: 'uuid',
  active: true,
  onEvent: (msg) => showToast(msg),
  onTabSwitchCount: (count) => updateLiveIntegrity(count)
});

// Automatically detects and reports:
// - Tab switches (visibilitychange event)
// - Focus loss (blur event)
```

## Testing

### 1. Verify Setup
```bash
node --env-file=.env verify_behavioral_setup.js
```

Expected output:
```
✓ behavioral_flags table exists
✓ behavioral_details table exists
✓ responses.behavioral_meta column exists
✓ attempts integrity columns exist
✅ All checks passed!
```

### 2. Seed Test Data
```bash
node --env-file=.env seed_behavioral.js
```

This creates realistic behavioral patterns:
- **Cheaters** (rohan, tanvir): Paste events, fast start, no corrections
- **Suspicious** (arjun, karan): Some paste events
- **Normal** (priya, sneha, ananya, meera): Realistic patterns
- **Idle** (vikram, divya): Long idle periods

### 3. Manual Testing

#### Test MCQ Tracking
1. Start a test with MCQ questions
2. Open browser DevTools → Network tab
3. Select an option
4. Verify POST to `/attempts/:id/responses` includes `behavioral_meta`
5. Check `time_to_first_keystroke` and `edit_count`

#### Test Debug Tracking
1. Start a test with debugging questions
2. Type in the code editor
3. Paste some code (Ctrl+V)
4. Run the code
5. Submit response
6. Verify `behavioral_meta` includes:
   - `wpm_consistency` > 0
   - `paste_events` = 1
   - `backspace_count` > 0
   - `test_runs_before_submit` > 0

#### Test Integrity Tracking
1. During a test, switch to another tab
2. Check Network tab for PATCH to `/attempts/:id/integrity`
3. Verify `tab_switches` increments
4. Switch back and blur the window
5. Verify `focus_lost_count` increments

#### Test Admin View
1. Login as admin
2. Open Integrity Monitor app
3. Select a test
4. Verify students are color-coded by risk
5. Click a student to view audit panel
6. Verify flags are displayed with severity
7. Verify coding analysis shows metrics

#### Test Student View
1. Login as student
2. Complete a test
3. Open "My Integrity" app
4. Select the completed test
5. Verify flags are displayed (if any)
6. Verify coding analysis shows metrics
7. Verify session metrics are accurate

## Troubleshooting

### Tables Don't Exist
```bash
# Run migration again
psql <connection-string> -f migration_behavioral_tables.sql
```

### Flags Not Generated
```sql
-- Check if trigger exists
SELECT tgname FROM pg_trigger WHERE tgname LIKE '%behavioral%';

-- Check if responses have behavioral_meta
SELECT id, behavioral_meta FROM responses WHERE behavioral_meta IS NOT NULL LIMIT 5;

-- Manually trigger flag generation
UPDATE responses SET behavioral_meta = behavioral_meta WHERE id = 'some-uuid';
```

### Integrity Score Not Updating
```sql
-- Check if compute_integrity_score trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_integrity_score';

-- Manually recompute
UPDATE results SET integrity_score = integrity_score WHERE attempt_id = 'some-uuid';
```

### RLS Blocking Access
```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname FROM pg_policies 
WHERE tablename IN ('behavioral_flags', 'behavioral_details');

-- Temporarily disable RLS for testing (NOT for production)
ALTER TABLE behavioral_flags DISABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_details DISABLE ROW LEVEL SECURITY;
```

## Performance Considerations

### Indexing
The migration creates indexes on:
- `behavioral_flags.attempt_id`
- `behavioral_flags.severity`
- `behavioral_details.attempt_id`

### Query Optimization
- Flags are computed via triggers (no runtime overhead)
- Admin queries use JOINs to fetch all data in one request
- Student queries are filtered by RLS (automatic)

### Scaling
- Behavioral data is append-only (no updates after submission)
- Flags can be archived after test ends
- Consider partitioning by test_id for large deployments

## Security

### Row Level Security (RLS)
- **Admins**: Can see all behavioral data
- **Students**: Can only see their own data
- **Service role**: Bypasses RLS for triggers

### Data Privacy
- Behavioral data is sensitive
- Only store what's necessary for integrity
- Consider GDPR/privacy regulations
- Provide data export for students

### False Positives
- High WPM may be legitimate for experienced typists
- Paste events may be from own notes
- Tab switches may be accidental
- **Always allow manual review by admin**

## Future Enhancements

### Planned Features
- [ ] Admin tools to dismiss/confirm flags
- [ ] Similarity detection integration
- [ ] Machine learning for anomaly detection
- [ ] Real-time alerts for admins
- [ ] Behavioral pattern visualization
- [ ] Export integrity reports (PDF)
- [ ] Configurable thresholds per test
- [ ] Webcam/screen recording integration

### Experimental Features
- [ ] Keystroke dynamics (typing rhythm)
- [ ] Mouse movement tracking
- [ ] Code evolution timeline
- [ ] Collaboration detection
- [ ] External resource detection

## Support

For issues or questions:
1. Check this README
2. Run `verify_behavioral_setup.js`
3. Check server logs
4. Review Supabase logs
5. Open an issue on GitHub

## License

Part of TestForge - Academic Integrity Platform
