// TestForge — Verify Behavioral Tracking Setup
// Run: node --env-file=.env verify_behavioral_setup.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const log = (msg, status = '✓') => console.log(`${status} ${msg}`);
const err = (msg) => console.log(`✗ ${msg}`);

async function verifySetup() {
  console.log('\n🔍 TestForge — Behavioral Tracking Verification\n' + '━'.repeat(50));

  let allGood = true;

  // 1. Check if behavioral_flags table exists
  console.log('\n📋 Checking Tables...');
  try {
    const { data, error } = await supabase.from('behavioral_flags').select('id').limit(1);
    if (error && error.message.includes('does not exist')) {
      err('behavioral_flags table does not exist');
      allGood = false;
    } else {
      log('behavioral_flags table exists');
    }
  } catch (e) {
    err(`behavioral_flags check failed: ${e.message}`);
    allGood = false;
  }

  try {
    const { data, error } = await supabase.from('behavioral_details').select('id').limit(1);
    if (error && error.message.includes('does not exist')) {
      err('behavioral_details table does not exist');
      allGood = false;
    } else {
      log('behavioral_details table exists');
    }
  } catch (e) {
    err(`behavioral_details check failed: ${e.message}`);
    allGood = false;
  }

  // 2. Check if responses table has behavioral_meta column
  console.log('\n📊 Checking Columns...');
  try {
    const { data, error } = await supabase
      .from('responses')
      .select('behavioral_meta')
      .limit(1);
    if (error) {
      err(`responses.behavioral_meta check failed: ${error.message}`);
      allGood = false;
    } else {
      log('responses.behavioral_meta column exists');
    }
  } catch (e) {
    err(`responses.behavioral_meta check failed: ${e.message}`);
    allGood = false;
  }

  // 3. Check if attempts table has integrity tracking columns
  try {
    const { data, error } = await supabase
      .from('attempts')
      .select('tab_switches, focus_lost_count')
      .limit(1);
    if (error) {
      err(`attempts integrity columns check failed: ${error.message}`);
      allGood = false;
    } else {
      log('attempts.tab_switches and focus_lost_count columns exist');
    }
  } catch (e) {
    err(`attempts integrity columns check failed: ${e.message}`);
    allGood = false;
  }

  // 4. Check for existing behavioral data
  console.log('\n📈 Checking Data...');
  try {
    const { data: flags, error: fErr } = await supabase
      .from('behavioral_flags')
      .select('id, type, severity')
      .limit(5);
    
    if (fErr) {
      err(`Could not query behavioral_flags: ${fErr.message}`);
    } else if (!flags || flags.length === 0) {
      log('No behavioral flags found (run seed_behavioral.js to populate)', '⚠️');
    } else {
      log(`Found ${flags.length} behavioral flags (sample)`);
      flags.forEach(f => {
        console.log(`   → ${f.type} (${f.severity})`);
      });
    }
  } catch (e) {
    err(`behavioral_flags data check failed: ${e.message}`);
  }

  try {
    const { data: details, error: dErr } = await supabase
      .from('behavioral_details')
      .select('id, wpm_consistency, paste_events')
      .limit(5);
    
    if (dErr) {
      err(`Could not query behavioral_details: ${dErr.message}`);
    } else if (!details || details.length === 0) {
      log('No behavioral details found (run seed_behavioral.js to populate)', '⚠️');
    } else {
      log(`Found ${details.length} behavioral detail records (sample)`);
      details.forEach(d => {
        console.log(`   → WPM: ${d.wpm_consistency}, Paste: ${d.paste_events}`);
      });
    }
  } catch (e) {
    err(`behavioral_details data check failed: ${e.message}`);
  }

  // 5. Check for responses with behavioral_meta
  try {
    const { data: responses, error: rErr } = await supabase
      .from('responses')
      .select('id, behavioral_meta')
      .not('behavioral_meta', 'is', null)
      .limit(3);
    
    if (rErr) {
      err(`Could not query responses with behavioral_meta: ${rErr.message}`);
    } else if (!responses || responses.length === 0) {
      log('No responses with behavioral_meta found', '⚠️');
    } else {
      log(`Found ${responses.length} responses with behavioral_meta (sample)`);
      responses.forEach(r => {
        const meta = r.behavioral_meta;
        console.log(`   → WPM: ${meta?.wpm_consistency ?? 'N/A'}, Paste: ${meta?.paste_events ?? 0}, Backspace: ${meta?.backspace_count ?? 0}`);
      });
    }
  } catch (e) {
    err(`responses behavioral_meta check failed: ${e.message}`);
  }

  // 6. Check integrity scores in results
  console.log('\n🛡️  Checking Integrity Scores...');
  try {
    const { data: results, error: resErr } = await supabase
      .from('results')
      .select('id, integrity_score, attempts ( tab_switches, focus_lost_count )')
      .not('integrity_score', 'is', null)
      .limit(5);
    
    if (resErr) {
      err(`Could not query results: ${resErr.message}`);
    } else if (!results || results.length === 0) {
      log('No results with integrity scores found', '⚠️');
    } else {
      log(`Found ${results.length} results with integrity scores`);
      results.forEach(r => {
        const attempt = Array.isArray(r.attempts) ? r.attempts[0] : r.attempts;
        console.log(`   → Score: ${r.integrity_score}/100 (Tab: ${attempt?.tab_switches ?? 0}, Focus: ${attempt?.focus_lost_count ?? 0})`);
      });
    }
  } catch (e) {
    err(`results integrity score check failed: ${e.message}`);
  }

  // Summary
  console.log('\n' + '━'.repeat(50));
  if (allGood) {
    console.log('✅ All checks passed! Behavioral tracking is properly set up.\n');
    console.log('Next steps:');
    console.log('  1. Run: node --env-file=.env seed_behavioral.js');
    console.log('  2. Open Admin Integrity App to view flags');
    console.log('  3. Test with real student attempts\n');
  } else {
    console.log('❌ Some checks failed. Please run the migration:\n');
    console.log('  psql <connection-string> -f migration_behavioral_tables.sql\n');
    console.log('  Or use Supabase SQL Editor to run the migration file.\n');
  }
}

async function main() {
  try {
    await verifySetup();
  } catch (e) {
    console.error('\n❌ Verification failed:', e);
    process.exit(1);
  }
}

main();
