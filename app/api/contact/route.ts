import { NextRequest, NextResponse } from "next/server";

const MAX_LENGTH = 5000;

export async function POST(request: NextRequest) {
  try {
    const { name, email, subject, message } = await request.json();
    if (![name, email, subject, message].every((value) => typeof value === "string" && value.trim())) {
      return NextResponse.json({ error: "Please complete every field." }, { status: 400 });
    }
    if (name.length > 120 || email.length > 254 || subject.length > 180 || message.length > MAX_LENGTH) {
      return NextResponse.json({ error: "One or more fields are too long." }, { status: 400 });
    }
    const webhookUrl = process.env.CONTACT_WEBHOOK_URL;
    if (!webhookUrl) return NextResponse.json({ error: "Contact delivery is not configured yet. Please try again later." }, { status: 503 });
    const delivery = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() }) });
    if (!delivery.ok) throw new Error("The contact service is unavailable.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "We could not send your message." }, { status: 500 });
  }
}
