// Live traffic tiles, fetched on the server so the TomTom key is never sent to the browser.
// Tiles are cached at the edge, so many viewers of the same street cost one TomTom request.
export async function GET(_req: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const key = process.env.TOMTOM_KEY || process.env.NEXT_PUBLIC_TOMTOM_KEY;
  if (!key) return new Response(null, { status: 404 });

  const p = await params;
  const z = Number(p.z), x = Number(p.x), y = Number(p.y);
  if (![z, x, y].every((n) => Number.isInteger(n) && n >= 0) || z < 6 || z > 18 || x >= 2 ** z || y >= 2 ** z) {
    return new Response(null, { status: 400 });
  }

  try {
    const r = await fetch(`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/${z}/${x}/${y}.png?key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return new Response(null, { status: r.status === 403 ? 502 : r.status });
    return new Response(r.body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch {
    return new Response(null, { status: 504 });
  }
}
