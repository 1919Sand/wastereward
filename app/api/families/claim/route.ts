import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hashClaimCode } from "@/lib/claim-code";
import { FAMILY_PROFILE_SELECT } from "@/lib/family-select";

export const runtime = "nodejs";
const claimAttempts = new Map<string, { count: number; resetAt: number }>();

function claimIsRateLimited(userId: string) {
  const now = Date.now();
  const current = claimAttempts.get(userId);
  if (!current || current.resetAt <= now) {
    claimAttempts.set(userId, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  current.count += 1;
  return current.count > 5;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Sign in is required.");

    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new Error("Your sign-in session has expired.");
    if (claimIsRateLimited(authData.user.id)) {
      return NextResponse.json({ error: "Too many claim attempts. Please wait 15 minutes before trying again." }, { status: 429 });
    }

    const { wasteRewardId, claimCode } = await request.json();
    if (typeof wasteRewardId !== "string" || typeof claimCode !== "string" || !wasteRewardId.trim() || !claimCode.trim()) {
      return NextResponse.json({ error: "WasteReward ID and one-time claim code are required." }, { status: 400 });
    }

    const { data: family, error: claimError } = await admin.rpc("claim_family", {
      p_waste_reward_id: wasteRewardId.trim().toUpperCase(),
      p_claim_code_hash: hashClaimCode(claimCode),
      p_user_id: authData.user.id,
      p_email: authData.user.email ?? ""
    });
    if (claimError?.code === "PGRST202" || claimError?.message.includes("schema cache")) {
      throw new Error("Household claiming is not enabled yet. The administrator must run the production database update.");
    }
    if (claimError || !family?.[0]) throw new Error("The claim code is invalid or expired, the Google email does not match, or the household is already claimed.");

    const { data: fullFamily, error } = await admin
      .from("families")
      .select(FAMILY_PROFILE_SELECT)
      .eq("id", family[0].id)
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ family: fullFamily });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to link household." }, { status: 400 });
  }
}
