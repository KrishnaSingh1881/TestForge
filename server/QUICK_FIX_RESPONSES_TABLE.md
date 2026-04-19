# Quick Fix: Responses Table Error

## Error You're Seeing
```
THERE IS NO UNIQUE OR EXCLUSION CONSTRAINT MATCHING THE ON CONFLICT SPECIFICATION
```

## Quick Fix (Copy & Paste into Supabase SQL Editor)

```sql
ALTER TABLE responses 
ADD CONSTRAINT responses_attempt_question_unique 
UNIQUE (attempt_id, question_id);
```

## Steps
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Paste the SQL above
4. Click "Run"
5. Done! ✅

## What This Does
- Adds a unique constraint to prevent duplicate responses
- Allows one response per question per attempt
- Fixes the save button error

## Verify It Worked
Refresh your test page and click "Save Answer" - it should work without errors.

---

**Full documentation**: See `documentation/SUPABASE_UNIQUE_CONSTRAINT_FIX.md`
