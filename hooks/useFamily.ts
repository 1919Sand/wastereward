"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { demoFamilies, type FamilyData } from "@/lib/demo-data";
import { supabase, supabaseConfigured } from "@/lib/supabase";

function toFamily(row: Record<string, unknown>): FamilyData {
  return {
    id: row.waste_reward_id as string,
    familyName: row.family_name as string,
    familyNumber: (row.family_number as string) ?? "F1",
    email: (row.email as string) ?? "",
    mobileNumber: (row.mobile_number as string) ?? "",
    alternateMobileNumber: (row.alternate_mobile_number as string) ?? "",
    familyLeaderName: (row.family_leader_name as string) ?? (row.family_name as string),
    familyLeaderMobile: (row.family_leader_mobile as string) ?? "",
    totalMembers: (row.total_members as number | null) ?? null,
    houseNo: row.house_no as string,
    addressLine1: (row.address_line_1 as string) ?? (row.house_no as string),
    addressLine2: (row.address_line_2 as string) ?? "",
    city: (row.city as string) ?? "",
    district: (row.district as string) ?? "",
    stateProvince: (row.state_province as string) ?? "",
    locality: (row.locality as string) ?? "",
    country: (row.country as string) ?? "India",
    pinCode: (row.pin_code as string) ?? "",
    society: (row.society as string) ?? "WasteReward Community",
    points: row.points as number,
    currentStreak: row.current_streak as number,
    bestStreak: row.best_streak as number,
    rank: row.rank as number,
    nextReward: (row.next_reward as FamilyData["nextReward"]) ?? { name: "Mystery Reward", pointsRequired: 200 },
    history: ((row.point_transactions as FamilyData["history"]) ?? []).sort((a, b) => b.date.localeCompare(a.date)),
    days: (row.days as FamilyData["days"]) ?? {},
    greenPauseDays: (row.green_pause_days as number) ?? 4,
    referralGreenPauseDays: (row.referral_green_pause_days as number) ?? 0,
    referrals: (row.referrals as FamilyData["referrals"]) ?? [],
    nearbyFamilies: (row.nearby_families as FamilyData["nearbyFamilies"]) ?? []
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
        const { data: { session } } = await client.auth.getSession();
        const response = session ? await fetch("/api/families/profile", {
          headers: { Authorization: `Bearer ${session.access_token}` }
        }) : null;
        const result = response?.ok ? await response.json() : null;
        if (result?.family) {
          const nextFamily = toFamily(result.family);
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
    const profileResponse = await fetch("/api/families/profile", {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const profileResult = profileResponse.ok ? await profileResponse.json() : null;
    const nextFamily = toFamily(profileResult?.family ?? result.family);
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
