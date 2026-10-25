import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { dateKeyInTimeZone } from "@/lib/date";

export const runtime = "nodejs";

async function authenticatedFamily(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Sign in is required.");
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("Your sign-in session has expired.");
  const { data: family, error: familyError } = await admin
    .from("families")
    .select("id, waste_reward_id, points, city, locality, pin_code")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (familyError) throw new Error(familyError.message);
  if (!family) throw new Error("Complete your household setup before using Green Pass.");
  return { admin, family };
}

function relatedOne(value: unknown) {
  const item = Array.isArray(value) ? value[0] : value;
  return item && typeof item === "object" ? item as Record<string, unknown> : null;
}

function mapOffer(row: Record<string, unknown>) {
  const merchant = relatedOne(row.merchant_partners);
  const campaign = relatedOne(row.sponsor_campaigns);
  const sponsor = relatedOne(campaign?.sponsors);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    pointsRequired: row.points_required,
    minPurchase: row.min_purchase,
    discountAmount: row.discount_amount,
    validUntil: row.valid_until,
    fundingSource: row.funding_source,
    sponsor: sponsor ? { name: sponsor.name, campaign: campaign?.title } : null,
    merchant: merchant ? {
      name: merchant.name,
      category: merchant.category,
      address: merchant.address,
      locality: merchant.locality,
      city: merchant.city,
      pinCode: merchant.pin_code
    } : null
  };
}

function mapRedemption(row: Record<string, unknown>) {
  const offer = relatedOne(row.merchant_offers);
  const merchant = relatedOne(offer?.merchant_partners);
  return {
    id: row.id,
    redemption_code: row.redemption_code,
    status: row.status,
    expires_at: row.expires_at,
    created_at: row.created_at,
    offerTitle: offer?.title ?? "Green Partner offer",
    merchantName: merchant?.name ?? "WasteReward partner"
  };
}

export async function GET(request: NextRequest) {
  try {
    const { admin, family } = await authenticatedFamily(request);
    const today = dateKeyInTimeZone();
    const { error: expiryError } = await admin
      .from("green_pass_redemptions")
      .update({ status: "expired" })
      .eq("family_id", family.id)
      .eq("status", "issued")
      .lt("expires_at", new Date().toISOString());
    if (expiryError) throw new Error(expiryError.message);
    const [{ data: offers, error: offerError }, { data: redemptions, error: redemptionError }] = await Promise.all([
      admin
        .from("merchant_offers")
        .select("id, title, description, points_required, min_purchase, discount_amount, valid_until, funding_source, merchant_partners!inner(name, category, address, locality, city, pin_code, is_active, partnership_status), sponsor_campaigns(title, sponsors(name))")
        .eq("is_active", true)
        .eq("merchant_partners.is_active", true)
        .eq("merchant_partners.partnership_status", "active")
        .lte("valid_from", today)
        .or(`valid_until.is.null,valid_until.gte.${today}`)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("green_pass_redemptions")
        .select("id, redemption_code, status, expires_at, created_at, merchant_offers(title, merchant_partners(name))")
        .eq("family_id", family.id)
        .order("created_at", { ascending: false })
        .limit(10)
    ]);
    if (offerError) throw new Error(offerError.message);
    if (redemptionError) throw new Error(redemptionError.message);

    const localOffers = (offers ?? []).filter((row) => {
      const merchant = relatedOne(row.merchant_partners);
      if (!merchant) return false;
      if (family.pin_code && merchant.pin_code === family.pin_code) return true;
      if (family.locality && typeof merchant.locality === "string" && merchant.locality.toLowerCase() === family.locality.toLowerCase()) return true;
      if (family.city && typeof merchant.city === "string" && merchant.city.toLowerCase() === family.city.toLowerCase()) return true;
      return !family.pin_code && !family.locality && !family.city;
    });

    return NextResponse.json({ offers: localOffers.map((row) => mapOffer(row as unknown as Record<string, unknown>)), redemptions: (redemptions ?? []).map((row) => mapRedemption(row as unknown as Record<string, unknown>)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Green Pass.";
    const migrationRequired = /merchant_offers|green_pass_redemptions|schema cache|does not exist/i.test(message);
    return NextResponse.json({ error: migrationRequired ? "Green Pass database update is required." : message }, { status: migrationRequired ? 503 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, family } = await authenticatedFamily(request);
    const { offerId } = await request.json();
    if (typeof offerId !== "string" || !offerId) return NextResponse.json({ error: "Choose a valid offer." }, { status: 400 });

    const { data: offer, error: offerError } = await admin
      .from("merchant_offers")
      .select("id, title, merchant_partners!inner(name)")
      .eq("id", offerId)
      .single();
    const offerMerchant = relatedOne(offer?.merchant_partners);
    if (offerError || !offer || !offerMerchant) {
      return NextResponse.json({ error: "This offer is no longer available." }, { status: 404 });
    }
    const { data: issued, error } = await admin.rpc("issue_green_pass_offer", { p_family_id: family.id, p_offer_id: offer.id });
    if (error) throw new Error(error.message);
    const redemption = Array.isArray(issued) ? issued[0] : issued;

    return NextResponse.json({ redemption: { ...redemption, created_at: new Date().toISOString(), offerTitle: offer.title, merchantName: offerMerchant.name } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to unlock this offer.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
