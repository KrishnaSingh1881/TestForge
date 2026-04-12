// TestForge — Behavioral Data Patch Seed
// Run: node --env-file=.env seed_behavioral.js
// Patches existing attempts with rich behavioral data for Integrity demo

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const log  = (msg) => console.log(`\n✓ ${msg}`);
const err  = (msg, e) => console.error(`\n✗ ${msg}:`, e?.message || e);
const r    = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ── Behavioral profiles per student ──────────────────────────────────────────
//   suspicious: paste events, fast start, no backspaces, high WPM, no test runs
//   normal:     realistic WPM, corrections, idle periods, multiple test runs
//   idle:       long waiting times, low engagement

const PROFILES = {
  'rohan@testforge.dev':   'cheater',    // worst offender
  'tanvir@testforge.dev':  'cheater',    // second suspect
  'arjun@testforge.dev':   'suspicious', // borderline
  'priya@testforge.dev':   'normal',
  'sneha@testforge.dev':   'normal',
  'vikram@testforge.dev':  'idle',       // waited too long, disengaged
  'ananya@testforge.dev':  'normal',
  'karan@testforge.dev':   'suspicious',
  'meera@testforge.dev':   'normal',
  'divya@testforge.dev':   'idle',
};

function generateBehavioralMeta(profile, isDebugging = false) {
  switch (profile) {
    case 'cheater':
      return {
        time_to_first_keystroke: r(800, 3000),          // < 3s — too fast
        wpm_consistency:         r(140, 210),            // super high WPM
        backspace_count:         r(0, 2),                // almost no corrections — pre-typed
        edit_count:              r(1, 2),
        paste_events:            r(2, 5),                // KEY FLAG: paste detected
        test_runs_before_submit: isDebugging ? 0 : null, // submitted without testing
        idle_periods:            [],                      // no idle — zoomed through
        data_mismatch:           true,                   // WPM vs code length mismatch
      };
    case 'suspicious':
      return {
        time_to_first_keystroke: r(3000, 8000),
        wpm_consistency:         r(90, 130),
        backspace_count:         r(2, 8),
        edit_count:              r(2, 4),
        paste_events:            r(1, 2),
        test_runs_before_submit: isDebugging ? r(0, 1) : null,
        idle_periods:            [{ start: r(30, 60), duration: r(5, 15) }],
        data_mismatch:           false,
      };
    case 'idle':
      return {
        time_to_first_keystroke: r(180000, 600000),     // 3–10 min wait before typing
        wpm_consistency:         r(10, 25),             // very slow
        backspace_count:         r(5, 20),
        edit_count:              r(2, 5),
        paste_events:            0,
        test_runs_before_submit: isDebugging ? r(1, 3) : null,
        idle_periods: [
          { start: r(0, 30),    duration: r(120, 300) }, // 2–5 min idle at start
          { start: r(120, 200), duration: r(60, 180) },  // another idle mid-session
        ],
        data_mismatch: false,
      };
    default: // normal
      return {
        time_to_first_keystroke: r(8000, 30000),
        wpm_consistency:         r(35, 75),
        backspace_count:         r(15, 60),
        edit_count:              r(5, 15),
        paste_events:            0,
        test_runs_before_submit: isDebugging ? r(2, 6) : null,
        idle_periods: [
          { start: r(60, 120), duration: r(15, 45) },
        ],
        data_mismatch: false,
      };
  }
}

function computeBehavioralFlags(meta, profile, tabSwitches, focusLost) {
  const flags = [];

  if ((meta.paste_events ?? 0) >= 1) {
    flags.push({ type: 'paste', label: `Paste event detected (${meta.paste_events}×)`, severity: 'high' });
  }
  if ((meta.time_to_first_keystroke ?? 99999) < 3000) {
    flags.push({ type: 'fast_start', label: 'Typed within 3s of opening question', severity: 'high' });
  }
  if ((meta.backspace_count ?? 99) <= 2 && (meta.wpm_consistency ?? 0) > 100) {
    flags.push({ type: 'no_corrections', label: 'No corrections at high WPM — likely pre-typed', severity: 'high' });
  }
  if ((meta.wpm_consistency ?? 0) > 120) {
    flags.push({ type: 'high_wpm', label: `Extreme typing speed (${Math.round(meta.wpm_consistency)} WPM)`, severity: 'medium' });
  }
  if (meta.data_mismatch) {
    flags.push({ type: 'data_mismatch', label: 'WPM inconsistent with code complexity', severity: 'high' });
  }
  if (tabSwitches >= 3) {
    flags.push({ type: 'tab_switch', label: `Excessive tab switches (${tabSwitches}×)`, severity: tabSwitches >= 5 ? 'high' : 'medium' });
  }
  if (focusLost >= 5) {
    flags.push({ type: 'focus_loss', label: `Window focus lost ${focusLost} times`, severity: 'medium' });
  }
  if ((meta.idle_periods ?? []).some(p => p.duration > 200)) {
    flags.push({ type: 'long_idle', label: 'Unusually long idle period detected (>3 min)', severity: 'medium' });
  }
  if ((meta.test_runs_before_submit ?? 1) === 0) {
    flags.push({ type: 'no_test_run', label: 'Submitted debugging code without running tests', severity: 'medium' });
  }

  return flags;
}

async function patchAttempts() {
  log('Fetching all existing submitted attempts...');

  const { data: attempts, error } = await supabase
    .from('attempts')
    .select(`
      id, user_id, test_id, tab_switches, focus_lost_count,
      users ( email ),
      tests ( id, total_marks )
    `)
    .in('status', ['submitted', 'auto_submitted']);

  if (error || !attempts?.length) {
    err('Fetch attempts', error ?? 'No attempts found');
    return;
  }

  log(`Found ${attempts.length} attempts to patch\n`);

  // Get ALL question IDs (debugging + MCQ)
  const { data: allQuestions } = await supabase
    .from('question_bank')
    .select('id, type, marks')
    .order('type'); // debugging first

  const debugQs = (allQuestions ?? []).filter(q => q.type === 'debugging');
  const mcqQs   = (allQuestions ?? []).filter(q => q.type !== 'debugging');

  for (const attempt of attempts) {
    const user  = Array.isArray(attempt.users) ? attempt.users[0] : attempt.users;
    const email = user?.email;
    const profile = PROFILES[email] ?? 'normal';

    console.log(`  Patching [${profile.toUpperCase().padEnd(10)}] ${email}...`);

    const tabSwitches = attempt.tab_switches ?? 0;
    const focusLost   = attempt.focus_lost_count ?? 0;

    // ── 1. Clear old null-question responses ──────────────────────────────────
    await supabase.from('responses').delete().eq('attempt_id', attempt.id).is('question_id', null);

    // ── 2. Clear old behavioral data ─────────────────────────────────────────
    await supabase.from('behavioral_flags').delete().eq('attempt_id', attempt.id);
    await supabase.from('behavioral_details').delete().eq('attempt_id', attempt.id);

    // ── 3. Pick questions (3 MCQ + 1 debug) ──────────────────────────────────
    const chosenMcqs  = mcqQs.slice(0, 3);
    const chosenDebug = debugQs.slice(0, 1);
    const allChosen   = [...chosenMcqs, ...chosenDebug];

    let totalScore = 0;
    let totalMarks = 0;
    const allFlags = [];
    const allDetails = [];

    for (const q of allChosen) {
      const isDebug   = q.type === 'debugging';
      const meta      = generateBehavioralMeta(profile, isDebug);
      const isCorrect = profile === 'cheater' ? Math.random() > 0.1 : // cheaters get almost everything right
                        profile === 'idle'    ? Math.random() > 0.6 :
                        profile === 'normal'  ? Math.random() > 0.3 :
                                                Math.random() > 0.45;
      const marksAwarded = isCorrect ? q.marks : 0;
      totalScore += marksAwarded;
      totalMarks += q.marks;

      // Insert response with behavioral_meta
      const { error: rErr } = await supabase.from('responses').insert({
        attempt_id:           attempt.id,
        question_id:          q.id,
        is_correct:           isCorrect,
        marks_awarded:        marksAwarded,
        behavioral_meta:      meta,
        time_spent_seconds:   isDebug ? r(300, 1800) : r(30, 180),
        submitted_code:       isDebug ? generateFakeCode(profile) : null,
        language:             isDebug ? 'python' : null,
      });
      if (rErr) { err(`Response q=${q.id}`, rErr); continue; }

      // Collect behavioral details
      allDetails.push({
        attempt_id:              attempt.id,
        question_id:             q.id,
        time_to_first_keystroke: meta.time_to_first_keystroke,
        paste_events:            meta.paste_events ?? 0,
        backspace_count:         meta.backspace_count ?? 0,
        edit_count:              meta.edit_count ?? 0,
        wpm_consistency:         meta.wpm_consistency ?? 0,
        test_runs_before_submit: isDebug ? (meta.test_runs_before_submit ?? 0) : 0,
        idle_periods:            meta.idle_periods ?? [],
      });

      // Collect flags for this question
      const qFlags = computeBehavioralFlags(meta, profile, tabSwitches, focusLost);
      for (const f of qFlags) {
        allFlags.push({ ...f, attempt_id: attempt.id, question_id: q.id });
      }
    }

    // ── 4. Insert behavioral_details ─────────────────────────────────────────
    if (allDetails.length) {
      const { error: dErr } = await supabase.from('behavioral_details').insert(allDetails);
      if (dErr) err('behavioral_details', dErr);
    }

    // ── 5. Insert behavioral_flags ────────────────────────────────────────────
    if (allFlags.length) {
      const { error: fErr } = await supabase.from('behavioral_flags').insert(allFlags);
      if (fErr) err('behavioral_flags', fErr);
    }

    // ── 6. Recompute integrity score ─────────────────────────────────────────
    const highFlags   = allFlags.filter(f => f.severity === 'high').length;
    const medFlags    = allFlags.filter(f => f.severity === 'medium').length;
    let integrityScore = 100 - (highFlags * 15) - (medFlags * 7) - (tabSwitches * 5) - (focusLost * 2);
    integrityScore = Math.max(0, Math.min(100, integrityScore));

    // ── 7. Update result with new integrity score and scores ──────────────────
    const test = Array.isArray(attempt.tests) ? attempt.tests[0] : attempt.tests;
    const pct  = totalMarks ? Math.round((totalScore / totalMarks) * 100) : 0;

    await supabase.from('results')
      .update({ integrity_score: integrityScore, total_score: totalScore, percentage: pct })
      .eq('attempt_id', attempt.id);

    console.log(`    → ${allFlags.length} flags | integrity: ${integrityScore}% | score: ${totalScore}/${totalMarks}`);
  }

  log('Behavioral data patch complete!');
}

function generateFakeCode(profile) {
  if (profile === 'cheater') {
    // Perfect code pasted in — no typos, no evolution
    return `def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1`;
  }
  if (profile === 'idle') {
    // Minimal attempt
    return `def binary_search(arr, target):\n    return -1  # TODO`;
  }
  // Normal — partially correct with a typo fixed
  return `def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1  \n    return -1`;
}

async function main() {
  console.log('\n🔧 TestForge — Behavioral Data Patch\n' + '━'.repeat(48));
  try {
    await patchAttempts();
    console.log('\n' + '━'.repeat(48));
    console.log('✅ Done! Integrity flags now populated.\n');
    console.log('🔴 HIGH-RISK students: rohan, tanvir (paste + fast start + no corrections)');
    console.log('🟡 SUSPICIOUS:         arjun, karan (paste events)');
    console.log('🟠 IDLE/DISENGAGED:    vikram, divya (long idle, low WPM)');
    console.log('🟢 CLEAN:              priya, sneha, ananya, meera\n');
  } catch (e) {
    console.error('\n❌ Patch failed:', e);
    process.exit(1);
  }
}

main();
