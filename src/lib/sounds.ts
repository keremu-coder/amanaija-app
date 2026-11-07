"use client";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  try {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  } catch { return null; }
}

export function unlockAudio(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {}
}

if (typeof window !== "undefined") {
  const handler = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", handler, true);
    window.removeEventListener("touchstart", handler, true);
  };
  window.addEventListener("pointerdown", handler, true);
  window.addEventListener("touchstart", handler, true);
}

type Tone = { freq: number; freqEnd?: number; start: number; duration: number; gain: number; type?: OscillatorType; };

function playTones(tones: Tone[]): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  for (const t of tones) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.setValueAtTime(t.freq, now + t.start);
    if (t.freqEnd !== undefined && t.freqEnd > 0) {
      try { osc.frequency.exponentialRampToValueAtTime(t.freqEnd, now + t.start + t.duration); } catch {}
    }
    g.gain.setValueAtTime(0, now + t.start);
    g.gain.linearRampToValueAtTime(t.gain, now + t.start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now + t.start);
    osc.stop(now + t.start + t.duration + 0.02);
  }
}

export type SoundProfileId = "classic" | "chime" | "soft" | "bloop" | "knock" | "silence";
export type SoundEvent = "send" | "receive";

type ProfileSounds = Record<SoundEvent, Tone[] | null>;

export const SOUND_PROFILES: Record<SoundProfileId, { label: string; sounds: ProfileSounds }> = {
  classic: {
    label: "Classic",
    sounds: {
      send: [{ freq: 880, freqEnd: 1100, start: 0, duration: 0.12, gain: 0.3 }, { freq: 1320, freqEnd: 1760, start: 0.1, duration: 0.15, gain: 0.35 }],
      receive: [{ freq: 1046.5, start: 0, duration: 0.1, gain: 0.3 }, { freq: 1568.0, start: 0.1, duration: 0.15, gain: 0.35 }]
    }
  },
  chime: {
    label: "Chime",
    sounds: {
      send: [{ freq: 900, freqEnd: 2200, start: 0, duration: 0.15, gain: 0.3, type: "triangle" }],
      receive: [{ freq: 1760, start: 0, duration: 0.1, gain: 0.3, type: "triangle" }, { freq: 1318.5, start: 0.1, duration: 0.1, gain: 0.3, type: "triangle" }, { freq: 1760, start: 0.2, duration: 0.15, gain: 0.35, type: "triangle" }]
    }
  },
  soft: {
    label: "Soft",
    sounds: {
      send: [{ freq: 1100, freqEnd: 1800, start: 0, duration: 0.1, gain: 0.3 }],
      receive: [{ freq: 1318.5, start: 0, duration: 0.1, gain: 0.3 }, { freq: 1760, start: 0.08, duration: 0.15, gain: 0.35 }]
    }
  },
  bloop: {
    label: "Bloop",
    sounds: {
      send: [{ freq: 1200, freqEnd: 1800, start: 0, duration: 0.12, gain: 0.35 }],
      receive: [{ freq: 1400, start: 0, duration: 0.15, gain: 0.35 }]
    }
  },
  knock: {
    label: "Knock",
    sounds: {
      send: [{ freq: 1100, start: 0, duration: 0.1, gain: 0.3 }],
      receive: [{ freq: 880, start: 0, duration: 0.1, gain: 0.3 }, { freq: 660, start: 0.1, duration: 0.15, gain: 0.35 }]
    }
  },
  silence: {
    label: "Silence",
    sounds: { send: null, receive: null }
  }
};

export function playProfile(profileId: SoundProfileId, event: SoundEvent): void {
  const profile = SOUND_PROFILES[profileId] || SOUND_PROFILES.silence;
  const tones = profile.sounds[event];
  if (!tones || tones.length === 0) return;
  playTones(tones);
}