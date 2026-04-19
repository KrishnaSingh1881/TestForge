# Behavioral Tracking & Integrity Flags - Complete Implementation

## Overview
This document outlines the complete behavioral tracking system for TestForge, ensuring all flags are properly tracked, stored, and displayed for both admin and student views.

## Database Schema

### Tables Created
1. **behavioral_flags** - Stores individual integrity violations
2. **behavioral_details** - Stores detailed behavioral metrics per question

### Migration File
Run: `psql -h <host> -U <user> -d <db> -f server/migration_behavioral_tables.sql`

## Behavioral Metrics Tracked

### Per-Question Metrics (stored in `behavioral_meta` JSONB in `responses` table)
- `time_to_first_keystroke` - Time from question open to first keystroke (ms)
- `wpm_consistency` - Average words per minute typing speed
- `backspace_count` - Number of backspace/delete key presses
- `edit_count` - Number of distinct editing sessions
- `paste_events` - Number of paste operations detected
- `test_runs_before_submit` - Number of times code was executed (debugging questions)
- `idle_periods` - Array of idle periods: `[{ start: timestamp, duration_seconds: int }]`

### Attempt-Level Metrics (stored in `attempts` table)
- `tab_switches` - Number of times user switched tabs/windows
- `focus_lost_count` - Number of times window lost focus

## Flag Types & Severity

### HIGH Severity Flags
1. **paste** - Paste event detected (indicates potential cheating)
2. **fast_start** - Typed within 3 seconds of opening question (pre-typed answer)
3. **no_corrections** - No corrections at high WPM (pre-typed code)
4. **data_mismatch** - WPM inconsistent with code complexity

### MEDIUM Severity Flags
1. **high_wpm** - Extreme typing speed (>120 WPM)
2. **tab_switch** - Tab switches detected (2-4: medium, 5+: high)
3. **focus_loss** - Window focus lost multiple times (5+)
4. **long_idle** - Idle period >3 minutes detected
5. **no_test_run** - Submitted debugging code without running tests

## Integrity Score Calculation

Base score: 100

Deductions:
- High severity flag: -15 points each
- Medium severity flag: -7 points each
- Tab switch: -30 points each (MAX 3 allowed, auto-submit after 3rd)
- Focus lost: -2 points each
- Similarity flag (confirmed): -15 points

Minimum score: 0

## Client-Side Implementation

### Components Updated
1. **MCQQuestion.tsx** ✅
   - Tracks time_to_first_keystroke
   - Tracks edit_count (option changes)
   - Saves behavioral_meta with each response

2. **DebugQuestion.tsx** ✅
   - Uses `useBehavioralTracking` hook
   - Tracks all coding metrics (WPM, backspace, paste, etc.)
   - Tracks test_runs_before_submit
   - Saves behavioral_meta with each response

3. **TestSessionApp.tsx** ✅
   - Uses `useIntegrityListeners` hook
   - Tracks tab switches and focus loss
   - Updates attempt table via `/attempts/:id/integrity` endpoint
   - Shows live integrity score with deductions

### Hooks
1. **useBehavioralTracking.ts** ✅
   - Monitors Monaco editor events
   - Calculates WPM in real-time
   - Detects paste events
   - Tracks idle periods
   - Returns meta object for saving

2. **useIntegrityListeners.ts** ✅
   - Listens for visibility change (tab switch)
   - Listens for window blur (focus loss)
   - Reports to server immediately
   - Debounced to prevent spam

## Server-Side Implementation

### Routes Updated

#### `/attempts/:id/integrity` (PATCH) ✅
- Increments `tab_switches` or `focus_lost_count`
- Returns updated count
- Triggers attempt-level flag generation

#### `/attempts/:id/responses` (POST) ✅
- Accepts `behavioral_meta` in request body
- Stores in `responses.behavioral_meta` (JSONB)
- Triggers auto-generation of behavioral flags via database trigger

#### `/attempts/:id/submit` (POST) ✅
- Evaluates all responses
- Computes integrity score (via trigger)
- Includes behavioral flags in score calculation

#### `/admin/tests/:id/integrity` (GET) ✅
- Returns all attempts with behavioral flags
- Computes flags from behavioral_meta
- Returns behavioral_detail for each question
- Includes summary statistics

#### `/attempts/test/:testId/integrity/me` (GET) ✅
- Student endpoint to view their own integrity data
- Returns behavioral_flags and behavioral_details
- Shows integrity score and breakdown

### Database Triggers

#### `auto_generate_behavioral_flags()` ✅
- Triggered on INSERT/UPDATE of `responses.behavioral_meta`
- Analyzes behavioral_meta JSONB
- Generates appropriate flags based on thresholds
- Inserts into `behavioral_flags` table
- Upserts into `behavioral_details` table

#### `auto_generate_attempt_level_flags()` ✅
- Triggered on UPDATE of `attempts.tab_switches` or `focus_lost_count`
- Generates tab_switch and focus_loss flags
- Inserts into `behavioral_flags` table

#### `compute_integrity_score()` (UPDATED) ✅
- Triggered on INSERT into `results` table
- Counts high and medium severity flags
- Includes flag counts in integrity score calculation
- Ensures comprehensive scoring

## Admin View Features

### AdminIntegrityApp.tsx ✅
1. **Test List View**
   - Shows all tests with integrity monitoring

2. **Student List View**
   - Shows all students with integrity scores
   - Color-coded risk levels (green/yellow/red)
   - Shows flag counts (high/medium)
   - Shows similarity flag indicators
   - Sortable by integrity score, flags, name

3. **Audit Panel** (AttemptAuditPanel.tsx)
   - Shows all behavioral flags with severity
   - Shows per-question behavioral details
   - Shows coding analysis metrics
   - Shows idle periods
   - Shows session metrics (tab switches, focus loss)

## Student View Features

### StudentIntegrityApp.tsx ✅
1. **Test List**
   - Shows all completed tests
   - Click to view integrity details

2. **Integrity Detail View**
   - Shows all behavioral flags raised
   - Shows "No Flags Detected" if clean
   - Shows coding analysis per question
   - Shows idle gaps
   - Shows session metrics

## Testing Checklist

### Database Setup
- [ ] Run migration: `server/migration_behavioral_tables.sql`
- [ ] Verify tables created: `behavioral_flags`, `behavioral_details`
- [ ] Verify triggers created
- [ ] Verify RLS policies applied

### Client Testing
- [ ] MCQ questions save behavioral_meta
- [ ] Debug questions track all metrics
- [ ] Tab switches are detected and reported
- [ ] Focus loss is detected and reported
- [ ] Live integrity score updates in real-time

### Server Testing
- [ ] `/attempts/:id/integrity` increments counters
- [ ] `/attempts/:id/responses` accepts behavioral_meta
- [ ] Triggers generate flags automatically
- [ ] Integrity score includes flag deductions
- [ ] Admin can view all flags
- [ ] Students can view their own flags

### UI Testing
- [ ] Admin sees all students with risk levels
- [ ] Admin can drill down to individual audit
- [ ] Student sees their own integrity reports
- [ ] Flags are displayed with correct severity
- [ ] Metrics are displayed accurately

## Seed Data

Run `node --env-file=.env server/seed_behavioral.js` to populate test data with realistic behavioral patterns:
- **Cheaters**: High paste events, fast start, no corrections
- **Suspicious**: Some paste events, moderate flags
- **Normal**: Realistic typing patterns, few flags
- **Idle**: Long idle periods, low engagement

## API Endpoints Summary

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/attempts/:id/integrity` | PATCH | Update tab switches / focus loss | Student |
| `/attempts/:id/responses` | POST | Save response with behavioral_meta | Student |
| `/attempts/test/:testId/integrity/me` | GET | Get own integrity data | Student |
| `/admin/tests/:id/integrity` | GET | Get all student integrity data | Admin |

## Integrity Score Thresholds

- **90-100**: Clean (Green) - No significant issues
- **70-89**: Low Risk (Yellow) - Minor flags
- **0-69**: High Risk (Red) - Multiple serious flags

## Next Steps

1. Run the migration SQL file
2. Test with real student attempts
3. Verify flags are generated correctly
4. Adjust thresholds if needed
5. Monitor false positive rates
6. Add admin tools to dismiss/confirm flags
