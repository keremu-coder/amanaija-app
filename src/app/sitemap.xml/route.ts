import { createClient } from "@supabase/supabase-js";
import { AREAS, TRADES } from "@/lib/seo";

const BASE = "https://amanaija.vercel.app";

// Lists claimed shops so Google can find their pages. Unclaimed places are left out.
export async function GET() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await s
    .from("places")
    .select("id,handle,category")
    .in("status", ["claimed", "verified"])
    .is("parent_id", null)
    .neq("category", "Residential")
    .limit(5000);

  const { data: lst } = await s.from("listings").select("slug").eq("status", "active").eq("private_sale", false).gt("expires_at", new Date().toISOString()).limit(2000);
  const items = (lst || []).map((l: any) => `<url><loc>${BASE}/p/${l.slug}</loc></url>`);
  const urls = (data || []).map((p: any) => `<url><loc>${BASE}/s/${encodeURIComponent(p.handle || p.id)}</loc></url>`);
  const finds = TRADES.flatMap((t) => AREAS.map((a) => `<url><loc>${BASE}/find/${t.slug}/${a.slug}</loc></url>`));
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${BASE}/</loc></url><url><loc>${BASE}/market</loc></url><url><loc>${BASE}/support</loc></url><url><loc>${BASE}/privacy</loc></url><url><loc>${BASE}/terms</loc></url>${urls.join("")}${items.join("")}${finds.join("")}</urlset>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
