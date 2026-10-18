import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateClaimCode, hashClaimCode } from "@/lib/claim-code";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const required = ["familyId", "familyNumber", "familyName", "email", "mobileNumber", "familyLeaderName", "familyLeaderMobile", "houseNo", "addressLine1", "city", "district", "stateProvince", "locality", "country", "pinCode"];

    if (!required.every((key) => typeof body[key] === "string" && body[key].trim())) {
      return NextResponse.json({ error: "Please complete all required family, contact, and address fields." }, { status: 400 });
    }
    if (!/^[A-Z0-9-]{3,24}$/i.test(body.familyId.trim())) {
      return NextResponse.json({ error: "WasteReward ID must contain 3–24 letters, numbers, or hyphens." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || body.email.length > 254) {
      return NextResponse.json({ error: "Enter a valid household email address." }, { status: 400 });
    }
    if ((body.country.trim().toLowerCase() === "india" && !/^\d{6}$/.test(body.pinCode.trim())) || body.pinCode.trim().length > 20) {
      return NextResponse.json({ error: "Enter a valid PIN or postal code." }, { status: 400 });
    }

    const totalMembers = body.totalMembers === "" || body.totalMembers == null ? null : Number(body.totalMembers);
    if (totalMembers !== null && (!Number.isInteger(totalMembers) || totalMembers < 1)) {
      return NextResponse.json({ error: "Total family members must be a positive whole number." }, { status: 400 });
    }

    let referredByFamilyId: string | null = null;
    if (typeof body.referredBy === "string" && body.referredBy.trim()) {
      const { data: referrer } = await getSupabaseAdmin().from("families").select("id").eq("waste_reward_id", body.referredBy.trim().toUpperCase()).maybeSingle();
      if (!referrer) return NextResponse.json({ error: "The referring WasteReward ID was not found." }, { status: 400 });
      referredByFamilyId = referrer.id;
    }

    const claimCode = generateClaimCode();
    const claimCodeExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await getSupabaseAdmin().from("families").insert({
      waste_reward_id: body.familyId.trim().toUpperCase(),
      family_number: body.familyNumber.trim().toUpperCase(),
      family_name: body.familyName.trim(),
      email: body.email.trim().toLowerCase(),
      mobile_number: body.mobileNumber.trim(),
      alternate_mobile_number: body.alternateMobileNumber?.trim() || null,
      family_leader_name: body.familyLeaderName.trim(),
      family_leader_mobile: body.familyLeaderMobile.trim(),
      total_members: totalMembers,
      house_no: body.houseNo.trim(),
      address_line_1: body.addressLine1.trim(),
      address_line_2: body.addressLine2?.trim() || null,
      city: body.city.trim(),
      district: body.district.trim(),
      state_province: body.stateProvince.trim(),
      locality: body.locality.trim(),
      country: body.country.trim(),
      pin_code: body.pinCode.trim(),
      referred_by_family_id: referredByFamilyId,
      claim_code_hash: hashClaimCode(claimCode),
      claim_code_expires_at: claimCodeExpiresAt
    });
    if (error) throw new Error(error.code === "23505" ? "That WasteReward ID already exists." : error.message);
    return NextResponse.json({ ok: true, claimCode, claimCodeExpiresAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create household." }, { status: 403 });
  }
}
