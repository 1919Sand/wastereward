"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LoginCard from "./LoginCard";
import ReferralShare from "./ReferralShare";
import { useFamily } from "@/hooks/useFamily";
import { demoFamilies } from "@/lib/demo-data";
import { supabase } from "@/lib/supabase";
import { dateKeyInTimeZone } from "@/lib/date";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type LeaderboardScope = "nearby" | "city" | "state" | "india";
type LeaderboardEntry = {
  position: number;
  waste_reward_id: string;
  family_number: string;
  family_name: string;
  city: string;
  state_province: string;
  locality: string;
  monthly_points: number;
  is_current: boolean;
};

const leaderboardScopes: Array<{ value: LeaderboardScope; label: string }> = [
  { value: "nearby", label: "Nearby" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "india", label: "India" }
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}

function formatMonthYear(monthKey: string) {
  const [year, month] = monthKey.split("-");
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric"
  }).format(new Date(`${year}-${month}-01T00:00:00`));
}

export default function Dashboard() {
  const {
    user,
    family,
    loading,
    profileError,
    login,
    logout,
    refreshFamily,
    demoMode,
    claimHousehold,
    needsHousehold
  } = useFamily();

  const initialDate = useMemo(() => dateKeyInTimeZone(), []);
  const [selectedMonth, setSelectedMonth] = useState(() => initialDate.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [rewardOpen, setRewardOpen] = useState(true);
  const [familyIdInput, setFamilyIdInput] = useState("");
  const [claimCodeInput, setClaimCodeInput] = useState("");
  const [setupError, setSetupError] = useState("");
  const [leaderboardScope, setLeaderboardScope] = useState<LeaderboardScope>("nearby");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [nearbyMode, setNearbyMode] = useState<"pin" | "radius">("pin");
  const [locationUpdating, setLocationUpdating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationVersion, setLocationVersion] = useState(0);

  const todayKey = initialDate;

  const dayStatus = useCallback((date: string) => {
    const stored = family.days[date];
    if (stored && stored !== "future" && stored !== "pending") return stored;
    if (date < dateKeyInTimeZone(new Date(family.createdAt))) return "inactive";
    if (date < todayKey) return "missed";
    return date === todayKey && stored === "pending" ? "pending" : "future";
  }, [family.createdAt, family.days, todayKey]);

  const monthKeys = useMemo(() => {
    const keys = [...new Set([todayKey.slice(0, 7), ...Object.keys(family.days).map((date) => date.slice(0, 7))])];
    return keys.sort((a, b) => a.localeCompare(b));
  }, [family.days, todayKey]);

  useEffect(() => {
    if (monthKeys.length === 0) return;
    if (!monthKeys.includes(selectedMonth)) {
      setSelectedMonth(monthKeys[monthKeys.length - 1]);
    }
  }, [monthKeys, selectedMonth]);

  useEffect(() => {
    const availableDates = Object.keys(family.days)
      .filter((date) => date.startsWith(`${selectedMonth}-`))
      .sort();

    if (!availableDates.length) return;
    if (!selectedDate.startsWith(`${selectedMonth}-`)) {
      setSelectedDate(availableDates[0]);
    }
  }, [family.days, selectedDate, selectedMonth]);

  const progress = Math.min(
    100,
    Math.round((family.points / family.nextReward.pointsRequired) * 100)
  );

  const monthDates = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const total = new Date(year, month, 0).getDate();
    return Array.from({ length: total }, (_, index) => `${selectedMonth}-${String(index + 1).padStart(2, "0")}`);
  }, [selectedMonth]);

  const monthSummary = useMemo(() => {
    const statuses = monthDates.map(dayStatus);
    const completed = statuses.filter((status) => status === "completed").length;
    const pending = statuses.filter((status) => status === "pending" || status === "future").length;
    const missed = statuses.filter((status) => status === "missed").length;
    const greenPause = statuses.filter((status) => status === "green_pause").length;
    return { completed, pending, missed, greenPause };
  }, [dayStatus, monthDates]);

  const selectedMonthPoints = useMemo(
    () => family.history
      .filter((item) => item.date.startsWith(`${selectedMonth}-`))
      .reduce((total, item) => total + item.points, 0),
    [family.history, selectedMonth]
  );

  const previousMonthSummary = useMemo(() => {
    const index = monthKeys.indexOf(selectedMonth);
    const key = index > 0 ? monthKeys[index - 1] : monthKeys.at(-2);
    if (!key) return null;
    const [year, month] = key.split("-").map(Number);
    const total = new Date(year, month, 0).getDate();
    const dates = Array.from({ length: total }, (_, itemIndex) => `${key}-${String(itemIndex + 1).padStart(2, "0")}`);
    const statuses = dates.map(dayStatus);
    return {
      key,
      completed: statuses.filter((status) => status === "completed").length,
      missed: statuses.filter((status) => status === "missed").length,
      greenPause: statuses.filter((status) => status === "green_pause").length
    };
  }, [dayStatus, monthKeys, selectedMonth]);

  const recentHistory = useMemo(() => {
    if (!family.history.length) return [];
    const end = new Date(`${todayKey}T00:00:00`);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return family.history.filter((item) => {
      const date = new Date(`${item.date}T00:00:00`);
      return date >= start && date <= end;
    });
  }, [family.history, todayKey]);

  const calendar = useMemo(() => {
    const first = new Date(`${selectedMonth}-01T00:00:00`);
    const mondayIndex = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells: (number | null)[] = Array(mondayIndex).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [selectedMonth]);

  const selectedStatus = dayStatus(selectedDate);
  const selectedTransaction = family.history.find((item) => item.date === selectedDate);
  const currentLeaderboardEntry = leaderboard.find((entry) => entry.is_current);

  useEffect(() => {
    if (demoMode || loading || needsHousehold) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshFamily().catch(() => undefined);
    };
    const interval = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [demoMode, loading, needsHousehold, refreshFamily]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const loadLeaderboard = async () => {
      setLeaderboardLoading(true);
      setLeaderboard([]);
      setLeaderboardError("");
      try {
        if (demoMode) {
          const matching = demoFamilies.filter((entry) => {
            if (leaderboardScope === "india") return true;
            if (leaderboardScope === "state") return entry.stateProvince.toLowerCase() === family.stateProvince.toLowerCase();
            if (leaderboardScope === "city") return entry.city.toLowerCase() === family.city.toLowerCase();
            return entry.pinCode === family.pinCode;
          });
          const entries = matching
            .map((entry) => ({
              entry,
              points: entry.history.filter((item) => item.date.startsWith(`${selectedMonth}-`)).reduce((sum, item) => sum + item.points, 0)
            }))
            .sort((a, b) => b.points - a.points || a.entry.id.localeCompare(b.entry.id))
            .map(({ entry, points }, index) => ({
              position: index + 1, waste_reward_id: entry.id, family_number: entry.familyNumber,
              family_name: entry.familyName, city: entry.city, state_province: entry.stateProvince,
              locality: entry.locality, monthly_points: points, is_current: entry.id === family.id
            }));
          if (!cancelled) setLeaderboard(entries.slice(0, 20));
          return;
        }

        const { data: { session } } = await supabase!.auth.getSession();
        if (!session) throw new Error("Please sign in again to view the leaderboard.");
        const response = await fetch(`/api/leaderboard?scope=${leaderboardScope}&month=${selectedMonth}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load the leaderboard.");
        if (!cancelled) {
          setLeaderboard(result.entries);
          if (result.nearbyMode === "pin" || result.nearbyMode === "radius") setNearbyMode(result.nearbyMode);
        }
      } catch (error) {
        if (!cancelled) {
          setLeaderboard([]);
          setLeaderboardError(error instanceof Error ? error.message : "Unable to load the leaderboard.");
        }
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    };
    loadLeaderboard();
    return () => { cancelled = true; };
  }, [demoMode, family.city, family.id, family.pinCode, family.stateProvince, leaderboardScope, loading, locationVersion, selectedMonth, selectedMonthPoints]);

  const useMyLocation = () => {
    const client = supabase;
    if (!navigator.geolocation || !client) {
      setLocationMessage("Location is not available in this browser.");
      return;
    }

    setLocationUpdating(true);
    setLocationMessage("Waiting for location permission…");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) throw new Error("Please sign in again.");
        const response = await fetch("/api/families/location", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to save your location.");
        setNearbyMode("radius");
        setLocationMessage("Showing families within 5 km of your approximate location.");
        setLocationVersion((version) => version + 1);
      } catch (error) {
        setLocationMessage(error instanceof Error ? error.message : "Unable to save your location.");
      } finally {
        setLocationUpdating(false);
      }
    }, () => {
      setLocationUpdating(false);
      setLocationMessage("Location permission was not granted. Nearby continues to use your PIN code.");
    }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 });
  };

  const removeMyLocation = async () => {
    const client = supabase;
    if (!client) return;
    setLocationUpdating(true);
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const response = await fetch("/api/families/location", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to remove your location.");
      setNearbyMode("pin");
      setLocationMessage("Approximate location removed. Nearby now uses your PIN code.");
      setLocationVersion((version) => version + 1);
    } catch (error) {
      setLocationMessage(error instanceof Error ? error.message : "Unable to remove your location.");
    } finally {
      setLocationUpdating(false);
    }
  };

  const handleHouseholdSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSetupError("");
      await claimHousehold(familyIdInput, claimCodeInput);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "We could not save your household. Please try again.");
    }
  };

  const selectMonth = (monthKey: string) => {
    const firstRecordedDate = Object.keys(family.days).filter((date) => date.startsWith(`${monthKey}-`)).sort()[0];
    setSelectedMonth(monthKey);
    setSelectedDate(firstRecordedDate ?? `${monthKey}-01`);
  };

  if (loading) {
    return <div className="loading">Loading WasteReward…</div>;
  }

  if (profileError && user && !demoMode) {
    return <main className="setup-page"><section className="setup-card"><div className="logo-mark">♻</div><p className="eyebrow">WASTEREWARD</p><h1>Dashboard unavailable</h1><p className="form-error" role="alert">{profileError}</p><button type="button" className="primary-action" onClick={() => void refreshFamily().catch(() => undefined)}>Try again</button><button type="button" className="text-button" onClick={logout}>Sign out</button></section></main>;
  }

  if (!user && !demoMode) {
    return <LoginCard onLogin={login} demoMode={demoMode} />;
  }

  if (needsHousehold) {
    return (
      <main className="setup-page">
        <section className="setup-card">
          <div className="logo-mark">♻</div>
          <p className="eyebrow">WELCOME TO WASTEREWARD</p>
          <h1>Set up your household</h1>
          <p className="login-copy">Enter the WasteReward ID and one-time claim code provided by your administrator. Sign in with the same email registered for your household.</p>
          <form className="admin-form" onSubmit={handleHouseholdSetup}>
            <label className="field-label">
              WasteReward ID
              <input required value={familyIdInput} onChange={(event) => setFamilyIdInput(event.target.value)} placeholder="e.g. WR101" />
            </label>
            <label className="field-label">
              One-time claim code
              <input required value={claimCodeInput} onChange={(event) => setClaimCodeInput(event.target.value)} placeholder="e.g. ABCDE-23456" autoComplete="one-time-code" />
            </label>
            {setupError && <p className="form-error">{setupError}</p>}
            <button type="submit" className="primary-action">Open my dashboard</button>
          </form>
          <button type="button" className="text-button" onClick={logout}>Use another Google account</button>
          <Link className="login-home-link" href="/">← Back to WasteReward website</Link>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand dashboard-brand" aria-label="Go to WasteReward website home">
          <div className="brand-icon">♻</div>
          <div>
            <strong>WasteReward</strong>
            <span>Green habits. Great rewards.</span>
          </div>
        </Link>

        <div className="profile-area">
          <Link className="website-link" href="/">← Back to website</Link>
          <div className="avatar">
            {(user?.user_metadata.full_name as string | undefined)?.[0] ?? "A"}
          </div>
          <div className="profile-text">
            <strong>{(user?.user_metadata.full_name as string | undefined) ?? family.familyName}</strong>
            <span>{user?.email ?? `Family ID: ${family.id}`}</span>
          </div>
          {!demoMode && (
            <button className="logout-btn" onClick={logout}>Logout</button>
          )}
        </div>
      </header>

      <main className="dashboard">
        <section className="welcome">
          <div>
            <p className="eyebrow">YOUR GREEN JOURNEY</p>
            <h1>Hello, {family.familyName.split(" ")[0]} 👋</h1>
            <p>Keep your green streak alive and unlock your next reward.</p>
          </div>
          <div className="family-badge">
            <span>FAMILY ID</span>
            <strong>{family.id}</strong>
          </div>
        </section>

        <section className="stats-grid">
          <article className="stat-card primary">
            <span className="stat-icon">⭐</span>
            <div>
              <span className="label">{formatMonthYear(selectedMonth)} Points</span>
              <strong>{selectedMonthPoints}</strong>
              <small>points</small>
            </div>
          </article>

          <article className="stat-card">
            <span className="stat-icon">🔥</span>
            <div>
              <span className="label">Current Streak</span>
              <strong>{family.currentStreak}</strong>
              <small>days</small>
            </div>
          </article>

          <article className="stat-card">
            <span className="stat-icon">🏆</span>
            <div>
              <span className="label">Your Rank</span>
              <strong>{currentLeaderboardEntry ? `#${currentLeaderboardEntry.position}` : "—"}</strong>
              <small>{leaderboardScopes.find((scope) => scope.value === leaderboardScope)?.label.toLowerCase()} this month</small>
            </div>
          </article>

          <article className="stat-card">
            <span className="stat-icon">🌱</span>
            <div>
              <span className="label">Best Streak</span>
              <strong>{family.bestStreak}</strong>
              <small>days</small>
            </div>
          </article>

          <article className="stat-card pause-card">
            <span className="stat-icon">⏸</span>
            <div><span className="label">Available Green Pause</span><strong>{family.greenPauseDays}</strong><small>days</small></div>
          </article>

          <article className="stat-card pause-card">
            <span className="stat-icon">🤝</span>
            <div><span className="label">Referral Green Pause</span><strong>{family.referralGreenPauseDays}</strong><small>days</small></div>
          </article>
        </section>

        <ReferralShare familyId={family.id} familyName={family.familyName} referralCount={family.referrals.length} />

        <section className="content-grid">
          <article className="panel calendar-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">ACTIVITY</p>
                <h2>{formatMonthYear(selectedMonth)}</h2>
              </div>
              <span className="streak-pill">🔥 {family.currentStreak} day streak</span>
            </div>

            <div className="month-picker">
              {monthKeys.map((monthKey) => (
                <button
                  key={monthKey}
                  className={`month-option ${selectedMonth === monthKey ? "active" : ""}`}
                  onClick={() => selectMonth(monthKey)}
                  type="button"
                >
                  {formatMonthYear(monthKey)}
                </button>
              ))}
            </div>

            <div className="weekday-row">
              {weekdays.map((day) => <span key={day}>{day}</span>)}
            </div>

            <div className="calendar-grid">
              {calendar.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} className="calendar-cell empty" />;
                const key = `${selectedMonth}-${String(day).padStart(2, "0")}`;
                const status = dayStatus(key);
                const selected = selectedDate === key;

                return (
                  <button
                    key={key}
                    className={`calendar-cell ${status} ${selected ? "selected" : ""}`}
                    onClick={() => setSelectedDate(key)}
                    aria-label={`${key} ${status}`}
                  >
                    <span>{day}</span>
                    {status === "completed" && <b>✓</b>}
                    {status === "missed" && <b>×</b>}
                    {status === "green_pause" && <b>Ⅱ</b>}
                    {status === "pending" && <b>•</b>}
                  </button>
                );
              })}
            </div>

            <div className="legend">
              <span><i className="dot completed-dot" /> Completed</span>
              <span><i className="dot missed-dot" /> Missed</span>
              <span><i className="dot pause-dot" /> Green Pause</span>
              <span><i className="dot future-dot" /> Upcoming</span>
              <span><i className="dot inactive-dot" /> Not tracked</span>
            </div>
          </article>

          <aside className="side-column">
            <article className="panel today-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">SELECTED DAY</p>
                  <h2>{formatDate(selectedDate)}</h2>
                </div>
                <span className={`status-badge ${selectedStatus}`}>
                  {selectedStatus === "completed" ? "Completed" :
                   selectedStatus === "missed" ? "Missed" :
                   selectedStatus === "green_pause" ? "Green Pause" :
                   selectedStatus === "pending" ? "Pending" :
                   selectedStatus === "inactive" ? "Not tracked" : "Upcoming"}
                </span>
              </div>

              {selectedStatus === "completed" ? (
                <div className="activity-detail">
                  <div className="big-check">✓</div>
                  <h3>Waste submission verified</h3>
                  <p>Your segregated waste activity was recorded successfully.</p>
                  <div className="points-earned">{selectedTransaction && selectedTransaction.points > 0 ? "+" : ""}{selectedTransaction?.points ?? 0} <span>points</span></div>
                </div>
              ) : selectedStatus === "green_pause" ? (
                <div className="activity-detail pause-detail">
                  <div className="big-check">⏸</div>
                  <h3>Green Pause used</h3>
                  <p>Your streak is protected for this day, but no reward points are awarded.</p>
                  <div className="points-earned">0 <span>points</span></div>
                </div>
              ) : selectedStatus === "inactive" ? (
                <div className="activity-detail muted">
                  <div className="big-check">—</div>
                  <h3>Not tracked yet</h3>
                  <p>This date is before your household joined WasteReward.</p>
                </div>
              ) : (
                <div className="activity-detail muted">
                  <div className="big-check">♻</div>
                  <h3>Keep your streak going</h3>
                  <p>This date does not have a completed submission yet.</p>
                </div>
              )}
            </article>

            <article className="panel reward-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">NEXT REWARD</p>
                  <h2>🎁 Mystery Reward</h2>
                </div>
                <button
                  type="button"
                  className="gift-button"
                  onClick={() => setRewardOpen((open) => !open)}
                  aria-expanded={rewardOpen}
                >
                  🎁
                </button>
              </div>

              <div className="mystery-preview" aria-label="Mystery reward preview">
                <span className="mystery-text">Surprise secret reward</span>
              </div>

              <div className="progress-label">
                <span>{family.points} / {family.nextReward.pointsRequired} points</span>
                <strong>{Math.max(0, family.nextReward.pointsRequired - family.points)} to go</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="reward-message">
                You are <strong>{Math.max(0, family.nextReward.pointsRequired - family.points)} points</strong> away from your next reward.
              </p>

              {rewardOpen && (
                <div className="reward-surprise">
                  <div className="surprise-head">
                    <span className="gift-icon">🎁</span>
                    <div>
                      <p className="eyebrow">SURPRISE REWARD</p>
                      <h3>{formatMonthYear(selectedMonth)} progress</h3>
                    </div>
                  </div>

                  <div className="month-summary-grid">
                    <div className="summary-box">
                      <strong>{monthSummary.completed}</strong>
                      <span>Completed</span>
                    </div>
                    <div className="summary-box">
                      <strong>{monthSummary.pending}</strong>
                      <span>Pending</span>
                    </div>
                    <div className="summary-box">
                      <strong>{monthSummary.missed}</strong>
                      <span>Missed</span>
                    </div>
                  </div>

                  <p className="surprise-copy">
                    You have <strong>{monthSummary.pending} upcoming eco-days</strong> remaining in this month.
                  </p>
                  <p className="surprise-copy secondary">
                    Rewards unlock from verified points. Your progress toward the next milestone is shown above.
                  </p>
                </div>
              )}
              <Link className="rules-link" href="/reward-rules">View reward rules →</Link>
            </article>
          </aside>
        </section>

        <section className="panel leaderboard-panel">
          <div className="leaderboard-heading">
            <div><p className="eyebrow">COMMUNITY LEADERBOARD</p><h2>{formatMonthYear(selectedMonth)} rankings</h2><p>Top families by points for the selected month. Nearby uses a privacy-rounded 5 km location when enabled, with your PIN code as fallback.</p></div>
            <div className="scope-tabs" role="tablist" aria-label="Leaderboard area">{leaderboardScopes.map((scope) => <button key={scope.value} type="button" role="tab" aria-selected={leaderboardScope === scope.value} className={leaderboardScope === scope.value ? "active" : ""} onClick={() => setLeaderboardScope(scope.value)}>{scope.label}</button>)}</div>
          </div>
          {leaderboardScope === "nearby" && !demoMode && <div className="location-controls"><div><strong>{nearbyMode === "radius" ? "5 km location enabled" : "Using PIN-code area"}</strong><span>{locationMessage || (nearbyMode === "radius" ? "Only coordinates rounded to roughly 1 km are stored." : "Enable location for a more accurate nearby leaderboard.")}</span></div><div className="location-actions"><button type="button" onClick={useMyLocation} disabled={locationUpdating}>{locationUpdating ? "Working…" : nearbyMode === "radius" ? "Update location" : "Use my location"}</button>{nearbyMode === "radius" && <button type="button" onClick={removeMyLocation} disabled={locationUpdating}>Remove location</button>}</div></div>}
          {leaderboardLoading ? <p className="empty-state">Loading rankings…</p> : leaderboardError ? <p className="form-error">{leaderboardError}</p> : leaderboard.length ? <div className="leaderboard-table" role="table" aria-label={`${formatMonthYear(selectedMonth)} leaderboard`}>
            <div className="leaderboard-row leaderboard-labels" role="row"><span>Rank</span><span>Family</span><span>Location</span><span>Points</span></div>
            {leaderboard.slice(0, 20).map((entry) => <div className={`leaderboard-row ${entry.is_current ? "current" : ""}`} role="row" key={entry.waste_reward_id}>
              <strong className="rank-number">{entry.position <= 3 ? ["🥇", "🥈", "🥉"][entry.position - 1] : `#${entry.position}`}</strong>
              <div><strong>{entry.family_name}</strong><small>{entry.family_number} · {entry.waste_reward_id}{entry.is_current ? " · You" : ""}</small></div>
              <span>{leaderboardScope === "nearby" ? entry.locality : leaderboardScope === "city" ? entry.city : leaderboardScope === "state" ? entry.state_province : `${entry.city}, ${entry.state_province}`}</span>
              <b>{entry.monthly_points}</b>
            </div>)}
          </div> : <p className="empty-state">No families have points in this area for {formatMonthYear(selectedMonth)} yet.</p>}
          {currentLeaderboardEntry && currentLeaderboardEntry.position > 20 && <p className="your-rank-note">Your current position: <strong>#{currentLeaderboardEntry.position}</strong> with {currentLeaderboardEntry.monthly_points} points.</p>}
        </section>

        <section className="bottom-grid">
          <article className="panel streak-panel">
            <div className="streak-copy">
              <span className="fire">🔥</span>
              <div>
                <p className="eyebrow">DON&apos;T BREAK YOUR STREAK</p>
                <h2>{family.currentStreak} days and counting!</h2>
                <p>One small habit every day creates a cleaner tomorrow.</p>
              </div>
            </div>
            <div className="next-milestone">
              <span>Next milestone</span>
              <strong>30 Days</strong>
              <small>{Math.max(0, 30 - family.currentStreak)} days left</small>
            </div>
          </article>

          <article className="panel history-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">POINTS</p>
                <h2>Last 7 days</h2>
              </div>
            </div>
            <div className="history-list">
              {recentHistory.map((item) => (
                <div className="history-row" key={item.date}>
                  <div>
                    <strong>{item.reason}</strong>
                    <span>{formatDate(item.date)}</span>
                  </div>
                  <b className={item.points < 0 ? "negative" : ""}>{item.points > 0 ? "+" : ""}{item.points}</b>
                </div>
              ))}
              {!recentHistory.length && <p className="empty-state">No point activity in this seven-day period.</p>}
            </div>
          </article>
        </section>

        <section className="dashboard-details-grid">
          <article className="panel profile-panel">
            <div className="panel-heading"><div><p className="eyebrow">FAMILY PROFILE</p><h2>{family.familyName} · {family.familyNumber}</h2></div></div>
            <dl className="profile-list">
              <div><dt>Family leader</dt><dd>{family.familyLeaderName}</dd></div>
              <div><dt>Email</dt><dd>{family.email || "Not provided"}</dd></div>
              <div><dt>Mobile / WhatsApp</dt><dd>{family.mobileNumber || "Not provided"}</dd></div>
              <div><dt>Alternate mobile</dt><dd>{family.alternateMobileNumber || "Not provided"}</dd></div>
              <div><dt>Leader mobile</dt><dd>{family.familyLeaderMobile || "Not provided"}</dd></div>
              <div><dt>Total members</dt><dd>{family.totalMembers ?? "Not provided"}</dd></div>
              <div className="wide"><dt>Address</dt><dd>{[family.addressLine1, family.addressLine2, family.locality, family.city, family.district, family.stateProvince, family.country, family.pinCode].filter(Boolean).join(", ")}</dd></div>
            </dl>
          </article>

          <article className="panel community-panel">
            <div className="panel-heading"><div><p className="eyebrow">COMMUNITY</p><h2>Family referral tree</h2></div></div>
            <p className="referral-help">Approved households that joined with referral ID <strong>{family.id}</strong> appear below.</p>
            <div className="referral-root"><strong>{family.familyNumber}</strong><span>{family.familyName}</span></div>
            <div className="family-chip-list">{family.referrals.length ? family.referrals.map((entry) => <div className="family-chip" key={entry.id}><strong>{entry.familyNumber}</strong><span>{entry.familyName}</span></div>) : <p className="empty-state">No referred families yet.</p>}</div>
            <h3>Other families nearby</h3>
            <div className="nearby-list">{family.nearbyFamilies.length ? family.nearbyFamilies.map((entry) => <div key={entry.id}><span>🏡</span><p><strong>{entry.familyName} · {entry.familyNumber}</strong><small>{entry.locality}</small></p></div>) : <p className="empty-state">No nearby families are listed yet.</p>}</div>
          </article>

          <article className="panel previous-panel">
            <p className="eyebrow">PREVIOUS MONTH HISTORY</p>
            <h2>{previousMonthSummary ? formatMonthYear(previousMonthSummary.key) : "No previous month"}</h2>
            {previousMonthSummary && <div className="previous-summary"><div><strong>{previousMonthSummary.completed}</strong><span>Completed</span></div><div><strong>{previousMonthSummary.missed}</strong><span>Missed</span></div><div><strong>{previousMonthSummary.greenPause}</strong><span>Green Pause</span></div></div>}
          </article>
        </section>

        <footer>
          <span>♻ WasteReward</span>
          <span>Family: {family.familyName} · House: {family.houseNo}</span>
        </footer>
      </main>
    </div>
  );
}
