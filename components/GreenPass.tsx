"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { FamilyData } from "@/lib/demo-data";
import { supabase } from "@/lib/supabase";
import { dateKeyInTimeZone } from "@/lib/date";

type GreenOffer = {
  id: string;
  title: string;
  description: string;
  pointsRequired: number;
  minPurchase: number | string;
  discountAmount: number | string;
  validUntil: string | null;
  fundingSource?: "merchant" | "sponsor";
  sponsor?: { name: string; campaign?: string } | null;
  merchant: { name: string; category: string; address: string; locality: string; city: string; pinCode: string } | null;
};

type Redemption = {
  id: string;
  redemption_code: string;
  status: string;
  expires_at: string;
  created_at: string;
  offerTitle?: string;
  merchantName?: string;
  merchant_offers?: { title?: string; merchant_partners?: { name?: string } | null } | null;
};

const demoOffers: GreenOffer[] = [
  { id: "demo-grocery", title: "₹10 off daily essentials", description: "Valid on a minimum purchase of ₹250.", pointsRequired: 100, minPurchase: 250, discountAmount: 10, validUntil: null, merchant: { name: "Green Basket Grocery", category: "Grocery", address: "12 Market Lane", locality: "Green Avenue", city: "New Delhi", pinCode: "110001" } },
  { id: "demo-bag", title: "Reusable shopping bag", description: "One complimentary cloth bag with a ₹400 purchase.", pointsRequired: 75, minPurchase: 400, discountAmount: 0, validUntil: null, merchant: { name: "Family Needs Store", category: "Household essentials", address: "8 Community Market", locality: "Green Avenue", city: "New Delhi", pinCode: "110001" } },
  { id: "demo-care", title: "₹15 wellness saving", description: "Save on eligible personal-care essentials above ₹350.", pointsRequired: 150, minPurchase: 350, discountAmount: 15, validUntil: null, merchant: { name: "Neighbourhood Care", category: "Pharmacy", address: "4 Main Road", locality: "Green Avenue", city: "New Delhi", pinCode: "110001" } }
];

function money(value: number | string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));
}

function tierFor(points: number) {
  if (points >= 500) return { name: "Champion", className: "champion", next: null };
  if (points >= 150) return { name: "Leaf", className: "leaf", next: 500 };
  return { name: "Seed", className: "seed", next: 150 };
}

export default function GreenPass({ family, demoMode }: { family: FamilyData; demoMode: boolean }) {
  const [offers, setOffers] = useState<GreenOffer[]>(demoMode ? demoOffers : []);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState("");
  const [passOpen, setPassOpen] = useState(false);
  const [redeemingId, setRedeemingId] = useState("");
  const [activeRedemption, setActiveRedemption] = useState<Redemption | null>(null);
  const tier = useMemo(() => tierFor(family.points), [family.points]);
  const qrValue = `WASTEREWARD:GREEN-PASS:${family.id}`;
  const verifiedThisMonth = useMemo(() => {
    const month = dateKeyInTimeZone().slice(0, 7);
    return Object.entries(family.days).filter(([date, status]) => date.startsWith(month) && (status === "completed" || status === "green_pause")).length;
  }, [family.days]);

  const loadGreenPass = useCallback(async () => {
    if (demoMode || !supabase) return;
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const response = await fetch("/api/green-pass", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to load Green Pass offers.");
      setOffers(result.offers ?? []);
      setRedemptions(result.redemptions ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Green Pass offers.");
    } finally {
      setLoading(false);
    }
  }, [demoMode]);

  useEffect(() => { void loadGreenPass(); }, [loadGreenPass, family.id]);
  useEffect(() => {
    if (!passOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setPassOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [passOpen]);

  async function unlockOffer(offer: GreenOffer) {
    if (demoMode) {
      setActiveRedemption({ id: `demo-${offer.id}`, redemption_code: "GREEN10", status: "issued", expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), created_at: new Date().toISOString(), offerTitle: offer.title, merchantName: offer.merchant?.name });
      return;
    }
    setRedeemingId(offer.id);
    setError("");
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const response = await fetch("/api/green-pass", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ offerId: offer.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to unlock this offer.");
      setActiveRedemption(result.redemption);
      await loadGreenPass();
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : "Unable to unlock this offer.");
    } finally {
      setRedeemingId("");
    }
  }

  return (
    <section className="green-pass-section" aria-labelledby="green-pass-title">
      <div className="green-pass-card-wrap">
        <article className="green-pass-card">
          <div className="green-pass-orbit pass-orbit-one" /><div className="green-pass-orbit pass-orbit-two" />
          <div className="green-pass-card-top"><div><span className="green-pass-leaf">♻</span><strong>WASTEREWARD</strong></div><span className={`green-tier ${tier.className}`}>{tier.name} tier</span></div>
          <div className="green-pass-title-row"><div><small>GREEN PASS</small><h2 id="green-pass-title">{family.familyName}</h2><p>{family.id} · {family.familyNumber}</p></div><button type="button" className="green-pass-qr-button" onClick={() => setPassOpen(true)} aria-label="Show full-screen Green Pass QR code"><QRCodeSVG value={qrValue} size={62} marginSize={1} fgColor="#09251b" /><span>Show QR</span></button></div>
          <div className="green-pass-card-bottom"><div><small>GREEN POINTS</small><strong>{family.points}</strong></div><div><small>VERIFIED THIS MONTH</small><strong>{verifiedThisMonth} days</strong></div><div><small>STREAK</small><strong>{family.currentStreak} days</strong></div></div>
          <p className="green-pass-disclaimer">Rewards membership · Not a bank or payment card</p>
        </article>
        <div className="green-pass-summary">
          <p className="eyebrow">YOUR MEMBERSHIP</p>
          <h2>Good habits now unlock local value.</h2>
          <p>Show your Green Pass at participating neighbourhood shops. Pay normally by UPI or cash; the pass only unlocks eligible rewards.</p>
          {tier.next ? <div className="tier-progress"><span><b>{tier.next - family.points} points</b> to {tier.next === 150 ? "Leaf" : "Champion"}</span><div><i style={{ width: `${Math.min(100, tier.next === 150 ? family.points / 1.5 : ((family.points - 150) / 350) * 100)}%` }} /></div></div> : <div className="tier-complete">★ Highest Green Pass tier unlocked</div>}
          <div className="green-pass-trust"><span>✓ Verified activity</span><span>✓ Capped offers</span><span>✓ No stored money</span></div>
        </div>
      </div>

      <div className="green-benefits-grid">
        <div className="green-offers-panel">
          <div className="panel-heading"><div><p className="eyebrow">GREEN PARTNERS</p><h2>Nearby everyday savings</h2></div><span className="partner-count">{offers.length} offers</span></div>
          {loading ? <p className="green-pass-empty">Finding Green Partners near you…</p> : offers.length ? <div className="green-offer-list">{offers.map((offer) => {
            const eligible = family.points >= offer.pointsRequired;
            return <article className="green-offer" key={offer.id}><div className="merchant-icon" aria-hidden="true">{offer.merchant?.category === "Pharmacy" ? "+" : offer.merchant?.category === "Grocery" ? "▣" : "♻"}</div><div className="green-offer-copy"><span>{offer.merchant?.category ?? "Green Partner"}</span><h3>{offer.title}</h3><p>{offer.description}</p><small>{offer.merchant?.name}{offer.merchant?.locality ? ` · ${offer.merchant.locality}` : ""}</small>{offer.sponsor && <strong className="offer-sponsor">Sponsored by {offer.sponsor.name}</strong>}{Number(offer.minPurchase) > 0 && <em>Minimum purchase {money(offer.minPurchase)}</em>}</div><div className="offer-action"><b>{offer.pointsRequired} pts</b><button type="button" onClick={() => unlockOffer(offer)} disabled={!eligible || redeemingId === offer.id}>{redeemingId === offer.id ? "Unlocking…" : eligible ? "Get offer" : `${offer.pointsRequired - family.points} to go`}</button></div></article>;
          })}</div> : <div className="green-pass-empty"><strong>Green Partners are coming to your area.</strong><span>We’ll show local grocery, pharmacy and household offers here as partners join.</span></div>}
          {error && <p className="form-error green-pass-error" role="alert">{error}</p>}
        </div>

        <aside className="green-activity-panel">
          <p className="eyebrow">PASS ACTIVITY</p><h2>Recent benefits</h2>
          {redemptions.length ? <div className="pass-activity-list">{redemptions.map((item) => <div key={item.id}><span className={`redemption-status ${item.status}`}>{item.status === "redeemed" ? "✓" : "↗"}</span><p><strong>{item.offerTitle ?? item.merchant_offers?.title ?? "Green Partner offer"}</strong><small>{item.merchantName ?? item.merchant_offers?.merchant_partners?.name ?? "WasteReward partner"} · {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small></p><b>{item.status}</b></div>)}</div> : <div className="green-pass-empty compact"><strong>No offers used yet</strong><span>Your unlocked Green Partner benefits will appear here.</span></div>}
          <div className="verified-points-note"><span>✓</span><div><strong>{family.points} verified points</strong><p>Points appear after WasteReward verifies your activity. They are loyalty points and cannot be withdrawn as cash.</p></div></div>
        </aside>
      </div>

      {passOpen && <div className="pass-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPassOpen(false); }}><section className="pass-modal" role="dialog" aria-modal="true" aria-labelledby="pass-modal-title"><button className="pass-modal-close" type="button" onClick={() => setPassOpen(false)} aria-label="Close Green Pass">×</button><span className="pass-modal-mark">♻</span><p className="eyebrow">WASTEREWARD GREEN PASS</p><h2 id="pass-modal-title">{family.familyName}</h2><p>{family.id} · {tier.name} tier · {family.points} points</p><div className="pass-modal-qr"><QRCodeSVG value={qrValue} size={230} marginSize={3} fgColor="#09251b" /></div><strong>Show this QR to a Green Partner</strong><small>The shop will confirm your eligible offer. Continue paying normally by UPI or cash.</small></section></div>}

      {activeRedemption && <div className="pass-modal-backdrop" role="presentation"><section className="pass-modal redemption-modal" role="dialog" aria-modal="true" aria-labelledby="redemption-title"><button className="pass-modal-close" type="button" onClick={() => setActiveRedemption(null)} aria-label="Close offer">×</button><span className="pass-modal-mark">✓</span><p className="eyebrow">OFFER READY</p><h2 id="redemption-title">{activeRedemption.offerTitle}</h2><p>{activeRedemption.merchantName}</p><div className="redemption-code"><span>SHOW THIS CODE</span><strong>{activeRedemption.redemption_code}</strong></div><strong>Valid for 15 minutes</strong><small>Show the code at checkout and pay the remaining bill normally. Points are an eligibility score and are not cash.</small></section></div>}
    </section>
  );
}
