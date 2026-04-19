# Complete Behavioral Flags Reference

## Overview
TestForge tracks two categories of behavioral flags:
1. **Attempt-Level Flags** - Tab switches and focus losses (tracked at test level)
2. **Question-Level Flags** - Behavioral patterns per question (paste, typing speed, etc.)

---

## Attempt-Level Flags

### Tab Switch Flags
**Trigger**: When student switches browser tabs during test  
**Tracking**: `attempts.tab_switches` column  
**Penalty**: -30 points per switch  
**Auto-submit**: After 3 switches

| Count | Severity | Label | Action |
|-------|----------|-------|--------|
| 1 | Medium | "Tab switch detected (1×) — Integrity penalty applied" | -30 points |
| 2 | High | "Warning: 2 tab switches detected — One more will auto-submit" | -60 points |
| 3+ | High | "Critical: Tab switch limit reached (3×) — Auto-submit triggered" | Auto-submit test |

**Client Detection**: `useIntegrityListeners.ts` - `visibilitychange` event  
**Server Update**: `PATCH /api/attempts/:id/integrity` with `event: 'tab_switch'`  
**Flag Generation**: `auto_generate_attempt_level_flags()` trigger

### Focus Loss Flags
**Trigger**: When test window loses focus (Alt+Tab, clicking outside)  
**Tracking**: `attempts.focus_lost_count` column  
**Penalty**: -2 points per loss

| Count | Severity | Label | Points Deducted |
|-------|----------|-------|-----------------|
| 1-2 | None | No flag | -2 to -4 |
| 3-4 | Low | "Window focus lost 3 times" | -6 to -8 |
| 5+ | Medium | "Window focus lost 5 times" | -10+ |

**Client Detection**: `useIntegrityListeners.ts` - `blur` event  
**Server Update**: `PATCH /api/attempts/:id/integrity` with `event: 'focus_lost'`  
**Flag Generation**: `auto_generate_attempt_level_flags()` trigger

---

## Question-Level Flags

### 1. Paste Event (HIGH Severity)
**Trigger**: Student pastes code into editor  
**Threshold**: ≥ 1 paste event  
**Penalty**: -15 points (high severity flag)

```json
{
  "type": "paste",
  "label": "Paste event detected (1×)",
  "severity": "high"
}
```

**Detection**: Monaco editor `onDidPaste` event  
**Tracking**: `behavioral_meta.paste_events`  
**Prevention**: Paste is blocked in test mode, but attempts are logged

---

### 2. Fast Start (HIGH Severity)
**Trigger**: Student starts typing within 3 seconds of opening question  
**Threshold**: `time_to_first_keystroke` < 3000ms  
**Penalty**: -15 points

```json
{
  "type": "fast_start",
  "label": "Typed within 3s of opening question",
  "severity": "high"
}
```

**Rationale**: Indicates student may have pre-prepared answer  
**Detection**: Time between question load and first keystroke  
**Tracking**: `behavioral_meta.time_to_first_keystroke`

---

### 3. No Corrections (HIGH Severity)
**Trigger**: Student types with very few corrections at high speed  
**Threshold**: `backspace_count` ≤ 2 AND `wpm_consistency` > 100  
**Penalty**: -15 points

```json
{
  "type": "no_corrections",
  "label": "No corrections at high WPM — likely pre-typed",
  "severity": "high"
}
```

**Rationale**: Natural typing includes corrections; perfect typing suggests pre-prepared code  
**Detection**: Backspace key presses + WPM calculation  
**Tracking**: `behavioral_meta.backspace_count` + `behavioral_meta.wpm_consistency`

---

### 4. High WPM (MEDIUM Severity)
**Trigger**: Extreme typing speed  
**Threshold**: `wpm_consistency` > 120 WPM  
**Penalty**: -7 points

```json
{
  "type": "high_wpm",
  "label": "Extreme typing speed (150 WPM)",
  "severity": "medium"
}
```

**Rationale**: Average programmer types 40-60 WPM; >120 is suspicious  
**Detection**: Rolling average of characters typed per 10-second window  
**Tracking**: `behavioral_meta.wpm_consistency`

---

### 5. No Test Run (MEDIUM Severity)
**Trigger**: Student submits code without running visible test cases  
**Threshold**: `test_runs_before_submit` = 0 AND code is submitted  
**Penalty**: -7 points

```json
{
  "type": "no_test_run",
  "label": "Submitted without running visible test cases",
  "severity": "medium"
}
```

**Rationale**: Normal workflow includes testing code before submission  
**Detection**: Count of "Run Code" button clicks  
**Tracking**: `behavioral_meta.test_runs_before_submit`

---

### 6. Long Idle Period (MEDIUM Severity)
**Trigger**: Student inactive for extended period  
**Threshold**: Any idle period > 180 seconds (3 minutes)  
**Penalty**: -7 points

```json
{
  "type": "long_idle",
  "label": "Unusually long idle period detected (>3 min)",
  "severity": "medium"
}
```

**Rationale**: May indicate external assistance or looking up answers  
**Detection**: Time between keystrokes  
**Tracking**: `behavioral_meta.idle_periods` (array of idle sessions)

---

## Behavioral Metadata Structure

### Complete Schema
```typescript
interface BehavioralMeta {
  time_to_first_keystroke: number | null;  // milliseconds
  backspace_count: number;                 // total backspace presses
  paste_events: number;                    // paste attempts (blocked but logged)
  edit_count: number;                      // distinct editing sessions
  wpm_consistency: number;                 // rolling average WPM
  idle_periods: Array<{                    // periods of inactivity
    start: string;                         // ISO timestamp
    duration_seconds: number;              // idle duration
  }>;
  test_runs_before_submit: number;         // "Run Code" clicks
}
```

### Example
```json
{
  "time_to_first_keystroke": 5420,
  "backspace_count": 12,
  "paste_events": 0,
  "edit_count": 3,
  "wpm_consistency": 65,
  "idle_periods": [
    {
      "start": "2026-04-19T08:15:30.000Z",
      "duration_seconds": 45
    }
  ],
  "test_runs_before_submit": 2
}
```

---

## Integrity Score Calculation

### Formula
```
integrity_score = 100
  - (tab_switches × 30)
  - (focus_lost_count × 2)
  - (high_severity_flags × 15)
  - (medium_severity_flags × 7)
  - (similarity_flag ? 15 : 0)
```

### Example Calculation
```
Student with:
- 2 tab switches = -60 points
- 4 focus losses = -8 points
- 1 paste flag (high) = -15 points
- 1 high WPM flag (medium) = -7 points

Final score: 100 - 60 - 8 - 15 - 7 = 10/100
```

---

## Database Tables

### behavioral_flags
```sql
CREATE TABLE behavioral_flags (
  id           uuid PRIMARY KEY,
  attempt_id   uuid NOT NULL REFERENCES attempts(id),
  question_id  uuid REFERENCES question_bank(id),  -- NULL for attempt-level
  type         text NOT NULL,
  label        text NOT NULL,
  severity     text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  flagged_at   timestamp NOT NULL DEFAULT now()
);
```

### behavioral_details
```sql
CREATE TABLE behavioral_details (
  id                       uuid PRIMARY KEY,
  attempt_id               uuid NOT NULL REFERENCES attempts(id),
  question_id              uuid NOT NULL REFERENCES question_bank(id),
  time_to_first_keystroke  int,
  paste_events             int DEFAULT 0,
  backspace_count          int DEFAULT 0,
  edit_count               int DEFAULT 0,
  wpm_consistency          int DEFAULT 0,
  test_runs_before_submit  int DEFAULT 0,
  idle_periods             jsonb DEFAULT '[]'::jsonb,
  UNIQUE(attempt_id, question_id)
);
```

---

## Trigger Functions

### auto_generate_behavioral_flags()
**Fires**: After INSERT or UPDATE on `responses` table  
**Condition**: When `behavioral_meta` is NOT NULL  
**Purpose**: Generates question-level flags based on behavioral thresholds

### auto_generate_attempt_level_flags()
**Fires**: After UPDATE on `attempts` table  
**Condition**: When `tab_switches > 0` OR `focus_lost_count > 0`  
**Purpose**: Generates attempt-level flags for tab switches and focus losses

---

## Testing & Verification

### Check All Flags
```sql
SELECT 
  bf.type,
  bf.severity,
  COUNT(*) as count,
  STRING_AGG(DISTINCT bf.label, ' | ') as labels
FROM behavioral_flags bf
GROUP BY bf.type, bf.severity
ORDER BY bf.severity DESC, count DESC;
```

### Check Specific Attempt
```sql
SELECT 
  bf.type,
  bf.label,
  bf.severity,
  bf.question_id,
  bf.flagged_at
FROM behavioral_flags bf
WHERE bf.attempt_id = 'your-attempt-id'
ORDER BY bf.severity DESC, bf.flagged_at;
```

### Verify Triggers
```sql
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%behavioral%';
```

---

## Troubleshooting

### Issue: Question-level flags not appearing
**Cause**: `behavioral_meta` not being sent or trigger not firing  
**Solution**:
1. Check browser console for save logs
2. Verify `behavioral_meta` in responses table
3. Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'trg_auto_behavioral_flags'`
4. Run test script: `psql < server/test_behavioral_flags.sql`

### Issue: Attempt-level flags not appearing
**Cause**: Trigger not firing on attempts table updates  
**Solution**:
1. Apply fix: `psql < server/fix_behavioral_triggers.sql`
2. Manually trigger: `UPDATE attempts SET tab_switches = tab_switches WHERE id = 'attempt-id'`
3. Verify trigger: `SELECT * FROM pg_trigger WHERE tgname = 'trg_attempt_level_flags'`

### Issue: Flags created but not visible in UI
**Cause**: RLS policies blocking access  
**Solution**:
1. Check RLS policies on `behavioral_flags` table
2. Verify user role (admin vs student)
3. Check query in AdminIntegrityApp.tsx or StudentIntegrityApp.tsx

---

## Scripts & Tools

### Apply All Fixes
```bash
cd server
node apply_behavioral_fix.js
```

### Verify All Flags
```bash
cd server
node verify_all_flags.js
```

### Test Flag Generation
```bash
psql "connection-string" < server/test_behavioral_flags.sql
```

---

## Related Files

**Client-Side**:
- `client/src/hooks/useBehavioralTracking.ts` - Collects behavioral metadata
- `client/src/hooks/useIntegrityListeners.ts` - Detects tab switches and focus loss
- `client/src/components/test/MCQQuestion.tsx` - Sends metadata for MCQ
- `client/src/components/test/DebugQuestion.tsx` - Sends metadata for coding questions

**Server-Side**:
- `server/migration_behavioral_tables.sql` - Creates tables and triggers
- `server/fix_behavioral_triggers.sql` - Fixes trigger issues
- `server/routes/attempts.js` - Handles integrity events

**Admin Views**:
- `client/src/os/apps/AdminIntegrityApp.tsx` - Admin view of all flags
- `client/src/os/apps/StudentIntegrityApp.tsx` - Student view of own flags

---

## Summary

All behavioral flags are automatically generated by database triggers when:
1. **Attempt-level**: `attempts` table is updated with tab_switches or focus_lost_count
2. **Question-level**: `responses` table is inserted/updated with behavioral_meta

Ensure triggers are properly installed and behavioral_meta is being sent from the client for all flags to work correctly.
