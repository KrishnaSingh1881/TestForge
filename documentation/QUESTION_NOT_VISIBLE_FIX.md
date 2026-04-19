# Question Not Visible - Troubleshooting Guide

## Problem
You created a question but it's not showing up in the test questions list. The screen shows "NO ACTIVE FRAGMENTS IN SCOPE".

## Root Causes

### 1. Question Not Attached to Test
**Most Common Issue**: Questions are created in `question_bank` but not automatically attached to `test_questions`.

**How It Should Work**:
1. Create question → Gets ID from server
2. Automatically call `/questions/:id/attach` with test_id
3. Question appears in test questions list

**Check**:
- Open browser console (F12)
- Create a question
- Look for these network requests:
  - `POST /questions/mcq` or `POST /questions/debug` (should return `{ id: "..." }`)
  - `POST /questions/:id/attach` (should return `{ test_question: {...} }`)

**If attach request is missing or failing**:
- Check console for JavaScript errors
- Check Network tab for failed requests
- Look for error messages

### 2. RLS Policy Blocking Access
**Issue**: Row Level Security policies might be blocking your access to questions.

**Check Your Role**:
```sql
SELECT role FROM users WHERE id = auth.uid();
```

**RLS Policy for Admins**:
```sql
-- Admins can only see questions they created (or super_admins see all)
CREATE POLICY "admins_read_own_questions"
ON public.question_bank FOR SELECT
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  AND (created_by = auth.uid() OR public.get_user_role() = 'super_admin')
);
```

**Fix**: If you're a regular admin, you can only see questions YOU created. If you need to see all questions, either:
- Upgrade to super_admin role
- Modify the RLS policy to allow all admins to see all questions

### 3. Test Ownership Issue
**Issue**: You might be trying to view a test you don't own.

**Check**:
```sql
SELECT id, title, created_by 
FROM tests 
WHERE id = 'your-test-id';
```

Compare `created_by` with your user ID. If they don't match, you can't attach questions to this test.

## Quick Fixes

### Fix 1: Manually Attach Question to Test

If the question was created but not attached:

```sql
-- Find your question
SELECT id, statement, created_by 
FROM question_bank 
WHERE created_by = auth.uid()
ORDER BY created_at DESC 
LIMIT 5;

-- Attach it to your test
INSERT INTO test_questions (test_id, question_id, unlock_at_minutes, question_order)
VALUES (
  'your-test-id',
  'your-question-id',
  0,
  (SELECT COALESCE(MAX(question_order), -1) + 1 FROM test_questions WHERE test_id = 'your-test-id')
);
```

### Fix 2: Allow All Admins to See All Questions

If you want all admins to see all questions (not just their own):

```sql
-- Drop the restrictive policy
DROP POLICY IF EXISTS "admins_read_own_questions" ON public.question_bank;

-- Create a more permissive policy
CREATE POLICY "admins_read_all_questions"
ON public.question_bank FOR SELECT
USING (
  public.get_user_role() IN ('admin', 'super_admin', 'master_admin')
);
```

### Fix 3: Check and Fix Test Ownership

If you're trying to add questions to someone else's test:

```sql
-- Option A: Transfer test ownership to you
UPDATE tests 
SET created_by = auth.uid() 
WHERE id = 'your-test-id';

-- Option B: Upgrade yourself to super_admin
UPDATE users 
SET role = 'super_admin' 
WHERE id = auth.uid();
```

## Debugging Steps

### Step 1: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Create a question
4. Look for errors (red text)
5. Take a screenshot if you see errors

### Step 2: Check Network Tab
1. Open browser DevTools (F12)
2. Go to Network tab
3. Create a question
4. Look for these requests:
   - `POST /questions/mcq` or `/questions/debug`
   - `POST /questions/:id/attach`
5. Click on each request to see:
   - Status code (should be 200 or 201)
   - Response body
   - Any error messages

### Step 3: Check Database
```sql
-- Check if question was created
SELECT id, type, statement, created_by, created_at
FROM question_bank
WHERE created_by = auth.uid()
ORDER BY created_at DESC
LIMIT 5;

-- Check if question is attached to test
SELECT 
  tq.id,
  tq.test_id,
  tq.question_id,
  qb.statement
FROM test_questions tq
JOIN question_bank qb ON qb.id = tq.question_id
WHERE tq.test_id = 'your-test-id'
ORDER BY tq.question_order;
```

### Step 4: Check RLS Policies
```sql
-- Check your role
SELECT id, email, role FROM users WHERE id = auth.uid();

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('question_bank', 'test_questions');

-- List all policies on question_bank
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'question_bank';
```

## Common Error Messages

### "Forbidden"
**Cause**: You don't own the test  
**Fix**: Check test ownership or upgrade to super_admin

### "Question not found"
**Cause**: Question wasn't created or RLS is blocking it  
**Fix**: Check if question exists in database and verify RLS policies

### "No file provided" (for images)
**Cause**: Image upload failed  
**Fix**: This doesn't prevent question creation, just means no image was uploaded

### Network request failed
**Cause**: Server error or network issue  
**Fix**: Check server logs and network connection

## Prevention

### Always Check After Creating
After creating a question:
1. Wait for success message
2. Check that question appears in list
3. If not visible, check browser console immediately
4. Report any errors you see

### Use Bulk Import for Multiple Questions
If you're adding many questions:
1. Use the Bulk Import feature
2. It shows detailed error messages
3. Easier to troubleshoot

### Verify Test Ownership
Before creating questions:
1. Make sure you own the test
2. Or make sure you're a super_admin
3. Check the test details page

## Still Not Working?

If none of these fixes work:

1. **Take Screenshots**:
   - Browser console errors
   - Network tab showing failed requests
   - The empty questions list

2. **Run These Queries**:
```sql
-- Your user info
SELECT id, email, role FROM users WHERE id = auth.uid();

-- Recent questions you created
SELECT id, type, statement, created_at 
FROM question_bank 
WHERE created_by = auth.uid() 
ORDER BY created_at DESC 
LIMIT 5;

-- Test questions for your test
SELECT COUNT(*) as question_count
FROM test_questions
WHERE test_id = 'your-test-id';

-- RLS policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'question_bank';
```

3. **Check Server Logs**:
   - Look for errors in server console
   - Check for database connection issues
   - Verify authentication is working

## Summary

Most likely causes (in order):
1. ✅ Question created but not attached to test (check browser console)
2. ✅ RLS policy blocking access (check your role)
3. ✅ Test ownership issue (check test.created_by)
4. ✅ JavaScript error preventing attach call (check console)

Follow the debugging steps above to identify which issue you're facing, then apply the appropriate fix.
