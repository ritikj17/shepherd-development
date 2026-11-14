import type { Metadata } from "next";

import { SafeCircleView } from "@/components/safety/safecircle-view";

export const metadata: Metadata = {
  title: "SafeCircle",
};

export default function SafeCirclePage() {
  return <SafeCircleView />;
}
