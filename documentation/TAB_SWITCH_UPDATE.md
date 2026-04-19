# Tab Switch Policy Update

## Changes Made

### Previous Policy
- **Deduction**: -5 points per tab switch
- **Limit**: No hard limit
- **Severity**: Medium (2-4 switches), High (5+ switches)

### New Policy ✅
- **Deduction**: -30 points per tab switch
- **Limit**: MAX 3 tab switches allowed
- **Auto-Submit**: Test is automatically submitted after 3rd tab switch
- **Severity**: 
  - 1st switch: Medium severity flag
  - 2nd switch: Medium severity flag
  - 3rd switch: High severity flag + AUTO-SUBMIT

## Impact Examples

### Example 1: Single Tab Switch
```
Before: 100 - 5 = 95 points
After:  100 - 30 = 70 points
Impact: -25 points difference
```

### Example 2: Two Tab Switches
```
Before: 100 - 10 = 90 points
After:  100 - 60 = 40 points
Impact: -50 points difference
Status: Warning shown, one more switch = auto-submit
```

### Example 3: Three Tab Switches
```
Before: 100 - 15 = 85 points (test continues)
After:  100 - 90 = 10 points + AUTO-SUBMIT
Impact: Test is forcefully submitted
Status: 🚨 CRITICAL - Test ended
```

## Client-Side Behavior

### First Tab Switch
```
User switches tab → Detected
↓
PATCH /attempts/:id/integrity { event: "tab_switch" }
↓
Toast: "⚠️ Tab switch detected (−30) — Integrity: 70/100"
↓
Warning displayed
```

### Second Tab Switch
```
User switches tab again → Detected
↓
PATCH /attempts/:id/integrity { event: "tab_switch" }
↓
Toast: "⚠️ Tab switch detected (−30) — Integrity: 40/100"
↓
Severe warning: "One more tab switch will auto-submit your test!"
```

### Third Tab Switch (CRITICAL)
```
User switches tab third time → Detected
↓
PATCH /attempts/:id/integrity { event: "tab_switch" }
↓
Toast: "🚨 3 tab switches — Auto-submitting!"
↓
1 second delay
↓
POST /attempts/:id/submit { auto: true }
↓
Test forcefully submitted
↓
Redirect to results page
```

## Database Changes

### Migration File Updated
File: `server/migration_behavioral_tables.sql`

**Trigger: `auto_generate_attempt_level_flags()`**
```sql
-- Tab switch flags (max 3 allowed)
IF NEW.tab_switches >= 3 THEN
  INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
  VALUES (NEW.id, NULL, 'tab_switch',
          'Critical: Tab switch limit reached (' || NEW.tab_switches || '×)', 'high');
ELSIF NEW.tab_switches >= 2 THEN
  INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
  VALUES (NEW.id, NULL, 'tab_switch',
          'Warning: Tab switches detected (' || NEW.tab_switches || '×)', 'medium');
ELSIF NEW.tab_switches >= 1 THEN
  INSERT INTO behavioral_flags (attempt_id, question_id, type, label, severity)
  VALUES (NEW.id, NULL, 'tab_switch',
          'Tab switch detected (' || NEW.tab_switches || '×)', 'medium');
END IF;
```

**Trigger: `compute_integrity_score()`**
```sql
-- Compute score
v_score := v_score - (COALESCE(v_tab_switches, 0) * 30);  -- Changed from * 5
v_score := v_score - (COALESCE(v_focus_lost,   0) * 2);
v_score := v_score - (COALESCE(v_high_flags,   0) * 15);
v_score := v_score - (COALESCE(v_med_flags,    0) * 7);
```

## Client-Side Implementation

### File: `client/src/os/apps/TestSessionApp.tsx`

**Already Implemented ✅**
```typescript
useIntegrityListeners({
  attemptId,
  active: phase === 'active',
  onEvent: (msg) => {
    deductIntegrity(30, `Tab switch detected (−30)`);  // -30 points
  },
  onTabSwitchCount: (count) => {
    if (count >= 3) {
      showToast('🚨 3 tab switches — Auto-submitting!');
      setTimeout(() => handleSubmit(true, 'integrity_violation'), 1000);
    }
  },
});
```

## User Experience

### Student Perspective

**First Warning (1st switch):**
```
┌─────────────────────────────────────────┐
│ ⚠️ Tab switch detected (−30)            │
│ Integrity: 70/100                       │
│                                         │
│ Warning: Switching tabs is not allowed │
│ during the test. Your integrity score  │
│ has been reduced.                       │
└─────────────────────────────────────────┘
```

**Second Warning (2nd switch):**
```
┌─────────────────────────────────────────┐
│ ⚠️ Tab switch detected (−30)            │
│ Integrity: 40/100                       │
│                                         │
│ CRITICAL WARNING: One more tab switch   │
│ will automatically submit your test!    │
│ Stay on this tab to continue.           │
└─────────────────────────────────────────┘
```

**Final Action (3rd switch):**
```
┌─────────────────────────────────────────┐
│ 🚨 3 tab switches — Auto-submitting!    │
│                                         │
│ Your test has been automatically        │
│ submitted due to excessive tab          │
│ switching. This is a violation of       │
│ test integrity policies.                │
│                                         │
│ Redirecting to results...               │
└─────────────────────────────────────────┘
```

### Admin Perspective

**Integrity Monitor View:**
```
Student: John Doe
Integrity Score: 10/100 🚨

Flags:
├─ 🔴 HIGH: Critical: Tab switch limit reached (3×)
├─ 🟡 MEDIUM: Warning: Tab switches detected (2×)
└─ 🟡 MEDIUM: Tab switch detected (1×)

Status: AUTO-SUBMITTED (integrity_violation)
Submitted At: 2024-01-15 10:23:45
Time Taken: 12 minutes (of 60 minutes allowed)

Notes:
- Test was forcefully submitted after 3rd tab switch
- Student attempted to switch tabs multiple times
- High risk of cheating behavior
```

## Rationale

### Why -30 points per switch?
- **Severe deterrent**: Makes students think twice before switching
- **3 strikes rule**: Allows for 1-2 accidental switches
- **Clear threshold**: 3 switches = 90 points lost = near-zero integrity

### Why max 3 switches?
- **Fair but firm**: Allows for genuine accidents (e.g., notification click)
- **Clear boundary**: Students know exactly when test will end
- **Prevents abuse**: Can't continue test after multiple violations

### Why auto-submit?
- **Immediate consequence**: No opportunity to continue cheating
- **Protects integrity**: Prevents further violations
- **Clear policy**: Students are warned before it happens

## Testing Checklist

- [ ] Run migration to update triggers
- [ ] Test 1st tab switch: Verify -30 points deducted
- [ ] Test 2nd tab switch: Verify warning shown
- [ ] Test 3rd tab switch: Verify auto-submit triggered
- [ ] Verify admin sees "AUTO-SUBMITTED" status
- [ ] Verify student sees auto-submit message
- [ ] Verify integrity score calculation includes -30 per switch
- [ ] Verify flags are generated correctly

## Migration Steps

1. **Run the updated migration:**
   ```bash
   # Copy server/migration_behavioral_tables.sql into Supabase SQL Editor
   # Run the entire file
   ```

2. **Verify triggers updated:**
   ```sql
   SELECT tgname, tgtype FROM pg_trigger 
   WHERE tgname IN ('trg_attempt_level_flags', 'trg_integrity_score');
   ```

3. **Test with a real attempt:**
   - Start a test
   - Switch tabs once (should see -30 deduction)
   - Switch tabs twice (should see warning)
   - Switch tabs third time (should auto-submit)

## Documentation Updated

All documentation files have been updated to reflect the new policy:

- ✅ `server/migration_behavioral_tables.sql` - Database triggers
- ✅ `BEHAVIORAL_TRACKING_IMPLEMENTATION.md` - Implementation guide
- ✅ `server/BEHAVIORAL_TRACKING_README.md` - Technical documentation
- ✅ `BEHAVIORAL_TRACKING_SUMMARY.md` - Quick summary
- ✅ `BEHAVIORAL_TRACKING_FLOW.md` - Flow diagrams
- ✅ `TAB_SWITCH_UPDATE.md` - This file

## Summary

The tab switch policy has been **significantly strengthened**:

| Aspect | Before | After |
|--------|--------|-------|
| Deduction | -5 points | **-30 points** |
| Max Allowed | Unlimited | **3 switches** |
| Auto-Submit | No | **Yes (after 3rd)** |
| Severity | Medium/High | **Medium → High → CRITICAL** |

This change makes tab switching a **critical violation** that will result in immediate test submission after 3 occurrences, providing a strong deterrent against cheating while still allowing for 1-2 accidental switches.
