// Pages built around problems people actually type into Google ("barber near me", "phone charger in Aba").
export type Trade = { slug: string; label: string; problem: string; words: string[]; ask: string };
export type Area = { slug: string; name: string; lat: number; lng: number; box: number };

export const TRADES: Trade[] = [
  { slug: "barber", label: "Barbers", problem: "Need a haircut today and not sure which barber is open?", words: ["barber", "salon", "hair"], ask: "barber" },
  { slug: "provision-store", label: "Provision stores", problem: "Run out of something at home and need a provision store close by?", words: ["provision", "store", "supermarket"], ask: "provision store" },
  { slug: "phone-charger", label: "Phone and laptop chargers", problem: "Charger blown? See which shops nearby sell chargers and cables.", words: ["charger", "phone", "gadget", "electronic", "accessor"], ask: "phone or laptop charger" },
  { slug: "electronics", label: "Electronics shops", problem: "Looking for a fan, a TV or a cable? Ask the shops around you.", words: ["electronic", "electric", "gadget", "appliance"], ask: "electronics item" },
  { slug: "mechanic", label: "Mechanics", problem: "Car or bike trouble? Find a mechanic near you.", words: ["mechanic", "auto", "garage", "vulcan"], ask: "mechanic" },
  { slug: "pharmacy", label: "Pharmacies", problem: "Need medicine and want to know which pharmacy is open?", words: ["pharmacy", "chemist", "drug"], ask: "medicine" },
  { slug: "restaurant", label: "Food and restaurants", problem: "Hungry and want real food spots near you?", words: ["food", "restaurant", "buka", "kitchen", "chop"], ask: "food" },
  { slug: "tailor", label: "Tailors and fashion", problem: "Need a good tailor or fashion designer close by?", words: ["tailor", "fashion", "cloth", "wear", "boutique"], ask: "tailor" },
  { slug: "house-for-rent", label: "Houses for rent", problem: "Looking for a house or room to rent near you?", words: ["rent", "residential", "apartment"], ask: "house for rent" },
];

export const AREAS: Area[] = [
  { slug: "aba", name: "Aba", lat: 5.1066, lng: 7.3667, box: 0.1 },
  { slug: "port-harcourt", name: "Port Harcourt", lat: 4.8156, lng: 7.0498, box: 0.14 },
  { slug: "lagos", name: "Lagos", lat: 6.5244, lng: 3.3792, box: 0.25 },
  { slug: "abuja", name: "Abuja", lat: 9.0765, lng: 7.3986, box: 0.2 },
];
