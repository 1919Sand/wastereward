import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_MIGRATIONS = ["20261021_production_ready", "20261025_green_pass", "20261025_partner_sponsor_program"];

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("schema_migrations")
      .select("version")
      .in("version", REQUIRED_MIGRATIONS);

    const applied = new Set((data ?? []).map((entry) => entry.version));
    if (error || REQUIRED_MIGRATIONS.some((version) => !applied.has(version))) {
      return NextResponse.json(
        { status: "migration_required" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { status: "ok", database: "connected", migration: REQUIRED_MIGRATIONS.at(-1) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
