"use client";

import * as React from "react";
import { toast } from "sonner";

/**
 * Registers the hand-written service worker in production builds only.
 * The worker caches static assets and the offline page; it never caches API
 * responses or private evidence.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        if (cancelled) return;

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              toast("A new SHEPHERD version is available", {
                description:
                  "Reload to update the application shell. Your locally saved drafts are kept.",
                action: {
                  label: "Reload",
                  onClick: () => window.location.reload(),
                },
                duration: 12_000,
              });
            }
          });
        });
      } catch {
        // A failed service worker registration must never break the app.
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
