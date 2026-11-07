export default function Loading() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "12px 16px" }} aria-busy="true">
      <div style={{ height: 44 }} />
      <div className="ama-skel" style={{ height: 30, width: 120, marginTop: 8 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginTop: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="ama-skel" style={{ height: 200, borderRadius: 16 }} />)}
      </div>
    </main>
  );
}
