// Proves to Android that this website and the AmaNaija Play Store app belong together.
// Set ANDROID_SHA256 in Vercel to the app signing certificate fingerprint(s) from Play Console, separated by commas.
export async function GET() {
  const prints = (process.env.ANDROID_SHA256 || "").split(",").map((s) => s.trim()).filter(Boolean);
  const body = prints.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "com.amanaija.app", sha256_cert_fingerprints: prints } }]
    : [];
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=300" },
  });
}
