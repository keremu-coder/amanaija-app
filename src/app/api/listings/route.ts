import { adminDb, userIdFromReq } from "@/lib/authUser";
import { tooMany } from "@/lib/ratelimit";
import { BANNED_RE, CATEGORIES, CONDITIONS, OUTSIDE_RE, PHONE_RE, composeDescription, newSlug, proofCodeFor } from "@/lib/listings";

const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function POST(req: Request) {
  const limited = await tooMany(req, "listing-new", 10, 600);
  if (limited) return limited;
  const uid = await userIdFromReq(req);
  if (!uid) return Response.json({ error: "Please log in" }, { status: 401 });

  let b: any;
  try { b = await req.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }

  const title = s(b.title, 80), included = s(b.included, 200), faults = s(b.faults, 200), reason = s(b.reason, 150), extra = s(b.extra, 300);
  const category = s(b.category, 40), condition = s(b.condition, 20), city = s(b.city, 40);
  const price = Math.round(Number(b.price));
  const lat = Number(b.lat), lng = Number(b.lng);
  const photos: string[] = Array.isArray(b.photos) ? b.photos.map((x: unknown) => s(x, 120)) : [];
  const proof = s(b.proof, 120), code = s(b.proof_code, 4);

  if (title.length < 3) return Response.json({ error: "Add a clear title" }, { status: 400 });
  if (!CONDITIONS[condition]) return Response.json({ error: "Pick the condition" }, { status: 400 });
  if (!CATEGORIES.includes(category)) return Response.json({ error: "Pick a category" }, { status: 400 });
  if (!included || !faults || !reason) return Response.json({ error: "Fill in what is included, any faults and why you are selling" }, { status: 400 });
  if (!(price >= 100 && price <= 50000000)) return Response.json({ error: "Enter a price between 100 and 50,000,000 naira" }, { status: 400 });
  if (city.length < 2) return Response.json({ error: "Enter your city or area" }, { status: 400 });

  const text = [title, included, faults, reason, extra].join(" ");
  if (BANNED_RE.test(text)) return Response.json({ error: "This item cannot be listed on AmaNaija" }, { status: 400 });
  if (PHONE_RE.test(text) || OUTSIDE_RE.test(text)) return Response.json({ error: "Please remove phone numbers and chat or payment instructions. Buyers contact you safely through AmaNaija." }, { status: 400 });

  if (photos.length < 2 || photos.length > 7 || false) return Response.json({ error: "Add 2 to 7 of your own photos" }, { status: 400 });
  const { data: mine } = await adminDb.from("listing_photo_hashes").select("path,live,lat,lng,created_at").eq("seller_id", uid).in("path", [...photos, proof]);
  const own = new Map((mine || []).map((m: any) => [m.path, m]));
  if (photos.some((p) => !own.has(p)) || !own.has(proof)) return Response.json({ error: "Add 2 to 7 of your own photos and the proof photo" }, { status: 400 });
  if (code !== proofCodeFor(uid, 0) && code !== proofCodeFor(uid, 1)) return Response.json({ error: "Your proof code has expired. Reload the page for a new one." }, { status: 400 });

  // New sellers start small. Two completed sales raise the limit.
  const { count: active } = await adminDb.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", uid).in("status", ["active", "reserved"]);
  const { count: sold } = await adminDb.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", uid).eq("status", "sold");
  const { data: prof } = await adminDb.from("profiles").select("is_admin").eq("id", uid).maybeSingle();
  const cap = prof?.is_admin ? 1000 : 3; // raised only once sales are completed through AmaNaija
  if (!prof?.is_admin && price > 500000) return Response.json({ error: "New sellers can list items up to ₦500,000 for now." }, { status: 400 });
  if ((active ?? 0) >= cap) return Response.json({ error: `You can have ${cap} active listings for now. Mark one as sold to add another.` }, { status: 400 });

  // "Checked on location": proof photo taken live in the app, within the last 2 days, close to the listing area.
  let verified = false;
  const pr: any = own.get(proof);
  if (pr && pr.live && pr.lat != null && pr.lng != null && Number.isFinite(lat) && Number.isFinite(lng) && Date.now() - new Date(pr.created_at).getTime() < 172800000) {
    const dx = (pr.lat - lat) * 111, dy = (pr.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
    verified = Math.sqrt(dx * dx + dy * dy) <= 2;
  }
  const { data: handle } = await adminDb.rpc("anon_handle", { u: uid, prefix: "Seller" });
  const slug = newSlug();
  const { error } = await adminDb.from("listings").insert({
    seller_id: uid,
    seller_handle: handle || "Seller",
    slug, title, category, condition, city,
    description: composeDescription({ title, condition, included, faults, reason, extra }),
    price_ngn: price,
    lat: Number.isFinite(lat) ? Math.round(lat * 100) / 100 : null, // about 1 km, never the exact spot
    lng: Number.isFinite(lng) ? Math.round(lng * 100) / 100 : null,
    photos, proof_photo: proof, proof_code: code,
    private_sale: !!b.private_sale, verified,
  });
  if (error) return Response.json({ error: "Could not save the listing. Try again." }, { status: 500 });
  return Response.json({ slug });
}
