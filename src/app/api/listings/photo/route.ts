import crypto from "crypto";
import sharp from "sharp";
import { adminDb, userIdFromReq } from "@/lib/authUser";
import { tooMany } from "@/lib/ratelimit";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const limited = await tooMany(req, "listing-photo", 40, 600);
  if (limited) return limited;
  const uid = await userIdFromReq(req);
  if (!uid) return Response.json({ error: "Please log in" }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    const live = form.get("live") === "1";
    const lat = Number(form.get("lat")), lng = Number(form.get("lng"));
    if (!(file instanceof File)) return Response.json({ error: "No photo" }, { status: 400 });
    if (!TYPES.includes(file.type)) return Response.json({ error: "Use a JPG, PNG or WebP photo" }, { status: 400 });
    if (file.size > MAX) return Response.json({ error: "Photo is too big (max 8 MB)" }, { status: 400 });

    // Re-encode: applies rotation, shrinks it, and drops all hidden data such as GPS location.
    const out = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const hash = crypto.createHash("sha256").update(out).digest("hex");

    // A tiny fingerprint of how the picture looks, so a cropped or lightly edited copy is still recognised.
    const px = await sharp(out).resize(9, 8, { fit: "fill" }).greyscale().raw().toBuffer();
    let phash = "";
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) phash += px[y * 9 + x] > px[y * 9 + x + 1] ? "1" : "0";

    const FAIL = "We could not verify this photo. Please retake it with the camera in the app.";
    const { data: prev } = await adminDb.from("listing_photo_hashes").select("seller_id,path").eq("hash", hash).maybeSingle();
    if (prev && prev.seller_id !== uid) return Response.json({ error: FAIL }, { status: 409 });
    let path = prev?.path as string | undefined;
    if (!prev) {
      const { data: others } = await adminDb.from("listing_photo_hashes").select("phash").neq("seller_id", uid).not("phash", "is", null).limit(20000);
      const near = (others || []).some((o: any) => { let d = 0; for (let i = 0; i < 64; i++) if (o.phash[i] !== phash[i]) d++; return d <= 4; });
      if (near) return Response.json({ error: FAIL }, { status: 409 });
      path = `${crypto.randomUUID().replace(/-/g, "")}.webp`;
      await adminDb.from("listing_photo_hashes").insert({ hash, seller_id: uid, path, phash, live, lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null });
    }

    if (!path) path = `${crypto.randomUUID().replace(/-/g, "")}.webp`;
    const thumb = await sharp(out).resize({ width: 400, height: 400, fit: "cover" }).webp({ quality: 70 }).toBuffer();
    await adminDb.storage.from("listing-photos").upload(`t-${path}`, thumb, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    const { error } = await adminDb.storage.from("listing-photos").upload(path, out, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (error) return Response.json({ error: "Upload failed. Try again." }, { status: 500 });
    return Response.json({ path, url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-photos/${path}` });
  } catch {
    return Response.json({ error: "That file could not be read as a photo" }, { status: 400 });
  }
}
