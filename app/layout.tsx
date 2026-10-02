import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wastereward.in"),
  title: { default: "WasteReward — Turn Waste Into Rewards", template: "%s | WasteReward" },
  description: "WasteReward helps families track sustainable habits, earn rewards, build streaks and create measurable environmental impact.",
  alternates: { canonical: "https://wastereward.in" },
  openGraph: { title: "WasteReward — Turn Waste Into Rewards", description: "Make sustainability a family habit.", url: "https://wastereward.in", siteName: "WasteReward", type: "website" },
  twitter: { card: "summary_large_image", title: "WasteReward — Turn Waste Into Rewards", description: "Make sustainability a family habit." },
  icons: { icon: "/images/wastereward-logo.jpg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
