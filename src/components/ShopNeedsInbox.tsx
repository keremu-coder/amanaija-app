"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function metres(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = (bLat - aLat) * 111320;
  const dLng = (bLng - aLng) * 111320 * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// Shop owner side of "Ask the Street": nearby requests with Have it / Can get it / No.
export default function ShopNeedsInbox({ place }: { place: any }) {
  const [needs, setNeeds] = useState<any[]>([]);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [price, setPrice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    // Preferred: a database function that returns only requests near this shop. Falls back to the older direct read until it is installed.
    let { data: n, error: fnErr } = await supabase.rpc("nearby_needs", { p_place: place.id });
    if (fnErr) {
      ({ data: n } = await supabase
        .from("needs").select("id,body,lat,lng,created_at")
        .eq("status", "open").gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(60));
    }
    const near = ((n as any[]) || []).filter((x) => metres(place.lat, place.lng, x.lat, x.lng) <= 3500).slice(0, 15);
    setNeeds(near);
    if (near.length) {
      const { data: r } = await supabase.from("need_replies").select("need_id").eq("shop_id", place.id).in("need_id", near.map((x) => x.id));
      setAnswered(new Set(((r as any[]) || []).map((x) => x.need_id)));
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 12000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id]);

  const reply = async (needId: string, answer: "have" | "can_get" | "no") => {
    setBusy(needId); setMsg("");
    const { error } = await supabase.from("need_replies").insert({
      need_id: needId, shop_id: place.id, answer, price_text: (price[needId] || "").trim().slice(0, 30) || null,
    });
    setBusy("");
    if (error) { setMsg("Could not send your answer. Please try again."); return; }
    setAnswered((s) => new Set(s).add(needId));
  };

  const open = needs.filter((n) => !answered.has(n.id));
  return (
    <div className="mb-4 rounded-xl border border-[#DCE5DE] bg-white p-3">
      <p className="mb-2 text-sm font-bold text-[#17131F]">People near you are asking</p>
      {open.length === 0 && <p className="text-xs text-gray-600">No new requests near you right now.</p>}
      {open.map((n) => (
        <div key={n.id} className="mb-3 rounded-lg bg-[#F8FAF9] p-2">
          <p className="text-[15px] font-bold text-[#17131F]">{n.body}</p>
          <p className="mb-2 text-[11px] text-gray-500">About {(Math.round(metres(place.lat, place.lng, n.lat, n.lng) / 100) / 10).toFixed(1)} km from you</p>
          <input
            value={price[n.id] || ""}
            onChange={(e) => setPrice((p) => ({ ...p, [n.id]: e.target.value }))}
            placeholder="Price (optional)"
            className="mb-2 h-11 w-full rounded-lg border border-[#DCE5DE] bg-white px-3 text-[16px]"
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy === n.id} onClick={() => reply(n.id, "have")} className="h-11 flex-1 rounded-lg bg-[#1F7A4D] text-sm font-bold text-white active:scale-95 disabled:opacity-60">Have it</button>
            <button type="button" disabled={busy === n.id} onClick={() => reply(n.id, "can_get")} className="h-11 flex-1 rounded-lg bg-[#F4B73F] text-sm font-bold text-[#17131F] active:scale-95 disabled:opacity-60">Can get it</button>
            <button type="button" disabled={busy === n.id} onClick={() => reply(n.id, "no")} className="h-11 flex-1 rounded-lg border border-gray-300 bg-white text-sm font-bold text-gray-700 active:scale-95 disabled:opacity-60">No</button>
          </div>
        </div>
      ))}
      {msg && <p className="text-xs font-medium text-[#B3261E]">{msg}</p>}
    </div>
  );
}
