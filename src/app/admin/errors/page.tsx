"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Errors() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { supabase.from("app_errors").select("id,created_at,message,page,device,count,stack").order("created_at", { ascending: false }).limit(100).then(({ data }) => setRows(data || [])); }, []);
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "12px 16px 60px", fontFamily: "system-ui, sans-serif" }}>
      <a href="/admin" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", fontWeight: 700, color: "#1F7A4D", textDecoration: "none" }}>← Admin</a>
      <h1 style={{ fontSize: 24 }}>App errors</h1>
      {rows === null && <p>Loading…</p>}
      {rows?.length === 0 && <p style={{ color: "#6B6A68" }}>No errors recorded. (Only admins can see this page.)</p>}
      {rows?.map((r) => (
        <details key={r.id} className="ama-card" style={{ padding: 10, marginTop: 8 }}>
          <summary style={{ fontSize: 14 }}><b>{r.count}×</b> {r.message} <span style={{ color: "#6B6A68" }}>· {r.page} · {r.device}</span></summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#4A4943" }}>{r.stack || "No stack"}</pre>
          <div style={{ fontSize: 11, color: "#6B6A68" }}>Last seen {new Date(r.created_at).toLocaleString()}</div>
        </details>
      ))}
    </main>
  );
}
