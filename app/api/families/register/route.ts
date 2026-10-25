import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData.user;
    if (authError || !user) return NextResponse.json({ error: "Your sign-in session has expired." }, { status: 401 });
    if (!user.email || !user.email_confirmed_at) {
      return NextResponse.json({ error: "A verified Google email is required." }, { status: 400 });
    }

    const body = await request.json();
    const familyName = cleanText(body.familyName);
    const mobileNumber = cleanText(body.mobileNumber);
    const houseNo = cleanText(body.houseNo);
    const locality = cleanText(body.locality);
    const city = cleanText(body.city);
    const pinCode = cleanText(body.pinCode);
    const referredBy = cleanText(body.referredBy).toUpperCase();
    const email = user.email.trim().toLowerCase();

    if (!familyName || !mobileNumber || !houseNo) {
      return NextResponse.json({ error: "Family name, mobile number and house number are required." }, { status: 400 });
    }
    if (familyName.length > 120 || houseNo.length > 80 || locality.length > 160 || city.length > 100) {
      return NextResponse.json({ error: "One or more household details are too long." }, { status: 400 });
    }
    if (mobileNumber.length < 5 || mobileNumber.length > 24) {
      return NextResponse.json({ error: "Enter a valid mobile or WhatsApp number." }, { status: 400 });
    }
    if (pinCode && !/^\d{6}$/.test(pinCode)) {
      return NextResponse.json({ error: "Enter a valid six-digit PIN code." }, { status: 400 });
    }

    const { data: currentFamily, error: currentError } = await admin
      .from("families")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (currentFamily) return NextResponse.json({ ok: true, alreadyRegistered: true });

    const { data: emailFamilies, error: emailError } = await admin
      .from("families")
      .select("id, user_id")
      .eq("email", email)
      .limit(2);
    if (emailError) throw new Error(emailError.message);
    if ((emailFamilies?.length ?? 0) > 1) {
      return NextResponse.json({ error: "More than one household uses this email. Please contact WasteReward support to resolve it." }, { status: 409 });
    }
    const emailFamily = emailFamilies?.[0];
    if (emailFamily?.user_id) {
      return NextResponse.json({ error: "This Google email is already connected to another household." }, { status: 409 });
    }
    if (emailFamily) {
      const { error: linkError } = await admin
        .from("families")
        .update({ user_id: user.id, claim_code_hash: null, claim_code_used_at: new Date().toISOString() })
        .eq("id", emailFamily.id)
        .is("user_id", null);
      if (linkError) throw new Error(linkError.message);
      return NextResponse.json({ ok: true, linkedExisting: true });
    }

    let referredByFamilyId: string | null = null;
    if (referredBy) {
      const { data: referrer, error: referrerError } = await admin
        .from("families")
        .select("id")
        .eq("waste_reward_id", referredBy)
        .maybeSingle();
      if (referrerError) throw new Error(referrerError.message);
      if (!referrer) return NextResponse.json({ error: "The referring WasteReward ID was not found." }, { status: 400 });
      referredByFamilyId = referrer.id;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const suffix = randomBytes(4).toString("hex").toUpperCase();
      const { error } = await admin.from("families").insert({
        waste_reward_id: `WR${suffix}`,
        family_number: `F${suffix}`,
        family_name: familyName,
        email,
        mobile_number: mobileNumber,
        family_leader_name: familyName,
        family_leader_mobile: mobileNumber,
        house_no: houseNo,
        address_line_1: "",
        city,
        district: "",
        state_province: "",
        locality,
        country: "India",
        pin_code: pinCode,
        referred_by_family_id: referredByFamilyId,
        user_id: user.id
      });
      if (!error) return NextResponse.json({ ok: true }, { status: 201 });
      if (error.code !== "23505") throw new Error(error.message);
    }

    throw new Error("Unable to generate a unique household ID. Please try again.");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create your household." }, { status: 400 });
  }
}
