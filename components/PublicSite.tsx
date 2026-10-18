"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { WASTEREWARD_WHATSAPP_DISPLAY, wasteRewardWhatsAppUrl } from "@/lib/whatsapp";

const navItems = [
  ["How It Works", "/how-it-works"],
  ["Rewards", "/rewards"],
  ["Impact", "/impact"],
  ["About", "/about"],
  ["FAQ", "/faq"]
] as const;

function GetStartedLink({ className, children }: { className: string; children: React.ReactNode }) {
  const [href, setHref] = useState("/contact?intent=join");

  useEffect(() => {
    const referralId = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase();
    setHref(`/contact?intent=join${referralId ? `&ref=${encodeURIComponent(referralId)}` : ""}`);
  }, []);

  return <a className={className} href={href}>{children}</a>;
}

export const faqs = [
  ["What is WasteReward?", "WasteReward helps families turn everyday waste-management habits into visible progress, points and rewards."],
  ["How do I earn points?", "Your household earns points when sustainable activities are recorded and verified by your WasteReward administrator."],
  ["Can my whole family participate?", "Yes. WasteReward is designed around shared household habits, so everyone can contribute to one family goal."],
  ["How do streaks work?", "Complete your sustainable activity consistently to keep your streak alive. Your dashboard shows daily status and milestones."],
  ["How are rewards redeemed?", "Rewards are unlocked when your household reaches the applicable points milestone. Availability can vary by community."],
  ["How is impact calculated?", "Impact metrics are based on recorded activity. The dashboard shows your household progress; public examples are clearly marked as previews."]
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-nav">
    <Link className="site-brand" href="/" onClick={() => setOpen(false)}>
      <Image src="/images/wastereward-logo.jpg" alt="WasteReward" width={58} height={58} />
      <span>Waste<span>Reward</span></span>
    </Link>
    <button className="menu-toggle" aria-label={open ? "Close navigation" : "Open navigation"} aria-controls="primary-navigation" aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /><span /></button>
    <nav id="primary-navigation" aria-label="Primary navigation" className={open ? "site-links open" : "site-links"}>
      <Link href="/" onClick={() => setOpen(false)}>Home</Link>
      {navItems.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
      <div className="nav-actions"><Link href="/dashboard" className="nav-login" onClick={() => setOpen(false)}>Member Login</Link><GetStartedLink className="button button-small">Get Started <span>↗</span></GetStartedLink></div>
    </nav>
    </header>
  </>;
}

export function Footer() {
  return <footer className="site-footer"><div className="footer-main">
    <div className="footer-brand"><Image src="/images/wastereward-logo.jpg" alt="WasteReward" width={64} height={64} /><h3>Waste<span>Reward</span></h3><p>Small habits. Shared purpose.<br />A cleaner tomorrow.</p></div>
    <div><h4>Explore</h4><Link href="/about">About us</Link><Link href="/how-it-works">How it works</Link><Link href="/rewards">Rewards</Link><Link href="/impact">Our impact</Link></div>
    <div><h4>Support</h4><Link href="/faq">FAQs</Link><Link href="/contact">Contact</Link><Link href="/dashboard">Member login</Link></div>
    <div className="footer-join"><h4>Ready to begin?</h4><p>New here? Tell us you&apos;re interested on WhatsApp.</p><GetStartedLink className="button button-small">Get started <span>↗</span></GetStartedLink></div>
  </div><aside className="footer-sponsor" aria-label="Best Caller"><span className="sponsor-mark" aria-hidden="true">BC</span><div className="sponsor-copy"><strong>Best Caller</strong><p>Identify callers, block spam calls and connect with confidence.</p></div><div className="sponsor-actions"><a href="https://bestcallerapp.com" target="_blank" rel="noopener noreferrer">Visit website <span aria-hidden="true">↗</span></a><a className="sponsor-play-link" href="https://play.google.com/store/apps/details?id=com.bestcallerapp.app" target="_blank" rel="noopener noreferrer" aria-label="Download Best Caller on Google Play"><span aria-hidden="true">▶</span><span><small>GET IT ON</small>Google Play</span></a></div></aside><div className="footer-bottom"><span>© {new Date().getFullYear()} WasteReward. Built for better habits.</span><span>Privacy · Terms</span></div></footer>;
}

function SectionTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) { return <div className="section-title"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{copy && <p>{copy}</p>}</div>; }

export function FAQList({ limit }: { limit?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  return <div className="faq-list">{faqs.slice(0, limit).map(([question, answer], index) => {
    const panelId = `${id}-${index}`;
    return <div className={`faq-item ${active === index ? "active" : ""}`} key={question}><button onClick={() => setActive(active === index ? null : index)} aria-expanded={active === index} aria-controls={panelId}><span>{question}</span><b aria-hidden="true">{active === index ? "−" : "+"}</b></button>{active === index && <p id={panelId}>{answer}</p>}</div>;
  })}</div>;
}

function ProductFlow() { return <section className="flow-section section-wrap"><SectionTitle eyebrow="THE SIMPLE LOOP" title="From waste to worthwhile." copy="A clear path that makes the right habit feel rewarding." /><div className="flow-grid">{[["01", "Waste", "Notice what your household uses and discards.", "♻"], ["02", "Track", "Record the action and keep your progress visible.", "✓"], ["03", "Earn", "Collect points for consistent sustainable habits.", "★"], ["04", "Impact", "Watch small actions add up to a cleaner community.", "◎"]].map(([number, title, copy, icon]) => <div className="flow-card" key={title}><span className="flow-number">{number}</span><div className="flow-icon">{icon}</div><h3>{title}</h3><p>{copy}</p><span className="flow-arrow">→</span></div>)}</div></section>; }

function HowSteps() { return <section className="steps-section section-wrap"><div className="steps-image"><Image src="/images/hero-recycle.png" alt="A child carrying a recyclable waste bag" fill sizes="(max-width: 800px) 90vw, 45vw" /></div><div><SectionTitle eyebrow="HOW IT WORKS" title="Good habits work better together." copy="WasteReward makes sustainability simple enough for every member of the family." /><div className="steps-list">{[["01", "Create your family", "Set up your household profile and connect it to your WasteReward ID."], ["02", "Track the everyday", "Record waste-management and sustainable activities as they happen."], ["03", "Earn points", "Every verified action brings your family closer to its next reward."], ["04", "Build your streak", "Stay consistent, celebrate milestones and grow your impact together."]].map(([number, title, copy]) => <div className="step" key={number}><b>{number}</b><div><h3>{title}</h3><p>{copy}</p></div></div>)}</div></div></section>; }

function DashboardPreview() { return <section className="preview-section"><div className="preview-copy"><p className="eyebrow">YOUR GREEN JOURNEY</p><h2>Progress you can see. Habits you can keep.</h2><p>Already have a WasteReward ID? Your private dashboard keeps points, rankings and family progress in one place.</p><ul><li><span>✓</span>Monthly activity and points</li><li><span>✓</span>Local and India leaderboards</li><li><span>✓</span>Current and best streaks</li></ul><Link href="/dashboard" className="button">Member login <span>↗</span></Link></div><div className="dashboard-mock"><div className="mock-top"><span>WasteReward</span><span>Family dashboard · WR001</span></div><div className="mock-welcome"><div><small>YOUR GREEN JOURNEY</small><h3>Hello, Sand 👋</h3><p>Keep your green streak alive.</p></div><b>🔥 24 day streak</b></div><div className="mock-stats"><div><small>SEPTEMBER POINTS</small><strong>120</strong><span>points</span></div><div><small>CURRENT STREAK</small><strong>24</strong><span>days</span></div><div><small>YOUR RANK</small><strong>#1</strong><span>nearby</span></div></div><div className="mock-panels"><div className="mock-calendar"><small>ACTIVITY</small><h4>September 2026</h4><div className="mock-days">{Array.from({ length: 21 }, (_, i) => <i className={i < 15 ? "done" : i < 17 ? "pending" : ""} key={i}>{i + 1}</i>)}</div></div><div className="mock-reward"><small>NEXT REWARD</small><h4>🎁 Mystery Reward</h4><div className="mock-progress"><span /></div><p>80 points to go</p></div></div></div></section>; }

function RewardsPreview() { return <section className="rewards-section section-wrap"><SectionTitle eyebrow="REWARDS THAT MATTER" title="Make every good choice count." copy="A little recognition goes a long way. Unlock milestones for the habits you are building together." /><div className="reward-cards">{[["₹50", "Everyday Saver", "100 points", "#c9e98e"], ["₹100", "Green Champion", "200 points", "#f8d88b"], ["★", "Special reward", "500 points", "#c5d7ef"]].map(([amount, name, points, color]) => <div className="reward-card" key={name}><div className="reward-art" style={{ background: color }}><Image src="/images/rewards.png" alt="" width={110} height={110} /></div><div><span>{points}</span><h3>{name}</h3><p>Unlock at {points}</p></div><b>{amount}</b></div>)}</div><div className="center-link"><Link href="/rewards" className="text-link">Explore the reward journey <span>→</span></Link></div></section>; }

export function HomePage() { return <><Navbar /><main id="main-content"><section className="hero"><div className="hero-copy"><p className="eyebrow">A BETTER HABIT, REWARDED</p><h1>Turn your everyday waste into <em>rewards.</em></h1><p className="hero-lead">Track sustainable habits, build streaks, earn points and make a measurable environmental impact — together with your family.</p><div className="hero-actions"><GetStartedLink className="button">Get started on WhatsApp <span>↗</span></GetStartedLink><Link href="/dashboard" className="button button-quiet">Already a member? Login <span>→</span></Link></div><div className="hero-proof"><div className="proof-avatars"><span>🌱</span><span>♻</span><span>★</span></div><p><strong>Small actions, shared impact.</strong><br />Build a cleaner routine with your family.</p></div></div><div className="hero-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><Image src="/images/hero-recycle.png" alt="Child sorting recyclable waste" width={560} height={560} priority /><div className="floating-card points-float"><span>✦</span><div><b>+5 points</b><small>Daily activity</small></div></div><div className="floating-card streak-float"><span>🔥</span><div><b>24 days</b><small>Current streak</small></div></div></div></section><ProductFlow /><HowSteps /><DashboardPreview /><section className="family-section"><div><p className="eyebrow">ONE FAMILY, ONE GOAL</p><h2>Make sustainability<br /><em>a family habit.</em></h2><p>When everyone plays a part, the smallest daily choices become a shared source of pride.</p><Link href="/about" className="text-link">Our purpose <span>→</span></Link></div><div className="family-board"><div className="family-circle">♻<small>FAMILY<br />IMPACT</small></div><div className="family-node node-one">🌱<span>Daily habits</span></div><div className="family-node node-two">🔥<span>Shared streak</span></div><div className="family-node node-three">★<span>Earn together</span></div></div></section><RewardsPreview /><section className="impact-strip"><Image src="/images/impact-banner.jpg" alt="Green palms and trees" fill sizes="100vw" /><div className="impact-overlay"><p className="eyebrow">IMPACT, MADE VISIBLE</p><h2>Every day is a chance<br />to leave less behind.</h2><Link href="/impact" className="button button-light">See our impact <span>→</span></Link></div></section><section className="faq-section section-wrap"><SectionTitle eyebrow="QUESTIONS, ANSWERED" title="A clearer way to get started." /><FAQList limit={4} /><div className="center-link"><Link href="/faq" className="text-link">See all FAQs <span>→</span></Link></div></section><CTA /></main><Footer /></>; }

function CTA() { return <section className="final-cta"><div><p className="eyebrow">YOUR NEXT GOOD HABIT</p><h2>Ready to make a difference<br /><em>one day at a time?</em></h2><p>New families can register their interest on WhatsApp. Existing members can log in with the WasteReward ID issued by the administrator.</p><GetStartedLink className="button button-light">I&apos;m interested <span>↗</span></GetStartedLink></div></section>; }

export function InteriorPage({ type }: { type: "about" | "how" | "rewards" | "impact" | "faq" | "contact" }) {
  const content = { about: ["ABOUT WASTEREWARD", "Better habits begin at home.", "WasteReward is a simple family platform that turns responsible waste habits into visible progress, motivation and meaningful rewards."], how: ["HOW IT WORKS", "Sustainability, made simple.", "A daily loop that helps your household move from intention to action."], rewards: ["THE REWARD JOURNEY", "Good choices deserve a little celebration.", "Earn points for consistent sustainable activity and work toward milestones as a family."], impact: ["OUR IMPACT", "Small actions create a bigger change.", "WasteReward helps make the environmental value of everyday habits easier to understand and sustain."], faq: ["FAQ", "Everything you need to know.", "Start here if you are curious about how WasteReward fits into your family routine."], contact: ["CONTACT", "Let’s make better habits easier.", "Have a question, suggestion or partnership idea? We would love to hear from you."] }[type];
  return <><Navbar /><main id="main-content" className="interior"><section className="interior-hero"><p className="eyebrow">{content[0]}</p><h1>{content[1]}</h1><p>{content[2]}</p></section>{type === "about" && <AboutContent />}{type === "how" && <HowSteps />}{type === "rewards" && <RewardsContent />}{type === "impact" && <ImpactContent />}{type === "faq" && <section className="section-wrap interior-faq"><FAQList /></section>}{type === "contact" && <ContactContent />}</main><Footer /></>;
}

function AboutContent() { return <section className="story-grid section-wrap"><div><p className="eyebrow">WHY WE EXIST</p><h2>What if doing the right thing felt rewarding?</h2><p>Waste is not only a disposal problem. It is a habit problem, a visibility problem and a community problem. WasteReward brings these pieces together in a way families can use every day.</p><p>We believe sustainability grows when it is simple, social and celebrated. That is why the platform turns small actions into progress people can see and share.</p></div><Image src="/images/gardening.png" alt="Person caring for a green garden" width={640} height={415} /></section>; }
function RewardsContent() { return <section className="section-wrap"><RewardsPreview /><div className="partner-row"><p>Potential reward partners can help make progress feel even more tangible.</p><div>{["/images/partner-britannia.png", "/images/partner-coca-cola.png", "/images/partner-dabur.png"].map(src => <Image key={src} src={src} alt="Partner logo" width={120} height={55} />)}</div></div></section>; }
function ImpactContent() { return <section className="section-wrap impact-content"><div className="impact-metrics"><div><strong>01</strong><span>Track a habit</span></div><div><strong>02</strong><span>Build consistency</span></div><div><strong>03</strong><span>Grow collective impact</span></div></div><div className="story-grid impact-story"><div><p className="eyebrow">A CLEARER PICTURE</p><h2>Impact should feel close, not abstract.</h2><p>Every recorded action gives families a clearer picture of their own progress. As the community grows, those individual habits create a shared story of care.</p><Link href="/dashboard" className="button">See your dashboard <span>↗</span></Link></div><div className="impact-earth-art"><div className="earth-glow" /><Image src="/images/earth-impact.png" alt="Green Earth surrounded by recycling arrows and leaves" width={1463} height={1920} sizes="(max-width: 650px) 78vw, 42vw" /></div></div></section>; }
function ContactContent() {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [interest, setInterest] = useState({ subject: "", message: "", referralId: "" });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("intent") === "join") {
      const referral = params.get("ref")?.trim().toUpperCase();
      setInterest({ subject: "I’m interested in joining WasteReward", message: referral ? `I would like to join WasteReward. Referral ID: ${referral}` : "I would like to join WasteReward. Please share the next steps.", referralId: referral ?? "" });
    }
  }, []);
  async function submitContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState("sending"); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "We could not send your message.");
      event.currentTarget.reset(); setState("success"); setMessage("Thank you — your message has been sent.");
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "We could not send your message."); }
  }
  const whatsappMessage = ["Hi, I’m interested in starting WasteReward for my family.", interest.referralId ? `Referral ID: ${interest.referralId}` : "", "Please help me with the onboarding process."].filter(Boolean).join("\n");
  return <section className="contact-grid section-wrap"><div><p className="eyebrow">SAY HELLO</p><h2>We&apos;re listening.</h2><p>For questions about your account, rewards or bringing WasteReward to your community, send us a note.</p><div className="contact-note"><span>✉</span><div><b>Contact form</b><small>We&apos;ll respond through the details you provide.</small></div></div></div><div className="contact-actions-column"><a className="whatsapp-contact-card" href={wasteRewardWhatsAppUrl(whatsappMessage)} target="_blank" rel="noreferrer"><span className="whatsapp-contact-icon">WA</span><div><small>FASTEST WAY TO GET STARTED</small><strong>WhatsApp me</strong><b>{WASTEREWARD_WHATSAPP_DISPLAY}</b><p>Tap to send “I&apos;m interested” and start your family onboarding.</p></div><i>↗</i></a><form className="contact-form" onSubmit={submitContact}><label>Name<input required name="name" autoComplete="name" placeholder="Your name" /></label><label>Email<input required type="email" name="email" autoComplete="email" placeholder="you@example.com" /></label><label>Subject<input key={`subject-${interest.subject}`} required name="subject" defaultValue={interest.subject} placeholder="How can we help?" /></label><label>Message<textarea key={`message-${interest.message}`} required name="message" rows={5} defaultValue={interest.message} placeholder="Tell us a little more..." /></label>{message && <p className={state === "success" ? "success-message" : "form-error"} role="status">{message}</p>}<button className="button" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : <>Send message <span>↗</span></>}</button></form></div></section>;
}
