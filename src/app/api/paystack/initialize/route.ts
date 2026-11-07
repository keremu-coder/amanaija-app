import { NextResponse } from 'next/server';
import { tooMany } from "@/lib/ratelimit";
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  const __limited = await tooMany(req, "pay-init", 15, 60);
  if (__limited) return __limited;
  try {
    const body: any = await req.json().catch(() => ({}));
    const email = body?.email;
    const orderId = body?.orderId;

    if (typeof email !== 'string' || !email || !orderId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // The amount always comes from the order in the database, never from the browser.
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, total_amount_kobo')
      .eq('id', orderId)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const amount = Number(order.total_amount_kobo);
    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid order amount' }, { status: 400 });
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount,
        reference: String(order.id),
        callback_url: `https://amanaija.vercel.app/`,
      }),
    });

    const data = await response.json();
    if (!data.status) {
      console.error('Paystack init failed:', data?.message);
      return NextResponse.json({ error: 'Payment could not be started' }, { status: 502 });
    }

    return NextResponse.json({ authorization_url: data.data.authorization_url });
  } catch (error: any) {
    console.error('Paystack init error:', error?.message);
    return NextResponse.json({ error: 'Payment could not be started' }, { status: 500 });
  }
}