import type { SupabaseClient } from "@supabase/supabase-js";

export type Life = {
  user_id: string;
  place_name: string;
  note: string;
  lat: number | null;
  lng: number | null;
  prior_note: string;
  prior_at: string | null;
  memory: { note: string; at: string }[];
  updated_at: string;
  is_out?: boolean;
  hello?: boolean;
};

const KEY = "amanaija_my_life_v1";

export function readCachedLife(): Life | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const x = JSON.parse(raw);
    if (!x || typeof x.place_name !== "string") return null;
    return x as Life;
  } catch {
    return null;
  }
}

export function writeCachedLife(life: Life | null) {
  try {
    if (!life) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(life));
  } catch {}
}

export function whenSaid(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const DAYS = "user_id,place_name,note,lat,lng,updated_at,prior_note,prior_at,memory";
const FULL = "user_id,place_name,note,lat,lng,updated_at,prior_note,prior_at";
const BASE = "user_id,place_name,note,lat,lng,updated_at";

function asMemory(value: unknown): { note: string; at: string }[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 7).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const note = (item as { note?: unknown }).note;
    const at = (item as { at?: unknown }).at;
    if (typeof note !== "string" || typeof at !== "string") return [];
    return [{ note: note.slice(0, 180), at }];
  });
}

function asLife(row: Record<string, unknown>): Life {
  return {
    user_id: String(row.user_id),
    place_name: String(row.place_name),
    note: String(row.note || ""),
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
    prior_note: typeof row.prior_note === "string" ? row.prior_note : "",
    prior_at: typeof row.prior_at === "string" ? row.prior_at : null,
    memory: asMemory(row.memory),
    updated_at: String(row.updated_at || ""),
    is_out: row.is_out === true,
    hello: row.hello !== false,
  };
}

async function take(run: (cols: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const first = await run(DAYS);
  if (!first.error) return first;
  if (/memory/i.test(first.error.message || "")) {
    const mid = await run(FULL);
    if (!mid.error) return mid;
    if (/prior_/i.test(mid.error.message || "")) return run(BASE);
    return mid;
  }
  if (/prior_/i.test(first.error.message || "")) return run(BASE);
  return first;
}

export async function fetchMyLife(db: SupabaseClient, userId: string): Promise<Life | null> {
  const res = await take((cols) => db.from("lives").select(cols).eq("user_id", userId).maybeSingle());
  if (res.error || !res.data) return null;
  return asLife(res.data as Record<string, unknown>);
}

function coord(n: number | null, min: number, max: number): number | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export async function saveMyLife(
  db: SupabaseClient,
  life: { user_id: string; place_name: string; note: string; lat: number | null; lng: number | null }
): Promise<{ life: Life | null; error: string | null }> {
  const row = {
    user_id: life.user_id,
    place_name: life.place_name.trim().slice(0, 60),
    note: life.note.trim().slice(0, 180),
    lat: coord(life.lat, -90, 90),
    lng: coord(life.lng, -180, 180),
  };
  const res = await take((cols) => db.from("lives").upsert(row, { onConflict: "user_id" }).select(cols).single());
  if (res.error || !res.data) return { life: null, error: res.error?.message || "Could not save" };
  const saved = asLife(res.data as Record<string, unknown>);
  writeCachedLife(saved);
  return { life: saved, error: null };
}

export async function setOut(db: SupabaseClient, userId: string, out: boolean) {
  await setPresence(db, userId, { is_out: out });
}

export async function setPresence(db: SupabaseClient, userId: string, patch: { is_out?: boolean; is_ghost?: boolean; hello?: boolean }) {
  await db.from("life_out").upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
}

export async function fetchLivesNear(db: SupabaseClient, lat: number, lng: number): Promise<Life[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return [];
  const near = await db.rpc("lives_nearby", { p_lat: lat, p_lng: lng });
  if (!near.error && Array.isArray(near.data)) {
    return (near.data as Record<string, unknown>[]).map(asLife).filter((x) => typeof x.lat === "number" && typeof x.lng === "number");
  }
  const res = await db.from("lives").select("user_id,place_name,lat,lng,updated_at")
    .gte("lat", lat - 0.03).lte("lat", lat + 0.03)
    .gte("lng", lng - 0.03).lte("lng", lng + 0.03)
    .limit(8);
  if (res.error || !Array.isArray(res.data)) return [];
  return (res.data as Record<string, unknown>[]).map(asLife).filter((x) => typeof x.lat === "number" && typeof x.lng === "number");
}
