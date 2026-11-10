"use client";

import { useState } from "react";
import { shareOrWhatsApp } from "@/lib/native";

export default function ShareButtons({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);

  const href = () => (typeof window !== "undefined" ? window.location.href : "");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => shareOrWhatsApp({ title: name, text: `${name} on AmaNaija`, url: href() })}
        className="flex-1 rounded-full bg-[#1F7A4D] px-4 py-3 text-[14px] font-bold text-white active:scale-95"
      >
        Share on WhatsApp
      </button>
      <button
        onClick={copy}
        className="rounded-full border-2 border-[#17131F] bg-white px-4 py-3 text-[14px] font-bold text-[#17131F] active:scale-95"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}