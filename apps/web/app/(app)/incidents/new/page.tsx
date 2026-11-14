import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { IncidentForm } from "@/components/incidents/incident-form";

export const metadata: Metadata = {
  title: "New incident",
};

export default function NewIncidentPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Incidents"
        title="Record an incident"
        description="Create a chronological record in your own words. Evidence and analysis are optional next steps."
      />
      <IncidentForm mode="create" />
    </div>
  );
}
