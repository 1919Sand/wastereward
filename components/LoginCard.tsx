"use client";

import { useState } from "react";
import Link from "next/link";
import { wasteRewardWhatsAppUrl } from "@/lib/whatsapp";

type Props = {
  onLogin: () => Promise<void>;
  demoMode: boolean;
};

export default function LoginCard({ onLogin, demoMode }: Props) {
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const interestMessage = "Hi WasteReward, I’m interested in joining with my family. Please share the next steps.";
  const interestHref = wasteRewardWhatsAppUrl(interestMessage);

  async function handleLogin() {
    setError("");
    setLoggingIn(true);
    try {
      await onLogin();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to start Google sign-in.");
      setLoggingIn(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="logo-mark">♻</div>
        <p className="eyebrow">WASTEREWARD</p>
        <h1>Good habits.<br />Great rewards.</h1>
        <p className="login-copy">
          Continue with Google to open your household dashboard or create a new Green Pass in a few steps.
        </p>
        <button className="google-btn" onClick={handleLogin} disabled={loggingIn}>
          <span className="google-g">G</span>
          {loggingIn ? "Opening Google…" : demoMode ? "Open Demo Dashboard" : "Continue with Google"}
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="tiny">
          {demoMode
            ? "Demo mode is active. Add Supabase keys to enable Google Login."
            : "Your account is securely connected with Google."}
        </p>
        <a className="member-interest-link" href={interestHref} target="_blank" rel="noreferrer">Need help? Chat with us on WhatsApp →</a>
        <Link className="login-home-link" href="/">← Back to WasteReward website</Link>
      </section>
    </main>
  );
}
