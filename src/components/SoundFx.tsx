"use client";
import { useEffect, useState } from "react";
import { enablePush, pushWasEnabled } from "@/lib/push";
import { playClick, playType, setSoundOn, soundOn } from "@/lib/ui-sound";

// Click sound on buttons and links, tile sound while typing. Can be turned off with SoundToggle.
export default function SoundFx() {
  useEffect(() => {
    const down = (e: Event) => { const t = e.target as HTMLElement | null; if (t?.closest?.("button, a, [role=button], summary, select")) playClick(); };
    const typed = (e: Event) => { const t = e.target as HTMLElement | null; if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) playType(); };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("input", typed, true);
    return () => { document.removeEventListener("pointerdown", down, true); document.removeEventListener("input", typed, true); };
  }, []);
  return null;
}

export function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(soundOn()), []);
  return (
    <button type="button" onClick={() => { const v = !on; setOn(v); setSoundOn(v); if (v) playClick(); }} aria-label={on ? "Turn sounds off" : "Turn sounds on"} className="text-xs font-semibold text-[#4A4943] whitespace-nowrap">{on ? "Sound on" : "Silent"}</button>
  );
}

export function AlertsButton() {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  useEffect(() => setOn(pushWasEnabled()), []);
  return (
    <>
      <button type="button" onClick={async () => { const m = await enablePush(); setMsg(m); setOn(pushWasEnabled()); }} className="text-xs font-semibold text-[#4A4943] whitespace-nowrap">{on ? "Alerts on" : "Turn on alerts"}</button>
      {msg && <span role="status" className="basis-full text-[11px] text-[#6B6A68]">{msg}</span>}
    </>
  );
}
