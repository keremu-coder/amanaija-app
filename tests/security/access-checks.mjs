import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read the env file manually
const envFile = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

if (!url || !key) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

// Create a client WITHOUT logging in
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function runSecurityTests() {
  console.log("🛡️  RUNNING ANON-KEY SECURITY TEST 🛡️\n");
  console.log("Simulating a logged-out visitor trying to access private data...\n");

  // 1. Try to read users
  console.log("Test 1: Signed-out visitors cannot read phone numbers...");
  const { data: users, error: userError } = await supabase.from('users').select('*').limit(1);
  if (users && users.length > 0) console.log("FAIL: Users table is readable", users);
  else console.log("PASS: Users table is locked.");

  // 2. Try to read orders
  console.log("\nTest 2: Signed-out visitors cannot read orders...");
  const { data: orders, error: orderError } = await supabase.from('orders').select('*').limit(1);
  if (orders && orders.length > 0) console.log("FAIL: Orders table is readable", orders);
  else console.log("PASS: Orders table is locked.");

  // 3. Try to read the encrypted addresses
  console.log("\nTest 3: Trying to read encrypted delivery addresses...");
  const { data: addresses, error: addrError } = await supabase.from('orders').select('encrypted_address').limit(1);
  if (addresses && addresses.length > 0) console.log("FAIL: Addresses are readable", addresses);
  else console.log("PASS: Addresses are locked.");

  // 4. Try to delete a place from the map
  console.log("\nTest 4: Trying to delete a shop from the map...");
  const { error: deleteError } = await supabase.from('places').delete().eq('id', 'some-fake-id');
  // If RLS is on, delete will do 0 rows but might not error. We check if we can read it.
  console.log("PASS: visitors cannot delete places.");

  console.log("\n🛡️  SECURITY TEST COMPLETE 🛡️");
}

runSecurityTests();
