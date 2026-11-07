import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Nunito_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import ViewportFix from "@/components/ViewportFix";
import SoundFx from "@/components/SoundFx";
import ErrorReporter from "@/components/ErrorReporter";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["800"], variable: "--font-bricolage", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-serif", display: "swap" });
const nunito = Nunito_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: "AmaNaija",
  description: "Your street, your market, your people, anywhere for the world.",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "AmaNaija", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, interactiveWidget: "resizes-content", viewportFit: "cover", themeColor: "#FAF9F5" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://basemaps.cartocdn.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://tiles.basemaps.cartocdn.com" />
        {process.env.NEXT_PUBLIC_SUPABASE_URL && <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="" />}
      </head>
      <body className={`${bricolage.variable} ${nunito.variable} ${serif.variable}`}>
        <ViewportFix />
        <SoundFx />
        <ErrorReporter />
        {children}
      </body>
    </html>
  );
}