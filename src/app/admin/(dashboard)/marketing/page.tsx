import { Megaphone } from "lucide-react";
import ComingSoonModule from "@/components/admin/ComingSoonModule";

export default function AdminMarketingPage() {
  return (
    <ComingSoonModule
      icon={Megaphone}
      title="Marketing Studio"
      tagline="Plan and publish campaigns, content, and social posts from one place."
      blocked={{
        reason: "Needs real accounts for the platforms you want to publish to.",
        detail: "Google Business Profile, Google Ads, Meta/Instagram/Facebook, and TikTok all require their own developer app registration and connected business account before anything here could actually publish. See docs/INTEGRATIONS.md.",
      }}
      capabilities={[
        "Draft and schedule social posts and ad campaigns for approval before anything goes out",
        "Track cost per lead and cost per booked customer by channel",
        "Only recommend promoting in areas you actually have capacity to serve",
        "Every publish requires your explicit approval, nothing posts automatically",
      ]}
    />
  );
}
