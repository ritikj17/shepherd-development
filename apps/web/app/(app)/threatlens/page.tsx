import type { Metadata } from "next";
import { Suspense } from "react";

import { ThreatLensView } from "@/components/analysis/threatlens-view";

export const metadata: Metadata = {
  title: "ThreatLens",
};

export default function ThreatLensPage() {
  return (
    <Suspense
      fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}
    >
      <ThreatLensView />
    </Suspense>
  );
}
