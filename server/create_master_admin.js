// One-off script: create master_admin user for Krishna Singh
// Run from server/ directory: node --env-file=.env create_master_admin.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const EMAIL = 'krishnag@gmail.com';
const PASSWORD = '12345678';
const NAME = 'puddin';

async function main() {
  console.log('Creating master_admin user...\n');

  // 1. Create Supabase auth user
  const { data, error } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: NAME },
  });

  if (error) {
    console.error('✗ Auth user creation failed:', error.message);
    process.exit(1);
  }

  console.log(`✓ Auth user created: ${data.user.id}`);

  // 2. Insert into public.users with master_admin role
  const { error: insertErr } = await supabase.from('users').insert({
    id: data.user.id,
    name: NAME,
    email: EMAIL,
    role: 'master_admin',
  });

  if (insertErr) {
    console.error('✗ Profile insert failed:', insertErr.message);
    process.exit(1);
  }

  console.log(`✓ Profile created with role: master_admin`);
  console.log(`\n✅ Done! Login with:`);
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
}

main();
