import type { Metadata } from "next";
import { SentinelHubView } from "@/components/sentinel/sentinel-hub-view";

export const metadata: Metadata = {
  title: "Sentinel Safety Monitoring",
  description: "Proactive safety monitoring and live incident response intelligence.",
};

export default function SentinelPage() {
  return <SentinelHubView />;
}
