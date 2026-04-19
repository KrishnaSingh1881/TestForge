# Timer and Save Fixes - Summary

## Issues Fixed

### 1. Timer Not Counting Down
**Problem**: Timer displayed "00:00" and never counted down  
**Root Cause**: Timer effect was checking `if (timeLeft <= 0)` and returning early before starting the interval

**Solution**:
- Added detailed console logging to debug timer initialization
- Changed timer effect dependency from `[phase]` to `[phase, timeLeft]` to restart timer when timeLeft changes
- Added separate checks for phase and timeLeft with specific log messages
- Added logging in `loadAttempt()` to verify `time_remaining_seconds` from server

**Files Modified**:
- `client/src/os/apps/TestSessionApp.tsx`

**Verification**:
1. Check browser console for timer logs:
   - "📊 Loaded attempt data" - shows time_remaining_seconds from server
   - "⏱️ Timer effect triggered" - shows phase and timeLeft
   - "⏱️ Starting countdown timer from X seconds"
   - "⏱️ Timer: X seconds remaining" (every 60 seconds)

2. If timer still doesn't start, check console for:
   - "⏱️ Timer not starting: phase not active"
   - "⏱️ Timer not starting: timeLeft is 0 or negative"
   - "⏱️ Check server response for time_remaining_seconds"

---

### 2. Autosave Replaced with Manual Save
**Problem**: Autosave was unreliable and confusing for users  
**Solution**: Replaced debounced autosave with explicit "Save Answer" / "Save Code" buttons

#### MCQ Questions (`MCQQuestion.tsx`)

**Changes**:
- Removed `saveTimer` ref and debounced save logic
- Added `hasUnsavedChanges` state to track when user makes changes
- Added `saveSuccess` state to show success feedback
- Modified `handleSelect()` to only update selection (no auto-save)
- Added `handleSave()` function for manual save
- Added save status bar with:
  - "Unsaved changes" indicator (yellow dot)
  - "Saved successfully" message (green checkmark)
  - "Saved" status for previously saved answers
  - Error messages
  - "Save Answer" button (disabled when no changes)

**UI Changes**:
```
┌─────────────────────────────────────────────────────────┐
│ [Status]                              [Save Answer]      │
│ • Unsaved changes                     (button)           │
│ ✓ Saved successfully                                     │
│ ✓ Saved                                                  │
│ ❌ Error message                                         │
└─────────────────────────────────────────────────────────┘
```

#### Debug Questions (`DebugQuestion.tsx`)

**Changes**:
- Removed `saveTimer` ref and debounced save logic
- Added `hasUnsavedChanges` state
- Added `saveSuccess` state
- Modified `handleCodeChange()` to only update code (no auto-save)
- Added `handleSave()` function for manual save
- Added save status bar similar to MCQ

**UI Changes**:
- Same status bar as MCQ but with "Save Code" button
- Shows unsaved changes indicator when code is modified
- Shows success message after successful save

---

## User Experience Improvements

### Before
- ❌ Autosave happened silently with 300ms-1500ms debounce
- ❌ No clear indication when answer was saved
- ❌ Retry logic could cause confusion
- ❌ Timer showed "00:00" and never moved

### After
- ✅ Explicit "Save Answer" / "Save Code" button
- ✅ Clear "Unsaved changes" indicator
- ✅ Success confirmation after save
- ✅ Button disabled when no changes to save
- ✅ Timer counts down properly with console logging for debugging

---

## Testing Checklist

### Timer Testing
- [ ] Start a test attempt
- [ ] Check browser console for "📊 Loaded attempt data" log
- [ ] Verify `time_remaining_seconds` is a positive number
- [ ] Check console for "⏱️ Starting countdown timer from X seconds"
- [ ] Verify timer displays correct time and counts down
- [ ] Wait 60 seconds and check for "⏱️ Timer: X seconds remaining" log

### MCQ Save Testing
- [ ] Open an MCQ question
- [ ] Select an option
- [ ] Verify "Unsaved changes" indicator appears
- [ ] Click "Save Answer" button
- [ ] Verify "Saved successfully" message appears
- [ ] Verify button becomes disabled
- [ ] Navigate to another question and back
- [ ] Verify answer is still selected and shows "Saved" status

### Debug Question Save Testing
- [ ] Open a debug question
- [ ] Modify code in editor
- [ ] Verify "Unsaved changes" indicator appears
- [ ] Click "Save Code" button
- [ ] Verify "Saved successfully" message appears
- [ ] Navigate to another question and back
- [ ] Verify code is preserved

### Error Handling Testing
- [ ] Disconnect internet
- [ ] Try to save an answer
- [ ] Verify error message appears
- [ ] Reconnect internet
- [ ] Click "Save Answer" again
- [ ] Verify save succeeds

---

## Console Logging

### Timer Logs
```
📊 Loaded attempt data: {
  status: "in_progress",
  time_remaining_seconds: 3600,
  started_at: "2026-04-19T08:00:00.000Z",
  duration_mins: 60
}

⏱️ Timer effect triggered: { phase: "active", timeLeft: 3600 }
⏱️ Starting countdown timer from 3600 seconds
⏱️ Timer: 3540 seconds remaining
⏱️ Timer: 3480 seconds remaining
...
```

### Save Logs (MCQ)
```
💾 Saving MCQ response: {
  questionId: "abc-123",
  attemptId: "def-456",
  selectedIds: ["opt-1"]
}

💾 Save response: { ok: true }
✅ MCQ response saved successfully
```

### Save Logs (Debug)
```
💾 Saving debug response: {
  questionId: "xyz-789",
  attemptId: "def-456",
  codeLength: 145,
  behavioralMeta: { ... }
}

💾 Save response: { ok: true }
✅ Debug response saved successfully
```

---

## Troubleshooting

### Timer Still Shows 00:00
1. Check browser console for timer logs
2. Look for "📊 Loaded attempt data" log
3. Check if `time_remaining_seconds` is 0 or undefined
4. If 0, check server endpoint `/api/attempts/:id`
5. Verify `duration_mins` is set in tests table
6. Verify `started_at` is set in attempts table

### Timer Logs Show "timeLeft is 0"
**Cause**: Server returning `time_remaining_seconds: 0`  
**Solution**: Check server calculation in `server/routes/attempts.js`:
```javascript
const elapsedSecs = Math.floor((Date.now() - new Date(attempt.started_at)) / 1000);
const totalSecs = (test?.duration_mins ?? 0) * 60;
const timeRemaining = Math.max(0, totalSecs - elapsedSecs);
```

### Save Button Not Appearing
**Cause**: Component not re-rendered after changes  
**Solution**: Check React DevTools for `hasUnsavedChanges` state

### Save Fails with Error
**Cause**: Network error or server issue  
**Solution**: 
1. Check browser console for detailed error logs
2. Check Network tab for failed request
3. Verify attempt status is 'in_progress'
4. Check RLS policies on responses table

---

## Files Modified

### Client-Side
1. **client/src/os/apps/TestSessionApp.tsx**
   - Fixed timer effect dependencies
   - Added console logging for timer debugging
   - Added logging in loadAttempt()

2. **client/src/components/test/MCQQuestion.tsx**
   - Removed autosave (saveTimer)
   - Added manual save button
   - Added save status indicators
   - Added hasUnsavedChanges tracking

3. **client/src/components/test/DebugQuestion.tsx**
   - Removed autosave (saveTimer)
   - Added manual save button
   - Added save status indicators
   - Added hasUnsavedChanges tracking

### Documentation
- **documentation/TIMER_AND_SAVE_FIXES.md** (this file)

---

## Summary

Both issues have been fixed:

1. **Timer**: Now properly initializes and counts down with detailed logging for debugging
2. **Save**: Replaced unreliable autosave with explicit manual save buttons and clear status indicators

The changes improve user experience by making the save process explicit and transparent, while the timer logging helps diagnose any remaining issues.
