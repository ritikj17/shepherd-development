import type { Metadata } from "next";

import { EvidenceView } from "@/components/evidence/evidence-view";

export const metadata: Metadata = {
  title: "EvidenceVault",
};

export default function EvidencePage() {
  return <EvidenceView />;
}
