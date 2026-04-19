# Tab Switch Policy - Quick Reference Card

## 🚨 CRITICAL POLICY

### Tab Switch Penalties

```
┌─────────────────────────────────────────────────────────┐
│                  TAB SWITCH POLICY                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1st Switch:  -30 points  ⚠️  Warning                  │
│  2nd Switch:  -30 points  🔴 Critical Warning          │
│  3rd Switch:  -30 points  🚨 AUTO-SUBMIT               │
│                                                         │
│  MAX ALLOWED: 3 switches                                │
│  CONSEQUENCE: Test automatically submitted              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Integrity Score Impact

| Switches | Deduction | Score Left | Status |
|----------|-----------|------------|--------|
| 0 | 0 | 100 | ✅ Clean |
| 1 | -30 | 70 | ⚠️ Warning |
| 2 | -60 | 40 | 🔴 Critical |
| 3 | -90 | 10 | 🚨 AUTO-SUBMIT |

## Student Experience

### First Switch
```
┌──────────────────────────────────┐
│ ⚠️ Tab Switch Detected           │
│                                  │
│ Penalty: -30 points              │
│ Integrity: 70/100                │
│                                  │
│ Warning: Stay on this tab!       │
│ 2 more switches = auto-submit    │
└──────────────────────────────────┘
```

### Second Switch
```
┌──────────────────────────────────┐
│ 🔴 CRITICAL WARNING               │
│                                  │
│ Penalty: -30 points              │
│ Integrity: 40/100                │
│                                  │
│ ONE MORE SWITCH WILL             │
│ AUTOMATICALLY SUBMIT YOUR TEST!  │
│                                  │
│ Stay on this tab to continue.    │
└──────────────────────────────────┘
```

### Third Switch (FINAL)
```
┌──────────────────────────────────┐
│ 🚨 TEST AUTO-SUBMITTED            │
│                                  │
│ Reason: Tab switch limit reached │
│ Total Switches: 3                │
│ Final Integrity: 10/100          │
│                                  │
│ Your test has been automatically │
│ submitted due to excessive tab   │
│ switching.                       │
│                                  │
│ Redirecting to results...        │
└──────────────────────────────────┘
```

## Admin View

### Flag Display
```
🔴 HIGH: Critical: Tab switch limit reached (3×)
🟡 MEDIUM: Warning: Tab switches detected (2×)
🟡 MEDIUM: Tab switch detected (1×)

Status: AUTO-SUBMITTED (integrity_violation)
Final Score: 10/100
```

## Technical Details

### Database
- **Deduction**: 30 points per switch
- **Trigger**: `auto_generate_attempt_level_flags()`
- **Calculation**: `compute_integrity_score()`

### Client
- **Hook**: `useIntegrityListeners`
- **Detection**: `visibilitychange` event
- **Auto-Submit**: After 3rd switch (1 second delay)

### API
- **Endpoint**: `PATCH /attempts/:id/integrity`
- **Payload**: `{ event: "tab_switch" }`
- **Response**: `{ tab_switches: count }`

## Configuration

### Current Settings
```javascript
MAX_TAB_SWITCHES = 3
TAB_SWITCH_PENALTY = -30
AUTO_SUBMIT_ENABLED = true
AUTO_SUBMIT_DELAY = 1000ms
```

### Thresholds
```javascript
if (tab_switches >= 3) {
  severity = 'high'
  action = 'auto_submit'
} else if (tab_switches >= 2) {
  severity = 'medium'
  action = 'critical_warning'
} else if (tab_switches >= 1) {
  severity = 'medium'
  action = 'warning'
}
```

## Testing Commands

### Verify Migration
```sql
SELECT prosrc FROM pg_proc 
WHERE proname = 'compute_integrity_score';
-- Should contain "* 30"
```

### Check Triggers
```sql
SELECT tgname FROM pg_trigger 
WHERE tgname LIKE '%behavioral%';
```

### Test Manually
1. Start test
2. Switch tabs 3 times
3. Verify auto-submit
4. Check integrity score = 10

## Student Instructions Template

```
IMPORTANT: Tab Switching Policy

During this test:
✓ Stay on the test tab at all times
✗ Do NOT switch to other tabs or windows
✗ Do NOT open other applications

Penalties:
• 1st switch: -30 points + warning
• 2nd switch: -30 points + critical warning
• 3rd switch: -30 points + TEST AUTO-SUBMITTED

Your test will be automatically submitted after 
3 tab switches. There are no exceptions.

Plan accordingly:
- Close all other tabs before starting
- Disable notifications
- Use a single monitor if possible
- Stay focused on the test tab
```

## FAQ

**Q: What if I accidentally click a notification?**
A: You get 2 warnings before auto-submit. Be careful!

**Q: Can I appeal an auto-submit?**
A: Contact your instructor. All tab switches are logged.

**Q: What counts as a tab switch?**
A: Any time the test tab loses visibility (Alt+Tab, clicking another tab, etc.)

**Q: Does minimizing count?**
A: Yes, any visibility change is detected.

**Q: Can I use multiple monitors?**
A: Yes, but don't switch to other tabs on any monitor.

## Comparison

| Policy | Old | New |
|--------|-----|-----|
| Penalty | -5 | **-30** |
| Max | ∞ | **3** |
| Auto-Submit | No | **Yes** |
| Severity | Low | **Critical** |

## Summary

The tab switch policy is now **6x more severe** with a **hard limit of 3 switches** before automatic test submission. This provides a strong deterrent while still allowing for 1-2 accidental switches.

**Key Takeaway**: Stay on the test tab. After 3 switches, your test will be automatically submitted with a severely reduced integrity score.
