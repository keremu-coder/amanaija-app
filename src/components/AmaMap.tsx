"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, Source, Layer, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "@/lib/supabase";
import { playReceive } from "@/lib/ui-sound";
import AreaChat from "./AreaChat";
import AskStreet from "./AskStreet";
import PersonCard from "./PersonCard";
import DmInbox from "./DmInbox";

const COLORS: Record<string, string> = {
  Food: "#B77A18", Shop: "#C8506B", Church: "#5A2A6C", Hospital: "#2B6CB0",
  School: "#165C3A", Plaza: "#D97706", Market: "#B97A4C", Office: "#4B4457", Residential: "#0F766E",
};
const SHIRTS = ["#C8506B", "#B77A18", "#165C3A", "#5A2A6C", "#2B6CB0", "#B3261E"];
const SKINS = ["#8D5524", "#C68642", "#5C3A21", "#E0AC69"];

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

const Person = memo(function Person({ name, you, walking }: { name: string; you?: boolean; walking?: boolean }) {
  return (
    <div className="flex flex-col items-center" style={{ width: 60 }}>
      <svg
        width="30" height="46" viewBox="0 0 30 46" aria-hidden="true"
        className={walking ? "ama-walk" : ""}
        style={{ filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.35))" }}
      >
        <ellipse cx="15" cy="44" rx="10" ry="2.5" fill="rgba(0,0,0,0.25)" />
        <rect x="7" y="20" width="16" height="22" rx="7" fill={you ? "#1F7A4D" : SHIRTS[hashOf(name) % SHIRTS.length]} />
        <circle cx="15" cy="12" r="9" fill={SKINS[hashOf(name + "x") % SKINS.length]} />
        <path d="M6 11a9 9 0 0 1 18 0c-4-3-14-3-18 0z" fill="#2a1a10" />
      </svg>
      <span
        className="mt-0.5 max-w-[60px] truncate rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
        style={{ background: you ? "#1F7A4D" : "rgba(23,19,31,0.8)" }}
      >
        {you ? "You" : name}
      </span>
    </div>
  );
});

function pinIcon(category: string) {
  switch (category) {
    case "Residential":
      return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 3 2 12h3v8h5v-5h4v5h5v-8h3L12 3z"/></svg>;
    case "Hospital":
      return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 11h-3v3h-2v-3H9v-2h3V9h2v3h3v2z"/></svg>;
    case "Church":
      return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2L4 9v13h16V9l-8-7zm0 2.5l6 5.3V20h-4v-6H10v6H6V9.8l6-5.3z"/></svg>;
    case "School":
      return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3z"/></svg>;
    case "Plaza":
      return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 3L2 12h3v8h14v-8h3L12 3z"/></svg>;
    case "Food":
      return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>;
    default:
      return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/></svg>;
  }
}

export default function AmaMap({
  viewState, setViewState, userLocation, setUserLocation, places, onSelectPlace, userName,
}: {
  viewState: any; setViewState: any; userLocation: any; setUserLocation: any;
  places: any[]; onSelectPlace: any; userName?: string;
}) {
  const mapRef = useRef<MapRef>(null);
  // The map moves on its own (no React render per frame). We only record where it ended up.
  const [vs, setVs] = useState(viewState);
  const lastSent = useRef<any>(viewState);
  useEffect(() => {
    if (viewState === lastSent.current) return;
    lastSent.current = viewState;
    setVs(viewState);
    mapRef.current?.jumpTo({ center: [viewState.longitude, viewState.latitude], zoom: viewState.zoom });
  }, [viewState]);
  const [me, setMe] = useState({ lat: viewState.latitude, lng: viewState.longitude });
  const [atName, setAtName] = useState("");
  const [isReal, setIsReal] = useState(false);
  const [travelling, setTravelling] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState("");
  const [lite, setLite] = useState(false);
  const [filter, setFilter] = useState("All");
  const [showList, setShowList] = useState(false);
  const [listSize, setListSize] = useState<"peek" | "half" | "full">("half");
  const [listLayout, setListLayout] = useState<"list" | "grid">("list");
  useEffect(() => { try { const v = localStorage.getItem("amanaija:list-layout"); if (v === "grid" || v === "list") setListLayout(v); } catch {} }, []);
  const grab = useRef<number | null>(null);
  const ORDER = ["peek", "half", "full"] as const;
  const stepSize = (dir: 1 | -1) => {
    const i = ORDER.indexOf(listSize); const n = i + dir;
    if (n < 0) { setShowList(false); return; }
    if (n < ORDER.length) setListSize(ORDER[n]);
  };
  const [q, setQ] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [trafficOn, setTrafficOn] = useState(false);
  useEffect(() => {
    fetch("/api/traffic/status").then((r) => r.json()).then((d) => setTrafficOn(!!d?.on)).catch(() => {});
  }, []);
  const [showAsk, setShowAsk] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [unread, setUnread] = useState(0);
  const unreadRef = useRef(0);
  // Checks every 12 seconds for new message requests and replies, shows a number on Messages and plays a sound.
  useEffect(() => {
    let stop = false;
    const check = async () => {
      if (document.hidden) return;
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id; if (!uid) { setUnread(0); return; }
      let since = "1970-01-01T00:00:00Z"; try { since = localStorage.getItem("amanaija:inbox-seen") || since; } catch {}
      const [a, b] = await Promise.all([
        supabase.from("dm_requests").select("id", { count: "exact", head: true }).eq("to_id", uid).eq("status", "pending"),
        supabase.from("dm_messages").select("id", { count: "exact", head: true }).neq("sender_id", uid).gt("created_at", since),
      ]);
      if (stop) return;
      const n = (a.count ?? 0) + (b.count ?? 0);
      if (n > unreadRef.current) { playReceive(); try { navigator.vibrate?.(60); } catch {} }
      unreadRef.current = n; setUnread(n);
    };
    check();
    const t = setInterval(check, 12000);
    return () => { stop = true; clearInterval(t); };
  }, []);
  // Only one panel is open at a time: opening one closes the others.
  const openOnly = (k: "list" | "ask" | "chat" | "inbox" | null) => {
    setShowList(k === "list"); setShowAsk(k === "ask"); setShowChat(k === "chat"); setShowInbox(k === "inbox");
    if (k) setPicked(null);
  };
  useEffect(() => {
    const h = (e: Event) => { const d = (e as CustomEvent).detail; if (d === "list" || d === "ask" || d === "chat" || d === "inbox") openOnly(d); };
    window.addEventListener("amanaija:open", h);
    return () => window.removeEventListener("amanaija:open", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [promoted, setPromoted] = useState<Set<string>>(new Set());
  const [sponsor, setSponsor] = useState<any>(null);
  const [ghostCars, setGhostCars] = useState<{ id: string; lat: number; lng: number }[]>([]);
  const [roadPts, setRoadPts] = useState<{ id: string; lat: number; lng: number }[]>([]);
  const [ghostTick, setGhostTick] = useState(0);
  const [ghostNote, setGhostNote] = useState(false);

  // --- Wow moments: first-open journey, a sky that matches real time and weather, and "the street answers you".
  const [intro, setIntro] = useState("");
  const [sky, setSky] = useState<{ tint: string; blend: string }>({ tint: "", blend: "normal" });
  const [rainNow, setRainNow] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);
  const [lit, setLit] = useState<Set<string>>(new Set());
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const answeredRef = useRef<Set<string>>(new Set());
  const [asked, setAsked] = useState<{ at: number } | null>(null);
  const wxDone = useRef(false);

  useEffect(() => {
    const calc = () => {
      const d = new Date();
      const h = d.getHours() + d.getMinutes() / 60;
      if (h >= 19 || h < 5) setSky({ tint: "rgba(18,28,90,0.30)", blend: "multiply" });
      else if (h < 7) setSky({ tint: "rgba(255,170,90,0.14)", blend: "normal" });
      else if (h >= 17) setSky({ tint: "rgba(255,120,80,0.16)", blend: "normal" });
      else setSky({ tint: "", blend: "normal" });
    };
    calc();
    const t = setInterval(calc, 300000);
    return () => clearInterval(t);
  }, []);
  const [picked, setPicked] = useState<{ uid?: string; name: string } | null>(null);
  const uidRef = useRef<string | undefined>(undefined);
  const [others, setOthers] = useState<{ key: string; uid?: string; name: string; lat: number; lng: number }[]>([]);
  const [peopleCount, setPeopleCount] = useState(0);

  const rafRef = useRef<number | null>(null);
  const noteTimer = useRef<any>(null);
  const chRef = useRef<any>(null);
  const meRef = useRef(me);
  meRef.current = me;
  const nameRef = useRef(userName || "Guest");
  nameRef.current = userName || "Guest";
  // Privacy: strangers only ever see a ~1 km grid cell, never a name, user ID or exact spot. Ghost mode shares nothing.
  const [ghostMode, setGhostMode] = useState(false);
  const ghostRef = useRef(false);
  ghostRef.current = ghostMode;
  const [hideEmpty, setHideEmpty] = useState(false);
  // "Open to hello": on by default for logged-in members. Only then is your user ID attached so people can send a request. They still need your OK.
  const [hello, setHello] = useState(false);
  const helloRef = useRef(false);
  const [askHello, setAskHello] = useState(false);
  helloRef.current = hello;
  const cellOf = (lat: number, lng: number) => `${Math.floor(lat / 0.01)},${Math.floor(lng / 0.01)}`;
  const announce = (lat: number, lng: number) => {
    const ch = chRef.current;
    if (!ch) return;
    if (ghostRef.current) { ch.untrack(); return; }
    ch.track(helloRef.current && uidRef.current ? { cell: cellOf(lat, lng), uid: uidRef.current, name: (nameRef.current || "Neighbour").slice(0, 20) } : { cell: cellOf(lat, lng) });
  };

  const matchesFilter = (p: any) =>
    filter === "All" ? true
    : filter === "Homes" ? p.category === "Residential"
    : filter === "For rent" ? !!p.for_rent
    : p.category === filter;
  const allPins = useMemo(
    () => (places?.filter((place) => !place.parent_id && typeof place.lat === "number" && typeof place.lng === "number") || []).filter(matchesFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places, filter]
  );
  const term = q.trim().toLowerCase();
  // Only draw pins near the screen (nearest first, capped), so thousands of shops never slow the map down.
  const cLat = Math.round(vs.latitude * 500) / 500;
  const cLng = Math.round(vs.longitude * 500) / 500;
  const zBucket = Math.round(vs.zoom * 2) / 2;
  const mapPins = useMemo(() => {
    const half = (360 / Math.pow(2, zBucket)) * 1.2;
    const cap = lite ? 40 : 90;
    const inView = allPins.filter((p) => Math.abs(p.lat - cLat) < half && Math.abs(p.lng - cLng) < half);
    if (inView.length <= cap) return inView;
    return inView
      .map((p) => ({ p, d: (p.lat - cLat) ** 2 + (p.lng - cLng) ** 2 }))
      .sort((x, y) => x.d - y.d)
      .slice(0, cap)
      .map((x) => x.p);
  }, [allPins, cLat, cLng, zBucket, lite]);
  const maxOthers = lite ? 10 : 40;
  const liteProps: any = lite ? { fadeDuration: 0, maxTileCacheSize: 40, pixelRatio: 1 } : {};

  // Before the phone's own location question, explain why we ask. Skipped when permission was already given.
  const [locAsk, setLocAsk] = useState<"check" | "ask" | "go" | "skip">("check");
  useEffect(() => {
    let done = false;
    const decide = (granted: boolean) => {
      if (done) return; done = true;
      let v: string | null = null; try { v = localStorage.getItem("amanaija_loc_primed"); } catch {}
      setLocAsk(granted || v === "1" ? "go" : v === "0" ? "skip" : "ask");
    };
    try {
      (navigator as any).permissions?.query({ name: "geolocation" }).then((r: any) => decide(r.state === "granted"), () => decide(false));
    } catch { decide(false); }
    setTimeout(() => decide(false), 800);
  }, []);

  // Start where the person really is (asked once, quick low-accuracy fix). If they say no, they start from a view of Nigeria.
  useEffect(() => {
    if (locAsk !== "go") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const to = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation({ lng: to.lng, lat: to.lat });
        setMe(to);
        setIsReal(true);
        setAtName("your location");
        let seen = true;
        try { seen = localStorage.getItem("amanaija_intro") === "1"; } catch {}
        if (!lite && !seen) {
          try { localStorage.setItem("amanaija_intro", "1"); } catch {}
          setIntro("Nigeria");
          setTimeout(() => setIntro("Your city"), 1300);
          setTimeout(() => setIntro("Your street"), 2800);
          setTimeout(() => setIntro(""), 4600);
        }
        mapRef.current?.flyTo({ center: [to.lng, to.lat], zoom: 16, duration: lite ? 0 : seen ? 1800 : 4200, essential: true, curve: 1 });
        announce(to.lat, to.lng);
      },
      () => flash("Allow location to start where you are, or tap the map"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locAsk]);

  // Rain overlay: current weather at your rough location (free Open-Meteo, no key).
  useEffect(() => {
    if (!isReal || wxDone.current) return;
    wxDone.current = true;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${meRef.current.lat.toFixed(2)}&longitude=${meRef.current.lng.toFixed(2)}&current=weather_code`)
      .then((r) => r.json())
      .then((j) => { const c = j?.current?.weather_code; if (typeof c === "number") setRainNow((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95); })
      .catch(() => {});
  }, [isReal]);

  // The street answers you: when a request is sent, a ripple spreads, nearby shops light up, and replies glow.
  useEffect(() => {
    const onAsked = () => {
      openOnly(null);
      setRippleKey(Date.now());
      setAsked({ at: Date.now() });
      answeredRef.current = new Set();
      setAnswered(new Set());
      const near = allPins
        .filter((p) => p.category !== "Residential")
        .map((p) => ({ p, d: metres(meRef.current.lat, meRef.current.lng, p.lat, p.lng) }))
        .filter((x) => x.d < 3500)
        .sort((a, b) => a.d - b.d)
        .slice(0, 12);
      near.forEach((x, i) => setTimeout(() => setLit((prev) => new Set(prev).add(x.p.id)), 500 + i * 220));
      setTimeout(() => setLit(new Set()), 6500);
    };
    window.addEventListener("amanaija:asked", onAsked);
    return () => window.removeEventListener("amanaija:asked", onAsked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPins]);

  useEffect(() => {
    if (!asked) return;
    let stop = false;
    const poll = async () => {
      if (stop || document.hidden) return;
      if (Date.now() - asked.at > 600000) { setAsked(null); return; }
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id;
      if (!uid) return;
      const { data: n } = await supabase.from("needs").select("id").eq("user_id", uid).eq("status", "open")
        .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1);
      const id = (n as any[])?.[0]?.id;
      if (!id) return;
      const { data: r } = await supabase.from("need_replies").select("shop_id").eq("need_id", id).neq("answer", "no");
      const ids = new Set<string>(((r as any[]) || []).map((x) => x.shop_id));
      let changed = false;
      ids.forEach((sid) => {
        if (answeredRef.current.has(sid)) return;
        changed = true;
        const p: any = (places || []).find((x: any) => x.id === sid);
        flash(`${p?.name || "A shop"} has it${p ? ` · ${fmtDist(metres(meRef.current.lat, meRef.current.lng, p.lat, p.lng))}` : ""}`);
      });
      if (changed) { answeredRef.current = ids; setAnswered(ids); }
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => { stop = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked]);

  // Paid "Promoted" shops: shown first and always labelled, so nobody is misled.
  useEffect(() => {
    supabase.from("boosts").select("place_id").gt("ends_at", new Date().toISOString()).then(({ data }) => {
      if (data) setPromoted(new Set((data as any[]).map((b) => b.place_id)));
    });
  }, []);

  // Once a day, suggest one promoted shop near you (clearly marked, easy to dismiss).
  useEffect(() => {
    if (!promoted.size || !isReal) return;
    let seen = "";
    const today = new Date().toDateString();
    try { seen = localStorage.getItem("amanaija_sponsor_day") || ""; } catch {}
    if (seen === today) return;
    const near = (places || [])
      .filter((p: any) => promoted.has(p.id) && typeof p.lat === "number" && typeof p.lng === "number")
      .map((p: any) => ({ p, d: metres(meRef.current.lat, meRef.current.lng, p.lat, p.lng) }))
      .filter((x) => x.d < 10000)
      .sort((a, b) => a.d - b.d)[0];
    if (near) setSponsor({ ...near.p, _d: near.d });
  }, [promoted, isReal, places]);

  const dismissSponsor = () => {
    try { localStorage.setItem("amanaija_sponsor_day", new Date().toDateString()); } catch {}
    setSponsor(null);
  };

  // Ghosts: faded figures that show TYPICAL activity around real places. They are not real people,
  // cannot be tapped, and disappear where a real member is standing.
  useEffect(() => {
    try { if (!localStorage.getItem("amanaija_ghost_note")) setGhostNote(true); } catch {}
    const t = setInterval(() => setGhostTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const ghostPeople = useMemo(() => {
    void ghostTick;
    if (vs.zoom < 14) return [] as { id: string; lat: number; lng: number }[];
    const hour = new Date().getHours();
    const w = hour < 6 ? 0.1 : hour < 9 ? 0.6 : hour < 18 ? 1 : hour < 22 ? 0.8 : 0.3;
    const base: Record<string, number> = { Market: 4, Plaza: 4, Food: 3, Church: 3, School: 3, Hospital: 3, Shop: 2, Office: 2, Service: 2, Residential: 1 };
    const bucket = Math.floor(Date.now() / 300000);
    const src = (places || [])
      .filter((p: any) => !p.parent_id && typeof p.lat === "number" && typeof p.lng === "number")
      .map((p: any) => ({ p, d: metres(vs.latitude, vs.longitude, p.lat, p.lng) }))
      .filter((x) => x.d < 700)
      .sort((a, b) => a.d - b.d)
      .slice(0, lite ? 4 : 12);
    const out: { id: string; lat: number; lng: number }[] = [];
    for (const { p } of src) {
      const n = Math.round((base[p.category] ?? 1) * w);
      for (let i = 0; i < n; i++) {
        const h = hashOf(`${p.id}:${i}:${bucket}`);
        const ang = ((h % 360) * Math.PI) / 180;
        const r = 20 + ((h >> 8) % 70);
        const lat = p.lat + (Math.sin(ang) * r) / 111320;
        const lng = p.lng + (Math.cos(ang) * r) / (111320 * Math.cos((p.lat * Math.PI) / 180));
        if (others.some((o) => metres(lat, lng, o.lat, o.lng) < 60)) continue;
        out.push({ id: `${p.id}-${i}`, lat, lng });
      }
    }
    // Also stroll along visible roads, so quiet streets with no shops still feel lived in.
    const wr = Math.round((lite ? 4 : 8) * w);
    roadPts.slice(0, wr).forEach((r, i) => {
      const h = hashOf(`${r.id}:${bucket}:${i}`);
      const lat = r.lat + (((h % 40) - 20) / 111320);
      const lng = r.lng + ((((h >> 6) % 40) - 20) / 111320);
      if (!others.some((o) => metres(lat, lng, o.lat, o.lng) < 60)) out.push({ id: `rd-${r.id}-${i}`, lat, lng });
    });
    return out.slice(0, lite ? 10 : 34);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostTick, cLat, cLng, zBucket, lite, places, others, roadPts]);

  // Ghost cars: placed on real roads that are visible on the map right now.
  const updateGhostCars = () => {
    try {
      if ((mapRef.current?.getZoom?.() ?? 0) < 14.5) { setGhostCars([]); setRoadPts([]); return; }
      const feats = mapRef.current?.queryRenderedFeatures() || [];
      const cars: { id: string; lat: number; lng: number }[] = [];
      const pts: { id: string; lat: number; lng: number }[] = [];
      const seen = new Set<string>();
      for (const f of feats as any[]) {
        if (f.sourceLayer !== "transportation") continue;
        const cls = f.properties?.class;
        if (!["primary", "secondary", "tertiary", "trunk", "minor", "service"].includes(cls)) continue;
        const g = f.geometry;
        const line: number[][] | undefined = g?.type === "LineString" ? g.coordinates : g?.type === "MultiLineString" ? g.coordinates[0] : undefined;
        if (!line || line.length < 2) continue;
        const mid = line[Math.floor(line.length / 2)];
        const key = `${mid[0].toFixed(4)},${mid[1].toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const big = cls !== "service";
        if (big && cars.length < (lite ? 4 : 8)) cars.push({ id: key, lat: mid[1], lng: mid[0] });
        else if (pts.length < 10) pts.push({ id: key, lat: mid[1], lng: mid[0] });
        if (cars.length >= (lite ? 4 : 8) && pts.length >= 10) break;
      }
      setGhostCars(cars);
      setRoadPts(pts.length ? pts : cars);
    } catch { setGhostCars([]); setRoadPts([]); }
  };

  const nearby = !showList ? [] : [...allPins]
    .filter((p) => !term || String(p.name || "").toLowerCase().includes(term) || String(p.category || "").toLowerCase().includes(term))
    .map((p) => ({ p, d: metres(me.lat, me.lng, p.lat, p.lng) }))
    .sort((a, b) => (promoted.has(a.p.id) === promoted.has(b.p.id) ? a.d - b.d : promoted.has(a.p.id) ? -1 : 1))
    .slice(0, 30);
  const meLatR = Math.round(me.lat * 1000) / 1000;
  const meLngR = Math.round(me.lng * 1000) / 1000;
  const noShopsNear = useMemo(() => !allPins.some((p) => metres(meLatR, meLngR, p.lat, p.lng) < 2500), [allPins, meLatR, meLngR]);
  const fmtDist = (d: number) => (d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`);
  const CHIPS = ["All", "Food", "Shop", "Market", "Church", "Hospital", "School", "Homes", "For rent"];

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      uidRef.current = data.session?.user?.id;
      announce(meRef.current.lat, meRef.current.lng);
    });
  }, []);

  const toggleLite = () => {
    const next = !lite;
    setLite(next);
    try { localStorage.setItem("amanaija_lite", next ? "1" : "0"); } catch {}
    flash(next ? "Light mode on" : "Light mode off");
  };

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("amanaija_lite"); } catch {}
    if (saved === "1") { setLite(true); return; }
    if (saved === "0") return;
    const nav: any = typeof navigator !== "undefined" ? navigator : {};
    const slow = nav.connection?.saveData || /(^|-)(2g|3g)$/.test(nav.connection?.effectiveType || "");
    const weak = (nav.deviceMemory && nav.deviceMemory <= 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4);
    if (slow || weak) setLite(true);
  }, []);

  const flash = (msg: string) => {
    setNote(msg);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(""), 4000);
  };

  useEffect(() => {
    try { if (sessionStorage.getItem("amanaija_hide_empty") === "1") setHideEmpty(true); } catch {}
    try { const hv = localStorage.getItem("amanaija_hello"); if (hv === "1") { setHello(true); helloRef.current = true; } else if (hv === null) setAskHello(true); } catch {}
    try { setGhostMode(localStorage.getItem("amanaija_ghost_mode") === "1"); ghostRef.current = localStorage.getItem("amanaija_ghost_mode") === "1"; } catch {}
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36); // new every visit, never tied to a person
    const ch = supabase.channel("world-presence", { config: { presence: { key: id } } });
    chRef.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState() as Record<string, any[]>;
      const cells: Record<string, string[]> = {};
      const who: Record<string, { uid?: string; name?: string }> = {};
      for (const [k, arr] of Object.entries(st)) {
        if (k === id) continue;
        const c = (arr[0] as any)?.cell;
        if (typeof c !== "string" || !/^-?\d+,-?\d+$/.test(c)) continue;
        (cells[c] ||= []).push(k);
        const v: any = arr[0];
        if (typeof v?.uid === "string") who[k] = { uid: v.uid, name: typeof v.name === "string" ? v.name.slice(0, 20) : "Neighbour" };
      }
      setPeopleCount(Object.values(cells).reduce((n, a) => n + a.length, 0));
      // Only show a crowd when 3+ people share a cell; a lone person is never pinned on the map.
      const list: { key: string; uid?: string; name: string; lat: number; lng: number }[] = [];
      for (const [c, keys] of Object.entries(cells)) {
        const [ci, cj] = c.split(",").map(Number);
        // A crowd of 3+ shows as a crowd. A lone person shows only if they chose "open to hello".
        keys.filter((k) => keys.length >= 3 || who[k]).slice(0, 6).forEach((k) => {
          const h = hashOf(`${c}:${k}`);
          list.push({ key: k, uid: who[k]?.uid, name: who[k]?.name || "Neighbour", lat: (ci + 0.15 + ((h % 70) / 100)) * 0.01, lng: (cj + 0.15 + (((h >> 7) % 70) / 100)) * 0.01 });
        });
      }
      setOthers(list.slice(0, 40));
    }).subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        announce(meRef.current.lat, meRef.current.lng);
      }
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (noteTimer.current) clearTimeout(noteTimer.current);
      supabase.removeChannel(ch);
    };
  }, []);

  const nearestPlace = (lat: number, lng: number) => {
    let best: any = null;
    let bd = 1e12;
    for (const p of mapPins) {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") continue;
      const d = metres(lat, lng, p.lat, p.lng);
      if (d < bd) { bd = d; best = p; }
    }
    return bd <= 60 ? best : null;
  };

  // Walk the avatar to any point. If it is a place, enter it on arrival.
  const walkTo = (
    to: { lat: number; lng: number },
    opts: { place?: any; label?: string; real?: boolean; zoom?: number } = {}
  ) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = { ...meRef.current };
    const d = metres(from.lat, from.lng, to.lat, to.lng);
    const dur = Math.min(3600, 700 + Math.sqrt(d) * 2.4);
    const currentZoom = mapRef.current?.getZoom?.() ?? 15;
    const zoom = opts.zoom ?? Math.max(currentZoom, 16);
    setTravelling(true);
    mapRef.current?.flyTo({ center: [to.lng, to.lat], zoom, duration: dur, essential: true, curve: 1 });
    const t0 = performance.now();
    let last = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      if (now - last > (lite ? 90 : 40) || k === 1) {
        last = now;
        setMe({ lat: from.lat + (to.lat - from.lat) * e, lng: from.lng + (to.lng - from.lng) * e });
      }
      if (k < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        setTravelling(false);
        setIsReal(!!opts.real);
        setAtName(opts.label || "");
        announce(to.lat, to.lng);
        if (opts.place) onSelectPlace(opts.place);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const travel = (place: any) => {
    if (typeof place.lat !== "number" || typeof place.lng !== "number") {
      onSelectPlace(place);
      return;
    }
    walkTo({ lat: place.lat, lng: place.lng }, { place, label: place.name || "" });
  };

  // Tap anywhere on the map: your avatar walks there.
  const handleMapClick = (e: any) => {
    const to = { lat: e.lngLat.lat, lng: e.lngLat.lng };
    setUserLocation({ lng: to.lng, lat: to.lat });
    const near = nearestPlace(to.lat, to.lng);
    walkTo(to, { label: near ? near.name : "the street" });
  };

  // Real GPS, only when the person taps the button.
  const goReal = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      flash("This phone cannot share its location");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const to = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation({ lng: to.lng, lat: to.lat });
        walkTo(to, { label: "your real location", real: true, zoom: 17 });
        flash(`GPS found you (about ${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        setLocating(false);
        flash(err.code === 1 ? "Location is blocked. Allow it in your browser settings." : "Could not get your location. Try outside or near a window.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  };

  const showClickDot = userLocation && metres(userLocation.lat, userLocation.lng, me.lat, me.lng) > 30;

  const status = note
    ? note
    : travelling
    ? "Walking..."
    : isReal
    ? "You are here (real GPS)"
    : atName
    ? `At ${atName}`
    : "Tap anywhere to walk";

  return (
    <div className="absolute inset-0 w-full h-full">
      <style>{`
        @keyframes amaWalk { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-4px) rotate(3deg); } }
        .ama-walk { animation: amaWalk 0.45s ease-in-out infinite; }
        @keyframes amaRipple { 0% { transform: translate(-50%,-50%) scale(0.05); opacity: 0.9; } 100% { transform: translate(-50%,-50%) scale(1); opacity: 0; } }
        .ama-ripple-wrap { position: relative; width: 0; height: 0; }
        .ama-ripple { position: absolute; left: 0; top: 0; width: 560px; height: 560px; border-radius: 9999px; border: 3px solid #F4B73F; background: rgba(244,183,63,0.12); opacity: 0; transform: translate(-50%,-50%) scale(0.05); animation: amaRipple 2.6s ease-out 1 forwards; }
        @keyframes amaIntro { from { opacity: 0; transform: translateY(10px) scale(0.96); } to { opacity: 1; transform: none; } }
        .ama-intro { animation: amaIntro 0.9s ease both; }
        @keyframes amaRain { from { background-position: 0 0; } to { background-position: -24px 72px; } }
        .ama-rain { opacity: 0.5; background-image: repeating-linear-gradient(105deg, transparent 0 11px, rgba(120,150,200,0.4) 11px 12px); background-size: 72px 72px; animation: amaRain 0.5s linear infinite; }
      `}</style>
      <Map
        ref={mapRef}
        initialViewState={viewState}
        onMoveEnd={(evt) => { lastSent.current = evt.viewState; setVs(evt.viewState); setViewState(evt.viewState); }}
        onClick={handleMapClick}
        onIdle={updateGhostCars}
        mapStyle={lite ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" : "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"}
        attributionControl={false}
        padding={{ top: 100, bottom: 420, left: 40, right: 40 }}
        cursor="crosshair"
        {...liteProps}
      >
        {showTraffic && trafficOn && (
          <Source
            id="live-traffic"
            type="raster"
            tileSize={256}
            maxzoom={18}
            tiles={[`${typeof window !== "undefined" ? window.location.origin : ""}/api/traffic/{z}/{x}/{y}`]}
          >
            <Layer id="live-traffic-layer" type="raster" paint={{ "raster-opacity": 0.85 }} />
          </Source>
        )}

        {showClickDot && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
            <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md" />
          </Marker>
        )}

        {mapPins.map((place) => {
          const color = COLORS[place.category] || "#2E4A36";
          const home = place.category === "Residential";
          const rent = home && place.for_rent;
          return (
            <Marker key={place.id} longitude={place.lng} latitude={place.lat} anchor="bottom">
              <div
                className="cursor-pointer active:scale-95"
                onClick={(e) => { e.stopPropagation(); travel(place); }}
              >
                <div className="flex flex-col items-center">
                  {(!lite || rent || answered.has(place.id)) && (
                    <div className="mb-1 max-w-[120px] truncate rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#17131F] shadow-md">
                      {answered.has(place.id) ? "Has it" : rent ? "For rent" : place.name}
                    </div>
                  )}
                  <div
                    className={`rounded-full border-2 border-white text-white ${lite ? "p-1.5" : "p-2.5 shadow-lg"}`}
                    style={{
                      background: rent ? "#F4B73F" : color,
                      color: rent ? "#17131F" : undefined,
                      transition: "box-shadow .4s, transform .4s",
                      transform: answered.has(place.id) || lit.has(place.id) ? "scale(1.2)" : undefined,
                      boxShadow: answered.has(place.id)
                        ? "0 0 0 4px #F4B73F, 0 0 18px 6px rgba(244,183,63,.75)"
                        : lit.has(place.id) ? "0 0 0 3px rgba(255,255,255,.9), 0 0 16px 5px rgba(244,183,63,.6)" : undefined,
                    }}
                  >
                    {pinIcon(place.category)}
                  </div>
                  <div className="h-2 w-1.5" style={{ background: rent ? "#F4B73F" : color }} />
                </div>
              </div>
            </Marker>
          );
        })}

        {ghostPeople.map((g) => (
          <Marker key={g.id} longitude={g.lng} latitude={g.lat} anchor="bottom" style={{ pointerEvents: "none", zIndex: 1 }}>
            <div style={{ opacity: 0.32, filter: "grayscale(1)", pointerEvents: "none" }} aria-hidden="true">
              <svg width="18" height="28" viewBox="0 0 30 46"><rect x="7" y="20" width="16" height="22" rx="7" fill="#6B7280" /><circle cx="15" cy="12" r="9" fill="#9CA3AF" /></svg>
            </div>
          </Marker>
        ))}
        {ghostCars.map((c) => (
          <Marker key={c.id} longitude={c.lng} latitude={c.lat} anchor="center" style={{ pointerEvents: "none", zIndex: 1 }}>
            <div style={{ opacity: 0.35, pointerEvents: "none" }} aria-hidden="true">
              <svg width="26" height="14" viewBox="0 0 26 14"><rect x="1" y="2" width="24" height="10" rx="4" fill="#6B7280" /><rect x="6" y="4" width="8" height="6" rx="2" fill="#E5E7EB" /></svg>
            </div>
          </Marker>
        ))}
        {others.slice(0, maxOthers).map((o) => (
          <Marker key={o.key} longitude={o.lng} latitude={o.lat} anchor="bottom">
            <div className={o.uid ? "cursor-pointer" : ""} onClick={o.uid ? (e) => { e.stopPropagation(); openOnly(null); setPicked({ uid: o.uid, name: o.name }); } : undefined}>
              <Person name={o.name} />
            </div>
          </Marker>
        ))}

        {rippleKey > 0 && !lite && (
          <Marker key={rippleKey} longitude={me.lng} latitude={me.lat} anchor="center" style={{ pointerEvents: "none", zIndex: 4 }}>
            <div className="ama-ripple-wrap" aria-hidden="true">
              <span className="ama-ripple" />
              <span className="ama-ripple" style={{ animationDelay: "0.7s" }} />
              <span className="ama-ripple" style={{ animationDelay: "1.4s" }} />
            </div>
          </Marker>
        )}

        <Marker longitude={me.lng} latitude={me.lat} anchor="bottom" style={{ zIndex: 5 }}>
          <Person name={userName || "You"} you walking={travelling && !lite} />
        </Marker>
      </Map>

      {sky.tint && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2]" style={{ background: sky.tint, mixBlendMode: sky.blend as any }} />}
      {rainNow && !lite && <div aria-hidden="true" className="ama-rain pointer-events-none absolute inset-0 z-[2]" />}
      {intro && (
        <div className="pointer-events-none absolute inset-x-0 top-[30%] z-20 flex justify-center">
          <span key={intro} className="ama-intro rounded-full bg-black/55 px-6 py-3 text-2xl font-extrabold text-white">{intro}</span>
        </div>
      )}

      <div className="pointer-events-none absolute left-24 right-3 top-3 z-10 flex items-center justify-end gap-2">
        <div className="pointer-events-auto flex h-11 min-w-0 items-center gap-2 rounded-full bg-white/95 px-3 shadow">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#1F7A4D]" aria-hidden="true" />
          <span className="truncate text-[13px] font-bold text-[#17131F]">{status}</span>
        </div>
        <div className="pointer-events-auto flex h-11 shrink-0 items-center rounded-full bg-white/95 px-3 text-[13px] font-bold text-[#165C3A] shadow">
          {peopleCount + 1} here
        </div>
      </div>

      <div className="absolute left-3 right-[68px] top-[64px] z-10 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        <button type="button" onClick={() => openOnly("list")} aria-label="Show places near me" className="ama-primary flex h-11 shrink-0 items-center px-5 text-[14px]">
          Nearby{filter !== "All" ? `: ${filter}` : ""}
        </button>
        <button type="button" onClick={() => openOnly("ask")} aria-label="Ask nearby shops for something" className="ama-accent flex h-11 shrink-0 items-center px-5 text-[14px]">
          Need something?
        </button>
        <button type="button" onClick={() => openOnly("chat")} aria-label="Chat with people near me" className="ama-chip flex h-11 shrink-0 items-center px-5 text-[14px]">
          Chat
        </button>
        <button type="button" onClick={() => { try { localStorage.setItem("amanaija:inbox-seen", new Date().toISOString()); } catch {} openOnly("inbox"); }} aria-label="Open my messages" className="ama-chip relative flex h-11 shrink-0 items-center px-5 text-[14px]">
          Messages{unread > 0 && <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#B3261E] px-1.5 text-[11px] font-extrabold text-white">{unread > 9 ? "9+" : unread}</span>}
        </button>
      </div>

      {noShopsNear && !hideEmpty && !asked && !askHello && !showList && !showChat && !showAsk && !showInbox && !picked && (
        <div className="absolute inset-x-3 bottom-[250px] z-10 rounded-2xl bg-white/95 p-3 shadow-lg">
          <button type="button" aria-label="Close" onClick={() => { setHideEmpty(true); try { sessionStorage.setItem("amanaija_hide_empty", "1"); } catch {} }} className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-gray-500 active:scale-95">×</button>
          <p className="pr-10 text-[15px] font-bold text-[#17131F]">No shops on the map here yet</p>
          <p className="mb-2 text-xs text-gray-600">Know a barber, a provision store or a food spot nearby? Invite them. It is free, and you help your street get found.</p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent("Put your shop on the AmaNaija map so people nearby can find you: https://amanaija.vercel.app")}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { setHideEmpty(true); try { sessionStorage.setItem("amanaija_hide_empty", "1"); } catch {} }}
            className="flex h-11 items-center justify-center rounded-full bg-[#1F7A4D] text-sm font-bold text-white active:scale-95"
          >
            Invite on WhatsApp
          </a>
        </div>
      )}

      {askHello && uidRef.current && !asked && (
        <div className="absolute inset-x-3 bottom-[250px] z-20 rounded-2xl bg-white/95 p-3 shadow-lg">
          <p className="text-[15px] font-bold text-[#17131F]">Let neighbours say hello?</p>
          <p className="mb-2 text-xs text-gray-600">They see only your first name and rough area, and you choose who to reply to. You can turn it off any time with the chat icon.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setHello(true); helloRef.current = true; setAskHello(false); try { localStorage.setItem("amanaija_hello", "1"); } catch {} announce(meRef.current.lat, meRef.current.lng); }} className="h-11 flex-1 rounded-full bg-[#1F7A4D] text-sm font-bold text-white active:scale-95">Yes, open to hello</button>
            <button type="button" onClick={() => { setAskHello(false); try { localStorage.setItem("amanaija_hello", "0"); } catch {} }} className="h-11 flex-1 rounded-full bg-gray-100 text-sm font-bold text-[#17131F] active:scale-95">Not now</button>
          </div>
        </div>
      )}

      {asked && !showAsk && (
        <div className="absolute inset-x-3 bottom-[250px] z-20 rounded-2xl bg-white/95 p-3 shadow-lg">
          <p className="text-[15px] font-bold text-[#17131F]">{answered.size ? `${answered.size} shop${answered.size > 1 ? "s" : ""} replied` : "Asking the street..."}</p>
          <p className="mb-2 text-xs text-gray-600">{answered.size ? "Glowing shops have it. Tap one to go there." : "Nearby shops are being alerted. Replies will light up here."}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => openOnly("ask")} className="h-11 flex-1 rounded-full bg-[#1F7A4D] text-sm font-bold text-white active:scale-95">View replies</button>
            <button type="button" onClick={() => { setAsked(null); setAnswered(new Set()); answeredRef.current = new Set(); }} className="h-11 flex-1 rounded-full bg-gray-100 text-sm font-bold text-[#17131F] active:scale-95">Done</button>
          </div>
        </div>
      )}

      {ghostNote && (ghostPeople.length > 0 || ghostCars.length > 0) && (
        <div className="absolute inset-x-3 bottom-[320px] z-10 flex items-center gap-2 rounded-2xl bg-white/95 p-3 shadow-lg">
          <p className="flex-1 text-xs text-gray-700">Faded figures show typical activity here. They are not real people and turn into real avatars when members arrive.</p>
          <button type="button" onClick={() => { setGhostNote(false); try { localStorage.setItem("amanaija_ghost_note", "1"); } catch {} }} className="h-11 shrink-0 rounded-full bg-gray-100 px-4 text-sm font-bold text-[#17131F] active:scale-95">Got it</button>
        </div>
      )}

      {sponsor && (
        <div className="absolute left-3 right-[68px] top-[116px] z-10 rounded-2xl bg-white/95 p-3 shadow-lg">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#B77A18]">Promoted</p>
          <p className="text-[15px] font-bold text-[#17131F]">Visit {sponsor.name}?</p>
          <p className="mb-2 text-xs text-gray-600">{fmtDist(sponsor._d)} from you</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { const p = sponsor; dismissSponsor(); travel(p); }} className="h-11 flex-1 rounded-full bg-[#1F7A4D] text-sm font-bold text-white active:scale-95">Take me there</button>
            <button type="button" onClick={dismissSponsor} className="h-11 flex-1 rounded-full bg-gray-100 text-sm font-bold text-[#17131F] active:scale-95">Not now</button>
          </div>
        </div>
      )}

      {picked && <PersonCard person={picked} myName={userName || "Neighbour"} onClose={() => setPicked(null)} />}
      {showInbox && <DmInbox onClose={() => setShowInbox(false)} />}

      {showAsk && <AskStreet lat={me.lat} lng={me.lng} onClose={() => setShowAsk(false)} />}

      {showChat && <AreaChat lat={me.lat} lng={me.lng} name={userName || "Neighbour"} onClose={() => setShowChat(false)} />}

      {locAsk === "ask" && (
        <div role="dialog" aria-modal="true" aria-label="Use your location" className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 p-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <div className="ama-card w-full max-w-md p-5" style={{ boxShadow: "0 20px 50px -20px rgba(0,0,0,.4)" }}>
            <p className="text-[22px] leading-tight text-[#1F1E1D]" style={{ fontFamily: "var(--font-serif), Georgia, serif", fontWeight: 600 }}>Start where you are</p>
            <p className="mt-2 text-[14px] leading-relaxed text-[#4A4943]">AmaNaija uses your location to show shops, hawkers and homes near you. Other people only ever see your area, about 1 km wide, never your exact spot. You can turn on ghost mode at any time.</p>
            <button type="button" onClick={() => { try { localStorage.setItem("amanaija_loc_primed", "1"); } catch {} setLocAsk("go"); }} className="ama-primary mt-4 h-12 w-full text-[16px]">Use my location</button>
            <button type="button" onClick={() => { try { localStorage.setItem("amanaija_loc_primed", "0"); } catch {} setLocAsk("skip"); }} className="mt-2 h-11 w-full text-[14px] font-semibold text-[#6B6A68]">Not now, show me Nigeria</button>
          </div>
        </div>
      )}

      {showList && (
        <div className="ama-sheet absolute inset-x-0 bottom-0 z-30 flex flex-col" style={{ height: listSize === "peek" ? "auto" : listSize === "half" ? "46%" : "86%", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div
            className="ama-grab" role="button" aria-label="Drag to open or close the list"
            onPointerDown={(e) => { grab.current = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
            onPointerUp={(e) => {
              const y0 = grab.current; grab.current = null; if (y0 === null) return;
              const dy = e.clientY - y0;
              if (dy < -24) stepSize(1); else if (dy > 24) stepSize(-1); else setListSize(listSize === "full" ? "half" : listSize === "half" ? "full" : "half");
            }}
          ><span /></div>
          <div className="flex items-center justify-between px-4 pb-2">
            <p className="text-[17px] font-semibold text-[#1F1E1D]" style={{ fontFamily: "var(--font-serif), Georgia, serif" }}>Near you</p>
            <div className="flex items-center gap-2">
              {listSize !== "peek" && (
                <div className="ama-seg" role="group" aria-label="Layout">
                  <button type="button" className={listLayout === "list" ? "on" : ""} onClick={() => { setListLayout("list"); try { localStorage.setItem("amanaija:list-layout", "list"); } catch {} }} aria-label="List">☰</button>
                  <button type="button" className={listLayout === "grid" ? "on" : ""} onClick={() => { setListLayout("grid"); try { localStorage.setItem("amanaija:list-layout", "grid"); } catch {} }} aria-label="Cards">▦</button>
                </div>
              )}
              <div className="ama-seg" role="group" aria-label="Size">
                <button type="button" className={listSize === "peek" ? "on" : ""} onClick={() => setListSize("peek")} aria-label="Strip">▭</button>
                <button type="button" className={listSize !== "peek" ? "on" : ""} onClick={() => setListSize(listSize === "peek" ? "half" : listSize === "half" ? "full" : "half")} aria-label="Expand">{listSize === "full" ? "▾" : "▴"}</button>
              </div>
              <button type="button" onClick={() => setShowList(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EFEDE4] text-lg text-[#4A4943] active:scale-95">×</button>
            </div>
          </div>
          {listSize !== "peek" && (
            <>
              <div className="px-4 pb-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shops, food, homes" aria-label="Search places" className="h-11 w-full rounded-xl bg-white px-4 text-[16px] text-[#1F1E1D] outline-none placeholder:text-[#8A8880] focus:ring-2 focus:ring-[#1F7A4D]" style={{ boxShadow: "inset 0 0 0 1px #E8E6DC" }} />
              </div>
              <div className="flex gap-2 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: "none" }}>
                {CHIPS.map((c) => (
                  <button key={c} type="button" onClick={() => setFilter(c)} className={`ama-pill shrink-0 ${filter === c ? "on" : ""}`}>{c}</button>
                ))}
              </div>
            </>
          )}
          {nearby.length === 0 && <p className="px-4 py-4 text-sm text-[#6B6A68]">Nothing here yet. Try another category or walk somewhere new.</p>}
          {listSize === "peek" ? (
            <div className="flex gap-2 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: "none", scrollSnapType: "x proximity" }}>
              {nearby.map(({ p, d }) => (
                <button key={p.id} type="button" onClick={() => { setShowList(false); travel(p); }} className="ama-card flex w-[172px] shrink-0 flex-col gap-1 p-3 text-left active:scale-[0.98]" style={{ scrollSnapAlign: "start" }}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: COLORS[p.category] || "#2E4A36" }}>{pinIcon(p.category)}</span>
                  <span className="truncate text-[14px] font-semibold text-[#1F1E1D]">{p.name}</span>
                  <span className="text-[12px] text-[#6B6A68]">{p.category === "Residential" ? "Home" : p.category} · {fmtDist(d)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className={`flex-1 overflow-y-auto px-4 pb-6 ${listLayout === "grid" ? "grid grid-cols-2 content-start gap-2" : ""}`}>
              {nearby.map(({ p, d }) =>
                listLayout === "grid" ? (
                  <button key={p.id} type="button" onClick={() => { setShowList(false); travel(p); }} className="ama-card flex flex-col gap-1 p-3 text-left active:scale-[0.98]">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: COLORS[p.category] || "#2E4A36" }}>{pinIcon(p.category)}</span>
                    <span className="truncate text-[14px] font-semibold text-[#1F1E1D]">{p.name}</span>
                    <span className="text-[12px] text-[#6B6A68]">{p.category === "Residential" ? "Home" : p.category} · {fmtDist(d)}</span>
                    {(p.status === "claimed" || p.status === "verified") && <span className="text-[11px] font-semibold text-[#1F7A4D]">Open for orders</span>}
                  </button>
                ) : (
                  <button key={p.id} type="button" onClick={() => { setShowList(false); travel(p); }} className="flex min-h-[58px] w-full items-center gap-3 border-b border-[#E8E6DC] py-2 text-left active:bg-black/[0.03]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: COLORS[p.category] || "#2E4A36" }}>{pinIcon(p.category)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-[#1F1E1D]">{p.name}</span>
                      <span className="block text-xs text-[#6B6A68]">
                        {p.category === "Residential" ? "Home" : p.category}{p.for_rent ? " · For rent" : ""}{promoted.has(p.id) ? " · Promoted" : ""}{p.status === "claimed" || p.status === "verified" ? " · Open for orders" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-[#1F7A4D]">{fmtDist(d)}</span>
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}

      <div className="absolute right-3 top-[64px] z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={goReal}
          disabled={locating}
          aria-label="Use my real location"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow active:scale-95 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className={`h-6 w-6 ${locating ? "animate-pulse" : ""}`} fill="none" stroke="#1F7A4D" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
        {trafficOn && (
          <button
            type="button"
            onClick={() => { setShowTraffic((v) => !v); flash(!showTraffic ? "Live traffic on" : "Live traffic off"); }}
            aria-pressed={showTraffic}
            aria-label={showTraffic ? "Live traffic is on. Tap to turn off" : "Show live traffic"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke={showTraffic ? "#C8506B" : "#6B7280"} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M4 18c3-8 5-8 8-4s5 4 8-8" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={toggleLite}
          aria-pressed={lite}
          aria-label={lite ? "Light mode is on. Tap to turn off" : "Turn on light mode"}
          className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill={lite ? "#F4B73F" : "none"} stroke={lite ? "#B77A18" : "#6B7280"} strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !hello;
            setHello(next);
            helloRef.current = next;
            try { localStorage.setItem("amanaija_hello", next ? "1" : "0"); } catch {}
            announce(meRef.current.lat, meRef.current.lng);
            flash(next ? "Open to hello: neighbours can send you a request" : "Hello off: people can see you but not message you");
          }}
          aria-pressed={hello}
          aria-label={hello ? "Open to hello is on. Tap to turn off" : "Turn on open to hello"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill={hello ? "#F4B73F" : "none"} stroke={hello ? "#B77A18" : "#6B7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !ghostMode;
            setGhostMode(next);
            ghostRef.current = next;
            try { localStorage.setItem("amanaija_ghost_mode", next ? "1" : "0"); } catch {}
            announce(meRef.current.lat, meRef.current.lng);
            flash(next ? "Ghost mode on: nobody can see you" : "Ghost mode off: others see only your area");
          }}
          aria-pressed={ghostMode}
          aria-label={ghostMode ? "Ghost mode is on. Tap to turn off" : "Turn on ghost mode to hide from others"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill={ghostMode ? "#1F7A4D" : "none"} stroke={ghostMode ? "#165C3A" : "#6B7280"} strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 21V11a7 7 0 0 1 14 0v10l-3-2-2 2-2-2-2 2-2-2-3 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}