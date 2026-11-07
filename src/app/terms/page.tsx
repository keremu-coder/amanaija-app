import Link from "next/link";

export default function Terms() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href="/" className="text-[#2E4A36] font-bold mb-4 inline-block">&larr; Back to Map</Link>
      <h1 className="text-3xl font-bold mb-4 text-[#2E4A36]">Terms of Service</h1>
      <p className="text-sm text-gray-600 mb-4">Last Updated: October 2026</p>
      <div className="space-y-4 text-gray-800 text-sm">
        <p><strong>1. Marketplace:</strong> AmaNaija is a platform connecting buyers and local sellers. We do not manufacture or hold inventory.</p>
        <p><strong>1a. Listings by people:</strong> Individuals may list items they own. AmaNaija does not sell, inspect, hold or guarantee these items, and does not hold payment for them. Buyer and seller meet in a public place, the buyer inspects the item, and any payment happens directly between them at handover. Sellers must photograph their own item in the app, must not list banned or stolen items, and must not share contact details or ask for payment in advance. Listings that break these rules, or that are reported by several established users, may be removed and the account restricted. Sellers appear under a nickname, but your identity may be shared with the authorities where the law requires it.</p>
        <p><strong>2. Payments:</strong> All payments are processed securely via Paystack. AmaNaija does not store your card details.</p>
        <p><strong>3. Refunds:</strong> If a seller is out of stock, you will be notified within 2 hours and receive a 100% refund via Paystack within 5-10 business days.</p>
        <p><strong>4. Prohibited Items:</strong> You may not use AmaNaija to buy or sell illegal, counterfeit, or restricted goods.</p>
        <p><strong>5. Community rules:</strong> Be respectful. No harassment, threats, scams, adult content, or sharing other people&apos;s private information. You can block and report anyone. We may remove content and limit or close accounts that break these rules.</p>
        <p><strong>6. Promoted listings:</strong> Some shops pay to be shown first. These are always labelled &quot;Promoted&quot;.</p>
        <p><strong>7. Activity figures:</strong> Faded figures and cars on the map show typical activity. They are not real people.</p>
      </div>
    </div>
  );
}