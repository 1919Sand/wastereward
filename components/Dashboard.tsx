"use client";

import { useEffect, useMemo, useState } from "react";
import LoginCard from "./LoginCard";
import { useFamily } from "@/hooks/useFamily";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
    selectedFamilyId,
    loading,
    login,
    logout,
    demoMode,
    claimHousehold,
    needsHousehold
  } = useFamily();

  const [selectedMonth, setSelectedMonth] = useState("2026-09");
  const [selectedDate, setSelectedDate] = useState("2026-09-15");
  const [rewardOpen, setRewardOpen] = useState(true);
  const [familyIdInput, setFamilyIdInput] = useState("");
  const [houseNoInput, setHouseNoInput] = useState("");
  const [setupError, setSetupError] = useState("");

  const monthKeys = useMemo(() => {
    const keys = [...new Set(Object.keys(family.days).map((date) => date.slice(0, 7)))];
    return keys.sort((a, b) => a.localeCompare(b));
  }, [family.days]);

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

  useEffect(() => {
    if (!family) return;
    setSelectedMonth((current) => {
      if (!current || !Object.keys(family.days).some((date) => date.startsWith(`${current}-`))) {
        const keys = [...new Set(Object.keys(family.days).map((date) => date.slice(0, 7)))];
        return keys[keys.length - 1] ?? current;
      }
      return current;
    });
  }, [family]);

  const progress = Math.min(
    100,
    Math.round((family.points / family.nextReward.pointsRequired) * 100)
  );

  const monthDates = useMemo(
    () =>
      Object.keys(family.days)
        .filter((date) => date.startsWith(`${selectedMonth}-`))
        .sort(),
    [family.days, selectedMonth]
  );

  const monthSummary = useMemo(() => {
    const statuses = monthDates.map((date) => family.days[date] ?? "future");
    const completed = statuses.filter((status) => status === "completed").length;
    const pending = statuses.filter((status) => status === "pending").length;
    const missed = statuses.filter((status) => status === "missed").length;
    const co2Saved = Number((completed * 2.7).toFixed(1));

    return { completed, pending, missed, co2Saved };
  }, [family.days, monthDates]);

  const calendar = useMemo(() => {
    const first = new Date(`${selectedMonth}-01T00:00:00`);
    const mondayIndex = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells: (number | null)[] = Array(mondayIndex).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [selectedMonth]);

  const selectedStatus = family.days[selectedDate] ?? "future";

  const handleHouseholdSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSetupError("");
      await claimHousehold(familyIdInput, houseNoInput);
    } catch {
      setSetupError("We could not save your household. Please try again.");
    }
  };

  if (loading) {
    return <div className="loading">Loading WasteReward…</div>;
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
          <p className="login-copy">Enter the details your WasteReward administrator gave you to connect your Google account to your points and streak.</p>
          <form className="admin-form" onSubmit={handleHouseholdSetup}>
            <label className="field-label">
              WasteReward ID
              <input required value={familyIdInput} onChange={(event) => setFamilyIdInput(event.target.value)} placeholder="e.g. WR101" />
            </label>
            <label className="field-label">
              House number
              <input required value={houseNoInput} onChange={(event) => setHouseNoInput(event.target.value)} placeholder="e.g. A-1201" />
            </label>
            {setupError && <p className="form-error">{setupError}</p>}
            <button type="submit" className="primary-action">Open my dashboard</button>
          </form>
          <button type="button" className="text-button" onClick={logout}>Use another Google account</button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">♻</div>
          <div>
            <strong>WasteReward</strong>
            <span>Green habits. Great rewards.</span>
          </div>
        </div>

        <div className="profile-area">
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
              <span className="label">Available Points</span>
              <strong>{family.points}</strong>
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
              <strong>#{family.rank}</strong>
              <small>this month</small>
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
        </section>

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
                  onClick={() => setSelectedMonth(monthKey)}
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
                const status = family.days[key] ?? "future";
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
                    {status === "pending" && <b>•</b>}
                  </button>
                );
              })}
            </div>

            <div className="legend">
              <span><i className="dot completed-dot" /> Completed</span>
              <span><i className="dot missed-dot" /> Missed</span>
              <span><i className="dot future-dot" /> Upcoming</span>
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
                   selectedStatus === "pending" ? "Pending" : "Upcoming"}
                </span>
              </div>

              {selectedStatus === "completed" ? (
                <div className="activity-detail">
                  <div className="big-check">✓</div>
                  <h3>Waste submission verified</h3>
                  <p>Your segregated waste activity was recorded successfully.</p>
                  <div className="points-earned">+5 <span>points</span></div>
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
                      <strong>{monthSummary.co2Saved.toFixed(1)} kg</strong>
                      <span>CO₂ saved</span>
                    </div>
                  </div>

                  <p className="surprise-copy">
                    You still need <strong>{monthSummary.pending} eco-days</strong> this month to complete your streak and unlock a surprise reward.
                  </p>
                  <p className="surprise-copy secondary">
                    After completion, you&apos;ll have saved about <strong>{monthSummary.co2Saved.toFixed(1)} kg</strong> of CO₂ and earned the next reward milestone.
                  </p>
                </div>
              )}
            </article>
          </aside>
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
                <h2>Recent Activity</h2>
              </div>
            </div>
            <div className="history-list">
              {family.history.map((item) => (
                <div className="history-row" key={`${item.date}-${item.reason}`}>
                  <div>
                    <strong>{item.reason}</strong>
                    <span>{formatDate(item.date)}</span>
                  </div>
                  <b>+{item.points}</b>
                </div>
              ))}
            </div>
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
