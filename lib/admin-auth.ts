import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Sign in is required.");

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user?.email || !adminEmails().includes(data.user.email.toLowerCase())) {
    throw new Error("You are not authorized to use the admin panel.");
  }

  return data.user;
}
