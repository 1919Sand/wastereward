import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

async function merchantFor(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Sign in is required.");
  const admin = getSupabaseAdmin();
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user?.email) throw new Error("Your sign-in session has expired.");
  let { data: access, error } = await admin.from("merchant_users").select("id, merchant_id, merchant_partners(*)").eq("user_id", auth.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!access) {
    const lookup = await admin.from("merchant_users").select("id, merchant_id, merchant_partners(*)").eq("email", auth.user.email.toLowerCase()).is("user_id", null).maybeSingle();
    if (lookup.error) throw new Error(lookup.error.message);
    if (lookup.data) {
      const linked = await admin.from("merchant_users").update({ user_id: auth.user.id }).eq("id", lookup.data.id).is("user_id", null);
      if (linked.error) throw new Error(linked.error.message);
      access = lookup.data;
    }
  }
  if (!access) throw new Error("This Google account is not assigned to a Green Partner.");
  const merchant = Array.isArray(access.merchant_partners) ? access.merchant_partners[0] : access.merchant_partners;
  if (!merchant || !merchant.is_active || merchant.partnership_status !== "active") throw new Error("This Green Partner account is not active.");
  return { admin, merchant };
}

export async function GET(request: NextRequest) {
  try {
    const { admin, merchant } = await merchantFor(request);
    await admin.from("green_pass_redemptions").update({ status: "expired" }).eq("merchant_id", merchant.id).eq("status", "issued").lt("expires_at", new Date().toISOString());
    const [offers, redemptions] = await Promise.all([
      admin.from("merchant_offers").select("id, title, description, min_purchase, discount_amount, is_active, funding_source, sponsor_campaigns(title, sponsors(name))").eq("merchant_id", merchant.id).order("created_at", { ascending: false }),
      admin.from("green_pass_redemptions").select("id, redemption_code, status, bill_amount, funding_amount, redeemed_at, created_at, merchant_offers(title)").eq("merchant_id", merchant.id).order("created_at", { ascending: false }).limit(30)
    ]);
    if (offers.error) throw new Error(offers.error.message);
    if (redemptions.error) throw new Error(redemptions.error.message);
    return NextResponse.json({ merchant, offers: offers.data ?? [], redemptions: redemptions.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load partner account." }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, merchant } = await merchantFor(request);
    const body = await request.json();
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const billAmount = Number(body.billAmount);
    if (!/^[A-F0-9]{6}$/.test(code) || !Number.isFinite(billAmount) || billAmount < 0) return NextResponse.json({ error: "Enter a valid 6-character code and bill amount." }, { status: 400 });
    const { data: redemption, error: lookupError } = await admin.from("green_pass_redemptions").select("id, status, expires_at, merchant_offers(title, min_purchase, discount_amount)").eq("merchant_id", merchant.id).eq("redemption_code", code).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!redemption || redemption.status !== "issued" || new Date(redemption.expires_at) <= new Date()) return NextResponse.json({ error: "This code is invalid, expired, or already used." }, { status: 409 });
    const offer = Array.isArray(redemption.merchant_offers) ? redemption.merchant_offers[0] : redemption.merchant_offers;
    if (billAmount < Number(offer?.min_purchase ?? 0)) return NextResponse.json({ error: `The bill must be at least ₹${offer?.min_purchase}.` }, { status: 400 });
    const { data, error } = await admin.from("green_pass_redemptions").update({ status: "redeemed", bill_amount: billAmount, redeemed_at: new Date().toISOString() }).eq("id", redemption.id).eq("status", "issued").gte("expires_at", new Date().toISOString()).select("id, redemption_code, redeemed_at").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "This code was already used or expired." }, { status: 409 });
    return NextResponse.json({ redemption: data, offer: { title: offer?.title, discountAmount: offer?.discount_amount } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to redeem this code." }, { status: 400 });
  }
}
