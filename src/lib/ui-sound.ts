"use client";
// Small real-feeling sounds made in the browser (no files to download): tile tap for typing, click, send ping, receive.
const KEY = "amanaija:ui-sound";
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let last = 0;

export function soundOn(): boolean { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } }
export function setSoundOn(v: boolean) { try { localStorage.setItem(KEY, v ? "on" : "off"); } catch {} }

let keep: HTMLAudioElement | null = null;
// iPhone mutes web sounds when the side switch is on silent unless an audio element is playing. A silent one fixes that.
function wake() {
  if (keep || typeof document === "undefined") return;
  try {
    keep = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
    keep.loop = true; keep.volume = 0.01; keep.play().catch(() => { keep = null; });
  } catch { keep = null; }
}
function run(fn: (a: AudioContext) => void) {
  const a = c(); if (!a) return;
  wake();
  if (a.state === "running") fn(a); else a.resume().then(() => fn(a)).catch(() => {});
}
function c(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) { try { const C = (window as any).AudioContext || (window as any).webkitAudioContext; if (C) ctx = new C(); } catch { return null; } }
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
function burst(a: AudioContext, t: number, freq: number, q: number, dur: number, gain: number, type: BiquadFilterType = "bandpass") {
  if (!noise) { noise = a.createBuffer(1, Math.floor(a.sampleRate * 0.1), a.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = a.createBufferSource(); s.buffer = noise;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(a.destination); s.start(t); s.stop(t + dur + 0.01);
}
function tone(a: AudioContext, t: number, f0: number, f1: number, dur: number, gain: number) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function ok(minGap = 0): boolean {
  if (!soundOn()) return false;
  const now = Date.now(); if (now - last < minGap) return false; last = now;
  return true;
}
// Wooden Scrabble tile set down on a board: a dry knock with a short low thump. Pitch varies a little each time.
export function playType() {
  if (!ok(25)) return; run((a) => { const t = a.currentTime; const v = 0.9 + Math.random() * 0.25;
  burst(a, t, 1800 * v, 1.2, 0.035, 0.5); burst(a, t, 700 * v, 2, 0.05, 0.35); tone(a, t, 190 * v, 110, 0.06, 0.28); });
}
export function playClick() { if (!ok(40)) return; run((a) => { const t = a.currentTime; burst(a, t, 3500, 1, 0.012, 0.35, "highpass"); tone(a, t, 1400, 900, 0.02, 0.06); }); }
export function playSend() { if (!ok()) return; run((a) => { const t = a.currentTime; tone(a, t, 880, 1320, 0.16, 0.22); tone(a, t + 0.06, 1760, 1760, 0.22, 0.1); }); }
export function playReceive() { if (!ok()) return; run((a) => { const t = a.currentTime; tone(a, t, 1175, 1175, 0.14, 0.2); tone(a, t + 0.11, 880, 880, 0.24, 0.2); }); }
