import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const slug = (value: string) => `${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "partner"}-${randomBytes(2).toString("hex")}`;

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const admin = getSupabaseAdmin();
    const [merchantResult, sponsorResult, campaignResult, offerResult, redemptionResult] = await Promise.all([
      admin.from("merchant_partners").select("*, merchant_users(email)").order("created_at", { ascending: false }),
      admin.from("sponsors").select("*").order("created_at", { ascending: false }),
      admin.from("sponsor_campaigns").select("*, sponsors(name)").order("created_at", { ascending: false }),
      admin.from("merchant_offers").select("*, merchant_partners(name), sponsor_campaigns(title, sponsors(name))").order("created_at", { ascending: false }),
      admin.from("green_pass_redemptions").select("sponsor_campaign_id, funding_amount, status").in("status", ["issued", "redeemed"])
    ]);
    const error = merchantResult.error || sponsorResult.error || campaignResult.error || offerResult.error || redemptionResult.error;
    if (error) throw new Error(error.message);
    const usage = new Map<string, { spent: number; claims: number }>();
    for (const row of redemptionResult.data ?? []) {
      if (!row.sponsor_campaign_id) continue;
      const current = usage.get(row.sponsor_campaign_id) ?? { spent: 0, claims: 0 };
      usage.set(row.sponsor_campaign_id, { spent: current.spent + Number(row.funding_amount), claims: current.claims + 1 });
    }
    const campaigns = (campaignResult.data ?? []).map((campaign) => ({ ...campaign, ...(usage.get(campaign.id) ?? { spent: 0, claims: 0 }) }));
    return NextResponse.json({ merchants: merchantResult.data ?? [], sponsors: sponsorResult.data ?? [], campaigns, offers: offerResult.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load the Green Partner programme." }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const admin = getSupabaseAdmin();
    const body = await request.json();
    const action = clean(body.action);

    if (action === "createMerchant") {
      const name = clean(body.name), category = clean(body.category), email = clean(body.contactEmail).toLowerCase();
      if (!name || !category || !email) return NextResponse.json({ error: "Merchant name, category, and Google email are required." }, { status: 400 });
      const { data, error } = await admin.from("merchant_partners").insert({
        name, slug: slug(name), category, contact_name: clean(body.contactName), contact_email: email,
        contact_phone: clean(body.contactPhone), address: clean(body.address), locality: clean(body.locality),
        city: clean(body.city), state_province: clean(body.stateProvince), pin_code: clean(body.pinCode),
        partnership_status: "active", terms_accepted_at: new Date().toISOString()
      }).select("id").single();
      if (error) throw new Error(error.message);
      const { error: userError } = await admin.from("merchant_users").insert({ merchant_id: data.id, email });
      if (userError) throw new Error(userError.message);
    } else if (action === "createSponsor") {
      const name = clean(body.name);
      if (!name) return NextResponse.json({ error: "Sponsor name is required." }, { status: 400 });
      const { error } = await admin.from("sponsors").insert({ name, slug: slug(name), description: clean(body.description), website_url: clean(body.websiteUrl), contact_name: clean(body.contactName), contact_email: clean(body.contactEmail).toLowerCase() });
      if (error) throw new Error(error.message);
    } else if (action === "createCampaign") {
      const budget = Number(body.budgetAmount), cap = Number(body.maxRedemptions);
      if (!clean(body.sponsorId) || !clean(body.title) || !(budget > 0) || !Number.isInteger(cap) || cap < 1 || !clean(body.endsOn)) return NextResponse.json({ error: "Complete the sponsor, title, budget, redemption cap, and end date." }, { status: 400 });
      const { error } = await admin.from("sponsor_campaigns").insert({ sponsor_id: body.sponsorId, title: clean(body.title), description: clean(body.description), budget_amount: budget, max_redemptions: cap, starts_on: clean(body.startsOn), ends_on: clean(body.endsOn), status: "active" });
      if (error) throw new Error(error.message);
    } else if (action === "createOffer") {
      const points = Number(body.pointsRequired), minimum = Number(body.minPurchase), discount = Number(body.discountAmount), limit = Number(body.usageLimit);
      if (!clean(body.merchantId) || !clean(body.title) || !Number.isInteger(points) || points < 0 || minimum < 0 || discount < 0 || !Number.isInteger(limit) || limit < 1) return NextResponse.json({ error: "Complete the merchant offer with valid non-negative amounts." }, { status: 400 });
      const sponsorCampaignId = clean(body.sponsorCampaignId) || null;
      const { error } = await admin.from("merchant_offers").insert({ merchant_id: body.merchantId, title: clean(body.title), description: clean(body.description), points_required: points, min_purchase: minimum, discount_amount: discount, usage_limit_per_family: limit, valid_from: clean(body.validFrom), valid_until: clean(body.validUntil) || null, sponsor_campaign_id: sponsorCampaignId, funding_source: sponsorCampaignId ? "sponsor" : "merchant" });
      if (error) throw new Error(error.message);
    } else {
      return NextResponse.json({ error: "Unsupported programme action." }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save the Green Partner programme." }, { status: 400 });
  }
}
