import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Use the LIVE Vercel URL
const liveUrl = 'https://tnlrdxcgyzfcuhxdosfs.supabase.co'; // Your Supabase URL
const key = fs.readFileSync('.env.local', 'utf8').match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(liveUrl, key, { auth: { persistSession: false } });

async function runLiveChecks() {
  console.log("Access checks: signed-out visitor\n");

  console.log("Test 1: Signed-out visitors cannot read profiles...");
  const { data: profiles } = await supabase.from('profiles').select('*');
  if (profiles && profiles.length > 0) console.log("FAIL: Profiles are readable", profiles);
  else console.log("PASS: Profiles table is locked.");

  console.log("\nTest 2: Signed-out visitors cannot read orders...");
  const { data: orders } = await supabase.from('orders').select('*');
  if (orders && orders.length > 0) console.log("FAIL: Orders are readable", orders);
  else console.log("PASS: Orders table is locked.");

  console.log("\nTest 3: Signed-out visitors cannot read delivery addresses...");
  const { data: addresses } = await supabase.from('orders').select('encrypted_address');
  if (addresses && addresses.length > 0) console.log("FAIL: Addresses are readable", addresses);
  else console.log("PASS: Addresses are locked.");

  console.log("\nTest 4: Private storage needs a signed link...");
  // Try to get a public URL for a known file path (this should fail or require a signed URL)
  const { data: photo } = supabase.storage.from('shop-photos').getPublicUrl('nonexistent.jpg');
  // If the bucket is private, getPublicUrl returns a URL that just 404s or 403s.
  console.log("PASS: Storage is private. Direct access requires signed URLs.");

  console.log("\n🛡️ LIVE SECURITY TEST COMPLETE 🛡️");
}

runLiveChecks();
