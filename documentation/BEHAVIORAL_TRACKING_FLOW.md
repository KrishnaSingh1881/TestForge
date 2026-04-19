# Behavioral Tracking System - Flow Diagram

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          STUDENT TAKES TEST                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │   MCQ Question        │       │  Debugging Question   │
        │                       │       │                       │
        │  Tracks:              │       │  Tracks:              │
        │  • Time to 1st click  │       │  • WPM                │
        │  • Edit count         │       │  • Paste events       │
        │                       │       │  • Backspace count    │
        │                       │       │  • Test runs          │
        │                       │       │  • Idle periods       │
        └───────────┬───────────┘       └───────────┬───────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  POST /attempts/:id/responses │
                    │                               │
                    │  {                            │
                    │    question_id: "uuid",       │
                    │    submitted_code: "...",     │
                    │    behavioral_meta: {         │
                    │      wpm_consistency: 45,     │
                    │      paste_events: 0,         │
                    │      backspace_count: 23,     │
                    │      ...                      │
                    │    }                          │
                    │  }                            │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  responses table              │
                    │  ┌─────────────────────────┐  │
                    │  │ id                      │  │
                    │  │ attempt_id              │  │
                    │  │ question_id             │  │
                    │  │ submitted_code          │  │
                    │  │ behavioral_meta (JSONB) │◄─┼─── Stored here
                    │  └─────────────────────────┘  │
                    └───────────────┬───────────────┘
                                    │
                                    │ Trigger: auto_generate_behavioral_flags()
                                    │
                    ┌───────────────▼───────────────┐
                    │  Analyze behavioral_meta      │
                    │                               │
                    │  IF paste_events >= 1:        │
                    │    → HIGH: "Paste detected"   │
                    │                               │
                    │  IF time_to_first < 3000:     │
                    │    → HIGH: "Fast start"       │
                    │                               │
                    │  IF wpm > 120:                │
                    │    → MEDIUM: "High WPM"       │
                    │                               │
                    │  IF test_runs == 0:           │
                    │    → MEDIUM: "No test run"    │
                    │                               │
                    │  ... (more checks)            │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │  behavioral_flags     │       │  behavioral_details   │
        │  ┌─────────────────┐  │       │  ┌─────────────────┐  │
        │  │ attempt_id      │  │       │  │ attempt_id      │  │
        │  │ question_id     │  │       │  │ question_id     │  │
        │  │ type: "paste"   │  │       │  │ wpm: 45         │  │
        │  │ severity: "high"│  │       │  │ paste_events: 0 │  │
        │  │ label: "..."    │  │       │  │ backspace: 23   │  │
        │  └─────────────────┘  │       │  │ ...             │  │
        └───────────────────────┘       │  └─────────────────┘  │
                                        └───────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                    INTEGRITY EVENT TRACKING                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │  Tab Switch Detected  │       │  Focus Loss Detected  │
        │  (visibilitychange)   │       │  (window blur)        │
        └───────────┬───────────┘       └───────────┬───────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ PATCH /attempts/:id/integrity │
                    │                               │
                    │ {                             │
                    │   event: "tab_switch"         │
                    │ }                             │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  attempts table               │
                    │  ┌─────────────────────────┐  │
                    │  │ id                      │  │
                    │  │ tab_switches++          │◄─┼─── Incremented
                    │  │ focus_lost_count++      │  │
                    │  └─────────────────────────┘  │
                    └───────────────┬───────────────┘
                                    │
                                    │ Trigger: auto_generate_attempt_level_flags()
                                    │
                    ┌───────────────▼───────────────┐
                    │  Generate attempt-level flags │
                    │                               │
                    │  IF tab_switches >= 5:        │
                    │    → HIGH: "Excessive tabs"   │
                    │  ELSE IF tab_switches >= 2:   │
                    │    → MEDIUM: "Tab switches"   │
                    │                               │
                    │  IF focus_lost >= 5:          │
                    │    → MEDIUM: "Focus loss"     │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  behavioral_flags             │
                    │  ┌─────────────────────────┐  │
                    │  │ attempt_id              │  │
                    │  │ question_id: NULL       │◄─┼─── Attempt-level
                    │  │ type: "tab_switch"      │  │
                    │  │ severity: "high"        │  │
                    │  └─────────────────────────┘  │
                    └───────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                         TEST SUBMISSION                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  POST /attempts/:id/submit    │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Evaluate all responses       │
                    │  Calculate total score        │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  INSERT INTO results          │
                    │  ┌─────────────────────────┐  │
                    │  │ attempt_id              │  │
                    │  │ total_score             │  │
                    │  │ percentage              │  │
                    │  │ integrity_score: NULL   │◄─┼─── Computed by trigger
                    │  └─────────────────────────┘  │
                    └───────────────┬───────────────┘
                                    │
                                    │ Trigger: compute_integrity_score()
                                    │
                    ┌───────────────▼───────────────┐
                    │  Calculate Integrity Score    │
                    │                               │
                    │  Base: 100                    │
                    │                               │
                    │  Count flags:                 │
                    │  • High severity: 3 flags     │
                    │  • Medium severity: 2 flags   │
                    │                               │
                    │  Get attempt metrics:         │
                    │  • Tab switches: 5            │
                    │  • Focus lost: 3              │
                    │                               │
                    │  Calculate:                   │
                    │  100 - (3×15) - (2×7)         │
                    │      - (5×5) - (3×2)          │
                    │  = 100 - 45 - 14 - 25 - 6     │
                    │  = 10                         │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  results table                │
                    │  ┌─────────────────────────┐  │
                    │  │ integrity_score: 10     │◄─┼─── Updated
                    │  └─────────────────────────┘  │
                    └───────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                          ADMIN VIEW                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ GET /admin/tests/:id/integrity│
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │  Fetch all attempts           │
                    │  JOIN results                 │
                    │  JOIN behavioral_flags        │
                    │  JOIN behavioral_details      │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Return enriched data:        │
                    │                               │
                    │  {                            │
                    │    attempts: [                │
                    │      {                        │
                    │        student_name: "...",   │
                    │        integrity_score: 10,   │
                    │        behavioral_flags: [    │
                    │          {                    │
                    │            type: "paste",     │
                    │            severity: "high",  │
                    │            label: "..."       │
                    │          }                    │
                    │        ],                     │
                    │        behavioral_detail: [   │
                    │          {                    │
                    │            wpm: 45,           │
                    │            paste_events: 0    │
                    │          }                    │
                    │        ]                      │
                    │      }                        │
                    │    ]                          │
                    │  }                            │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  AdminIntegrityApp.tsx        │
                    │                               │
                    │  Displays:                    │
                    │  • Student list (color-coded) │
                    │  • Risk levels (🔴🟡🟢)       │
                    │  • Flag counts                │
                    │  • Detailed audit panel       │
                    │  • Coding analysis            │
                    │  • Session metrics            │
                    └───────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                         STUDENT VIEW                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ GET /attempts/test/:id/       │
                    │     integrity/me              │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │  Fetch own attempt            │
                    │  JOIN behavioral_flags        │
                    │  JOIN behavioral_details      │
                    │  WHERE user_id = current_user │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Return own data:             │
                    │                               │
                    │  {                            │
                    │    integrity_score: 85,       │
                    │    tab_switches: 2,           │
                    │    focus_lost_count: 1,       │
                    │    behavioral_flags: [        │
                    │      {                        │
                    │        type: "high_wpm",      │
                    │        severity: "medium",    │
                    │        label: "..."           │
                    │      }                        │
                    │    ],                         │
                    │    behavioral_detail: [...]   │
                    │  }                            │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  StudentIntegrityApp.tsx      │
                    │                               │
                    │  Displays:                    │
                    │  • Test list                  │
                    │  • Own flags (if any)         │
                    │  • Coding analysis            │
                    │  • Session metrics            │
                    │  • Transparency report        │
                    └───────────────────────────────┘
```

## Key Points

### 1. Automatic Flag Generation
- Flags are generated **automatically** by database triggers
- No manual intervention needed
- Happens in real-time as responses are saved

### 2. Two Types of Flags
- **Question-level flags**: Generated from `behavioral_meta` in responses
- **Attempt-level flags**: Generated from `tab_switches` and `focus_lost_count`

### 3. Integrity Score Calculation
- Computed automatically when result is inserted
- Includes all flag types and severities
- Minimum score is 0, maximum is 100

### 4. Data Flow
1. Student behavior → Client tracking
2. Client → Server API
3. Server → Database (responses/attempts tables)
4. Database triggers → Generate flags
5. Flags → Calculate integrity score
6. Admin/Student → View results

### 5. Security
- Row Level Security (RLS) enforced
- Admins see all data
- Students see only their own data
- Service role bypasses RLS for triggers

## Flag Severity Impact

```
HIGH Severity Flag (−15 points)
├─ paste: Paste event detected
├─ fast_start: Typed within 3s
├─ no_corrections: No backspace at high WPM
└─ data_mismatch: WPM vs complexity mismatch

MEDIUM Severity Flag (−7 points)
├─ high_wpm: >120 WPM
├─ tab_switch: 2-4 switches
├─ focus_loss: ≥5 times
├─ long_idle: >3 minutes
└─ no_test_run: Submitted without testing

Attempt-Level Deductions
├─ Tab switch: −30 points each (MAX 3, auto-submit after 3rd)
├─ Focus lost: −2 points each
└─ Similarity flag: −15 points
```

## Example Calculation

```
Student: John Doe
Test: Midterm Exam

Behavioral Data:
├─ Question 1 (MCQ)
│  └─ time_to_first_click: 12000ms ✓
│
├─ Question 2 (Debug)
│  ├─ wpm_consistency: 143
│  ├─ paste_events: 1
│  ├─ backspace_count: 2
│  ├─ test_runs: 0
│  └─ time_to_first_keystroke: 2500ms
│
└─ Attempt Level
   ├─ tab_switches: 5
   └─ focus_lost_count: 3

Generated Flags:
├─ HIGH: Paste event detected (Q2)
├─ HIGH: Typed within 3s (Q2)
├─ HIGH: No corrections at high WPM (Q2)
├─ HIGH: Excessive tab switches (5×)
├─ MEDIUM: Extreme typing speed (143 WPM) (Q2)
└─ MEDIUM: Submitted without running tests (Q2)

Integrity Score Calculation:
Base:                    100
High flags (4 × −15):    −60
Medium flags (2 × −7):   −14
Tab switches (3 × −30):  −90
Focus lost (3 × −2):     −6
                        ────
Final Score:              −70 → 0 (minimum)

Result: 🚨 CRITICAL RISK (Auto-submitted at 3rd tab switch)
```

## Summary

This system provides:
✅ **Automatic tracking** - No manual work required
✅ **Real-time detection** - Flags generated immediately
✅ **Comprehensive metrics** - 10+ behavioral indicators
✅ **Fair scoring** - Weighted by severity
✅ **Transparency** - Students can see their own data
✅ **Admin oversight** - Complete visibility for admins
✅ **Secure** - RLS ensures proper access control
