# README Update Summary

## Changes Made to README.md

The main README.md has been updated with comprehensive behavioral tracking system documentation including architecture, flow diagrams, and setup instructions.

### Sections Added/Updated

#### 1. Integrity & Behavioral Tracking (Expanded)
**Location:** Feature Reference section

**Added:**
- Complete system architecture diagram showing client → server → database flow
- Tab switch policy with visual representation
- Behavioral fingerprinting table with flag thresholds
- Automatic flag generation explanation
- Database schema for behavioral_flags and behavioral_details tables
- Server-side integrity score trigger with complete SQL code
- Client-side hooks documentation (useBehavioralTracking, useIntegrityListeners)
- Setup instructions for behavioral tracking

**Key Highlights:**
```
┌─────────────────────────────────────────┐
│  CLIENT: MCQ/Debug Components           │
│  ↓ Tracks behavioral metrics            │
│  POST /attempts/:id/responses           │
├─────────────────────────────────────────┤
│  SERVER: Routes save to database        │
│  ↓ Triggers analyze data                │
│  Database: Auto-generate flags          │
├─────────────────────────────────────────┤
│  ADMIN: View flags & integrity scores   │
│  STUDENT: View own integrity report     │
└─────────────────────────────────────────┘
```

#### 2. Database Schema (Updated)
**Location:** Database Schema section

**Added:**
- behavioral_flags table to core tables list
- behavioral_details table to core tables list
- Complete SQL schema for both tables
- Updated key design decisions to include:
  - Automatic flag generation via triggers
  - Two-tier tracking (question-level + attempt-level)

#### 3. Supabase Migrations (Updated)
**Location:** Supabase Migrations section

**Added:**
- Behavioral tracking migration instructions
- Verification script command
- Expected output example
- Clear step-by-step migration order

#### 4. Setup Instructions (Updated)
**Location:** Setup Instructions section

**Added:**
- migration_behavioral_tables.sql to the migration order
- Verification script instructions
- Seed behavioral data instructions
- Expected output examples

#### 5. New Section: Behavioral Tracking System - Complete Guide
**Location:** End of README (new section)

**Added:**
- Quick setup guide (3 steps)
- Documentation file references
- Key features list
- Flag types and severity
- Integrity score formula
- Support information

### Visual Elements Added

#### Architecture Diagram
```
CLIENT SIDE
├─ MCQQuestion Component
│  └─ Tracks: time to first click, edit count
├─ DebugQuestion Component
│  └─ Tracks: WPM, paste, backspace, test runs, idle
└─ useIntegrityListeners Hook
   └─ Tracks: tab switches, focus loss
   
SERVER SIDE
├─ Routes
│  ├─ POST /attempts/:id/responses
│  └─ PATCH /attempts/:id/integrity
└─ Database Triggers
   ├─ auto_generate_behavioral_flags()
   ├─ auto_generate_attempt_level_flags()
   └─ compute_integrity_score()
```

#### Tab Switch Policy Visual
```
1st Switch:  -30 points  ⚠️  Warning
2nd Switch:  -30 points  🔴 Critical Warning
3rd Switch:  -30 points  🚨 AUTO-SUBMIT

MAX ALLOWED: 3 switches
CONSEQUENCE: Test automatically submitted
```

#### Behavioral Metrics Table
| Signal | What it detects | Flag Threshold |
|--------|----------------|----------------|
| time_to_first_keystroke | Pre-prepared answers | <3000ms = HIGH |
| wpm_consistency | Inhuman typing speed | >120 WPM = MEDIUM |
| backspace_count | Copy-paste detection | ≤2 + >100 WPM = HIGH |
| paste_events | Direct paste detection | ≥1 = HIGH |
| test_runs_before_submit | Hardcoded outputs | 0 runs = MEDIUM |
| idle_periods | External help seeking | >180s = MEDIUM |

### Code Examples Added

#### Database Trigger
```sql
CREATE OR REPLACE FUNCTION compute_integrity_score()
RETURNS TRIGGER AS $$
DECLARE
  v_tab_switches int; v_focus_lost int; v_score int := 100;
  v_high_flags int; v_med_flags int; v_sim boolean;
BEGIN
  -- Get attempt metrics
  SELECT tab_switches, focus_lost_count
  INTO v_tab_switches, v_focus_lost
  FROM attempts WHERE id = NEW.attempt_id;

  -- Count behavioral flags
  SELECT 
    COUNT(*) FILTER (WHERE severity = 'high'),
    COUNT(*) FILTER (WHERE severity = 'medium')
  INTO v_high_flags, v_med_flags
  FROM behavioral_flags WHERE attempt_id = NEW.attempt_id;

  -- Calculate score
  v_score := v_score - (COALESCE(v_tab_switches, 0) * 30);
  v_score := v_score - (COALESCE(v_focus_lost, 0) * 2);
  v_score := v_score - (COALESCE(v_high_flags, 0) * 15);
  v_score := v_score - (COALESCE(v_med_flags, 0) * 7);
  
  NEW.integrity_score := GREATEST(v_score, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Client-Side Hook Usage
```typescript
// Behavioral tracking for coding questions
const { meta, onKeyDown, onPaste, onRunCode } = 
  useBehavioralTracking(questionOpenTime);

editor.onKeyDown(onKeyDown);
editor.onDidPaste(onPaste);

// Integrity listeners for session tracking
useIntegrityListeners({
  attemptId: 'uuid',
  active: true,
  onEvent: (msg) => showToast(msg),
  onTabSwitchCount: (count) => {
    if (count >= 3) {
      showToast('🚨 3 tab switches — Auto-submitting!');
      setTimeout(() => handleSubmit(true, 'integrity_violation'), 1000);
    }
  }
});
```

### Documentation Cross-References

The README now includes clear references to:
- `BEHAVIORAL_TRACKING_IMPLEMENTATION.md` - Implementation guide
- `server/BEHAVIORAL_TRACKING_README.md` - Technical documentation
- `BEHAVIORAL_TRACKING_FLOW.md` - Visual flow diagrams
- `TAB_SWITCH_POLICY_CARD.md` - Quick reference card
- `SETUP_CHECKLIST.md` - Setup and testing checklist

### Key Improvements

1. **Comprehensive Architecture** - Clear visual representation of data flow
2. **Complete Setup Guide** - Step-by-step instructions with verification
3. **Database Schema** - Full SQL definitions for new tables
4. **Code Examples** - Real implementation code for triggers and hooks
5. **Visual Elements** - Diagrams, tables, and formatted examples
6. **Cross-References** - Links to detailed documentation files
7. **Quick Reference** - Summary section at the end for easy access

### Before vs After

**Before:**
- Basic mention of behavioral tracking
- Limited technical details
- No architecture diagrams
- No setup instructions for behavioral system

**After:**
- Complete system architecture with flow diagrams
- Detailed technical specifications
- Full database schema
- Step-by-step setup guide
- Code examples and verification scripts
- Cross-references to comprehensive documentation

### Impact

The README now serves as:
1. **Entry point** for understanding the behavioral tracking system
2. **Setup guide** with clear migration steps
3. **Architecture reference** with visual diagrams
4. **Quick reference** for flag types and scoring
5. **Navigation hub** to detailed documentation files

### Next Steps for Users

After reading the updated README, users can:
1. Understand the complete behavioral tracking architecture
2. Run the migration with confidence
3. Verify the setup is working correctly
4. Reference detailed documentation for specific needs
5. Troubleshoot issues using the provided guides

## Summary

The README.md has been transformed from a basic feature list to a comprehensive guide that includes:
- ✅ Complete system architecture
- ✅ Visual flow diagrams
- ✅ Database schema documentation
- ✅ Setup and verification instructions
- ✅ Code examples and usage patterns
- ✅ Cross-references to detailed docs
- ✅ Quick reference section

All behavioral tracking information is now properly documented in the main README with clear navigation to specialized documentation files for deeper dives.
