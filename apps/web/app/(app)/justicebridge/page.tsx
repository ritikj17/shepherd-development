import type { Metadata } from "next";
import { Suspense } from "react";

import { JusticeBridgeView } from "@/components/reports/justicebridge-view";

export const metadata: Metadata = {
  title: "JusticeBridge",
};

export default function JusticeBridgePage() {
  return (
    <Suspense
      fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}
    >
      <JusticeBridgeView />
    </Suspense>
  );
}
