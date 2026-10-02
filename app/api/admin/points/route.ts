import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { familyId, reason, points, date } = await request.json();
    const amount = Number(points);

    if (typeof familyId !== "string" || typeof reason !== "string" || typeof date !== "string" || !familyId.trim() || !reason.trim() || !date || !Number.isInteger(amount) || amount === 0) {
      return NextResponse.json({ error: "WasteReward ID, reason, date, and a non-zero whole point value are required." }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin().rpc("admin_adjust_points", {
      p_waste_reward_id: familyId.trim().toUpperCase(), p_reason: reason.trim(), p_points: amount, p_date: date
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update points." }, { status: 400 });
  }
}
