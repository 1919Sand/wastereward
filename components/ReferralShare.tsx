"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  familyId: string;
  familyName: string;
  referralCount: number;
};

export default function ReferralShare({ familyId, familyName, referralCount }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"link" | "caption" | "">("");
  const [siteOrigin, setSiteOrigin] = useState("https://wastereward.in");
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => setSiteOrigin(window.location.origin), []);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const shareUrl = `${siteOrigin}/?ref=${encodeURIComponent(familyId)}`;
  const quote = "One family can start a habit. A neighbourhood can start a movement.";
  const caption = useMemo(() => [
    quote,
    "",
    `${familyName} is part of WasteReward — a movement that turns responsible waste habits into progress, recognition and rewards.`,
    "",
    "Join through our family invite and help build a cleaner community.",
    `Referral ID: ${familyId}`,
  ].join("\n"), [familyId, familyName]);
  const message = `${caption}\n${shareUrl}`;

  async function copy(value: string, type: "link" | "caption") {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = value;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }
    setCopied(type);
    window.setTimeout(() => setCopied(""), 2200);
  }

  async function shareWithApps() {
    if (!navigator.share) {
      await copy(message, "caption");
      return;
    }
    try {
      await navigator.share({ title: "Join the WasteReward movement", text: caption, url: shareUrl });
      setOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  async function shareOnInstagram() {
    await copy(message, "caption");
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  }

  return <>
    <section className="referral-banner" aria-labelledby="referral-title">
      <div className="referral-art" aria-hidden="true"><span>🌱</span><span>🏡</span><span>🌍</span></div>
      <div className="referral-banner-copy">
        <p className="eyebrow">GROW THE MOVEMENT</p>
        <h2 id="referral-title">Bring one family. Change one neighbourhood.</h2>
        <blockquote>“{quote}”</blockquote>
        <p>Invite family, friends or neighbours to join WasteReward. Every approved referral grows your tree and earns your family <strong>1 Referral Green Pause</strong>.</p>
        <div className="referral-proof"><span>🎁 Reward after approval</span><span>🌿 {referralCount} joined through you</span><span>🔗 Your ID: {familyId}</span></div>
      </div>
      <button className="referral-cta" type="button" onClick={() => setOpen(true)}><span>Share your invite</span><small>WhatsApp, Instagram, Facebook & more</small></button>
    </section>

    {open && <div className="share-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <button ref={closeButton} className="share-close" type="button" onClick={() => setOpen(false)} aria-label="Close sharing options">×</button>
        <div className="share-modal-head"><span>🌍</span><div><p className="eyebrow">YOUR FAMILY INVITE</p><h2 id="share-title">Share the movement</h2></div></div>
        <p className="share-intro">Choose where you want to share. Your personal referral ID and website link are already included.</p>
        <div className="share-quote"><blockquote>“{quote}”</blockquote><span>wastereward.in · {familyId}</span></div>
        <div className="share-options">
          <a className="share-option whatsapp" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><i>WA</i><span><strong>WhatsApp</strong><small>Share with family or neighbours</small></span></a>
          <button className="share-option instagram" type="button" onClick={shareOnInstagram}><i>IG</i><span><strong>Instagram</strong><small>Caption copied — paste in Story or DM</small></span></button>
          <a className="share-option facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><i>f</i><span><strong>Facebook</strong><small>Post to your community</small></span></a>
          <button className="share-option more" type="button" onClick={shareWithApps}><i>↗</i><span><strong>More apps</strong><small>Use your phone&apos;s share menu</small></span></button>
          <a className="share-option email" href={`mailto:?subject=${encodeURIComponent("Join the WasteReward movement")}&body=${encodeURIComponent(message)}`}><i>✉</i><span><strong>Email</strong><small>Send the complete invitation</small></span></a>
          <button className="share-option copy" type="button" onClick={() => copy(shareUrl, "link")}><i>⧉</i><span><strong>{copied === "link" ? "Link copied!" : "Copy invite link"}</strong><small>Share it anywhere</small></span></button>
        </div>
        {copied === "caption" && <p className="copy-confirmation" role="status">Invitation caption copied. Paste it into Instagram or any app.</p>}
        <p className="share-disclaimer">Referral rewards are added after the invited household is approved and linked to your Referral ID.</p>
      </section>
    </div>}
  </>;
}
