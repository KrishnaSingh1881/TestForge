# Fix Behavioral Flags Issue

## Problem
Tab switches are being counted but flags are not being raised in the `behavioral_flags` table.

## Root Cause
The trigger `trg_attempt_level_flags` was using `AFTER UPDATE OF tab_switches, focus_lost_count` which only fires when those specific columns are updated. However, there may be issues with how the trigger is detecting changes.

## Solution
Run the fix SQL file to:
1. Update the trigger function to properly clear only tab_switch and focus_loss flags
2. Change the trigger to fire on ANY update to the attempts table (not just specific columns)
3. Add better severity levels for flags
4. Regenerate flags for existing in-progress attempts

## How to Apply

### Option 1: Via Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `fix_behavioral_triggers.sql`
4. Click "Run"

### Option 2: Via psql
```bash
psql "your-connection-string" < server/fix_behavioral_triggers.sql
```

### Option 3: Via Node.js script
```bash
node server/apply_fix.js
```

## What the Fix Does

1. **Updates the trigger function** to:
   - Only delete tab_switch and focus_loss flags (not all attempt-level flags)
   - Add better labels with severity levels
   - Add focus_loss flags at 3+ occurrences (low severity)

2. **Changes the trigger** to:
   - Fire on ANY update to attempts table (not just specific columns)
   - Still only execute when tab_switches > 0 OR focus_lost_count > 0

3. **Regenerates flags** for existing attempts:
   - Finds all in-progress attempts with tab_switches or focus_lost_count > 0
   - Generates appropriate flags based on current counts

## Expected Result
After applying this fix:
- Tab switches will immediately generate flags in the behavioral_flags table
- Focus losses will generate flags at 3+ occurrences
- The Integrity Monitor will show the correct flag count
- Existing attempts will have their flags regenerated

## Verification
After running the fix, check:
```sql
SELECT 
  a.id,
  a.tab_switches,
  a.focus_lost_count,
  COUNT(bf.id) as flag_count
FROM attempts a
LEFT JOIN behavioral_flags bf ON bf.attempt_id = a.id AND bf.question_id IS NULL
WHERE a.status = 'in_progress'
GROUP BY a.id, a.tab_switches, a.focus_lost_count;
```

You should see flag_count > 0 for any attempt with tab_switches or focus_lost_count > 0.
