"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { demoFamilies, type FamilyData } from "@/lib/demo-data";
import { supabase, supabaseConfigured } from "@/lib/supabase";

function toFamily(row: Record<string, unknown>): FamilyData {
  return {
    id: row.waste_reward_id as string,
    familyName: row.family_name as string,
    houseNo: row.house_no as string,
    society: (row.society as string) ?? "WasteReward Community",
    points: row.points as number,
    currentStreak: row.current_streak as number,
    bestStreak: row.best_streak as number,
    rank: row.rank as number,
    nextReward: (row.next_reward as FamilyData["nextReward"]) ?? { name: "Mystery Reward", pointsRequired: 200 },
    history: ((row.point_transactions as FamilyData["history"]) ?? []).sort((a, b) => b.date.localeCompare(a.date)),
    days: (row.days as FamilyData["days"]) ?? {}
  };
}

export function useFamily() {
  const [user, setUser] = useState<User | null>(null);
  const [families, setFamilies] = useState<FamilyData[]>(supabaseConfigured ? [] : demoFamilies);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>(demoFamilies[0]?.id ?? "");
  const [loading, setLoading] = useState(supabaseConfigured);

  const family = useMemo(
    () => families.find((entry) => entry.id === selectedFamilyId) ?? families[0] ?? demoFamilies[0],
    [families, selectedFamilyId]
  );

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }

    const loadFamily = async (currentUser: User | null) => {
      setUser(currentUser);
      setFamilies([]);
      setSelectedFamilyId("");
      if (currentUser) {
        const { data } = await client.from("families").select("*, point_transactions(date, reason, points)").eq("user_id", currentUser.id).maybeSingle();
        if (data) {
          const nextFamily = toFamily(data);
          setFamilies([nextFamily]);
          setSelectedFamilyId(nextFamily.id);
        }
      }
      setLoading(false);
    };

    client.auth.getUser().then(({ data }) => loadFamily(data.user));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => loadFamily(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function login() {
    if (!supabase) {
      throw new Error("Supabase is not configured. Add the public Supabase URL and key to .env.local.");
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` }
    });

    if (error) throw error;
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
  }

  async function claimHousehold(wasteRewardId: string, houseNo: string) {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Please sign in again.");
    const response = await fetch("/api/families/claim", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ wasteRewardId, houseNo })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Unable to link household.");
    const nextFamily = toFamily(result.family);
    setFamilies([nextFamily]);
    setSelectedFamilyId(nextFamily.id);
  }

  return {
    user,
    family,
    families,
    selectedFamilyId,
    setSelectedFamilyId,
    loading,
    login,
    logout,
    claimHousehold,
    needsHousehold: supabaseConfigured && Boolean(user) && families.length === 0,
    demoMode: !supabaseConfigured
  };
}
