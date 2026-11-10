import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { CONDITIONS, publicPhoto } from "@/lib/listings";
import MarketGrid from "@/components/MarketGrid";

export const metadata: Metadata = { title: "Market | AmaNaija", description: "Buy and sell things you own with real people near you in Nigeria. Inspect before you pay." };

// The whole page is saved and served from the edge, then refreshed about once a minute, so it opens instantly.
async function getListings() {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await s.from("listings").select("slug,title,price_ngn,city,condition,category,photos,status").in("status", ["active", "reserved"]).eq("private_sale", false).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(60);
  return ((data as any[]) || []).map((l) => ({ slug: l.slug, title: l.title, price_ngn: l.price_ngn, city: l.city, condition: l.condition, category: l.category, status: l.status, small: publicPhoto(`t-${l.photos[0]}`), full: publicPhoto(l.photos[0]) }));
}

export default async function Market() {
  const items = await getListings();
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "12px 16px 80px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a href="/" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", fontWeight: 700, color: "#1F7A4D", textDecoration: "none" }}>← Map</a>
        <Link href="/sell" className="ama-primary" style={{ padding: "11px 18px", textDecoration: "none" }}>Sell something</Link>
      </div>
      <h1 style={{ fontSize: 26, margin: "8px 0" }}>Market</h1>
      <p style={{ fontSize: 13, color: "#6B6A68", margin: 0 }}>Anyone can look. You log in only to message a seller or to sell.</p>
      <MarketGrid items={items} conditions={CONDITIONS} />
    </main>
  );
}
