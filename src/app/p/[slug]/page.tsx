import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { CONDITIONS, publicPhoto } from "@/lib/listings";
import ListingActions from "@/components/ListingActions";


async function load(slug: string) {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await s.rpc("get_listing", { p_slug: slug });
  return data as any;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const l = await load(slug);
  if (!l) return { title: "Listing not found" };
  const title = `${l.title} · ₦${l.price_ngn.toLocaleString("en-NG")} · ${l.city}`;
  const base = "https://amanaija.vercel.app";
  const desc = `${CONDITIONS[l.condition] || ""}. ${String(l.description).split("\n").slice(1, 3).join(" ")} Tap to see all photos and ask the seller. Inspect before you pay.`.slice(0, 280);
  const img = `${base}/p/${l.slug}/og`;
  return {
    title,
    description: desc,
    robots: l.private_sale ? { index: false, follow: false } : undefined,
    openGraph: { title, description: desc, url: `${base}/p/${l.slug}`, siteName: "AmaNaija Market", type: "website", images: [{ url: img, width: 1200, height: 630, alt: l.title }] },
    twitter: { card: "summary_large_image", title, description: desc, images: [img] },
  };
}

async function Body({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = await load(slug);
  if (!l) notFound();
  const sold = l.status === "sold";
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: l.title, image: l.photos.map(publicPhoto), description: l.description,
    offers: { "@type": "Offer", priceCurrency: "NGN", price: l.price_ngn, availability: l.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut", itemCondition: l.condition === "new" || l.condition === "open_box" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition" },
  };
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 80px", fontFamily: "system-ui, sans-serif" }}>
      {!l.private_sale && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />}
      <a href="/" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontSize: 15, fontWeight: 700, color: "#0a7a3d", textDecoration: "none" }}>← AmaNaija</a>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", margin: "12px 0", scrollSnapType: "x mandatory" }}>
        {l.photos.map((p: string) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p} src={publicPhoto(p)} alt={l.title} style={{ height: 280, maxWidth: "88%", borderRadius: 12, objectFit: "cover", scrollSnapAlign: "start", flex: "0 0 auto" }} />
        ))}
      </div>
      {sold && <div style={{ background: "#eee", padding: 10, borderRadius: 8, fontWeight: 700, marginBottom: 8 }}>This item has been sold</div>}
      {l.status === "reserved" && <div style={{ background: "#fff4d6", padding: 10, borderRadius: 8, fontWeight: 700, marginBottom: 8 }}>Reserved for a buyer</div>}
      <h1 style={{ fontSize: 22, margin: "4px 0" }}>{l.title}</h1>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#0a7a3d" }}>₦{l.price_ngn.toLocaleString()}</div>
      <div style={{ fontSize: 13, color: "#555", margin: "4px 0 12px" }}>{CONDITIONS[l.condition]} · {l.city} · {l.category}</div>
      <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.5 }}>{l.description}</div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #cfe9d8", background: "#f4fbf6", borderRadius: 12 }}>
        <div style={{ fontWeight: 700 }}>{l.seller_handle} · item photographed with today's code{l.verified ? " · 📷 photo taken live in the app" : ""}</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={publicPhoto(l.proof_photo)} alt="Item with proof code" style={{ marginTop: 8, height: 140, borderRadius: 8, objectFit: "cover" }} />
        <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>The seller wrote code <b>{l.proof_code}</b> on paper next to the item, so the photos are not copied from somewhere else.</div>
      </div>

      <div style={{ marginTop: 16, padding: 12, background: "#fff8e6", borderRadius: 12, fontSize: 13, lineHeight: 1.5 }}>
        <b>Stay safe:</b> meet in a busy public place in daytime. Open the box and test the item before you pay. Never send money in advance, never pay for "delivery" or "booking", and never share your bank PIN or OTP. AmaNaija will never ask you to.
      </div>
      {l.status !== "sold" && <ListingActions slug={l.slug} title={l.title} status={l.status} />}
    </main>
  );
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<main style={{ padding: 24 }}>Loading…</main>}><Body params={params} /></Suspense>;
}
