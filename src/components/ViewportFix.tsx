"use client";
import { useEffect } from "react";

// Keeps the screen exactly the size of what is visible on iPhone, including when the keyboard is open,
// and scrolls the field you are typing in into view.
export default function ViewportFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let raf = 0;
    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!vv) return;
        root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
        const kb = window.innerHeight - vv.height > 120;
        root.dataset.kb = kb ? "1" : "0";
        if (kb && window.scrollY !== 0 && document.querySelector("main.h-dvh")) window.scrollTo(0, 0);
      });
    };
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) setTimeout(() => t.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
    };
    apply();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    document.addEventListener("focusin", onFocus);
    return () => { vv?.removeEventListener("resize", apply); vv?.removeEventListener("scroll", apply); document.removeEventListener("focusin", onFocus); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
