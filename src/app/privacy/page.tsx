import Link from "next/link";

export default function Privacy() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href="/" className="text-[#2E4A36] font-bold mb-4 inline-block">&larr; Back to Map</Link>
      <h1 className="text-3xl font-bold mb-4 text-[#2E4A36]">Privacy Policy</h1>
      <p className="text-sm text-gray-600 mb-4">Last Updated: October 2026</p>
      <div className="space-y-4 text-gray-800 text-sm">
        <p><strong>1. What we collect:</strong> Your phone number or email to log in; your delivery address and orders when you buy; your approximate location while you use the map; messages you send in chats, requests and bookings; photos and shop details that shop owners upload; and basic technical data such as IP address, used to stop fraud and abuse.</p>
        <p><strong>2. Your location:</strong> While you walk, the map uses your location only while the app is open. Other members see about 1 km, not the exact step, and nothing if Ghost mode is on. A home you save is shown at that place, so neighbours can see who lives there. They cannot open the inside. A hello is possible only while you are still outside and Open to hello is on. A shop or hawker you offer can still be asked. You can refuse location and still use the app.</p>
        <p><strong>3. Delivery addresses:</strong> Your delivery address is encrypted. Only the seller who fulfils your order can read it.</p>
        <p><strong>4. Who we share data with:</strong> We never sell your personal data. We share only what is needed with the seller you order from, our payment provider Paystack, our database and hosting providers (Supabase and Vercel), and our SMS provider (Termii) for one-time codes. Map tiles are loaded from CARTO and OpenStreetMap-based sources, and a rough location (about 1 km) is sent to Open-Meteo to show the weather.</p>
        <p><strong>5. Safety and reports:</strong> You can block or report any person or message. Reports are reviewed, and accounts that break the rules can be limited or removed. Phone numbers are not allowed in first messages to protect people from scams.</p>
        <p><strong>6. How long we keep data:</strong> Requests for items (Ask the Street) expire automatically. Order records are kept as long as needed for payments, disputes and the law. Other data is kept until you delete your account.</p>
        <p><strong>7. Deleting your account:</strong> You can delete your account and personal data at any time at <Link href="/delete-account" className="font-bold text-[#165C3A] underline">amanaija.vercel.app/delete-account</Link> or from the &quot;Delete account&quot; link in the app.</p>
        <p><strong>8. Children:</strong> AmaNaija is not for children under 13, and members must be 18 or older to sell, rent out a home, or make bookings.</p>
        <p><strong>9. Your rights:</strong> Under the Nigeria Data Protection Act you can ask to see, correct or delete your data. Use the delete page above, or contact us through the <Link href="/support" className="font-bold text-[#165C3A] underline">support page</Link>.</p>
      </div>
    </div>
  );
}