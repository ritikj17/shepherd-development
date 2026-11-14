import type { Metadata } from "next";
import { Suspense } from "react";

import { PatternGraphView } from "@/components/patterns/pattern-graph-view";

export const metadata: Metadata = {
  title: "PatternGraph",
};

export default function PatternGraphPage() {
  return (
    <Suspense
      fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}
    >
      <PatternGraphView />
    </Suspense>
  );
}
