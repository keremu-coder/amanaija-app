"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Place = { id: string; name: string; type: string; state: string; lat: number; lng: number };

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = normalize(query);
  const t = normalize(text);
  if (!q) return true;
  if (t.includes(q)) return true;
  const maxEdits = Math.max(1, Math.floor(q.length / 4));
  const words = t.split(/\s+/);
  for (const w of words) {
    if (w.length >= 3 && Math.abs(w.length - q.length) <= maxEdits) {
      if (levenshtein(q, w) <= maxEdits) return true;
    }
  }
  return false;
}

const STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];

const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  "Abia": {lat: 5.4527, lng: 7.5248}, "Rivers": {lat: 4.8156, lng: 7.0498}, "Lagos": {lat: 6.5244, lng: 3.3792},
  "FCT": {lat: 9.0765, lng: 7.3986}, "Kano": {lat: 12.0022, lng: 8.5920}, "Anambra": {lat: 6.2209, lng: 6.937},
  "Delta": {lat: 5.704, lng: 6.1676}, "Edo": {lat: 6.335, lng: 5.6037}, "Oyo": {lat: 7.3775, lng: 3.947},
  "Enugu": {lat: 6.4584, lng: 7.5464}, "Kaduna": {lat: 10.5105, lng: 7.4165}, "Plateau": {lat: 9.2182, lng: 9.5179},
  "Akwa Ibom": {lat: 5.0378, lng: 7.9128}, "Imo": {lat: 5.4840, lng: 7.0332}, "Ogun": {lat: 7.1608, lng: 3.3485},
  "Ondo": {lat: 7.2571, lng: 5.2058}, "Osun": {lat: 7.5629, lng: 4.5200}, "Ekiti": {lat: 7.7199, lng: 5.3112},
  "Kwara": {lat: 8.4966, lng: 4.5481}, "Kogi": {lat: 7.8024, lng: 6.7333}, "Benue": {lat: 7.7322, lng: 8.5391},
  "Nasarawa": {lat: 8.4904, lng: 8.5221}, "Niger": {lat: 9.6139, lng: 6.5569}, "Sokoto": {lat: 13.0059, lng: 5.2476},
  "Kebbi": {lat: 12.4539, lng: 4.1975}, "Zamfara": {lat: 12.1704, lng: 6.6641}, "Katsina": {lat: 12.9908, lng: 7.6018},
  "Jigawa": {lat: 11.7564, lng: 9.3386}, "Yobe": {lat: 11.7482, lng: 11.9660}, "Borno": {lat: 11.8846, lng: 13.1510},
  "Adamawa": {lat: 9.3265, lng: 12.3984}, "Taraba": {lat: 8.8810, lng: 11.3749}, "Gombe": {lat: 10.2897, lng: 11.1673},
  "Bauchi": {lat: 10.3158, lng: 9.8442}, "Cross River": {lat: 5.8701, lng: 8.5988}, "Bayelsa": {lat: 4.7719, lng: 6.0699},
  "Ebonyi": {lat: 6.2649, lng: 8.0138}
};

function PinIcon({ size = 22, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function PlaceRow({ name, sub, live, onClick }: { name: string; sub: string; live: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white border border-[#EADFCF] text-left active:scale-[0.99] transition-transform"
      style={{ minHeight: 68 }}
    >
      <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: live ? "#1F7A4D" : "#FCEBC8" }}>
        <PinIcon color={live ? "#FFFFFF" : "#7A4A00"} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-[17px] text-[#17131F] truncate">{name}</span>
        {sub && <span className="block text-sm text-[#4B4457] truncate">{sub}</span>}
      </span>
      <span
        className="px-3 py-1.5 rounded-xl text-[13px] font-bold shrink-0"
        style={live ? { background: "#DDF1E4", color: "#165C3A" } : { background: "#FCEBC8", color: "#6B4000" }}
      >
        {live ? "Open now" : "Be the first"}
      </span>
    </button>
  );
}

export default function LoungeScene({
  onEnterRoom, onOpenMap, onOpenShopOwner, onSelectLocation, userName, placeCount
}: {
  onEnterRoom: () => void;
  onOpenMap: () => void;
  onOpenShopOwner: () => void;
  onSelectLocation: (lat: number, lng: number) => void;
  userName: string;
  placeCount: number;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [query, setQuery] = useState("");
  const [livePlaces, setLivePlaces] = useState<Place[]>([]);
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [gpsMsg, setGpsMsg] = useState("");

  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaState, setNewAreaState] = useState("");
  const [isSavingArea, setIsSavingArea] = useState(false);

  useEffect(() => {
    if (!showPicker) return;
    setLoading(true);
    Promise.all([
      supabase.from("places").select("id, name, category, lat, lng").is("parent_id", null).order("name"),
      supabase.from("nigerian_places").select("id, name, type, state, lat, lng").order("name")
    ]).then(([liveRes, allRes]) => {
      if (liveRes.data) setLivePlaces(liveRes.data.map((p: any) => ({ id: p.id, name: p.name, type: p.category, state: "", lat: p.lat, lng: p.lng })));
      if (allRes.data) setAllPlaces(allRes.data as Place[]);
      setLoading(false);
    });
  }, [showPicker]);

  const q = normalize(query);
  const rank = (name: string) => {
    const n = normalize(name);
    if (!q) return 2;
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    return 2;
  };

  const filteredLive = livePlaces
    .filter(p => fuzzyMatch(query, p.name))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
  const filteredAll = allPlaces
    .filter(p => fuzzyMatch(query, p.name) || fuzzyMatch(query, p.state))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));

  const handleNearest = () => {
    setGpsMsg("");
    if (!navigator.geolocation) {
      setGpsMsg("Your phone cannot share its location here.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSelectLocation(pos.coords.latitude, pos.coords.longitude);
        setShowPicker(false);
      },
      () => setGpsMsg("We could not get your location. Search for your area instead."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleAddArea = async () => {
    if (!newAreaName || !newAreaState) return;
    setIsSavingArea(true);
    const coords = STATE_COORDS[newAreaState] || { lat: 9.0765, lng: 7.3986 };
    const { error } = await supabase.from("nigerian_places").insert([{
      name: newAreaName,
      type: "area",
      state: newAreaState,
      lat: coords.lat,
      lng: coords.lng,
      status: "pending"
    }]);
    setIsSavingArea(false);
    if (error) {
      alert("Error saving area: " + error.message);
    } else {
      alert("Area submitted! It is now visible to you and pending admin review.");
      onSelectLocation(coords.lat, coords.lng);
      setShowAddForm(false);
      setShowPicker(false);
      setNewAreaName("");
      setNewAreaState("");
    }
  };

  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ height: "100dvh", minHeight: "100dvh" }}>

      <style>{`
        @keyframes keke-drive {
          from { transform: translateX(-90px); }
          to   { transform: translateX(470px); }
        }
        .keke-anim { animation: keke-drive 14s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .keke-anim { animation: none; } }
      `}</style>

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 700" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d0418" />
            <stop offset="30%" stopColor="#4a1e50" />
            <stop offset="60%" stopColor="#b04a5c" />
            <stop offset="85%" stopColor="#e8834d" />
            <stop offset="100%" stopColor="#f9c26b" />
          </linearGradient>
          <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#ffedb3" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffd166" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="400" height="700" fill="url(#sky)" />
        <circle cx="280" cy="265" r="45" fill="url(#sunGlow)" />
        <circle cx="280" cy="265" r="18" fill="#ffedb3" />

        <g fill="#1a0a1f" opacity="0.7">
          <rect x="0" y="195" width="22" height="40" />
          <rect x="25" y="205" width="18" height="30" />
          <rect x="48" y="180" width="28" height="55" />
          <rect x="80" y="200" width="15" height="35" />
          <rect x="100" y="210" width="22" height="25" />
          <rect x="128" y="190" width="20" height="45" />
          <rect x="152" y="200" width="25" height="35" />
          <rect x="182" y="185" width="18" height="50" />
          <rect x="205" y="205" width="28" height="30" />
          <rect x="238" y="195" width="22" height="40" />
          <rect x="265" y="205" width="25" height="30" />
          <rect x="295" y="190" width="22" height="45" />
          <rect x="322" y="200" width="30" height="35" />
          <rect x="356" y="185" width="20" height="50" />
          <rect x="380" y="200" width="20" height="35" />
        </g>

        <g stroke="#0d0418" strokeWidth="1.8" fill="none" opacity="0.9">
          <line x1="30" y1="80" x2="30" y2="400" />
          <line x1="24" y1="95" x2="36" y2="95" />
          <line x1="24" y1="117" x2="36" y2="117" />
          <line x1="165" y1="60" x2="165" y2="400" />
          <line x1="159" y1="75" x2="171" y2="75" />
          <line x1="159" y1="97" x2="171" y2="97" />
          <line x1="340" y1="70" x2="340" y2="400" />
          <line x1="334" y1="85" x2="346" y2="85" />
          <line x1="334" y1="107" x2="346" y2="107" />
          <path d="M 30 95 Q 97 135, 165 75" strokeWidth="0.9" strokeDasharray="3 2" opacity="0.6" />
          <path d="M 165 75 Q 252 130, 340 85" strokeWidth="0.9" strokeDasharray="3 2" opacity="0.6" />
        </g>

        <g>
          <rect x="78" y="290" width="55" height="110" fill="#3d1f2c" />
          <path d="M 76 290 L 105 240 L 134 290 Z" fill="#3d1f2c" />
          <line x1="105" y1="240" x2="105" y2="208" stroke="#3d1f2c" strokeWidth="2.5" />
          <line x1="99" y1="220" x2="111" y2="220" stroke="#3d1f2c" strokeWidth="2.5" />
          <rect x="86" y="315" width="10" height="14" fill="#ffd166" opacity="0.9" />
          <rect x="116" y="315" width="10" height="14" fill="#ffd166" opacity="0.9" />
          <rect x="86" y="348" width="10" height="12" fill="#ffd166" opacity="0.6" />
          <rect x="116" y="348" width="10" height="12" fill="#ffd166" opacity="0.6" />
          <rect x="96" y="370" width="18" height="30" fill="#1a0a14" />
        </g>

        <g>
          <rect x="152" y="282" width="48" height="8" fill="#9a9aa5" />
          <line x1="162" y1="282" x2="162" y2="290" stroke="#6a6a75" strokeWidth="0.8" />
          <line x1="172" y1="282" x2="172" y2="290" stroke="#6a6a75" strokeWidth="0.8" />
          <line x1="182" y1="282" x2="182" y2="290" stroke="#6a6a75" strokeWidth="0.8" />
          <line x1="192" y1="282" x2="192" y2="290" stroke="#6a6a75" strokeWidth="0.8" />
          <rect x="154" y="290" width="44" height="110" fill="#6a4a2a" />
          <rect x="150" y="290" width="52" height="3" fill="#c94a3a" />
          <rect x="164" y="305" width="11" height="10" fill="#ffd166" opacity="0.9" />
          <rect x="180" y="305" width="11" height="10" fill="#ffd166" opacity="0.6" />
          <rect x="168" y="360" width="20" height="40" fill="#2a1a10" />

          <rect x="205" y="288" width="55" height="8" fill="#9a9aa5" />
          <line x1="217" y1="288" x2="217" y2="296" stroke="#6a6a75" strokeWidth="0.8" />
          <line x1="229" y1="288" x2="229" y2="296" stroke="#6a6a75" strokeWidth="0.8" />
          <line x1="241" y1="288" x2="241" y2="296" stroke="#6a6a75" strokeWidth="0.8" />
          <line x1="253" y1="288" x2="253" y2="296" stroke="#6a6a75" strokeWidth="0.8" />
          <rect x="207" y="296" width="51" height="104" fill="#5a3a1a" />
          <rect x="203" y="296" width="59" height="3" fill="#2d5a27" />
          <rect x="216" y="312" width="11" height="10" fill="#ffd166" opacity="0.9" />
          <rect x="236" y="312" width="11" height="10" fill="#ffd166" opacity="0.6" />
          <rect x="222" y="362" width="20" height="38" fill="#2a1a10" />
        </g>

        <g>
          <rect x="283" y="310" width="72" height="90" fill="#3d1f2c" />
          <path d="M 283 310 Q 319 255, 355 310 Z" fill="#2a1020" />
          <circle cx="319" cy="270" r="3.5" fill="#d4af37" />
          <rect x="293" y="335" width="11" height="14" fill="#ffd166" opacity="0.9" />
          <rect x="314" y="335" width="11" height="14" fill="#ffd166" opacity="0.7" />
          <rect x="335" y="335" width="11" height="14" fill="#ffd166" opacity="0.6" />
          <rect x="307" y="365" width="24" height="35" fill="#1a0a14" />
          <rect x="363" y="200" width="7" height="200" fill="#3d1f2c" />
          <path d="M 363 200 L 366.5 178 L 370 200 Z" fill="#3d1f2c" />
          <circle cx="366.5" cy="174" r="2.5" fill="#d4af37" />
          <rect x="359" y="240" width="15" height="3" fill="#2a1020" />
          <rect x="359" y="280" width="15" height="3" fill="#2a1020" />
        </g>

        <rect x="0" y="400" width="400" height="300" fill="#2a1810" />
        <rect x="0" y="400" width="400" height="2" fill="#3a2820" opacity="0.9" />
        <rect x="0" y="415" width="400" height="55" fill="#3a2820" />
        <g fill="#7a6a4a" opacity="0.5">
          <rect x="20" y="440" width="18" height="2" />
          <rect x="55" y="440" width="18" height="2" />
          <rect x="90" y="440" width="18" height="2" />
          <rect x="125" y="440" width="18" height="2" />
          <rect x="160" y="440" width="18" height="2" />
          <rect x="195" y="440" width="18" height="2" />
          <rect x="230" y="440" width="18" height="2" />
          <rect x="265" y="440" width="18" height="2" />
          <rect x="300" y="440" width="18" height="2" />
          <rect x="335" y="440" width="18" height="2" />
          <rect x="370" y="440" width="18" height="2" />
        </g>

        <g transform="translate(0, 425)">
          <g className="keke-anim">
            <rect x="0" y="0" width="55" height="32" rx="14" fill="#f4b942" stroke="#1a0a14" strokeWidth="2" />
            <rect x="6" y="5" width="43" height="18" rx="8" fill="#3a2810" />
            <circle cx="50" cy="20" r="3" fill="#ffedb3" />
            <circle cx="12" cy="34" r="7" fill="#1a0a14" />
            <circle cx="12" cy="34" r="3" fill="#666" />
            <circle cx="43" cy="34" r="7" fill="#1a0a14" />
            <circle cx="43" cy="34" r="3" fill="#666" />
          </g>
        </g>
      </svg>

      <div className="absolute bottom-0 left-0 right-0 h-1/2 pointer-events-none" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.75) 100%)" }} />

      <div className="absolute top-0 left-0 right-0 flex justify-between items-center z-20" style={{ padding: "max(16px, env(safe-area-inset-top)) 16px 16px 16px" }}>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-[#2E4A36] rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white/40">A</div>
          <div>
            <p className="text-white font-bold text-sm leading-tight drop-shadow">AmaNaija</p>
            <p className="text-white/70 text-[10px] leading-tight">{placeCount} places open now</p>
          </div>
        </div>
        <button onClick={onOpenShopOwner} className="bg-white/15 backdrop-blur-md border border-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-white/25">Shop Owner</button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20" style={{ padding: "16px", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-2xl border border-white/50">
          <h1 className="text-xl font-bold text-[#2E4A36] tracking-tight">Welcome to AmaNaija</h1>
          <p className="text-xs text-gray-600 mt-1 mb-3 leading-snug">Your street. Your people. Anywhere in the world.</p>
          <button onClick={() => setShowPicker(true)} className="w-full bg-[#2E4A36] text-white font-bold py-3.5 rounded-2xl shadow-lg hover:bg-[#203527] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base">
            <PinIcon size={20} /> Find your street
          </button>
          <button onClick={onEnterRoom} className="w-full mt-2 bg-[#E8EFEA] border-2 border-[#DCE5DE] text-[#2E4A36] font-semibold py-3 rounded-2xl hover:bg-[#DCE5DE] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm">
            Enter Aba Lounge
          </button>
          <div className="flex justify-center mt-2">
            <button onClick={onOpenMap} className="text-[12px] text-gray-500 hover:text-[#2E4A36] underline underline-offset-2 py-2 px-3">
              See the map
            </button>
          </div>
        </div>
      </div>

      {showPicker && !showAddForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={() => setShowPicker(false)}>
          <div className="bg-[#FFFBF5] rounded-t-[32px] w-full max-w-md p-5 pb-8 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[26px] font-extrabold text-[#17131F]">Find your street</h2>
              <button onClick={() => setShowPicker(false)} aria-label="Close" className="w-11 h-11 rounded-full bg-[#F1EADF] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#17131F" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="flex items-center gap-3 bg-white rounded-2xl px-4 mb-3" style={{ height: 56, border: "2px solid #1F7A4D" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#165C3A" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              <input
                type="text"
                placeholder="Search your area, e.g. Eleme, Aba, Lagos"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 min-w-0 bg-transparent outline-none text-[17px] text-[#17131F] font-semibold"
              />
            </div>

            <button onClick={handleNearest} className="w-full flex items-center justify-center gap-2 rounded-2xl font-bold text-base text-[#165C3A] mb-1" style={{ height: 48, background: "#E7F3EB" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#165C3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
              Suggest my nearest street
            </button>
            {gpsMsg && <p className="text-sm text-[#B3261E] font-semibold mb-2">{gpsMsg}</p>}

            {loading ? (
              <p className="text-center text-sm text-[#6A6275] py-8">Loading places...</p>
            ) : (
              <div className="space-y-5 mt-4">
                {filteredLive.length > 0 && (
                  <div>
                    <p className="text-[13px] font-bold uppercase text-[#6A6275] mb-2" style={{ letterSpacing: "0.06em" }}>Open now</p>
                    <div className="space-y-2">
                      {filteredLive.slice(0, 20).map(p => (
                        <PlaceRow key={p.id} name={p.name} sub={p.type || ""} live onClick={() => { onSelectLocation(p.lat, p.lng); setShowPicker(false); }} />
                      ))}
                    </div>
                  </div>
                )}

                {filteredAll.length > 0 && (
                  <div>
                    <p className="text-[13px] font-bold uppercase text-[#6A6275] mb-2" style={{ letterSpacing: "0.06em" }}>{query ? "Matches" : "Places across Nigeria"}</p>
                    <div className="space-y-2">
                      {filteredAll.slice(0, 40).map(p => (
                        <PlaceRow key={p.id} name={p.name} sub={p.state ? `${p.state} State` : ""} live={false} onClick={() => { onSelectLocation(p.lat, p.lng); setShowPicker(false); }} />
                      ))}
                    </div>
                  </div>
                )}

                {filteredLive.length === 0 && filteredAll.length === 0 && (
                  <p className="text-center text-[15px] text-[#4B4457]">No places found for &quot;{query}&quot;.</p>
                )}

                <div className="rounded-[20px] p-4" style={{ border: "2px dashed #C9B99E" }}>
                  <p className="text-xl font-extrabold text-[#17131F]">Can&apos;t find your area?</p>
                  <p className="text-[15px] text-[#4B4457] mt-1 mb-3" style={{ lineHeight: 1.4 }}>Add it in a minute. You can go in straight away, and we confirm it with your neighbours.</p>
                  <button onClick={() => { setNewAreaName(query); setShowAddForm(true); }} className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#17131F] text-white font-bold text-base" style={{ height: 50 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    Add my area
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold text-[#2E4A36] mb-2">Add your area</h3>
            <p className="text-sm text-gray-600 mb-4">Help us grow the map. Add your street or area.</p>

            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">State</label>
                <select
                  value={newAreaState}
                  onChange={(e) => setNewAreaState(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none"
                >
                  <option value="">Select State</option>
                  {STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Area / Street Name</label>
                <input
                  type="text"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="e.g. Rukpokwu"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowAddForm(false)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl">Cancel</button>
              <button onClick={handleAddArea} disabled={!newAreaName || !newAreaState || isSavingArea} className="flex-1 bg-[#2E4A36] text-white font-bold py-3 rounded-xl disabled:opacity-50">
                {isSavingArea ? "Saving..." : "Add Area"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
