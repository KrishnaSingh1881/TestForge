const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyAllFlags() {
  console.log('🔍 Verifying All Behavioral Flags\n');
  console.log('='.repeat(60));

  try {
    // 1. Check attempt-level flags (tab switches, focus loss)
    console.log('\n📊 ATTEMPT-LEVEL FLAGS (Tab Switches & Focus Loss)');
    console.log('-'.repeat(60));

    const { data: attempts, error: attemptsError } = await supabase
      .from('attempts')
      .select('id, tab_switches, focus_lost_count, status')
      .eq('status', 'in_progress')
      .or('tab_switches.gt.0,focus_lost_count.gt.0');

    if (attemptsError) {
      console.error('❌ Error fetching attempts:', attemptsError.message);
    } else {
      console.log(`Found ${attempts.length} attempts with violations\n`);

      for (const attempt of attempts) {
        const { data: flags, error: flagsError } = await supabase
          .from('behavioral_flags')
          .select('id, type, label, severity')
          .eq('attempt_id', attempt.id)
          .is('question_id', null);

        console.log(`Attempt ${attempt.id.substring(0, 8)}...`);
        console.log(`  Tab switches: ${attempt.tab_switches}`);
        console.log(`  Focus losses: ${attempt.focus_lost_count}`);
        console.log(`  Flags: ${flags?.length || 0}`);

        if (flags && flags.length > 0) {
          flags.forEach(flag => {
            const emoji = flag.severity === 'high' ? '🔴' : flag.severity === 'medium' ? '🟡' : '🟢';
            console.log(`    ${emoji} [${flag.type}] ${flag.label}`);
          });
        } else {
          console.log(`    ⚠️  No flags found!`);
        }
        console.log('');
      }
    }

    // 2. Check question-level flags (paste, fast start, etc.)
    console.log('\n📝 QUESTION-LEVEL FLAGS (Behavioral Patterns)');
    console.log('-'.repeat(60));

    const { data: responses, error: responsesError } = await supabase
      .from('responses')
      .select('id, attempt_id, question_id, behavioral_meta')
      .not('behavioral_meta', 'is', null)
      .limit(10);

    if (responsesError) {
      console.error('❌ Error fetching responses:', responsesError.message);
    } else {
      console.log(`Checking ${responses.length} responses with behavioral_meta\n`);

      for (const response of responses) {
        const meta = response.behavioral_meta;
        
        const { data: flags, error: flagsError } = await supabase
          .from('behavioral_flags')
          .select('id, type, label, severity')
          .eq('attempt_id', response.attempt_id)
          .eq('question_id', response.question_id);

        console.log(`Response ${response.id.substring(0, 8)}...`);
        console.log(`  Behavioral Meta:`);
        console.log(`    - Paste events: ${meta.paste_events || 0}`);
        console.log(`    - Time to first keystroke: ${meta.time_to_first_keystroke || 'N/A'}ms`);
        console.log(`    - Backspace count: ${meta.backspace_count || 0}`);
        console.log(`    - WPM: ${meta.wpm_consistency || 0}`);
        console.log(`    - Test runs: ${meta.test_runs_before_submit || 0}`);
        console.log(`  Flags: ${flags?.length || 0}`);

        if (flags && flags.length > 0) {
          flags.forEach(flag => {
            const emoji = flag.severity === 'high' ? '🔴' : flag.severity === 'medium' ? '🟡' : '🟢';
            console.log(`    ${emoji} [${flag.type}] ${flag.label}`);
          });
        } else {
          // Check if flags SHOULD have been created
          const shouldHaveFlags = [];
          if (meta.paste_events >= 1) shouldHaveFlags.push('paste');
          if (meta.time_to_first_keystroke < 3000) shouldHaveFlags.push('fast_start');
          if (meta.backspace_count <= 2 && meta.wpm_consistency > 100) shouldHaveFlags.push('no_corrections');
          if (meta.wpm_consistency > 120) shouldHaveFlags.push('high_wpm');
          if (meta.test_runs_before_submit === 0) shouldHaveFlags.push('no_test_run');

          if (shouldHaveFlags.length > 0) {
            console.log(`    ⚠️  Missing expected flags: ${shouldHaveFlags.join(', ')}`);
          } else {
            console.log(`    ✅ No flags expected (clean behavior)`);
          }
        }
        console.log('');
      }
    }

    // 3. Summary statistics
    console.log('\n📈 SUMMARY STATISTICS');
    console.log('-'.repeat(60));

    const { data: flagStats, error: statsError } = await supabase
      .from('behavioral_flags')
      .select('type, severity');

    if (statsError) {
      console.error('❌ Error fetching flag stats:', statsError.message);
    } else {
      const stats = {};
      flagStats.forEach(flag => {
        const key = `${flag.type} (${flag.severity})`;
        stats[key] = (stats[key] || 0) + 1;
      });

      console.log('\nFlag Type Distribution:');
      Object.entries(stats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });

      console.log(`\nTotal flags: ${flagStats.length}`);
    }

    // 4. Check for triggers
    console.log('\n🔧 TRIGGER STATUS');
    console.log('-'.repeat(60));

    const { data: triggers, error: triggersError } = await supabase
      .rpc('exec_sql', { 
        sql_query: `
          SELECT trigger_name, event_object_table, action_timing, event_manipulation
          FROM information_schema.triggers
          WHERE trigger_name IN ('trg_auto_behavioral_flags', 'trg_attempt_level_flags')
        ` 
      });

    if (!triggersError && triggers) {
      console.log('Triggers found:');
      triggers.forEach(t => {
        console.log(`  ✓ ${t.trigger_name} on ${t.event_object_table}`);
      });
    } else {
      console.log('⚠️  Could not verify triggers (may need manual check)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Verification complete!\n');

  } catch (err) {
    console.error('❌ Error during verification:', err.message);
    console.error(err);
  }
}

verifyAllFlags();
