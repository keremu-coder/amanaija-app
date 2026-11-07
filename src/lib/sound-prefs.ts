"use client";

import type { SoundProfileId } from "./sounds";

export type SoundPrefs = { profile: SoundProfileId; };

const STORAGE_KEY = "amanaija:sound-prefs:v1";

export const DEFAULT_PREFS: SoundPrefs = { profile: "silence" };

let cached: SoundPrefs | null = null;
const listeners = new Set<(p: SoundPrefs) => void>();

export function loadPrefs(): SoundPrefs {
  if (cached) return cached;
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) { cached = { ...DEFAULT_PREFS }; return cached; }
    const parsed = JSON.parse(raw) as Partial<SoundPrefs>;
    cached = { ...DEFAULT_PREFS, ...parsed };
    return cached;
  } catch {
    cached = { ...DEFAULT_PREFS };
    return cached;
  }
}

export function savePrefs(next: SoundPrefs): void {
  cached = next;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }
  for (const cb of listeners) cb(next);
}