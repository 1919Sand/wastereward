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

    const body = await request.json();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "A valid location is required." }, { status: 400 });
    }

    // About 1.1 km of precision at the equator: enough for a 5 km leaderboard
    // without retaining a member's exact home/device position.
    const roundedLatitude = Math.round(latitude * 100) / 100;
    const roundedLongitude = Math.round(longitude * 100) / 100;
    const { data: family, error } = await admin
      .from("families")
      .update({ latitude: roundedLatitude, longitude: roundedLongitude, location_updated_at: new Date().toISOString() })
      .eq("user_id", authData.user.id)
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "PGRST204" || error.message.includes("latitude")) {
        throw new Error("Location ranking is not enabled in Supabase yet. Run supabase/location-leaderboard-update.sql first.");
      }
      throw new Error(error.message);
    }
    if (!family) throw new Error("No household is linked to this account.");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save your location." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Sign in is required.");

    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new Error("Your sign-in session has expired.");

    const { data, error } = await admin
      .from("families")
      .update({ latitude: null, longitude: null, location_updated_at: null })
      .eq("user_id", authData.user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("No household is linked to this account.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove your location." }, { status: 400 });
  }
}
