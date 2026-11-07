"use client";
import { useEffect, useState } from "react";
import { notifyOther } from "@/lib/push";
import { supabase } from "@/lib/supabase";

export default function ListingActions({ slug, title, status }: { slug: string; title: string; status: string }) {
  const [msg, setMsg] = useState("Is this still available? When can we meet?");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<{ id: string; status: string } | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: rows } = await supabase.rpc("my_listings");
      const m = ((rows as any[]) || []).find((r) => r.slug === slug);
      if (m) setMine({ id: m.id, status: m.status });
    });
  }, [slug]);
  async function setStatus(st: string) {
    if (!mine) return;
    if (st === "sold" && !window.confirm("Mark this item as SOLD? Buyers will no longer be able to contact you.")) return;
    if (st === "removed" && !window.confirm("Remove this listing for good?")) return;
    const { error } = await supabase.rpc("set_listing_status", { p_id: mine.id, p_status: st });
    if (error) { setNote(error.message); return; }
    window.location.reload();
  }
  const url = typeof window !== "undefined" ? window.location.href : `https://amanaija.vercel.app/p/${slug}`;

  async function needLogin() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { window.location.href = "/"; return false; }
    return true;
  }
  async function ask() {
    if (!(await needLogin())) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("contact_listing", { p_slug: slug, p_message: msg });
    setBusy(false);
    if (!error && data === "sent") notifyOther({ slug });
    setNote(error ? error.message : data === "pending" ? "You already messaged this seller. Wait for their reply in your inbox." : "Sent. The seller will reply in your AmaNaija inbox.");
  }
  async function report() {
    if (!(await needLogin())) return;
    const reason = window.prompt("What is wrong with this listing? (scam, fake photo, banned item, wrong price...)");
    if (!reason) return;
    const { error } = await supabase.rpc("report_listing", { p_slug: slug, p_reason: reason });
    setNote(error ? error.message : "Thank you. We will review it.");
  }
  const wa = `https://wa.me/?text=${encodeURIComponent(`${title} on AmaNaija: ${url}`)}`;
  const btn = { padding: "12px 14px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15 } as const;
  if (mine) {
    const b = { padding: "12px 14px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15, background: "#f1f1f1", color: "#17131F" } as const;
    return (
      <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "2px solid #0a7a3d", background: "#f4fbf6" }}>
        <div style={{ fontWeight: 800 }}>This is your listing</div>
        <div style={{ fontSize: 13, color: "#555", margin: "4px 0 10px" }}>Buyers who are interested will message you in Messages on the map. Status: {mine.status}.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${title} on AmaNaija: ${url}`)}`} target="_blank" rel="noopener noreferrer" style={{ ...b, background: "#25d366", color: "#fff", textDecoration: "none" }}>Share</a>
          {mine.status === "active" && <button style={b} onClick={() => setStatus("reserved")}>Reserve</button>}
          {mine.status === "reserved" && <button style={b} onClick={() => setStatus("active")}>Make available</button>}
          {(mine.status === "active" || mine.status === "reserved") && <button style={b} onClick={() => setStatus("sold")}>Mark sold</button>}
          {(mine.status === "active" || mine.status === "reserved") && <button style={{ ...b, color: "#a00" }} onClick={() => setStatus("removed")}>Remove</button>}
        </div>
        {note && <div style={{ marginTop: 8, fontSize: 14 }}>{note}</div>}
      </div>
    );
  }
  if (status !== "active") return null;
  return (
    <div style={{ marginTop: 16 }}>
      <textarea value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 150))} rows={3} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 15 }} />
      <div style={{ fontSize: 12, color: "#777" }}>Please do not type phone or account numbers. Chat stays inside AmaNaija.</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button disabled={busy} onClick={ask} style={{ ...btn, background: "#0a7a3d", color: "#fff", flex: 1 }}>Ask the seller</button>
        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ ...btn, background: "#25d366", color: "#fff", textDecoration: "none" }}>Share</a>
        <button onClick={report} style={{ ...btn, background: "#f1f1f1", color: "#a00" }}>Report</button>
      </div>
      {note && <div role="status" style={{ marginTop: 8, fontSize: 14 }}>{note}</div>}
    </div>
  );
}
