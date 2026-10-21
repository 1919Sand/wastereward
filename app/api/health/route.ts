import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_MIGRATION = "20261021_production_ready";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("schema_migrations")
      .select("version")
      .eq("version", REQUIRED_MIGRATION)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { status: "migration_required" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { status: "ok", database: "connected", migration: REQUIRED_MIGRATION },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
