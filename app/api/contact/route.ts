import { NextRequest, NextResponse } from "next/server";

const MAX_LENGTH = 5000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS;
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 10_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 });

    const { name, email, subject, message, website } = await request.json();
    if (typeof website === "string" && website.trim()) return NextResponse.json({ ok: true });
    if (![name, email, subject, message].every((value) => typeof value === "string" && value.trim())) {
      return NextResponse.json({ error: "Please complete every field." }, { status: 400 });
    }
    const clean = { name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() };
    if (clean.name.length > 120 || clean.email.length > 254 || clean.subject.length > 180 || clean.message.length > MAX_LENGTH) {
      return NextResponse.json({ error: "One or more fields are too long." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const webhookUrl = process.env.CONTACT_WEBHOOK_URL;
    if (!webhookUrl) return NextResponse.json({ error: "Contact delivery is not configured yet. Please try again later." }, { status: 503 });
    const delivery = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clean), signal: AbortSignal.timeout(8_000) });
    if (!delivery.ok) throw new Error("The contact service is unavailable.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "We could not send your message." }, { status: 500 });
  }
}
