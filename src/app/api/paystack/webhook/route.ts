import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Use the Service Role key because webhooks run without a user session
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(body).digest('hex');
    const signature = req.headers.get('x-paystack-signature');

    // 1. Verify Signature
    const a = Buffer.from(hash || ""), b = Buffer.from(signature || "");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.error('Invalid Paystack signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    // 2. Handle Successful Charge
    if (event.event === 'charge.success') {
      const { reference, amount, status } = event.data;

      if (status !== 'success') {
        return NextResponse.json({ message: 'Payment not successful' });
      }

      // 3. Fetch the order to verify the amount
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', reference)
        .single();

      if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // 4. Verify amount matches (Paystack sends in kobo)
      if (order.total_amount_kobo !== amount) {
        console.error(`Amount mismatch: Expected ${order.total_amount_kobo}, got ${amount}`);
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
      }

      // 5. Idempotency: Check if already verified
      if (order.status === 'Processing' || order.status === 'Payment Verified') {
        return NextResponse.json({ message: 'Already processed' });
      }

      // 6. Update Order Status
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ status: 'Payment Verified' })
        .eq('id', reference);

      if (updateError) {
        throw updateError;
      }

      console.log(`✅ Payment verified for order ${reference}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
