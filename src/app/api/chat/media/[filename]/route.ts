import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const FILENAME_PATTERN = /^[a-f0-9\-]{36}\.(jpg|png|webp|mp4|webm|mov)$/i;

export async function GET(
  req: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;

  // Validate filename format (blocks path traversal, probing)
  if (!FILENAME_PATTERN.test(filename)) {
    return new Response("Not found", { status: 404 });
  }

  const storagePath = `chat/aba-market/${filename}`;

  const { data, error } = await supabaseAdmin.storage
    .from("chat-media")
    .download(storagePath);

  if (error || !data) {
    return new Response("Not found", { status: 404 });
  }

  const arrayBuf = await data.arrayBuffer();
  const ext = filename.split(".").pop()!.toLowerCase();
  const contentType =
    ext === "jpg" || ext === "jpeg" ? "image/jpeg"
    : ext === "png" ? "image/png"
    : ext === "webp" ? "image/webp"
    : ext === "mp4" ? "video/mp4"
    : ext === "webm" ? "video/webm"
    : ext === "mov" ? "video/quicktime"
    : "application/octet-stream";

  return new Response(arrayBuf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}