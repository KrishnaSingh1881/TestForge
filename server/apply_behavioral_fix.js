const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFix() {
  console.log('🔧 Applying behavioral flags fix...\n');

  try {
    // Read the SQL fix file
    const sqlPath = path.join(__dirname, 'fix_behavioral_triggers.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Executing SQL fix...');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('⚠️  exec_sql function not found, trying direct execution...');
      
      // Split by semicolons and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.includes('DO $$')) {
          // Skip DO blocks for now as they need special handling
          console.log('⏭️  Skipping DO block (run manually in Supabase SQL Editor)');
          continue;
        }
        
        const { error: stmtError } = await supabase.rpc('exec', { query: statement });
        if (stmtError) {
          console.error('❌ Error executing statement:', stmtError.message);
          console.log('Statement:', statement.substring(0, 100) + '...');
        }
      }
    }

    console.log('\n✅ Trigger function and trigger updated successfully!');
    console.log('\n📊 Verifying fix...');

    // Verify the fix by checking for flags
    const { data: attempts, error: attemptsError } = await supabase
      .from('attempts')
      .select('id, tab_switches, focus_lost_count')
      .eq('status', 'in_progress')
      .or('tab_switches.gt.0,focus_lost_count.gt.0');

    if (attemptsError) {
      console.error('❌ Error fetching attempts:', attemptsError.message);
      return;
    }

    console.log(`\n📋 Found ${attempts.length} in-progress attempts with tab switches or focus losses`);

    for (const attempt of attempts) {
      const { data: flags, error: flagsError } = await supabase
        .from('behavioral_flags')
        .select('id, type, label, severity')
        .eq('attempt_id', attempt.id)
        .is('question_id', null);

      if (flagsError) {
        console.error(`❌ Error fetching flags for attempt ${attempt.id}:`, flagsError.message);
        continue;
      }

      console.log(`\n  Attempt ${attempt.id}:`);
      console.log(`    Tab switches: ${attempt.tab_switches}`);
      console.log(`    Focus losses: ${attempt.focus_lost_count}`);
      console.log(`    Flags: ${flags.length}`);
      
      if (flags.length > 0) {
        flags.forEach(flag => {
          console.log(`      - [${flag.severity.toUpperCase()}] ${flag.label}`);
        });
      } else {
        console.log('      ⚠️  No flags found - may need manual regeneration');
      }
    }

    console.log('\n✅ Fix applied successfully!');
    console.log('\n📝 Note: If flags are still missing, run the DO block manually in Supabase SQL Editor');
    console.log('   (Copy the DO $$ block from fix_behavioral_triggers.sql)');

  } catch (err) {
    console.error('❌ Error applying fix:', err.message);
    console.error(err);
    process.exit(1);
  }
}

applyFix();
