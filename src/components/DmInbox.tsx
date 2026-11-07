"use client";

import { notifyOther } from "@/lib/push";
import { playReceive, playSend } from "@/lib/ui-sound";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Req = { id: string; from_id: string; to_id: string; from_name: string; body: string; status: string; created_at: string };
type Msg = { id: string; sender_id: string; body: string; created_at: string };

export default function DmInbox({ onClose }: { onClose: () => void }) {
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [open, setOpen] = useState<Req | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadReqs = async () => {
    const { data } = await supabase.from("dm_requests").select("id,from_id,to_id,from_name,body,status,created_at").neq("status", "declined").order("created_at", { ascending: false }).limit(40);
    setReqs((data as Req[]) || []);
  };
  const loadMsgs = async (id: string) => {
    const { data } = await supabase.from("dm_messages").select("id,sender_id,body,created_at").eq("request_id", id).order("created_at", { ascending: true }).limit(100);
    setMsgs((data as Msg[]) || []);
  };

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { setUid(data.session?.user?.id || null); setReady(true); }); }, []);
  useEffect(() => {
    if (!uid) return;
    loadReqs();
    const t = setInterval(() => { if (document.hidden) return; loadReqs(); if (open) loadMsgs(open.id); }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, open?.id]);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    const m = msgs[msgs.length - 1];
    if (m && seen.current && seen.current !== m.id && m.sender_id !== uid) playReceive();
    if (m) seen.current = m.id; else seen.current = null;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (r: Req, status: "accepted" | "declined") => {
    await supabase.from("dm_requests").update({ status }).eq("id", r.id);
    if (status === "accepted") notifyOther({ request_id: r.id });
    loadReqs();
  };
  const openThread = (r: Req) => { setOpen(r); setMsgs([]); setErr(""); loadMsgs(r.id); };
  const send = async () => {
    const body = text.trim();
    if (!body || !open) return;
    if (/\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d/.test(body)) { setErr("Do not share phone numbers or account numbers."); return; }
    setErr("");
    const { error } = await supabase.from("dm_messages").insert({ request_id: open.id, body });
    if (error) { setErr("Could not send. They may have blocked you."); return; }
    setText(""); playSend(); notifyOther({ request_id: open.id }); loadMsgs(open.id);
  };

  const incoming = reqs.filter((r) => r.to_id === uid && r.status === "pending");
  const threads = reqs.filter((r) => r.status === "accepted");
  const sent = reqs.filter((r) => r.from_id === uid && r.status === "pending");

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex h-[75%] flex-col ama-sheet" style={{ paddingBottom: "env(safe-area-inset-bottom)", transform: "translateZ(0)" }}>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <p className="text-base font-bold text-[#17131F]">{open ? (open.from_id === uid ? "Chat" : open.from_name) : "Messages"}</p>
        <div className="flex gap-2">
          {open && <button type="button" onClick={() => setOpen(null)} className="h-11 rounded-full bg-gray-100 px-4 text-sm font-bold active:scale-95">Back</button>}
          <button type="button" onClick={onClose} className="h-11 rounded-full bg-gray-100 px-4 text-sm font-bold active:scale-95">Close</button>
        </div>
      </div>
      {!ready ? null : !uid ? (
        <p className="px-6 py-10 text-center text-sm text-gray-700">Log in to see your messages.</p>
      ) : open ? (
        <>
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-2">
            <p className="rounded-xl bg-[#F8FAF9] p-2 text-xs text-gray-600">First message: {open.body}</p>
            {msgs.map((m) => {
              const mine = m.sender_id === uid;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] break-words rounded-2xl px-3 py-2 text-[15px] ${mine ? "bg-[#1F7A4D] text-white" : "bg-[#E8EFEA] text-[#17131F]"}`}>{m.body}</div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          {err && <p className="px-4 pb-1 text-xs font-medium text-[#B3261E]">{err}</p>}
          <div className="flex items-center gap-2 border-t border-gray-100 p-3">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} maxLength={300} placeholder="Message" aria-label="Message" className="h-12 min-w-0 flex-1 rounded-full bg-gray-100 px-5 text-[16px] outline-none focus:ring-2 focus:ring-[#1F7A4D]" />
            <button type="button" onClick={send} disabled={!text.trim()} className="h-12 shrink-0 rounded-full bg-[#1F7A4D] px-5 text-[15px] font-bold text-white active:scale-95 disabled:opacity-50">Send</button>
          </div>
        </>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
          {incoming.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-[#17131F]">Message requests</p>
              {incoming.map((r) => (
                <div key={r.id} className="mb-2 rounded-2xl border border-[#DCE5DE] p-3">
                  <p className="text-sm font-bold">{r.from_name}</p>
                  <p className="mb-2 break-words text-[15px] text-gray-800">{r.body}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => answer(r, "accepted")} className="h-11 flex-1 rounded-full bg-[#1F7A4D] text-sm font-bold text-white active:scale-95">Accept</button>
                    <button type="button" onClick={() => answer(r, "declined")} className="h-11 flex-1 rounded-full border border-gray-300 text-sm font-bold text-gray-700 active:scale-95">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div>
            <p className="mb-2 text-sm font-bold text-[#17131F]">Chats</p>
            {threads.length === 0 && <p className="text-sm text-gray-600">No chats yet. Tap someone on the map to say hello.</p>}
            {threads.map((r) => (
              <button key={r.id} type="button" onClick={() => openThread(r)} className="mb-2 flex min-h-[56px] w-full items-center rounded-2xl border border-[#DCE5DE] px-3 text-left active:bg-gray-50">
                <span className="truncate text-[15px] font-bold">{r.from_id === uid ? "Chat" : r.from_name}</span>
              </button>
            ))}
          </div>
          {sent.length > 0 && <p className="text-xs text-gray-500">{sent.length} request(s) waiting for an answer.</p>}
        </div>
      )}
    </div>
  );
}
