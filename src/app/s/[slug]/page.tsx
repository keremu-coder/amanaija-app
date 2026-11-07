import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import ShareButtons from "./ShareButtons";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

async function load(slug: string) {
  const s = db();
  let place: any = null;

  const byId = await s.from("places").select("*").eq("id", slug).maybeSingle();
  if (byId.data) place = byId.data;

  if (!place) {
    // works once a "handle" column exists; ignored safely until then
    const byHandle = await s.from("places").select("*").eq("handle", slug.toLowerCase()).maybeSingle();
    if (byHandle.data) place = byHandle.data;
  }
  if (!place) return null;

  const { data: items } = await s.from("items").select("*").eq("shop_id", place.id);
  return { place, items: (items as any[]) || [] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) return { title: "Shop not found | AmaNaija" };
  const name = found.place.name || "Shop";
  const cat = found.place.category && found.place.category !== "Other" ? found.place.category : "Shop";
  const claimed = found.place.status === "claimed" || found.place.status === "verified";
  const desc = `${name}, ${cat.toLowerCase()} in Nigeria. See what they sell, opening hours, the real location and how to reach them on AmaNaija.`;
  const key = found.place.handle || found.place.id;
  return {
    title: `${name} (${cat}) | AmaNaija`,
    description: desc,
    alternates: { canonical: `https://amanaija.vercel.app/s/${key}` },
    robots: claimed ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: `${name} on AmaNaija`,
      description: desc,
      images: found.place.live_photo_url ? [found.place.live_photo_url] : undefined,
    },
  };
}

function naira(v: any) {
  const n = Number(v);
  if (!isFinite(n)) return "";
  return "₦" + n.toLocaleString("en-NG");
}

async function ShopContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  const { place, items } = found!;

  const name: string = place.name || "Shop";
  const photo: string | undefined = place.live_photo_url || undefined;
  const hasPos = typeof place.lat === "number" && typeof place.lng === "number";
  const directions = hasPos ? `https://www.google.com/maps?q=${place.lat},${place.lng}` : null;

  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    image: photo,
    url: `https://amanaija.vercel.app/s/${place.handle || place.id}`,
    telephone: place.phone || undefined,
    openingHours: place.open_time && place.close_time ? `Mo-Su ${place.open_time}-${place.close_time}` : undefined,
    geo: hasPos ? { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng } : undefined,
    address: { "@type": "PostalAddress", addressCountry: "NG" },
  };

  return (
    <main className="min-h-dvh bg-[#FFFBF5] text-[#17131F]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-xl pb-16">
        <div className="relative h-56 w-full bg-[#165C3A]">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={name} className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-3xl font-extrabold leading-tight text-white" style={{ fontFamily: "var(--font-bricolage, inherit)" }}>
              {name}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {place.category && (
                <span className="rounded-full bg-white/90 px-3 py-1 text-[12px] font-bold">{place.category}</span>
              )}
              {photo && (
                <span className="rounded-full bg-[#F4B73F] px-3 py-1 text-[12px] font-bold">Claimed on location</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5 px-4 pt-5">
          <ShareButtons name={name} />

          <div className="flex gap-2">
            <a
              href="/"
              className="flex-1 rounded-full bg-[#17131F] px-4 py-3 text-center text-[14px] font-bold text-white active:scale-95"
            >
              Order on AmaNaija
            </a>
            {place.phone && (
              <a
                href={`tel:${place.phone}`}
                className="rounded-full bg-[#F4B73F] px-4 py-3 text-[14px] font-bold text-[#17131F] active:scale-95"
              >
                Call
              </a>
            )}
            {directions && (
              <a
                href={directions}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border-2 border-[#17131F] px-4 py-3 text-[14px] font-bold active:scale-95"
              >
                Directions
              </a>
            )}
          </div>

          <section>
            <h2 className="mb-3 text-xl font-extrabold">What they sell</h2>
            {items.length === 0 ? (
              <p className="rounded-2xl bg-white p-4 text-sm text-gray-500 shadow-sm">
                No items listed yet. Check back soon.
              </p>
            ) : (
              <ul className="space-y-3">
                {items.map((it: any, i: number) => {
                  const img = it.image_url || it.photo_url || it.photo || null;
                  const title = it.name || it.title || "Item";
                  return (
                    <li key={it.id ?? i} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={title} loading="lazy" className="h-16 w-16 rounded-xl object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{title}</p>
                        {it.description && <p className="truncate text-xs text-gray-500">{it.description}</p>}
                      </div>
                      <p className="shrink-0 font-extrabold text-[#165C3A]">{naira(it.price)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <footer className="pt-6 text-center">
            <a href="/" className="text-[13px] font-bold text-[#165C3A] underline">
              Made on AmaNaija: the live Nigeria
            </a>
          </footer>
        </div>
      </div>
    </main>
  );
}

export default function ShopProfile({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#FFFBF5]" />}>
      <ShopContent params={params} />
    </Suspense>
  );
}
