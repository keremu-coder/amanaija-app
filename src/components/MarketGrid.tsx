"use client";
import { useMemo, useState } from "react";
import Thumb from "@/components/Thumb";

type L = { slug: string; title: string; price_ngn: number; city: string; condition: string; category: string; status: string; small: string; full: string };

export default function MarketGrid({ items, conditions }: { items: L[]; conditions: Record<string, string> }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((l) => `${l.title} ${l.city} ${l.category}`.toLowerCase().includes(t)) : items;
  }, [q, items]);
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: starlink, phone, fridge, city…" aria-label="Search the market" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #E8E6DC", background: "#fff", marginTop: 10 }} />
      {shown.length === 0 ? (
        <p style={{ color: "#6B6A68", marginTop: 24 }}>{items.length === 0 ? "Nothing here yet. Be the first to list something." : "No match. Try another word."}</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginTop: 12 }}>
          {shown.map((l) => (
            <a key={l.slug} href={`/p/${l.slug}`} className="ama-card" style={{ textDecoration: "none", color: "inherit", overflow: "hidden" }}>
              <Thumb small={l.small} full={l.full} alt={l.title} />
              <div style={{ padding: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.25 }}>{l.title}</div>
                <div style={{ color: "#1F7A4D", fontWeight: 700 }}>₦{l.price_ngn.toLocaleString("en-NG")}</div>
                <div style={{ fontSize: 12, color: "#6B6A68" }}>{conditions[l.condition]} · {l.city}{l.status === "reserved" ? " · reserved" : ""}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
