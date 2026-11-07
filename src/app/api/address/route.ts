import { NextResponse } from 'next/server';
import { tooMany } from "@/lib/ratelimit";
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const ALGORITHM = 'aes-256-gcm';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function getKey(): Buffer | null {
  const keyHex = process.env.ADDRESS_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) return null;
  return Buffer.from(keyHex, 'hex');
}

async function currentUser(req: Request) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function POST(req: Request) {
  const __limited = await tooMany(req, "address", 30, 60);
  if (__limited) return __limited;
  try {
    const body: any = await req.json().catch(() => ({}));
    const action = body?.action;

    const KEY = getKey();
    if (!KEY) {
      console.error('Encryption key is missing or invalid length.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Encrypting is allowed for guest checkout.
    if (action === 'encrypt') {
      const address = body?.address;
      if (typeof address !== 'string' || !address.trim() || address.length > 300) {
        return NextResponse.json({ error: 'A valid address is required' }, { status: 400 });
      }
      const newIv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(ALGORITHM, KEY, newIv);
      let encrypted = cipher.update(address, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return NextResponse.json({
        encrypted,
        iv: newIv.toString('hex'),
        authTag: cipher.getAuthTag().toString('hex'),
      });
    }

    // Decrypting needs a login AND the right to see that specific order.
    if (action === 'decrypt') {
      const user = await currentUser(req);
      if (!user) return NextResponse.json({ error: 'Please log in again.' }, { status: 401 });

      const orderId = body?.orderId;
      if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });

      const { data: order } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

      let allowed = order.buyer_id === user.id;
      if (!allowed && order.shop_id) {
        const { data: place } = await supabaseAdmin.from('places').select('claimed_by').eq('id', order.shop_id).maybeSingle();
        allowed = place?.claimed_by === user.id;
      }
      if (!allowed) {
        const { data: prof } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
        allowed = !!prof?.is_admin;
      }
      if (!allowed) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

      const tagKey = Object.keys(order).find((k) => k.includes('auth_tag'));
      const enc = order.encrypted_address;
      const iv = order.address_iv;
      const tag = tagKey ? order[tagKey] : null;
      if (!enc || !iv || !tag) {
        return NextResponse.json({ error: 'No address on this order' }, { status: 404 });
      }

      const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      let decrypted = decipher.update(enc, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return NextResponse.json({ decrypted });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Address route error:', error?.message);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}