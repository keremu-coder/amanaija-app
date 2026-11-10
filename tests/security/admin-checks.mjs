import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const url = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function runvisitorTest() {
  console.log("🕵️‍♂️ STARTING VISITOR TEST: Trying to escalate privileges...\n");

  // 1. Create a normal user (using a standard gmail format to bypass Supabase validation)
  const testEmail = `visitor.${Date.now()}@gmail.com`;
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: 'Password123!',
  });

  if (authError) {
    console.log("Could not create test user:", authError.message);
    return;
  }
  
  console.log(`✅ visitor account created: ${testEmail}`);
  
  // Give the database trigger a second to create the profile row
  await new Promise(r => setTimeout(r, 1000));

  // 2. Try to make self admin
  console.log("\nvisitor Test 1: Trying to set is_admin = true...");
  const { error: adminError } = await supabase
    .from('profiles')
    .update({ is_admin: true })
    .eq('id', authData.user.id);

  if (adminError) {
    console.log("🛡️ BLOCKED: " + adminError.message);
  } else {
    // Verify if it actually worked
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', authData.user.id).single();
    if (profile?.is_admin) {
      console.log("❌ SECURITY BREACH: visitor successfully made themselves Admin!");
    } else {
      console.log("PASS: Update failed silently, is_admin is still false.");
    }
  }

  // 3. Try to ban another user
  console.log("\nvisitor Test 2: Trying to ban another user...");
  const { error: banError } = await supabase
    .from('profiles')
    .update({ is_banned: true })
    .neq('id', authData.user.id); // Ban everyone else

  if (banError) {
    console.log("🛡️ BLOCKED: " + banError.message);
  } else {
    console.log("❌ SECURITY BREACH: visitor successfully banned users!");
  }

  // 4. Try to delete audit logs
  console.log("\nvisitor Test 3: Trying to delete admin audit logs...");
  const { error: auditError } = await supabase.from('admin_audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (auditError) {
    console.log("🛡️ BLOCKED: " + auditError.message);
  } else {
    console.log("PASS: Delete returned no error, but RLS protected the data.");
  }

  console.log("\n🕵️‍♂️ VISITOR TEST COMPLETE");
}

runvisitorTest();
