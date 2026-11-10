"use client";

import { useEffect, useState } from "react";
import { readPosition } from "@/lib/native";
import { supabase } from "@/lib/supabase";
import { fetchMyLife, readCachedLife, saveMyLife, writeCachedLife, type Life } from "@/lib/life";

export default function LiveHere({
  userId,
  onLife,
  onShowOnMap,
  onShowStreet,
  onEnter,
  known,
}: {
  userId: string | null;
  onLife: (life: Life | null) => void;
  onShowOnMap: (lat: number, lng: number) => void;
  onShowStreet?: () => void;
  onEnter: (life: Life) => void;
  known?: Life | null;
}) {
  const [life, setLife] = useState<Life | null>(null);
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signUp, setSignUp] = useState(false);
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const cached = readCachedLife();
    if (cached && userId && cached.user_id === userId) {
      setLife(cached);
      onLife(cached);
    }
    if (!userId) return;
    let stop = false;
    fetchMyLife(supabase, userId).then((row) => {
      if (stop) return;
      if (row) {
        writeCachedLife(row);
        setLife(row);
        onLife(row);
      }
    });
    return () => { stop = true; };
  }, [userId]);

  useEffect(() => {
    if (known && userId && known.user_id === userId) setLife(known);
  }, [known, userId]);

  const show = (row: Life) => {
    setLife(row);
    onLife(row);
    setOpen(false);
    setMsg("");
  };

  const locate = () => readPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 })
    .then((p) => ({ lat: p.coords.latitude, lng: p.coords.longitude }))
    .catch(() => null);

  const save = async (keepNote?: string) => {
    if (!userId) { setAuthOpen(true); return; }
    const place_name = ((keepNote !== undefined ? life?.place_name || "" : place).trim() || "My place").slice(0, 60);
    const text = ((keepNote !== undefined ? keepNote : note).trim() || "I am here").slice(0, 180);
    setBusy(true);
    setMsg("");
    const here = keepNote !== undefined && life?.lat != null && life?.lng != null
      ? { lat: life.lat, lng: life.lng }
      : await locate();
    const { life: saved, error } = await saveMyLife(supabase, {
      user_id: userId,
      place_name: place_name.slice(0, 60),
      note: text.slice(0, 180),
      lat: here?.lat ?? life?.lat ?? null,
      lng: here?.lng ?? life?.lng ?? null,
    });
    setBusy(false);
    if (!saved) { setMsg(error || "Could not save. Try again when the signal is back."); return; }
    show(saved);
    if (saved.lat != null && saved.lng != null) onShowOnMap(saved.lat, saved.lng);
    else setMsg("Saved on this phone. We could not find where you are, so it is not on the map yet.");
  };

  const sign = async () => {
    setBusy(true);
    setMsg("");
    const fn = signUp ? supabase.auth.signUp : supabase.auth.signInWithPassword;
    const { error } = await fn({ email: email.trim(), password });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    if (signUp) setMsg("Account created. If a mail arrived, open it, then come back.");
    setAuthOpen(false);
  };

  return (
    <div className="mb-2 text-left">
      {life && !open ? (
        <button type="button" onClick={() => onEnter(life)} className="h-12 w-full rounded-full bg-[#1F7A4D] text-[17px] font-extrabold text-white active:scale-[0.98]">Enter {life.place_name}</button>
      ) : (
        <>
          {!userId && !authOpen && (
            <button type="button" data-guide="place" onClick={() => setAuthOpen(true)} className="h-12 w-full rounded-full bg-[#1F7A4D] text-[17px] font-extrabold text-white active:scale-[0.98]">I live here</button>
          )}
          {authOpen && (
            <form onSubmit={(e) => { e.preventDefault(); sign(); }} className="space-y-2">
              <input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 w-full rounded-xl border border-[#DCE5DE] bg-white px-3 text-[16px]" />
              <input type="password" required minLength={6} autoComplete={signUp ? "new-password" : "current-password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 w-full rounded-xl border border-[#DCE5DE] bg-white px-3 text-[16px]" />
              <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-[#17131F] text-[15px] font-bold text-white disabled:opacity-60">{signUp ? "Create account" : "Log in"}</button>
              <button type="button" onClick={() => setSignUp(!signUp)} className="h-10 w-full text-[13px] font-bold text-[#165C3A]">{signUp ? "I already have an account" : "Create an account"}</button>
            </form>
          )}
          {userId && !open && (
            <button type="button" data-guide="place" disabled={busy} onClick={() => save()} className="h-12 w-full rounded-full bg-[#1F7A4D] text-[17px] font-extrabold text-white active:scale-[0.98] disabled:opacity-60">{busy ? "Finding you…" : "I live here"}</button>
          )}
          {userId && open && (
            <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-2">
              <input maxLength={60} placeholder="Name of your place" value={place} onChange={(e) => setPlace(e.target.value)} className="h-12 w-full rounded-xl border border-[#DCE5DE] bg-white px-3 text-[16px]" />
              <input maxLength={180} placeholder="What is true here now?" value={note} onChange={(e) => setNote(e.target.value)} className="h-12 w-full rounded-xl border border-[#DCE5DE] bg-white px-3 text-[16px]" />
              <button type="submit" disabled={busy} className="h-12 w-full rounded-full bg-[#1F7A4D] text-[16px] font-extrabold text-white disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
            </form>
          )}
        </>
      )}
      {life && !open && (
        <button type="button" onClick={() => { setPlace(life.place_name); setNote(life.note); setOpen(true); }} className="mt-1 h-10 w-full text-[14px] font-bold text-[#165C3A]">Change the name</button>
      )}
      {msg && <p className="mt-2 text-[13px] font-semibold leading-snug text-[#17131F]">{msg}</p>}
    </div>
  );
}
