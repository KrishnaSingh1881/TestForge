# Behavioral Tracking Setup Checklist

## Pre-Setup Verification

- [ ] You have access to Supabase Dashboard
- [ ] You have the database connection string
- [ ] You have Node.js installed
- [ ] You have the `.env` file configured with:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Setup Steps

### 1. Run Database Migration

**Option A: Supabase SQL Editor (Recommended)**
- [ ] Open Supabase Dashboard
- [ ] Navigate to SQL Editor
- [ ] Open `server/migration_behavioral_tables.sql`
- [ ] Copy entire contents
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify success message (no errors)

**Option B: Using psql**
```bash
psql 'postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres' \
  -f server/migration_behavioral_tables.sql
```
- [ ] Command executed successfully
- [ ] No error messages

### 2. Verify Setup

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

- [ ] All checks passed
- [ ] No error messages

### 3. Seed Test Data (Optional but Recommended)

```bash
node --env-file=.env seed_behavioral.js
```

- [ ] Script completed successfully
- [ ] Test data created with different behavioral patterns

### 4. Test Admin View

- [ ] Login as admin user
- [ ] Open "Integrity Monitor" app from dock
- [ ] Select a test from the list
- [ ] Verify student list appears
- [ ] Students are color-coded (red/yellow/green)
- [ ] Click a student to view audit panel
- [ ] Verify flags are displayed with severity badges
- [ ] Verify coding analysis shows metrics (WPM, paste events, etc.)
- [ ] Verify session metrics (tab switches, focus loss)

### 5. Test Student View

- [ ] Login as student user
- [ ] Complete a test (or use existing completed test)
- [ ] Open "My Integrity" app from dock
- [ ] Verify test list appears
- [ ] Click a test to view integrity details
- [ ] Verify flags are displayed (if any)
- [ ] Verify coding analysis shows metrics
- [ ] Verify session metrics are accurate

### 6. Test Real-Time Tracking

**MCQ Question Tracking:**
- [ ] Start a new test with MCQ questions
- [ ] Open browser DevTools → Network tab
- [ ] Select an option
- [ ] Verify POST to `/attempts/:id/responses`
- [ ] Check request payload includes `behavioral_meta`
- [ ] Verify `time_to_first_keystroke` is present

**Debugging Question Tracking:**
- [ ] Start a test with debugging questions
- [ ] Type some code in the editor
- [ ] Paste some code (Ctrl+V or Cmd+V)
- [ ] Run the code
- [ ] Submit the response
- [ ] Check Network tab for POST to `/attempts/:id/responses`
- [ ] Verify `behavioral_meta` includes:
  - [ ] `wpm_consistency` > 0
  - [ ] `paste_events` = 1
  - [ ] `backspace_count` > 0
  - [ ] `test_runs_before_submit` > 0

**Integrity Event Tracking:**
- [ ] During a test, switch to another tab
- [ ] Check Network tab for PATCH to `/attempts/:id/integrity`
- [ ] Verify `event: "tab_switch"` in request
- [ ] Verify response shows incremented `tab_switches`
- [ ] Verify toast shows "-30 points" deduction
- [ ] Switch tabs a second time
- [ ] Verify warning about auto-submit appears
- [ ] Switch tabs a third time
- [ ] Verify test is automatically submitted
- [ ] Verify redirect to results page

### 7. Verify Flag Generation

**Check Database:**
```sql
-- Check if flags were generated
SELECT * FROM behavioral_flags LIMIT 10;

-- Check if details were stored
SELECT * FROM behavioral_details LIMIT 10;

-- Check integrity scores
SELECT 
  r.integrity_score,
  a.tab_switches,
  a.focus_lost_count,
  COUNT(bf.id) as flag_count
FROM results r
JOIN attempts a ON a.id = r.attempt_id
LEFT JOIN behavioral_flags bf ON bf.attempt_id = a.id
GROUP BY r.id, r.integrity_score, a.tab_switches, a.focus_lost_count
LIMIT 10;
```

- [ ] `behavioral_flags` table has data
- [ ] `behavioral_details` table has data
- [ ] Integrity scores are calculated correctly

### 8. Test Different Scenarios

**Scenario 1: Clean Student**
- [ ] Complete test normally
- [ ] No paste events
- [ ] No tab switches
- [ ] Run tests before submitting
- [ ] Verify integrity score is 90-100
- [ ] Verify no flags or only low-severity flags

**Scenario 2: Suspicious Behavior**
- [ ] Paste code into editor
- [ ] Switch tabs 2-3 times
- [ ] Submit without running tests
- [ ] Verify integrity score is 60-80
- [ ] Verify medium severity flags appear

**Scenario 3: High-Risk Behavior (Auto-Submit)**
- [ ] Paste code multiple times
- [ ] Type very fast (>120 WPM)
- [ ] Switch tabs 3 times
- [ ] Verify test is auto-submitted after 3rd switch
- [ ] Verify integrity score is near 0
- [ ] Verify high severity flags appear
- [ ] Verify "AUTO-SUBMITTED" status in admin view

## Troubleshooting

### Issue: Migration fails
- [ ] Check Supabase logs for specific error
- [ ] Verify you have admin/service role access
- [ ] Try running migration in smaller chunks
- [ ] Check if tables already exist (may need to drop first)

### Issue: Verify script fails
- [ ] Check `.env` file has correct credentials
- [ ] Verify Supabase URL is correct
- [ ] Check network connectivity
- [ ] Try running individual queries in SQL Editor

### Issue: Flags not appearing
- [ ] Check if triggers are created:
  ```sql
  SELECT tgname FROM pg_trigger WHERE tgname LIKE '%behavioral%';
  ```
- [ ] Verify responses have `behavioral_meta`:
  ```sql
  SELECT id, behavioral_meta FROM responses 
  WHERE behavioral_meta IS NOT NULL LIMIT 5;
  ```
- [ ] Manually trigger flag generation:
  ```sql
  UPDATE responses SET behavioral_meta = behavioral_meta 
  WHERE id = 'some-response-id';
  ```

### Issue: Admin can't see flags
- [ ] Verify user role is 'admin', 'super_admin', or 'master_admin'
- [ ] Check RLS policies:
  ```sql
  SELECT * FROM pg_policies 
  WHERE tablename IN ('behavioral_flags', 'behavioral_details');
  ```
- [ ] Try disabling RLS temporarily for testing:
  ```sql
  ALTER TABLE behavioral_flags DISABLE ROW LEVEL SECURITY;
  ALTER TABLE behavioral_details DISABLE ROW LEVEL SECURITY;
  ```

### Issue: Student can't see their own flags
- [ ] Verify test is submitted (not in progress)
- [ ] Check if attempt belongs to the student
- [ ] Verify RLS policies allow student access
- [ ] Check browser console for errors

## Post-Setup Tasks

### Configuration
- [ ] Review flag thresholds in migration file
- [ ] Adjust severity levels if needed
- [ ] Configure integrity score weights
- [ ] Set up alerts for high-risk students

### Documentation
- [ ] Train admins on how to interpret flags
- [ ] Create student-facing documentation
- [ ] Document your specific thresholds
- [ ] Create incident response procedures

### Monitoring
- [ ] Set up regular integrity score reviews
- [ ] Monitor for false positives
- [ ] Track common cheating patterns
- [ ] Adjust thresholds based on data

### Communication
- [ ] Inform students about behavioral tracking
- [ ] Explain what data is collected
- [ ] Clarify how integrity scores are used
- [ ] Provide appeals process

## Success Criteria

✅ All database tables created
✅ All triggers functioning
✅ Verification script passes
✅ Admin can view all student flags
✅ Students can view their own flags
✅ Real-time tracking works
✅ Flags are generated automatically
✅ Integrity scores are calculated correctly
✅ UI displays all data properly

## Next Steps After Setup

1. **Test with pilot group** - Run with small group first
2. **Gather feedback** - Ask admins and students for input
3. **Tune thresholds** - Adjust based on false positive rate
4. **Monitor patterns** - Look for emerging cheating methods
5. **Iterate** - Continuously improve the system

## Support Resources

- **Implementation Guide**: `BEHAVIORAL_TRACKING_IMPLEMENTATION.md`
- **Technical Docs**: `server/BEHAVIORAL_TRACKING_README.md`
- **Summary**: `BEHAVIORAL_TRACKING_SUMMARY.md`
- **Verification Script**: `server/verify_behavioral_setup.js`
- **Migration File**: `server/migration_behavioral_tables.sql`

## Contact

If you encounter issues not covered in this checklist:
1. Review the comprehensive documentation
2. Check Supabase logs
3. Run the verification script
4. Review the troubleshooting section
5. Open an issue with detailed error messages

---

**Date Completed**: _______________
**Completed By**: _______________
**Notes**: _______________
