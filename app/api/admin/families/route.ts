import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { familyId, familyName, houseNo } = await request.json();

    if (![familyId, familyName, houseNo].every((value) => typeof value === "string" && value.trim())) {
      return NextResponse.json({ error: "WasteReward ID, family name, and house number are required." }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin().from("families").insert({
      waste_reward_id: familyId.trim().toUpperCase(),
      family_name: familyName.trim(),
      house_no: houseNo.trim()
    });
    if (error) throw new Error(error.code === "23505" ? "That WasteReward ID already exists." : error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create household." }, { status: 403 });
  }
}
