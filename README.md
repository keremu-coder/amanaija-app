# AmaNaija

A live, map-based community and marketplace for Nigerian streets. People find nearby shops, services and homes on a real map, ask the street for something they need, message sellers with consent, and list items for sale under an anonymous nickname.

Live: https://amanaija.vercel.app

## What it does
- **Live map** of shops, services and homes, with privacy-first presence (area-level only, ghost mode, opt-in "open to hello").
- **Ask the street:** "I need X" reaches nearby shops, who reply that they have it.
- **Shop pages** with a permanent link, orders, bookings and a seller poster with QR.
- **Market:** anonymous sellers, shareable listing links with rich previews, live-camera photos with a proof code, duplicate-photo detection, and report-based takedowns.
- **Hawkers:** people who sell on foot can opt in to be found nearby for a few hours, at a rounded location only, and be called over.
- **Consent-based messaging** with block and report, plus push alerts.
- **Installable PWA**, with an Android wrapper and an iOS shell in `mobile/`.

## Stack
Next.js 16 (App Router, cache components), React 19, Tailwind CSS 4, Supabase (Postgres, Row Level Security, Realtime, Storage), MapLibre GL, Paystack, Termii, deployed on Vercel.

## Run it
```bash
npm install
cp .env.example .env.local   # add your Supabase and service keys
npm run dev
```
Database setup lives in `supabase/`: run the SQL files in the Supabase SQL editor (the files are safe to run more than once).

## Notes
- All privacy rules are enforced in the database with Row Level Security, not only in the UI.
- Photos are re-encoded server-side, which removes location data from the files.
