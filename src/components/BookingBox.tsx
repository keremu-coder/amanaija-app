"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// Customer side: ask for an appointment at a shop (barber, tailor and so on).
export default function BookingBox({ place, myName }: { place: any; myName: string }) {
  const [when, setWhen] = useState("");
  const [service, setService] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const min = new Date(Date.now() + 15 * 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const book = async () => {
    setMsg(null);
    if (!when) { setMsg({ t: "Pick a day and time.", ok: false }); return; }
    const slot = new Date(when);
    if (isNaN(slot.getTime()) || slot.getTime() < Date.now()) { setMsg({ t: "Pick a time in the future.", ok: false }); return; }
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setMsg({ t: "Please log in to book. This protects shops from fake bookings.", ok: false }); return; }
    setBusy(true);
    const { error } = await supabase.from("bookings").insert({
      shop_id: place.id, customer_name: (myName || "Customer").slice(0, 40), service: service.trim().slice(0, 80) || null, slot: slot.toISOString(),
    });
    setBusy(false);
    if (error) { setMsg({ t: "Could not send your booking. Please try again.", ok: false }); return; }
    setWhen(""); setService("");
    setMsg({ t: "Request sent. The shop will confirm. You can also call them.", ok: true });
  };

  return (
    <div className="rounded-xl border border-[#DCE5DE] bg-white p-3">
      <p className="mb-2 text-sm font-bold text-[#17131F]">Book an appointment</p>
      <input value={service} onChange={(e) => setService(e.target.value)} maxLength={80} placeholder="What do you need? (e.g. haircut)" className="mb-2 h-11 w-full rounded-lg border border-[#DCE5DE] px-3 text-[16px]" />
      <input type="datetime-local" value={when} min={min} onChange={(e) => setWhen(e.target.value)} className="mb-2 h-11 w-full rounded-lg border border-[#DCE5DE] px-3 text-[16px]" />
      <button type="button" onClick={book} disabled={busy} className="h-12 w-full rounded-lg bg-[#1F7A4D] text-sm font-bold text-white active:scale-95 disabled:opacity-60">{busy ? "Sending..." : "Request this time"}</button>
      {msg && <p className={`mt-2 text-xs font-medium ${msg.ok ? "text-[#165C3A]" : "text-[#B3261E]"}`}>{msg.t}</p>}
    </div>
  );
}
