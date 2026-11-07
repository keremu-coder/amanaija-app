import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { AREAS, TRADES } from "@/lib/seo";

export function generateStaticParams() {
  return TRADES.flatMap((t) => AREAS.map((a) => ({ trade: t.slug, area: a.slug })));
}

async function load(tradeSlug: string, areaSlug: string) {
  const trade = TRADES.find((t) => t.slug === tradeSlug);
  const area = AREAS.find((a) => a.slug === areaSlug);
  if (!trade || !area) return null;
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await s
    .from("places")
    .select("id,handle,name,category,phone,open_time,close_time,lat,lng,status,for_rent")
    .in("status", ["claimed", "verified"])
    .is("parent_id", null)
    .gte("lat", area.lat - area.box).lte("lat", area.lat + area.box)
    .gte("lng", area.lng - area.box).lte("lng", area.lng + area.box)
    .limit(300);
  const shops = ((data as any[]) || []).filter((p) => {
    if (tradeSlug === "house-for-rent") return !!p.for_rent;
    if (p.category === "Residential") return false; // private homes never appear in search pages
    const hay = `${p.name || ""} ${p.category || ""}`.toLowerCase();
    return trade.words.some((w) => hay.includes(w));
  }).slice(0, 30);
  return { trade, area, shops };
}

export async function generateMetadata({ params }: { params: Promise<{ trade: string; area: string }> }): Promise<Metadata> {
  const { trade, area } = await params;
  const f = await load(trade, area);
  if (!f) return { title: "Not found | AmaNaija" };
  const title = `${f.trade.label} in ${f.area.name}: find one near you | AmaNaija`;
  return {
    title,
    description: `${f.trade.problem} Browse ${f.trade.label.toLowerCase()} in ${f.area.name} on a live map, or ask nearby shops and see who has it.`,
    alternates: { canonical: `https://amanaija.vercel.app/find/${trade}/${area}` },
    // Pages with no real listings yet stay out of Google so we never publish thin content.
    robots: f.shops.length ? { index: true, follow: true } : { index: false, follow: true },
  };
}

async function Content({ params }: { params: Promise<{ trade: string; area: string }> }) {
  const { trade, area } = await params;
  const f = await load(trade, area);
  if (!f) notFound();
  const { trade: t, area: a, shops } = f!;
  const faq = [
    { q: `How do I find ${t.label.toLowerCase()} near me in ${a.name}?`, a: `Open AmaNaija, allow your location and tap Nearby. You see ${t.label.toLowerCase()} on a live map with distance, opening hours, a call button and directions.` },
    { q: `What if I cannot find what I need in ${a.name}?`, a: `Tap Need something and type what you want, for example "${t.ask}". Nearby shops are alerted and reply if they have it, so you only walk to a shop that has it.` },
    { q: "Is it free?", a: "Yes. AmaNaija is free for people looking for shops and services." },
  ];
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "FAQPage", mainEntity: faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "AmaNaija", item: "https://amanaija.vercel.app/" },
        { "@type": "ListItem", position: 2, name: `${t.label} in ${a.name}` },
      ] },
    ],
  };
  return (
    <main className="min-h-dvh bg-[#FFFBF5] text-[#17131F]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-xl space-y-6 px-4 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold leading-tight">{t.label} in {a.name}</h1>
        <p className="text-[16px] text-gray-700">{t.problem}</p>
        <div className="flex gap-2">
          <a href="/" className="flex-1 rounded-full bg-[#1F7A4D] px-4 py-3 text-center text-[15px] font-bold text-white active:scale-95">Open the live map</a>
          <a href="/" className="flex-1 rounded-full bg-[#F4B73F] px-4 py-3 text-center text-[15px] font-bold text-[#17131F] active:scale-95">Ask nearby shops</a>
        </div>
        <section>
          <h2 className="mb-3 text-xl font-extrabold">On AmaNaija now</h2>
          {shops.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-sm text-gray-600 shadow-sm">No {t.label.toLowerCase()} have joined in {a.name} yet. Own one, or know one? Add it free and be the first customers see.</p>
          ) : (
            <ul className="space-y-3">
              {shops.map((p: any) => (
                <li key={p.id} className="rounded-2xl bg-white p-3 shadow-sm">
                  <a href={`/s/${p.handle || p.id}`} className="block font-bold text-[#165C3A]">{p.name}</a>
                  <p className="text-xs text-gray-500">{p.category}{p.open_time && p.close_time ? ` · ${p.open_time} to ${p.close_time}` : ""}</p>
                  {p.phone && <a href={`tel:${p.phone}`} className="mt-2 inline-block rounded-full bg-[#F4B73F] px-4 py-2 text-sm font-bold text-[#17131F]">Call</a>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold">Common questions</h2>
          {faq.map((x) => (
            <div key={x.q}><p className="font-bold">{x.q}</p><p className="text-sm text-gray-700">{x.a}</p></div>
          ))}
        </section>
        <nav className="flex flex-wrap gap-2 pt-2">
          {TRADES.filter((x) => x.slug !== t.slug).map((x) => (
            <a key={x.slug} href={`/find/${x.slug}/${a.slug}`} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#165C3A] shadow-sm">{x.label} in {a.name}</a>
          ))}
        </nav>
      </div>
    </main>
  );
}

export default function FindPage({ params }: { params: Promise<{ trade: string; area: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#FFFBF5]" />}>
      <Content params={params} />
    </Suspense>
  );
}
