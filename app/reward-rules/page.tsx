import Link from "next/link";

const rules = [
  { title: "Daily points", text: "Points are awarded once per family per calendar day after a collection is verified. If an administrator corrects the same day, the new entry replaces the earlier one." },
  { title: "Completed day", text: "A verified waste collection is marked Completed and earns the number of points shown in the daily entry." },
  { title: "Missed day", text: "A missed collection earns 0 points and is shown as Missed in the activity calendar." },
  { title: "Green Pause", text: "A Green Pause protects the day but awards 0 points. Available pauses are used before the day is recorded." },
  { title: "Referral pauses", text: "Referral-earned Green Pause days are shown separately and may be used before regular Green Pause days." },
  { title: "Corrections", text: "The administrator can replace an incorrect daily entry. Your total changes only by the difference between the old and new values." }
];

export default function RewardRulesPage() {
  return (
    <main className="rules-page">
      <section className="rules-hero"><p className="eyebrow">WASTEREWARD</p><h1>Reward rules</h1><p>How daily activity, points, streak protection, and corrections work.</p><Link href="/dashboard">← Back to dashboard</Link></section>
      <section className="rules-grid">{rules.map((rule, index) => <article className="panel" key={rule.title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{rule.title}</h2><p>{rule.text}</p></article>)}</section>
      <p className="rules-note">Questions about a specific entry? Contact your WasteReward administrator with your Family ID and the activity date.</p>
    </main>
  );
}
