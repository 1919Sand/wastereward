import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { generateClaimCode, hashClaimCode } from "@/lib/claim-code";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { familyId } = await request.json();
    if (typeof familyId !== "string" || !familyId.trim()) {
      return NextResponse.json({ error: "WasteReward ID is required." }, { status: 400 });
    }

    const claimCode = generateClaimCode();
    const claimCodeExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await getSupabaseAdmin()
      .from("families")
      .update({ claim_code_hash: hashClaimCode(claimCode), claim_code_expires_at: claimCodeExpiresAt, claim_code_used_at: null })
      .eq("waste_reward_id", familyId.trim().toUpperCase())
      .is("user_id", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "The household was not found or has already been claimed." }, { status: 404 });

    return NextResponse.json({ claimCode, claimCodeExpiresAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate a claim code." }, { status: 400 });
  }
}
