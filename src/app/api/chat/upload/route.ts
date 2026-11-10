import { createClient } from "@supabase/supabase-js";
import { tooMany } from "@/lib/ratelimit";
import { publicName, userFromReq } from "@/lib/authUser";
import crypto from "crypto";
import sharp from "sharp";
import { stripVideoMeta } from "@/lib/stripVideoMeta";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function getIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}

function hashIp(ip: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16);
}

const memBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRate(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = memBuckets.get(key);
  if (b && b.resetAt > now) {
    if (b.count >= limit) return false;
    b.count += 1;
    return true;
  }
  memBuckets.set(key, { count: 1, resetAt: now + windowMs });
  return true;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(req: Request) {
  const __limited = await tooMany(req, "chat-up", 10, 60);
  if (__limited) return __limited;
  try {
    const user = await userFromReq(req);
    if (!user) return Response.json({ error: "Please log in to speak." }, { status: 401 });
    const userName = publicName(user);
    const form = await req.formData();
    const file = form.get("file");
    const clientId = String(form.get("client_id") || "");
    const parentId = form.get("parent_id");
    const roomId = "aba-market";

    if (!(file instanceof File)) {
      return Response.json({ error: "No file" }, { status: 400 });
    }
    if (!clientId) {
      return Response.json({ error: "Missing client_id" }, { status: 400 });
    }

    const isImage = IMAGE_TYPES.includes(file.type);
    const isVideo = VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      return Response.json(
        { error: "Only JPEG, PNG, WebP images or MP4, WebM, MOV videos are allowed." },
        { status: 400 }
      );
    }

    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (file.size > maxSize) {
      return Response.json(
        { error: `File too large. Max ${isImage ? "5MB for images" : "15MB for videos"}.` },
        { status: 400 }
      );
    }

    // Rate limits
    if (!checkRate(`client:${clientId}`, 3, 60_000)) {
      return Response.json({ error: "Slow down! Max 3 uploads per minute." }, { status: 429 });
    }
    const ip = getIp(req);
    if (ip && !checkRate(`ip:${hashIp(ip)}`, 5, 60_000)) {
      return Response.json({ error: "Too many uploads from your network. Try again shortly." }, { status: 429 });
    }

    const arrayBuf = await file.arrayBuffer();
    let rawBuffer: Buffer = Buffer.from(arrayBuf);
    let finalBuffer: Buffer = rawBuffer;
    let contentType = file.type;
    let ext: string;

    if (isImage) {
      // STRIP EXIF via sharp: rotate (applies EXIF orientation) then re-encode
      // Output is always JPEG, which drops all metadata blocks
      try {
        finalBuffer = await sharp(rawBuffer)
          .rotate()
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();
        contentType = "image/jpeg";
        ext = "jpg";
      } catch (e: any) {
        return Response.json({ error: "Failed to process image: " + e.message }, { status: 400 });
      }
    } else {
      // Video: blank out location/device tags (udta, meta) in place, no re-encode.
      finalBuffer = stripVideoMeta(finalBuffer, file.type);
      ext = file.type === "video/quicktime" ? "mov" : file.type === "video/webm" ? "webm" : "mp4";
    }

    const filename = `${crypto.randomUUID()}.${ext}`;
    const storagePath = `chat/${roomId}/${filename}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("chat-media")
      .upload(storagePath, finalBuffer, { contentType, upsert: false });

    if (upErr) {
      return Response.json({ error: "Storage upload failed: " + upErr.message }, { status: 500 });
    }

    // Store the proxy path, not the storage URL
    const proxyUrl = `/api/chat/media/${filename}`;

    let { data, error: dbErr } = await supabaseAdmin
      .from("messages")
      .insert({
        room_id: roomId,
        user_name: userName,
        user_id: user.id,
        body: null,
        media_url: proxyUrl,
        media_type: isImage ? "photo" : "video",
        parent_id: typeof parentId === "string" && parentId.length > 0 ? parentId : null,
        client_id: clientId,
      })
      .select()
      .single();
    if (dbErr && /user_id/i.test(dbErr.message || "")) {
      const again = await supabaseAdmin.from("messages").insert({
        room_id: roomId,
        user_name: userName,
        body: null,
        media_url: proxyUrl,
        media_type: isImage ? "photo" : "video",
        parent_id: typeof parentId === "string" && parentId.length > 0 ? parentId : null,
        client_id: clientId,
      }).select().single();
      data = again.data;
      dbErr = again.error;
    }

    if (dbErr) {
      return Response.json({ error: dbErr.message }, { status: 500 });
    }

    return Response.json({ ok: true, message: data });
  } catch (e: any) {
    return Response.json({ error: e.message || "Upload failed" }, { status: 500 });
  }
}