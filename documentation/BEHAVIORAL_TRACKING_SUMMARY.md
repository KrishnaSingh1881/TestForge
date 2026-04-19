# Behavioral Tracking Implementation - Summary

## What Was Done

I've created a comprehensive behavioral tracking and integrity flagging system for TestForge that ensures **all behavioral metrics and flags are properly tracked, stored, and displayed** for both admin and student views.

## Files Created

### 1. Database Migration
- **`server/migration_behavioral_tables.sql`** - Complete database schema for behavioral tracking
  - Creates `behavioral_flags` table (stores individual integrity violations)
  - Creates `behavioral_details` table (stores detailed metrics per question)
  - Creates database triggers to auto-generate flags
  - Updates integrity score calculation to include flags
  - Sets up Row Level Security (RLS) policies

### 2. Setup & Verification Scripts
- **`server/setup_behavioral_tracking.sh`** - Bash script to guide setup process
- **`server/verify_behavioral_setup.js`** - Node.js script to verify everything is working

### 3. Documentation
- **`BEHAVIORAL_TRACKING_IMPLEMENTATION.md`** - Complete implementation guide
- **`server/BEHAVIORAL_TRACKING_README.md`** - Comprehensive technical documentation
- **`BEHAVIORAL_TRACKING_SUMMARY.md`** - This file

## How It Works

### Client-Side (Already Implemented ✅)
Your existing code already tracks behavioral data:

1. **MCQQuestion.tsx** - Tracks:
   - Time to first click
   - Edit count (option changes)
   - Saves `behavioral_meta` with each response

2. **DebugQuestion.tsx** - Tracks:
   - WPM (words per minute)
   - Paste events
   - Backspace count
   - Edit count
   - Test runs before submit
   - Idle periods
   - Saves `behavioral_meta` with each response

3. **useIntegrityListeners hook** - Tracks:
   - Tab switches (visibility change)
   - Focus loss (window blur)
   - Reports to server immediately

### Server-Side (Needs Migration)
The migration adds:

1. **Database Tables**
   - `behavioral_flags` - Stores flags like "paste detected", "fast start", etc.
   - `behavioral_details` - Stores detailed metrics per question

2. **Automatic Flag Generation**
   - Triggers analyze `behavioral_meta` from responses
   - Generate flags based on thresholds (e.g., paste events, high WPM)
   - Update integrity scores automatically

3. **API Endpoints** (Already exist, just need tables)
   - `/attempts/:id/integrity` - Updates tab switches/focus loss
   - `/attempts/:id/responses` - Saves behavioral_meta
   - `/admin/tests/:id/integrity` - Returns all flags for admin
   - `/attempts/test/:testId/integrity/me` - Returns own flags for student

### Admin View (Already Implemented ✅)
Your existing `AdminIntegrityApp.tsx` already displays:
- Student list with risk levels (red/yellow/green)
- Flag counts and severity
- Detailed audit panel
- Coding analysis metrics

### Student View (Already Implemented ✅)
Your existing `StudentIntegrityApp.tsx` already displays:
- List of completed tests
- Flags raised (if any)
- Coding analysis breakdown
- Session metrics

## What You Need to Do

### Step 1: Run the Migration
```bash
# Option A: Using Supabase SQL Editor (Recommended)
# 1. Open Supabase Dashboard → SQL Editor
# 2. Copy contents of server/migration_behavioral_tables.sql
# 3. Click "Run"

# Option B: Using psql
psql 'postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres' \
  -f server/migration_behavioral_tables.sql
```

### Step 2: Verify Setup
```bash
cd server
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

### Step 3: Seed Test Data (Optional)
```bash
node --env-file=.env seed_behavioral.js
```

This creates realistic test data with different behavioral patterns:
- **Cheaters**: Paste events, fast start, no corrections
- **Suspicious**: Some paste events
- **Normal**: Realistic typing patterns
- **Idle**: Long idle periods

### Step 4: Test the System

1. **Test as Student**:
   - Start a test
   - Answer MCQ questions (watch for time tracking)
   - Answer debugging questions (type, paste, run code)
   - Switch tabs (should trigger warning)
   - Submit test
   - Open "My Integrity" app to see flags

2. **Test as Admin**:
   - Open "Integrity Monitor" app
   - Select a test
   - View student list (should be color-coded)
   - Click a student to see detailed audit
   - Verify flags are displayed with severity
   - Verify coding analysis shows metrics

## Flag Types Generated

### HIGH Severity (−15 points each)
- **Paste Event** - Paste operation detected in code editor
- **Fast Start** - Typed within 3 seconds of opening question
- **No Corrections** - No backspaces at high WPM (pre-typed code)

### MEDIUM Severity (−7 points each)
- **High WPM** - Typing speed >120 WPM
- **Tab Switch** - 2-4 tab switches (5+ becomes HIGH)
- **Focus Loss** - Window focus lost 5+ times
- **Long Idle** - Idle period >3 minutes
- **No Test Run** - Submitted code without running tests

## Integrity Score Calculation

```
Base Score: 100

Deductions:
- High severity flag: −15 points each
- Medium severity flag: −7 points each
- Tab switch: −5 points each
- Focus lost: −2 points each
- Similarity flag: −15 points

Minimum: 0
```

## Example Scenarios

### Scenario 1: Clean Student
```
Metrics:
- WPM: 45
- Backspace count: 23
- Paste events: 0
- Tab switches: 0
- Test runs: 3

Flags: None
Integrity Score: 100 ✅
```

### Scenario 2: Suspicious Student
```
Metrics:
- WPM: 143
- Backspace count: 2
- Paste events: 1
- Tab switches: 2
- Test runs: 0

Flags:
- HIGH: Paste event detected (1×)
- MEDIUM: Extreme typing speed (143 WPM)
- MEDIUM: Tab switches detected (2×)
- MEDIUM: Submitted without running tests

Integrity Score: 100 - 15 - 7 - 7 - 7 - 60 = 4 ⚠️
```

### Scenario 3: Cheater (Auto-Submitted)
```
Metrics:
- WPM: 180
- Backspace count: 0
- Paste events: 3
- Tab switches: 3 (LIMIT REACHED - AUTO-SUBMITTED)
- Test runs: 0
- Time to first keystroke: 2 seconds

Flags:
- HIGH: Paste event detected (3×)
- HIGH: Typed within 3s of opening question
- HIGH: No corrections at high WPM
- HIGH: Tab switch limit reached (3×)
- MEDIUM: Extreme typing speed (180 WPM)
- MEDIUM: Submitted without running tests

Integrity Score: 100 - 15 - 15 - 15 - 15 - 7 - 7 - 90 = -64 → 0 🚨
Status: AUTO-SUBMITTED after 3rd tab switch
```

## Troubleshooting

### Issue: Tables don't exist
**Solution**: Run the migration SQL file in Supabase SQL Editor

### Issue: Flags not generated
**Solution**: Check if triggers exist:
```sql
SELECT tgname FROM pg_trigger WHERE tgname LIKE '%behavioral%';
```

### Issue: Can't see flags in admin view
**Solution**: 
1. Verify RLS policies are set up
2. Check if you're logged in as admin
3. Run verify script to check data

### Issue: Student can't see their own flags
**Solution**:
1. Verify RLS policies allow student access
2. Check if attempt belongs to the student
3. Verify test is submitted (not in progress)

## Key Features

✅ **Automatic Flag Generation** - Triggers analyze behavioral data and generate flags
✅ **Real-time Tracking** - Client-side hooks track behavior as it happens
✅ **Comprehensive Metrics** - Tracks 10+ behavioral indicators
✅ **Admin Dashboard** - Complete integrity monitoring interface
✅ **Student Transparency** - Students can see their own integrity reports
✅ **Severity Levels** - Flags categorized as HIGH/MEDIUM/LOW
✅ **Integrity Scoring** - Automatic calculation with configurable weights
✅ **Row Level Security** - Proper access control for sensitive data

## Next Steps

After running the migration:

1. **Test with real students** - Monitor for false positives
2. **Adjust thresholds** - Tune flag thresholds based on your needs
3. **Train admins** - Show them how to interpret flags
4. **Communicate with students** - Explain what's being tracked
5. **Monitor patterns** - Look for common cheating patterns
6. **Iterate** - Improve based on feedback

## Support

If you encounter any issues:

1. Run `verify_behavioral_setup.js` to diagnose
2. Check Supabase logs for errors
3. Review the comprehensive README in `server/BEHAVIORAL_TRACKING_README.md`
4. Check the implementation guide in `BEHAVIORAL_TRACKING_IMPLEMENTATION.md`

## Summary

Your client-side tracking is **already complete** ✅. You just need to:
1. Run the migration to create database tables
2. Verify setup with the verification script
3. Test the system end-to-end

All behavioral data will then be automatically tracked, analyzed, and displayed in both admin and student views with proper flags and integrity scores.
