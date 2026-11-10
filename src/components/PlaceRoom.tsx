"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { saveMyLife, whenSaid, type Life } from "@/lib/life";
import { say } from "@/lib/guide";

export default function PlaceRoom({
  life,
  mine,
  onClose,
  onSaved,
}: {
  life: Life;
  mine: boolean;
  onClose: () => void;
  onSaved: (life: Life) => void;
}) {
  const [note, setNote] = useState(life.note);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    const text = note.trim();
    if (text.length < 2) { setMsg("Say what is true here."); return; }
    setBusy(true);
    setMsg("");
    const { life: saved, error } = await saveMyLife(supabase, {
      user_id: life.user_id,
      place_name: life.place_name,
      note: text,
      lat: life.lat,
      lng: life.lng,
    });
    setBusy(false);
    if (!saved) { setMsg(error || "Could not save. Try again when the signal is back."); return; }
    onSaved(saved);
  };

  const hour = new Date().getHours();
  const night = hour >= 19 || hour < 5;
  const warm = hour < 7 || hour >= 17;
  const sky = night ? "#1B2448" : warm ? "#F4A06A" : "#8EC8F0";
  const light = night ? "#F4E7B0" : "#FFF6D8";

  if (!mine) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col bg-[#F3E6D4]" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <button type="button" onClick={onClose} className="m-3 h-11 w-fit rounded-full bg-white px-4 text-[14px] font-bold text-[#17131F] shadow">Step outside</button>
        <p className="px-4 text-[20px] font-extrabold text-[#17131F]">This home is private.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#F3E6D4]">
      <div className="relative shrink-0 overflow-hidden" style={{ height: "36dvh", minHeight: 220, maxHeight: 320, background: night ? "#2A241C" : "#E7D3B5" }}>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
          <rect x="78" y="28" width="244" height="132" rx="8" fill={sky} />
          <rect x="70" y="20" width="260" height="148" rx="10" fill="none" stroke="#6B4A2A" strokeWidth="8" />
          <path d="M200 20 v148" stroke="#6B4A2A" strokeWidth="6" />
          <path d="M70 94 h260" stroke="#6B4A2A" strokeWidth="6" />
          <rect x="86" y="36" width="16" height="48" fill={light} opacity="0.85" />
          <rect x="298" y="36" width="16" height="48" fill={light} opacity="0.55" />
          <rect x="0" y="176" width="400" height="64" fill="#C4A574" />
          <rect x="148" y="188" width="104" height="10" rx="3" fill="#8B5A2B" />
          <rect x="156" y="176" width="88" height="14" fill="#A97444" />
        </svg>
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center gap-2 px-3" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
          <button type="button" onClick={onClose} className="h-11 rounded-full bg-white/95 px-4 text-[14px] font-bold text-[#17131F] shadow">Step outside</button>
          <p className="ml-auto truncate rounded-full bg-white/95 px-3 py-2 text-[13px] font-bold text-[#17131F] shadow">{mine ? "Your home" : "Someone lives here"}</p>
        </div>
        <p className="absolute bottom-3 left-4 right-4 truncate text-[22px] font-extrabold text-[#17131F]">{life.place_name}</p>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-4 pb-6 pt-4">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[20px] font-extrabold leading-snug text-[#17131F]">{life.note}</p>
          <button type="button" aria-label="Read this aloud" onClick={() => say(life.note)} className="flex h-11 shrink-0 items-center rounded-full bg-white px-3 text-[15px] font-extrabold text-[#165C3A] shadow">Hear</button>
        </div>
        <p className="mt-1 text-[13px] font-semibold text-[#6A6275]">True {whenSaid(life.updated_at)}</p>
        {(life.memory?.length || 0) > 0 ? (
          <ul className="mt-4 space-y-2">
            {(life.memory || []).map((item, i) => (
              <li key={item.at + i} className="rounded-2xl bg-white/80 px-3 py-3 text-[14px] leading-snug text-[#4B4457]">
                {item.note}
                <span className="mt-1 block text-[12px] font-semibold text-[#6A6275]">{whenSaid(item.at)}</span>
              </li>
            ))}
          </ul>
        ) : life.prior_note ? (
          <p className="mt-4 rounded-2xl bg-white/80 px-3 py-3 text-[14px] leading-snug text-[#4B4457]">
            Before that: {life.prior_note}
            {life.prior_at ? ` · ${whenSaid(life.prior_at)}` : ""}
          </p>
        ) : null}
        {mine && (
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-auto space-y-2 pt-6">
            <input maxLength={180} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is true here now?" className="h-12 w-full rounded-xl border border-[#DCE5DE] bg-white px-3 text-[16px]" />
            <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-[#1F7A4D] text-[15px] font-bold text-white disabled:opacity-60">{busy ? "Saving…" : "This is true now"}</button>
          </form>
        )}
        {msg && <p className="mt-2 text-[13px] font-semibold text-[#17131F]">{msg}</p>}
      </div>
    </div>
  );
}
