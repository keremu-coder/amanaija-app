"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { unlockAudio, playProfile, SOUND_PROFILES, SoundProfileId } from "@/lib/sounds";
import { loadPrefs, savePrefs } from "@/lib/sound-prefs";
import { hapticTap } from "@/lib/native";
import { ChatComposer } from "./ChatComposer";

const FONTS = [
  { name: "Standard", class: "font-sans" },
  { name: "Serif", class: "font-serif" },
  { name: "Monospace", class: "font-mono" },
  { name: "Cursive", class: "font-[cursive]" },
];

const QUICK_REACTIONS = ["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F525}"];

const SWIPE_THRESHOLD_PX = 50;
const SWIPE_MAX_PX = 80;
const SWIPE_DAMPING = 0.7;

const SHIRTS = ["#C8506B", "#B77A18", "#165C3A", "#5A2A6C", "#2B6CB0", "#B3261E", "#1F7A4D"];
const SKINS = ["#8D5524", "#C68642", "#5C3A21", "#E0AC69"];

function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
const shirtFor = (name: string) => SHIRTS[hashOf(name) % SHIRTS.length];
const skinFor = (name: string) => SKINS[hashOf(name + "x") % SKINS.length];

type Person = { key: string; name: string };

function Stall({ x, awning, label, goods }: { x: number; awning: string; label: string; goods: string[] }) {
  return (
    <g transform={`translate(${x},0)`}>
      <rect x="6" y="104" width="4" height="66" fill="#6a4a2a" />
      <rect x="90" y="104" width="4" height="66" fill="#6a4a2a" />
      <rect x="10" y="150" width="80" height="20" fill="#8a5a30" />
      <circle cx="26" cy="146" r="5" fill={goods[0]} />
      <circle cx="38" cy="147" r="4" fill={goods[1]} />
      <circle cx="62" cy="146" r="5" fill={goods[2]} />
      <circle cx="75" cy="147" r="4" fill={goods[0]} />
      <circle cx="50" cy="126" r="7" fill="#8D5524" />
      <rect x="42" y="133" width="16" height="17" rx="6" fill={awning} />
      <path d="M0 92 H100 L106 110 H-6 Z" fill={awning} />
      <g fill="#FFFFFF" opacity="0.55">
        <rect x="8" y="92" width="10" height="18" />
        <rect x="28" y="92" width="10" height="18" />
        <rect x="48" y="92" width="10" height="18" />
        <rect x="68" y="92" width="10" height="18" />
        <rect x="88" y="92" width="10" height="18" />
      </g>
      <rect x="12" y="68" width="76" height="18" rx="6" fill="#17131F" />
      <text x="50" y="81" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">{label}</text>
    </g>
  );
}

function Avatar({ name, isMe, bubble }: { name: string; isMe: boolean; bubble?: string }) {
  return (
    <div className="flex flex-col items-center" style={{ width: 64 }}>
      {bubble && (
        <div className="mb-1 max-w-[150px] rounded-2xl bg-white px-2.5 py-1.5 text-[12px] leading-snug text-[#17131F] shadow-md border border-[#EADFCF] line-clamp-3 break-words">
          {bubble.length > 70 ? bubble.slice(0, 70) + "…" : bubble}
        </div>
      )}
      <svg width="30" height="46" viewBox="0 0 30 46" aria-hidden="true">
        <ellipse cx="15" cy="44" rx="10" ry="2.5" fill="rgba(0,0,0,0.2)" />
        <rect x="7" y="20" width="16" height="22" rx="7" fill={isMe ? "#1F7A4D" : shirtFor(name)} />
        <circle cx="15" cy="12" r="9" fill={skinFor(name)} />
        <path d="M6 11a9 9 0 0 1 18 0c-4-3-14-3-18 0z" fill="#2a1a10" />
      </svg>
      <span
        className="mt-0.5 max-w-[64px] truncate rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={isMe ? { background: "#1F7A4D", color: "#FFFFFF" } : { background: "rgba(23,19,31,0.75)", color: "#FFFFFF" }}
      >
        {isMe ? "You" : name}
      </span>
    </div>
  );
}

export default function AbaRoom({ onExit }: { onExit: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [userName, setUserName] = useState("Guest");
  const [clientId, setClientId] = useState("");
  const [selectedFont, setSelectedFont] = useState(FONTS[0].class);
  const [soundProfile, setSoundProfile] = useState<SoundProfileId>("silence");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const tokenRef = useRef<string | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [showProfile, setShowProfile] = useState<any>(null);
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [actionMessage, setActionMessage] = useState<any>(null);

  const [people, setPeople] = useState<Person[]>([]);
  const [bubbles, setBubbles] = useState<Record<string, { text: string; ts: number }>>({});

  // Swipe state (single set of refs, shared across all message rows)
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeLocked = useRef<"horizontal" | "vertical" | null>(null);
  const swipeEl = useRef<HTMLDivElement | null>(null);
  const swipeMessageId = useRef<string | null>(null);

  const showBubble = (name: string, text: string) => {
    if (!text) return;
    setBubbles((prev) => ({ ...prev, [name]: { text, ts: Date.now() } }));
  };

  useEffect(() => {
    const t = setInterval(() => {
      setBubbles((prev) => {
        const now = Date.now();
        const next = { ...prev };
        let changed = false;
        for (const k in next) {
          if (now - next[k].ts > 6000) {
            delete next[k];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const prefs = loadPrefs();
    setSoundProfile(prefs.profile);

    let id = localStorage.getItem("amanaija_client_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("amanaija_client_id", id);
    }
    setClientId(id);
  }, []);

  const handleSoundChange = (newProfile: SoundProfileId) => {
    setSoundProfile(newProfile);
    savePrefs({ profile: newProfile });
    unlockAudio();
    playProfile(newProfile, "receive");
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) {
        const front = session.user.email.split("@")[0].replace(/[^\w\s\-\.]/g, "").trim().slice(0, 14) || "Member";
        const tail = session.user.id.replace(/-/g, "").slice(0, 4);
        setUserName(`${front}-${tail}`.slice(0, 20));
        tokenRef.current = session.access_token;
        const { data } = await supabase.from('blocks').select('blocked_name, blocked_user_id').eq('blocker_id', session.user.id);
        const rows = (data || (await supabase.from('blocks').select('blocked_name').eq('blocker_id', session.user.id)).data || []) as { blocked_name: string; blocked_user_id?: string }[];
        if (rows) {
          setBlockedUsers(rows.map((b) => b.blocked_name));
          setBlockedIds(rows.map((b) => b.blocked_user_id).filter((x): x is string => !!x));
        }
      }
    });
  }, []);

  // Who is standing in the street right now (live presence)
  useEffect(() => {
    if (!clientId) return;
    const ch = supabase.channel('aba-market-presence', { config: { presence: { key: clientId } } });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState() as Record<string, any[]>;
      setPeople(Object.entries(state).map(([key, arr]) => ({ key, name: (arr[0] as any)?.name || "Guest" })));
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ name: userName });
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [clientId, userName]);

  const fetchAllData = async () => {
    const { data: msgs } = await supabase.from('messages').select('*').eq('room_id', 'aba-market').order('created_at', { ascending: true }).limit(50);
    if (msgs) {
      const shown = msgs.filter((m) => m.user_id !== null);
      const ids = shown.map((m) => m.id).filter(Boolean);
      const { data: reacts } = ids.length
        ? await supabase.from('message_reactions').select('message_id,user_name,emoji,user_id').in('message_id', ids)
        : { data: [] as { message_id: string }[] };
      const msgsWithReacts = shown.map(m => ({ ...m, message_reactions: reacts ? reacts.filter(r => r.message_id === m.id) : [] }));
      setMessages(msgsWithReacts);
    }
  };

  useEffect(() => {
    fetchAllData();
    const channel = supabase
      .channel('aba-market-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'room_id=eq.aba-market' }, (payload) => {
        const newMsg = payload.new as { id?: string; user_id?: string | null; user_name?: string; body?: string | null };
        if (newMsg.user_id === null) return;
        if (newMsg.user_name && newMsg.user_name !== userName) playProfile(soundProfile, "receive");
        if (newMsg.body) showBubble(newMsg.user_name || "Member", newMsg.body);
        setMessages((prev) => {
          if (prev.find(m => m.id === newMsg.id)) return prev;
          const tempIndex = prev.findIndex(m => m.id.startsWith('temp-') && m.body === newMsg.body && m.user_name === newMsg.user_name);
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = { ...newMsg, message_reactions: [] };
            return updated;
          }
          return [...prev, { ...newMsg, message_reactions: [] }];
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => { fetchAllData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userName, soundProfile]);

  useEffect(() => {
    setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 100);
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!tokenRef.current) { alert("Please log in to speak."); return; }
    hapticTap();
    const msg = newMessage;
    const currentReply = replyTo;
    setNewMessage("");
    setReplyTo(null);
    playProfile(soundProfile, "send");
    showBubble(userName, msg);
    const tempId = `temp-${crypto.randomUUID()}`;
    const tempMsg = { id: tempId, user_name: userName, body: msg, created_at: new Date().toISOString(), parent_id: currentReply?.id, message_reactions: [] };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({
          body: msg,
          parent_id: currentReply?.id || null,
          client_id: clientId,
          user_name: userName,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Failed to send");
        setMessages((prev) => prev.filter(m => m.id !== tempId));
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
      setMessages((prev) => prev.filter(m => m.id !== tempId));
    }
  };

  const handleSendMedia = async (file: File) => {
    if (!tokenRef.current) { alert("Please log in to speak."); return; }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("client_id", clientId);
    fd.append("user_name", userName);
    if (replyTo?.id) fd.append("parent_id", replyTo.id);

    try {
      const res = await fetch("/api/chat/upload", { method: "POST", headers: { Authorization: `Bearer ${tokenRef.current}` }, body: fd });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Upload failed");
      } else {
        setReplyTo(null);
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    }
  };

  // ---- Swipe gesture handlers ----
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>, messageId: string) => {
    const t = e.touches[0];
    swipeStartX.current = t.clientX;
    swipeStartY.current = t.clientY;
    swipeLocked.current = null;
    swipeEl.current = e.currentTarget;
    swipeMessageId.current = messageId;
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (swipeStartX.current === null || swipeStartY.current === null) return;
    const t = e.touches[0];
    const dx = t.clientX - swipeStartX.current;
    const dy = t.clientY - swipeStartY.current;

    if (swipeLocked.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        swipeLocked.current = "vertical";
        swipeStartX.current = null;
        swipeStartY.current = null;
        swipeEl.current = null;
        return;
      }
      swipeLocked.current = "horizontal";
      if (swipeEl.current) swipeEl.current.style.willChange = "transform";
    }

    if (swipeLocked.current === "vertical") return;
    const el = swipeEl.current;
    if (!el) return;
    if (dx <= 0) {
      el.style.transform = "";
      return;
    }
    el.style.transform = `translateX(${Math.min(SWIPE_MAX_PX, dx * SWIPE_DAMPING)}px)`;
  };

  const onTouchEnd = () => {
    const el = swipeEl.current;
    const wasHorizontal = swipeLocked.current === "horizontal";
    const messageId = swipeMessageId.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    swipeLocked.current = null;
    swipeEl.current = null;
    swipeMessageId.current = null;
    if (!el) return;

    let offset = 0;
    const mt = el.style.transform.match(/translateX\(([\d.]+)px\)/);
    if (mt) offset = parseFloat(mt[1]);

    el.style.transition = "transform 200ms cubic-bezier(0.32, 0.72, 0, 1)";
    el.style.transform = "";
    window.setTimeout(() => {
      el.style.transition = "";
      el.style.willChange = "";
    }, 250);

    if (wasHorizontal && offset >= SWIPE_THRESHOLD_PX && messageId) {
      const target = messages.find(m => m.id === messageId);
      if (target) setReplyTo(target);
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    if (!tokenRef.current) return;
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const existing = m.message_reactions?.find((r: any) => r.user_name === userName && r.emoji === emoji);
        if (existing) return m;
        return { ...m, message_reactions: [...(m.message_reactions || []), { user_name: userName, emoji }] };
      }
      return m;
    }));
    await fetch("/api/chat/react", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
      body: JSON.stringify({ message_id: messageId, emoji }),
    });
  };

  const deleteMessage = async (messageId: string) => {
    if (!window.confirm("Delete this message?")) return;
    setMessages(prev => prev.filter(m => m.id !== messageId));
    await supabase.from('messages').delete().eq('id', messageId);
  };

  const blockUser = async (targetName: string, targetId?: string) => {
    setBlockedUsers(prev => [...prev, targetName]);
    if (targetId) setBlockedIds(prev => [...prev, targetId]);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert("Log in to block users permanently."); return; }
    const row: { blocker_id: string; blocked_name: string; blocked_user_id?: string } = { blocker_id: session.user.id, blocked_name: targetName };
    if (targetId) row.blocked_user_id = targetId;
    const { error } = await supabase.from('blocks').insert([row]);
    if (error && targetId) await supabase.from('blocks').insert([{ blocker_id: session.user.id, blocked_name: targetName }]);
  };

  const reportMessage = async (msg: any) => {
    const reason = prompt("Why are you reporting this message?");
    if (!reason) return;
    await supabase.from('reports').insert([{ reporter_name: userName, reported_name: msg.user_name, message_body: msg.body, reason }]);
    alert("Report submitted to Admin.");
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();
  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const visibleMessages = messages.filter((m) => !(m.user_id && blockedIds.includes(m.user_id)));

  // People standing in the street: me first, then others who are not blocked
  const others = people.filter(p => p.key !== clientId && !blockedUsers.includes(p.name));
  const streetList: Person[] = [{ key: clientId || "me", name: userName }, ...others];
  const hereCount = streetList.length;
  const shown = streetList.slice(0, 7).sort((a, b) => a.key.localeCompare(b.key));
  const extra = hereCount - shown.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FFFBF5] overflow-hidden" onPointerDown={unlockAudio} style={{ height: "100dvh" }}>

      <style>{`
        @keyframes room-keke {
          from { transform: translateX(-90px); }
          to   { transform: translateX(470px); }
        }
        .room-keke { animation: room-keke 16s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .room-keke { animation: none; } }
      `}</style>

      {/* ---- Street scene ---- */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{
          height: "36dvh",
          minHeight: 260,
          maxHeight: 340,
          background: "linear-gradient(180deg, #F4B467 0%, #FBD9A4 55%, #FDEBCB 100%)",
        }}
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
          <circle cx="330" cy="70" r="26" fill="#FFF3C9" opacity="0.9" />
          <g fill="#D9A26A" opacity="0.55">
            <rect x="0" y="120" width="30" height="50" />
            <rect x="34" y="132" width="24" height="38" />
            <rect x="330" y="124" width="30" height="46" />
            <rect x="364" y="136" width="36" height="34" />
          </g>
          <g stroke="#4a2f1a" strokeWidth="2" fill="none">
            <line x1="12" y1="40" x2="12" y2="172" />
            <line x1="5" y1="52" x2="19" y2="52" />
            <line x1="388" y1="40" x2="388" y2="172" />
            <line x1="381" y1="52" x2="395" y2="52" />
            <path d="M12 52 Q200 96 388 52" strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
          </g>
          <Stall x={20} awning="#C8506B" label="Provisions" goods={["#F4B73F", "#1F7A4D", "#E2573F"]} />
          <Stall x={150} awning="#1F7A4D" label="Foodstuff" goods={["#E2573F", "#F4B73F", "#7A4A00"]} />
          <Stall x={280} awning="#B77A18" label="Fabrics" goods={["#5A2A6C", "#C8506B", "#2B6CB0"]} />
          <rect x="0" y="168" width="400" height="72" fill="#B97A4C" />
          <rect x="0" y="168" width="400" height="3" fill="#8a5a30" />
          <rect x="0" y="206" width="400" height="34" fill="#9a6538" />
          <g fill="#D9B98A" opacity="0.6">
            <rect x="20" y="222" width="22" height="2" />
            <rect x="80" y="222" width="22" height="2" />
            <rect x="140" y="222" width="22" height="2" />
            <rect x="200" y="222" width="22" height="2" />
            <rect x="260" y="222" width="22" height="2" />
            <rect x="320" y="222" width="22" height="2" />
          </g>
          <g transform="translate(0, 196)">
            <g className="room-keke">
              <rect x="0" y="0" width="46" height="26" rx="12" fill="#F4B942" stroke="#17131F" strokeWidth="1.6" />
              <rect x="5" y="4" width="36" height="14" rx="7" fill="#3a2810" />
              <circle cx="10" cy="28" r="5.5" fill="#17131F" />
              <circle cx="36" cy="28" r="5.5" fill="#17131F" />
            </g>
          </g>
        </svg>

        {/* Floating header */}
        <div className="absolute top-0 left-0 right-0 flex items-center gap-2 px-3 z-20" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
          <button onClick={onExit} aria-label="Back" className="w-11 h-11 rounded-full bg-white/90 shadow flex items-center justify-center text-[#17131F]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2 rounded-full bg-white/90 shadow px-3" style={{ height: 44 }}>
            <span className="w-2.5 h-2.5 rounded-full bg-[#1F7A4D] shrink-0" aria-hidden="true" />
            <span className="font-extrabold text-[16px] text-[#17131F] truncate">Aba Lounge</span>
            <span className="ml-auto text-[13px] font-bold text-[#165C3A] shrink-0">{hereCount} here</span>
          </div>
          <button onClick={() => setShowSafetyMenu(!showSafetyMenu)} aria-label="Menu" className="w-11 h-11 rounded-full bg-white/90 shadow flex items-center justify-center text-[#17131F] font-bold text-xl">&#8942;</button>
        </div>

        {/* Avatars standing in the street */}
        <div className="absolute left-0 right-0 bottom-0 z-10" style={{ height: 150 }}>
          {shown.map((p, i) => {
            const isMe = p.key === (clientId || "me");
            return (
              <div
                key={p.key}
                className="absolute"
                style={{
                  left: `${((i + 1) / (shown.length + 1)) * 100}%`,
                  bottom: 6 + (i % 2) * 14,
                  transform: "translateX(-50%)",
                }}
              >
                <Avatar name={p.name} isMe={isMe} bubble={bubbles[p.name]?.text} />
              </div>
            );
          })}
          {extra > 0 && (
            <span className="absolute right-3 bottom-2 rounded-full bg-[#17131F]/80 text-white text-[11px] font-bold px-2 py-1">+{extra} more</span>
          )}
        </div>
      </div>

      {showSafetyMenu && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowSafetyMenu(false)}>
          <div className="absolute top-16 right-3 bg-white border border-gray-200 shadow-xl rounded-2xl p-4 w-72" onClick={(e) => e.stopPropagation()} style={{ marginTop: "env(safe-area-inset-top)" }}>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Chat settings</h3>

            <label className="block text-xs font-bold text-gray-500 mb-1">Text style</label>
            <select value={selectedFont} onChange={(e) => setSelectedFont(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg px-2 py-2 outline-none mb-3">
              {FONTS.map((f) => <option key={f.name} value={f.class}>{f.name}</option>)}
            </select>

            <label className="block text-xs font-bold text-gray-500 mb-1">Message sound</label>
            <select value={soundProfile} onChange={(e) => handleSoundChange(e.target.value as SoundProfileId)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg px-2 py-2 outline-none mb-3">
              {Object.entries(SOUND_PROFILES).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
            </select>

            <p className="text-xs text-gray-500 mb-3">Tap the small menu next to any message to reply, react, block, or report a user.</p>
            <button onClick={() => setShowSafetyMenu(false)} className="w-full bg-gray-100 text-gray-700 font-bold py-2 rounded-lg text-sm">Close</button>
          </div>
        </div>
      )}

      {/* ---- Message log + composer ---- */}
      <div className="relative z-10 -mt-5 flex-1 min-h-0 flex flex-col bg-[#FFFBF5] overflow-hidden" style={{ borderRadius: "28px 28px 0 0", boxShadow: "0 -8px 24px rgba(0,0,0,0.12)" }}>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 pt-5 space-y-3 pb-6">
          {visibleMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-8 py-8">
              <p className="text-lg font-bold text-gray-900">No messages yet</p>
              <p className="text-sm text-gray-500 mt-1">Say hello to your street.</p>
            </div>
          )}
          {visibleMessages.map((msg) => {
            const isMe = msg.user_name === userName;
            const reactionCounts: Record<string, number> = {};
            msg.message_reactions?.forEach((r: any) => {
              reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
            });

            return (
              <div key={msg.id}>
                {msg.parent_id && (
                  <div className="ml-10 mb-1 bg-gray-200/50 border-l-2 border-gray-400 px-2 py-1 rounded-r-md max-w-[75%]">
                    <p className="text-[10px] text-gray-500 font-bold">Replying to {messages.find(m => m.id === msg.parent_id)?.user_name || "User"}</p>
                    <p className="text-xs text-gray-600 line-clamp-1 italic">&quot;{messages.find(m => m.id === msg.parent_id)?.body || "..."}&quot;</p>
                  </div>
                )}

                <div
                  onTouchStart={(e) => onTouchStart(e, msg.id)}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  style={{ touchAction: "pan-y", position: "relative" }}
                  className="flex justify-start items-start gap-2"
                >
                  {/* Reply icon that appears behind the message while swiping */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[#1F7A4D] opacity-40 pointer-events-none" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 14 4 9 9 4" />
                      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                    </svg>
                  </div>

                  <button
                    onClick={() => setShowProfile(msg.user_name)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0 mt-1"
                    style={{ background: isMe ? "#1F7A4D" : shirtFor(msg.user_name) }}
                  >
                    {getInitial(msg.user_name)}
                  </button>

                  <div className="flex flex-col items-start max-w-[75%]">
                    <div className="flex items-baseline gap-2 mb-1 px-1">
                      <span className="text-[12px] font-bold text-[#17131F]">{isMe ? `${msg.user_name} (You)` : msg.user_name}</span>
                      <span className="text-[10px] text-gray-400 font-medium">{formatTime(msg.created_at)}</span>
                    </div>

                    {msg.media_url && msg.media_type === "photo" && (
                      <img src={msg.media_url} alt="shared" className="mb-1 max-w-[240px] rounded-2xl shadow-sm border border-gray-200" />
                    )}
                    {msg.media_url && msg.media_type === "video" && (
                      <video src={msg.media_url} controls className="mb-1 max-w-[240px] rounded-2xl shadow-sm border border-gray-200" />
                    )}

                    {msg.body && (
                      <div
                        className={`px-3.5 py-2 rounded-2xl shadow-sm text-[15px] leading-snug border rounded-tl-sm ${selectedFont}`}
                        style={isMe ? { background: "#1F7A4D", color: "#FFFFFF", borderColor: "#1F7A4D" } : { background: "#FFFFFF", color: "#17131F", borderColor: "#EADFCF" }}
                      >
                        {msg.body}
                      </div>
                    )}

                    {Object.keys(reactionCounts).length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {Object.entries(reactionCounts).map(([emoji, count]) => (
                          <div key={emoji} className="bg-white border border-gray-200 rounded-full px-1.5 py-0.5 text-[10px] shadow-sm flex items-center gap-0.5">
                            <span>{emoji}</span>
                            <span className="text-gray-600 font-bold">{count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setActionMessage(msg)}
                    aria-label="Message options"
                    className="w-8 h-8 shrink-0 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center self-start mt-1"
                  >
                    &#8942;
                  </button>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        <ChatComposer
          body={newMessage}
          onBodyChange={setNewMessage}
          onSubmit={sendMessage}
          onSendMedia={handleSendMedia}
          selectedFont={selectedFont}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </div>

      {actionMessage && (
        <div
          className="fixed inset-0 z-[200]"
          onClick={() => setActionMessage(null)}
          style={{ background: "rgba(0,0,0,0.4)" }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
            </div>

            <div className="flex justify-center gap-1 px-4 pb-3">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { addReaction(actionMessage.id, emoji); setActionMessage(null); }}
                  className="w-11 h-11 rounded-full hover:bg-gray-100 flex items-center justify-center text-2xl active:scale-90 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="border-t border-gray-100">
              <button
                onClick={() => { setReplyTo(actionMessage); setActionMessage(null); }}
                className="w-full text-left px-5 py-3 hover:bg-gray-50 text-[15px] font-medium text-gray-800 flex items-center gap-3"
              >
                <span className="text-lg">&#8617;</span> Reply
              </button>
              <button
                onClick={() => { setShowProfile(actionMessage.user_name); setActionMessage(null); }}
                className="w-full text-left px-5 py-3 hover:bg-gray-50 text-[15px] font-medium text-gray-800 border-t border-gray-100 flex items-center gap-3"
              >
                <span className="text-lg">&#128100;</span> See Profile
              </button>

              {actionMessage.user_name !== userName ? (
                <>
                  <button
                    onClick={() => { reportMessage(actionMessage); setActionMessage(null); }}
                    className="w-full text-left px-5 py-3 hover:bg-gray-50 text-[15px] font-medium text-red-600 border-t border-gray-100 flex items-center gap-3"
                  >
                    <span className="text-lg">&#128681;</span> Report
                  </button>
                  <button
                    onClick={() => { blockUser(actionMessage.user_name, actionMessage.user_id); setActionMessage(null); }}
                    className="w-full text-left px-5 py-3 hover:bg-gray-50 text-[15px] font-medium text-red-600 border-t border-gray-100 flex items-center gap-3"
                  >
                    <span className="text-lg">&#128683;</span> Block {actionMessage.user_name}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { deleteMessage(actionMessage.id); setActionMessage(null); }}
                  className="w-full text-left px-5 py-3 hover:bg-gray-50 text-[15px] font-medium text-red-600 border-t border-gray-100 flex items-center gap-3"
                >
                  <span className="text-lg">&#128465;</span> Delete
                </button>
              )}

              <button
                onClick={() => setActionMessage(null)}
                className="w-full text-center px-5 py-3 hover:bg-gray-100 text-[15px] font-bold text-gray-700 border-t border-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfile && (
        <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowProfile(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-20 h-20 text-white rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4" style={{ background: shirtFor(showProfile) }}>
              {getInitial(showProfile)}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{showProfile}</h2>
            <p className="text-sm text-gray-500 mb-6">Aba Market Member</p>
            <button onClick={() => setShowProfile(null)} className="w-full bg-[#F8FAF9] border border-gray-200 text-gray-700 font-bold py-2 rounded-xl">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
