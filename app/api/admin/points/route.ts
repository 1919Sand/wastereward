import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { dateKeyInTimeZone, isValidDateKey } from "@/lib/date";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const familyId = request.nextUrl.searchParams.get("familyId")?.trim().toUpperCase();
    if (!familyId) return NextResponse.json({ error: "WasteReward ID is required." }, { status: 400 });

    const { data, error } = await getSupabaseAdmin()
      .from("families")
      .select("waste_reward_id, family_name, points, point_transactions(date, reason, points, created_at)")
      .eq("waste_reward_id", familyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "No household was found for this WasteReward ID." }, { status: 404 });

    const history = [...(data.point_transactions ?? [])].sort((a, b) =>
      b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
    );
    return NextResponse.json(
      { family: { id: data.waste_reward_id, name: data.family_name, points: data.points, history } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load point history." }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    const { familyId, reason, points, date, status } = await request.json();
    const amount = Number(points);

    if (typeof familyId !== "string" || typeof reason !== "string" || typeof date !== "string" || !familyId.trim() || !reason.trim() || !date || !Number.isInteger(amount) || !["completed", "missed", "green_pause"].includes(status)) {
      return NextResponse.json({ error: "WasteReward ID, reason, date, status, and a whole point value are required." }, { status: 400 });
    }
    if (!/^[A-Z0-9-]{3,24}$/i.test(familyId.trim()) || reason.trim().length > 180) {
      return NextResponse.json({ error: "WasteReward ID or reason is invalid." }, { status: 400 });
    }
    if (status === "completed" && amount <= 0) {
      return NextResponse.json({ error: "A completed day must award a positive whole number of points." }, { status: 400 });
    }
    if ((status === "missed" || status === "green_pause") && amount !== 0) {
      return NextResponse.json({ error: "Missed and Green Pause days must have 0 points." }, { status: 400 });
    }
    if (!isValidDateKey(date) || date > dateKeyInTimeZone()) {
      return NextResponse.json({ error: "The activity date must be valid and cannot be in the future." }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin().rpc("admin_adjust_points", {
      p_waste_reward_id: familyId.trim().toUpperCase(), p_reason: reason.trim(), p_points: amount, p_date: date, p_status: status,
      p_admin_email: adminUser.email ?? "unknown"
    });
    if (error) {
      const schemaIsOutdated = error.code === "PGRST202"
        || error.message.includes("admin_adjust_points") && error.message.includes("schema cache");
      if (schemaIsOutdated) {
        throw new Error("The Supabase database is out of date. Run supabase/production-hardening-update.sql, then try again.");
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update points." }, { status: 400 });
  }
}
