import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const scopes = new Set(["nearby", "city", "state", "india"]);

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Sign in is required.");

    const scope = request.nextUrl.searchParams.get("scope") ?? "nearby";
    const month = request.nextUrl.searchParams.get("month") ?? "";
    if (!scopes.has(scope) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ error: "A valid month and leaderboard scope are required." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new Error("Your sign-in session has expired.");

    const { data: family, error: familyError } = await admin
      .from("families")
      .select("id, latitude, longitude")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (familyError) throw new Error(familyError.message);
    if (!family) throw new Error("No household is linked to this account.");

    const { data, error } = await admin.rpc("get_monthly_leaderboard", {
      p_viewer_family_id: family.id,
      p_scope: scope,
      p_month: `${month}-01`,
      p_limit: 20
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({
      entries: data ?? [],
      nearbyMode: scope === "nearby" && family.latitude != null && family.longitude != null ? "radius" : "pin"
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load the leaderboard." }, { status: 401 });
  }
}
