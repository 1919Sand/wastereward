import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Sign in is required.");

    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new Error("Your sign-in session has expired.");

    const { data: family, error } = await admin
      .from("families")
      .select("*, point_transactions(date, reason, points)")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!family) return NextResponse.json({ family: null });

    const summaryFields = "id, waste_reward_id, family_number, family_name, locality, referred_by_family_id";
    const [{ data: referrals }, { data: nearby }] = await Promise.all([
      admin.from("families").select(summaryFields).eq("referred_by_family_id", family.id),
      family.locality
        ? admin.from("families").select(summaryFields).eq("locality", family.locality).neq("id", family.id).limit(12)
        : Promise.resolve({ data: [] })
    ]);

    const summarize = (row: Record<string, unknown>) => ({
      id: row.waste_reward_id,
      familyNumber: row.family_number,
      familyName: row.family_name,
      locality: row.locality
    });

    return NextResponse.json({
      family: {
        ...family,
        referrals: (referrals ?? []).map(summarize),
        nearby_families: (nearby ?? []).map(summarize)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load household." }, { status: 401 });
  }
}
