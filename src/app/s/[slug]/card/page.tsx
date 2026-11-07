import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import PrintButton from "./PrintButton";

export const metadata: Metadata = { title: "Shop poster | AmaNaija", robots: { index: false, follow: false } };

async function Poster({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  let place: any = null;
  const byId = await s.from("places").select("id,name,category,handle,phone,open_time,close_time").eq("id", slug).maybeSingle();
  if (byId.data) place = byId.data;
  if (!place) {
    const byHandle = await s.from("places").select("id,name,category,handle,phone,open_time,close_time").eq("handle", slug.toLowerCase()).maybeSingle();
    if (byHandle.data) place = byHandle.data;
  }
  if (!place) notFound();

  const link = `https://amanaija.vercel.app/s/${place.handle || place.id}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=8&data=${encodeURIComponent(link)}`;

  return (
    <main className="min-h-dvh bg-[#FFFBF5] px-5 py-8 text-[#17131F]">
      <div className="mx-auto max-w-md space-y-5 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-[#165C3A]">Find us on AmaNaija</p>
        <h1 className="text-4xl font-extrabold leading-tight">{place.name}</h1>
        {place.category && <p className="text-base font-bold text-gray-600">{place.category}</p>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR code for ${place.name}`} width={280} height={280} className="mx-auto rounded-2xl border-4 border-[#17131F] bg-white p-2" />
        <p className="text-lg font-bold">Scan to see our shop, hours and location</p>
        {place.open_time && place.close_time && <p className="text-base">Open {place.open_time} to {place.close_time}</p>}
        {place.phone && <p className="text-xl font-extrabold">Call {place.phone}</p>}
        <p className="break-all text-sm text-gray-600">{link}</p>
        <PrintButton />
      </div>
    </main>
  );
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#FFFBF5]" />}>
      <Poster params={params} />
    </Suspense>
  );
}
