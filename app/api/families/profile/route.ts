import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { FAMILY_PROFILE_SELECT } from "@/lib/family-select";

export const runtime = "nodejs";

const LEGACY_FAMILY_SELECT = `
  id, waste_reward_id, family_name, house_no, society, points,
  current_streak, best_streak, rank, next_reward, days, created_at,
  point_transactions(date, reason, points)
`;

function isMissingProfileColumn(error: { code?: string; message: string } | null) {
  return Boolean(error && (error.code === "42703" || /column .* does not exist/i.test(error.message)));
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Sign in is required.");

    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new Error("Your sign-in session has expired.");

    let profileResult = await admin
      .from("families")
      .select(FAMILY_PROFILE_SELECT)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    let automaticallyLinkedFamily: typeof profileResult.data = null;

    const normalizedEmail = authData.user.email?.trim().toLowerCase();
    if (!profileResult.error && !profileResult.data && normalizedEmail && authData.user.email_confirmed_at) {
      const { data: candidates, error: candidateError } = await admin
        .from("families")
        .select("id")
        .eq("email", normalizedEmail)
        .is("user_id", null)
        .limit(2);
      if (candidateError) throw new Error(candidateError.message);
      if (candidates?.length === 1) {
        const { data: linked, error: linkError } = await admin
          .from("families")
          .update({ user_id: authData.user.id, claim_code_hash: null, claim_code_used_at: new Date().toISOString() })
          .eq("id", candidates[0].id)
          .is("user_id", null)
          .select(FAMILY_PROFILE_SELECT)
          .maybeSingle();
        if (linkError) throw new Error(linkError.message);
        if (linked) automaticallyLinkedFamily = linked;
      }
    }
    let family = profileResult.data ?? automaticallyLinkedFamily;
    let error = profileResult.error;
    let schemaOutdated = false;

    if (isMissingProfileColumn(error)) {
      const legacyResult = await admin
        .from("families")
        .select(LEGACY_FAMILY_SELECT)
        .eq("user_id", authData.user.id)
        .maybeSingle();
      family = legacyResult.data ? {
        ...legacyResult.data,
        family_number: `F-${legacyResult.data.waste_reward_id}`,
        email: "",
        mobile_number: "",
        alternate_mobile_number: null,
        family_leader_name: legacyResult.data.family_name,
        family_leader_mobile: "",
        total_members: null,
        address_line_1: legacyResult.data.house_no,
        address_line_2: null,
        city: "",
        district: "",
        state_province: "",
        locality: legacyResult.data.society,
        country: "India",
        pin_code: "",
        green_pause_days: 4,
        referral_green_pause_days: 0
      } : null;
      error = legacyResult.error;
      schemaOutdated = true;
    }

    if (error) throw new Error(error.message);
    if (!family) return NextResponse.json({ family: null });

    const summaryFields = "id, waste_reward_id, family_number, family_name, locality, referred_by_family_id";
    const [{ data: referrals }, { data: nearby }] = schemaOutdated
      ? [{ data: [] }, { data: [] }]
      : await Promise.all([
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
      },
      schemaOutdated
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load household." }, { status: 401 });
  }
}
