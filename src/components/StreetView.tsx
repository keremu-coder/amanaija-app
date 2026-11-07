"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const BODY: Record<string, string> = {
  Food: "#B77A18", Shop: "#C8506B", Church: "#5A2A6C", Hospital: "#2B6CB0",
  School: "#165C3A", Plaza: "#7A4A00", Market: "#B97A4C", Office: "#4B4457",
};
const SHIRTS = ["#C8506B", "#B77A18", "#165C3A", "#5A2A6C", "#2B6CB0", "#B3261E"];
const SKINS = ["#8D5524", "#C68642", "#5C3A21", "#E0AC69"];
const SHOP_W = 124;
const PAD = 20;

function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function metres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * 111320;
  const dLng = (bLng - aLng) * 111320 * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function Person({ name, you }: { name: string; you?: boolean }) {
  return (
    <div className="flex flex-col items-center" style={{ width: 56 }}>
      <svg width="28" height="42" viewBox="0 0 30 46" aria-hidden="true">
        <ellipse cx="15" cy="44" rx="10" ry="2.5" fill="rgba(0,0,0,0.2)" />
        <rect x="7" y="20" width="16" height="22" rx="7" fill={you ? "#1F7A4D" : SHIRTS[hashOf(name) % SHIRTS.length]} />
        <circle cx="15" cy="12" r="9" fill={SKINS[hashOf(name + "x") % SKINS.length]} />
        <path d="M6 11a9 9 0 0 1 18 0c-4-3-14-3-18 0z" fill="#2a1a10" />
      </svg>
      <span
        className="mt-0.5 max-w-[56px] truncate rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
        style={{ background: you ? "#1F7A4D" : "rgba(23,19,31,0.75)" }}
      >
        {you ? "You" : name}
      </span>
    </div>
  );
}

function Shop({ place, onTap }: { place: any; onTap: () => void }) {
  const color = BODY[place.category] || "#8a5a30";
  const open = place.status === "claimed" || place.status === "verified";
  const name = String(place.name || "Shop");
  const label = name.length > 15 ? name.slice(0, 14) + "\u2026" : name;
  return (
    <button
      onClick={onTap}
      aria-label={`${name}, ${open ? "open" : "unclaimed"}. Walk in`}
      className="block transition-transform active:scale-[0.98]"
      style={{ width: 104 }}
    >
      <svg viewBox="0 0 110 140" width="104" height="132" aria-hidden="true">
        <rect x="5" y="40" width="100" height="100" fill={color} />
        <path d="M2 30 H108 L110 52 H0 Z" fill={color} />
        <g fill="#FFFFFF" opacity="0.5">
          <rect x="10" y="30" width="10" height="22" />
          <rect x="30" y="30" width="10" height="22" />
          <rect x="50" y="30" width="10" height="22" />
          <rect x="70" y="30" width="10" height="22" />
          <rect x="90" y="30" width="10" height="22" />
        </g>
        <rect x="10" y="4" width="90" height="22" rx="6" fill="#17131F" />
        <text x="52" y="19" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">{label}</text>
        <circle cx="96" cy="15" r="4" fill={open ? "#4ADE80" : "#F4B73F"} />
        <rect x="14" y="64" width="34" height="34" fill="#FFF3C9" opacity="0.9" />
        <rect x="64" y="72" width="30" height="68" fill="#2a1a10" />
        <circle cx="88" cy="108" r="2" fill="#F4B73F" />
      </svg>
    </button>
  );
}

export default function StreetView({
  places, center, userName, onSelectPlace, onBack, onOpenRealMap,
}: {
  places: any[];
  center: { lat: number; lng: number };
  userName: string;
  onSelectPlace: (place: any) => void;
  onBack: () => void;
  onOpenRealMap: () => void;
}) {
  const shops = useMemo(
    () =>
      (places || [])
        .filter((p) => !p.parent_id && typeof p.lat === "number" && typeof p.lng === "number")
        .map((p) => ({ p, d: metres(center.lat, center.lng, p.lat, p.lng) }))
        .filter((x) => x.d < 3000)
        .sort((a, b) => a.d - b.d)
        .slice(0, 8)
        .map((x) => x.p),
    [places, center.lat, center.lng]
  );

  const [youX, setYouX] = useState(PAD + 40);
  const [others, setOthers] = useState<string[]>([]);
  const width = Math.max(shops.length * SHOP_W + PAD * 2, 360);

  useEffect(() => {
    let id = "";
    try { id = localStorage.getItem("amanaija_client_id") || ""; } catch {}
    if (!id) id = Math.random().toString(36).slice(2);
    const ch = supabase.channel(`street-${center.lat.toFixed(2)}-${center.lng.toFixed(2)}`, { config: { presence: { key: id } } });
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState() as Record<string, any[]>;
      setOthers(
        Object.entries(st)
          .filter(([k]) => k !== id)
          .map(([, arr]) => (arr[0] as any)?.name || "Guest")
          .slice(0, 4)
      );
    }).subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ name: userName || "Guest" });
    });
    return () => { supabase.removeChannel(ch); };
  }, [center.lat, center.lng, userName]);

  const walkTo = (i: number, place: any) => {
    setYouX(PAD + i * SHOP_W + SHOP_W / 2 - 10);
    setTimeout(() => onSelectPlace(place), 450);
  };

  return (
    <div
      className="absolute left-0 right-0 top-0 overflow-hidden"
      style={{ height: "min(36dvh, 340px)", minHeight: 260, background: "linear-gradient(180deg, #F4B467 0%, #FBD9A4 55%, #FDEBCB 100%)" }}
    >
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center gap-2 px-3 pt-3">
        <button onClick={onBack} aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/90 text-[#17131F] shadow">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/90 px-3 shadow">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#1F7A4D]" aria-hidden="true" />
          <span className="truncate text-[15px] font-extrabold text-[#17131F]">Your street</span>
          <span className="ml-auto shrink-0 text-[13px] font-bold text-[#165C3A]">{others.length + 1} here</span>
        </div>
        <button onClick={onOpenRealMap} className="h-11 shrink-0 rounded-full bg-white/90 px-4 text-sm font-bold text-[#17131F] shadow">Real map</button>
      </div>

      <div className="absolute inset-0 overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: "none" }}>
        <div className="relative h-full" style={{ width }}>
          <div className="absolute bottom-0 left-0 right-0" style={{ height: "34%", background: "#B97A4C", borderTop: "3px solid #8a5a30" }} />

          {shops.length === 0 && (
            <div className="absolute left-0 right-0 flex flex-col items-center text-center" style={{ top: "34%", width: "100%" }}>
              <p className="text-lg font-extrabold text-[#17131F]">No shops on this street yet</p>
              <p className="text-sm text-[#4B4457]">Be the first to open one here.</p>
            </div>
          )}

          {shops.map((p, i) => (
            <div key={p.id} className="absolute" style={{ left: PAD + i * SHOP_W, bottom: "34%" }}>
              <Shop place={p} onTap={() => walkTo(i, p)} />
            </div>
          ))}

          {others.map((n, i) => (
            <div key={n + i} className="absolute" style={{ left: 60 + (hashOf(n) % Math.max(width - 140, 1)), bottom: 8 + (i % 2) * 16 }}>
              <Person name={n} />
            </div>
          ))}

          <div className="absolute" style={{ left: youX, bottom: 8, transform: "translateX(-50%)", transition: "left 450ms ease" }}>
            <Person name={userName || "You"} you />
          </div>
        </div>
      </div>
    </div>
  );
}