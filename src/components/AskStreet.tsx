"use client";

import { playSend } from "@/lib/ui-sound";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function metres(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = (bLat - aLat) * 111320;
  const dLng = (bLng - aLng) * 111320 * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
const fmt = (d: number) => (d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`);

type Need = { id: string; body: string; created_at: string };
type Reply = { id: string; need_id: string; shop_id: string; answer: string; price_text: string | null };

// Buyer side of "Ask the Street": say what you need, nearby shops answer.
export default function AskStreet({ lat, lng, onClose }: { lat: number; lng: number; onClose: () => void }) {
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [needs, setNeeds] = useState<Need[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [shops, setShops] = useState<Record<string, any>>({});
  const [promo, setPromo] = useState<Set<string>>(new Set());

  const load = async (id: string) => {
    const { data: n } = await supabase
      .from("needs").select("id,body,created_at")
      .eq("user_id", id).eq("status", "open").gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(5);
    const list = (n as Need[]) || [];
    setNeeds(list);
    if (!list.length) { setReplies([]); return; }
    const { data: r } = await supabase
      .from("need_replies").select("id,need_id,shop_id,answer,price_text")
      .in("need_id", list.map((x) => x.id)).neq("answer", "no");
    const rs = (r as Reply[]) || [];
    setReplies(rs);
    const ids = Array.from(new Set(rs.map((x) => x.shop_id)));
    if (ids.length) {
      const { data: p } = await supabase.from("places").select("id,name,lat,lng,phone,open_time,close_time").in("id", ids);
      const map: Record<string, any> = {};
      (p || []).forEach((x: any) => { map[x.id] = x; });
      setShops(map);
    }
  };

  useEffect(() => {
    supabase.from("boosts").select("place_id").gt("ends_at", new Date().toISOString()).then(({ data }) => {
      if (data) setPromo(new Set((data as any[]).map((b) => b.place_id)));
    });
    supabase.auth.getSession().then(({ data }) => { setUid(data.session?.user?.id || null); setReady(true); });
  }, []);

  useEffect(() => {
    if (!uid) return;
    load(uid);
    const t = setInterval(() => { if (!document.hidden) load(uid); }, 10000);
    return () => clearInterval(t);
  }, [uid]);

  const ask = async () => {
    const body = text.trim();
    if (body.length < 3 || busy) return;
    if (/\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d/.test(body)) {
      setErr("Please do not put phone numbers here. Shops will see what you need, not your number.");
      return;
    }
    setBusy(true); setErr("");
    const { error } = await supabase.from("needs").insert({ body, lat: Math.round(lat / 0.005) * 0.005, lng: Math.round(lng / 0.005) * 0.005 });
    setBusy(false);
    if (error) { setErr(error.message.includes("Too many") ? "Too many requests. Please wait a little." : "Could not send. Please try again."); return; }
    setText("");
    if (uid) load(uid);
    try { playSend(); window.dispatchEvent(new CustomEvent("amanaija:asked")); } catch {}
  };

  const done = async (id: string) => {
    await supabase.from("needs").update({ status: "closed" }).eq("id", id);
    if (uid) load(uid);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex max-h-[80%] flex-col rounded-t-3xl bg-white shadow-2xl">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div>
          <p className="text-base font-bold text-[#17131F]">Ask the Street</p>
          <p className="text-xs text-gray-600">Tell nearby shops what you need. They answer, you pick the closest.</p>
        </div>
        <button type="button" onClick={onClose} className="h-11 shrink-0 rounded-full bg-gray-100 px-4 text-sm font-bold text-[#17131F] active:scale-95">Close</button>
      </div>

      {!ready ? null : !uid ? (
        <div className="px-6 py-10 text-center text-sm text-gray-700">Log in to ask nearby shops. This keeps shops safe from fake requests.</div>
      ) : (
        <>
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
                maxLength={120}
                placeholder="e.g. Starlink cable, barber, electric fan"
                aria-label="What do you need"
                className="h-12 min-w-0 flex-1 rounded-full bg-gray-100 px-5 text-[16px] text-[#17131F] outline-none focus:ring-2 focus:ring-[#1F7A4D]"
              />
              <button type="button" onClick={ask} disabled={busy || text.trim().length < 3} className="h-12 shrink-0 rounded-full bg-[#1F7A4D] px-5 text-[15px] font-bold text-white active:scale-95 disabled:opacity-50">Ask</button>
            </div>
            {err && <p className="mt-1 text-xs font-medium text-[#B3261E]">{err}</p>}
            <p className="mt-1 text-[11px] text-gray-500">Shops see what you need and your rough area only. Never your number.</p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
            {needs.length === 0 && <p className="py-4 text-sm text-gray-600">No open requests. Ask for something above.</p>}
            {needs.map((n) => {
              const rs = replies
                .filter((r) => r.need_id === n.id && shops[r.shop_id])
                .map((r) => ({ r, s: shops[r.shop_id], d: metres(lat, lng, shops[r.shop_id].lat, shops[r.shop_id].lng) }))
                .sort((a, b) => (promo.has(a.r.shop_id) === promo.has(b.r.shop_id) ? a.d - b.d : promo.has(a.r.shop_id) ? -1 : 1));
              return (
                <div key={n.id} className="rounded-2xl border border-[#DCE5DE] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-bold text-[#17131F]">{n.body}</p>
                    <button type="button" onClick={() => done(n.id)} className="h-9 shrink-0 rounded-full bg-[#E8EFEA] px-3 text-xs font-bold text-[#165C3A] active:scale-95">Found it</button>
                  </div>
                  {rs.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-600">Waiting for shops to answer. Check back in a few minutes.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {rs.map(({ r, s, d }) => (
                        <div key={r.id} className="rounded-xl bg-[#F8FAF9] p-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-bold text-[#17131F]">{s.name}</p>
                            <span className="shrink-0 text-xs font-bold text-[#165C3A]">{fmt(d)}</span>
                          </div>
                          <p className="text-xs text-gray-700">
                            {r.answer === "have" ? "Has it" : "Can get it"}{r.price_text ? ` · ${r.price_text}` : ""}{promo.has(r.shop_id) ? " · Promoted" : ""}
                          </p>
                          <div className="mt-2 flex gap-2">
                            {s.phone && <a href={`tel:${s.phone}`} className="flex h-11 flex-1 items-center justify-center rounded-lg bg-[#F4B73F] text-sm font-bold text-[#17131F] active:scale-95">Call</a>}
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=walking`} target="_blank" rel="noopener noreferrer" className="flex h-11 flex-1 items-center justify-center rounded-lg border border-[#DCE5DE] bg-white text-sm font-bold text-[#165C3A] active:scale-95">Directions</a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
