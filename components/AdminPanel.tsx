"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { useEffect } from "react";

type Notice = { type: "error" | "success"; message: string } | null;

async function adminRequest(path: string, user: User, body: Record<string, unknown>) {
  const { data: { session } } = await supabase!.auth.getSession();
  if (!session) throw new Error("Please sign in again.");
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed.");
}

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [family, setFamily] = useState({ uid: "", familyId: "", familyName: "", houseNo: "" });
  const [pointUpdate, setPointUpdate] = useState({ uid: "", reason: "Manual points update", points: "5", date: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="loading">Loading admin panel…</div>;
  if (!supabaseConfigured) return <main className="setup-page"><section className="setup-card"><h1>Supabase setup required</h1><p className="login-copy">Add Supabase client and server credentials before using the admin panel.</p></section></main>;
  if (!user) return <main className="setup-page"><section className="setup-card"><div className="logo-mark">♻</div><p className="eyebrow">WASTEREWARD ADMIN</p><h1>Admin sign in</h1><p className="login-copy">Use a Google account listed in <code>ADMIN_EMAILS</code>.</p><button className="google-btn" onClick={() => supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/admin` } })}>Continue with Google</button></section></main>;

  async function submitFamily(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    try {
      await adminRequest("/api/admin/families", user, family);
      setNotice({ type: "success", message: "Household created. The member can now sign in and view their dashboard." });
      setFamily({ uid: "", familyId: "", familyName: "", houseNo: "" });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to create household." });
    }
  }

  async function submitPoints(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    try {
      await adminRequest("/api/admin/points", user, { ...pointUpdate, familyId: pointUpdate.uid });
      setNotice({ type: "success", message: "Points updated successfully." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to update points." });
    }
  }

  return <main className="admin-page"><header className="admin-header"><div><p className="eyebrow">WASTEREWARD</p><h1>Admin panel</h1></div><div><span>{user.email}</span><button className="logout-btn" onClick={() => supabase!.auth.signOut()}>Sign out</button></div></header><section className="admin-grid">{notice && <p className={`admin-notice ${notice.type}`}>{notice.message}</p>}<form className="panel admin-form" onSubmit={submitFamily}><p className="eyebrow">CREATE FAMILY</p><h2>Create a member household</h2><label className="field-label">WasteReward ID<input required placeholder="e.g. WR101" value={family.familyId} onChange={(e) => setFamily({ ...family, familyId: e.target.value })} /></label><label className="field-label">Family name<input required value={family.familyName} onChange={(e) => setFamily({ ...family, familyName: e.target.value })} /></label><label className="field-label">House number<input required value={family.houseNo} onChange={(e) => setFamily({ ...family, houseNo: e.target.value })} /></label><button className="primary-action" type="submit">Create family</button></form><form className="panel admin-form" onSubmit={submitPoints}><p className="eyebrow">REWARD POINTS</p><h2>Update points manually</h2><label className="field-label">WasteReward ID<input required value={pointUpdate.uid} onChange={(e) => setPointUpdate({ ...pointUpdate, uid: e.target.value })} /></label><label className="field-label">Reason<input required value={pointUpdate.reason} onChange={(e) => setPointUpdate({ ...pointUpdate, reason: e.target.value })} /></label><label className="field-label">Points (use a negative number to deduct)<input required type="number" step="1" value={pointUpdate.points} onChange={(e) => setPointUpdate({ ...pointUpdate, points: e.target.value })} /></label><label className="field-label">Date<input required type="date" value={pointUpdate.date} onChange={(e) => setPointUpdate({ ...pointUpdate, date: e.target.value })} /></label><button className="primary-action" type="submit">Save point update</button></form></section></main>;
}
