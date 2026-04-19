# Supabase Unique Constraint Fix

## Error Message
```
THERE IS NO UNIQUE OR EXCLUSION CONSTRAINT MATCHING THE ON CONFLICT SPECIFICATION
```

## Problem
The `responses` table is missing a UNIQUE constraint on `(attempt_id, question_id)`. This constraint is needed to:
1. Ensure one response per question per attempt (data integrity)
2. Allow upsert operations using `ON CONFLICT` clause
3. Prevent duplicate responses for the same question

## Root Cause
The original schema.sql file created the `responses` table without a UNIQUE constraint:

```sql
CREATE TABLE responses (
  id uuid PRIMARY KEY,
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  ...
  -- Missing: UNIQUE(attempt_id, question_id)
);
```

## Solution
Add a UNIQUE constraint on `(attempt_id, question_id)` to the responses table.

## How to Apply the Fix

### Method 1: Supabase SQL Editor (Recommended)
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste this SQL:

```sql
ALTER TABLE responses 
ADD CONSTRAINT responses_attempt_question_unique 
UNIQUE (attempt_id, question_id);
```

4. Click **Run**

### Method 2: Using the Fix File
1. Open Supabase SQL Editor
2. Copy contents of `server/fix_responses_unique_constraint.sql`
3. Paste and run

### Method 3: psql Command Line
```bash
psql "your-connection-string" < server/fix_responses_unique_constraint.sql
```

## Verification

### Check if Constraint Exists
```sql
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'responses'::regclass
AND conname = 'responses_attempt_question_unique';
```

**Expected Result**:
```
constraint_name: responses_attempt_question_unique
constraint_type: u
definition: UNIQUE (attempt_id, question_id)
```

### Test the Fix
1. Start a test attempt
2. Answer a question
3. Click "Save Answer"
4. Should save successfully without error
5. Modify the answer
6. Click "Save Answer" again
7. Should update successfully (upsert)

## What This Fixes

### Before (Without Constraint)
- ❌ Error: "no unique or exclusion constraint matching"
- ❌ Cannot use `ON CONFLICT` for upserts
- ❌ Possible duplicate responses for same question
- ❌ Save button fails

### After (With Constraint)
- ✅ Upsert operations work correctly
- ✅ One response per question per attempt (enforced)
- ✅ Save button works properly
- ✅ Updates existing responses instead of creating duplicates

## Impact on Existing Data

### If You Have Duplicate Responses
The constraint addition will **fail** if there are already duplicate responses in the table.

**Check for duplicates**:
```sql
SELECT 
  attempt_id, 
  question_id, 
  COUNT(*) as count
FROM responses
GROUP BY attempt_id, question_id
HAVING COUNT(*) > 1;
```

**If duplicates exist**, clean them up first:
```sql
-- Keep only the most recent response for each (attempt_id, question_id)
DELETE FROM responses r1
WHERE EXISTS (
  SELECT 1 FROM responses r2
  WHERE r2.attempt_id = r1.attempt_id
  AND r2.question_id = r1.question_id
  AND r2.id > r1.id  -- Keep the one with higher ID (more recent)
);

-- Then add the constraint
ALTER TABLE responses 
ADD CONSTRAINT responses_attempt_question_unique 
UNIQUE (attempt_id, question_id);
```

## Server Code Compatibility

The server code in `server/routes/attempts.js` already handles this correctly:

```javascript
// Check if response exists
const { data: existing } = await supabase
  .from('responses')
  .select('id')
  .eq('attempt_id', attemptId)
  .eq('question_id', question_id)
  .maybeSingle();

// Update if exists, insert if not
if (existing) {
  await supabase.from('responses').update(payload).eq('id', existing.id);
} else {
  await supabase.from('responses').insert(payload);
}
```

This approach works with or without the constraint, but the constraint provides:
1. Database-level data integrity
2. Better performance (indexed lookup)
3. Prevents race conditions

## Alternative: Using ON CONFLICT (Optional)

Once the constraint is added, you can optionally simplify the server code to use `ON CONFLICT`:

```javascript
// Simplified upsert with ON CONFLICT
const { error } = await supabase
  .from('responses')
  .upsert(payload, {
    onConflict: 'attempt_id,question_id'
  });
```

However, the current approach (check then update/insert) is also valid and works fine.

## Files Modified

1. **server/fix_responses_unique_constraint.sql** - SQL fix to add constraint
2. **server/schema.sql** - Updated schema for future deployments
3. **documentation/SUPABASE_UNIQUE_CONSTRAINT_FIX.md** - This documentation

## Related Issues

This fix also resolves:
- Duplicate response entries
- Inconsistent save behavior
- Race conditions when saving quickly

## Summary

**Issue**: Missing UNIQUE constraint on responses table  
**Error**: "no unique or exclusion constraint matching the on conflict specification"  
**Fix**: Add `UNIQUE(attempt_id, question_id)` constraint  
**Impact**: Enables proper upsert operations and prevents duplicate responses  
**Action Required**: Run the SQL fix in Supabase SQL Editor

After applying this fix, the "Save Answer" button will work correctly without errors.
