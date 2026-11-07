"use client";
import { supabase } from "@/lib/supabase";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
async function token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token || null; }
function key(b64: string) { const p = "=".repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); }

export async function enablePush(): Promise<string> {
  if (!pushSupported()) return "On iPhone, first add AmaNaija to your Home Screen, then open it from there to turn on alerts.";
  const t = await token(); if (!t) return "Please log in first.";
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC; if (!pub) return "Alerts are not ready yet.";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "Alerts are blocked. You can allow them in your phone settings.";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(pub) });
  const r = await fetch("/api/push/subscribe", { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  if (r.ok) { try { localStorage.setItem("amanaija:push", "1"); } catch {} return "Alerts are on."; }
  return "Could not turn on alerts. Try again.";
}

export function pushWasEnabled(): boolean { try { return localStorage.getItem("amanaija:push") === "1"; } catch { return false; } }

// Fire and forget: tells the server to alert the other person.
export async function notifyOther(body: { request_id?: string; slug?: string; to?: string; hid?: string }) {
  try { const t = await token(); if (!t) return; await fetch("/api/push/notify", { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); } catch {}
}
