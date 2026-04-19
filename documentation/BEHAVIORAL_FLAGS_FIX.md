# Behavioral Flags Fix - Complete Guide

## Issue Summary
**Problem**: Tab switches are being counted in the `attempts` table (tab_switches column increments correctly), but no flags are being raised in the `behavioral_flags` table.

**Symptoms**:
- Integrity Monitor shows "3 FOCUS LOSS" but "0 FLAGS"
- Tab switches increment correctly in database
- No entries in `behavioral_flags` table for attempt-level violations

## Root Cause Analysis

### 1. Trigger Specification Issue
The original trigger was defined as:
```sql
CREATE TRIGGER trg_attempt_level_flags
AFTER UPDATE OF tab_switches, focus_lost_count ON attempts
```

This means the trigger only fires when those **specific columns** are updated. However, PostgreSQL's `UPDATE OF` clause can be finicky with how updates are detected.

### 2. Flag Deletion Logic
The function was deleting ALL attempt-level flags every time:
```sql
DELETE FROM behavioral_flags
WHERE attempt_id = NEW.id
AND question_id IS NULL;
```

This could cause race conditions or unintended deletions of other flag types.

## The Fix

### Changes Made

#### 1. Updated Trigger Function (`auto_generate_attempt_level_flags`)
```sql
CREATE OR REPLACE FUNCTION auto_generate_attempt_level_flags()
RETURNS TRIGGER AS $$
BEGIN
  -- Only delete tab_switch and focus_loss flags (not all attempt-level flags)
  DELETE FROM behavioral_flags
  WHERE attempt_id = NEW.id
  AND question_id IS NULL
  AND type IN ('tab_switch', 'focus_loss');

  -- Generate flags with better labels and severity
  IF NEW.tab_switches >= 3 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'tab_switch',
            'Critical: Tab switch limit reached (' || NEW.tab_switches || '×) — Auto-submit triggered', 'high');
  ELSIF NEW.tab_switches >= 2 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'tab_switch',
            'Warning: ' || NEW.tab_switches || ' tab switches detected — One more will auto-submit', 'high');
  ELSIF NEW.tab_switches >= 1 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'tab_switch',
            'Tab switch detected (' || NEW.tab_switches || '×) — Integrity penalty applied', 'medium');
  END IF;

  -- Focus loss flags (now includes 3+ threshold)
  IF NEW.focus_lost_count >= 5 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'focus_loss',
            'Window focus lost ' || NEW.focus_lost_count || ' times', 'medium');
  ELSIF NEW.focus_lost_count >= 3 THEN
    INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
    VALUES (NEW.id, NULL, 'focus_loss',
            'Window focus lost ' || NEW.focus_lost_count || ' times', 'low');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### 2. Updated Trigger Definition
```sql
DROP TRIGGER IF EXISTS trg_attempt_level_flags ON attempts;
CREATE TRIGGER trg_attempt_level_flags
AFTER UPDATE ON attempts  -- Fire on ANY update, not just specific columns
FOR EACH ROW
WHEN (NEW.tab_switches > 0 OR NEW.focus_lost_count > 0)
EXECUTE FUNCTION auto_generate_attempt_level_flags();
```

**Key Change**: Removed `OF tab_switches, focus_lost_count` to make the trigger fire on ANY update to the attempts table, while still using the WHEN clause to filter only relevant rows.

#### 3. Manual Flag Regeneration
Added a DO block to regenerate flags for existing attempts that already have tab_switches or focus_lost_count > 0.

## How to Apply the Fix

### Method 1: Supabase SQL Editor (Recommended)
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open `server/fix_behavioral_triggers.sql`
4. Copy the entire contents
5. Paste into SQL Editor
6. Click **Run**

### Method 2: Node.js Script
```bash
cd server
node apply_behavioral_fix.js
```

### Method 3: psql Command Line
```bash
psql "your-connection-string" < server/fix_behavioral_triggers.sql
```

## Verification Steps

### 1. Check Trigger Exists
```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_attempt_level_flags';
```

### 2. Verify Flags Are Generated
```sql
SELECT 
  a.id,
  a.tab_switches,
  a.focus_lost_count,
  COUNT(bf.id) as flag_count,
  STRING_AGG(bf.label, ' | ') as flags
FROM attempts a
LEFT JOIN behavioral_flags bf ON bf.attempt_id = a.id AND bf.question_id IS NULL
WHERE a.status = 'in_progress'
  AND (a.tab_switches > 0 OR a.focus_lost_count > 0)
GROUP BY a.id, a.tab_switches, a.focus_lost_count;
```

Expected result: `flag_count` should be > 0 for any attempt with tab_switches or focus_lost_count > 0.

### 3. Test Live
1. Start a test attempt
2. Switch tabs 1 time
3. Check Integrity Monitor - should show "1 FLAG"
4. Switch tabs again (2 total)
5. Should show "1 FLAG" with updated label
6. Switch tabs again (3 total)
7. Should auto-submit and show "1 FLAG" with critical label

## Flag Generation Rules

### Tab Switches
| Count | Severity | Label | Points Deducted |
|-------|----------|-------|-----------------|
| 1 | Medium | "Tab switch detected (1×) — Integrity penalty applied" | -30 |
| 2 | High | "Warning: 2 tab switches detected — One more will auto-submit" | -60 |
| 3+ | High | "Critical: Tab switch limit reached (3×) — Auto-submit triggered" | -90 (auto-submit) |

### Focus Losses
| Count | Severity | Label | Points Deducted |
|-------|----------|-------|-----------------|
| 1-2 | None | No flag | -2 each |
| 3-4 | Low | "Window focus lost 3 times" | -6 to -8 |
| 5+ | Medium | "Window focus lost 5 times" | -10+ |

## Troubleshooting

### Issue: Flags still not appearing
**Solution**: Manually trigger flag generation:
```sql
UPDATE attempts 
SET tab_switches = tab_switches 
WHERE id = 'your-attempt-id' 
AND status = 'in_progress';
```

### Issue: Old flags not cleared
**Solution**: Clear and regenerate:
```sql
DELETE FROM behavioral_flags 
WHERE attempt_id = 'your-attempt-id' 
AND question_id IS NULL 
AND type IN ('tab_switch', 'focus_loss');

-- Then trigger regeneration with UPDATE above
```

### Issue: Trigger not firing
**Solution**: Check trigger is enabled:
```sql
SELECT tgenabled FROM pg_trigger 
WHERE tgname = 'trg_attempt_level_flags';
```
If result is not 'O' (enabled), enable it:
```sql
ALTER TABLE attempts ENABLE TRIGGER trg_attempt_level_flags;
```

## Files Modified/Created

1. **server/fix_behavioral_triggers.sql** - SQL fix script
2. **server/apply_behavioral_fix.js** - Node.js application script
3. **server/APPLY_BEHAVIORAL_FIX.md** - Quick reference guide
4. **documentation/BEHAVIORAL_FLAGS_FIX.md** - This complete guide
5. **server/migration_behavioral_tables.sql** - Updated with correct trigger (for future deployments)

## Related Files

- **client/src/hooks/useIntegrityListeners.ts** - Client-side tab switch detection
- **server/routes/attempts.js** - Server endpoint that increments tab_switches
- **client/src/os/apps/AdminIntegrityApp.tsx** - Admin view of flags
- **client/src/os/apps/StudentIntegrityApp.tsx** - Student view of flags

## Summary

The fix ensures that:
1. ✅ Tab switches immediately generate flags in the database
2. ✅ Focus losses generate flags at appropriate thresholds
3. ✅ Flags are properly displayed in the Integrity Monitor
4. ✅ Existing attempts have their flags regenerated
5. ✅ Future attempts will automatically generate flags on any update

Apply the fix using one of the methods above, then verify using the SQL queries provided.
