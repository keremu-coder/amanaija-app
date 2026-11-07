import { ImageResponse } from "next/og";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { CONDITIONS, publicPhoto } from "@/lib/listings";

// The picture that shows when the link is shared on WhatsApp and similar: photo, price and title, so people see it without opening the link.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: l } = (await s.rpc("get_listing", { p_slug: slug })) as { data: any };
  if (!l) return new Response("Not found", { status: 404 });
  let photo = "";
  try {
    const r = await fetch(publicPhoto(l.photos[0]));
    const jpg = await sharp(Buffer.from(await r.arrayBuffer())).resize(630, 630, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
    photo = `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {}
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#FFFBF5" }}>
        {photo ? <img src={photo} width={630} height={630} style={{ objectFit: "cover" }} /> : <div style={{ width: 630, height: 630, background: "#DDF1E4" }} />}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 40, width: 570 }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#165C3A" }}>AmaNaija Market</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: "#17131F", lineHeight: 1.15 }}>{String(l.title).slice(0, 60)}</div>
            <div style={{ display: "flex", fontSize: 60, fontWeight: 800, color: "#0a7a3d", marginTop: 16 }}>{`₦${Number(l.price_ngn).toLocaleString("en-NG")}`}</div>
            <div style={{ display: "flex", fontSize: 26, color: "#555", marginTop: 12 }}>{`${CONDITIONS[l.condition] || ""} · ${l.city}`}</div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#555" }}>Seller photographed this item in the app</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } }
  );
}
