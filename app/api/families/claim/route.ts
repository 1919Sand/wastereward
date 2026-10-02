import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Sign in is required.");

    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new Error("Your sign-in session has expired.");

    const { wasteRewardId, houseNo } = await request.json();
    if (typeof wasteRewardId !== "string" || typeof houseNo !== "string" || !wasteRewardId.trim() || !houseNo.trim()) {
      return NextResponse.json({ error: "WasteReward ID and house number are required." }, { status: 400 });
    }

    const { data: family, error: claimError } = await admin.rpc("claim_family", {
      p_waste_reward_id: wasteRewardId.trim().toUpperCase(),
      p_house_no: houseNo.trim(),
      p_user_id: authData.user.id
    });
    if (claimError || !family?.[0]) throw new Error(claimError?.message ?? "That household has already been claimed or the details do not match.");

    const { data: fullFamily, error } = await admin
      .from("families")
      .select("*, point_transactions(date, reason, points)")
      .eq("id", family[0].id)
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ family: fullFamily });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to link household." }, { status: 400 });
  }
}
