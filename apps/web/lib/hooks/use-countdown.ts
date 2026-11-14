"use client";

import * as React from "react";

import { formatCountdown } from "@/lib/utils/format";

function snapshot(deadline: string | null | undefined) {
  if (!deadline) return { label: "—", expired: false };
  return {
    label: formatCountdown(deadline),
    expired: Date.parse(deadline) <= Date.now(),
  };
}

/**
 * Countdown label for a check-in deadline. The state is seeded during mount and
 * refreshed every 30 seconds. Callers that can change the deadline for the same
 * mounted element should key the element by the deadline.
 */
export function useCountdown(deadline: string | null | undefined) {
  const [state, setState] = React.useState(() => snapshot(deadline));

  React.useEffect(() => {
    if (!deadline) return;
    const update = () => setState(snapshot(deadline));
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, [deadline]);

  if (!deadline) return { label: "—", expired: false };
  return state;
}
