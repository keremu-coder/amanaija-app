import type { ReactElement } from "react";

const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconPin = (): ReactElement => <svg {...base}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
export const IconAsk = (): ReactElement => <svg {...base}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M11 8.5v3M11 14h.01" /></svg>;
export const IconMarket = (): ReactElement => <svg {...base}><path d="M4 9h16l-1 11H5L4 9z" /><path d="M8 9V7a4 4 0 0 1 8 0v2" /></svg>;
export const IconTrack = (): ReactElement => <svg {...base}><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>;
export const IconShop = (): ReactElement => <svg {...base}><path d="M3 10l1.5-5h15L21 10M4 10v10h16V10M9 20v-6h6v6" /></svg>;
export const IconHome = (): ReactElement => <svg {...base}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /></svg>;
