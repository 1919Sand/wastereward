import { HomePage } from "@/components/PublicSite";

export default function Home() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "WasteReward",
    url: "https://wastereward.in",
    description: "A family platform for tracking sustainable habits, points and rewards."
  };
  return <><HomePage /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} /></>;
}
