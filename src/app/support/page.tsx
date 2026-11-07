import Link from "next/link";

export const metadata = { title: "Support | AmaNaija", description: "Get help with AmaNaija: orders, accounts, safety and reports." };

export default function Support() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <main className="mx-auto max-w-xl space-y-4 p-6 text-[#17131F]">
      <Link href="/" className="inline-block font-bold text-[#165C3A]">&larr; Back to the map</Link>
      <h1 className="text-3xl font-extrabold">AmaNaija support</h1>
      {email ? (
        <p className="text-sm text-gray-700">Email us at <a className="font-bold text-[#165C3A] underline" href={`mailto:${email}`}>{email}</a>. We reply within 2 working days.</p>
      ) : (
        <p className="text-sm text-gray-700">Contact details are being set up.</p>
      )}
      <section className="space-y-2 text-sm text-gray-800">
        <h2 className="text-lg font-extrabold">Common help</h2>
        <p><strong>Track an order:</strong> Open the app, tap Track and enter your 4-digit code.</p>
        <p><strong>Report or block someone:</strong> Tap their avatar on the map, then choose Report or Block.</p>
        <p><strong>Hide from others:</strong> Use the ghost icon on the map. Turn off &quot;open to hello&quot; to stop message requests.</p>
        <p><strong>Delete your account:</strong> <Link href="/delete-account" className="font-bold text-[#165C3A] underline">Delete account</Link>.</p>
        <p><strong>Policies:</strong> <Link href="/privacy" className="font-bold text-[#165C3A] underline">Privacy</Link> and <Link href="/terms" className="font-bold text-[#165C3A] underline">Terms</Link>.</p>
      </section>
    </main>
  );
}
