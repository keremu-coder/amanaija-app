"use client";
import { useState } from "react";

// Small picture for lists. If a small version does not exist (older listings), it falls back to the full photo.
export default function Thumb({ small, full, alt }: { small: string; full: string; alt: string }) {
  const [src, setSrc] = useState(small);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => { if (src !== full) setSrc(full); }} style={{ width: "100%", height: 130, objectFit: "cover", background: "#EFEDE4" }} />;
}
