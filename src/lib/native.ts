"use client";

type Cap = { isNativePlatform?: () => boolean; getPlatform?: () => string };

function bridge(): Cap | null {
  if (typeof window === "undefined") return null;
  const c = (window as unknown as { Capacitor?: Cap }).Capacitor;
  return c?.isNativePlatform?.() ? c : null;
}

export function isNativeApp(): boolean {
  return !!bridge();
}

export function hapticTap() {
  if (!bridge()) return;
  import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
    .catch(() => {});
}

type Spot = { coords: { latitude: number; longitude: number; accuracy: number } };

export function readPosition(opts?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number }): Promise<Spot> {
  const native = bridge();
  if (native) {
    return import("@capacitor/geolocation").then(({ Geolocation }) =>
      Geolocation.getCurrentPosition({
        enableHighAccuracy: !!opts?.enableHighAccuracy,
        timeout: opts?.timeout ?? 10000,
        maximumAge: opts?.maximumAge ?? 0,
      }).then((p) => ({ coords: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy } }))
    ).catch((e: unknown) => {
      const m = String((e as { message?: string })?.message || "").toLowerCase();
      throw { code: m.includes("denied") || m.includes("author") || m.includes("permission") ? 1 : 2 };
    });
  }
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject({ code: 2 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ coords: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy } }),
      (err) => reject({ code: err.code || 2 }),
      opts
    );
  });
}

export async function shareOrWhatsApp(opts: { title: string; text: string; url: string }) {
  if (bridge()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: "Share" });
    } catch {}
    return;
  }
  const text = opts.text.includes(opts.url) ? opts.text : `${opts.text} ${opts.url}`;
  if (typeof navigator !== "undefined" && navigator.share) {
    try { await navigator.share({ title: opts.title, text: opts.text, url: opts.url }); return; } catch { return; }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}
