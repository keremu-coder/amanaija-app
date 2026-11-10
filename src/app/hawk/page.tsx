"use client";
import { useEffect, useRef, useState } from "react";
import { readPosition } from "@/lib/native";
import { supabase } from "@/lib/supabase";

// For people who sell while walking (groundnut, pure water, bread, recharge cards...). Opt-in, about 500 m accuracy, ends by itself after 3 hours.
export default function Hawk() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [name, setName] = useState("");
  const [items, setItems] = useState("");
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const pos = () => readPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });

  async function push() {
    const p = await pos();
    const { error } = await supabase.rpc("hawk_start", { p_name: name, p_items: items, p_lat: p.coords.latitude, p_lng: p.coords.longitude });
    if (error) throw new Error(error.message);
  }
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setAuthed(!!data.session); setReady(true);
      if (!data.session) return;
      const { data: me } = await supabase.rpc("hawk_me");
      if (me) { setName((me as any).name || ""); setItems((me as any).items || ""); setActive(!!(me as any).active); }
    });
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (active) timer.current = setInterval(() => { push().catch(() => {}); }, 120000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, name, items]);

  async function start() {
    setMsg(""); setBusy(true);
    try { await push(); setActive(true); setMsg("You are visible to buyers near you."); }
    catch (e: any) { setMsg(e?.code === 1 ? "Please allow location so buyers near you can find you." : e?.message || "Could not start. Try again."); }
    setBusy(false);
  }
  async function stop() { setBusy(true); await supabase.rpc("hawk_stop"); setActive(false); setMsg("You are hidden now."); setBusy(false); }

  const inp = { width: "100%", padding: 12, borderRadius: 12, border: "1px solid #E8E6DC", background: "#fff", marginTop: 4 } as const;
  if (!ready) return <main style={{ padding: 24 }}>Loading…</main>;
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "12px 16px 80px", fontFamily: "system-ui, sans-serif" }}>
      <button type="button" onClick={() => (history.length > 1 ? history.back() : (window.location.href = "/"))} style={{ minHeight: 44, border: "none", background: "none", fontSize: 15, fontWeight: 700, color: "#1F7A4D" }}>← Back</button>
      <h1 style={{ fontSize: 26, margin: "4px 0" }}>Hawking today?</h1>
      <p style={{ fontSize: 14, color: "#6B6A68", marginTop: 0 }}>Let people near you know you are walking around, so they can call you over. Your place is shown only to about 500 metres, and you disappear by yourself after 3 hours.</p>
      {!authed ? <p><a href="/" style={{ color: "#1F7A4D", fontWeight: 700 }}>Log in</a> to start.</p> : (
        <>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginTop: 12 }}>Name people will see<input style={inp} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="Mama Ngozi" disabled={active} /></label>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginTop: 12 }}>What are you selling?<input style={inp} value={items} maxLength={80} onChange={(e) => setItems(e.target.value)} placeholder="Groundnut, pure water, plantain chips" disabled={active} /></label>
          {!active ? (
            <button type="button" disabled={busy || name.trim().length < 2 || items.trim().length < 2} onClick={start} className="ama-primary" style={{ width: "100%", marginTop: 16, padding: 14, fontSize: 16, opacity: busy || name.trim().length < 2 || items.trim().length < 2 ? 0.5 : 1 }}>I am hawking now</button>
          ) : (
            <>
              <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "#EAF5EE", fontSize: 14 }}>You are visible. Keep this page open so your place stays fresh. Buyers who want you will message you in Messages on the map.</div>
              <button type="button" disabled={busy} onClick={stop} className="ama-chip" style={{ width: "100%", marginTop: 10, padding: 14, fontSize: 16 }}>Stop for today</button>
            </>
          )}
          {msg && <p role="status" style={{ fontSize: 14, marginTop: 10 }}>{msg}</p>}
          <p style={{ fontSize: 12, color: "#6B6A68", marginTop: 20 }}>Safety: meet buyers in the open. Never share your phone number or bank details in messages. Report anyone who threatens you from the Messages screen.</p>
        </>
      )}
    </main>
  );
}
