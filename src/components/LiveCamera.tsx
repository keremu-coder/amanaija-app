"use client";
import { useEffect, useRef, useState } from "react";
import { readPosition } from "@/lib/native";

type Pos = { lat: number; lng: number } | null;

// Full-screen camera. Shows how many photos you have, lets you finish, and always switches the camera off when done.
export default function LiveCamera({ label, onShot, max = 1, count = 0 }: { label: string; onShot: (blob: Blob, pos: Pos) => void; max?: number; count?: number }) {
  const [on, setOn] = useState(false);
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState(false);
  const [taken, setTaken] = useState(0);
  const vid = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const pos = useRef<Pos>(null);

  function stop() { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setOn(false); setTaken(0); }
  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); }, []);

  async function start() {
    setErr(""); setTaken(0);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      stream.current = s; setOn(true);
      readPosition({ timeout: 6000, maximumAge: 60000 }).then((p) => { pos.current = { lat: p.coords.latitude, lng: p.coords.longitude }; }).catch(() => {});
      setTimeout(() => { if (vid.current) { vid.current.srcObject = s; vid.current.play().catch(() => {}); } }, 50);
    } catch { setErr("Please allow the camera to take your photo."); }
  }
  function snap() {
    const v = vid.current; if (!v || !v.videoWidth) return;
    // Shrink on the phone before sending: the server keeps 1280px anyway, so nothing is lost,
    // and a photo goes from ~2 MB to ~200 KB, which is what makes posting work on weak data.
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas"); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => {
      if (!b) return;
      onShot(b, pos.current);
      setFlash(true); setTimeout(() => setFlash(false), 180);
      if (navigator.vibrate) navigator.vibrate(30);
      const n = taken + 1; setTaken(n);
      if (max === 1 || count + n >= max) setTimeout(stop, 350); // single photo or full: camera closes by itself
    }, "image/jpeg", 0.8);
  }
  const btn = { padding: "12px 16px", borderRadius: 12, border: "none", fontWeight: 700, fontSize: 16, background: "#0a7a3d", color: "#fff" } as const;
  const full = max > 1 && count >= max;
  return (
    <div style={{ marginTop: 6 }}>
      <button type="button" disabled={full} onClick={start} style={{ ...btn, opacity: full ? 0.5 : 1 }}>📷 {full ? "Maximum photos reached" : label}</button>
      {err && <div style={{ color: "#a00", fontSize: 13, marginTop: 4 }}>{err}</div>}
      {on && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", flexDirection: "column" }}>
          <video ref={vid} playsInline muted style={{ flex: 1, minHeight: 0, width: "100%", objectFit: "cover" }} />
          {flash && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0.7 }} />}
          <div style={{ position: "absolute", top: "max(12px, env(safe-area-inset-top))", left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", fontWeight: 700 }}>
            <span style={{ background: "rgba(0,0,0,.55)", padding: "6px 12px", borderRadius: 20 }}>{max > 1 ? `${count + taken} of ${max} photos` : "Proof photo"}</span>
            <button type="button" onClick={stop} style={{ ...btn, background: "rgba(0,0,0,.55)" }}>Close</button>
          </div>
          <div style={{ padding: "16px 16px max(20px, env(safe-area-inset-bottom))", display: "flex", justifyContent: "space-around", alignItems: "center", background: "#000" }}>
            <span style={{ width: 90, color: "#fff", fontSize: 13 }}>{taken > 0 ? `✓ ${taken} taken` : ""}</span>
            <button type="button" onClick={snap} aria-label="Take photo" style={{ width: 72, height: 72, borderRadius: 36, border: "5px solid #fff", background: "#e33", padding: 0 }} />
            <button type="button" onClick={stop} style={{ ...btn, width: 90, background: taken > 0 ? "#0a7a3d" : "#333" }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
