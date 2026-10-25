"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type PortalData = {
  merchant: { name: string; category: string; address: string; locality: string; city: string };
  offers: Array<{ id: string; title: string; description: string; min_purchase: string | number; discount_amount: string | number; is_active: boolean; funding_source: string; sponsor_campaigns?: { title?: string; sponsors?: { name?: string } | { name?: string }[] } | { title?: string; sponsors?: { name?: string } | { name?: string }[] }[] }>;
  redemptions: Array<{ id: string; redemption_code: string; status: string; bill_amount: string | number | null; redeemed_at: string | null; created_at: string; merchant_offers?: { title?: string } | { title?: string }[] }>;
};
const one = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value;
const money = (value: string | number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));

export default function MerchantPortal() {
  const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [data, setData] = useState<PortalData | null>(null), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [code, setCode] = useState(""), [billAmount, setBillAmount] = useState("");

  const api = useCallback(async (options?: RequestInit) => {
    const { data: { session } } = await supabase!.auth.getSession();
    if (!session) throw new Error("Please sign in again.");
    const response = await fetch("/api/merchant", { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, ...options?.headers }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Request failed.");
    return result;
  }, []);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setData(await api()); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load account."); } finally { setLoading(false); } }, [api]);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getUser().then(({ data: auth }) => { setUser(auth.user); if (auth.user) void load(); else setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); if (session?.user) void load(); else setData(null); });
    return () => listener.subscription.unsubscribe();
  }, [load]);
  const redeemedToday = useMemo(() => data?.redemptions.filter((item) => item.status === "redeemed" && item.redeemed_at && new Date(item.redeemed_at).toDateString() === new Date().toDateString()).length ?? 0, [data]);
  const fundedToday = useMemo(() => data?.redemptions.filter((item) => item.status === "redeemed" && item.redeemed_at && new Date(item.redeemed_at).toDateString() === new Date().toDateString()).reduce((sum, item) => sum + Number(item.bill_amount ?? 0), 0) ?? 0, [data]);

  async function redeem(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try { const result = await api({ method: "POST", body: JSON.stringify({ code, billAmount }) }); setSuccess(`${result.offer.title} redeemed. Apply ${money(result.offer.discountAmount)} to the bill.`); setCode(""); setBillAmount(""); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to redeem code."); }
    finally { setBusy(false); }
  }

  if (!supabaseConfigured) return <main className="merchant-login"><section className="login-card"><h1>Setup required</h1><p className="login-copy">Supabase credentials are not configured.</p></section></main>;
  if (!user) return <main className="merchant-login"><section className="login-card"><div className="logo-mark">♻</div><p className="eyebrow">WASTEREWARD GREEN PARTNER</p><h1>Partner counter</h1><p className="login-copy">Sign in with the Google email registered by WasteReward to redeem member offers.</p><button className="google-btn" onClick={() => supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/merchant` } })}><span className="google-g">G</span>Continue with Google</button><Link className="login-home-link" href="/">← WasteReward website</Link></section></main>;
  if (loading) return <div className="loading">Opening Green Partner counter…</div>;
  if (!data) return <main className="merchant-login"><section className="login-card"><div className="logo-mark">!</div><p className="eyebrow">PARTNER ACCESS</p><h1>Account not ready</h1><p className="login-copy">{error}</p><button className="google-btn" onClick={() => supabase!.auth.signOut()}>Use another Google account</button></section></main>;

  return <main className="merchant-page">
    <header className="merchant-header"><div><p className="eyebrow">WASTEREWARD GREEN PARTNER</p><h1>{data.merchant.name}</h1><p>{data.merchant.category}{data.merchant.locality ? ` · ${data.merchant.locality}` : ""}</p></div><div><span>{user.email}</span><button onClick={() => supabase!.auth.signOut()}>Sign out</button></div></header>
    <section className="merchant-stats"><article><span>✓</span><div><small>REDEEMED TODAY</small><strong>{redeemedToday}</strong></div></article><article><span>₹</span><div><small>BILLS SERVED TODAY</small><strong>{money(fundedToday)}</strong></div></article><article><span>♻</span><div><small>ACTIVE OFFERS</small><strong>{data.offers.filter((item) => item.is_active).length}</strong></div></article></section>
    <section className="merchant-grid"><form className="merchant-redeem" onSubmit={redeem}><p className="eyebrow">REDEEM GREEN PASS</p><h2>Enter member offer code</h2><p>Ask the member to unlock the offer in their dashboard. The code remains valid for 15 minutes.</p><label>6-character code<input required maxLength={6} pattern="[A-Fa-f0-9]{6}" placeholder="A1B2C3" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ""))} /></label><label>Bill amount ₹<input required type="number" min="0" step="0.01" placeholder="250" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} /></label>{error && <p className="admin-notice error" role="alert">{error}</p>}{success && <p className="admin-notice success" role="status">{success}</p>}<button disabled={busy}>{busy ? "Checking…" : "Verify and redeem"}</button><small>Each code works once. Confirm the member’s minimum bill before applying the saving.</small></form>
      <div className="merchant-side"><section><p className="eyebrow">YOUR OFFERS</p><h2>Currently published</h2>{data.offers.length ? data.offers.map((offer) => { const campaign = one(offer.sponsor_campaigns); return <article className="merchant-offer-row" key={offer.id}><div><strong>{offer.title}</strong><small>Save {money(offer.discount_amount)} · Min. bill {money(offer.min_purchase)}</small></div><span className={`funding-badge ${offer.funding_source}`}>{offer.funding_source === "sponsor" ? `Sponsored by ${one(campaign?.sponsors)?.name ?? "partner"}` : "Merchant funded"}</span></article>; }) : <p className="empty-state">No offers have been published.</p>}</section><section><p className="eyebrow">RECENT ACTIVITY</p><h2>Code history</h2>{data.redemptions.length ? data.redemptions.slice(0, 8).map((item) => <article className="merchant-redemption-row" key={item.id}><span className={`redemption-status ${item.status}`}>{item.status === "redeemed" ? "✓" : "↗"}</span><div><strong>{one(item.merchant_offers)?.title}</strong><small>{item.redemption_code} · {new Date(item.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small></div><b>{item.status}</b></article>) : <p className="empty-state">No member codes yet.</p>}</section></div>
    </section>
  </main>;
}
