"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DeleteAccount() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session ? (data.session.user.email || data.session.user.phone || "your account") : null));
  }, []);

  const remove = async () => {
    if (word.trim().toUpperCase() !== "DELETE" || busy) return;
    setBusy(true); setMsg("");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setBusy(false); setMsg("Please log in again."); return; }
    const res = await fetch("/api/delete-account", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    setBusy(false);
    if (!res.ok) { setMsg("Could not delete the account. Please try again."); return; }
    await supabase.auth.signOut();
    setDone(true);
  };

  return (
    <main className="mx-auto max-w-xl p-6 text-[#17131F]">
      <Link href="/" className="mb-4 inline-block font-bold text-[#165C3A]">&larr; Back to the map</Link>
      <h1 className="mb-3 text-3xl font-extrabold">Delete your AmaNaija account</h1>
      <p className="mb-4 text-sm text-gray-700">
        This permanently deletes your login and the personal data tied to it. It cannot be undone. Orders may be kept in anonymous form where the law or a dispute with a seller requires it.
      </p>
      {done ? (
        <p className="rounded-2xl bg-white p-4 font-bold text-[#165C3A] shadow">Your account has been deleted.</p>
      ) : email === undefined ? null : email === null ? (
        <p className="rounded-2xl bg-white p-4 text-sm shadow">Log in on the <Link href="/" className="font-bold text-[#165C3A] underline">home page</Link> first, then come back to this page. If you cannot log in, contact us using the details in the <Link href="/privacy" className="font-bold text-[#165C3A] underline">privacy policy</Link>.</p>
      ) : (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow">
          <p className="text-sm">Signed in as <strong>{email}</strong>. Type <strong>DELETE</strong> to confirm.</p>
          <input value={word} onChange={(e) => setWord(e.target.value)} aria-label="Type DELETE to confirm" className="h-12 w-full rounded-full bg-gray-100 px-5 text-[16px] outline-none focus:ring-2 focus:ring-red-500" />
          <button type="button" onClick={remove} disabled={busy || word.trim().toUpperCase() !== "DELETE"} className="h-12 w-full rounded-full bg-red-600 font-bold text-white active:scale-95 disabled:opacity-40">Delete my account</button>
          {msg && <p role="alert" className="text-sm font-bold text-red-600">{msg}</p>}
        </div>
      )}
    </main>
  );
}
