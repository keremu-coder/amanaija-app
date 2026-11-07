"use client";
import { useEffect } from "react";

// Sends crashes to our own log so we can fix them. At most 5 per visit; never includes names, messages or locations.
export default function ErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const send = (message: string, stack?: string) => {
      if (sent >= 5 || !message) return; sent++;
      try { fetch("/api/log-error", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, stack, page: location.pathname }), keepalive: true }).catch(() => {}); } catch {}
    };
    const onErr = (e: ErrorEvent) => { if (!/ResizeObserver|Script error/i.test(e.message || "")) send(e.message, e.error?.stack); };
    const onRej = (e: PromiseRejectionEvent) => { const r: any = e.reason; send(String(r?.message || r || "Unhandled rejection"), r?.stack); };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);
  return null;
}
