"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Owner side: confirm or decline appointment requests.
export default function ShopBookingsInbox({ place }: { place: any }) {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("bookings").select("id,customer_name,service,slot,status")
      .eq("shop_id", place.id).in("status", ["requested", "confirmed"])
      .gt("slot", new Date().toISOString()).order("slot", { ascending: true }).limit(20);
    setRows((data as any[]) || []);
  };
  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id]);

  const set = async (id: string, status: "confirmed" | "declined") => {
    await supabase.from("bookings").update({ status }).eq("id", id);
    load();
  };
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mb-4 rounded-xl border border-[#DCE5DE] bg-white p-3">
      <p className="mb-2 text-sm font-bold text-[#17131F]">Appointments</p>
      {rows.length === 0 && <p className="text-xs text-gray-600">No upcoming appointments.</p>}
      {rows.map((b) => (
        <div key={b.id} className="mb-2 rounded-lg bg-[#F8FAF9] p-2">
          <p className="text-[15px] font-bold text-[#17131F]">{b.customer_name} · {fmt(b.slot)}</p>
          {b.service && <p className="text-xs text-gray-700">{b.service}</p>}
          {b.status === "confirmed" ? (
            <p className="mt-1 text-xs font-bold text-[#165C3A]">Confirmed</p>
          ) : (
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => set(b.id, "confirmed")} className="h-11 flex-1 rounded-lg bg-[#1F7A4D] text-sm font-bold text-white active:scale-95">Confirm</button>
              <button type="button" onClick={() => set(b.id, "declined")} className="h-11 flex-1 rounded-lg border border-gray-300 bg-white text-sm font-bold text-gray-700 active:scale-95">Decline</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
