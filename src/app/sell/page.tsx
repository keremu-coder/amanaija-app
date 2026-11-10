"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import LiveCamera from "@/components/LiveCamera";
import { CATEGORIES, CONDITIONS } from "@/lib/listings";
import { readPosition, shareOrWhatsApp } from "@/lib/native";

type Mine = { id: string; slug: string; title: string; price_ngn: number; status: string; private_sale: boolean };

export default function Sell() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [mine, setMine] = useState<Mine[]>([]);
  const [f, setF] = useState({ title: "", category: CATEGORIES[2], condition: "open_box", price: "", city: "", included: "", faults: "None", reason: "", extra: "", private_sale: false });
  const [photos, setPhotos] = useState<string[]>([]);
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [copied, setCopied] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const auth = () => ({ Authorization: `Bearer ${token}` });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setToken(data.session?.access_token || null); setReady(true); });
    readPosition({ timeout: 5000, maximumAge: 60000 }).then((p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude })).catch(() => {});
  }, []);
  useEffect(() => {
    if (!token) return;
    fetch("/api/listings/code", { headers: auth() }).then((r) => r.json()).then((j) => setCode(j.code || ""));
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadMine() {
    const { data } = await supabase.rpc("my_listings");
    setMine((data as Mine[]) || []);
  }
  // Fetch that gives up after 40s and tries once more, so a weak connection never leaves the screen stuck.
  async function sturdyFetch(url: string, init: RequestInit): Promise<Response | null> {
    for (let i = 0; i < 2; i++) {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 40000);
      try { return await fetch(url, { ...init, signal: ctl.signal }); } catch { /* try again */ } finally { clearTimeout(t); }
    }
    return null;
  }
  async function upload(file: Blob, pos?: { lat: number; lng: number } | null): Promise<string | null> {
    const fd = new FormData(); fd.append("file", new File([file], "shot.jpg", { type: "image/jpeg" })); fd.append("live", "1");
    if (pos) { fd.append("lat", String(pos.lat)); fd.append("lng", String(pos.lng)); }
    const r = await sturdyFetch("/api/listings/photo", { method: "POST", headers: auth(), body: fd });
    if (!r) { setErr("Your connection is weak. Take the photo again when the signal is better."); return null; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || "Upload failed"); return null; }
    return j.path;
  }
  async function addPhoto(blob: Blob, pos: { lat: number; lng: number } | null) {
    setErr(""); setBusy(true);
    const p = await upload(blob, pos);
    if (p) setPhotos((x) => (x.length < 7 ? [...x, p] : x));
    setBusy(false);
  }
  async function addProof(blob: Blob, pos: { lat: number; lng: number } | null) {
    setErr(""); setBusy(true);
    const p = await upload(blob, pos);
    if (p) setProof(p);
    setBusy(false);
  }
  async function submit() {
    setErr(""); setBusy(true);
    const r = await sturdyFetch("/api/listings", { method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify({ ...f, price: f.price.replace(/,/g, ""), photos, proof, proof_code: code, ...(coords || {}) }) });
    if (!r) { setBusy(false); setErr("Your connection is weak. Your photos are kept, so tap Post again."); return; }
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Could not post"); return; }
    setDone(`${window.location.origin}/p/${j.slug}`);
    setPhotos([]); setProof(""); loadMine(); window.scrollTo(0, 0);
  }
  async function setStatus(id: string, st: string) {
    const ask = st === "sold" ? "Mark this item as SOLD? Buyers will no longer be able to contact you." : st === "removed" ? "Remove this listing for good?" : "";
    if (ask && !window.confirm(ask)) return;
    const { error } = await supabase.rpc("set_listing_status", { p_id: id, p_status: st });
    if (error) setErr(error.message);
    loadMine();
  }

  const inp = { width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 15, marginTop: 4 } as const;
  const lab = { display: "block", fontSize: 13, fontWeight: 700, marginTop: 12 } as const;
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  if (!ready) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!token) return <main style={{ padding: 24, fontFamily: "system-ui" }}><h1>Sell your stuff</h1><p>Please log in first.</p><a href="/">Go to AmaNaija</a></main>;

  if (done) {
    const text = `${f.title} for ₦${Number(f.price.replace(/,/g, "")).toLocaleString("en-NG")} on AmaNaija: ${done}`;
    return (
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "40px 16px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <div style={{ fontSize: 56 }}>✅</div>
        <h1 style={{ fontSize: 24, margin: "8px 0" }}>Your listing is live!</h1>
        <p style={{ color: "#555", fontSize: 15 }}>Share the link. When people receive it on WhatsApp they will see the photo, price and title straight away, and tap only if they are interested.</p>
        <div style={{ wordBreak: "break-all", fontSize: 13, background: "#f4fbf6", border: "1px solid #cfe9d8", padding: 10, borderRadius: 10, margin: "12px 0" }}>{done}</div>
        <button type="button" onClick={() => { shareOrWhatsApp({ title: f.title, text, url: done }); }} style={{ display: "block", width: "100%", padding: 14, borderRadius: 12, border: "none", background: "#25d366", color: "#fff", fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Share</button>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(done); setCopied(true); }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "#0a7a3d", color: "#fff", fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{copied ? "Link copied ✓" : "Copy link"}</button>
        <a href={done.replace(window.location.origin, "")} style={{ display: "block", padding: 14, borderRadius: 12, background: "#f1f1f1", color: "#17131F", fontWeight: 700, textDecoration: "none", marginBottom: 8 }}>View my listing</a>
        <button type="button" onClick={() => { setDone(""); setCopied(false); setF({ ...f, title: "", price: "", included: "", reason: "", extra: "", faults: "None" }); window.scrollTo(0, 0); }} style={{ background: "none", border: "none", color: "#0a7a3d", fontWeight: 700, fontSize: 15, minHeight: 44 }}>List another item</button>
        <div><a href="/market" style={{ color: "#555", fontSize: 14 }}>Go to the Market</a></div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "16px 16px 320px", fontFamily: "system-ui, sans-serif" }}>
      <button type="button" onClick={() => (history.length > 1 ? history.back() : (window.location.href = "/"))} style={{ minHeight: 44, border: "none", background: "none", fontSize: 15, fontWeight: 700, color: "#0a7a3d" }}>← Back</button>
      <h1 style={{ fontSize: 22 }}>Sell something you own</h1>
      <p style={{ fontSize: 14, color: "#555" }}>Buyers see a nickname, never your name, phone or exact location. Meet at a public place; the buyer inspects the item and pays at handover. Your nickname stops hiding once you meet in person, so choose a safe place.</p>

      {done && (
        <div style={{ background: "#f4fbf6", border: "1px solid #cfe9d8", padding: 12, borderRadius: 12, margin: "12px 0" }}>
          <b>Your listing is live.</b> <a href={done.replace(window.location.origin, "")} style={{ fontWeight: 700 }}>View it</a>
          <div style={{ wordBreak: "break-all", fontSize: 13, margin: "6px 0" }}>{done}</div>
          <a href={`https://wa.me/?text=${encodeURIComponent("Check this out on AmaNaija: " + done)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
          {" · "}<button onClick={() => navigator.clipboard?.writeText(done)} style={{ border: "none", background: "none", color: "#0a7a3d", fontWeight: 700 }}>Copy link</button>
        </div>
      )}

      <label style={lab}>What are you selling?<input style={inp} value={f.title} maxLength={80} onChange={set("title")} placeholder="Starlink Standard kit" /></label>
      <label style={lab}>Category<select style={inp} value={f.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label style={lab}>Condition<select style={inp} value={f.condition} onChange={set("condition")}>{Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label style={lab}>Price in naira<input style={inp} inputMode="numeric" value={f.price} onChange={set("price")} placeholder="350000" /></label>
      <label style={lab}>Your city or area<input style={inp} value={f.city} maxLength={40} onChange={set("city")} placeholder="Port Harcourt" /></label>
      <label style={lab}>What comes with it?<input style={inp} value={f.included} maxLength={200} onChange={set("included")} placeholder="Dish, router, cable, power adapter, box" /></label>
      <label style={lab}>Any faults or marks? (be honest)<input style={inp} value={f.faults} maxLength={200} onChange={set("faults")} /></label>
      <label style={lab}>Why are you selling?<input style={inp} value={f.reason} maxLength={150} onChange={set("reason")} placeholder="Got another one as a gift" /></label>
      <label style={lab}>Anything else buyers should know? (optional)<input style={inp} value={f.extra} maxLength={300} onChange={set("extra")} /></label>

      <div style={{ ...lab, marginTop: 16 }}>Photos of the real item (2 to 7), taken now with the camera</div>
      <LiveCamera label="Take photos of the item" onShot={addPhoto} max={7} count={photos.length} />
      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
        {photos.map((p) => (<span key={p} style={{ position: "relative" }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-photos/${p}`} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} /><button type="button" aria-label="Remove photo" onClick={() => setPhotos((x) => x.filter((y) => y !== p))} style={{ position: "absolute", top: -6, right: -6, width: 24, height: 24, borderRadius: 12, border: "none", background: "#a00", color: "#fff", fontSize: 14, padding: 0 }}>×</button></span>))}
      </div>

      <div style={{ background: "#fff8e6", padding: 12, borderRadius: 12, marginTop: 16 }}>
        <b>Proof photo.</b> Write <b style={{ fontSize: 20 }}>{code || "…"}</b> on a piece of paper and photograph it next to the item. This shows buyers the item is really yours and stops fake listings.
        <LiveCamera label="Take the proof photo" onShot={addProof} />
        {proof && <div style={{ fontSize: 12, marginTop: 4 }}>✓ proof photo added</div>}
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, fontSize: 14 }}>
        <input type="checkbox" checked={f.private_sale} onChange={(e) => setF({ ...f, private_sale: e.target.checked })} />
        Private sale: only people with my link can find it (hidden from Google)
      </label>

      {err && <div role="alert" style={{ color: "#a00", marginTop: 12, fontSize: 14 }}>{err}</div>}
      <button disabled={busy || photos.length < 2 || !proof} onClick={submit} style={{ width: "100%", marginTop: 16, padding: 14, borderRadius: 12, border: "none", background: busy || photos.length < 2 || !proof ? "#9bc9ad" : "#0a7a3d", color: "#fff", fontWeight: 800, fontSize: 16 }}>
        {busy ? "Please wait…" : "Post my listing"}
      </button>

      {mine.length > 0 && (
        <>
          <h2 style={{ fontSize: 17, marginTop: 28 }}>Your listings</h2>
          {mine.map((m) => (
            <div key={m.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10, marginTop: 8 }}>
              <a href={`/p/${m.slug}`} style={{ fontWeight: 700 }}>{m.title}</a> · ₦{m.price_ngn.toLocaleString()} · <i>{m.status}</i>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {m.status !== "removed" && m.status !== "sold" && m.status === "active" && <button onClick={() => setStatus(m.id, "reserved")}>Reserve</button>}
                {m.status === "reserved" && <button onClick={() => setStatus(m.id, "active")}>Make available</button>}
                {(m.status === "active" || m.status === "reserved") && <button onClick={() => setStatus(m.id, "sold")}>Mark sold</button>}
                {(m.status === "active" || m.status === "reserved") && <button onClick={() => setStatus(m.id, "removed")}>Remove</button>}
              </div>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
