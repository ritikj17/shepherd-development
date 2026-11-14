import type { Metadata } from "next";

import { IncidentDetailView } from "@/components/incidents/incident-detail-view";

export const metadata: Metadata = {
  title: "Incident details",
};

export default function IncidentDetailPage() {
  return <IncidentDetailView />;
}
