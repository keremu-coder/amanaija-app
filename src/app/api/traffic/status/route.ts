export async function GET() {
  const on = !!(process.env.TOMTOM_KEY || process.env.NEXT_PUBLIC_TOMTOM_KEY);
  return Response.json({ on }, { headers: { "Cache-Control": "public, max-age=300" } });
}
