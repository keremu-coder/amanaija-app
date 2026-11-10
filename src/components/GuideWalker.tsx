"use client";

import { useEffect, useRef, useState } from "react";
import { answerGuide, guideChoice, hearFix, learnRoad, noteTrip, readVoice, say, stopGuide, taught, writeGuide, writeVoice } from "@/lib/guide";

function post() {
  return { x: Math.max(8, window.innerWidth - 56), y: 120 };
}

const WELCOME = [
  { line: "Welcome. I will show you. You do not need to swipe.", go: "" },
  { line: "This is where you live.", go: "place" },
  { line: "This finds your street.", go: "street" },
  { line: "I will stay here. Tap me if you need me.", go: "" },
];

function spot(name: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll(`[data-guide="${name}"]`));
  for (const node of nodes) {
    const r = node.getBoundingClientRect();
    if (r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < window.innerHeight) return node as HTMLElement;
  }
  return null;
}

export default function GuideWalker() {
  const [choice, setChoice] = useState<"yes" | "no" | "new">("new");
  const [ready, setReady] = useState(false);
  const [voice, setVoice] = useState<"woman" | "man">("woman");
  const [pos, setPos] = useState({ x: 12, y: 128 });
  const [walking, setWalking] = useState(false);
  const [dancing, setDancing] = useState(false);
  const [face, setFace] = useState(1);
  const [mark, setMark] = useState(false);
  const [brain, setBrain] = useState(false);
  const [told, setTold] = useState("");
  const [missed, setMissed] = useState("");
  const [hearing, setHearing] = useState(false);
  const [hers, setHers] = useState("");
  const [tour, setTour] = useState(0);
  const [loc, setLoc] = useState(false);
  const [welcomeOn, setWelcomeOn] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState(0);
  const [welcomeLine, setWelcomeLine] = useState("");
  const posRef = useRef(pos);
  const busy = useRef(false);
  const mic = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const locOnce = useRef(false);
  const wasAway = useRef(false);

  useEffect(() => {
    const sync = () => {
      setChoice(guideChoice());
      setVoice(readVoice());
    };
    sync();
    let elder = false;
    try { elder = localStorage.getItem("amanaija_guide_elder") !== "1"; } catch {}
    setMark(guideChoice() !== "no" && elder);
    setReady(true);
    const start = post();
    posRef.current = start;
    setPos(start);
    window.addEventListener("amanaija-guide", sync);
    return () => window.removeEventListener("amanaija-guide", sync);
  }, []);

  useEffect(() => {
    const on = () => {
      if (locOnce.current) return;
      locOnce.current = true;
      wasAway.current = guideChoice() === "no";
      if (wasAway.current) setChoice("yes");
      const line = "May I use where you are? People see your area, about 1 km, not the exact step. A home you save stays on that place. You can say no.";
      setHers(line);
      setLoc(true);
      setBrain(true);
      say(line);
    };
    window.addEventListener("amanaija-guide-loc", on);
    return () => window.removeEventListener("amanaija-guide-loc", on);
  }, []);

  const answerLoc = (yes: boolean) => {
    setLoc(false);
    setBrain(false);
    if (wasAway.current) { writeGuide(false); setChoice("no"); }
    window.dispatchEvent(new CustomEvent("amanaija-loc-answer", { detail: yes ? "go" : "skip" }));
  };

  const stopWelcome = () => {
    setWelcomeOn(false);
    setBrain(false);
    setMark(false);
    try { localStorage.setItem("amanaija_welcome_v2", "1"); } catch {}
    writeGuide(true);
    setChoice("yes");
    const home = post();
    setFace(home.x >= posRef.current.x ? 1 : -1);
    setWalking(true);
    posRef.current = home;
    setPos(home);
    window.setTimeout(() => setWalking(false), 700);
  };

  const showWelcome = (n: number) => {
    const item = WELCOME[n];
    if (!item) { stopWelcome(); return; }
    setWelcomeStep(n);
    setWelcomeLine(item.line);
    setWelcomeOn(true);
    setBrain(true);
    if (item.go) window.dispatchEvent(new CustomEvent("amanaija-guide-walk", { detail: { action: item.go, point: true } }));
  };

  useEffect(() => {
    if (!ready) return;
    let done = false;
    try { done = localStorage.getItem("amanaija_welcome_v2") === "1"; } catch {}
    if (done || guideChoice() === "no") return;
    const start = window.setTimeout(() => showWelcome(0), 800);
    return () => window.clearTimeout(start);
  }, [ready]);

  useEffect(() => {
    const go = (e: Event) => {
      const raw = (e as CustomEvent<string | { action?: string; point?: boolean }>).detail;
      const action = typeof raw === "string" ? raw : raw?.action;
      const point = typeof raw === "object" && !!raw?.point;
      if (!action || busy.current) return;
      busy.current = true;
      let tries = 0;
      const look = () => {
        const el = spot(action);
        if (!el && tries === 0) window.dispatchEvent(new CustomEvent("amanaija-guide-show", { detail: action }));
        if (!el && tries < 8) {
          tries += 1;
          window.setTimeout(look, 160);
          return;
        }
        if (!el) {
          busy.current = false;
          if (!point) say("I missed that road. It is not on this screen.");
          else setMark(true);
          return;
        }
        const r = el.getBoundingClientRect();
        const next = { x: Math.max(8, Math.min(window.innerWidth - 56, r.left - 8)), y: Math.max(8, r.top - 64) };
        setFace(next.x >= posRef.current.x ? 1 : -1);
        setWalking(true);
        posRef.current = next;
        setPos(next);
        window.setTimeout(() => {
          setWalking(false);
          if (point) {
            setMark(true);
            busy.current = false;
            return;
          }
          el.classList.add("guide-hot");
          window.setTimeout(() => el.classList.remove("guide-hot"), 900);
          noteTrip(action);
          el.click();
          busy.current = false;
          window.setTimeout(() => {
            const home = post();
            setFace(home.x >= posRef.current.x ? 1 : -1);
            setWalking(true);
            posRef.current = home;
            setPos(home);
            window.setTimeout(() => setWalking(false), 700);
          }, 700);
        }, 1000);
      };
      look();
    };
    window.addEventListener("amanaija-guide-walk", go);
    const dance = () => {
      setDancing(true);
      window.setTimeout(() => setDancing(false), 3200);
    };
    window.addEventListener("amanaija-guide-dance", dance);
    return () => {
      window.removeEventListener("amanaija-guide-walk", go);
      window.removeEventListener("amanaija-guide-dance", dance);
    };
  }, []);

  useEffect(() => {
    if (brain) return;
    const rec = mic.current;
    if (!rec) return;
    try { rec.abort(); } catch {}
    mic.current = null;
    setHearing(false);
  }, [brain]);

  const answer = (raw: string) => {
    const text = hearFix(raw).trim();
    if (!text) return;
    if (/^(go|go away|leave|leave me)$/.test(text)) {
      writeGuide(false);
      setChoice("no");
      setBrain(false);
      stopGuide();
      return;
    }
    if (/^(woman|be a woman)$/.test(text)) { setVoice("woman"); writeVoice("woman"); setHers("Woman."); say("I am here."); return; }
    if (/^(man|be a man)$/.test(text)) { setVoice("man"); writeVoice("man"); setHers("Man."); say("I am here."); return; }
    const reply = answerGuide(text);
    if (reply.dance) {
      setBrain(false);
      say(taught("dance", "Dance with me."));
      window.dispatchEvent(new Event("amanaija-guide-dance"));
      return;
    }
    if (reply.say) { setHers(reply.say); say(reply.say); return; }
    if (reply.walk) {
      if (missed) learnRoad(missed, reply.walk);
      setMissed("");
      setBrain(false);
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("amanaija-guide-walk", { detail: reply.walk })), 60);
      return;
    }
    setMissed(text);
  };

  const send = () => {
    const text = told.trim();
    setTold("");
    answer(text);
  };

  const hear = () => {
    if (mic.current) {
      try { mic.current.abort(); } catch {}
      setHearing(false);
      return;
    }
    type Alt = { transcript?: string };
    type Rec = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((event: { results?: ArrayLike<{ isFinal?: boolean } & ArrayLike<Alt>> }) => void) | null;
      onerror: ((event: { error?: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
      abort: () => void;
    };
    const win = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    const box = field.current;
    if (!SR) {
      box?.focus();
      return;
    }
    (document.activeElement as HTMLElement | null)?.blur?.();
    const rec = new SR();
    let heard = "";
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { rec.abort(); } catch {}
      mic.current = null;
      setHearing(false);
      const text = heard.trim();
      if (!text) { setHers("I did not catch that."); say("I did not catch that."); return; }
      setTold("");
      window.setTimeout(() => answer(text), 200);
    };
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const results = event.results;
      if (!results) return;
      let text = "";
      let final = false;
      for (let i = 0; i < results.length; i += 1) {
        text += results[i]?.[0]?.transcript || "";
        if (results[i]?.isFinal) final = true;
      }
      if (text.trim()) {
        heard = text;
        setTold(text);
      }
      if (final && heard.trim()) finish();
    };
    rec.onerror = (event) => {
      const err = event.error || "";
      if (err !== "not-allowed" && err !== "network") return;
      done = true;
      mic.current = null;
      setHearing(false);
      const line = err === "network" ? "The ear needs a little data. Try again." : "Tap Allow for the microphone. Then tap Mic again.";
      setHers(line);
      say(line);
    };
    rec.onend = () => {
      setHearing(false);
      window.setTimeout(finish, 200);
    };
    mic.current = rec;
    setHearing(true);
    setHers("");
    try { rec.start(); } catch {
      mic.current = null;
      setHearing(false);
      box?.focus();
    }
  };

  const cloth = voice === "woman" ? "#C45C26" : "#1F7A4D";
  const bubbleLeft = pos.x > 180;
  const below = pos.y < 180;
  const away = choice === "no";
  const elder = [
    "I will show you three buttons. One at a time.",
    "This is your home.",
    "This shows shops near you.",
    "This is the market.",
    "That is all. Tap me if you need me.",
  ];
  const showStep = (n: number) => {
    setTour(n);
    say(elder[n]);
    const go = n === 1 ? "place" : n === 2 ? "shops" : n === 3 ? "market" : "";
    if (!go) return;
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("amanaija-guide-walk", { detail: { action: go, point: true } })), 400);
  };
  if (!ready) return null;
  return (
    <div className={"guide-walker" + (walking ? " walk" : "") + (dancing ? " dance" : "")} style={{ left: pos.x, top: pos.y, zIndex: welcomeOn || loc ? 80 : undefined }}>
      {brain && !away && (
        <div className={"guide-brain absolute z-10 w-[230px] rounded-2xl bg-white p-3 shadow-lg " + (below ? "top-[68px] " : "bottom-16 ") + (bubbleLeft ? "right-0" : "left-0")} onClick={(e) => e.stopPropagation()}>
          {loc ? (
            <>
              <p className="text-[18px] font-extrabold leading-snug text-[#17131F]">{hers}</p>
              <button type="button" onClick={() => answerLoc(true)} className="mt-2 h-12 w-full rounded-xl bg-[#17131F] text-[18px] font-extrabold text-white">Yes, use it</button>
              <button type="button" onClick={() => answerLoc(false)} className="mt-1 h-10 w-full text-[16px] font-bold text-[#6A6275]">Not now</button>
            </>
          ) : welcomeOn ? (
            <>
              <p className="text-[18px] font-extrabold leading-snug text-[#17131F]">{welcomeLine}</p>
              <button type="button" onClick={() => showWelcome(welcomeStep + 1)} className="mt-2 h-12 w-full rounded-xl bg-[#17131F] text-[18px] font-extrabold text-white">{welcomeStep >= WELCOME.length - 1 ? "Done" : "Next"}</button>
              <button type="button" onClick={stopWelcome} className="mt-1 h-10 w-full text-[16px] font-bold text-[#6A6275]">Stop</button>
            </>
          ) : (choice === "new" || (mark && !away)) ? (
            <>
              <p className="text-[18px] font-extrabold leading-snug text-[#17131F]">{elder[tour]}</p>
              {tour === 0 && (
                <div className="mt-2 flex gap-1">
                  <button type="button" onClick={() => { setVoice("woman"); writeVoice("woman"); }} className={"h-11 flex-1 rounded-xl text-[16px] font-extrabold " + (voice === "woman" ? "bg-[#1F7A4D] text-white" : "bg-[#F4F1EA]")}>Woman</button>
                  <button type="button" onClick={() => { setVoice("man"); writeVoice("man"); }} className={"h-11 flex-1 rounded-xl text-[16px] font-extrabold " + (voice === "man" ? "bg-[#1F7A4D] text-white" : "bg-[#F4F1EA]")}>Man</button>
                </div>
              )}
              <button type="button" onClick={() => { if (tour >= elder.length - 1) { try { localStorage.setItem("amanaija_guide_elder", "1"); } catch {} writeGuide(true); setChoice("yes"); setMark(false); setBrain(false); return; } showStep(tour + 1); }} className="mt-2 h-12 w-full rounded-xl bg-[#17131F] text-[18px] font-extrabold text-white">{tour === 0 ? "Show me" : tour >= elder.length - 1 ? "Done" : "Next"}</button>
              {tour === 0 && <button type="button" onClick={() => { writeGuide(false); setChoice("no"); setBrain(false); }} className="mt-1 h-10 w-full text-[16px] font-bold text-[#6A6275]">I do not need you</button>}
            </>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); send(); }}>
              {hers && <p className="mb-1 text-[14px] font-bold leading-snug text-[#17131F]">{hers}</p>}
              <div className="flex gap-1">
                <input ref={field} value={told} onChange={(e) => setTold(e.target.value)} placeholder="Tell me, or tap Mic" enterKeyHint="send" className="h-11 min-w-0 flex-1 rounded-xl border border-[#DCE5DE] px-3 text-[16px]" />
                <button type="button" onClick={hear} aria-label={hearing ? "Stop" : "Talk"} className="h-11 w-11 shrink-0 rounded-xl bg-[#1F7A4D] text-[12px] font-extrabold text-white">{hearing ? "Stop" : "Mic"}</button>
              </div>
              <div className="mt-1 flex justify-between px-1 text-[12px] font-bold text-[#6A6275]">
                <button type="button" onClick={() => { setVoice("woman"); writeVoice("woman"); say("I am here."); }} className={voice === "woman" ? "text-[#17131F]" : ""}>Woman</button>
                <button type="button" onClick={() => { setVoice("man"); writeVoice("man"); say("I am here."); }} className={voice === "man" ? "text-[#17131F]" : ""}>Man</button>
                <button type="button" onClick={() => { writeGuide(false); setChoice("no"); setBrain(false); stopGuide(); }}>Go</button>
              </div>
            </form>
          )}
        </div>
      )}
      {(walking || (mark && choice === "new" && !brain)) && <span className="guide-bubble">{walking ? taught("thisway", "This way") : "!"}</span>}
      {dancing && !walking && <span className="guide-bubble">{taught("dance", "Dance")}</span>}
      <button type="button" aria-label="Guide" onClick={() => { if (away) { writeGuide(true); setChoice("yes"); setBrain(true); return; } setBrain((v) => !v); }} className="guide-bob block" style={{ transform: `scaleX(${face}) scale(${away ? 0.7 : 1})`, opacity: away ? 0.4 : 1 }}>
        {choice !== "no" && mark && !walking && <span className="absolute -top-4 left-3 text-[22px] font-black leading-none text-[#B3261E]">!</span>}
        <svg width="44" height="64" viewBox="0 0 44 64" fill="none">
          <circle cx="22" cy="10" r="8" fill="#E6C2A0" />
          <path d="M14 20h16l4 16H10l4-16z" fill={cloth} />
          <path className="guide-leg left" d="M16 36 v16" stroke="#17131F" strokeWidth="3" strokeLinecap="round" />
          <path className="guide-leg right" d="M28 36 v16" stroke="#17131F" strokeWidth="3" strokeLinecap="round" />
          <path d="M10 24 H4" stroke={cloth} strokeWidth="3" strokeLinecap="round" />
          <path d="M34 24 H40" stroke={cloth} strokeWidth="3" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
