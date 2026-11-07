"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// Owner switch for homes: list the home as "For rent" on the map.
// The database only allows this for ID-verified owners (trust_level 2+).
export default function HomeRentToggle({ place }: { place: any }) {
  const [on, setOn] = useState<boolean>(!!place?.for_rent);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const toggle = async () => {
    setBusy(true);
    setMsg("");
    const next = !on;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setMsg("Please log in first."); return; }
    const { error } = await supabase.from("places").update({ for_rent: next }).eq("id", place.id).eq("claimed_by", user.id);
    setBusy(false);
    if (error) {
      setMsg("Renting out a home needs ID verification first. This keeps renters safe from fake listings.");
      return;
    }
    setOn(next);
    place.for_rent = next;
    setMsg(next ? "Your home now shows as For rent on the map." : "Removed from For rent.");
  };

  return (
    <div className="rounded-xl border border-[#DCE5DE] bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#17131F]">List this home for rent</p>
          <p className="text-xs text-gray-600">Only ID-verified owners can do this.</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={on}
          className={`h-8 w-14 shrink-0 rounded-full p-1 transition-colors disabled:opacity-60 ${on ? "bg-[#1F7A4D]" : "bg-gray-300"}`}
        >
          <span className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : ""}`} />
        </button>
      </div>
      {msg && <p className="mt-2 text-xs font-medium text-[#165C3A]">{msg}</p>}
    </div>
  );
}
