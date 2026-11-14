import type { Metadata } from "next";

import { EditIncidentView } from "@/components/incidents/edit-incident-view";

export const metadata: Metadata = {
  title: "Edit incident",
};

export default function EditIncidentPage() {
  return <EditIncidentView />;
}
