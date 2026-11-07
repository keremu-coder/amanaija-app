"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// Owner sets the business phone and opening hours shown on the shop card.
export default function ShopContactBox({ place }: { place: any }) {
  const [phone, setPhone] = useState<string>(place?.phone || "");
  const [open, setOpen] = useState<string>(place?.open_time || "08:00");
  const [close, setClose] = useState<string>(place?.close_time || "18:00");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const save = async () => {
    setMsg(null);
    const digits = phone.replace(/\D/g, "");
    if (digits && !/^(0\d{10}|234\d{10})$/.test(digits)) {
      setMsg({ text: "Enter a Nigerian number like 08012345678.", ok: false });
      return;
    }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setMsg({ text: "Please log in first.", ok: false }); return; }
    const { error } = await supabase
      .from("places")
      .update({ phone: digits || null, open_time: open, close_time: close })
      .eq("id", place.id)
      .eq("claimed_by", user.id);
    setBusy(false);
    if (error) { setMsg({ text: "Could not save. Please try again.", ok: false }); return; }
    place.phone = digits || null; place.open_time = open; place.close_time = close;
    setMsg({ text: "Saved. Customers can now call you and see your hours.", ok: true });
  };

  return (
    <div className="mb-4 rounded-xl border border-[#DCE5DE] bg-white p-3">
      <p className="mb-2 text-sm font-bold text-[#17131F]">Call button and opening hours</p>
      <label className="mb-1 block text-xs font-bold text-gray-600">Business phone</label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        placeholder="08012345678"
        className="mb-2 h-11 w-full rounded-lg border border-[#DCE5DE] px-3 text-[16px]"
      />
      <div className="mb-2 flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-bold text-gray-600">Opens</label>
          <input type="time" value={open} onChange={(e) => setOpen(e.target.value)} className="h-11 w-full rounded-lg border border-[#DCE5DE] px-3 text-[16px]" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-bold text-gray-600">Closes</label>
          <input type="time" value={close} onChange={(e) => setClose(e.target.value)} className="h-11 w-full rounded-lg border border-[#DCE5DE] px-3 text-[16px]" />
        </div>
      </div>
      <button type="button" onClick={save} disabled={busy} className="h-11 w-full rounded-lg bg-[#1F7A4D] text-sm font-bold text-white active:scale-95 disabled:opacity-60">
        {busy ? "Saving..." : "Save"}
      </button>
      {msg && <p className={`mt-2 text-xs font-medium ${msg.ok ? "text-[#165C3A]" : "text-[#B3261E]"}`}>{msg.text}</p>}
    </div>
  );
}
