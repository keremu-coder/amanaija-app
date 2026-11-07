"use client";

import { useState } from "react";
import { notifyOther } from "@/lib/push";
import { supabase } from "@/lib/supabase";

// Tap a person on the map: say hello with a message request, block or report.
export default function PersonCard({ person, myName, onClose }: { person: { uid?: string; name: string }; myName: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");

  const needLogin = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setMsg({ t: "Please log in first. This keeps everyone safe from fake accounts.", ok: false }); return null; }
    return data.user;
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !person.uid || busy) return;
    if (/\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d/.test(body)) { setMsg({ t: "Do not share phone numbers in a first message.", ok: false }); return; }
    const u = await needLogin(); if (!u) return;
    if (u.id === person.uid) { setMsg({ t: "That is you.", ok: false }); return; }
    setBusy(true);
    const { error } = await supabase.from("dm_requests").insert({ to_id: person.uid, from_name: myName.slice(0, 40) || "Neighbour", body });
    setBusy(false);
    if (error) {
      setMsg({ t: (error as any).code === "23505" ? "You already sent this person a request." : error.message.includes("Too many") ? "Too many requests. Please wait a little." : "Could not send. They may not accept messages.", ok: false });
      return;
    }
    setText(""); notifyOther({ to: person.uid });
    setMsg({ t: "Request sent. They choose whether to reply.", ok: true });
  };

  const block = async () => {
    if (!person.uid) return;
    const u = await needLogin(); if (!u) return;
    const { error } = await supabase.from("user_blocks").insert({ blocked_id: person.uid });
    setMsg(error && (error as any).code !== "23505" ? { t: "Could not block. Try again.", ok: false } : { t: "Blocked. They can no longer message you.", ok: true });
  };

  const report = async () => {
    if (!person.uid) return;
    const u = await needLogin(); if (!u) return;
    const { error } = await supabase.from("user_reports").insert({ target_id: person.uid, context: reason.trim().slice(0, 300) || null });
    setReporting(false); setReason("");
    setMsg(error ? { t: "Could not send the report. Try again.", ok: false } : { t: "Thank you. We will review this person.", ok: true });
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl bg-white p-4 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-lg font-extrabold text-[#17131F]">{person.name}</p>
        <button type="button" onClick={onClose} className="h-11 rounded-full bg-gray-100 px-4 text-sm font-bold active:scale-95">Close</button>
      </div>
      {!person.uid ? (
        <p className="py-4 text-sm text-gray-600">This person has not turned on hellos, so they are not taking messages right now. People who switch on \"open to hello\" can be messaged.</p>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder={`Say hello to ${person.name}`}
            aria-label="First message"
            className="mb-2 w-full rounded-2xl bg-gray-100 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-[#1F7A4D]"
          />
          <button type="button" onClick={send} disabled={busy || !text.trim()} className="mb-2 h-12 w-full rounded-full bg-[#1F7A4D] text-[15px] font-bold text-white active:scale-95 disabled:opacity-50">Send message request</button>
          {reporting ? (
            <div className="space-y-2">
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="What happened? (optional)" className="h-12 w-full rounded-full bg-gray-100 px-4 text-[16px]" />
              <div className="flex gap-2">
                <button type="button" onClick={report} className="h-11 flex-1 rounded-full bg-[#B3261E] text-sm font-bold text-white active:scale-95">Send report</button>
                <button type="button" onClick={() => setReporting(false)} className="h-11 flex-1 rounded-full bg-gray-100 text-sm font-bold active:scale-95">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={block} className="h-11 flex-1 rounded-full border border-gray-300 text-sm font-bold text-gray-700 active:scale-95">Block</button>
              <button type="button" onClick={() => setReporting(true)} className="h-11 flex-1 rounded-full border border-[#B3261E] text-sm font-bold text-[#B3261E] active:scale-95">Report</button>
            </div>
          )}
        </>
      )}
      {msg && <p className={`mt-2 text-xs font-medium ${msg.ok ? "text-[#165C3A]" : "text-[#B3261E]"}`}>{msg.t}</p>}
      <p className="mt-2 text-[11px] text-gray-500">Never share your address or send money to someone you just met.</p>
    </div>
  );
}
