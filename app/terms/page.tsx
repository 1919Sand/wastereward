import type { Metadata } from "next";
import { Footer, Navbar } from "@/components/PublicSite";

export const metadata: Metadata = { title: "Terms of Use", description: "Terms governing use of WasteReward." };

export default function TermsPage() {
  return <><Navbar /><main id="main-content" className="legal-page"><p className="eyebrow">TERMS</p><h1>Terms of use</h1><p className="legal-updated">Last updated: 18 October 2026</p><section><h2>Using WasteReward</h2><p>Use your own household account and keep one-time claim codes confidential. Do not attempt to access another household, manipulate activity records, interfere with the service, or use automated methods without permission.</p><h2>Points and rewards</h2><p>Points are awarded after administrator verification. Corrections may replace earlier daily entries. Reward availability, eligibility and fulfilment can vary by community and are subject to the published reward rules.</p><h2>Location and leaderboards</h2><p>Location participation is optional. Rankings may use approximate location, PIN code, city, state or country. Leaderboards are motivational features and may change when entries are corrected.</p><h2>Availability</h2><p>We work to keep the service accurate and available but cannot guarantee uninterrupted operation. Features and rules may change with reasonable notice.</p><h2>Questions</h2><p>Contact WasteReward if you have questions about these terms or a points entry.</p></section></main><Footer /></>;
}
