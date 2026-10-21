"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { dateKeyInTimeZone } from "@/lib/date";

type Notice = { type: "error" | "success"; message: string } | null;
type PointHistory = { date: string; reason: string; points: number };
type HistoryResult = { id: string; name: string; points: number; history: PointHistory[] } | null;

const emptyFamily = {
  familyId: "", familyNumber: "", familyName: "", email: "", mobileNumber: "",
  alternateMobileNumber: "", familyLeaderName: "", familyLeaderMobile: "", totalMembers: "",
  houseNo: "", addressLine1: "", addressLine2: "", city: "", district: "",
  stateProvince: "", locality: "", country: "India", pinCode: "", referredBy: ""
};

async function adminFetch(path: string, options?: RequestInit) {
  const { data: { session } } = await supabase!.auth.getSession();
  if (!session) throw new Error("Please sign in again.");
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, ...options?.headers }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed.");
  return result;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [family, setFamily] = useState(emptyFamily);
  const todayKey = dateKeyInTimeZone();
  const [pointUpdate, setPointUpdate] = useState({ familyId: "", reason: "Daily waste collection", points: "5", status: "completed", date: todayKey });
  const [history, setHistory] = useState<HistoryResult>(null);
  const [claimCode, setClaimCode] = useState("");
  const [createdFamilyId, setCreatedFamilyId] = useState("");

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="loading">Loading admin panel…</div>;
  if (!supabaseConfigured) return <main className="setup-page"><section className="setup-card"><h1>Supabase setup required</h1><p className="login-copy">Add Supabase client and server credentials before using the admin panel.</p></section></main>;
  if (!user) return <main className="setup-page"><section className="setup-card"><div className="logo-mark">♻</div><p className="eyebrow">WASTEREWARD ADMIN</p><h1>Admin sign in</h1><p className="login-copy">Use a Google account listed in <code>ADMIN_EMAILS</code>.</p><button className="google-btn" onClick={() => supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/admin` } })}>Continue with Google</button></section></main>;

  const updateFamily = (key: keyof typeof family, value: string) => setFamily((current) => ({ ...current, [key]: value }));

  async function submitFamily(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setNotice(null);
    try {
      const result = await adminFetch("/api/admin/families", { method: "POST", body: JSON.stringify(family) });
      setClaimCode(result.claimCode);
      setCreatedFamilyId(result.familyId);
      setNotice({ type: "success", message: "Household created. Copy the one-time claim code below; it expires in 30 days." });
      setFamily(emptyFamily);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to create household." });
    } finally { setSaving(false); }
  }

  async function generateClaimCode() {
    const familyId = history?.id ?? pointUpdate.familyId;
    if (!familyId.trim()) { setNotice({ type: "error", message: "Look up an unclaimed household first." }); return; }
    setSaving(true); setNotice(null);
    try {
      const result = await adminFetch("/api/admin/claim-code", { method: "POST", body: JSON.stringify({ familyId }) });
      setClaimCode(result.claimCode);
      setCreatedFamilyId(familyId.trim().toUpperCase());
      setNotice({ type: "success", message: "A new one-time claim code was generated and will expire in 30 days." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to generate a claim code." });
    } finally { setSaving(false); }
  }

  async function loadHistory(id = pointUpdate.familyId) {
    if (!id.trim()) { setNotice({ type: "error", message: "Enter a WasteReward ID to view its points." }); return; }
    setSaving(true); setNotice(null);
    try {
      const result = await adminFetch(`/api/admin/points?familyId=${encodeURIComponent(id.trim())}`);
      setHistory(result.family);
    } catch (error) {
      setHistory(null); setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load point history." });
    } finally { setSaving(false); }
  }

  async function submitPoints(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setNotice(null);
    try {
      await adminFetch("/api/admin/points", { method: "POST", body: JSON.stringify(pointUpdate) });
      await loadHistory(pointUpdate.familyId);
      setNotice({ type: "success", message: "Daily entry saved. Any earlier entry for this family and date was replaced." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to update points." });
    } finally { setSaving(false); }
  }

  function changeStatus(status: string) {
    setPointUpdate((current) => ({
      ...current,
      status,
      points: status === "completed" ? (current.points === "0" ? "5" : current.points) : "0",
      reason: status === "green_pause" ? "Green Pause used" : status === "missed" ? "Collection missed" : "Daily waste collection"
    }));
  }

  return (
    <main className="admin-page">
      <header className="admin-header"><div><p className="eyebrow">WASTEREWARD</p><h1>Admin panel</h1></div><div><span>{user.email}</span><button className="logout-btn" onClick={() => supabase!.auth.signOut()}>Sign out</button></div></header>
      {notice && <p className={`admin-notice ${notice.type}`}>{notice.message}</p>}
      {claimCode && <section className="admin-claim-code" role="status"><span>HOUSEHOLD {createdFamilyId ? `· ${createdFamilyId}` : ""}</span><strong>{claimCode}</strong><button type="button" onClick={() => navigator.clipboard.writeText(`${createdFamilyId ? `${createdFamilyId} · ` : ""}${claimCode}`)}>Copy details</button><small>Share this WasteReward ID and one-time claim code securely. The code expires in 30 days.</small></section>}
      <section className="admin-stack">
        <form className="panel admin-form" onSubmit={submitFamily}>
          <p className="eyebrow">CREATE FAMILY</p><h2>Create a member household</h2>
          <fieldset><legend>Family & contact details</legend><div className="form-grid">
            <label className="field-label">WasteReward ID (optional)<input placeholder="Auto-generated if blank" value={family.familyId} onChange={(e) => updateFamily("familyId", e.target.value)} /></label>
            <label className="field-label">Family number (optional)<input placeholder="Auto-generated if blank" value={family.familyNumber} onChange={(e) => updateFamily("familyNumber", e.target.value)} /></label>
            <label className="field-label">Family name<input required value={family.familyName} onChange={(e) => updateFamily("familyName", e.target.value)} /></label>
            <label className="field-label">Email ID (optional)<input type="email" value={family.email} onChange={(e) => updateFamily("email", e.target.value)} /></label>
            <label className="field-label">Mobile / WhatsApp<input required type="tel" value={family.mobileNumber} onChange={(e) => updateFamily("mobileNumber", e.target.value)} /></label>
            <label className="field-label">Alternate mobile (optional)<input type="tel" value={family.alternateMobileNumber} onChange={(e) => updateFamily("alternateMobileNumber", e.target.value)} /></label>
            <label className="field-label">Family leader name (optional)<input value={family.familyLeaderName} onChange={(e) => updateFamily("familyLeaderName", e.target.value)} /></label>
            <label className="field-label">Family leader mobile (optional)<input type="tel" value={family.familyLeaderMobile} onChange={(e) => updateFamily("familyLeaderMobile", e.target.value)} /></label>
            <label className="field-label">Total members (optional)<input type="number" min="1" step="1" value={family.totalMembers} onChange={(e) => updateFamily("totalMembers", e.target.value)} /></label>
            <label className="field-label">Referred by ID (optional)<input placeholder="e.g. WR001" value={family.referredBy} onChange={(e) => updateFamily("referredBy", e.target.value)} /></label>
          </div></fieldset>
          <fieldset><legend>Address details</legend><div className="form-grid">
            <label className="field-label">House number<input required value={family.houseNo} onChange={(e) => updateFamily("houseNo", e.target.value)} /></label>
            <label className="field-label">Address line 1 (optional)<input value={family.addressLine1} onChange={(e) => updateFamily("addressLine1", e.target.value)} /></label>
            <label className="field-label full-field">Address line 2 (optional)<input value={family.addressLine2} onChange={(e) => updateFamily("addressLine2", e.target.value)} /></label>
            <label className="field-label">City (optional)<input value={family.city} onChange={(e) => updateFamily("city", e.target.value)} /></label>
            <label className="field-label">District (optional)<input value={family.district} onChange={(e) => updateFamily("district", e.target.value)} /></label>
            <label className="field-label">State / Province (optional)<input value={family.stateProvince} onChange={(e) => updateFamily("stateProvince", e.target.value)} /></label>
            <label className="field-label">Locality / Landmark (optional)<input value={family.locality} onChange={(e) => updateFamily("locality", e.target.value)} /></label>
            <label className="field-label">Country (optional)<input value={family.country} onChange={(e) => updateFamily("country", e.target.value)} /></label>
            <label className="field-label">PIN code (optional)<input inputMode="numeric" value={family.pinCode} onChange={(e) => updateFamily("pinCode", e.target.value)} /></label>
          </div></fieldset>
          <button className="primary-action" type="submit" disabled={saving}>Create family</button>
        </form>

        <section className="admin-points-grid">
          <form className="panel admin-form" onSubmit={submitPoints}>
            <p className="eyebrow">REWARD POINTS</p><h2>Save daily points</h2>
            <label className="field-label">WasteReward ID<div className="input-action"><input required value={pointUpdate.familyId} onChange={(e) => setPointUpdate({ ...pointUpdate, familyId: e.target.value })} /><button type="button" onClick={() => loadHistory()} disabled={saving}>Check history</button></div></label>
            <label className="field-label">Day status<select value={pointUpdate.status} onChange={(e) => changeStatus(e.target.value)}><option value="completed">Completed</option><option value="missed">Missed (0 points)</option><option value="green_pause">Green Pause (0 points)</option></select></label>
            <label className="field-label">Reason<input required value={pointUpdate.reason} onChange={(e) => setPointUpdate({ ...pointUpdate, reason: e.target.value })} /></label>
            <label className="field-label">Points<input required type="number" min={pointUpdate.status === "completed" ? 1 : 0} step="1" disabled={pointUpdate.status !== "completed"} value={pointUpdate.points} onChange={(e) => setPointUpdate({ ...pointUpdate, points: e.target.value })} /></label>
            <label className="field-label">Date<input required type="date" max={todayKey} value={pointUpdate.date} onChange={(e) => setPointUpdate({ ...pointUpdate, date: e.target.value })} /></label>
            <p className="form-help">Saving the same family and date replaces the previous entry and adjusts the total by the difference.</p>
            <button className="primary-action" type="submit" disabled={saving}>Save daily entry</button>
          </form>

          <article className="panel history-panel admin-history">
            <p className="eyebrow">DAY-BY-DAY HISTORY</p>
            <h2>{history ? history.name : "Look up a family"}</h2>
            {history ? <><div className="admin-total"><span>Total points</span><strong>{history.points}</strong></div><button className="secondary-action" type="button" onClick={generateClaimCode} disabled={saving}>Generate new claim code</button><div className="history-list">{history.history.length ? history.history.map((item) => <div className="history-row" key={item.date}><div><strong>{item.reason}</strong><span>{formatDate(item.date)}</span></div><b className={item.points < 0 ? "negative" : ""}>{item.points > 0 ? "+" : ""}{item.points}</b></div>) : <p className="empty-state">No point entries yet.</p>}</div></> : <p className="empty-state">Enter a WasteReward ID and select “Check history” to review its current total and daily entries.</p>}
          </article>
        </section>
      </section>
    </main>
  );
}
