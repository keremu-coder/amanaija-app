"use client";

import { useEffect, useState } from "react";
import { learnRoad, markSeen, matchTell, readGuide, readOwner, readVoice, recallDay, saveOwnerName, say, supportLine, takePersonal, taught, thankGuide, think, writeGuide, writeVoice, type GuideVoice } from "@/lib/guide";

export default function GuideButton({ big, icon }: { line?: string; big?: boolean; icon?: boolean }) {
  const [on, setOn] = useState(false);
  const [panel, setPanel] = useState(false);
  const [voice, setVoice] = useState<GuideVoice>("woman");
  const [told, setTold] = useState("");
  const [missed, setMissed] = useState("");
  const [ownerName, setOwnerName] = useState("");

  useEffect(() => {
    const sync = () => setOn(readGuide());
    sync();
    setVoice(readVoice());
    setOwnerName(readOwner().name);
    window.speechSynthesis?.getVoices();
    window.addEventListener("amanaija-guide", sync);
    return () => window.removeEventListener("amanaija-guide", sync);
  }, []);

  useEffect(() => {
    if (!panel || !on) return;
    markSeen();
    setOwnerName(readOwner().name);
    const road = recallDay();
    if (road) {
      const name = readOwner().name;
      say(name ? `${name}, yesterday I took you to ${road}. I still remember.` : `Yesterday I took you to ${road}. I still remember.`);
    }
  }, [panel, on]);

  const choose = (next: GuideVoice) => {
    setVoice(next);
    writeVoice(next);
    say(next === "woman" ? "I am here. I will walk with you." : "I am here. I will stay with you.");
  };

  const accept = () => {
    writeVoice(voice);
    writeGuide(true);
    setOn(true);
    window.dispatchEvent(new Event("amanaija-guide"));
    say("I am with you now. I will not leave you lost. What do you want to do?");
  };

  const dance = () => {
    say(taught("dance", "Dance with me."));
    setPanel(false);
    window.dispatchEvent(new Event("amanaija-guide-dance"));
  };

  const keep = (text: string) => {
    const kind = takePersonal(text);
    if (kind === "name") {
      setOwnerName(readOwner().name);
      say(supportLine("heart"));
      return true;
    }
    if (kind === "memory") {
      say(readOwner().name ? `I saved that, ${readOwner().name}. It stays with me.` : "I saved that. It stays with me.");
      return true;
    }
    return false;
  };

  const tell = () => {
    const text = told.trim();
    setTold("");
    if (!text) return;
    if (keep(text)) return;
    const thought = think(text);
    if (thought) { say(thought); return; }
    const said = text.toLowerCase();
    if (/\b(heart|sad|lonely)\b/.test(said)) { say(supportLine("heart")); return; }
    if (/\b(body|tired|rest)\b/.test(said)) { say(supportLine("body")); return; }
    if (/\bmind\b/.test(said)) { say(supportLine("mind")); return; }
    if (/\b(spirit|pray|prayer)\b/.test(said)) { say(supportLine("spirit")); return; }
    const action = matchTell(text);
    if (action === "dance") { dance(); return; }
    if (action) {
      if (missed) learnRoad(missed, action);
      setMissed("");
      want(action);
      return;
    }
    setMissed(text);
    say("Say it shorter. Market, my place, the shops, or my street.");
  };

  const want = (action: "street" | "place" | "shops" | "market" | "stay" | "thanks") => {
    if (missed && action !== "stay" && action !== "thanks") {
      learnRoad(missed, action);
      setMissed("");
    }
    if (action === "stay") {
      say("I am right here. Take your time.");
      setPanel(false);
      return;
    }
    if (action === "thanks") {
      const n = thankGuide();
      say(taught("thanks", n === 1 ? "Thank you. I will remember that." : "Thank you. I am glad we are friends."));
      setPanel(false);
      return;
    }
    const line = action === "street"
      ? "Watch me. I am walking to your street."
      : action === "place"
        ? "Watch me. I am walking to your place."
        : action === "market"
          ? "Watch me. I am walking to the market."
          : "Watch me. I am walking to the shops.";
    say(line);
    setPanel(false);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("amanaija-guide-walk", { detail: action })), 60);
  };

  const leave = () => {
    writeGuide(false);
    setOn(false);
    setPanel(false);
    window.dispatchEvent(new Event("amanaija-guide"));
  };

  return (
    <>
      <button type="button" onClick={() => setPanel(true)} aria-label={on ? "My guide" : "Guide me"} className={icon
        ? "flex h-11 w-11 items-center justify-center rounded-full bg-white text-[13px] font-extrabold text-[#17131F] shadow"
        : big
        ? "mb-2 flex h-12 w-full items-center justify-center rounded-2xl bg-white text-[16px] font-extrabold text-[#17131F] shadow active:scale-[0.98]"
        : "h-11 shrink-0 rounded-full bg-white px-4 text-[14px] font-bold text-[#17131F] shadow"}>
        {icon ? "G" : on ? "My guide" : "Guide me"}
      </button>
      {panel && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/40" onClick={() => setPanel(false)}>
          <div className="mb-[max(16px,env(safe-area-inset-bottom))] max-h-[78dvh] w-[min(100%,28rem)] overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {!on ? (
              <>
                <p className="text-[20px] font-extrabold text-[#17131F]">I can walk with you.</p>
                <p className="mt-1 text-[15px] leading-snug text-[#17131F]">I stay with you, I explain this place, and I ask what you want to do. Tell me to go when you want to be alone.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => choose("woman")} className={"h-12 flex-1 rounded-2xl text-[16px] font-extrabold " + (voice === "woman" ? "bg-[#1F7A4D] text-white" : "bg-[#F4F1EA] text-[#17131F]")}>Woman</button>
                  <button type="button" onClick={() => choose("man")} className={"h-12 flex-1 rounded-2xl text-[16px] font-extrabold " + (voice === "man" ? "bg-[#1F7A4D] text-white" : "bg-[#F4F1EA] text-[#17131F]")}>Man</button>
                </div>
                <button type="button" onClick={accept} className="mt-2 h-12 w-full rounded-2xl bg-[#17131F] text-[16px] font-extrabold text-white">Walk with me</button>
              </>
            ) : (
              <>
                <p className="text-[20px] font-extrabold text-[#17131F]">{ownerName ? `I know you, ${ownerName}.` : "I am with you."}</p>
                <p className="mt-1 text-[15px] leading-snug text-[#17131F]">Write here. To talk, tap the mic on your keyboard. I do not record you.</p>
                {!ownerName && (
                  <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const field = (e.currentTarget.elements.namedItem("owner") as HTMLInputElement).value; saveOwnerName(field); setOwnerName(readOwner().name); say(supportLine("heart")); }}>
                    <input name="owner" placeholder="What do I call you?" className="h-12 min-w-0 flex-1 rounded-2xl border border-[#DCE5DE] px-3 text-[16px]" maxLength={24} />
                    <button type="submit" className="h-12 rounded-2xl bg-[#17131F] px-4 text-[16px] font-extrabold text-white">Save</button>
                  </form>
                )}
                <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); tell(); }}>
                  <input autoFocus value={told} onChange={(e) => setTold(e.target.value)} placeholder="Tell me" enterKeyHint="send" className="h-12 min-w-0 flex-1 rounded-2xl border border-[#DCE5DE] px-3 text-[16px]" />
                  <button type="submit" className="h-12 rounded-2xl bg-[#17131F] px-4 text-[16px] font-extrabold text-white">Go</button>
                </form>
                <button type="button" onClick={leave} className="mt-3 h-11 w-full text-[14px] font-bold text-[#6A6275]">You can go</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
