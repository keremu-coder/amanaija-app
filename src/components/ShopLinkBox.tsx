"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const RESERVED = ["admin", "api", "s", "www", "amanaija", "support", "help", "login", "app", "shop", "shops", "terms", "privacy"];
const FORMAT = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export default function ShopLinkBox({ place }: { place: any }) {
  const [input, setInput] = useState<string>(place?.handle || "");
  const [saved, setSaved] = useState<string>(place?.handle || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = saved ? `${origin}/s/${saved}` : "";

  const save = async () => {
    setMsg(null);
    const h = input.trim().toLowerCase();
    if (!FORMAT.test(h)) {
      setMsg({ text: "Use 3 to 30 letters, numbers or dashes (no spaces).", ok: false });
      return;
    }
    if (RESERVED.includes(h)) {
      setMsg({ text: "That name is reserved. Try another.", ok: false });
      return;
    }
    if (h === saved) {
      setMsg({ text: "That is already your link.", ok: true });
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        setMsg({ text: "Please log in first.", ok: false });
        return;
      }
      const taken = await supabase.from("places").select("id").ilike("handle", h).neq("id", place.id).limit(1);
      if (taken.data && taken.data.length > 0) {
        setMsg({ text: "Sorry, that name is taken. Try another.", ok: false });
        return;
      }
      const { data, error } = await supabase
        .from("places")
        .update({ handle: h })
        .eq("id", place.id)
        .eq("claimed_by", u.user.id)
        .select("id");
      if (error) {
        setMsg({ text: (error as any).code === "23505" ? "Sorry, that name is taken." : "Could not save. Please try again.", ok: false });
        return;
      }
      if (!data || data.length === 0) {
        setMsg({ text: "Could not save. Only the shop owner can set the link.", ok: false });
        return;
      }
      setSaved(h);
      setMsg({ text: "Saved! Your shop now has its own link.", ok: true });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  return (
    <div className="mb-4 rounded-xl border border-[#DCE5DE] bg-white p-3">
      <p className="mb-1 text-xs font-bold text-gray-600">Your shop link</p>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-gray-400">/s/</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          placeholder="mama-ngozi-aba"
          maxLength={30}
          className="min-w-0 flex-1 rounded-lg border border-[#DCE5DE] bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="shrink-0 rounded-lg bg-[#1F7A4D] px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? "..." : "Save"}
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-xs font-bold ${msg.ok ? "text-[#165C3A]" : "text-[#B3261E]"}`}>{msg.text}</p>
      )}
      {saved && (
        <div className="mt-2 flex items-center gap-2">
          <a href={link} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-xs font-bold text-[#165C3A] underline">
            {link}
          </a>
          <button type="button" onClick={copy} className="shrink-0 rounded-full border border-[#17131F] px-3 py-1 text-xs font-bold">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      {saved && (
        <div className="mt-2 flex gap-2">
          <a href={`/s/${saved}/card`} target="_blank" rel="noopener noreferrer" className="flex h-11 flex-1 items-center justify-center rounded-lg bg-[#17131F] text-sm font-bold text-white active:scale-95">Poster with QR</a>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Find ${place?.name || "our shop"} on AmaNaija: ${link}`)}`} target="_blank" rel="noopener noreferrer" className="flex h-11 flex-1 items-center justify-center rounded-lg bg-[#1F7A4D] text-sm font-bold text-white active:scale-95">Share on WhatsApp</a>
        </div>
      )}
    </div>
  );
}