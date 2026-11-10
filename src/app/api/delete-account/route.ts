import { NextResponse } from 'next/server';
import { tooMany } from "@/lib/ratelimit";
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// A person can only delete their OWN account, proven by their login token.
export async function POST(req: Request) {
  const __limited = await tooMany(req, "del-acct", 5, 600);
  if (__limited) return __limited;
  try {
    const header = req.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'Please log in again.' }, { status: 401 });
    }

    const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !data?.user) {
      return NextResponse.json({ error: 'Please log in again.' }, { status: 401 });
    }

    const id = data.user.id;
    const missing = (error: { message?: string } | null) => !error || /does not exist|schema cache|Could not find/i.test(error.message || "");
    const gone = async (table: string, column: string) => {
      const { error } = await supabaseAdmin.from(table).delete().eq(column, id);
      if (!missing(error)) throw error;
    };
    const clear = async (table: string, column: string, patch: Record<string, unknown>) => {
      const { error } = await supabaseAdmin.from(table).update(patch).eq(column, id);
      if (!missing(error)) throw error;
    };

    const { data: mine } = await supabaseAdmin.from("orders").select("id").eq("buyer_id", id);
    const orderIds = (mine || []).map((row) => row.id);
    if (orderIds.length) {
      const { error: stripErr } = await supabaseAdmin.from("orders").update({
        guest_name: "Deleted",
        guest_phone: "",
        encrypted_address: null,
        address_iv: null,
        address_auth_tag: null,
      }).in("id", orderIds);
      if (stripErr && !/column|schema cache|Could not find/i.test(stripErr.message || "")) throw stripErr;
      const { error: detachErr } = await supabaseAdmin.from("orders").update({ buyer_id: null }).in("id", orderIds);
      if (!missing(detachErr)) throw detachErr;
    }
    const { data: shops } = await supabaseAdmin.from("places").select("id,source,live_photo_url").eq("claimed_by", id);
    const shopPhotos = (shops || []).map((shop) => {
      const url = String(shop.live_photo_url || "");
      const mark = "/shop-photos/";
      const at = url.indexOf(mark);
      return at < 0 ? "" : decodeURIComponent(url.slice(at + mark.length).split("?")[0]);
    }).filter(Boolean);
    if (shopPhotos.length) await supabaseAdmin.storage.from("shop-photos").remove(shopPhotos);

    const { data: lists } = await supabaseAdmin.from("listings").select("photos,proof_photo").eq("seller_id", id);
    const listingPhotos: string[] = [];
    for (const row of lists || []) {
      const pics = Array.isArray(row.photos) ? row.photos : [];
      for (const pic of pics) if (pic) listingPhotos.push(String(pic), `t-${pic}`);
      if (row.proof_photo) listingPhotos.push(String(row.proof_photo), `t-${row.proof_photo}`);
    }
    if (listingPhotos.length) await supabaseAdmin.storage.from("listing-photos").remove(listingPhotos);

    const wiped = {
      claimed_by: null,
      status: "unclaimed",
      phone: null,
      live_photo_url: null,
      upload_lat: null,
      upload_lng: null,
    };
    const ownShops = await supabaseAdmin.from("places").update({ ...wiped, name: "Closed shop" }).eq("claimed_by", id).eq("source", "owner");
    if (ownShops.error && !/column|schema cache|Could not find/i.test(ownShops.error.message || "")) throw ownShops.error;
    const otherShops = await supabaseAdmin.from("places").update(wiped).eq("claimed_by", id);
    if (otherShops.error) {
      const onlyOwner = await supabaseAdmin.from("places").update({ claimed_by: null, phone: null, live_photo_url: null }).eq("claimed_by", id);
      if (!missing(onlyOwner.error)) throw onlyOwner.error;
    }
    const shopIds = (shops || []).map((shop) => shop.id).filter(Boolean);
    if (shopIds.length) {
      await supabaseAdmin.from("items").update({ photo_url: null }).in("shop_id", shopIds);
    }
    await gone("reports", "reporter_id");
    await gone("blocks", "blocker_id");
    await gone("admin_audit_log", "admin_id");
    await gone("hawkers", "user_id");
    await gone("listings", "seller_id");
    await gone("listing_photo_hashes", "seller_id");
    await gone("push_subscriptions", "user_id");
    await gone("bookings", "user_id");
    await gone("needs", "user_id");
    await gone("user_blocks", "user_id");
    await gone("user_blocks", "blocked_id");
    await gone("user_reports", "reporter_id");
    await gone("user_reports", "target_id");

    const { data: threads } = await supabaseAdmin.from("dm_requests").select("id").or(`from_id.eq.${id},to_id.eq.${id}`);
    const threadIds = (threads || []).map((row) => row.id).filter(Boolean);
    if (threadIds.length) {
      const { error } = await supabaseAdmin.from("dm_messages").delete().in("request_id", threadIds);
      if (!missing(error)) throw error;
    }
    const { error: fromErr } = await supabaseAdmin.from("dm_requests").delete().eq("from_id", id);
    if (!missing(fromErr)) throw fromErr;
    const { error: toErr } = await supabaseAdmin.from("dm_requests").delete().eq("to_id", id);
    if (!missing(toErr)) throw toErr;

    const { data: said } = await supabaseAdmin.from("messages").select("media_url").eq("user_id", id);
    const media = (said || []).map((row) => {
      const url = String(row.media_url || "");
      const name = url.split("/api/chat/media/")[1] || "";
      return /^[A-Za-z0-9._-]+$/.test(name) ? `chat/aba-market/${name}` : "";
    }).filter(Boolean);
    if (media.length) await supabaseAdmin.storage.from("chat-media").remove(media);

    await clear("messages", "user_id", { user_name: "Deleted", user_id: null, body: null, media_url: null, media_type: null });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('delete-account error:', error?.message);
    return NextResponse.json({ error: 'Could not delete the account.' }, { status: 500 });
  }
}