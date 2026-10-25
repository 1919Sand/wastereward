import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const required = ["familyName", "mobileNumber", "houseNo"];

    if (!required.every((key) => typeof body[key] === "string" && body[key].trim())) {
      return NextResponse.json({ error: "Family name, mobile number, and house number are required." }, { status: 400 });
    }
    const generatedSuffix = randomBytes(4).toString("hex").toUpperCase();
    const familyId = cleanText(body.familyId).toUpperCase() || `WR${generatedSuffix}`;
    const familyNumber = cleanText(body.familyNumber).toUpperCase() || `F${generatedSuffix}`;
    if (!/^[A-Z0-9-]{3,24}$/i.test(familyId)) {
      return NextResponse.json({ error: "WasteReward ID must contain 3–24 letters, numbers, or hyphens." }, { status: 400 });
    }
    if (!/^[A-Z0-9-]{1,24}$/i.test(familyNumber)) {
      return NextResponse.json({ error: "Family number must contain 1–24 letters, numbers, or hyphens." }, { status: 400 });
    }
    const email = cleanText(body.email).toLowerCase();
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) {
      return NextResponse.json({ error: "Enter a valid household email address." }, { status: 400 });
    }
    const country = cleanText(body.country) || "India";
    const pinCode = cleanText(body.pinCode);
    if (pinCode && ((country.toLowerCase() === "india" && !/^\d{6}$/.test(pinCode)) || pinCode.length > 20)) {
      return NextResponse.json({ error: "Enter a valid PIN or postal code." }, { status: 400 });
    }
    const mobileNumber = cleanText(body.mobileNumber);
    if (mobileNumber.length < 5 || mobileNumber.length > 24) {
      return NextResponse.json({ error: "Enter a valid mobile or WhatsApp number." }, { status: 400 });
    }
    const boundedFields = [
      [body.familyName, 120], [body.houseNo, 80], [body.alternateMobileNumber, 24],
      [body.familyLeaderName, 120], [body.familyLeaderMobile, 24], [body.addressLine1, 180],
      [body.addressLine2, 180], [body.city, 100], [body.district, 100],
      [body.stateProvince, 100], [body.locality, 160], [country, 100]
    ] as const;
    if (boundedFields.some(([value, max]) => cleanText(value).length > max)) {
      return NextResponse.json({ error: "One or more family details are too long." }, { status: 400 });
    }

    const totalMembers = body.totalMembers === "" || body.totalMembers == null ? null : Number(body.totalMembers);
    if (totalMembers !== null && (!Number.isInteger(totalMembers) || totalMembers < 1)) {
      return NextResponse.json({ error: "Total family members must be a positive whole number." }, { status: 400 });
    }

    let referredByFamilyId: string | null = null;
    if (typeof body.referredBy === "string" && body.referredBy.trim()) {
      const { data: referrer, error: referrerError } = await getSupabaseAdmin().from("families").select("id").eq("waste_reward_id", body.referredBy.trim().toUpperCase()).maybeSingle();
      if (referrerError) throw new Error(referrerError.message);
      if (!referrer) return NextResponse.json({ error: "The referring WasteReward ID was not found." }, { status: 400 });
      referredByFamilyId = referrer.id;
    }

    const { error } = await getSupabaseAdmin().from("families").insert({
      waste_reward_id: familyId,
      family_number: familyNumber,
      family_name: body.familyName.trim(),
      email,
      mobile_number: mobileNumber,
      alternate_mobile_number: cleanText(body.alternateMobileNumber) || null,
      family_leader_name: cleanText(body.familyLeaderName) || body.familyName.trim(),
      family_leader_mobile: cleanText(body.familyLeaderMobile) || mobileNumber,
      total_members: totalMembers,
      house_no: body.houseNo.trim(),
      address_line_1: cleanText(body.addressLine1),
      address_line_2: cleanText(body.addressLine2) || null,
      city: cleanText(body.city),
      district: cleanText(body.district),
      state_province: cleanText(body.stateProvince),
      locality: cleanText(body.locality),
      country,
      pin_code: pinCode,
      referred_by_family_id: referredByFamilyId
    });
    if (error?.code === "PGRST204" || error?.message.includes("schema cache")) {
      return NextResponse.json(
        { error: "Database update required. Run supabase/production-hardening-update.sql in the Supabase SQL Editor, then try again." },
        { status: 503 }
      );
    }
    if (error) throw new Error(error.code === "23505" ? "That WasteReward ID already exists." : error.message);
    return NextResponse.json({ ok: true, familyId, familyNumber });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create household." }, { status: 403 });
  }
}
