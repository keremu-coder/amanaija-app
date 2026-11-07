"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { notifyOther } from "@/lib/push";

type H = { id: string; name: string; items: string; lat: number; lng: number; minutes_ago: number };
const km = (aLat: number, aLng: number, bLat: number, bLng: number) => Math.sqrt(((bLat - aLat) * 111) ** 2 + ((bLng - aLng) * 111 * Math.cos((aLat * Math.PI) / 180)) ** 2);

export default function Hawkers() {
  const [list, setList] = useState<H[] | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});

  async function load(lat: number, lng: number) {
    const { data, error } = await supabase.rpc("hawkers_near", { p_lat: lat, p_lng: lng });
    if (error) { setErr("Could not load hawkers. Try again."); return; }
    setList((data as H[]) || []);
  }
  useEffect(() => {
    if (!navigator.geolocation) { setErr("Your phone did not share a location."); setList([]); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { const c = { lat: p.coords.latitude, lng: p.coords.longitude }; setMe(c); load(c.lat, c.lng); },
      () => { setErr("Allow location to see hawkers walking near you."); setList([]); },
      { timeout: 10000, maximumAge: 60000 }
    );
    const t = setInterval(() => { if (!document.hidden && me) load(me.lat, me.lng); }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function call(h: H) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) { window.location.href = "/"; return; }
    const { data, error } = await supabase.rpc("call_hawker", { p_id: h.id, p_note: note[h.id] || "I want to buy" });
    if (error) { setNote((n) => ({ ...n, [h.id + "!"]: error.message })); return; }
    if (data === "sent") notifyOther({ hid: h.id });
    setNote((n) => ({ ...n, [h.id + "!"]: data === "pending" ? "You already called this hawker. Wait for their reply in Messages." : "Sent. They will reply in Messages." }));
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "12px 16px 80px", fontFamily: "system-ui, sans-serif" }}>
      <button type="button" onClick={() => (history.length > 1 ? history.back() : (window.location.href = "/"))} style={{ minHeight: 44, border: "none", background: "none", fontSize: 15, fontWeight: 700, color: "#1F7A4D" }}>← Back</button>
      <h1 style={{ fontSize: 26, margin: "4px 0" }}>Hawkers near you</h1>
      <p style={{ fontSize: 13, color: "#6B6A68", marginTop: 0 }}>People walking around selling right now. Distances are rough, about 500 metres. Anyone can look; you log in to call one over.</p>
      {err && <p style={{ color: "#B3261E", fontSize: 14 }}>{err}</p>}
      {list === null && !err && <p>Looking…</p>}
      {list && list.length === 0 && !err && <p style={{ color: "#6B6A68" }}>No hawkers active near you right now.</p>}
      {list?.map((h) => (
        <div key={h.id} className="ama-card" style={{ padding: 12, marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <b style={{ fontSize: 16 }}>{h.name}</b>
            <span style={{ fontSize: 12, color: "#1F7A4D", fontWeight: 700 }}>{me ? `about ${Math.max(0.1, Math.round(km(me.lat, me.lng, h.lat, h.lng) * 10) / 10)} km` : ""}</span>
          </div>
          <div style={{ fontSize: 14, margin: "2px 0 8px" }}>{h.items}</div>
          <div style={{ fontSize: 12, color: "#6B6A68", marginBottom: 8 }}>Updated {h.minutes_ago < 1 ? "just now" : `${h.minutes_ago} min ago`}</div>
          <input value={note[h.id] || ""} onChange={(e) => setNote((n) => ({ ...n, [h.id]: e.target.value.slice(0, 80) }))} placeholder="Where are you? What do you want?" style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E8E6DC" }} />
          <button type="button" onClick={() => call(h)} className="ama-primary" style={{ width: "100%", marginTop: 8, padding: 12 }}>Call over</button>
          {note[h.id + "!"] && <div role="status" style={{ fontSize: 13, marginTop: 6 }}>{note[h.id + "!"]}</div>}
        </div>
      ))}
    </main>
  );
}
