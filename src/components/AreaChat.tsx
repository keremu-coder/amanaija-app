"use client";

import { playReceive, playSend } from "@/lib/ui-sound";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Msg = { id: string; user_id: string; name: string; body: string; created_at: string };

// Chat for everyone near you. Area = roughly a 1 km square around you.
export default function AreaChat({ lat, lng, name, onClose }: { lat: number; lng: number; name: string; onClose: () => void }) {
  const area = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("area_messages")
      .select("id,user_id,name,body,created_at")
      .eq("area", area)
      .order("created_at", { ascending: false })
      .limit(40);
    if (data) setMsgs([...(data as Msg[])].reverse());
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUid(data.session?.user?.id || null); setReady(true); });
  }, []);

  useEffect(() => {
    if (!uid) return;
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, area]);

  const seen = useRef<string | null>(null);
  useEffect(() => {
    const m = msgs[msgs.length - 1];
    if (m && seen.current && seen.current !== m.id && m.user_id !== uid) playReceive();
    if (m) seen.current = m.id;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    if (/\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d/.test(body)) {
      setErr("For your safety, do not share phone numbers or account numbers here.");
      return;
    }
    setSending(true);
    setErr("");
    const { error } = await supabase.from("area_messages").insert({ area, name: name.slice(0, 40) || "Neighbour", body });
    setSending(false);
    if (error) {
      setErr(error.message.includes("Slow down") ? "Slow down a little." : "Could not send. Please try again.");
      return;
    }
    setText(""); playSend();
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("area_messages").delete().eq("id", id);
    load();
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex h-[75%] flex-col ama-sheet" style={{ paddingBottom: "env(safe-area-inset-bottom)", transform: "translateZ(0)" }}>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div>
          <p className="text-base font-bold text-[#17131F]">Chat near you</p>
          <p className="text-xs text-gray-600">People within about 1 km. Be kind. Never share phone numbers or addresses.</p>
        </div>
        <button type="button" onClick={onClose} className="h-11 shrink-0 rounded-full bg-gray-100 px-4 text-sm font-bold text-[#17131F] active:scale-95">Close</button>
      </div>

      {!ready ? null : !uid ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-700">
          Log in to chat with people near you. This keeps the community safe from fake accounts.
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-2">
            {msgs.length === 0 && <p className="py-6 text-center text-sm text-gray-600">No messages here yet. Say hello to your area.</p>}
            {msgs.map((m) => {
              const mine = m.user_id === uid;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? "bg-[#1F7A4D] text-white" : "bg-[#E8EFEA] text-[#17131F]"}`}>
                    {!mine && <p className="text-[11px] font-bold opacity-70">{m.name}</p>}
                    <p className="break-words text-[15px]">{m.body}</p>
                    {mine && <button type="button" onClick={() => remove(m.id)} className="mt-1 text-[11px] underline opacity-80">Delete</button>}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          {err && <p className="px-4 pb-1 text-xs font-medium text-[#B3261E]">{err}</p>}
          <div className="flex items-center gap-2 border-t border-gray-100 p-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              maxLength={300}
              placeholder="Message your area"
              aria-label="Message"
              className="h-12 min-w-0 flex-1 rounded-full bg-gray-100 px-5 text-[16px] text-[#17131F] outline-none focus:ring-2 focus:ring-[#1F7A4D]"
            />
            <button type="button" onClick={send} disabled={sending || !text.trim()} className="h-12 shrink-0 rounded-full bg-[#1F7A4D] px-5 text-[15px] font-bold text-white active:scale-95 disabled:opacity-50">Send</button>
          </div>
        </>
      )}
    </div>
  );
}
