"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { dateKeyInTimeZone } from "@/lib/date";

type Merchant = { id: string; name: string; category: string; partnership_status: string; merchant_users?: { email: string }[] };
type Sponsor = { id: string; name: string };
type Campaign = { id: string; title: string; budget_amount: number | string; max_redemptions: number; spent: number; claims: number; status: string; sponsors?: { name?: string } | { name?: string }[] };
type Offer = { id: string; title: string; funding_source: string; is_active: boolean; merchant_partners?: { name?: string } | { name?: string }[]; sponsor_campaigns?: { title?: string; sponsors?: { name?: string } | { name?: string }[] } | { title?: string; sponsors?: { name?: string } | { name?: string }[] }[] };

const one = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value;
const money = (value: number | string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));

async function programmeFetch(options?: RequestInit) {
  const { data: { session } } = await supabase!.auth.getSession();
  if (!session) throw new Error("Please sign in again.");
  const response = await fetch("/api/admin/green-program", { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, ...options?.headers }, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed.");
  return result;
}

export default function GreenProgramAdmin() {
  const today = dateKeyInTimeZone();
  const defaultEnd = `${today.slice(0, 4)}-12-31`;
  const [data, setData] = useState<{ merchants: Merchant[]; sponsors: Sponsor[]; campaigns: Campaign[]; offers: Offer[] }>({ merchants: [], sponsors: [], campaigns: [], offers: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [merchant, setMerchant] = useState({ name: "", category: "Grocery", contactName: "", contactEmail: "", contactPhone: "", address: "", locality: "", city: "", stateProvince: "", pinCode: "" });
  const [sponsor, setSponsor] = useState({ name: "", description: "", websiteUrl: "", contactName: "", contactEmail: "" });
  const [campaign, setCampaign] = useState({ sponsorId: "", title: "", description: "", budgetAmount: "5000", maxRedemptions: "100", startsOn: today, endsOn: defaultEnd });
  const [offer, setOffer] = useState({ merchantId: "", sponsorCampaignId: "", title: "", description: "", pointsRequired: "100", minPurchase: "250", discountAmount: "10", usageLimit: "1", validFrom: today, validUntil: defaultEnd });

  const load = useCallback(async () => {
    try { setData(await programmeFetch()); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load programme."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(action: string, payload: object, reset: () => void) {
    setBusy(true); setMessage("");
    try {
      await programmeFetch({ method: "POST", body: JSON.stringify({ action, ...payload }) });
      reset(); await load(); setMessage("Saved successfully.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save."); }
    finally { setBusy(false); }
  }

  return <section className="panel green-program-admin">
    <div className="programme-heading"><div><p className="eyebrow">GREEN PARTNER PROGRAMME</p><h2>Merchants and sponsor-funded rewards</h2><p>Onboard neighbourhood shops, assign Google access, and cap every sponsored campaign by rupees and claims.</p></div><div className="programme-stats"><span><b>{data.merchants.length}</b> partners</span><span><b>{data.campaigns.length}</b> campaigns</span><span><b>{data.offers.length}</b> offers</span></div></div>
    {message && <p className={message === "Saved successfully." ? "admin-notice success" : "admin-notice error"} role="status">{message}</p>}
    <div className="programme-forms">
      <form className="programme-form" onSubmit={(event) => { event.preventDefault(); void submit("createMerchant", merchant, () => setMerchant({ name: "", category: "Grocery", contactName: "", contactEmail: "", contactPhone: "", address: "", locality: "", city: "", stateProvince: "", pinCode: "" })); }}>
        <span className="programme-step">01</span><h3>Add Green Partner</h3><p>The merchant signs in at <b>/merchant</b> using this Google email.</p>
        <label className="field-label">Shop name<input required value={merchant.name} onChange={(e) => setMerchant({ ...merchant, name: e.target.value })} /></label>
        <div className="form-grid"><label className="field-label">Category<select value={merchant.category} onChange={(e) => setMerchant({ ...merchant, category: e.target.value })}><option>Grocery</option><option>Pharmacy</option><option>Household essentials</option><option>Other</option></select></label><label className="field-label">Google email<input required type="email" value={merchant.contactEmail} onChange={(e) => setMerchant({ ...merchant, contactEmail: e.target.value })} /></label></div>
        <div className="form-grid"><label className="field-label">Contact name<input value={merchant.contactName} onChange={(e) => setMerchant({ ...merchant, contactName: e.target.value })} /></label><label className="field-label">Phone<input value={merchant.contactPhone} onChange={(e) => setMerchant({ ...merchant, contactPhone: e.target.value })} /></label></div>
        <label className="field-label">Shop address<input value={merchant.address} onChange={(e) => setMerchant({ ...merchant, address: e.target.value })} /></label>
        <div className="form-grid"><label className="field-label">Locality<input value={merchant.locality} onChange={(e) => setMerchant({ ...merchant, locality: e.target.value })} /></label><label className="field-label">City<input value={merchant.city} onChange={(e) => setMerchant({ ...merchant, city: e.target.value })} /></label></div>
        <label className="field-label">PIN code<input value={merchant.pinCode} onChange={(e) => setMerchant({ ...merchant, pinCode: e.target.value })} /></label><button className="primary-action" disabled={busy}>Add partner</button>
      </form>

      <form className="programme-form" onSubmit={(event) => { event.preventDefault(); void submit("createSponsor", sponsor, () => setSponsor({ name: "", description: "", websiteUrl: "", contactName: "", contactEmail: "" })); }}>
        <span className="programme-step">02</span><h3>Add reward sponsor</h3><p>For CSR, brand, apartment, or institution-funded benefits.</p>
        <label className="field-label">Sponsor name<input required value={sponsor.name} onChange={(e) => setSponsor({ ...sponsor, name: e.target.value })} /></label><label className="field-label">Description<input value={sponsor.description} onChange={(e) => setSponsor({ ...sponsor, description: e.target.value })} /></label><label className="field-label">Website<input type="url" value={sponsor.websiteUrl} onChange={(e) => setSponsor({ ...sponsor, websiteUrl: e.target.value })} /></label>
        <div className="form-grid"><label className="field-label">Contact name<input value={sponsor.contactName} onChange={(e) => setSponsor({ ...sponsor, contactName: e.target.value })} /></label><label className="field-label">Contact email<input type="email" value={sponsor.contactEmail} onChange={(e) => setSponsor({ ...sponsor, contactEmail: e.target.value })} /></label></div><button className="primary-action" disabled={busy}>Add sponsor</button>
      </form>

      <form className="programme-form" onSubmit={(event) => { event.preventDefault(); void submit("createCampaign", campaign, () => setCampaign({ ...campaign, title: "", description: "" })); }}>
        <span className="programme-step">03</span><h3>Fund a campaign</h3><p>Budget is reserved only when a member generates a live offer code.</p>
        <label className="field-label">Sponsor<select required value={campaign.sponsorId} onChange={(e) => setCampaign({ ...campaign, sponsorId: e.target.value })}><option value="">Select sponsor</option>{data.sponsors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field-label">Campaign title<input required value={campaign.title} onChange={(e) => setCampaign({ ...campaign, title: e.target.value })} /></label>
        <div className="form-grid"><label className="field-label">Budget ₹<input required type="number" min="1" value={campaign.budgetAmount} onChange={(e) => setCampaign({ ...campaign, budgetAmount: e.target.value })} /></label><label className="field-label">Maximum claims<input required type="number" min="1" value={campaign.maxRedemptions} onChange={(e) => setCampaign({ ...campaign, maxRedemptions: e.target.value })} /></label></div><div className="form-grid"><label className="field-label">Starts<input type="date" value={campaign.startsOn} onChange={(e) => setCampaign({ ...campaign, startsOn: e.target.value })} /></label><label className="field-label">Ends<input required type="date" min={campaign.startsOn} value={campaign.endsOn} onChange={(e) => setCampaign({ ...campaign, endsOn: e.target.value })} /></label></div><button className="primary-action" disabled={busy || !data.sponsors.length}>Activate campaign</button>
      </form>

      <form className="programme-form" onSubmit={(event) => { event.preventDefault(); void submit("createOffer", offer, () => setOffer({ ...offer, title: "", description: "" })); }}>
        <span className="programme-step">04</span><h3>Publish member offer</h3><p>Leave campaign blank when the merchant funds the saving.</p>
        <label className="field-label">Redeeming merchant<select required value={offer.merchantId} onChange={(e) => setOffer({ ...offer, merchantId: e.target.value })}><option value="">Select partner</option>{data.merchants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field-label">Sponsor campaign (optional)<select value={offer.sponsorCampaignId} onChange={(e) => setOffer({ ...offer, sponsorCampaignId: e.target.value })}><option value="">Merchant funded</option>{data.campaigns.filter((item) => item.status === "active").map((item) => <option key={item.id} value={item.id}>{one(item.sponsors)?.name} · {item.title}</option>)}</select></label><label className="field-label">Offer title<input required value={offer.title} onChange={(e) => setOffer({ ...offer, title: e.target.value })} /></label><label className="field-label">Description<input value={offer.description} onChange={(e) => setOffer({ ...offer, description: e.target.value })} /></label>
        <div className="form-grid"><label className="field-label">Points required<input type="number" min="0" value={offer.pointsRequired} onChange={(e) => setOffer({ ...offer, pointsRequired: e.target.value })} /></label><label className="field-label">Saving ₹<input type="number" min="0" value={offer.discountAmount} onChange={(e) => setOffer({ ...offer, discountAmount: e.target.value })} /></label><label className="field-label">Minimum bill ₹<input type="number" min="0" value={offer.minPurchase} onChange={(e) => setOffer({ ...offer, minPurchase: e.target.value })} /></label><label className="field-label">Per-family limit<input type="number" min="1" value={offer.usageLimit} onChange={(e) => setOffer({ ...offer, usageLimit: e.target.value })} /></label></div><button className="primary-action" disabled={busy || !data.merchants.length}>Publish offer</button>
      </form>
    </div>
    <div className="programme-ledger"><div><h3>Campaign budget ledger</h3>{data.campaigns.length ? data.campaigns.map((item) => <article key={item.id}><div><strong>{item.title}</strong><small>{one(item.sponsors)?.name} · {item.claims}/{item.max_redemptions} claims</small></div><b>{money(item.spent)} / {money(item.budget_amount)}</b><progress max={Number(item.budget_amount)} value={item.spent} /></article>) : <p className="empty-state">No sponsor campaigns yet.</p>}</div><div><h3>Live partner offers</h3>{data.offers.length ? data.offers.map((item) => { const campaignItem = one(item.sponsor_campaigns); return <article key={item.id}><div><strong>{item.title}</strong><small>{one(item.merchant_partners)?.name}</small></div><span className={`funding-badge ${item.funding_source}`}>{item.funding_source === "sponsor" ? `Sponsored by ${one(campaignItem?.sponsors)?.name ?? "partner"}` : "Merchant funded"}</span></article>; }) : <p className="empty-state">No offers published yet.</p>}</div></div>
  </section>;
}
