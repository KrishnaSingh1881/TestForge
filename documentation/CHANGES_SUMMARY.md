# Changes Summary - Tab Switch Policy Update

## What Changed

The tab switch penalty has been **significantly increased** from -5 points to **-30 points per switch**, with a **hard limit of 3 tab switches** before automatic test submission.

## Key Changes

### 1. Penalty Increased
- **Before**: -5 points per tab switch
- **After**: -30 points per tab switch
- **Impact**: 6x more severe penalty

### 2. Hard Limit Enforced
- **Before**: No limit, students could switch tabs indefinitely
- **After**: MAX 3 tab switches allowed
- **Impact**: Test is automatically submitted after 3rd switch

### 3. Progressive Warnings
- **1st switch**: Medium severity flag, -30 points, warning toast
- **2nd switch**: Medium severity flag, -30 points, critical warning
- **3rd switch**: High severity flag, -30 points, **AUTO-SUBMIT**

## Files Modified

### Database Migration
✅ **`server/migration_behavioral_tables.sql`**
- Updated `auto_generate_attempt_level_flags()` trigger
  - Changed flag thresholds (1, 2, 3 switches instead of 2, 5)
  - Added "Critical: Tab switch limit reached" for 3rd switch
- Updated `compute_integrity_score()` trigger
  - Changed deduction from `* 5` to `* 30`

### Documentation
✅ **`BEHAVIORAL_TRACKING_IMPLEMENTATION.md`**
- Updated integrity score calculation section
- Updated attempt-level deductions

✅ **`server/BEHAVIORAL_TRACKING_README.md`**
- Updated flag types table
- Updated attempt-level deductions
- Updated example calculations

✅ **`BEHAVIORAL_TRACKING_SUMMARY.md`**
- Updated scenario examples
- Updated integrity score calculation

✅ **`BEHAVIORAL_TRACKING_FLOW.md`**
- Updated flow diagrams
- Updated example calculations
- Updated attempt-level deductions

✅ **`SETUP_CHECKLIST.md`**
- Updated testing scenarios
- Updated integrity event tracking steps

### New Files Created
✅ **`TAB_SWITCH_UPDATE.md`**
- Comprehensive guide to the tab switch policy change
- Examples and rationale
- Testing checklist

✅ **`CHANGES_SUMMARY.md`**
- This file

## Client-Side (Already Implemented)

The client-side code in `TestSessionApp.tsx` was **already correctly implemented** with:
- -30 point deduction per switch
- Auto-submit after 3 switches
- Progressive warnings

**No client-side changes needed!** ✅

## Impact on Integrity Scores

### Example 1: Clean Student (No Switches)
```
Score: 100 points
Status: ✅ Clean
```

### Example 2: One Accidental Switch
```
Before: 100 - 5 = 95 points
After:  100 - 30 = 70 points
Status: ⚠️ Low Risk (still acceptable)
```

### Example 3: Two Switches
```
Before: 100 - 10 = 90 points
After:  100 - 60 = 40 points
Status: 🚨 High Risk (one more = auto-submit)
```

### Example 4: Three Switches (Auto-Submit)
```
Before: 100 - 15 = 85 points (test continues)
After:  100 - 90 = 10 points + AUTO-SUBMIT
Status: 🚨 CRITICAL (test forcefully ended)
```

## What You Need to Do

### 1. Run the Migration (Required)
```bash
# Copy server/migration_behavioral_tables.sql into Supabase SQL Editor
# Run the entire file to update triggers
```

### 2. Verify the Changes
```bash
# Run verification script
node --env-file=.env server/verify_behavioral_setup.js
```

### 3. Test the New Policy
1. Start a test as a student
2. Switch tabs once → Verify -30 deduction
3. Switch tabs twice → Verify warning
4. Switch tabs third time → Verify auto-submit

### 4. Communicate to Students
Update your test instructions to inform students:
- Tab switching is strictly monitored
- Each switch deducts 30 points
- After 3 switches, test will be automatically submitted
- Stay on the test tab at all times

## Rationale

### Why -30 points?
- **Strong deterrent**: Makes students think twice
- **Fair but firm**: Allows 1-2 accidental switches
- **Clear consequence**: 3 switches = near-zero integrity

### Why max 3 switches?
- **Prevents abuse**: Can't continue after multiple violations
- **Clear boundary**: Students know the limit
- **Automatic enforcement**: No manual intervention needed

### Why auto-submit?
- **Immediate consequence**: Stops cheating immediately
- **Protects test integrity**: Prevents further violations
- **Fair warning**: Students get 2 warnings before auto-submit

## Testing Checklist

- [ ] Migration executed successfully
- [ ] Triggers updated (verify with SQL query)
- [ ] 1st tab switch: -30 points deducted
- [ ] 2nd tab switch: Warning shown
- [ ] 3rd tab switch: Test auto-submitted
- [ ] Admin sees "AUTO-SUBMITTED" status
- [ ] Student sees auto-submit message
- [ ] Integrity score calculated correctly

## SQL Verification

Run this to verify triggers are updated:
```sql
-- Check trigger exists
SELECT tgname, tgtype FROM pg_trigger 
WHERE tgname IN ('trg_attempt_level_flags', 'trg_integrity_score');

-- Check function definition
SELECT prosrc FROM pg_proc 
WHERE proname = 'auto_generate_attempt_level_flags';

-- Should see "* 30" in the integrity score function
SELECT prosrc FROM pg_proc 
WHERE proname = 'compute_integrity_score';
```

## Rollback (If Needed)

If you need to revert to the old policy:

1. Change `* 30` back to `* 5` in `compute_integrity_score()`
2. Change thresholds from `>= 3, >= 2, >= 1` to `>= 5, >= 2`
3. Remove auto-submit logic from client (or increase limit to 5+)

## Summary

| Aspect | Before | After | Change |
|--------|--------|-------|--------|
| **Deduction** | -5 points | **-30 points** | 6x increase |
| **Max Allowed** | Unlimited | **3 switches** | Hard limit |
| **Auto-Submit** | No | **Yes** | New feature |
| **1st Switch** | -5 (95 left) | **-30 (70 left)** | Severe |
| **2nd Switch** | -10 (90 left) | **-60 (40 left)** | Critical |
| **3rd Switch** | -15 (85 left) | **-90 (10 left) + AUTO-SUBMIT** | Test ends |

The new policy provides a **strong deterrent** against tab switching while still allowing for 1-2 accidental switches. After 3 switches, the test is **automatically submitted** to prevent further integrity violations.

## Next Steps

1. ✅ Run migration
2. ✅ Test the new policy
3. ✅ Update student instructions
4. ✅ Monitor for false positives
5. ✅ Adjust if needed based on feedback

All documentation has been updated to reflect the new -30 point penalty and 3-switch limit with auto-submit.
